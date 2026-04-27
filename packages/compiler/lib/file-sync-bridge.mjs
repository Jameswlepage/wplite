// File → Y.Doc bridge for wplite's CRDT HMR.
//
// When a source file under `content/<collection>/<slug>.{md,html}` changes,
// push its new title + body into the matching Y.Doc hosted by the sync
// server. Connected browser clients receive a Yjs updateV2 and the editor
// canvas reflects the change without iframe remount or REST refetch.
//
// What this deliberately does NOT do yet:
// - Parse block markup into a structured block tree and push as Y.Array
//   (needs jsdom + @wordpress/blocks). We push body as a single Y.Text on
//   the `content` field; @wordpress/core-data re-derives blocks from that
//   string. Granular block-level merge is a Stage-2 upgrade.
// - Write changes in the other direction (ydoc → file). That's a separate
//   concern — canvas saves still go through the existing REST save flow.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import * as Y from 'yjs';
import { diffChars } from 'diff';

const CRDT_RECORD_MAP_KEY = 'records';
const ORIGIN_FILE = Symbol('wplite-file-bridge');

/**
 * @param {object} options
 * @param {string} options.siteRoot          Absolute path to the active site root.
 * @param {() => string|null} options.getSiteUrl  Returns current running-site URL or null.
 * @param {(siteUrl: string) => Promise<{ cookies: string, nonce: string }>} options.createAdminSession
 *        Factory the bridge calls once to get an admin session; result is cached internally.
 * @param {(room: string) => Y.Doc} options.getDoc  Pulls (and creates) the server-side Y.Doc for a room.
 * @param {(message: string) => void} [options.log]
 */
export function createFileSyncBridge({
  siteRoot,
  getSiteUrl,
  createAdminSession,
  getDoc,
  broadcastEvent = () => {},
  log = () => {},
}) {
  const idCache = new Map(); // `${postType}:${slug}` → number
  let sessionPromise = null;
  let themeSlug = null; // lazily resolved from site.json

  function invalidateSession() {
    sessionPromise = null;
  }

  async function session() {
    const siteUrl = getSiteUrl();
    if (!siteUrl) return null;
    if (!sessionPromise) {
      sessionPromise = createAdminSession(siteUrl).catch((err) => {
        sessionPromise = null;
        throw err;
      });
    }
    return sessionPromise;
  }

  async function fetchPostId(postType, slug) {
    const cacheKey = `${postType}:${slug}`;
    const cached = idCache.get(cacheKey);
    if (cached != null) return cached;

    const siteUrl = getSiteUrl();
    if (!siteUrl) return null;
    const auth = await session();
    if (!auth) return null;

    const basePath = restBaseForPostType(postType);
    const slugParam = slug === '' ? '' : `?slug=${encodeURIComponent(slug)}`;
    const url = `${siteUrl}/wp-json/wp/v2/${basePath}${slugParam}&status=any&context=view`
      .replace(/[?&]$/, '');

    const res = await fetch(url, {
      headers: {
        Cookie: auth.cookies,
        'X-WP-Nonce': auth.nonce,
      },
    });

    if (res.status === 401 || res.status === 403) {
      // Session may have expired — retry once with a fresh session.
      invalidateSession();
      const retryAuth = await session();
      if (!retryAuth) return null;
      const retry = await fetch(url, {
        headers: { Cookie: retryAuth.cookies, 'X-WP-Nonce': retryAuth.nonce },
      });
      if (!retry.ok) return null;
      const items = await retry.json();
      const id = pickMatchingId(items, slug);
      if (id != null) idCache.set(cacheKey, id);
      return id;
    }

    if (!res.ok) return null;
    const items = await res.json();
    const id = pickMatchingId(items, slug);
    if (id != null) idCache.set(cacheKey, id);
    return id;
  }

  async function resolveThemeSlug() {
    if (themeSlug) return themeSlug;
    try {
      const siteJson = await readFile(path.join(siteRoot, 'app', 'site.json'), 'utf8');
      const site = JSON.parse(siteJson);
      themeSlug = site?.theme?.slug ?? null;
    } catch {
      themeSlug = null;
    }
    return themeSlug;
  }

  function classifyContentPath(absPath) {
    const rel = path.relative(siteRoot, absPath).split(path.sep).join('/');

    // Content pages / posts — post-type entities keyed by WP post ID.
    const contentMatch = rel.match(/^content\/([^/]+)\/([^/]+)\.(md|html)$/);
    if (contentMatch) {
      const [, dir, stem] = contentMatch;
      const postType =
        dir === 'pages' ? 'page' :
        dir === 'posts' ? 'post' :
        null;
      if (!postType) return null;
      return { kind: 'content', postType, slug: stem, relPath: rel };
    }

    // Theme templates — wp_template entities keyed by "theme//slug".
    const tmplMatch = rel.match(/^theme\/templates\/([^/]+)\.html$/);
    if (tmplMatch) {
      return { kind: 'template', slug: tmplMatch[1], relPath: rel };
    }

    // Theme template parts — wp_template_part entities keyed by "theme//slug".
    const partMatch = rel.match(/^theme\/parts\/([^/]+)\.html$/);
    if (partMatch) {
      return { kind: 'template-part', slug: partMatch[1], relPath: rel };
    }

    // Theme patterns — no CRDT entity (patterns are registered via PHP), but
    // we still broadcast so clients can invalidate their pattern caches.
    const patternMatch = rel.match(/^theme\/patterns\/([^/]+)\.html$/);
    if (patternMatch) {
      return { kind: 'pattern', slug: patternMatch[1], relPath: rel };
    }

    return null;
  }

  function pushToRoom(room, { title, content, log: logIt = true, relPath = '' } = {}) {
    const ydoc = getDoc(room);
    const ymap = ydoc.getMap(CRDT_RECORD_MAP_KEY);
    ydoc.transact(() => {
      if (typeof title === 'string' && title) {
        setYText(ymap, 'title', title);
      }
      if (typeof content === 'string') {
        setYText(ymap, 'content', content);
      }
    }, ORIGIN_FILE);
    if (logIt) log(`file-bridge: ${relPath} → ${room}`);
  }

  /**
   * Apply a single file's contents to the matching Y.Doc(s).
   * @param {string} absPath
   * @returns {Promise<boolean>} true if applied, false if not matched/skipped
   */
  async function applyFile(absPath) {
    const info = classifyContentPath(absPath);
    if (!info) return false;

    let source;
    try {
      source = await readFile(absPath, 'utf8');
    } catch {
      return false;
    }

    if (info.kind === 'content') {
      const { postType, slug, relPath } = info;
      const id = await fetchPostId(postType, slug);
      if (id == null) {
        log(`file-bridge: no WP post yet for ${postType}/${slug}; skipping ${relPath}`);
        return false;
      }
      const parsed = matter(source);
      const frontmatter = parsed.data ?? {};
      const body = parsed.content.trim();
      pushToRoom(`postType/${postType}:${id}`, {
        title: typeof frontmatter.title === 'string' ? frontmatter.title : undefined,
        content: body,
        relPath,
      });
      // Belt-and-suspenders: also broadcast an invalidate event so the
      // client refetches even if the CRDT path is unreachable (e.g. the
      // client hasn't opened the per-entity WS room yet).
      broadcastEvent({
        type: 'invalidate-entity',
        kind: 'postType',
        name: postType,
        id,
      });
      return true;
    }

    if (info.kind === 'template' || info.kind === 'template-part') {
      const theme = await resolveThemeSlug();
      if (!theme) {
        log(`file-bridge: could not resolve theme slug; skipping ${info.relPath}`);
        return false;
      }
      const postType = info.kind === 'template' ? 'wp_template' : 'wp_template_part';
      const entityId = `${theme}//${info.slug}`;
      // Push to the CRDT room for any future client that opts in.
      pushToRoom(`postType/${postType}:${entityId}`, {
        content: source,
        relPath: info.relPath,
      });
      // core-data's sync manager skips non-numeric entity IDs (which
      // wp_template uses), so the CRDT path alone won't reach the canvas.
      // Emit a parallel "invalidate" event the client consumes over the
      // dedicated _events channel to force a core-data refetch.
      broadcastEvent({
        type: 'invalidate-entity',
        kind: 'postType',
        name: postType,
        id: entityId,
      });
      return true;
    }

    if (info.kind === 'pattern') {
      // Patterns are PHP-registered, not entities. Editing a pattern file
      // re-registers it on the next page load; to see the change live, the
      // client must reload its editor bundle so __experimentalBlockPatterns
      // picks up the new registration.
      pushToRoom(`wplite/pattern:${info.slug}`, {
        content: source,
        relPath: info.relPath,
      });
      broadcastEvent({
        type: 'invalidate-patterns',
        slug: info.slug,
      });
      return true;
    }

    return false;
  }

  /**
   * Walk source dirs and hydrate ydocs so rooms are populated before any client joins.
   */
  async function hydrateAll() {
    const { readdir } = await import('node:fs/promises');
    const roots = [
      path.join(siteRoot, 'content', 'pages'),
      path.join(siteRoot, 'content', 'posts'),
      path.join(siteRoot, 'theme', 'templates'),
      path.join(siteRoot, 'theme', 'parts'),
      path.join(siteRoot, 'theme', 'patterns'),
    ];
    let count = 0;
    for (const dir of roots) {
      let entries = [];
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (!entry.name.endsWith('.md') && !entry.name.endsWith('.html')) continue;
        const applied = await applyFile(path.join(dir, entry.name)).catch(() => false);
        if (applied) count += 1;
      }
    }
    log(`file-bridge: hydrated ${count} doc(s) from source files`);
  }

  return { applyFile, hydrateAll, invalidateSession };
}

function restBaseForPostType(postType) {
  // REST base for core types; for custom post types the rest_base may differ
  // from the post_type name, but custom types aren't supported in this Stage-1 bridge.
  if (postType === 'page') return 'pages';
  if (postType === 'post') return 'posts';
  return postType;
}

function pickMatchingId(items, slug) {
  if (!Array.isArray(items) || items.length === 0) return null;
  if (slug === '') return items[0]?.id ?? null;
  const match = items.find((item) => String(item?.slug ?? '') === slug);
  return (match ?? items[0])?.id ?? null;
}

function setYText(ymap, key, newValue) {
  const current = ymap.get(key);
  if (current instanceof Y.Text) {
    if (current.toString() === newValue) return;
    applyMinimalDiff(current, newValue ?? '');
    return;
  }
  const text = new Y.Text();
  if (newValue) text.insert(0, newValue);
  ymap.set(key, text);
}

// Apply the smallest set of insert/delete ops needed to morph yText's
// current contents into `next`. Walks a char-level diff and emits ops
// at the matching offsets; everything outside the changed region is
// untouched, so any concurrent caret in the unchanged section keeps its
// position. (For blocks it's still a textual diff over serialized markup —
// good enough for the common "tweak one heading" case.)
function applyMinimalDiff(yText, next) {
  const previous = yText.toString();
  if (previous === next) return;
  const parts = diffChars(previous, next);
  let cursor = 0;
  for (const part of parts) {
    if (part.added) {
      yText.insert(cursor, part.value);
      cursor += part.value.length;
    } else if (part.removed) {
      yText.delete(cursor, part.value.length);
      // cursor unchanged — deletion shrinks the doc at this offset.
    } else {
      cursor += part.value.length;
    }
  }
}
