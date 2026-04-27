// WebSocket sync server for wplite's CRDT transport.
//
// One Y.Doc per room (room = entityType/entityId, matching @wordpress/sync's
// naming, e.g. "postType/page:42"). Clients connect to ws://.../<room>.
// Wire protocol is a single tag byte followed by a payload:
//
//   0x01  updateV2 payload (Yjs v2 binary update)
//   0x02  awareness update (y-protocols/awareness encoded update)
//   0x03  sync-step-1 request (client's state vector); server replies with
//         0x04 (sync-step-2, full diff since that state vector)
//   0x04  sync-step-2 response (full updateV2 from server)
//
// Yjs v2 is chosen to match @wordpress/sync's wire format (see
// node_modules/@wordpress/sync/.../polling-manager.mjs — exclusively v2).

import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import {
  applyAwarenessUpdate,
  Awareness,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness';

const TAG_UPDATE = 0x01;
const TAG_AWARENESS = 0x02;
const TAG_SYNC_STEP_1 = 0x03;
const TAG_SYNC_STEP_2 = 0x04;
// Non-CRDT tag — JSON event payload broadcast on the `_events` room. Used
// for invalidation signals to entities with non-numeric IDs (wp_template,
// patterns) that core-data's CRDT path skips.
const TAG_EVENT = 0x10;

const EVENTS_ROOM = '_events';

const ORIGIN_REMOTE = Symbol('wplite-sync-remote');

function makeFrame(tag, payload) {
  const out = new Uint8Array(1 + payload.byteLength);
  out[0] = tag;
  out.set(payload, 1);
  return out;
}

function parseFrame(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.byteLength < 1) return null;
  return { tag: bytes[0], payload: bytes.subarray(1) };
}

/**
 * Create a sync server.
 *
 * @param {object} options
 * @param {number} options.port                Starting port; will increment on EADDRINUSE up to +10.
 * @param {string} [options.host='127.0.0.1']  Bind host.
 * @param {(message: string) => void} [options.log]  Logger for significant events.
 * @returns {Promise<{ wss: WebSocketServer, port: number, url: string, getDoc, stop, broadcast }>}
 */
export async function startSyncServer({ port = 5274, host = '127.0.0.1', log = () => {} } = {}) {
  const rooms = new Map(); // roomId → { doc, awareness, clients:Set<ws>, destroyTimer }
  const eventListeners = new Set(); // ws connections subscribed to the global event bus

  const wss = await listenWithFallback({ port, host, maxRetries: 10, log });
  const resolvedPort = wss.address().port;
  const url = `ws://${host}:${resolvedPort}`;

  wss.on('connection', (ws, req) => {
    const roomId = extractRoom(req.url);
    if (!roomId) {
      log(`sync: rejecting connection with missing room — url=${req.url}`);
      ws.close(1008, 'Missing room');
      return;
    }

    // Global event bus: clients connecting to `_events` just get broadcast
    // JSON messages (no CRDT handshake).
    if (roomId === EVENTS_ROOM) {
      eventListeners.add(ws);
      log(`sync: client joined _events (${eventListeners.size} total)`);
      ws.on('close', () => {
        eventListeners.delete(ws);
        log(`sync: client left _events (${eventListeners.size} remaining)`);
      });
      ws.on('error', (err) => {
        log(`sync: _events ws error: ${err.message}`);
      });
      return;
    }

    const room = ensureRoom(roomId);
    room.clients.add(ws);
    if (room.destroyTimer) {
      clearTimeout(room.destroyTimer);
      room.destroyTimer = null;
    }
    log(`sync: client joined ${roomId} (${room.clients.size} total)`);

    // Send sync-step-1 to the client so it can respond with any updates it has.
    // Also send sync-step-2 (full state) so the new client hydrates if server has content.
    try {
      const stateVector = Y.encodeStateVector(room.doc);
      ws.send(makeFrame(TAG_SYNC_STEP_1, stateVector));
      const fullState = Y.encodeStateAsUpdateV2(room.doc);
      ws.send(makeFrame(TAG_SYNC_STEP_2, fullState));
      // Send current awareness state so new client sees other peers.
      const awarenessClientIds = Array.from(room.awareness.getStates().keys());
      if (awarenessClientIds.length > 0) {
        const awUpdate = encodeAwarenessUpdate(room.awareness, awarenessClientIds);
        ws.send(makeFrame(TAG_AWARENESS, awUpdate));
      }
    } catch (err) {
      log(`sync: failed to seed client in ${roomId}: ${err.message}`);
    }

    ws.on('message', (data) => {
      const frame = parseFrame(data);
      if (!frame) return;
      try {
        switch (frame.tag) {
          case TAG_UPDATE: {
            Y.applyUpdateV2(room.doc, frame.payload, ORIGIN_REMOTE);
            // Fan out to all other clients in the room.
            relay(room, ws, frame.tag, frame.payload);
            break;
          }
          case TAG_AWARENESS: {
            applyAwarenessUpdate(room.awareness, frame.payload, ws);
            // Awareness is relayed on the awareness-change listener below, no
            // need to relay directly here.
            break;
          }
          case TAG_SYNC_STEP_1: {
            // Client's state vector — reply with v2 diff since that vector.
            const diff = Y.encodeStateAsUpdateV2(room.doc, frame.payload);
            ws.send(makeFrame(TAG_SYNC_STEP_2, diff));
            break;
          }
          case TAG_SYNC_STEP_2: {
            Y.applyUpdateV2(room.doc, frame.payload, ORIGIN_REMOTE);
            relay(room, ws, TAG_UPDATE, frame.payload);
            break;
          }
          default:
            log(`sync: unknown tag 0x${frame.tag.toString(16)} in ${roomId}`);
        }
      } catch (err) {
        log(`sync: message error in ${roomId}: ${err.message}`);
      }
    });

    ws.on('close', () => {
      room.clients.delete(ws);
      removeAwarenessStates(
        room.awareness,
        [...room.awareness.getStates().keys()].filter(
          (clientId) => room.awareness.meta.get(clientId)?.source === ws
        ),
        null
      );
      log(`sync: client left ${roomId} (${room.clients.size} remaining)`);
      if (room.clients.size === 0) {
        // Keep the doc in memory for a bit in case a reload reconnects.
        room.destroyTimer = setTimeout(() => {
          rooms.delete(roomId);
          room.doc.destroy();
          log(`sync: room ${roomId} released`);
        }, 30_000);
      }
    });

    ws.on('error', (err) => {
      log(`sync: ws error in ${roomId}: ${err.message}`);
    });
  });

  function ensureRoom(roomId) {
    const existing = rooms.get(roomId);
    if (existing) return existing;

    const doc = new Y.Doc();
    const awareness = new Awareness(doc);

    // When any client sends an update, broadcast it. We also listen to local
    // doc updates so server-side writers (like the file→ydoc bridge) get
    // broadcast to connected clients automatically.
    doc.on('updateV2', (update, origin) => {
      if (origin === ORIGIN_REMOTE) return; // already relayed in the message handler
      const room = rooms.get(roomId);
      if (!room) return;
      for (const client of room.clients) {
        if (client.readyState === 1) {
          client.send(makeFrame(TAG_UPDATE, update));
        }
      }
    });

    awareness.on('update', ({ added, updated, removed }, origin) => {
      const changedClients = added.concat(updated, removed);
      if (changedClients.length === 0) return;
      const update = encodeAwarenessUpdate(awareness, changedClients);
      const room = rooms.get(roomId);
      if (!room) return;
      for (const client of room.clients) {
        // Don't echo back to the origin socket.
        if (client === origin) continue;
        if (client.readyState === 1) {
          client.send(makeFrame(TAG_AWARENESS, update));
        }
      }
    });

    const room = { doc, awareness, clients: new Set(), destroyTimer: null };
    rooms.set(roomId, room);
    return room;
  }

  function getDoc(roomId) {
    return ensureRoom(roomId).doc;
  }

  function broadcast(roomId, tag, payload) {
    const room = rooms.get(roomId);
    if (!room) return;
    for (const client of room.clients) {
      if (client.readyState === 1) {
        client.send(makeFrame(tag, payload));
      }
    }
  }

  function broadcastEvent(event) {
    if (eventListeners.size === 0) return;
    const payload = new TextEncoder().encode(JSON.stringify(event));
    const frame = makeFrame(TAG_EVENT, payload);
    for (const client of eventListeners) {
      if (client.readyState === 1) client.send(frame);
    }
  }

  async function stop() {
    for (const room of rooms.values()) {
      for (const client of room.clients) {
        try {
          client.close(1001, 'Server shutdown');
        } catch {
          // best-effort
        }
      }
      room.doc.destroy();
    }
    rooms.clear();
    await new Promise((resolve) => wss.close(() => resolve()));
  }

  return { wss, port: resolvedPort, url, getDoc, broadcast, broadcastEvent, stop };
}

function relay(room, exclude, tag, payload) {
  for (const client of room.clients) {
    if (client === exclude) continue;
    if (client.readyState === 1) {
      client.send(makeFrame(tag, payload));
    }
  }
}

function extractRoom(urlPath) {
  if (!urlPath) return null;
  // Strip leading slash; everything after is the room ID. Percent-decode to
  // allow slashes in room names (postType/page:42 is encoded as postType%2Fpage%3A42
  // if the client wants, but we also accept the literal path form).
  const raw = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath;
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

async function listenWithFallback({ port, host, maxRetries, log }) {
  let attempt = 0;
  let currentPort = port;
  while (attempt <= maxRetries) {
    try {
      return await new Promise((resolve, reject) => {
        const server = new WebSocketServer({ port: currentPort, host });
        server.once('error', (err) => {
          reject(err);
        });
        server.once('listening', () => {
          server.removeAllListeners('error');
          server.on('error', (err) => log(`sync: server error: ${err.message}`));
          resolve(server);
        });
      });
    } catch (err) {
      if (err?.code === 'EADDRINUSE' && attempt < maxRetries) {
        attempt += 1;
        currentPort += 1;
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Unable to bind sync server on ports ${port}..${currentPort}`);
}
