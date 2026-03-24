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
import {
  buildEditorPreviewBlocks,
  blocksFromContent,
  extractContentSlotBlocks,
  extractTemplatePreviewExcerpt,
  extractTemplatePreviewTitle,
  getTemplatePreviewDiagnostics,
  syncTemplatePreviewBlocks,
} from '../lib/blocks.jsx';
import { ImageControl, RepeaterControl } from './controls.jsx';
import { NativeBlockEditorFrame } from './block-editor.jsx';

function resolveModelTemplateMarkup(bootstrap, model) {
  return bootstrap?.editorTemplates?.postTypes?.[model?.postType]?.markup ?? '';
}

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
    return buildFieldDefinitions({ schema, model, recordsByModel, includeContentField: false, ImageControl, RepeaterControl });
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
  const [draft, setDraft] = useState(() => existing ?? (model ? createEmptyRecord(model) : {}));
  const [blocks, setBlocks] = useState(() => blocksFromContent(existing?.content ?? ''));
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!model) return;
    setDraft(existing ?? createEmptyRecord(model));
  }, [existing, model]);

  const fields = useMemo(() => {
    if (!schema || !model) return [];
    return buildFieldDefinitions({ schema, model, recordsByModel, includeContentField: !editorManaged, ImageControl, RepeaterControl });
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
  const templateMarkup = useMemo(
    () => resolveModelTemplateMarkup(bootstrap, model),
    [bootstrap, model]
  );
  const templatePreviewDiagnostics = useMemo(
    () => getTemplatePreviewDiagnostics(templateMarkup),
    [templateMarkup]
  );
  const usesTemplatePreview = Boolean(templateMarkup) && templatePreviewDiagnostics.compatible;

  useEffect(() => {
    if (!editorManaged || !model) return;

    const sourceRecord = existing ?? createEmptyRecord(model);
    setBlocks(
      buildEditorPreviewBlocks({
        templateMarkup: usesTemplatePreview ? templateMarkup : '',
        content: sourceRecord.content ?? '',
        title: sourceRecord.title ?? '',
        excerpt: sourceRecord.excerpt ?? '',
        siteTitle: bootstrap?.site?.title ?? '',
        siteTagline: bootstrap?.site?.tagline ?? '',
      })
    );
  }, [bootstrap, editorManaged, existing, model, templateMarkup, usesTemplatePreview]);

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
              content: usesTemplatePreview
                ? serialize(extractContentSlotBlocks(blocks))
                : serialize(blocks),
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
        const payloadTemplateMarkup = resolveModelTemplateMarkup(bootstrap, model);
        const payloadUsesTemplatePreview = Boolean(payloadTemplateMarkup)
          && getTemplatePreviewDiagnostics(payloadTemplateMarkup).compatible;
        setBlocks(
          buildEditorPreviewBlocks({
            templateMarkup: payloadUsesTemplatePreview ? payloadTemplateMarkup : '',
            content: payload.item.content ?? '',
            title: payload.item.title ?? '',
            excerpt: payload.item.excerpt ?? '',
            siteTitle: bootstrap?.site?.title ?? '',
            siteTagline: bootstrap?.site?.tagline ?? '',
          })
        );
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

  if (editorManaged) {
    function handleBlocksChange(nextBlocks) {
      setBlocks(nextBlocks);

      if (!usesTemplatePreview) {
        return;
      }

      const previewTitle = extractTemplatePreviewTitle(nextBlocks);
      const previewExcerpt = extractTemplatePreviewExcerpt(nextBlocks);

      setDraft((current) => ({
        ...current,
        ...(previewTitle !== null ? { title: previewTitle } : {}),
        ...(previewExcerpt !== null ? { excerpt: previewExcerpt } : {}),
      }));
    }

    return (
      <NativeBlockEditorFrame
        label={model.singularLabel || model.label}
        title={draft.title ?? ''}
        titlePlaceholder={`Add ${model.singularLabel || model.label} title`}
        onChangeTitle={(value) => {
          setDraft((current) => ({ ...current, title: value }));
          setBlocks((current) => syncTemplatePreviewBlocks(current, { title: value, excerpt: draft.excerpt }));
        }}
        showTitleInput={!usesTemplatePreview}
        blocks={blocks}
        onChangeBlocks={handleBlocksChange}
        backLabel={`Back to ${model.label}`}
        onBack={() => navigate(collectionPathForModel(model))}
        primaryActionLabel="Save Entry"
        onPrimaryAction={handleSave}
        isPrimaryBusy={isSaving}
        viewUrl={existing?.link}
        documentLabel={documentLabel}
        themeJson={bootstrap.themeJson}
        themeCss={bootstrap.themeCss}
        documentSidebar={
          <div className="native-editor__document-panels">
            <div className="sidebar-section">
              <div className="sidebar-section__label">Summary</div>
              <div className="sidebar-section__body">
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

                {model.supports?.includes('excerpt') ? (
                  <TextareaControl
                    label="Excerpt"
                    value={draft.excerpt ?? ''}
                    onChange={(value) => {
                      setDraft((current) => ({ ...current, excerpt: value }));
                      setBlocks((current) => syncTemplatePreviewBlocks(current, { title: draft.title, excerpt: value }));
                    }}
                    rows={3}
                  />
                ) : null}
              </div>
            </div>

            {metaFields.length > 0 ? (
              <div className="sidebar-section">
                <div className="sidebar-section__label">Fields</div>
                <div className="sidebar-section__body">
                  <DataForm
                    data={draft}
                    fields={metaFields}
                    form={form}
                    onChange={(edits) => setDraft((current) => ({ ...current, ...edits }))}
                  />
                </div>
              </div>
            ) : null}

            {existing?.id ? (
              <div className="sidebar-section">
                <div className="sidebar-section__label">Details</div>
                <div className="sidebar-section__body">
                  <div className="editor-meta">
                    <span>ID: {existing.id}</span>
                    <span>Updated: {formatDateTime(existing.modified)}</span>
                  </div>
                  {!usesTemplatePreview && templateMarkup ? (
                    <p className="field-hint">
                      This entry template includes site-editor blocks like navigation, query
                      loops, or template parts. The app editor is editing post content only for
                      now.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        }
        blockSidebarFooter={existing ? (
          <div className="sidebar-section">
            <Button variant="tertiary" isDestructive isBusy={isDeleting} onClick={handleDelete}>
              Delete
            </Button>
          </div>
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
