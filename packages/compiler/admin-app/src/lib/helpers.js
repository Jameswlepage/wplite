import { runtimeConfig, wpRestRoot } from './config.js';

export function pluralize(word) {
  const irregular = {
    inquiry: 'inquiries',
    testimonial: 'testimonials',
    project: 'projects',
    experience: 'experiences',
    post: 'posts',
    page: 'pages',
    medium: 'media',
  };
  if (irregular[word]) return irregular[word];
  if (word.endsWith('y')) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
}

export function toTitleCase(value) {
  return String(value)
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function requestJson(baseUrl, endpoint, options = {}) {
  const url = new URL(endpoint.replace(/^\//, ''), baseUrl);
  const headers = {
    ...(runtimeConfig.nonce ? { 'X-WP-Nonce': runtimeConfig.nonce } : {}),
    ...(options.headers ?? {}),
  };
  const body = options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined;

  if (!(options.body instanceof FormData) && body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body,
    credentials: 'same-origin',
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(payload.message || `Request failed with status ${response.status}`);
  }
  return payload;
}

export async function apiFetch(endpoint, options = {}) {
  return requestJson(runtimeConfig.restRoot, endpoint, options);
}

export async function wpApiFetch(endpoint, options = {}) {
  return requestJson(wpRestRoot, endpoint, options);
}

export function collectionPathForModel(model) {
  return `/${model.adminPath || pluralize(model.id)}`;
}

export function editorRouteForModel(model, itemId = 'new') {
  return `${collectionPathForModel(model)}/${itemId}`;
}

export function normalizeOption(value) {
  return { value, label: toTitleCase(value) };
}

export function getModelByCollectionPath(models, collectionPath) {
  return models.find((m) => collectionPathForModel(m).slice(1) === collectionPath) ?? null;
}

export function getRelationLabel(recordsByModel, target, value) {
  if (!target || !value) return '';
  const related = recordsByModel[target] ?? [];
  const match = related.find((item) => String(item.id) === String(value));
  return match?.title || '';
}

export function buildFieldDefinitions({ schema, model, recordsByModel, includeContentField, ImageControl, RepeaterControl }) {
  const filterable = new Set(schema.view?.filters ?? []);
  return (schema.fields ?? [])
    .filter((field) => {
      if (field.id === 'excerpt' && !model.supports?.includes('excerpt')) return false;
      if (field.id === 'content') return includeContentField;
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

      if (field.type === 'datetime') return { ...baseField, type: 'datetime' };
      if (field.type === 'image') return { ...baseField, type: 'integer', Edit: ImageControl };
      if (field.type === 'integer') return { ...baseField, type: 'integer' };
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
      if (field.type === 'email') return { ...baseField, type: 'email' };
      if (field.type === 'url') return { ...baseField, type: 'url' };
      if (field.type === 'richtext') return { ...baseField, type: 'text', Edit: { control: 'textarea', rows: 8 } };
      if (field.type === 'select') {
        return { ...baseField, type: 'text', Edit: 'select', elements: (field.options ?? []).map(normalizeOption) };
      }
      if (field.type === 'relation') {
        return {
          ...baseField,
          type: 'text',
          Edit: 'select',
          getValue: ({ item }) => String(item?.[field.id] ?? ''),
          elements: (recordsByModel[field.target] ?? []).map((item) => ({ value: String(item.id), label: item.title })),
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
            const v = item[field.id];
            return Array.isArray(v) && v.length > 0 ? `${v.length} items` : '—';
          },
        };
      }
      if (field.type === 'array') {
        const values = new Set();
        for (const record of recordsByModel[model.id] ?? []) {
          for (const term of record[field.id] ?? []) values.add(term);
        }
        return {
          ...baseField,
          type: 'array',
          elements: [...values].sort().map((term) => ({ value: term, label: term })),
        };
      }
      return { ...baseField, type: 'text' };
    });
}

export function buildFormConfig(schema, fieldIds) {
  const included = new Set(fieldIds);
  const fields = (schema.form?.children ?? [])
    .map((section) => transformFormNode(section, included, true))
    .filter(Boolean);
  return { layout: { type: 'regular', labelPosition: 'top' }, fields };
}

export function transformFormNode(node, included, isTopLevel = false) {
  if (typeof node === 'string') return included.has(node) ? node : null;
  const children = (node.children ?? []).map((child) => transformFormNode(child, included)).filter(Boolean);
  if (children.length === 0) return null;
  return {
    id: node.id,
    label: node.label,
    layout: isTopLevel
      ? { type: 'card', isOpened: true, isCollapsible: true, summary: [] }
      : { type: 'panel', labelPosition: 'top' },
    children,
  };
}

export function createInitialView(schema) {
  return {
    type: schema.view?.type === 'grid' ? 'grid' : 'table',
    search: '',
    page: 1,
    perPage: 20,
    fields: schema.view?.columns ?? ['title', 'modified'],
    filters: [],
    sort: schema.view?.sort,
    layout: {},
    titleField: 'title',
    descriptionField: 'excerpt',
    showDescription: true,
  };
}

export function createEmptyRecord(model) {
  return {
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    postStatus: model.id === 'inquiry' ? 'publish' : 'draft',
  };
}

export function createEmptySingleton() {
  return {};
}

export function deriveDashboard({ recordsByModel, singletonData, bootstrap }) {
  const projectRecords = recordsByModel.project ?? [];
  const inquiryRecords = [...(recordsByModel.inquiry ?? [])].sort((l, r) =>
    (r.modified ?? '').localeCompare(l.modified ?? '')
  );
  const postRecords = recordsByModel.post ?? [];
  const profile = singletonData.profile ?? {};
  const profileFields = ['full_name', 'role_line', 'short_bio', 'location', 'availability', 'resume_url'];
  const filled = profileFields.filter((f) => {
    const v = profile[f];
    return v !== undefined && v !== null && v !== '';
  }).length;

  // Collection breakdown for content bar
  const collectionBreakdown = bootstrap.models
    .filter((m) => m.type === 'collection')
    .map((m, i) => ({
      id: m.id,
      label: m.label,
      count: (recordsByModel[m.id] ?? []).length,
      hue: (i * 360) / Math.max(bootstrap.models.filter((x) => x.type === 'collection').length, 1),
    }));

  // Total records across all models
  const totalRecords = Object.values(recordsByModel).reduce((sum, arr) => sum + arr.length, 0);

  // Recent activity across all models (last 10 modifications)
  const recentActivity = [];
  for (const model of bootstrap.models) {
    for (const record of recordsByModel[model.id] ?? []) {
      recentActivity.push({
        id: `${model.id}-${record.id}`,
        title: record.title || '(Untitled)',
        modelLabel: model.label,
        modelId: model.id,
        modified: record.modified,
      });
    }
  }
  // Also include posts
  for (const record of postRecords) {
    recentActivity.push({
      id: `post-${record.id}`,
      title: record.title || '(Untitled)',
      modelLabel: 'Posts',
      modelId: 'post',
      modified: record.modified,
    });
  }
  recentActivity.sort((a, b) => (b.modified ?? '').localeCompare(a.modified ?? ''));

  return {
    totalPosts: postRecords.length,
    totalRecords,
    featuredProjects: projectRecords.filter((item) => item.featured).length,
    profileCompleteness: Math.round((filled / profileFields.length) * 100),
    totalCollections: bootstrap.models.filter((m) => m.type === 'collection').length,
    recentInquiries: inquiryRecords.slice(0, 5),
    collectionBreakdown,
    recentActivity: recentActivity.slice(0, 10),
  };
}

export function formatRouteLabel(route) {
  return route.slug ? `/${route.slug}` : '/';
}

export function formatDate(isoString) {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoString;
  }
}

export function formatDateTime(isoString) {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export function formatRelativeTime(isoString) {
  if (!isoString) return 'just now';

  try {
    const then = new Date(isoString).getTime();
    const diff = Date.now() - then;
    const seconds = Math.max(1, Math.round(diff / 1000));
    const units = [
      ['year', 31536000],
      ['month', 2592000],
      ['day', 86400],
      ['hour', 3600],
      ['minute', 60],
    ];

    for (const [unit, size] of units) {
      if (seconds >= size) {
        const value = Math.round(seconds / size);
        return `${value} ${unit}${value === 1 ? '' : 's'} ago`;
      }
    }

    return 'just now';
  } catch {
    return 'recently';
  }
}

export function decodeRenderedText(value) {
  if (!value) return '';
  if (typeof document === 'undefined') {
    return String(value).replace(/<[^>]+>/g, '');
  }
  const div = document.createElement('div');
  div.innerHTML = value;
  return div.textContent || '';
}

export function getStatusBadgeClass(status) {
  const map = {
    publish: 'status-badge--publish',
    draft: 'status-badge--draft',
    pending: 'status-badge--pending',
    private: 'status-badge--private',
    trash: 'status-badge--trash',
  };
  return `status-badge ${map[status] || ''}`;
}

export function normalizePageRecord(page) {
  return {
    id: page.id,
    title: page.title?.raw ?? decodeRenderedText(page.title?.rendered) ?? '',
    slug: page.slug ?? '',
    routeId: page.portfolioRouteId ?? '',
    postStatus: page.status ?? 'draft',
    content: page.content?.raw ?? page.content?.rendered ?? '',
    excerpt: page.excerpt?.raw ?? decodeRenderedText(page.excerpt?.rendered) ?? '',
    parent: page.parent ?? 0,
    template: page.template ?? '',
    menuOrder: page.menu_order ?? 0,
    link: page.link ?? '',
    modified: page.modified ?? '',
  };
}

export function normalizeMediaRecord(item) {
  return {
    id: item.id,
    title: item.title?.raw ?? decodeRenderedText(item.title?.rendered) ?? '',
    altText: item.alt_text ?? '',
    caption: item.caption?.raw ?? decodeRenderedText(item.caption?.rendered) ?? '',
    description: item.description?.raw ?? decodeRenderedText(item.description?.rendered) ?? '',
    mimeType: item.mime_type ?? '',
    sourceUrl: item.source_url ?? '',
    modified: item.modified ?? item.date ?? '',
  };
}

export function normalizeUserRecord(user) {
  return {
    id: user.id,
    name: user.name ?? '',
    username: user.slug ?? '',
    email: user.email ?? '',
    roles: user.roles ?? [],
  };
}
