const STORAGE_KEY = 'wplite:acp-sessions:v1';
const ACTIVE_SESSION_KEY = 'wplite:acp-active-session:v1';
const MAX_SESSIONS = 50;
const MAX_MESSAGES_PER_SESSION = 500;

/**
 * Local session store for the ACP assistant.
 *
 * ACP sessions are ephemeral on the agent side — they don't survive agent
 * restarts. We mirror the conversation client-side so the UI can show a
 * history list and optionally resume. When the underlying agent advertises
 * `loadSession`, we'll ask it to rehydrate; otherwise the history is
 * displayed read-only and a fresh agent session starts on the next prompt.
 */

function readAll() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(sessions) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // storage full / disabled — swallow; sessions just won't persist.
  }
}

function uid() {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function deriveTitle(messages) {
  const firstUser = messages.find((m) => m.role === 'user' && m.kind === 'text' && m.text);
  if (!firstUser) return 'New conversation';
  const text = firstUser.text.replace(/\s+/g, ' ').trim();
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

export function listSessions() {
  return readAll().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function getSession(id) {
  return readAll().find((s) => s.id === id) || null;
}

export function createSession() {
  const now = Date.now();
  const session = {
    id: uid(),
    title: 'New conversation',
    createdAt: now,
    updatedAt: now,
    messages: [],
    agentSessionId: null,
  };
  const sessions = [session, ...readAll()].slice(0, MAX_SESSIONS);
  writeAll(sessions);
  return session;
}

export function updateSession(id, patch) {
  const sessions = readAll();
  const index = sessions.findIndex((s) => s.id === id);
  if (index === -1) return null;
  const current = sessions[index];
  const next = {
    ...current,
    ...patch,
    updatedAt: Date.now(),
  };
  if (patch.messages) {
    next.messages = patch.messages.slice(-MAX_MESSAGES_PER_SESSION);
    next.title = deriveTitle(next.messages) || current.title;
  }
  sessions[index] = next;
  writeAll(sessions);
  return next;
}

export function deleteSession(id) {
  writeAll(readAll().filter((s) => s.id !== id));
}

export function clearAllSessions() {
  writeAll([]);
}

export function getPersistedActiveSessionId() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(ACTIVE_SESSION_KEY) || null;
  } catch {
    return null;
  }
}

export function persistActiveSessionId(id) {
  if (typeof window === 'undefined') return;
  try {
    if (id) {
      window.localStorage.setItem(ACTIVE_SESSION_KEY, id);
    } else {
      window.localStorage.removeItem(ACTIVE_SESSION_KEY);
    }
  } catch {
    // storage full / disabled — swallow.
  }
}
