// Event-bus WS client.
//
// The CRDT pipeline only applies to entities with numeric IDs (core-data's
// sync manager gates on isNumericID). Templates (wp_template), template
// parts (wp_template_part), and block patterns use string IDs or aren't
// entities at all, so they need a separate transport to propagate file
// changes to the canvas.
//
// This helper opens a single persistent WS connection to the dev server's
// `_events` room. Node emits one JSON frame per source-file change; the
// client dispatches the matching core-data invalidation so the next render
// picks up fresh content. For pattern edits it reloads the editor bundle.
//
// See packages/compiler/lib/sync-server.mjs for the server half.

import { dispatch as dataDispatch, resolveSelect as dataResolveSelect } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { clearCachedEditorBundle, loadEditorBundle } from './editor-bundle.js';

const TAG_EVENT = 0x10;

function decodeFrame(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.byteLength < 1) return null;
  return { tag: bytes[0], payload: bytes.subarray(1) };
}

export function initWpliteEventBus(wsUrl) {
  if (!wsUrl) return () => {};
  if (typeof window === 'undefined') return () => {};

  let ws = null;
  let destroyed = false;
  let reconnectTimer = null;
  let reconnectAttempt = 0;

  function onEvent(event) {
    if (!event || typeof event !== 'object') return;
    const coreActions = dataDispatch(coreStore);

    switch (event.type) {
      case 'invalidate-entity': {
        const { kind, name, id } = event;
        if (!kind || !name || id == null) return;
        // Drop any local edits on the fields the file is authoritative for.
        // Without this, a prior CRDT push or canvas keystroke leaves an
        // edit on `content` or `blocks` that getEditedEntityRecord merges
        // over the freshly-refetched base, pinning the canvas to the old
        // state even though the DB has the new one.
        try {
          coreActions.editEntityRecord(kind, name, id, {
            content: undefined,
            blocks: undefined,
            title: undefined,
            excerpt: undefined,
          });
        } catch {
          // noop
        }
        // Invalidate so the next resolver call bypasses cache.
        try {
          coreActions.invalidateResolution('getEntityRecord', [kind, name, id]);
          coreActions.invalidateResolution('getEntityRecords', [kind, name]);
          coreActions.invalidateResolution(
            'getEntityRecords',
            [kind, name, { per_page: -1 }]
          );
        } catch {
          // noop
        }
        // Trigger the refetch so subscribers re-render when new data lands.
        try {
          void dataResolveSelect(coreStore).getEntityRecord(kind, name, id);
          void dataResolveSelect(coreStore).getEntityRecords(kind, name, { per_page: -1 });
        } catch {
          // noop
        }
        break;
      }
      case 'invalidate-patterns': {
        // Reload the editor bundle so __experimentalBlockPatterns includes
        // the edited pattern. Components that read buildBlockEditorSettings
        // from getCachedEditorBundle will receive the new value on their
        // next render.
        clearCachedEditorBundle();
        void loadEditorBundle().then(() => {
          window.dispatchEvent(new CustomEvent('wplite-event:editor-bundle-updated'));
        });
        break;
      }
      default:
        break;
    }
  }

  function scheduleReconnect() {
    if (destroyed) return;
    const delay = Math.min(1000 * 2 ** Math.min(reconnectAttempt, 5), 30_000);
    reconnectAttempt += 1;
    reconnectTimer = setTimeout(connect, delay);
  }

  function connect() {
    if (destroyed) return;
    reconnectTimer = null;
    try {
      ws = new WebSocket(`${wsUrl}/${encodeURIComponent('_events')}`);
    } catch {
      scheduleReconnect();
      return;
    }
    ws.binaryType = 'arraybuffer';

    ws.addEventListener('open', () => {
      reconnectAttempt = 0;
    });
    ws.addEventListener('message', (evt) => {
      const frame = decodeFrame(evt.data);
      if (!frame || frame.tag !== TAG_EVENT) return;
      try {
        const text = new TextDecoder().decode(frame.payload);
        const payload = JSON.parse(text);
        onEvent(payload);
      } catch {
        // swallow malformed frames
      }
    });
    ws.addEventListener('close', () => {
      if (!destroyed) scheduleReconnect();
    });
    ws.addEventListener('error', () => {
      // handled by close
    });
  }

  connect();

  return () => {
    destroyed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (ws) {
      try { ws.close(1000, 'Bus destroyed'); } catch { /* noop */ }
      ws = null;
    }
  };
}
