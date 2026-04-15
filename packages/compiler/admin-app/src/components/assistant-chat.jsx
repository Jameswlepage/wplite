import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, Close, Checkmark, Warning, StopFilled, TrashCan, Attachment, Document } from '@carbon/icons-react';
import { BlockIcon } from '@wordpress/block-editor';
import { getBlockType, serialize as serializeBlocks } from '@wordpress/blocks';
import { marked } from 'marked';

// GitHub-flavored markdown rendering for assistant responses. The agent's
// output is local Claude content — we trust it enough to use innerHTML, but
// we still gate on role === 'assistant' so user/error messages stay literal.
marked.setOptions({ gfm: true, breaks: true });

function renderMarkdown(text) {
  if (!text) return { __html: '' };
  try {
    return { __html: marked.parse(String(text)) };
  } catch {
    return { __html: String(text) };
  }
}
import { useAssistantSurface } from './workspace-context.jsx';
import { useAssistant } from './assistant-provider.jsx';

function describeSelectedBlock(block) {
  if (!block) return null;
  const blockType = getBlockType(block.name);
  const label = blockType?.title || block.name;
  const icon = blockType?.icon || null;
  const attrPreview =
    block.attributes?.content ||
    block.attributes?.text ||
    block.attributes?.url ||
    block.attributes?.label ||
    block.attributes?.title ||
    '';
  const trimmed = typeof attrPreview === 'string'
    ? attrPreview.replace(/<[^>]+>/g, '').trim().slice(0, 60)
    : '';
  return { block, name: block.name, label, icon, clientId: block.clientId, preview: trimmed };
}

function formatSessionTimestamp(ms) {
  if (!ms) return '';
  const date = new Date(ms);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/**
 * Walk the flat message list and bundle consecutive `kind === 'tool'`
 * entries into a single tool-group entry. Plan, text, and other entries pass
 * through as-is. The output is a list of `{ kind: 'message' | 'tool-group' }`
 * suitable for the render loop.
 */
function groupMessages(messages) {
  const out = [];
  let bucket = null;
  for (const m of messages) {
    if (m.kind === 'tool') {
      if (!bucket) {
        bucket = { kind: 'tool-group', id: `group-${m.id}`, tools: [] };
        out.push(bucket);
      }
      bucket.tools.push(m);
    } else {
      bucket = null;
      out.push({ kind: 'message', id: m.id, message: m });
    }
  }
  return out;
}

function toolStatusTone(status, awaitingPermission) {
  if (awaitingPermission) return 'await';
  if (status === 'completed') return 'ok';
  if (status === 'failed') return 'err';
  return 'pending';
}

function classifyOption(option) {
  // Map ACP option kinds to a UX category. The kind names follow Zed's spec
  // but agents are inconsistent — match on substring as a fallback.
  const kind = String(option?.kind || option?.optionId || option?.name || '').toLowerCase();
  if (/(^|_)reject|deny/.test(kind)) return 'reject';
  if (/always/.test(kind) && /allow|accept/.test(kind)) return 'always';
  if (/allow|accept/.test(kind)) return 'allow';
  return 'allow';
}

function pickPrimaryOptions(options) {
  if (!Array.isArray(options) || options.length === 0) {
    // Fallback when the agent doesn't enumerate options.
    return [
      { optionId: 'allow', name: 'Allow', kind: 'allow_once' },
      { optionId: 'allow_always', name: 'Always', kind: 'allow_always' },
      { optionId: 'reject', name: 'Reject', kind: 'reject_once' },
    ];
  }
  return options;
}

function ToolCallRow({ tool, awaitingPermission = false, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const rawInput = tool.raw?.rawInput || tool.raw?.input;
  const rawOutput = tool.raw?.rawOutput || tool.raw?.content;
  const tone = toolStatusTone(tool.status, awaitingPermission);
  const hasDetails = Boolean(rawInput || rawOutput);

  return (
    <div className="workspace-chat__tool-row">
      <button
        type="button"
        className="workspace-chat__tool-row-header"
        onClick={() => hasDetails && setOpen((v) => !v)}
        disabled={!hasDetails}
      >
        <span
          className={`workspace-chat__tool-dot workspace-chat__tool-dot--${tone}`}
          aria-hidden="true"
          title={awaitingPermission ? 'Waiting for your approval' : undefined}
        />
        <span className="workspace-chat__tool-row-title">{tool.title}</span>
        {awaitingPermission ? (
          <span className="workspace-chat__tool-row-await">Needs approval</span>
        ) : null}
      </button>
      {open && hasDetails ? (
        <div className="workspace-chat__tool-row-body">
          {rawInput ? (
            <pre className="workspace-chat__tool-block">{JSON.stringify(rawInput, null, 2)}</pre>
          ) : null}
          {rawOutput ? (
            <pre className="workspace-chat__tool-block">
              {typeof rawOutput === 'string' ? rawOutput : JSON.stringify(rawOutput, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ToolGroupCard({ tools, pendingPermissionToolIds }) {
  const awaitingIds = pendingPermissionToolIds || new Set();
  const awaitingCount = tools.filter((t) => awaitingIds.has(t.toolCallId)).length;
  const runningCount = tools.filter(
    (t) => !awaitingIds.has(t.toolCallId)
      && t.status !== 'completed'
      && t.status !== 'failed'
  ).length;
  const stillActive = awaitingCount + runningCount > 0;
  const [open, setOpen] = useState(stillActive);
  const userToggled = useRef(false);
  useEffect(() => {
    if (userToggled.current) return;
    setOpen(stillActive);
  }, [stillActive]);

  const completedCount = tools.filter((t) => t.status === 'completed').length;
  const failedCount = tools.filter((t) => t.status === 'failed').length;
  const total = tools.length;
  const summary = awaitingCount > 0
    ? `Waiting on ${awaitingCount} approval${awaitingCount === 1 ? '' : 's'}`
    : runningCount > 0
      ? `Using ${total} tool${total === 1 ? '' : 's'}…`
      : failedCount > 0
        ? `${completedCount}/${total} done · ${failedCount} failed`
        : `Used ${total} tool${total === 1 ? '' : 's'}`;
  const headerTone = awaitingCount > 0
    ? 'await'
    : runningCount > 0
      ? 'pending'
      : failedCount > 0
        ? 'err'
        : 'ok';

  return (
    <div className={`workspace-chat__tool-group${stillActive ? ' is-running' : ''}`}>
      <button
        type="button"
        className="workspace-chat__tool-group-header"
        onClick={() => {
          userToggled.current = true;
          setOpen((v) => !v);
        }}
        aria-expanded={open}
      >
        <span
          className={`workspace-chat__tool-dot workspace-chat__tool-dot--${headerTone}`}
          aria-hidden="true"
        />
        <span className="workspace-chat__tool-group-summary">{summary}</span>
        <span
          className={`workspace-chat__tool-group-chevron${open ? ' is-open' : ''}`}
          aria-hidden="true"
        >
          ›
        </span>
      </button>
      {open ? (
        <div className="workspace-chat__tool-group-body">
          {tools.map((t) => (
            <ToolCallRow
              key={t.id}
              tool={t}
              awaitingPermission={awaitingIds.has(t.toolCallId)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PlanCard({ message }) {
  return (
    <div className="workspace-chat__plan">
      <div className="workspace-chat__plan-title">Plan</div>
      <ol className="workspace-chat__plan-list">
        {(message.entries || []).map((entry, index) => (
          <li
            key={index}
            className={`workspace-chat__plan-item workspace-chat__plan-item--${entry.status || 'pending'}`}
          >
            <span className="workspace-chat__plan-dot" aria-hidden="true" />
            <span>{entry.content || entry.text || ''}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function PermissionCard({ request, queueLength, onResolve }) {
  const params = request.params || {};
  const tool = params.toolCall || {};
  const toolTitle = tool.title || tool.kind || tool.name || 'this action';
  const options = pickPrimaryOptions(params.options);

  function decide(option) {
    onResolve(
      {
        outcome: {
          outcome: 'selected',
          optionId: option.optionId || option.id || option.name,
        },
      },
      request.id
    );
  }

  return (
    <div className="workspace-chat__perm-card" role="dialog" aria-label="Approve tool call">
      <div className="workspace-chat__perm-card-body">
        <div className="workspace-chat__perm-card-meta">
          <span
            className="workspace-chat__tool-dot workspace-chat__tool-dot--await"
            aria-hidden="true"
          />
          <span className="workspace-chat__perm-card-title" title={toolTitle}>
            {toolTitle}
          </span>
          {queueLength > 1 ? (
            <span className="workspace-chat__perm-card-queue">
              +{queueLength - 1} more
            </span>
          ) : null}
        </div>
        <div className="workspace-chat__perm-card-actions">
          {options.map((option) => {
            const variant = classifyOption(option);
            return (
              <button
                key={option.optionId || option.name}
                type="button"
                className={`workspace-chat__perm-btn workspace-chat__perm-btn--${variant}`}
                onClick={() => decide(option)}
              >
                {option.name || option.optionId}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8MB per file — keeps prompts workable.
const TEXT_LIKE_MIMES = /^(text\/|application\/(json|xml|javascript|typescript|yaml))/;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.readAsText(file);
  });
}

function extractBase64(dataUrl) {
  const idx = dataUrl.indexOf(',');
  return idx === -1 ? dataUrl : dataUrl.slice(idx + 1);
}

async function materializeAttachment(file) {
  const base = {
    id: `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: file.name || 'attachment',
    mime: file.type || 'application/octet-stream',
    size: file.size,
  };
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { ...base, error: 'File is larger than 8 MB.' };
  }
  try {
    if (file.type.startsWith('image/')) {
      const dataUrl = await readFileAsDataUrl(file);
      return { ...base, kind: 'image', dataUrl, data: extractBase64(dataUrl) };
    }
    if (TEXT_LIKE_MIMES.test(file.type) || /\.(md|txt|json|ya?ml|csv|tsv|log|html?|xml|svg|js|mjs|cjs|ts|tsx|jsx|css|php|py|rs|go|rb|java|c|cpp|h|hpp|sh)$/i.test(file.name)) {
      const text = await readFileAsText(file);
      return { ...base, kind: 'text', text };
    }
    // Fall back to base64 resource — ACP/Claude may not know what to do with
    // arbitrary binaries, but we still attach so the model can at least see
    // the metadata.
    const dataUrl = await readFileAsDataUrl(file);
    return { ...base, kind: 'binary', dataUrl, data: extractBase64(dataUrl) };
  } catch (err) {
    return { ...base, error: err.message || 'Failed to read file.' };
  }
}

function attachmentsToBlocks(attachments) {
  const blocks = [];
  for (const att of attachments) {
    if (att.error || !att.kind) continue;
    if (att.kind === 'image' && att.data) {
      blocks.push({ type: 'image', data: att.data, mimeType: att.mime });
    } else if (att.kind === 'text' && att.text) {
      blocks.push({
        type: 'resource',
        resource: {
          uri: `wplite://attachment/${encodeURIComponent(att.name)}`,
          mimeType: att.mime || 'text/plain',
          text: att.text,
        },
      });
    } else if (att.kind === 'binary' && att.dataUrl) {
      blocks.push({
        type: 'resource',
        resource: {
          uri: `wplite://attachment/${encodeURIComponent(att.name)}`,
          mimeType: att.mime,
          blob: att.dataUrl,
        },
      });
    }
  }
  return blocks;
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AssistantChat() {
  const assistant = useAssistant();
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const textareaRef = useRef(null);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);

  const { selectedBlock, clearSelectedBlock } = assistant;
  const blockContext = describeSelectedBlock(selectedBlock);
  const { assistantSurface } = useAssistantSurface();
  const surfacePresets = assistantSurface?.presets || [];
  const surfaceSuggestions = assistantSurface?.suggestions || [];
  const surfaceControls = assistantSurface?.controls || null;
  const surfacePlaceholder = assistantSurface?.placeholder || '';

  const {
    messages,
    sessions,
    activeSessionId,
    sessionListOpen,
    setSessionListOpen,
    isResuming,
    isStreaming,
    streamingStarted,
    permissionRequest,
    pendingPermissionToolIds,
    resolvePermission,
    prompt,
    cancel,
    switchSession,
    removeSession,
    client,
    isAvailable,
  } = assistant;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, permissionRequest, sessionListOpen]);

  function autogrow() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 94), 134)}px`;
  }

  function buildPromptContent(text) {
    const blocks = [{ type: 'text', text }];
    const surfaceBlock = assistant.buildSurfaceContextBlock?.();
    if (surfaceBlock) blocks.push(surfaceBlock);
    if (blockContext?.block) {
      const serialized = (() => {
        try {
          return serializeBlocks([blockContext.block]);
        } catch {
          return '';
        }
      })();
      if (serialized) {
        blocks.push({
          type: 'resource',
          resource: {
            uri: `wplite://selected-block/${blockContext.name}`,
            mimeType: 'text/html',
            text: serialized,
          },
        });
      }
    }
    for (const block of attachmentsToBlocks(attachments)) {
      blocks.push(block);
    }
    return blocks;
  }

  async function addFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const materialized = await Promise.all(files.map(materializeAttachment));
    setAttachments((current) => [...current, ...materialized]);
  }

  function removeAttachment(id) {
    setAttachments((current) => current.filter((att) => att.id !== id));
  }

  function onPickFiles(event) {
    addFiles(event.target.files);
    event.target.value = '';
  }

  function onDragEnter(event) {
    if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return;
    event.preventDefault();
    dragCounter.current += 1;
    setDragOver(true);
  }

  function onDragOver(event) {
    if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }

  function onDragLeave(event) {
    if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return;
    event.preventDefault();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setDragOver(false);
  }

  function onDrop(event) {
    if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return;
    event.preventDefault();
    dragCounter.current = 0;
    setDragOver(false);
    addFiles(event.dataTransfer.files);
  }

  function onPaste(event) {
    const items = event.clipboardData?.files;
    if (items && items.length > 0) {
      event.preventDefault();
      addFiles(items);
    }
  }

  async function send(overridePrompt) {
    const text = (typeof overridePrompt === 'string' ? overridePrompt : draft).trim();
    if (!text && !assistantSurface?.onSubmit) return;

    if (typeof assistantSurface?.onSubmit === 'function') {
      setDraft('');
      try {
        await assistantSurface.onSubmit({
          prompt: text,
          state: assistantSurface.scope || null,
          block: blockContext?.block || null,
        });
      } catch {
        // surface-level handler owns error presentation
      }
      return;
    }

    if (!text && attachments.length === 0) return;
    if (!isAvailable) return;
    if (isStreaming) return;

    const content = buildPromptContent(text);
    setDraft('');
    setAttachments([]);
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.focus();
      }
    });
    prompt(content, text);
  }

  function runPreset(preset) {
    if (!preset) return;
    if (typeof preset.run === 'function') {
      preset.run({
        submit: (nextPrompt) => send(nextPrompt),
        setPrompt: setDraft,
        state: assistantSurface?.scope || null,
      });
      return;
    }
    if (typeof preset.prompt === 'string') {
      setDraft(preset.prompt);
      textareaRef.current?.focus();
    }
  }

  function onComposerClick(event) {
    if (event.target.closest('.workspace-chat__send')) return;
    textareaRef.current?.focus();
  }

  function onSendClick() {
    if (isStreaming && streamingStarted) {
      cancel();
    } else if (!isStreaming) {
      send();
    }
    // else: pending (isStreaming && !streamingStarted) — button is disabled.
  }

  const canSend =
    (draft.trim().length > 0 || attachments.length > 0) && !isStreaming && isAvailable;
  const bridgeMissing = !isAvailable;
  const isEmptyThread =
    !sessionListOpen &&
    !bridgeMissing &&
    !isResuming &&
    !permissionRequest &&
    messages.length === 0;
  const hasHeroContent =
    surfaceSuggestions.length > 0 || surfacePresets.length > 0;
  const buttonMode = !isStreaming
    ? 'send'
    : streamingStarted
      ? 'stop'
      : 'pending';

  return (
    <div
      className={`workspace-chat${dragOver ? ' workspace-chat--drop-target' : ''}`}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {dragOver ? (
        <div className="workspace-chat__drop-overlay" aria-hidden="true">
          <div className="workspace-chat__drop-overlay-inner">
            <Attachment size={18} />
            <span>Drop files to attach</span>
          </div>
        </div>
      ) : null}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={onPickFiles}
      />
      <div className="workspace-chat__thread" ref={scrollRef}>
        {sessionListOpen ? (
          <div className="workspace-chat__sessions">
            {sessions.length === 0 ? (
              <div className="workspace-chat__empty">No past conversations yet.</div>
            ) : (
              <ul className="workspace-chat__session-list">
                {sessions.map((session) => (
                  <li
                    key={session.id}
                    className={`workspace-chat__session-item${session.id === activeSessionId ? ' is-active' : ''}`}
                  >
                    <button
                      type="button"
                      className="workspace-chat__session-main"
                      onClick={() => switchSession(session.id)}
                    >
                      <span className="workspace-chat__session-title">{session.title}</span>
                      <span className="workspace-chat__session-meta">
                        {(session.messages || []).length} msg
                        {' · '}
                        {formatSessionTimestamp(session.updatedAt)}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="workspace-chat__session-delete"
                      aria-label={`Delete ${session.title}`}
                      title="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSession(session.id);
                      }}
                    >
                      <TrashCan size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!client.supportsLoadSession && sessions.some((s) => s.agentSessionId) ? (
              <div className="workspace-chat__sessions-note">
                This agent doesn't support resume — opening a past conversation shows
                its history but starts a fresh agent session on the next message.
              </div>
            ) : null}
          </div>
        ) : null}

        {!sessionListOpen && bridgeMissing ? (
          <div className="workspace-chat__empty">
            The assistant is powered by a local ACP agent — start the dev
            server with <code>wp-light dev</code> to activate it.
          </div>
        ) : null}

        {!sessionListOpen && isResuming ? (
          <div className="workspace-chat__empty">Resuming conversation…</div>
        ) : null}

        {isEmptyThread && hasHeroContent ? (
          <div className="workspace-chat__hero">
            <div className="workspace-chat__hero-inner">
              {surfaceSuggestions.length > 0 ? (
                <div
                  className="workspace-chat__hero-suggestions"
                  aria-label="Suggested prompts"
                >
                  {surfaceSuggestions.map((s) => (
                    <button
                      key={s.id || s.label}
                      type="button"
                      className="workspace-chat__hero-suggestion"
                      onClick={() => runPreset(s)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              ) : null}
              {surfacePresets.length > 0 ? (
                <div className="workspace-chat__hero-presets" aria-label="Presets">
                  {surfacePresets.map((p) => (
                    <button
                      key={p.id || p.label}
                      type="button"
                      className="workspace-chat__hero-preset"
                      onClick={() => runPreset(p)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {!sessionListOpen && messages.length > 0 ? (
          <ol className="workspace-chat__messages" aria-live="polite">
            {groupMessages(messages).map((entry) => {
              if (entry.kind === 'tool-group') {
                return (
                  <li
                    key={entry.id}
                    className="workspace-chat__message workspace-chat__message--tool-group"
                  >
                    <ToolGroupCard
                      tools={entry.tools}
                      pendingPermissionToolIds={pendingPermissionToolIds}
                    />
                  </li>
                );
              }
              const message = entry.message;
              if (message.kind === 'plan') {
                return (
                  <li key={message.id} className="workspace-chat__message workspace-chat__message--plan">
                    <PlanCard message={message} />
                  </li>
                );
              }
              const isAssistantText =
                (message.role === 'assistant' || message.role === 'thought') &&
                message.kind === 'text';
              const isLastStreaming =
                isAssistantText &&
                isStreaming &&
                message === messages[messages.length - 1];
              return (
                <li
                  key={message.id}
                  className={`workspace-chat__message workspace-chat__message--${message.role}`}
                >
                  {isAssistantText ? (
                    <div className="workspace-chat__bubble workspace-chat__bubble--md">
                      <div
                        className="workspace-chat__md"
                        dangerouslySetInnerHTML={renderMarkdown(message.text)}
                      />
                      {isLastStreaming ? (
                        <span className="workspace-chat__caret" aria-hidden="true" />
                      ) : null}
                    </div>
                  ) : (
                    <div className="workspace-chat__bubble">{message.text}</div>
                  )}
                </li>
              );
            })}
          </ol>
        ) : null}

      </div>

      {!sessionListOpen && permissionRequest ? (
        <PermissionCard
          request={permissionRequest}
          queueLength={(assistant.permissionRequests || []).length}
          onResolve={resolvePermission}
        />
      ) : null}

      <div
        className="workspace-chat__composer"
        role="group"
        aria-label="AI assistant composer"
        onClick={onComposerClick}
      >
        {blockContext ? (
          <div className="workspace-chat__context" aria-live="polite">
            <div
              className="workspace-chat__context-pill"
              title={`${blockContext.label} block in context`}
            >
              {blockContext.icon ? (
                <span className="workspace-chat__context-icon" aria-hidden="true">
                  <BlockIcon icon={blockContext.icon} showColors />
                </span>
              ) : null}
              <span className="workspace-chat__context-label">
                <span className="workspace-chat__context-name">{blockContext.label}</span>
                {blockContext.preview ? (
                  <span className="workspace-chat__context-preview">{blockContext.preview}</span>
                ) : null}
              </span>
              <button
                type="button"
                className="workspace-chat__context-remove"
                onClick={(event) => {
                  event.stopPropagation();
                  clearSelectedBlock();
                }}
                aria-label={`Remove ${blockContext.label} block from context`}
                title="Remove from context"
              >
                <Close size={12} />
              </button>
            </div>
          </div>
        ) : null}
        {attachments.length > 0 ? (
          <div className="workspace-chat__attachments" aria-label="Attachments">
            {attachments.map((att) => (
              <div
                key={att.id}
                className={`workspace-chat__attachment${att.error ? ' workspace-chat__attachment--error' : ''}`}
                title={att.error ? `${att.name} — ${att.error}` : att.name}
              >
                {att.kind === 'image' && att.dataUrl ? (
                  <span className="workspace-chat__attachment-thumb">
                    <img src={att.dataUrl} alt="" />
                  </span>
                ) : (
                  <span className="workspace-chat__attachment-thumb workspace-chat__attachment-thumb--file">
                    <Document size={14} />
                  </span>
                )}
                <span className="workspace-chat__attachment-meta">
                  <span className="workspace-chat__attachment-name">{att.name}</span>
                  <span className="workspace-chat__attachment-sub">
                    {att.error ? att.error : formatBytes(att.size)}
                  </span>
                </span>
                <button
                  type="button"
                  className="workspace-chat__attachment-remove"
                  aria-label={`Remove ${att.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeAttachment(att.id);
                  }}
                >
                  <Close size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        {!isEmptyThread && surfaceSuggestions.length > 0 ? (
          <div className="workspace-chat__suggestions" aria-label="Suggested prompts">
            {surfaceSuggestions.map((s) => (
              <button
                key={s.id || s.label}
                type="button"
                className="workspace-chat__suggestion"
                onClick={(event) => {
                  event.stopPropagation();
                  runPreset(s);
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        ) : null}
        {!isEmptyThread && surfacePresets.length > 0 ? (
          <div className="workspace-chat__presets" aria-label="Presets">
            {surfacePresets.map((p) => (
              <button
                key={p.id || p.label}
                type="button"
                className="workspace-chat__preset"
                onClick={(event) => {
                  event.stopPropagation();
                  runPreset(p);
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        ) : null}
        <textarea
          ref={textareaRef}
          className="workspace-chat__input"
          placeholder={
            bridgeMissing
              ? 'Run wp-light dev to enable the assistant…'
              : (surfacePlaceholder || 'Ask anything…')
          }
          rows={1}
          disabled={bridgeMissing}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            autogrow();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
          onPaste={onPaste}
        />
        <div className="workspace-chat__composer-bar">
          <button
            type="button"
            className="workspace-chat__attach-btn"
            aria-label="Attach a file"
            title="Attach a file"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            <Attachment size={14} />
          </button>
          {surfaceControls ? (
            <div className="workspace-chat__controls" onClick={(e) => e.stopPropagation()}>
              {surfaceControls}
            </div>
          ) : null}
          <button
            type="button"
            className={`workspace-chat__send workspace-chat__send--${buttonMode}`}
            aria-label={
              buttonMode === 'stop' ? 'Stop' : buttonMode === 'pending' ? 'Sending' : 'Send message'
            }
            disabled={
              buttonMode === 'pending' ||
              (buttonMode === 'send' && !assistantSurface?.onSubmit && !canSend)
            }
            onClick={onSendClick}
          >
            {buttonMode === 'stop' ? (
              <StopFilled size={14} />
            ) : buttonMode === 'pending' ? (
              <span className="workspace-chat__send-spinner" aria-hidden="true" />
            ) : (
              <ArrowUp size={16} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
