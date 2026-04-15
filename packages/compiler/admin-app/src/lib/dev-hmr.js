// Dev-only Hot-reload bridge. Polls the compiler's dev-state endpoint
// and reacts to change notifications:
//
//   - strategy: 'full'    → full page reload (same as legacy behaviour).
//   - strategy: 'partial' → invalidate affected @wordpress/core-data
//     entities in place. If the editor has unsaved edits on one of the
//     affected posts, emit a `wplite-dev-hmr:stale` event so the shell
//     can surface a non-destructive "reload from source" notice.
//   - strategy: 'none'    → nothing.
//
// Runs silently when the backend reports `enabled: false`.

import { dispatch as wpDispatch, select as wpSelect } from '@wordpress/data';
import { runtimeConfig } from './config.js';

const POLL_INTERVAL_MS = 1500;
const DEV_HMR_EVENT = 'wplite-dev-hmr:stale';

let lastChangeId = null;
let lastVersion = null;

function endpointUrl() {
  const base = runtimeConfig?.restRoot;
  if (!base) return null;
  return new URL('dev-state', base).toString();
}

function invalidatePost(postType, id) {
  try {
    const core = wpDispatch('core');
    core.invalidateResolution('getEntityRecord', ['postType', postType, id]);
    core.invalidateResolution('getEntityRecords', ['postType', postType]);
    return true;
  } catch {
    return false;
  }
}

function isPostDirty(postType, id) {
  try {
    const core = wpSelect('core');
    return Boolean(core?.hasEditsForEntityRecord?.('postType', postType, id));
  } catch {
    return false;
  }
}

function emitStale(detail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(DEV_HMR_EVENT, { detail }));
}

function applyPartial(changes) {
  const targets = changes?.targets ?? {};
  const posts = Array.isArray(targets.posts) ? targets.posts : [];
  const templates = Array.isArray(targets.templates) ? targets.templates : [];

  const dirty = [];
  const clean = [];
  for (const target of posts) {
    if (!target?.postType || !target?.id) continue;
    if (isPostDirty(target.postType, target.id)) {
      dirty.push(target);
    } else {
      clean.push(target);
    }
  }

  for (const target of clean) {
    invalidatePost(target.postType, target.id);
  }

  for (const template of templates) {
    if (!template?.id) continue;
    invalidatePost('wp_template', template.id);
  }

  if (changes?.bootstrap && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('wplite-dev-hmr:bootstrap-refresh'));
  }

  if (dirty.length > 0) {
    emitStale({
      targets: dirty,
      onReload: () => {
        for (const target of dirty) {
          invalidatePost(target.postType, target.id);
        }
      },
    });
  }
}

async function pollOnce() {
  const url = endpointUrl();
  if (!url) return;

  let payload;
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: runtimeConfig?.nonce ? { 'X-WP-Nonce': runtimeConfig.nonce } : {},
    });
    if (!response.ok) return;
    payload = await response.json();
  } catch {
    return;
  }

  if (!payload || !payload.enabled) return;

  // First poll: record the baseline without acting on it.
  if (lastChangeId === null && lastVersion === null) {
    lastChangeId = payload.changeId ?? null;
    lastVersion = payload.version ?? null;
    return;
  }

  const changeId = payload.changeId ?? null;
  const version = payload.version ?? null;
  const changes = payload.changes ?? null;

  if (changeId && changeId === lastChangeId) return;
  lastChangeId = changeId;

  const strategy = changes?.strategy ?? (version && version !== lastVersion ? 'full' : null);
  lastVersion = version;

  if (strategy === 'full') {
    window.location.reload();
    return;
  }

  if (strategy === 'partial') {
    applyPartial(changes);
    return;
  }

  // 'none' → no-op.
}

export function initDevHmr() {
  if (typeof window === 'undefined') return;
  if (window.__wpliteDevHmrStarted) return;
  window.__wpliteDevHmrStarted = true;

  pollOnce();
  window.setInterval(pollOnce, POLL_INTERVAL_MS);
}

export const DEV_HMR_STALE_EVENT = DEV_HMR_EVENT;
