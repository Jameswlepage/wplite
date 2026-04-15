import { runtimeConfig } from './config.js';

const PROTOCOL_VERSION = 1;

export const AcpStatus = {
  Idle: 'idle',
  Connecting: 'connecting',
  Initializing: 'initializing',
  Ready: 'ready',
  Prompting: 'prompting',
  Disconnected: 'disconnected',
  Error: 'error',
};

/**
 * Minimal browser-side ACP (Agent Client Protocol) client.
 *
 * Wraps a WebSocket to the acp-bridge. The bridge forwards ACP JSON-RPC
 * messages verbatim to/from the agent, except for filesystem requests which
 * it handles locally. Everything else — session lifecycle, prompts, updates,
 * permission requests — flows through here.
 */
function defaultLocalBridgeUrl() {
  if (typeof window === 'undefined') return null;
  const host = window.location?.hostname || '';
  // Only assume a bridge exists when we're clearly on a dev host.
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost')) {
    return 'ws://127.0.0.1:7842';
  }
  return null;
}

export function createAcpClient({ url, cwd } = {}) {
  const bridgeUrl = url || runtimeConfig.acpBridgeUrl || defaultLocalBridgeUrl();
  const listeners = new Map();
  const pending = new Map();
  let ws = null;
  let nextId = 1;
  let sessionId = null;
  let agentCapabilities = null;
  let status = AcpStatus.Idle;
  let lastError = null;
  let connectPromise = null;
  let initializePromise = null;
  const permissionResolvers = new Map();

  function setStatus(next, error = null) {
    status = next;
    lastError = error ? String(error.message || error) : null;
    emit('status', { status, error: lastError });
  }

  function emit(event, payload) {
    const set = listeners.get(event);
    if (!set) return;
    for (const handler of set) {
      try {
        handler(payload);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[acp-client] listener error', err);
      }
    }
  }

  function on(event, handler) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(handler);
    return () => listeners.get(event)?.delete(handler);
  }

  function isAvailable() {
    return Boolean(bridgeUrl);
  }

  function isOpen() {
    return ws && ws.readyState === WebSocket.OPEN;
  }

  function sendRaw(message) {
    if (!isOpen()) {
      throw new Error('ACP bridge not connected');
    }
    ws.send(JSON.stringify(message));
  }

  function request(method, params) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject, method });
      try {
        sendRaw({ jsonrpc: '2.0', id, method, params });
      } catch (err) {
        pending.delete(id);
        reject(err);
      }
    });
  }

  function notify(method, params) {
    sendRaw({ jsonrpc: '2.0', method, params });
  }

  function respond(id, result) {
    sendRaw({ jsonrpc: '2.0', id, result });
  }

  function respondError(id, code, message) {
    sendRaw({ jsonrpc: '2.0', id, error: { code, message } });
  }

  async function connect() {
    if (!isAvailable()) {
      throw new Error('No ACP bridge URL configured (dev mode only).');
    }
    if (isOpen()) return;
    if (connectPromise) return connectPromise;

    setStatus(AcpStatus.Connecting);
    connectPromise = new Promise((resolve, reject) => {
      let settled = false;
      const socket = new WebSocket(bridgeUrl);
      ws = socket;

      socket.addEventListener('open', () => {
        if (settled) return;
        settled = true;
        resolve();
      });

      socket.addEventListener('error', () => {
        if (settled) return;
        settled = true;
        setStatus(AcpStatus.Error, new Error('WebSocket failed to open'));
        reject(new Error('WebSocket failed to open'));
      });

      socket.addEventListener('close', (event) => {
        ws = null;
        sessionId = null;
        initializePromise = null;
        connectPromise = null;
        agentCapabilities = null;
        for (const [id, record] of pending) {
          record.reject(new Error(`connection closed: ${event.reason || event.code}`));
          pending.delete(id);
        }
        for (const resolver of permissionResolvers.values()) {
          resolver.reject(new Error('connection closed'));
        }
        permissionResolvers.clear();
        setStatus(AcpStatus.Disconnected);
      });

      socket.addEventListener('message', (event) => {
        handleIncoming(event.data);
      });
    });

    try {
      await connectPromise;
    } finally {
      connectPromise = null;
    }

    // Eagerly run the ACP handshake. Session creation is now the caller's
    // responsibility — this lets the UI choose between newSession() and
    // loadSession() for multi-conversation flows.
    try {
      await initialize();
      setStatus(AcpStatus.Ready);
    } catch (err) {
      setStatus(AcpStatus.Error, err);
    }
  }

  function handleIncoming(raw) {
    let message;
    try {
      message = JSON.parse(typeof raw === 'string' ? raw : String(raw));
    } catch (err) {
      emit('error', new Error(`bad JSON from bridge: ${err.message}`));
      return;
    }

    // Response to something we sent.
    if (message.id !== undefined && (message.result !== undefined || message.error !== undefined)) {
      const record = pending.get(message.id);
      if (!record) return;
      pending.delete(message.id);
      if (message.error) {
        record.reject(Object.assign(new Error(message.error.message || 'ACP error'), {
          code: message.error.code,
          data: message.error.data,
        }));
      } else {
        record.resolve(message.result);
      }
      return;
    }

    // Request from agent → we respond.
    if (message.method && message.id !== undefined) {
      handleAgentRequest(message).catch((err) => {
        respondError(message.id, -32000, err.message);
      });
      return;
    }

    // Notification from agent / bridge.
    if (message.method) {
      handleNotification(message);
    }
  }

  async function handleAgentRequest(message) {
    const { id, method, params } = message;

    if (method === 'session/request_permission') {
      const outcome = await new Promise((resolve, reject) => {
        permissionResolvers.set(id, { resolve, reject });
        emit('permission_request', {
          id,
          params,
          resolve: (decision) => {
            permissionResolvers.delete(id);
            resolve(decision);
          },
          cancel: () => {
            permissionResolvers.delete(id);
            resolve({ outcome: { outcome: 'cancelled' } });
          },
        });
      });
      respond(id, outcome);
      return;
    }

    // Unknown request — reject so the agent doesn't hang.
    respondError(id, -32601, `unsupported method: ${method}`);
  }

  function handleNotification(message) {
    const { method, params } = message;

    if (method === 'session/update') {
      // ACP wraps updates as { sessionId, update: {...} } — unwrap so
      // listeners see the inner SessionUpdate directly.
      const inner = params?.update ?? params;
      emit('update', inner, { sessionId: params?.sessionId });
      return;
    }

    if (method === '_bridge/agent_exited' || method === '_bridge/agent_error') {
      emit('error', new Error(`bridge: ${method} ${JSON.stringify(params)}`));
      setStatus(AcpStatus.Error, new Error(params?.message || 'agent exited'));
      return;
    }

    emit('notification', message);
  }

  async function initialize() {
    if (initializePromise) return initializePromise;
    initializePromise = (async () => {
      setStatus(AcpStatus.Initializing);
      const result = await request('initialize', {
        protocolVersion: PROTOCOL_VERSION,
        clientCapabilities: {
          fs: { readTextFile: true, writeTextFile: true },
          terminal: false,
        },
      });
      agentCapabilities = result?.agentCapabilities || result?.capabilities || null;
      return result;
    })();
    return initializePromise;
  }

  async function newSession() {
    await connect();
    await initialize();
    const params = { mcpServers: [] };
    if (cwd) params.cwd = cwd;
    const result = await request('session/new', params);
    const id = result?.sessionId || result?.session_id || null;
    if (!id) throw new Error('agent did not return a sessionId');
    sessionId = id;
    return id;
  }

  async function loadSession(existingSessionId) {
    await connect();
    await initialize();
    if (!agentCapabilities?.loadSession) {
      throw new Error('agent does not support session/load');
    }
    const params = { sessionId: existingSessionId, mcpServers: [] };
    if (cwd) params.cwd = cwd;
    // The agent will replay updates via session/update notifications before
    // the response resolves.
    await request('session/load', params);
    sessionId = existingSessionId;
    return existingSessionId;
  }

  function setActiveSession(id) {
    sessionId = id || null;
  }

  async function prompt(promptContent) {
    if (!sessionId) {
      throw new Error('no active session — call newSession() or loadSession() first');
    }
    setStatus(AcpStatus.Prompting);
    try {
      const blocks = normalizePromptContent(promptContent);
      const result = await request('session/prompt', {
        sessionId,
        prompt: blocks,
      });
      setStatus(AcpStatus.Ready);
      return result;
    } catch (err) {
      setStatus(AcpStatus.Ready, err);
      throw err;
    }
  }

  async function cancel() {
    if (!sessionId || !isOpen()) return;
    try {
      notify('session/cancel', { sessionId });
    } catch {
      // best-effort
    }
  }

  function disconnect() {
    if (ws) {
      try {
        ws.close();
      } catch {
        // best-effort
      }
    }
  }

  return {
    on,
    connect,
    prompt,
    cancel,
    disconnect,
    isAvailable,
    newSession,
    loadSession,
    setActiveSession,
    get status() {
      return status;
    },
    get lastError() {
      return lastError;
    },
    get sessionId() {
      return sessionId;
    },
    get bridgeUrl() {
      return bridgeUrl;
    },
    get capabilities() {
      return agentCapabilities;
    },
    get supportsLoadSession() {
      return Boolean(agentCapabilities?.loadSession);
    },
  };
}

function normalizePromptContent(input) {
  if (Array.isArray(input)) return input;
  if (typeof input === 'string') {
    return [{ type: 'text', text: input }];
  }
  if (input && typeof input === 'object' && input.type) {
    return [input];
  }
  return [{ type: 'text', text: String(input ?? '') }];
}
