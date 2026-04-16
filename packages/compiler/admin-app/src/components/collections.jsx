import React, { Fragment, startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  CardBody,
  PanelBody,
  SelectControl,
  TextControl,
  TextareaControl,
} from '@wordpress/components';
import { serialize } from '@wordpress/blocks';
import { DataForm, DataViews, filterSortAndPaginate } from '@wordpress/dataviews';
import {
  apiFetch,
  buildFieldDefinitions,
  buildFormConfig,
  collectionPathForModel,
  createEmptyRecord,
  createInitialView,
  editorRouteForModel,
  formatDate,
  formatDateTime,
  getModelByCollectionPath,
} from '../lib/helpers.js';
import { createInternalLinkResolver } from '../lib/internal-links.js';
import { blocksFromContent } from '../lib/blocks.jsx';
import { wpApiFetch } from '../lib/helpers.js';
import { loadCachedTemplateRecord } from '../lib/editor-prefetch.js';
import { ImageControl, RepeaterControl } from './controls.jsx';
import { NativeBlockEditorFrame } from './block-editor.jsx';
import { useRegisterWorkspaceSurface } from './workspace-context.jsx';
import { useRegisterAssistantContext } from './assistant-provider.jsx';
import {
  composeTemplateEditorBlocks_ as composeTemplateEditorBlocks,
  splitTemplateEditorBlocks_ as splitTemplateEditorBlocks,
} from './pages.jsx';

/* ── Collection List Page ── */
export function CollectionListPage({ bootstrap, recordsByModel }) {
  const navigate = useNavigate();
  const { collectionPath } = useParams();
  const model = getModelByCollectionPath(bootstrap.models, collectionPath);
  const schema = model ? bootstrap.adminSchema.views?.[model.id] : null;
  const [view, setView] = useState(() => (schema ? createInitialView(schema) : null));
  const [selection, setSelection] = useState([]);

  const listAssistantContext = useMemo(() => (model ? {
    view: 'collection-list',
    entity: {
      kind: 'collection',
      id: model.id,
      label: model.label,
      model: model.id,
      possibleSourcePaths: [
        `content/${model.id}/`,
        `app/models/${model.id}.yml`,
      ],
      notes: `Listing all items of model "${model.id}". Item sources live under content/${model.id}/.`,
    },
  } : null), [model]);
  useRegisterAssistantContext(listAssistantContext);

  useEffect(() => {
    if (schema) {
      setView(createInitialView(schema));
      setSelection([]);
    }
  }, [schema, model?.id]);

  const fields = useMemo(() => {
    if (!schema || !model) return [];
    return buildFieldDefinitions({ schema, model, recordsByModel, includeContentField: false, ImageControl, RepeaterControl, canonical: bootstrap.site });
  }, [schema, model, recordsByModel]);

  const deferredRecords = useDeferredValue(model ? recordsByModel[model.id] ?? [] : []);
  const processed = useMemo(() => {
    if (!view) return { data: [], paginationInfo: { totalItems: 0, totalPages: 0 } };
    return filterSortAndPaginate(deferredRecords, view, fields);
  }, [deferredRecords, fields, view]);

  if (!model || !schema || !view) return <Navigate to="/" replace />;

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Collection</p>
          <h1>{model.label}</h1>
          <p className="screen-header__lede">
            Browse, search, and manage your {model.label.toLowerCase()}.
          </p>
        </div>
        <div className="screen-header__actions">
          <Button variant="primary" onClick={() => navigate(editorRouteForModel(model))}>
            New {model.singularLabel || model.label}
          </Button>
        </div>
      </header>

      <Card className="surface-card">
        <CardBody>
          <DataViews
            data={processed.data}
            fields={fields}
            view={view}
            onChangeView={setView}
            getItemId={(item) => String(item.id)}
            selection={selection}
            onChangeSelection={setSelection}
            paginationInfo={processed.paginationInfo}
            onClickItem={(item) => navigate(editorRouteForModel(model, item.id))}
            isItemClickable={() => true}
            defaultLayouts={{ table: {}, grid: {} }}
            search
            empty={
              <div className="empty-state">
                <h2>No {model.label.toLowerCase()} yet</h2>
                <p>Create your first entry to get started.</p>
                <Button variant="primary" onClick={() => navigate(editorRouteForModel(model))}>
                  Create {model.singularLabel || model.label}
                </Button>
              </div>
            }
          >
            <div className="dataviews-shell">
              <div className="dataviews-toolbar">
                <DataViews.Search label={`Search ${model.label.toLowerCase()}`} />
                <DataViews.FiltersToggle />
                <div className="dataviews-toolbar__spacer" />
                <DataViews.ViewConfig />
                <DataViews.LayoutSwitcher />
              </div>
              <DataViews.FiltersToggled />
              <DataViews.Layout className="dataviews-layout" />
              <div className="dataviews-footer">
                <span>{processed.paginationInfo.totalItems} items</span>
                <DataViews.Pagination />
              </div>
            </div>
          </DataViews>
        </CardBody>
      </Card>
    </div>
  );
}

/* ── Collection Editor Page ── */
export function CollectionEditorPage({ bootstrap, recordsByModel, setRecordsByModel, pushNotice }) {
  const navigate = useNavigate();
  const { collectionPath, itemId } = useParams();
  const model = getModelByCollectionPath(bootstrap.models, collectionPath);
  const schema = model ? bootstrap.adminSchema.forms?.[model.id] : null;
  const existing = model
    ? (recordsByModel[model.id] ?? []).find((item) => String(item.id) === String(itemId))
    : null;
  const editorManaged = Boolean(model?.supports?.includes('editor'));
  const commentsSupported = Boolean(model?.supports?.includes('comments'));
  const [draft, setDraft] = useState(() => existing ?? (model ? createEmptyRecord(model, {
    commentsEnabled: bootstrap.site?.commentsEnabled === true,
    includeCommentStatus: commentsSupported,
  }) : {}));
  const [blocks, setBlocks] = useState(() => blocksFromContent(existing?.content ?? ''));
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [templateRecord, setTemplateRecord] = useState(null);
  const [templateLoaded, setTemplateLoaded] = useState(false);

  // Try to resolve a template for this single entry type.
  useEffect(() => {
    let cancelled = false;
    setTemplateRecord(null);
    setTemplateLoaded(false);

    if (!model || !editorManaged) {
      setTemplateLoaded(true);
      return () => { cancelled = true; };
    }

    async function tryFetch(slug) {
      try {
        return await loadCachedTemplateRecord(slug);
      } catch {
        return null;
      }
    }

    (async () => {
      const candidates = [`single-${model.id}`, 'single'];
      for (const slug of candidates) {
        const template = await tryFetch(slug);
        if (cancelled) return;
        if (template?.content?.raw) {
          setTemplateRecord({
            id: String(template.id ?? ''),
            slug: String(template.slug ?? slug),
            title: template.title?.raw ?? template.title?.rendered ?? slug,
            content: template.content.raw,
            source: 'template-rest',
          });
          break;
        }
      }
      if (!cancelled) setTemplateLoaded(true);
    })();

    return () => { cancelled = true; };
  }, [editorManaged, model?.id]);

  // Re-compose blocks whenever the underlying content or template changes.
  useEffect(() => {
    if (!editorManaged) return;
    const contentBlocks = blocksFromContent(existing?.content ?? '');
    if (templateRecord?.content) {
      const templateBlocks = blocksFromContent(templateRecord.content);
      const composed = composeTemplateEditorBlocks(templateBlocks, contentBlocks);
      setBlocks(composed.blocks);
    } else {
      setBlocks(contentBlocks);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorManaged, existing?.id, existing?.content, templateRecord?.id, templateRecord?.slug]);

  useEffect(() => {
    if (!model) return;
    setDraft(existing ?? createEmptyRecord(model, {
      commentsEnabled: bootstrap.site?.commentsEnabled === true,
      includeCommentStatus: commentsSupported,
    }));
  }, [bootstrap.site?.commentsEnabled, commentsSupported, existing, model]);

  const fields = useMemo(() => {
    if (!schema || !model) return [];
    return buildFieldDefinitions({ schema, model, recordsByModel, includeContentField: !editorManaged, ImageControl, RepeaterControl, canonical: bootstrap.site });
  }, [editorManaged, model, recordsByModel, schema]);

  const metaFields = useMemo(
    () => fields.filter((field) => !['title', 'excerpt', 'content'].includes(field.id)),
    [fields]
  );

  const form = useMemo(() => {
    if (!schema) return null;
    const fieldIds = (editorManaged ? metaFields : fields).map((field) => field.id);
    return buildFormConfig(schema, fieldIds);
  }, [editorManaged, fields, metaFields, schema]);
  const documentLabel = model?.singularLabel
    || (model?.label?.endsWith('s') ? model.label.slice(0, -1) : model?.label)
    || 'Entry';

  async function handleSave(overrides = {}) {
    setIsSaving(true);
    try {
      const isNew = !itemId || itemId === 'new';
      const endpoint = isNew ? `collection/${model.id}` : `collection/${model.id}/${itemId}`;
      const nextDraft = { ...draft, ...overrides };
      let contentSerialized = '';
      if (editorManaged) {
        if (templateRecord) {
          const { pageContentBlocks } = splitTemplateEditorBlocks(blocks);
          contentSerialized = serialize(pageContentBlocks);
        } else {
          contentSerialized = serialize(blocks);
        }
      }
      const payload = await apiFetch(endpoint, {
        method: 'POST',
        body: {
          ...nextDraft,
          featuredMedia: Number(nextDraft.featuredMedia || 0),
          ...(editorManaged ? { content: contentSerialized } : {}),
        },
      });
      setRecordsByModel((current) => {
        const items = current[model.id] ?? [];
        const nextItems = [...items];
        const idx = nextItems.findIndex((item) => String(item.id) === String(payload.item.id));
        if (idx >= 0) nextItems[idx] = payload.item;
        else nextItems.unshift(payload.item);
        return { ...current, [model.id]: nextItems };
      });
      setDraft(payload.item);
      if (editorManaged) {
        const nextContentBlocks = blocksFromContent(payload.item.content ?? '');
        if (templateRecord?.content) {
          const templateBlocks = blocksFromContent(templateRecord.content);
          const composed = composeTemplateEditorBlocks(templateBlocks, nextContentBlocks);
          setBlocks(composed.blocks);
        } else {
          setBlocks(nextContentBlocks);
        }
      }
      pushNotice({ status: 'success', message: `${model.singularLabel || model.label} saved.` });
      if (isNew) {
        startTransition(() => navigate(editorRouteForModel(model, payload.item.id), { replace: true }));
      }
    } catch (error) {
      pushNotice({ status: 'error', message: error.message });
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePublish() {
    await handleSave({ postStatus: 'publish' });
  }

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(existing?.link || window.location.href);
      pushNotice({ status: 'success', message: `${documentLabel} link copied.` });
    } catch {
      pushNotice({ status: 'error', message: `Failed to copy ${documentLabel.toLowerCase()} link.` });
    }
  }

  async function handleDelete() {
    if (!existing || !window.confirm(`Delete ${existing.title || model.singularLabel || model.label}?`)) return;
    setIsDeleting(true);
    try {
      await apiFetch(`collection/${model.id}/${existing.id}`, { method: 'DELETE' });
      setRecordsByModel((current) => ({
        ...current,
        [model.id]: (current[model.id] ?? []).filter((item) => item.id !== existing.id),
      }));
      pushNotice({ status: 'success', message: `${model.singularLabel || model.label} deleted.` });
      navigate(collectionPathForModel(model));
    } catch (error) {
      pushNotice({ status: 'error', message: error.message });
    } finally {
      setIsDeleting(false);
    }
  }

  useEffect(() => {
    function onKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key === 's') {
        event.preventDefault();
        if (!isSaving) handleSave();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const workspaceSurface = useMemo(() => ({
    entityId: itemId ? `${model?.id || 'collection'}:${itemId}` : `${model?.id || 'collection'}:new`,
    entityLabel: documentLabel,
    entityCollectionLabel: model?.label || documentLabel,
    title: draft?.title || `Untitled ${documentLabel}`,
    titlePlaceholder: `Add ${model?.singularLabel || documentLabel} title`,
    status: draft?.postStatus || 'draft',
    saveLabel: 'Save',
    publishLabel: draft?.postStatus === 'publish' ? 'Update' : 'Publish',
    canSave: Boolean(model && schema && form),
    canPublish: Boolean(model && schema && form && editorManaged),
    isSaving,
    setTitle: (value) => {
      setDraft((current) => ({ ...current, title: value }));
    },
    save: model && schema && form ? handleSave : null,
    publish: model && schema && form && editorManaged ? handlePublish : null,
    share: model && schema && form ? handleShare : null,
    moreActions: [
      existing?.link ? {
        title: 'View on site',
        onClick: () => window.open(existing.link, '_blank', 'noopener,noreferrer'),
      } : null,
      existing?.id ? {
        title: 'Open in wp-admin',
        onClick: () => window.open(`/wp-admin/post.php?post=${existing.id}&action=edit`, '_blank', 'noopener,noreferrer'),
      } : null,
      existing ? {
        title: `Delete ${documentLabel}`,
        onClick: handleDelete,
      } : null,
    ].filter(Boolean),
  }), [
    documentLabel,
    draft.postStatus,
    draft.title,
    editorManaged,
    existing,
    handleDelete,
    handlePublish,
    handleSave,
    handleShare,
    isSaving,
    itemId,
    form,
    model?.id,
    model?.label,
    model?.singularLabel,
    schema,
  ]);

  useRegisterWorkspaceSurface(workspaceSurface);

  const isNew = itemId === 'new';
  const sourcePath = existing?.sourcePath || draft?.sourcePath || '';
  const assistantContext = useMemo(() => {
    const hasSource = Boolean(sourcePath);
    const targetPath = hasSource
      ? sourcePath
      : `content/${model?.id || collectionPath}/${draft?.slug || (isNew ? '<new-slug>' : itemId)}.md`;
    let currentContent = '';
    if (editorManaged) {
      try {
        currentContent = blocks?.length ? serialize(blocks) : (existing?.content || '');
      } catch {
        currentContent = existing?.content || '';
      }
    }
    return {
      view: 'collection-editor',
      currentContent,
      entity: {
        kind: 'collection-item',
        id: isNew ? 'new' : itemId,
        label: draft?.title || `Untitled ${model?.singularLabel || model?.label || 'item'}`,
        model: model?.id,
        slug: draft?.slug || undefined,
        sourceFile: hasSource ? sourcePath : null,
        possibleSourcePaths: hasSource ? [sourcePath] : [targetPath],
        notes: hasSource
          ? `Authoritative source for this item is ${sourcePath}. Read and edit that file directly. The wplite://current-page-content resource holds a live snapshot of the rendered markup if you need to compare against the editor state.`
          : `This item has no source file yet. The wplite://current-page-content resource contains the FULL current rendered block markup. To modify it, CREATE ${targetPath} with that content plus the requested change. Do not explore further — you have everything you need.`,
      },
    };
  }, [blocks, collectionPath, draft?.slug, draft?.title, editorManaged, existing?.content, isNew, itemId, model, sourcePath]);
  useRegisterAssistantContext(assistantContext);

  if (!model || !schema || !form) return <Navigate to="/" replace />;

  if (editorManaged) {
    function handleBlocksChange(nextBlocks) {
      setBlocks(nextBlocks);
    }

    const resolveInternalLink = createInternalLinkResolver({ bootstrap, recordsByModel });
    const recordContext = !isNew && model ? {
      postId: draft.id,
      postType: model.postType,
      title: draft.title,
      date: draft.date,
      link: draft.link,
      featuredMedia: draft.featuredMedia,
      heroUrlFieldKey: Object.prototype.hasOwnProperty.call(draft, 'hero_url')
        ? 'hero_url'
        : (Object.prototype.hasOwnProperty.call(draft, 'heroUrl') ? 'heroUrl' : null),
      heroUrl: draft.hero_url || draft.heroUrl || '',
      setField: (field, value) => {
        setDraft((current) => ({ ...current, [field]: value }));
      },
    } : null;

    return (
      <NativeBlockEditorFrame
        label={model.singularLabel || model.label}
        title={draft.title ?? ''}
        titlePlaceholder={`Add ${model.singularLabel || model.label} title`}
        onChangeTitle={(value) => {
          setDraft((current) => ({ ...current, title: value }));
        }}
        showTitleInput={false}
        showBackButton={false}
        showPrimaryAction={false}
        showMoreActions={false}
        blocks={blocks}
        onChangeBlocks={handleBlocksChange}
        backLabel={`Back to ${model.label}`}
        onBack={() => navigate(collectionPathForModel(model))}
        primaryActionLabel="Save Entry"
        onPrimaryAction={handleSave}
        isPrimaryBusy={isSaving}
        viewUrl={draft.link || existing?.link}
        documentLabel={documentLabel}
        canvasLayout={Boolean(templateRecord) ? 'template' : 'content'}
        recordContext={recordContext}
        resolveInternalLink={resolveInternalLink}
        onOpenInternalLink={(path) => navigate(path)}
        wpAdminUrl={existing?.id ? `/wp-admin/post.php?post=${existing.id}&action=edit` : undefined}
        documentSidebar={
          <>
            <PanelBody title="Summary" initialOpen={true}>
              <div className="inline-field-grid">
                <TextControl
                  label="Slug"
                  value={draft.slug ?? ''}
                  onChange={(value) => setDraft((current) => ({ ...current, slug: value }))}
                  __next40pxDefaultSize
                />
                <SelectControl
                  label="Status"
                  value={draft.postStatus ?? 'draft'}
                  options={[
                    { value: 'draft', label: 'Draft' },
                    { value: 'publish', label: 'Published' },
                    { value: 'pending', label: 'Pending Review' },
                    { value: 'private', label: 'Private' },
                  ]}
                  onChange={(value) => setDraft((current) => ({ ...current, postStatus: value }))}
                  __next40pxDefaultSize
                />
              </div>

              {commentsSupported ? (
                <SelectControl
                  label="Comments"
                  value={draft.commentStatus ?? 'closed'}
                  options={[
                    { value: 'closed', label: 'Disabled' },
                    { value: 'open', label: 'Enabled' },
                  ]}
                  onChange={(value) => setDraft((current) => ({ ...current, commentStatus: value }))}
                  help="New entries inherit the Site setting. This entry can override it."
                  __next40pxDefaultSize
                />
              ) : null}

              {model.supports?.includes('excerpt') ? (
                <TextareaControl
                  label="Excerpt"
                  value={draft.excerpt ?? ''}
                  onChange={(value) => {
                    setDraft((current) => ({ ...current, excerpt: value }));
                  }}
                  rows={3}
                />
              ) : null}
            </PanelBody>

            {metaFields.length > 0 ? (
              <PanelBody title="Fields" initialOpen={true}>
                <DataForm
                  data={draft}
                  fields={metaFields}
                  form={form}
                  onChange={(edits) => setDraft((current) => ({ ...current, ...edits }))}
                />
              </PanelBody>
            ) : null}

            {existing?.id ? (
              <PanelBody title="Details" initialOpen={true}>
                <div className="editor-meta">
                  <span>ID: {existing.id}</span>
                  <span>Updated: {formatDateTime(existing.modified)}</span>
                </div>
              </PanelBody>
            ) : null}
          </>
        }
        blockSidebarFooter={existing ? (
          <Button variant="tertiary" isDestructive isBusy={isDeleting} onClick={handleDelete}>
            Delete
          </Button>
        ) : null}
      />
    );
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Editor</p>
          <h1>
            {itemId
              ? draft.title || `Untitled ${model.singularLabel || model.label}`
              : `New ${model.singularLabel || model.label}`}
          </h1>
        </div>
        <div className="screen-header__actions">
          <Button variant="secondary" href={collectionPathForModel(model)}>
            Back to {model.label}
          </Button>
          <Button variant="primary" isBusy={isSaving} onClick={handleSave}>
            Save
          </Button>
        </div>
      </header>

      <section className="editor-flat">
        <div className="editor-flat__toolbar">
          <div className="inline-field-grid">
            <TextControl
              label="Slug"
              value={draft.slug ?? ''}
              onChange={(value) => setDraft((c) => ({ ...c, slug: value }))}
              __next40pxDefaultSize
            />
            <SelectControl
              label="Status"
              value={draft.postStatus ?? 'draft'}
              options={[
                { value: 'draft', label: 'Draft' },
                { value: 'publish', label: 'Published' },
                { value: 'pending', label: 'Pending Review' },
                { value: 'private', label: 'Private' },
              ]}
              onChange={(value) => setDraft((c) => ({ ...c, postStatus: value }))}
              __next40pxDefaultSize
            />
          </div>

          {commentsSupported ? (
            <SelectControl
              label="Comments"
              value={draft.commentStatus ?? 'closed'}
              options={[
                { value: 'closed', label: 'Disabled' },
                { value: 'open', label: 'Enabled' },
              ]}
              onChange={(value) => setDraft((c) => ({ ...c, commentStatus: value }))}
              help="New entries inherit the Site setting. This entry can override it."
              __next40pxDefaultSize
            />
          ) : null}

          {existing?.id && (
            <div className="editor-meta">
              <span>ID: {existing.id}</span>
              <span>Updated: {formatDate(existing.modified)}</span>
            </div>
          )}
        </div>

        {model.supports?.includes('excerpt') && (
          <TextareaControl
            label="Excerpt"
            value={draft.excerpt ?? ''}
            onChange={(value) => setDraft((c) => ({ ...c, excerpt: value }))}
            rows={3}
          />
        )}

        <DataForm
          data={draft}
          fields={fields}
          form={form}
          onChange={(edits) => setDraft((c) => ({ ...c, ...edits }))}
        />

        <div className="editor-flat__footer">
          {existing?.link && (
            <Button variant="secondary" href={existing.link} target="_blank">View on Site</Button>
          )}
          {existing && (
            <Button variant="tertiary" isDestructive isBusy={isDeleting} onClick={handleDelete}>
              Delete
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
