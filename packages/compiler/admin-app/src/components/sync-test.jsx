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
import {
  reloadEntityFromSource,
  WPLITE_STALE_EVENT,
} from '../lib/wplite-event-bus.js';
import {
  NativeField,
  NativeFieldGrid,
  NativeInput,
  NativeMetaList,
  NativeSection,
  NativeSelect,
} from './native-controls.jsx';
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

function SyncEntityCanvas({
  postType = 'page',
  entityId,
  editorBundle,
  documentLabel = 'Page',
  backLabel = 'Back to Pages',
  backHref = '/pages',
  fallbackTemplateSlug = 'page',
  templateSlugFromRecord = (rec) =>
    typeof rec?.template === 'string' && rec.template ? rec.template : null,
}) {
  const pageId = entityId; // local alias to keep existing identifiers stable
  const navigate = useNavigate();

  const page = useSelect(
    (select) => select(coreStore).getEntityRecord('postType', postType, pageId),
    [pageId]
  );

  // Subscribe to the page's edited content + title. The blocks-clear
  // effect below makes sure file-driven content updates win over a stale
  // local edit cached on `editedRecord.blocks`.
  const { postContentString, pageTitle, entityLoaded } = useSelect(
    (select) => {
      const recordLoaded = Boolean(
        select(coreStore).getEntityRecord('postType', postType, pageId)
      );
      const edited = recordLoaded
        ? select(coreStore).getEditedEntityRecord('postType', postType, pageId)
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
        actions.clearEntityRecordEdits('postType', postType, pageId);
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
    const desiredSlug = templateSlugFromRecord(page) ?? fallbackTemplateSlug;
    const found =
      allTemplates.find((t) => t.slug === desiredSlug) ??
      allTemplates.find((t) => t.slug === fallbackTemplateSlug) ??
      allTemplates.find((t) => t.slug === 'page') ??
      allTemplates.find((t) => t.slug === 'single') ??
      allTemplates[0];
    return found?.id ?? null;
  }, [allTemplates, page, fallbackTemplateSlug, templateSlugFromRecord]);

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
    () => ({ postId: pageId, postType }),
    [pageId, postType]
  );

  // Track the most recent serialized post-content we wrote, so we can skip
  // redundant edit dispatches that would feed back into the merged tree.
  const lastSerializedRef = useRef(postContentString);

  const handleChangeTitle = (value) => {
    try {
      dataDispatch('core').editEntityRecord('postType', postType, pageId, { title: value });
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
      dataDispatch('core').editEntityRecord('postType', postType, pageId, {
        content: nextContent,
        blocks: undefined,
      });
    } catch {
      // noop — split or serialize can fail mid-edit; next change will retry
    }
  };

  const handleSave = async () => {
    try {
      await dataDispatch('core').saveEditedEntityRecord('postType', postType, pageId);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('sync-test save failed:', err);
    }
  };

  const isDirty = useSelect(
    (select) =>
      Boolean(select(coreStore).hasEditsForEntityRecord?.('postType', postType, pageId)),
    [pageId]
  );
  const isSaving = useSelect(
    (select) =>
      Boolean(select(coreStore).isSavingEntityRecord?.('postType', postType, pageId)),
    [pageId]
  );

  // Source-stale banner: when the file changes while we have unsaved
  // edits, the event-bus emits WPLITE_STALE_EVENT instead of clobbering
  // them. We track it here so the user can choose between keeping their
  // changes or reloading from the new file content.
  const [staleSource, setStaleSource] = useState(null);

  useEffect(() => {
    function onStale(event) {
      const { kind, name, id } = event.detail ?? {};
      if (kind !== 'postType' || name !== postType || String(id) !== String(pageId)) {
        return;
      }
      setStaleSource({ kind, name, id });
    }
    window.addEventListener(WPLITE_STALE_EVENT, onStale);
    return () => window.removeEventListener(WPLITE_STALE_EVENT, onStale);
  }, [pageId]);

  // Once the user saves OR explicitly reloads from source, dismiss the banner.
  useEffect(() => {
    if (!isDirty && staleSource) setStaleSource(null);
  }, [isDirty, staleSource]);

  const acceptStale = () => {
    if (!staleSource) return;
    reloadEntityFromSource(staleSource.kind, staleSource.name, staleSource.id);
    setStaleSource(null);
  };

  // Sidebar fields — wire through core-data edits so changes save with
  // the rest of the page record. Read raw values from page so the UI
  // shows whatever's persisted.
  const editPage = (patch) => {
    try {
      dataDispatch('core').editEntityRecord('postType', postType, pageId, patch);
    } catch {
      // noop
    }
  };

  const slugValue = useSelect(
    (select) => {
      const edited = select(coreStore).getEditedEntityRecord('postType', postType, pageId);
      return edited?.slug ?? '';
    },
    [pageId]
  );
  const statusValue = useSelect(
    (select) => {
      const edited = select(coreStore).getEditedEntityRecord('postType', postType, pageId);
      return edited?.status ?? 'draft';
    },
    [pageId]
  );
  const templateValue = useSelect(
    (select) => {
      const edited = select(coreStore).getEditedEntityRecord('postType', postType, pageId);
      return edited?.template ?? '';
    },
    [pageId]
  );
  const templateOptions = useMemo(() => {
    const opts = [{ value: '', label: 'Default' }];
    if (Array.isArray(allTemplates)) {
      for (const t of allTemplates) {
        if (typeof t?.slug === 'string' && t.slug) {
          opts.push({ value: t.slug, label: t.slug });
        }
      }
    }
    return opts;
  }, [allTemplates]);

  const documentSidebar = (
    <>
      <NativeSection title="Summary" initialOpen={true}>
        <NativeFieldGrid cols={2}>
          <NativeField label="Slug">
            <NativeInput
              value={slugValue}
              onChange={(value) => editPage({ slug: value })}
            />
          </NativeField>
          <NativeField label="Status">
            <NativeSelect
              value={statusValue}
              options={[
                { value: 'draft', label: 'Draft' },
                { value: 'publish', label: 'Published' },
                { value: 'pending', label: 'Pending Review' },
                { value: 'private', label: 'Private' },
              ]}
              onChange={(value) => editPage({ status: value })}
            />
          </NativeField>
        </NativeFieldGrid>
        <NativeField label="Template">
          <NativeSelect
            value={templateValue}
            options={templateOptions}
            onChange={(value) => editPage({ template: value })}
          />
        </NativeField>
      </NativeSection>

      <NativeSection title="Details" initialOpen={true}>
        <NativeMetaList
          items={[
            { id: 'id', label: 'ID', value: page?.id ?? '—' },
            { id: 'modified', label: 'Updated', value: page?.modified ?? '—' },
            { id: 'link', label: 'URL', value: page?.link ?? '—' },
          ]}
        />
      </NativeSection>
    </>
  );

  if (!page || !templateRecord) {
    return (
      <div className="screen sync-test-loading">
        Loading {!page ? 'page' : 'template'}…
      </div>
    );
  }

  return (
    <>
      {staleSource ? (
        <div className="sync-test-stale-banner" role="alert">
          <span>Source file changed. You have unsaved edits — keep typing or reload from source.</span>
          <button type="button" onClick={acceptStale}>Reload from source</button>
          <button type="button" onClick={() => setStaleSource(null)}>Keep my edits</button>
        </div>
      ) : null}
      <NativeBlockEditorFrame
        label={documentLabel}
        title={pageTitle ?? ''}
        titlePlaceholder="Add title"
        onChangeTitle={handleChangeTitle}
        showTitleInput={false}
        showBackButton={false}
        showPrimaryAction={isDirty}
        showMoreActions={true}
        blocks={mergedBlocks}
        onChangeBlocks={handleBlocksChange}
        backLabel={backLabel}
        onBack={() => navigate(backHref)}
        primaryActionLabel={isSaving ? 'Saving…' : 'Save'}
        onPrimaryAction={handleSave}
        isPrimaryBusy={isSaving}
        viewUrl={page?.link}
        documentLabel={documentLabel}
        documentSidebar={documentSidebar}
        canvasLayout="template"
        canvasRevision={0}
        recordContext={recordContext}
        showEmptyPatternPicker={false}
      />
    </>
  );
}

function CreatePageScaffold() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    if (!title.trim()) {
      setError('Give the page a title to create it.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await dataDispatch(coreStore).saveEntityRecord(
        'postType',
        'page',
        { title, status: 'draft', content: '' },
        { throwOnError: true }
      );
      if (saved?.id) navigate(`/pages/${saved.id}`);
      else setError('Page saved but no ID returned.');
    } catch (err) {
      setError(err?.message || 'Failed to create page.');
      setBusy(false);
    }
  };

  return (
    <div className="screen sync-test-create">
      <div className="sync-test-create__inner">
        <h1>New page</h1>
        <p>Create a draft, then edit its content with the live-streaming canvas.</p>
        <input
          autoFocus
          type="text"
          placeholder="Page title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        />
        {error ? <p className="sync-test-create__error">{error}</p> : null}
        <div className="sync-test-create__actions">
          <button type="button" onClick={() => navigate('/pages')}>Cancel</button>
          <button type="button" onClick={submit} disabled={busy}>
            {busy ? 'Creating…' : 'Create page'}
          </button>
        </div>
      </div>
    </div>
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
      dataDispatch('core').invalidateResolution('getEntityRecord', ['postType', postType, pageId]);
    };
    window.__wpliteDataSelect = dataSelect;
    window.__wpliteSyncDebug = () => {
      const select = dataSelect('core');
      const page = select.getEntityRecord('postType', postType, pageId);
      const edited = select.getEditedEntityRecord('postType', postType, pageId);
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

  if (rawId === 'new') {
    return <CreatePageScaffold />;
  }

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
      <SyncEntityCanvas
        postType="page"
        entityId={pageId}
        editorBundle={editorBundle}
        documentLabel="Page"
        backLabel="Back to Pages"
        backHref="/pages"
        fallbackTemplateSlug="page"
      />
    </EntityProvider>
  );
}

// Collection-item flavour. Resolves a model from the bootstrap
// collectionPath and feeds its postType into SyncEntityCanvas.
export function SyncCollectionItemPage({ bootstrap }) {
  const params = useParams();
  const navigate = useNavigate();
  const collectionPath = params.collectionPath ?? '';
  const rawId = params.itemId ?? '';
  const entityId = /^\d+$/.test(rawId) ? Number(rawId) : rawId;

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
      .then((bundle) => { if (!cancelled) setEditorBundle(bundle); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [bundleEpoch]);

  useEffect(() => {
    function onBundleUpdated() { setBundleEpoch((n) => n + 1); }
    window.addEventListener('wplite-event:editor-bundle-updated', onBundleUpdated);
    return () =>
      window.removeEventListener('wplite-event:editor-bundle-updated', onBundleUpdated);
  }, []);

  const model = useMemo(() => {
    const models = Array.isArray(bootstrap?.models) ? bootstrap.models : [];
    return (
      models.find(
        (m) => m.adminPath === collectionPath || m.id === collectionPath
      ) ?? null
    );
  }, [bootstrap, collectionPath]);

  if (!syncUrl) {
    return (
      <div className="screen sync-test-empty">
        CRDT sync server is not running. Start <code>wp-lite dev</code> to enable
        this editor.
      </div>
    );
  }

  if (!model) {
    return (
      <div className="screen sync-test-empty">
        Unknown collection: <code>{collectionPath}</code>
      </div>
    );
  }

  if (rawId === 'new') {
    // Defer new-item creation to the legacy editor for now (custom model
    // fields aren't exposed via standard REST yet — see Probe 3 notes).
    return (
      <div className="screen sync-test-empty">
        New {model.label ?? model.id} creation is not in sync engine yet.
        Use <code>?engine=legacy</code> on this URL to fall back, or open
        an existing item.
      </div>
    );
  }

  if (!entityId) {
    return (
      <div className="screen sync-test-empty">
        Provide a numeric item ID.
      </div>
    );
  }

  const postType = model.postType ?? model.id;
  const fallbackTemplate = `single-${model.id}`;
  const backHref = collectionPath ? `/${collectionPath}` : '/';
  const label = model.label ?? model.id;

  return (
    <EntityProvider kind="postType" type={postType} id={entityId}>
      <SyncEntityCanvas
        postType={postType}
        entityId={entityId}
        editorBundle={editorBundle}
        documentLabel={label}
        backLabel={`Back to ${label}`}
        backHref={backHref}
        fallbackTemplateSlug={fallbackTemplate}
      />
    </EntityProvider>
  );
}
