// CRDT-backed editor at /app/_sync-test/:pageId.
//
// Reuses NativeBlockEditorFrame for full chrome parity with the production
// editor (inserter, inspector, breadcrumb, save bar, keyboard shortcuts).
// What's different: blocks are derived from the page's wp_template + the
// page's post_content, with `core/pattern` and `core/post-content` blocks
// pre-expanded inline so a fresh render always shows current data — and
// the file-bridge / event-bus pipeline streams those updates in without
// remounting the iframe (canvasRevision is pinned to 0).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { dispatch as dataDispatch, select as dataSelect, useSelect } from '@wordpress/data';
import { store as coreStore, EntityProvider } from '@wordpress/core-data';
import { parse as parseBlocks, serialize as serializeBlocks } from '@wordpress/blocks';

import { syncUrl } from '../lib/config.js';
import { NativeBlockEditorFrame } from './block-editor.jsx';
import {
  composeTemplateEditorBlocks_,
  splitTemplateEditorBlocks_,
} from './pages.jsx';

const NOOP = () => {};

function pickContent(maybe) {
  if (typeof maybe === 'string') return maybe;
  if (maybe && typeof maybe === 'object') {
    if (typeof maybe.raw === 'string') return maybe.raw;
    if (typeof maybe.rendered === 'string') return maybe.rendered;
  }
  return '';
}

// Pre-expand `core/pattern` references using the registered pattern markup.
// Gutenberg's PatternEdit expands patterns once on mount and never again;
// inlining them here means a bundle reload re-runs this expansion and the
// canvas reflects the updated pattern markup.
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
  const navigate = useNavigate();

  const page = useSelect(
    (select) => select(coreStore).getEntityRecord('postType', 'page', pageId),
    [pageId]
  );

  // Subscribe to the page's edited content + title. The blocks-clear
  // effect below makes sure file-driven content updates win over a stale
  // local edit cached on `editedRecord.blocks`.
  const { postContentString, pageTitle, entityLoaded } = useSelect(
    (select) => {
      const recordLoaded = Boolean(
        select(coreStore).getEntityRecord('postType', 'page', pageId)
      );
      const edited = recordLoaded
        ? select(coreStore).getEditedEntityRecord('postType', 'page', pageId)
        : null;
      const rawContent = edited?.content;
      const rawTitle = edited?.title;
      return {
        entityLoaded: recordLoaded,
        postContentString:
          typeof rawContent === 'string' ? rawContent : rawContent?.raw ?? rawContent?.rendered ?? '',
        pageTitle: typeof rawTitle === 'string' ? rawTitle : rawTitle?.raw ?? rawTitle?.rendered ?? '',
      };
    },
    [pageId]
  );

  useEffect(() => {
    if (!pageId || !entityLoaded) return;
    try {
      // We don't drive the page through the canvas here, so any cached
      // edits would only mask CRDT updates. Clear them so getEditedEntityRecord
      // falls through to the latest base record content.
      const actions = dataDispatch('core');
      if (typeof actions.clearEntityRecordEdits === 'function') {
        actions.clearEntityRecordEdits('postType', 'page', pageId);
      }
    } catch {
      // Race during initial mount; the next selector tick handles it.
    }
  }, [pageId, postContentString, entityLoaded]);

  // Resolve the wp_template that matches the page's template slug.
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

  const templateRecord = useSelect(
    (select) => {
      if (!templateId) return null;
      const store = select(coreStore);
      store.getEntityRecord('postType', 'wp_template', templateId);
      return store.getEditedEntityRecord('postType', 'wp_template', templateId);
    },
    [templateId]
  );

  const patternIndex = useMemo(
    () => buildPatternIndex(editorBundle?.editorSettings?.__experimentalBlockPatterns),
    [editorBundle]
  );

  const templateBlocks = useMemo(() => {
    const raw = pickContent(templateRecord?.content);
    if (!raw) return [];
    try {
      const parsed = parseBlocks(raw);
      return injectPatterns(parsed, patternIndex, parseBlocks);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('sync-test: failed to parse template blocks', err);
      return [];
    }
  }, [templateRecord?.content, patternIndex]);

  const mergedBlocks = useMemo(() => {
    const postContentBlocks = postContentString ? parseBlocks(postContentString) : [];
    return composeTemplateEditorBlocks_(templateBlocks, postContentBlocks).blocks;
  }, [templateBlocks, postContentString]);

  const recordContext = useMemo(
    () => ({ postId: pageId, postType: 'page' }),
    [pageId]
  );

  // Track the most recent serialized post-content we wrote, so we can skip
  // redundant edit dispatches that would feed back into the merged tree.
  const lastSerializedRef = useRef(postContentString);

  const handleChangeTitle = (value) => {
    try {
      dataDispatch('core').editEntityRecord('postType', 'page', pageId, { title: value });
    } catch {
      // noop
    }
  };

  // onInput / onChange come from BlockEditorProvider via the inner frame
  // with the FULL merged tree (template + sentinel slot wrapping the page
  // content). Extract the page-content portion via splitTemplateEditorBlocks
  // and persist it as a content edit on the page entity.
  const handleBlocksChange = (nextBlocks) => {
    if (!Array.isArray(nextBlocks)) return;
    try {
      const split = splitTemplateEditorBlocks_(nextBlocks);
      const nextContent = serializeBlocks(split.pageContentBlocks);
      if (nextContent === lastSerializedRef.current) return;
      lastSerializedRef.current = nextContent;
      dataDispatch('core').editEntityRecord('postType', 'page', pageId, {
        content: nextContent,
        blocks: undefined,
      });
    } catch {
      // noop — split or serialize can fail mid-edit; next change will retry
    }
  };

  const handleSave = async () => {
    try {
      await dataDispatch('core').saveEditedEntityRecord('postType', 'page', pageId);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('sync-test save failed:', err);
    }
  };

  const isDirty = useSelect(
    (select) =>
      Boolean(select(coreStore).hasEditsForEntityRecord?.('postType', 'page', pageId)),
    [pageId]
  );
  const isSaving = useSelect(
    (select) =>
      Boolean(select(coreStore).isSavingEntityRecord?.('postType', 'page', pageId)),
    [pageId]
  );

  if (!page || !templateRecord) {
    return (
      <div className="screen sync-test-loading">
        Loading {!page ? 'page' : 'template'}…
      </div>
    );
  }

  return (
    <NativeBlockEditorFrame
      label="Sync test"
      title={pageTitle ?? ''}
      titlePlaceholder="Add page title"
      onChangeTitle={handleChangeTitle}
      showTitleInput={false}
      showBackButton={false}
      showPrimaryAction={isDirty}
      showMoreActions={true}
      blocks={mergedBlocks}
      onChangeBlocks={handleBlocksChange}
      backLabel="Back to Pages"
      onBack={() => navigate('/pages')}
      primaryActionLabel={isSaving ? 'Saving…' : 'Save'}
      onPrimaryAction={handleSave}
      isPrimaryBusy={isSaving}
      viewUrl={page?.link}
      documentLabel="Page"
      canvasLayout="template"
      canvasRevision={0}
      recordContext={recordContext}
      showEmptyPatternPicker={false}
    />
  );
}

export function SyncTestPage() {
  const params = useParams();
  const rawId = params.pageId ?? '';
  const pageId = /^\d+$/.test(rawId) ? Number(rawId) : rawId;

  const [bundleEpoch, setBundleEpoch] = useState(0);
  const [editorBundle, setEditorBundle] = useState(null);

  useEffect(() => {
    let cancelled = false;
    import('../lib/editor-bundle.js')
      .then(({ loadEditorBundle, getCachedEditorBundle }) => {
        const cached = getCachedEditorBundle();
        if (cached && !cancelled) setEditorBundle(cached);
        return loadEditorBundle();
      })
      .then((bundle) => {
        if (!cancelled) setEditorBundle(bundle);
      })
      .catch(() => {
        // Errors surface through the inner frame's bundle handling.
      });
    return () => { cancelled = true; };
  }, [bundleEpoch]);

  useEffect(() => {
    function onBundleUpdated() {
      setBundleEpoch((n) => n + 1);
    }
    window.addEventListener('wplite-event:editor-bundle-updated', onBundleUpdated);
    return () =>
      window.removeEventListener('wplite-event:editor-bundle-updated', onBundleUpdated);
  }, []);

  // DevTools helpers — keep these around; they're cheap and useful.
  useEffect(() => {
    if (!pageId) return undefined;
    window.__wpliteSyncTestRoom = `postType/page:${pageId}`;
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
      <div className="screen sync-test-empty">
        Provide a numeric page ID: <code>/app/_sync-test/&lt;id&gt;</code>
      </div>
    );
  }

  if (!syncUrl) {
    return (
      <div className="screen sync-test-empty">
        CRDT sync server is not running. Start <code>wp-lite dev</code> to enable
        this editor.
      </div>
    );
  }

  return (
    <EntityProvider kind="postType" type="page" id={pageId}>
      <SyncTestCanvas pageId={pageId} editorBundle={editorBundle} />
    </EntityProvider>
  );
}
