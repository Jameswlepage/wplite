// Stage-1 CRDT proof-of-concept editor.
//
// Lives at /app/_sync-test/:pageId. Mounts the page's *template* (a tree of
// blocks) as the top-level value, with <EntityProvider> + block-context so
// core/post-content inside the template auto-resolves to our page's content
// — which is the one field driven by the CRDT pipeline. Same shape
// Gutenberg's site editor uses for template editing.
//
// The template itself stays read-only here; the post-content block inside
// is the only thing that accepts edits. On external file change to
// content/pages/<slug>.html, Node pushes the new content via WS, core-data
// sees the edit, and the post-content region in the canvas updates without
// a remount. Selection may shift (naive Y.Text replace), which is the known
// Stage-1 limitation noted in file-sync-bridge.mjs.

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { dispatch as dataDispatch, select as dataSelect, useSelect } from '@wordpress/data';
import {
  EntityProvider,
  store as coreStore,
} from '@wordpress/core-data';
import {
  BlockEditorProvider,
  BlockList,
  BlockTools,
  WritingFlow,
  ObserveTyping,
  BlockContextProvider,
  __unstableIframe as GutenbergIframe,
  __unstableEditorStyles as GutenbergEditorStyles,
} from '@wordpress/block-editor';
import { parse as parseBlocks } from '@wordpress/blocks';

import { syncUrl } from '../lib/config.js';
import {
  buildBlockEditorSettings,
  buildCanvasStyles,
} from '../lib/blocks.jsx';
import {
  getCachedEditorBundle,
  loadEditorBundle,
} from '../lib/editor-bundle.js';
import './sync-test.css';

const NOOP = () => {};

function pickContent(maybe) {
  if (typeof maybe === 'string') return maybe;
  if (maybe && typeof maybe === 'object') {
    if (typeof maybe.raw === 'string') return maybe.raw;
    if (typeof maybe.rendered === 'string') return maybe.rendered;
  }
  return '';
}

// Walk a block tree and inline `postContentBlocks` wherever a
// `core/post-content` block appears, producing a fully-expanded tree. This
// lets a static BlockEditorProvider render both the template and the live
// post content without relying on core/post-content's internal entity hook
// (which doesn't re-sync when the entity's content is updated externally).
function injectPostContent(blocks, postContentBlocks) {
  if (!Array.isArray(blocks)) return [];
  const out = [];
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    if (block.name === 'core/post-content') {
      for (const inner of postContentBlocks) out.push(inner);
      continue;
    }
    if (Array.isArray(block.innerBlocks) && block.innerBlocks.length > 0) {
      out.push({
        ...block,
        innerBlocks: injectPostContent(block.innerBlocks, postContentBlocks),
      });
    } else {
      out.push(block);
    }
  }
  return out;
}

// Pre-expand `core/pattern` references using the registered pattern markup.
// Gutenberg's PatternEdit expands patterns on mount and never re-expands;
// inlining them here means a bundle reload (which refreshes the pattern
// registry) re-runs this expansion and the canvas reflects the new content.
function buildPatternIndex(patterns) {
  const map = new Map();
  if (!Array.isArray(patterns)) return map;
  for (const pattern of patterns) {
    if (!pattern || typeof pattern !== 'object') continue;
    const name = pattern.name;
    if (typeof name !== 'string' || !name) continue;
    map.set(name, pattern);
  }
  return map;
}

function injectPatterns(blocks, patternIndex, parseBlocksFn, depth = 0) {
  if (!Array.isArray(blocks) || depth > 8) return blocks ?? [];
  const out = [];
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    if (block.name === 'core/pattern') {
      const slug = block.attributes?.slug;
      const pattern = slug ? patternIndex.get(slug) : null;
      if (pattern) {
        let inner = Array.isArray(pattern.blocks) ? pattern.blocks : null;
        if (!inner && typeof pattern.content === 'string') {
          try {
            inner = parseBlocksFn(pattern.content);
          } catch {
            inner = [];
          }
        }
        if (Array.isArray(inner)) {
          for (const child of injectPatterns(inner, patternIndex, parseBlocksFn, depth + 1)) {
            out.push(child);
          }
          continue;
        }
      }
      // Pattern slug unknown → keep the original block; Gutenberg will
      // render its empty/missing fallback.
      out.push(block);
      continue;
    }
    if (Array.isArray(block.innerBlocks) && block.innerBlocks.length > 0) {
      out.push({
        ...block,
        innerBlocks: injectPatterns(block.innerBlocks, patternIndex, parseBlocksFn, depth + 1),
      });
    } else {
      out.push(block);
    }
  }
  return out;
}

function SyncTestCanvas({ pageId, editorBundle }) {
  // Use the TEMPLATE as the top-level block tree. core/post-content inside
  // the template picks up our page via block context below.
  const page = useSelect(
    (select) => select(coreStore).getEntityRecord('postType', 'page', pageId),
    [pageId]
  );

  // Subscribe to the edited record's content string. When a CRDT-sourced
  // update lands, `content` changes. We immediately clear any cached
  // `blocks` edit so useEntityBlockEditor falls back to re-parsing from the
  // fresh content. Without this, the first render's internal onInput
  // normalization sets `editedRecord.blocks`, which then short-circuits
  // every subsequent content update because the hook prefers editedBlocks
  // over `parse(content)`.
  const { postContentString, entityLoaded } = useSelect(
    (select) => {
      const recordLoaded = Boolean(
        select(coreStore).getEntityRecord('postType', 'page', pageId)
      );
      const edited = recordLoaded
        ? select(coreStore).getEditedEntityRecord('postType', 'page', pageId)
        : null;
      const raw = edited?.content;
      return {
        entityLoaded: recordLoaded,
        postContentString:
          typeof raw === 'string' ? raw : raw?.raw ?? raw?.rendered ?? '',
      };
    },
    [pageId]
  );

  useEffect(() => {
    if (!pageId || !entityLoaded) return;
    try {
      dataDispatch('core').editEntityRecord('postType', 'page', pageId, {
        blocks: undefined,
      });
    } catch {
      // Entity config may race the first render; retry will happen when
      // the selector re-fires after the record resolves.
    }
  }, [pageId, postContentString, entityLoaded]);

  // First: load all templates to find the one matching this page's template
  // slug. We use getEntityRecords here purely as an index lookup.
  const allTemplates = useSelect(
    (select) => select(coreStore).getEntityRecords('postType', 'wp_template', { per_page: -1 }),
    []
  );

  const templateId = useMemo(() => {
    if (!Array.isArray(allTemplates) || allTemplates.length === 0) return null;
    const desiredSlug =
      typeof page?.template === 'string' && page.template ? page.template : 'page';
    const found =
      allTemplates.find((t) => t.slug === desiredSlug) ??
      allTemplates.find((t) => t.slug === 'page') ??
      allTemplates.find((t) => t.slug === 'single') ??
      allTemplates[0];
    return found?.id ?? null;
  }, [allTemplates, page?.template]);

  // Subscribe to the specific template record's EDITED state. When the
  // file-bridge pushes new markup over CRDT, core-data's editedRecord updates
  // and this selector re-fires, feeding fresh blocks into the canvas.
  const templateRecord = useSelect(
    (select) => {
      if (!templateId) return null;
      const store = select(coreStore);
      store.getEntityRecord('postType', 'wp_template', templateId); // resolve
      return store.getEditedEntityRecord('postType', 'wp_template', templateId);
    },
    [templateId]
  );

  // Index the editor bundle's pattern registry so we can inline pattern
  // markup ourselves below.
  const patternIndex = useMemo(
    () => buildPatternIndex(editorBundle?.editorSettings?.__experimentalBlockPatterns),
    [editorBundle]
  );

  const templateBlocks = useMemo(() => {
    const raw = pickContent(templateRecord?.content);
    if (!raw) return [];
    try {
      const parsed = parseBlocks(raw);
      // Expand patterns up front so a future bundle reload re-runs this
      // memo and pulls in the latest pattern markup.
      return injectPatterns(parsed, patternIndex, parseBlocks);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('sync-test: failed to parse template blocks', err);
      return [];
    }
  }, [templateRecord?.content, patternIndex]);

  // Pre-expand any core/post-content block in the template tree by inlining
  // the current page's parsed blocks. This sidesteps the fact that
  // core/post-content internally owns its inner blocks once mounted and
  // doesn't re-sync when the entity's content changes externally — we make
  // the template tree the single source of truth that React reconciles.
  const mergedBlocks = useMemo(() => {
    const postContentBlocks = postContentString ? parseBlocks(postContentString) : [];
    return injectPostContent(templateBlocks, postContentBlocks);
  }, [templateBlocks, postContentString]);

  const blockContext = useMemo(
    () => ({ postId: pageId, postType: 'page' }),
    [pageId]
  );

  const canvasStyles = useMemo(
    () => buildCanvasStyles(editorBundle),
    [editorBundle]
  );

  const editorSettings = useMemo(
    () => buildBlockEditorSettings(editorBundle),
    [editorBundle]
  );

  if (!page || !templateRecord) {
    return (
      <div className="sync-test-loading">
        Loading {!page ? 'page' : 'template'}…
      </div>
    );
  }

  return (
    <BlockEditorProvider
      value={mergedBlocks}
      onInput={NOOP}
      onChange={NOOP}
      settings={editorSettings}
    >
      <BlockContextProvider value={blockContext}>
        <div className="sync-test__frame-wrap">
          <GutenbergIframe
            className="sync-test__frame"
            style={{ height: '100%', width: '100%' }}
          >
            <GutenbergEditorStyles styles={canvasStyles} />
            <BlockTools>
              <WritingFlow>
                <ObserveTyping>
                  <BlockList />
                </ObserveTyping>
              </WritingFlow>
            </BlockTools>
          </GutenbergIframe>
        </div>
      </BlockContextProvider>
    </BlockEditorProvider>
  );
}

export function SyncTestPage() {
  const params = useParams();
  const rawId = params.pageId ?? '';
  const pageId = /^\d+$/.test(rawId) ? Number(rawId) : rawId;

  const [editorBundle, setEditorBundle] = useState(() => getCachedEditorBundle());
  const [bundleError, setBundleError] = useState(null);
  const [bundleEpoch, setBundleEpoch] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadEditorBundle()
      .then((bundle) => {
        if (!cancelled) setEditorBundle(bundle);
      })
      .catch((err) => {
        if (!cancelled) setBundleError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [bundleEpoch]);

  useEffect(() => {
    // When a pattern file changes, the event-bus refreshes the editor
    // bundle. Bumping an epoch forces us to re-load the bundle and
    // therefore pick up the new __experimentalBlockPatterns registry.
    function onBundleUpdated() {
      setBundleEpoch((n) => n + 1);
    }
    window.addEventListener('wplite-event:editor-bundle-updated', onBundleUpdated);
    return () =>
      window.removeEventListener('wplite-event:editor-bundle-updated', onBundleUpdated);
  }, []);

  useEffect(() => {
    if (!pageId) return undefined;
    window.__wpliteSyncTestRoom = `postType/page:${pageId}`;
    // Debug inspector — makes core-data + sync state pokeable from DevTools.
    window.__wpliteRefetchPage = () => {
      dataDispatch('core').invalidateResolution('getEntityRecord', ['postType', 'page', pageId]);
    };
    window.__wpliteDataSelect = dataSelect;
    window.__wpliteSyncDebug = () => {
      const select = dataSelect('core');
      const page = select.getEntityRecord('postType', 'page', pageId);
      const edited = select.getEditedEntityRecord('postType', 'page', pageId);
      const getContent = (obj) =>
        typeof obj?.content === 'string'
          ? obj.content
          : obj?.content?.raw ?? obj?.content?.rendered ?? '';
      return {
        pageId,
        room: window.__wpliteSyncTestRoom,
        recordContent: getContent(page),
        editedContent: getContent(edited),
        editedTitle: typeof edited?.title === 'string' ? edited.title : edited?.title?.raw,
        hasEditedBlocks: Array.isArray(edited?.blocks),
        editedBlockCount: edited?.blocks?.length,
      };
    };
    return () => {
      delete window.__wpliteSyncTestRoom;
      delete window.__wpliteSyncDebug;
      delete window.__wpliteRefetchPage;
      delete window.__wpliteDataSelect;
    };
  }, [pageId]);

  if (!pageId) {
    return (
      <div className="sync-test-empty">
        Provide a numeric page ID: <code>/app/_sync-test/&lt;id&gt;</code>
      </div>
    );
  }

  if (!syncUrl) {
    return (
      <div className="sync-test-empty">
        CRDT sync server is not running. Start <code>wp-lite dev</code> to enable
        this editor.
      </div>
    );
  }

  if (bundleError) {
    return (
      <div className="sync-test-empty">
        Failed to load editor bundle: {bundleError.message}
      </div>
    );
  }

  return (
    <div className="sync-test-shell">
      <div className="sync-test-banner">
        CRDT sync-test · room <code>postType/page:{pageId}</code>
        {' · '}server <code>{syncUrl}</code>
        {' · '}theme <code>{editorBundle?.themeName ?? '—'}</code>
      </div>
      <EntityProvider kind="postType" type="page" id={pageId}>
        <SyncTestCanvas
          pageId={pageId}
          editorBundle={editorBundle}
        />
      </EntityProvider>
    </div>
  );
}
