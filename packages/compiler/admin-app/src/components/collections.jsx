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
import { blocksFromContent } from '../lib/blocks.jsx';
import { ImageControl, RepeaterControl } from './controls.jsx';
import { NativeBlockEditorFrame } from './block-editor.jsx';

/* ── Collection List Page ── */
export function CollectionListPage({ bootstrap, recordsByModel }) {
  const navigate = useNavigate();
  const { collectionPath } = useParams();
  const model = getModelByCollectionPath(bootstrap.models, collectionPath);
  const schema = model ? bootstrap.adminSchema.views?.[model.id] : null;
  const [view, setView] = useState(() => (schema ? createInitialView(schema) : null));
  const [selection, setSelection] = useState([]);

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

  useEffect(() => {
    if (!model) return;
    setDraft(existing ?? createEmptyRecord(model, {
      commentsEnabled: bootstrap.site?.commentsEnabled === true,
      includeCommentStatus: commentsSupported,
    }));
  }, [bootstrap.site?.commentsEnabled, commentsSupported, existing, model]);

  // Reset the block tree when we navigate to a different record so blocks
  // don't stay stuck on the previous entry's content.
  useEffect(() => {
    if (!editorManaged) return;
    setBlocks(blocksFromContent(existing?.content ?? ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorManaged, existing?.id, existing?.content]);

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
  const documentLabel = model.singularLabel
    || (model.label?.endsWith('s') ? model.label.slice(0, -1) : model.label)
    || 'Entry';

  if (!model || !schema || !form) return <Navigate to="/" replace />;

  async function handleSave() {
    setIsSaving(true);
    try {
      const isNew = !itemId || itemId === 'new';
      const endpoint = isNew ? `collection/${model.id}` : `collection/${model.id}/${itemId}`;
      const payload = await apiFetch(endpoint, {
        method: 'POST',
        body: {
          ...draft,
          ...(editorManaged
            ? {
              content: serialize(blocks),
            }
            : {}),
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
        setBlocks(blocksFromContent(payload.item.content ?? ''));
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

  if (editorManaged) {
    function handleBlocksChange(nextBlocks) {
      setBlocks(nextBlocks);
    }

    return (
      <NativeBlockEditorFrame
        label={model.singularLabel || model.label}
        title={draft.title ?? ''}
        titlePlaceholder={`Add ${model.singularLabel || model.label} title`}
        onChangeTitle={(value) => {
          setDraft((current) => ({ ...current, title: value }));
        }}
        showTitleInput={true}
        blocks={blocks}
        onChangeBlocks={handleBlocksChange}
        backLabel={`Back to ${model.label}`}
        onBack={() => navigate(collectionPathForModel(model))}
        primaryActionLabel="Save Entry"
        onPrimaryAction={handleSave}
        isPrimaryBusy={isSaving}
        viewUrl={existing?.link}
        documentLabel={documentLabel}
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
