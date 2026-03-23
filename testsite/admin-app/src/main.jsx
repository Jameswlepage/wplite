import './styles.css';
import '@wordpress/components/build-style/style.css';
import '@wordpress/dataviews/build-style/style.css';
import React, {
  Fragment,
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Notice,
  SelectControl,
  Spinner,
  TextControl,
  TextareaControl,
} from '@wordpress/components';
import { DataForm, DataViews, filterSortAndPaginate } from '@wordpress/dataviews';

const runtimeConfig = window.PORTFOLIO_LIGHT ?? {};
const appBasePath = (() => {
  try {
    const url = new URL(runtimeConfig.appBase ?? '/app', window.location.origin);
    return url.pathname.replace(/\/$/, '') || '/app';
  } catch {
    return '/app';
  }
})();

function pluralize(word) {
  const irregular = {
    inquiry: 'inquiries',
    testimonial: 'testimonials',
    project: 'projects',
    experience: 'experiences',
    post: 'posts',
  };

  if (irregular[word]) {
    return irregular[word];
  }

  if (word.endsWith('y')) {
    return `${word.slice(0, -1)}ies`;
  }

  return `${word}s`;
}

function toTitleCase(value) {
  return String(value)
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

async function apiFetch(endpoint, options = {}) {
  const url = new URL(endpoint.replace(/^\//, ''), runtimeConfig.restRoot);
  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(runtimeConfig.nonce ? { 'X-WP-Nonce': runtimeConfig.nonce } : {}),
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: 'same-origin',
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || `Request failed with status ${response.status}`);
  }

  return payload;
}

function collectionPathForModel(model) {
  return `/${model.adminPath || pluralize(model.id)}`;
}

function editorRouteForModel(model, itemId = 'new') {
  return `${collectionPathForModel(model)}/${itemId}`;
}

function wpAdminUrl(pathname, params = {}) {
  const url = new URL(pathname, `${window.location.origin}/wp-admin/`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  url.searchParams.set('classic-admin', '1');

  return url.toString();
}

function buildEditorUrl(model, itemId) {
  if (!itemId) {
    return wpAdminUrl('post-new.php', { post_type: model.postType });
  }

  return wpAdminUrl('post.php', { post: itemId, action: 'edit' });
}

function normalizeOption(value) {
  return {
    value,
    label: toTitleCase(value),
  };
}

function getModelByCollectionPath(models, collectionPath) {
  return models.find((model) => collectionPathForModel(model).slice(1) === collectionPath) ?? null;
}

function getRelationLabel(recordsByModel, target, value) {
  if (!target || !value) {
    return '';
  }

  const related = recordsByModel[target] ?? [];
  const match = related.find((item) => String(item.id) === String(value));
  return match?.title || '';
}

function buildFieldDefinitions({ schema, model, recordsByModel, includeContentField }) {
  const filterable = new Set(schema.view?.filters ?? []);

  return (schema.fields ?? [])
    .filter((field) => {
      if (field.id === 'excerpt' && !model.supports?.includes('excerpt')) {
        return false;
      }

      if (field.id === 'content') {
        return includeContentField;
      }

      return true;
    })
    .map((field) => {
      const baseField = {
        id: field.id,
        label: field.label,
        enableGlobalSearch: ['title', 'excerpt'].includes(field.id),
        enableSorting: !['repeater', 'array', 'richtext'].includes(field.type),
        enableHiding: field.id !== 'title',
        getValue: ({ item }) => item?.[field.id],
        setValue: ({ value }) => ({ [field.id]: value }),
        filterBy: filterable.has(field.id) ? {} : false,
      };

      if (field.type === 'datetime') {
        return {
          ...baseField,
          type: 'datetime',
        };
      }

      if (field.type === 'integer' || field.type === 'image') {
        return {
          ...baseField,
          type: 'integer',
        };
      }

      if (field.type === 'boolean') {
        return {
          ...baseField,
          type: 'boolean',
          elements: [
            { value: true, label: 'True' },
            { value: false, label: 'False' },
          ],
        };
      }

      if (field.type === 'email') {
        return {
          ...baseField,
          type: 'email',
        };
      }

      if (field.type === 'url') {
        return {
          ...baseField,
          type: 'url',
        };
      }

      if (field.type === 'richtext') {
        return {
          ...baseField,
          type: 'text',
          Edit: { control: 'textarea', rows: 8 },
        };
      }

      if (field.type === 'select') {
        return {
          ...baseField,
          type: 'text',
          Edit: 'select',
          elements: (field.options ?? []).map(normalizeOption),
        };
      }

      if (field.type === 'relation') {
        return {
          ...baseField,
          type: 'text',
          Edit: 'select',
          getValue: ({ item }) => String(item?.[field.id] ?? ''),
          elements: (recordsByModel[field.target] ?? []).map((item) => ({
            value: String(item.id),
            label: item.title,
          })),
          render: ({ item }) => getRelationLabel(recordsByModel, field.target, item[field.id]) || '—',
        };
      }

      if (field.type === 'repeater') {
        return {
          ...baseField,
          type: 'text',
          itemSchema: field.item,
          Edit: RepeaterControl,
          render: ({ item }) => {
            const value = item[field.id];
            return Array.isArray(value) && value.length > 0 ? `${value.length} items` : '—';
          },
        };
      }

      if (field.type === 'array') {
        const values = new Set();

        for (const record of recordsByModel[model.id] ?? []) {
          for (const term of record[field.id] ?? []) {
            values.add(term);
          }
        }

        return {
          ...baseField,
          type: 'array',
          elements: [...values].sort().map((term) => ({
            value: term,
            label: term,
          })),
        };
      }

      return {
        ...baseField,
        type: 'text',
      };
    });
}

function buildFormConfig(schema, fieldIds) {
  const included = new Set(fieldIds);
  const fields = (schema.form?.children ?? [])
    .map((section) => transformFormNode(section, included, true))
    .filter(Boolean);

  return {
    layout: { type: 'regular', labelPosition: 'top' },
    fields,
  };
}

function transformFormNode(node, included, isTopLevel = false) {
  if (typeof node === 'string') {
    return included.has(node) ? node : null;
  }

  const children = (node.children ?? [])
    .map((child) => transformFormNode(child, included))
    .filter(Boolean);

  if (children.length === 0) {
    return null;
  }

  return {
    id: node.id,
    label: node.label,
    layout: isTopLevel
      ? {
          type: 'card',
          isOpened: true,
          isCollapsible: true,
          summary: [],
        }
      : {
          type: 'panel',
          labelPosition: 'top',
        },
    children,
  };
}

function createInitialView(schema) {
  return {
    type: schema.view?.type === 'grid' ? 'grid' : 'table',
    search: '',
    page: 1,
    perPage: 10,
    fields: schema.view?.columns ?? ['title', 'modified'],
    filters: [],
    sort: schema.view?.sort,
    layout: {},
    titleField: 'title',
    descriptionField: 'excerpt',
    showDescription: true,
  };
}

function createEmptyRecord(model) {
  return {
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    postStatus: model.id === 'inquiry' ? 'publish' : 'draft',
  };
}

function createEmptySingleton() {
  return {};
}

function deriveDashboard({ recordsByModel, singletonData }) {
  const projectRecords = recordsByModel.project ?? [];
  const inquiryRecords = [...(recordsByModel.inquiry ?? [])].sort((left, right) =>
    (right.modified ?? '').localeCompare(left.modified ?? '')
  );
  const profile = singletonData.profile ?? {};
  const profileFields = ['full_name', 'role_line', 'short_bio', 'location', 'availability', 'resume_url'];
  const filled = profileFields.filter((field) => {
    const value = profile[field];
    return value !== undefined && value !== null && value !== '';
  }).length;

  return {
    featuredProjects: projectRecords.filter((item) => item.featured).length,
    profileCompleteness: Math.round((filled / profileFields.length) * 100),
    recentInquiries: inquiryRecords.slice(0, 5),
  };
}

function formatRouteLabel(route) {
  return route.slug ? `/${route.slug}` : '/';
}

function RepeaterControl({ data, field, onChange }) {
  const value = field.getValue({ item: data }) ?? [];
  const itemSchema = field.itemSchema ?? {
    label: { type: 'text' },
    value: { type: 'text' },
  };
  const keys = Object.keys(itemSchema);

  function commit(nextValue) {
    onChange(field.setValue({ item: data, value: nextValue }));
  }

  function updateRow(rowIndex, key, next) {
    const nextValue = value.map((row, index) =>
      index === rowIndex ? { ...row, [key]: next } : row
    );
    commit(nextValue);
  }

  function addRow() {
    const nextRow = Object.fromEntries(keys.map((key) => [key, '']));
    commit([...(Array.isArray(value) ? value : []), nextRow]);
  }

  function removeRow(rowIndex) {
    commit(value.filter((_, index) => index !== rowIndex));
  }

  return (
    <div className="repeater-control">
      <div className="repeater-control__header">
        <strong>{field.label}</strong>
        <Button variant="secondary" size="compact" onClick={addRow}>
          Add Row
        </Button>
      </div>
      {value.length === 0 ? (
        <p className="field-hint">No rows yet. Add a row to capture structured metrics.</p>
      ) : null}
      {value.map((row, rowIndex) => (
        <div className="repeater-control__row" key={`${field.id}-${rowIndex}`}>
          {keys.map((key) => (
            <TextControl
              key={key}
              label={itemSchema[key]?.label ?? toTitleCase(key)}
              value={row?.[key] ?? ''}
              onChange={(next) => updateRow(rowIndex, key, next)}
              __next40pxDefaultSize
            />
          ))}
          <Button
            className="repeater-control__remove"
            variant="tertiary"
            isDestructive
            onClick={() => removeRow(rowIndex)}
          >
            Remove
          </Button>
        </div>
      ))}
    </div>
  );
}

function NoticeStack({ notices, onDismiss }) {
  if (notices.length === 0) {
    return null;
  }

  return (
    <div className="notice-stack">
      {notices.map((notice) => (
        <Notice
          key={notice.id}
          status={notice.status}
          isDismissible
          onRemove={() => onDismiss(notice.id)}
        >
          <p>{notice.message}</p>
        </Notice>
      ))}
    </div>
  );
}

function DashboardPage({ bootstrap, recordsByModel, singletonData }) {
  const dashboard = useMemo(
    () => deriveDashboard({ recordsByModel, singletonData }),
    [recordsByModel, singletonData]
  );

  return (
    <div className="screen">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">wp-light runtime</p>
          <h1>{bootstrap.site.title}</h1>
          <p className="hero-panel__lede">
            {bootstrap.site.tagline}. The authored layer stays flat, while the admin app renders
            collections through DataViews and settings through DataForm.
          </p>
        </div>
        <div className="hero-panel__grid">
          <MetricCard label="Featured projects" value={dashboard.featuredProjects} />
          <MetricCard label="Profile completeness" value={`${dashboard.profileCompleteness}%`} />
          <MetricCard label="Collections" value={bootstrap.models.length} />
        </div>
      </section>

      <section className="dashboard-grid">
        <Card className="surface-card">
          <CardHeader>
            <h2>How It Fits Together</h2>
          </CardHeader>
          <CardBody>
            <div className="concept-grid">
              <ConceptTile title="Models" body="Collections become post types, meta, taxonomies, and DataViews." />
              <ConceptTile title="Singletons" body="Singletons are settings. They compile into DataForm-backed option panels." />
              <ConceptTile title="Routes" body="Routes create page shells and template assignments. They are site structure, not long-form content." />
              <ConceptTile title="Theme + Blocks" body="The public site is still a block theme using patterns, templates, and dynamic bindings." />
            </div>
          </CardBody>
        </Card>

        <Card className="surface-card">
          <CardHeader>
            <h2>Recent Inquiries</h2>
          </CardHeader>
          <CardBody>
            {dashboard.recentInquiries.length === 0 ? (
              <p className="field-hint">No inquiries yet.</p>
            ) : (
              <ul className="simple-list">
                {dashboard.recentInquiries.map((item) => (
                  <li key={item.id}>
                    <strong>{item.title}</strong>
                    <span>{item.email || item.company || item.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card className="surface-card">
          <CardHeader>
            <h2>Routes</h2>
          </CardHeader>
          <CardBody>
            <ul className="simple-list">
              {bootstrap.routes.map((route) => (
                <li key={route.id}>
                  <strong>{route.title}</strong>
                  <span>
                    {formatRouteLabel(route)} · template `{route.template}`
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card className="surface-card">
          <CardHeader>
            <h2>Primary Menu</h2>
          </CardHeader>
          <CardBody>
            <ul className="simple-list">
              {(bootstrap.menus.primary ?? []).map((item, index) => (
                <li key={`${item.label}-${index}`}>
                  <strong>{item.label}</strong>
                  <span>{item.type}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ConceptTile({ title, body }) {
  return (
    <div className="concept-tile">
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function CollectionListPage({ bootstrap, recordsByModel }) {
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
    if (!schema || !model) {
      return [];
    }

    return buildFieldDefinitions({
      schema,
      model,
      recordsByModel,
      includeContentField: false,
    });
  }, [schema, model, recordsByModel]);

  const deferredRecords = useDeferredValue(model ? recordsByModel[model.id] ?? [] : []);
  const processed = useMemo(() => {
    if (!view) {
      return { data: [], paginationInfo: { totalItems: 0, totalPages: 0 } };
    }

    return filterSortAndPaginate(deferredRecords, view, fields);
  }, [deferredRecords, fields, view]);

  if (!model || !schema || !view) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Collection</p>
          <h1>{model.label}</h1>
          <p className="screen-header__lede">
            Generated from `app/models/{model.id}.json`, rendered here through DataViews.
          </p>
        </div>
        <div className="screen-header__actions">
          <Button variant="secondary" href={buildEditorUrl(model)}>
            New In Gutenberg
          </Button>
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
                <p>Start with metadata in the generated admin, then move into Gutenberg for body content.</p>
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

function CollectionEditorPage({
  bootstrap,
  recordsByModel,
  setRecordsByModel,
  pushNotice,
}) {
  const navigate = useNavigate();
  const { collectionPath, itemId } = useParams();
  const model = getModelByCollectionPath(bootstrap.models, collectionPath);
  const schema = model ? bootstrap.adminSchema.forms?.[model.id] : null;
  const existing = model
    ? (recordsByModel[model.id] ?? []).find((item) => String(item.id) === String(itemId))
    : null;

  const editorManaged = Boolean(model?.supports?.includes('editor'));
  const [draft, setDraft] = useState(() => existing ?? (model ? createEmptyRecord(model) : {}));
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!model) {
      return;
    }

    setDraft(existing ?? createEmptyRecord(model));
  }, [existing, model]);

  const fields = useMemo(() => {
    if (!schema || !model) {
      return [];
    }

    return buildFieldDefinitions({
      schema,
      model,
      recordsByModel,
      includeContentField: !editorManaged,
    });
  }, [editorManaged, model, recordsByModel, schema]);

  const form = useMemo(() => {
    if (!schema) {
      return null;
    }

    return buildFormConfig(
      schema,
      fields.map((field) => field.id)
    );
  }, [fields, schema]);

  if (!model || !schema || !form) {
    return <Navigate to="/" replace />;
  }

  async function handleSave() {
    setIsSaving(true);

    try {
      const endpoint = itemId ? `collection/${model.id}/${itemId}` : `collection/${model.id}`;
      const payload = await apiFetch(endpoint, {
        method: 'POST',
        body: draft,
      });

      setRecordsByModel((current) => {
        const items = current[model.id] ?? [];
        const nextItems = [...items];
        const index = nextItems.findIndex((item) => String(item.id) === String(payload.item.id));

        if (index >= 0) {
          nextItems[index] = payload.item;
        } else {
          nextItems.unshift(payload.item);
        }

        return {
          ...current,
          [model.id]: nextItems,
        };
      });

      setDraft(payload.item);
      pushNotice({
        status: 'success',
        message: `${model.singularLabel || model.label} saved.`,
      });

      if (!itemId) {
        startTransition(() => {
          navigate(editorRouteForModel(model, payload.item.id), { replace: true });
        });
      }
    } catch (error) {
      pushNotice({
        status: 'error',
        message: error.message,
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!existing || !window.confirm(`Delete ${existing.title || model.singularLabel || model.label}?`)) {
      return;
    }

    setIsDeleting(true);

    try {
      await apiFetch(`collection/${model.id}/${existing.id}`, { method: 'DELETE' });
      setRecordsByModel((current) => ({
        ...current,
        [model.id]: (current[model.id] ?? []).filter((item) => item.id !== existing.id),
      }));
      pushNotice({
        status: 'success',
        message: `${model.singularLabel || model.label} deleted.`,
      });
      navigate(collectionPathForModel(model));
    } catch (error) {
      pushNotice({
        status: 'error',
        message: error.message,
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Editor</p>
          <h1>{itemId ? draft.title || `Untitled ${model.singularLabel || model.label}` : `New ${model.singularLabel || model.label}`}</h1>
          <p className="screen-header__lede">
            Metadata lives here in DataForm. Body content stays in the Gutenberg block editor.
          </p>
        </div>
        <div className="screen-header__actions">
          <Button variant="secondary" href={collectionPathForModel(model)}>
            Back To {model.label}
          </Button>
          <Button variant="primary" isBusy={isSaving} onClick={handleSave}>
            Save
          </Button>
        </div>
      </header>

      <section className="editor-grid">
        <Card className="surface-card">
          <CardHeader>
            <h2>Entry Settings</h2>
          </CardHeader>
          <CardBody>
            <div className="inline-field-grid">
              <TextControl
                label="Slug"
                value={draft.slug ?? ''}
                onChange={(value) => setDraft((current) => ({ ...current, slug: value }))}
                __next40pxDefaultSize
              />
              <SelectControl
                label="Post Status"
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
                onChange={(value) => setDraft((current) => ({ ...current, excerpt: value }))}
                rows={4}
              />
            ) : null}

            <DataForm
              data={draft}
              fields={fields}
              form={form}
              onChange={(edits) => setDraft((current) => ({ ...current, ...edits }))}
            />
          </CardBody>
        </Card>

        <Card className="surface-card accent-card">
          <CardHeader>
            <h2>Block Editor</h2>
          </CardHeader>
          <CardBody>
            {editorManaged ? (
              <Fragment>
                <p className="field-hint">
                  Long-form content is intentionally handed off to Gutenberg so the generated admin
                  stays focused on structured fields and list management.
                </p>
                <Button
                  variant="primary"
                  href={buildEditorUrl(model, existing?.id)}
                  disabled={!existing?.id}
                >
                  {existing?.id ? 'Open Gutenberg Editor' : 'Save First To Open Gutenberg'}
                </Button>
              </Fragment>
            ) : (
              <p className="field-hint">This collection does not use the block editor.</p>
            )}

            {existing?.link ? (
              <div className="editor-links">
                <Button variant="secondary" href={existing.link} target="_blank">
                  View On Site
                </Button>
              </div>
            ) : null}

            {existing?.id ? (
              <div className="editor-meta">
                <span>Record ID: {existing.id}</span>
                <span>Updated: {existing.modified}</span>
              </div>
            ) : null}

            {existing ? (
              <Button
                variant="tertiary"
                isDestructive
                isBusy={isDeleting}
                onClick={handleDelete}
              >
                Delete Entry
              </Button>
            ) : null}
          </CardBody>
        </Card>
      </section>
    </div>
  );
}

function SingletonEditorPage({ bootstrap, singletonData, setSingletonData, pushNotice }) {
  const { singletonId } = useParams();
  const singleton = bootstrap.singletons.find((item) => item.id === singletonId) ?? null;
  const schema = singleton ? bootstrap.adminSchema.forms?.[singleton.id] : null;
  const [draft, setDraft] = useState(() => (singleton ? singletonData[singleton.id] ?? createEmptySingleton() : {}));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (singleton) {
      setDraft(singletonData[singleton.id] ?? createEmptySingleton());
    }
  }, [singleton, singletonData]);

  const pseudoModel = useMemo(
    () => ({
      ...singleton,
      supports: [],
    }),
    [singleton]
  );

  const fields = useMemo(() => {
    if (!schema || !pseudoModel) {
      return [];
    }

    return buildFieldDefinitions({
      schema,
      model: pseudoModel,
      recordsByModel: {},
      includeContentField: true,
    });
  }, [pseudoModel, schema, singletonData]);

  const form = useMemo(() => {
    if (!schema) {
      return null;
    }

    return buildFormConfig(
      schema,
      fields.map((field) => field.id)
    );
  }, [fields, schema]);

  if (!singleton || !schema || !form) {
    return <Navigate to="/" replace />;
  }

  async function handleSave() {
    setIsSaving(true);

    try {
      const payload = await apiFetch(`singleton/${singleton.id}`, {
        method: 'POST',
        body: draft,
      });

      setSingletonData((current) => ({
        ...current,
        [singleton.id]: payload.item,
      }));
      pushNotice({
        status: 'success',
        message: `${singleton.label} saved.`,
      });
    } catch (error) {
      pushNotice({
        status: 'error',
        message: error.message,
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Singleton</p>
          <h1>{singleton.label}</h1>
          <p className="screen-header__lede">
            Singletons are settings surfaces. They compile from `app/singletons/*` into DataForm
            panels backed by options.
          </p>
        </div>
        <div className="screen-header__actions">
          <Button variant="primary" isBusy={isSaving} onClick={handleSave}>
            Save Settings
          </Button>
        </div>
      </header>

      <Card className="surface-card">
        <CardBody>
          <DataForm
            data={draft}
            fields={fields}
            form={form}
            onChange={(edits) => setDraft((current) => ({ ...current, ...edits }))}
          />
        </CardBody>
      </Card>
    </div>
  );
}

function NotFoundScreen() {
  return (
    <div className="screen">
      <Card className="surface-card">
        <CardBody>
          <h1>Not Found</h1>
          <p className="field-hint">This admin route does not exist in the generated runtime.</p>
        </CardBody>
      </Card>
    </div>
  );
}

function AppShell({ bootstrap, recordsByModel, setRecordsByModel, singletonData, setSingletonData }) {
  const [notices, setNotices] = useState([]);
  const location = useLocation();

  function pushNotice(notice) {
    const id = Date.now() + Math.random();
    setNotices((current) => [...current, { id, ...notice }]);
  }

  function dismissNotice(id) {
    setNotices((current) => current.filter((notice) => notice.id !== id));
  }

  const groupedNavigation = useMemo(() => {
    return {
      workspace: bootstrap.navigation.filter((item) => item.kind === 'dashboard'),
      collections: bootstrap.navigation.filter((item) => item.kind === 'collection'),
      settings: bootstrap.navigation.filter((item) => item.kind === 'singleton'),
    };
  }, [bootstrap.navigation]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <p className="eyebrow">generated admin</p>
          <h1>{bootstrap.site.title}</h1>
          <p>{bootstrap.site.tagline}</p>
        </div>

        <nav className="sidebar__nav">
          <NavigationSection title="Workspace" items={groupedNavigation.workspace} />
          <NavigationSection title="Collections" items={groupedNavigation.collections} />
          <NavigationSection title="Settings" items={groupedNavigation.settings} />
        </nav>

        <div className="sidebar__footer">
          <Button variant="secondary" href="/" target="_blank">
            View Site
          </Button>
          <Button variant="tertiary" href={wpAdminUrl('index.php')}>
            WordPress Fallback
          </Button>
        </div>
      </aside>

      <main className="main-panel">
        <div className="main-panel__topline">
          <span>{location.pathname === '/' ? 'Dashboard' : location.pathname.replace(/\//g, ' / ')}</span>
        </div>
        <NoticeStack notices={notices} onDismiss={dismissNotice} />
        <Routes>
          <Route
            path="/"
            element={
              <DashboardPage
                bootstrap={bootstrap}
                recordsByModel={recordsByModel}
                singletonData={singletonData}
              />
            }
          />
          <Route
            path="/:collectionPath"
            element={<CollectionListPage bootstrap={bootstrap} recordsByModel={recordsByModel} />}
          />
          <Route
            path="/:collectionPath/:itemId"
            element={
              <CollectionEditorPage
                bootstrap={bootstrap}
                recordsByModel={recordsByModel}
                setRecordsByModel={setRecordsByModel}
                pushNotice={pushNotice}
              />
            }
          />
          <Route
            path="/settings/:singletonId"
            element={
              <SingletonEditorPage
                bootstrap={bootstrap}
                singletonData={singletonData}
                setSingletonData={setSingletonData}
                pushNotice={pushNotice}
              />
            }
          />
          <Route path="*" element={<NotFoundScreen />} />
        </Routes>
      </main>
    </div>
  );
}

function NavigationSection({ title, items }) {
  if (!items.length) {
    return null;
  }

  return (
    <section className="navigation-section">
      <p className="navigation-section__title">{title}</p>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <NavLink to={item.path} end={item.path === '/'} className={({ isActive }) => (isActive ? 'nav-link is-active' : 'nav-link')}>
              <span>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

function App() {
  const [bootstrap, setBootstrap] = useState(null);
  const [recordsByModel, setRecordsByModel] = useState({});
  const [singletonData, setSingletonData] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const payload = await apiFetch('bootstrap');
        if (cancelled) {
          return;
        }

        setBootstrap(payload);
        setRecordsByModel(payload.records ?? {});
        setSingletonData(payload.singletonData ?? {});
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="app-loading">
        <Card className="surface-card">
          <CardBody>
            <h1>Admin Failed To Load</h1>
            <p>{error.message}</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (!bootstrap) {
    return (
      <div className="app-loading">
        <Spinner />
        <p>Loading generated schema and records…</p>
      </div>
    );
  }

  return (
    <BrowserRouter basename={appBasePath}>
      <AppShell
        bootstrap={bootstrap}
        recordsByModel={recordsByModel}
        setRecordsByModel={setRecordsByModel}
        singletonData={singletonData}
        setSingletonData={setSingletonData}
      />
    </BrowserRouter>
  );
}

const root = createRoot(document.getElementById('portfolio-admin-root'));
root.render(<App />);
