// Custom @wordpress/sync provider that speaks to the wp-lite dev server over
// a WebSocket. Dev-only — only registered when runtimeConfig.syncUrl is set.
//
// Wire protocol mirrors packages/compiler/lib/sync-server.mjs:
//   0x01  Yjs updateV2 payload
//   0x02  awareness update
//   0x03  sync-step-1 (state vector) — we send ours on open
//   0x04  sync-step-2 (full diff)
//
// See node_modules/@wordpress/sync/.../providers/http-polling/http-polling-provider.mjs
// for the contract this must satisfy. The sync manager only ever listens for
// the 'status' event; destroy() is the only required lifecycle method.

import * as Y from 'yjs';
import { applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';

const TAG_UPDATE = 0x01;
const TAG_AWARENESS = 0x02;
const TAG_SYNC_STEP_1 = 0x03;
const TAG_SYNC_STEP_2 = 0x04;

const ORIGIN_REMOTE = Symbol('wplite-sync-remote');

function encodeFrame(tag, payload) {
  const out = new Uint8Array(1 + payload.byteLength);
  out[0] = tag;
  out.set(payload, 1);
  return out;
}

function decodeFrame(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.byteLength < 1) return null;
  return { tag: bytes[0], payload: bytes.subarray(1) };
}

function roomFor(objectType, objectId) {
  return objectId != null ? `${objectType}:${objectId}` : `${objectType}`;
}

/**
 * Build a @wordpress/sync provider creator bound to a given dev-server URL.
 *
 * @param {string} baseUrl  e.g. "ws://127.0.0.1:5274"
 * @returns {(options: { objectType: string, objectId: string|null, ydoc: Y.Doc, awareness: import('y-protocols/awareness').Awareness }) => Promise<{ destroy(): void, on(event: 'status', cb: Function): void }>}
 */
export function createWpliteSyncProvider(baseUrl) {
  if (!baseUrl) {
    throw new Error('createWpliteSyncProvider: baseUrl is required');
  }

  return async ({ objectType, objectId, ydoc, awareness }) => {
    const room = roomFor(objectType, objectId);
    const url = `${baseUrl}/${encodeURIComponent(room)}`;
    let status = 'disconnected';
    const statusListeners = new Set();

    let ws = null;
    let destroyed = false;
    let reconnectTimer = null;
    let reconnectAttempt = 0;

    function emitStatus(next) {
      if (status === next.status && !next.error) return;
      if (next.status === 'connecting' && status !== 'disconnected') return;
      status = next.status;
      for (const cb of statusListeners) {
        try {
          cb(next);
        } catch (err) {
          // swallow listener errors
          // eslint-disable-next-line no-console
          console.error('wplite-sync-provider: listener error', err);
        }
      }
    }

    function onDocUpdate(update, origin) {
      if (origin === ORIGIN_REMOTE) return;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(encodeFrame(TAG_UPDATE, update));
    }

    function onAwarenessUpdate({ added, updated, removed }, origin) {
      if (origin === ORIGIN_REMOTE) return;
      const clients = added.concat(updated, removed);
      if (clients.length === 0) return;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const update = encodeAwarenessUpdate(awareness, clients);
      ws.send(encodeFrame(TAG_AWARENESS, update));
    }

    ydoc.on('updateV2', onDocUpdate);
    awareness.on('update', onAwarenessUpdate);

    function scheduleReconnect() {
      if (destroyed) return;
      const delay = Math.min(1000 * 2 ** Math.min(reconnectAttempt, 5), 30_000);
      reconnectAttempt += 1;
      emitStatus({
        status: 'disconnected',
        canManuallyRetry: true,
        willAutoRetryInMs: delay,
      });
      reconnectTimer = setTimeout(connect, delay);
    }

    function connect() {
      if (destroyed) return;
      reconnectTimer = null;
      emitStatus({ status: 'connecting' });

      try {
        ws = new WebSocket(url);
      } catch (err) {
        emitStatus({ status: 'disconnected', error: err });
        scheduleReconnect();
        return;
      }
      ws.binaryType = 'arraybuffer';

      ws.addEventListener('open', () => {
        reconnectAttempt = 0;
        emitStatus({ status: 'connected' });
        // Send our state vector so the server can respond with any diff we're
        // missing. The server separately pushes sync-step-1 + sync-step-2 on
        // connect, so both sides get hydrated.
        try {
          const stateVector = Y.encodeStateVector(ydoc);
          ws.send(encodeFrame(TAG_SYNC_STEP_1, stateVector));
          // Also emit our local awareness state once we're connected.
          const localClientId = awareness.clientID;
          const update = encodeAwarenessUpdate(awareness, [localClientId]);
          ws.send(encodeFrame(TAG_AWARENESS, update));
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('wplite-sync-provider: initial sync failed', err);
        }
      });

      ws.addEventListener('message', (event) => {
        const frame = decodeFrame(event.data);
        if (!frame) return;
        try {
          switch (frame.tag) {
            case TAG_UPDATE:
            case TAG_SYNC_STEP_2:
              Y.applyUpdateV2(ydoc, frame.payload, ORIGIN_REMOTE);
              break;
            case TAG_AWARENESS:
              applyAwarenessUpdate(awareness, frame.payload, ORIGIN_REMOTE);
              break;
            case TAG_SYNC_STEP_1: {
              // Server asked for our state — reply with the diff since their vector.
              const diff = Y.encodeStateAsUpdateV2(ydoc, frame.payload);
              ws.send(encodeFrame(TAG_SYNC_STEP_2, diff));
              break;
            }
            default:
              // unknown tag; ignore
              break;
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('wplite-sync-provider: message error', err);
        }
      });

      ws.addEventListener('close', () => {
        if (destroyed) return;
        scheduleReconnect();
      });

      ws.addEventListener('error', () => {
        // The close event always follows, which handles reconnection.
      });
    }

    connect();

    return {
      destroy() {
        destroyed = true;
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        ydoc.off('updateV2', onDocUpdate);
        awareness.off('update', onAwarenessUpdate);
        if (ws) {
          try {
            ws.close(1000, 'Provider destroyed');
          } catch {
            // best-effort
          }
          ws = null;
        }
        statusListeners.clear();
      },
      on(event, cb) {
        if (event !== 'status') return;
        statusListeners.add(cb);
      },
    };
  };
}
