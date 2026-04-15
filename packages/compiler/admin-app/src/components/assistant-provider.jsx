import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';
import { createAcpClient, AcpStatus } from '../lib/acp-client.js';
import {
  listSessions,
  getSession,
  createSession as createLocalSession,
  updateSession as updateLocalSession,
  deleteSession as deleteLocalSession,
} from '../lib/acp-sessions.js';

const AssistantContext = createContext(null);

function extractText(content) {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(extractText).join('');
  if (content.type === 'text') return content.text ?? '';
  if (content.text) return content.text;
  return '';
}

function summarizeToolCall(toolCall) {
  if (!toolCall) return '';
  return String(toolCall.title || toolCall.kind || toolCall.name || 'Tool');
}

function applyUpdate(messages, update, turnId) {
  const kind = update?.sessionUpdate || update?.session_update;
  if (!kind) return messages;

  if (kind === 'agent_message_chunk' || kind === 'agent_thought_chunk') {
    const role = kind === 'agent_thought_chunk' ? 'thought' : 'assistant';
    const chunkText = extractText(update.content);
    if (!chunkText) return messages;
    const last = messages[messages.length - 1];
    if (last && last.turnId === turnId && last.role === role && last.kind === 'text') {
      return [...messages.slice(0, -1), { ...last, text: (last.text || '') + chunkText }];
    }
    return [
      ...messages,
      {
        id: `${role}-${turnId}-${messages.length}`,
        turnId,
        role,
        kind: 'text',
        text: chunkText,
      },
    ];
  }

  if (kind === 'tool_call') {
    return [
      ...messages,
      {
        id: `tool-${update.toolCallId}`,
        turnId,
        role: 'tool',
        kind: 'tool',
        toolCallId: update.toolCallId,
        title: summarizeToolCall(update),
        status: update.status || 'pending',
        raw: update,
      },
    ];
  }

  if (kind === 'tool_call_update') {
    const id = update.toolCallId;
    return messages.map((message) => {
      if (message.kind !== 'tool' || message.toolCallId !== id) return message;
      return {
        ...message,
        status: update.status || message.status,
        title: update.title || message.title,
        raw: { ...message.raw, ...update },
      };
    });
  }

  if (kind === 'plan') {
    const last = messages[messages.length - 1];
    const plan = { kind: 'plan', entries: update.entries || [], id: `plan-${turnId}` };
    if (last && last.kind === 'plan' && last.turnId === turnId) {
      return [...messages.slice(0, -1), { ...last, ...plan, turnId }];
    }
    return [...messages, { ...plan, turnId, role: 'plan' }];
  }

  return messages;
}

export function AssistantProvider({ children }) {
  const client = useMemo(() => createAcpClient(), []);

  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState(AcpStatus.Idle);
  const [statusError, setStatusError] = useState(null);
  const [permissionRequests, setPermissionRequests] = useState([]);
  const [sessions, setSessions] = useState(() => listSessions());
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [sessionListOpen, setSessionListOpen] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [streamingStarted, setStreamingStarted] = useState(false);
  // Editor-side selection bridge. The block editor mounts its own sub-registry
  // via BlockEditorProvider, so the rail can't `useSelect` across that boundary.
  // The editor publishes its selection here and a clear callback that targets
  // the correct inner registry.
  const [selectedBlock, setSelectedBlockState] = useState(null);
  const clearSelectedBlockRef = useRef(null);
  // Surface context: screens publish which entity they're focused on so the
  // agent can know "the current page is X at path Y" without the user saying it.
  const [surfaceContext, setSurfaceContext] = useState(null);
  const currentTurnId = useRef(null);

  const location = useLocation();

  useEffect(() => {
    const offStatus = client.on('status', ({ status: next, error }) => {
      setStatus(next);
      setStatusError(error);
    });
    const offUpdate = client.on('update', (update) => {
      const kind = update?.sessionUpdate || update?.session_update;
      // First agent-facing signal for the current turn → flip from "loading"
      // to "streaming"; this is what drives send → stop button transition.
      if (
        kind === 'agent_message_chunk' ||
        kind === 'agent_thought_chunk' ||
        kind === 'tool_call' ||
        kind === 'plan'
      ) {
        setStreamingStarted(true);
      }
      setMessages((current) => applyUpdate(current, update, currentTurnId.current));
    });
    const offPermission = client.on('permission_request', (req) => {
      // Queue permission requests so back-to-back asks don't clobber each
      // other. The UI surfaces the head of the queue and tools wait for the
      // user before any blue "running" state shows.
      setPermissionRequests((current) => [...current, req]);
    });
    const offError = client.on('error', (err) => setStatusError(String(err?.message || err)));

    if (client.isAvailable()) {
      client.connect().catch(() => {
        // status listener already captures the error
      });
    }

    return () => {
      offStatus();
      offUpdate();
      offPermission();
      offError();
      client.disconnect();
    };
  }, [client]);

  useEffect(() => {
    if (activeSessionId) return;
    const existing = listSessions();
    const seed = existing.find((s) => (s.messages || []).length > 0) || existing[0];
    if (seed) {
      setActiveSessionId(seed.id);
      setMessages(seed.messages || []);
    } else {
      const created = createLocalSession();
      setSessions(listSessions());
      setActiveSessionId(created.id);
      setMessages([]);
    }
  }, [activeSessionId]);

  useEffect(() => {
    if (!activeSessionId) return;
    const timeout = setTimeout(() => {
      updateLocalSession(activeSessionId, { messages });
      setSessions(listSessions());
    }, 250);
    return () => clearTimeout(timeout);
  }, [activeSessionId, messages]);

  const prompt = useCallback(
    async (promptContent, text) => {
      if (status === AcpStatus.Prompting) return;
      const turnId = `t-${Date.now()}`;
      currentTurnId.current = turnId;
      setStreamingStarted(false);

      if (text) {
        setMessages((current) => [
          ...current,
          { id: `u-${turnId}`, turnId, role: 'user', kind: 'text', text },
        ]);
      }

      try {
        if (!client.sessionId) {
          const current = activeSessionId ? getSession(activeSessionId) : null;
          if (current?.agentSessionId && client.supportsLoadSession) {
            try {
              await client.loadSession(current.agentSessionId);
            } catch {
              const newId = await client.newSession();
              if (activeSessionId) {
                updateLocalSession(activeSessionId, { agentSessionId: newId });
                setSessions(listSessions());
              }
            }
          } else {
            const newId = await client.newSession();
            if (activeSessionId) {
              updateLocalSession(activeSessionId, { agentSessionId: newId });
              setSessions(listSessions());
            }
          }
        }
        await client.prompt(promptContent);
      } catch (err) {
        setMessages((current) => [
          ...current,
          {
            id: `err-${turnId}`,
            turnId,
            role: 'error',
            kind: 'text',
            text: String(err?.message || err),
          },
        ]);
      }
    },
    [activeSessionId, client, status]
  );

  const cancel = useCallback(() => {
    client.cancel();
    // Reject any outstanding permission requests so the agent unblocks and
    // the UI doesn't show stale "needs approval" rows.
    setPermissionRequests((current) => {
      for (const req of current) {
        try {
          req.resolve({ outcome: { outcome: 'cancelled' } });
        } catch {
          // best-effort
        }
      }
      return [];
    });
    // Mark any still-running tools as failed locally — the agent's own
    // session/cancel response often skips per-tool updates.
    setMessages((msgs) => msgs.map((m) =>
      m.kind === 'tool' && m.status !== 'completed' && m.status !== 'failed'
        ? { ...m, status: 'failed' }
        : m
    ));
  }, [client]);

  const switchSession = useCallback(
    async (id) => {
      if (!id || id === activeSessionId) {
        setSessionListOpen(false);
        return;
      }
      const target = getSession(id);
      if (!target) return;
      setSessionListOpen(false);
      setActiveSessionId(id);
      setMessages(target.messages || []);
      client.setActiveSession(null);
      if (target.agentSessionId && client.supportsLoadSession) {
        setIsResuming(true);
        try {
          await client.loadSession(target.agentSessionId);
        } catch {
          // fall through — next prompt will mint fresh.
        } finally {
          setIsResuming(false);
        }
      }
    },
    [activeSessionId, client]
  );

  const newSession = useCallback(() => {
    const created = createLocalSession();
    setSessions(listSessions());
    setActiveSessionId(created.id);
    setMessages([]);
    setSessionListOpen(false);
    client.setActiveSession(null);
  }, [client]);

  const removeSession = useCallback(
    (id) => {
      deleteLocalSession(id);
      const remaining = listSessions();
      setSessions(remaining);
      if (id === activeSessionId) {
        if (remaining[0]) {
          switchSession(remaining[0].id);
        } else {
          newSession();
        }
      }
    },
    [activeSessionId, newSession, switchSession]
  );

  const resolvePermission = useCallback(
    (outcome, requestId = null) => {
      setPermissionRequests((current) => {
        if (current.length === 0) return current;
        const target = requestId
          ? current.find((r) => r.id === requestId)
          : current[0];
        if (!target) return current;
        try {
          target.resolve(outcome);
        } catch {
          // best-effort; the agent may have already cancelled.
        }

        // If the user denied or cancelled, the agent often skips emitting a
        // tool_call_update — the tool would stay "running" forever. Mark it
        // failed locally so the UI matches reality.
        const optionId = String(outcome?.outcome?.optionId || '').toLowerCase();
        const outcomeKind = String(outcome?.outcome?.outcome || '').toLowerCase();
        const denied =
          outcomeKind === 'cancelled' ||
          /reject|deny|cancel/.test(optionId);
        if (denied) {
          const toolCallId =
            target.params?.toolCall?.toolCallId || target.params?.toolCallId;
          if (toolCallId) {
            setMessages((msgs) => msgs.map((m) =>
              m.kind === 'tool' && m.toolCallId === toolCallId && m.status !== 'completed'
                ? { ...m, status: 'failed' }
                : m
            ));
          }
        }

        return current.filter((r) => r !== target);
      });
    },
    []
  );

  // Set of tool-call IDs that are currently blocked on user approval.
  // Consumers use this to render an "awaiting approval" state instead of
  // the in-progress pulse.
  const pendingPermissionToolIds = useMemo(() => {
    const ids = new Set();
    for (const req of permissionRequests) {
      const id = req.params?.toolCall?.toolCallId || req.params?.toolCallId;
      if (id) ids.add(id);
    }
    return ids;
  }, [permissionRequests]);

  const publishSelectedBlock = useCallback((block, clearer) => {
    setSelectedBlockState(block || null);
    clearSelectedBlockRef.current = typeof clearer === 'function' ? clearer : null;
  }, []);

  const clearSelectedBlock = useCallback(() => {
    if (typeof clearSelectedBlockRef.current === 'function') {
      clearSelectedBlockRef.current();
    }
    setSelectedBlockState(null);
  }, []);

  const publishSurfaceContext = useCallback((next) => {
    setSurfaceContext(next || null);
  }, []);

  /**
   * Build a compact resource block describing the current editor surface.
   * The agent reads this on every prompt so "edit the current page" works
   * without the user having to spell out which file.
   */
  const buildSurfaceContextBlock = useCallback(() => {
    const route = location?.pathname || null;
    const view = surfaceContext?.view || null;
    const entity = surfaceContext?.entity || null;
    if (!route && !view && !entity) return null;

    const lines = [];
    if (route) lines.push(`route: ${route}`);
    if (view) lines.push(`view: ${view}`);
    if (entity) {
      lines.push('entity:');
      if (entity.kind) lines.push(`  kind: ${entity.kind}`);
      if (entity.id != null) lines.push(`  id: ${entity.id}`);
      if (entity.label) lines.push(`  label: ${JSON.stringify(entity.label)}`);
      if (entity.model) lines.push(`  model: ${entity.model}`);
      if (entity.slug) lines.push(`  slug: ${entity.slug}`);
      if (entity.sourceFile) lines.push(`  sourceFile: ${entity.sourceFile}`);
      if (Array.isArray(entity.possibleSourcePaths) && entity.possibleSourcePaths.length) {
        lines.push('  possibleSourcePaths:');
        for (const p of entity.possibleSourcePaths) lines.push(`    - ${p}`);
      }
      if (entity.notes) lines.push(`  notes: ${JSON.stringify(entity.notes)}`);
    }

    return {
      type: 'resource',
      resource: {
        uri: 'wplite://surface-context',
        mimeType: 'text/yaml',
        text: lines.join('\n'),
      },
    };
  }, [location, surfaceContext]);

  const value = useMemo(
    () => ({
      client,
      isAvailable: client.isAvailable(),
      status,
      statusError,
      messages,
      setMessages,
      permissionRequest: permissionRequests[0] || null,
      permissionRequests,
      pendingPermissionToolIds,
      resolvePermission,
      sessions,
      activeSessionId,
      sessionListOpen,
      setSessionListOpen,
      isResuming,
      isStreaming: status === AcpStatus.Prompting,
      streamingStarted,
      selectedBlock,
      publishSelectedBlock,
      clearSelectedBlock,
      surfaceContext,
      publishSurfaceContext,
      buildSurfaceContextBlock,
      prompt,
      cancel,
      newSession,
      switchSession,
      removeSession,
    }),
    [
      client,
      status,
      statusError,
      messages,
      permissionRequests,
      pendingPermissionToolIds,
      resolvePermission,
      sessions,
      activeSessionId,
      sessionListOpen,
      isResuming,
      streamingStarted,
      selectedBlock,
      publishSelectedBlock,
      clearSelectedBlock,
      surfaceContext,
      publishSurfaceContext,
      buildSurfaceContextBlock,
      prompt,
      cancel,
      newSession,
      switchSession,
      removeSession,
    ]
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

export function useAssistant() {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error('useAssistant must be used within AssistantProvider');
  return ctx;
}

/**
 * Pages call this with the entity they're focused on. The shape:
 *
 *   { view: 'page-editor', entity: { kind, id, label, model, slug,
 *     sourceFile, possibleSourcePaths, notes } }
 *
 * `view` and most entity fields are optional — pass what you know. The route
 * is filled in automatically. Any falsy value clears the published context
 * on cleanup.
 */
export function useRegisterAssistantContext(context) {
  const { publishSurfaceContext } = useAssistant();
  useEffect(() => {
    publishSurfaceContext(context || null);
    return () => publishSurfaceContext(null);
  }, [context, publishSurfaceContext]);
}

export { AcpStatus };
