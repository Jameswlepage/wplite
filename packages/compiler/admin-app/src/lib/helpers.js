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

function parseJsonResponseText(text) {
  if (!text) {
    return {};
  }

  const trimmed = text.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return JSON.parse(trimmed);
  }

  const candidates = [text.indexOf('{'), text.indexOf('[')]
    .filter((index) => index >= 0)
    .sort((left, right) => left - right);

  for (const index of candidates) {
    const candidate = text.slice(index).trimStart();
    if (!candidate) continue;
    try {
      return JSON.parse(candidate);
    } catch {
      // Keep trying later JSON-looking segments.
    }
  }

  return JSON.parse(trimmed);
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
    signal: options.signal,
  });
  const text = await response.text();
  const payload = parseJsonResponseText(text);
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

export function normalizeAdminColor(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized || normalized === 'default' || normalized === 'fresh') {
    return 'modern';
  }

  const allowed = new Set(['modern', 'light', 'blue', 'coffee', 'ectoplasm', 'midnight', 'ocean', 'sunrise']);
  return allowed.has(normalized) ? normalized : 'modern';
}

export function normalizeUserPreferences(preferences = {}) {
  return {
    adminColor: normalizeAdminColor(preferences?.adminColor),
    richEditing: preferences?.richEditing !== false,
    syntaxHighlighting: preferences?.syntaxHighlighting !== false,
    commentShortcuts: preferences?.commentShortcuts === true,
    showAdminBarFront: preferences?.showAdminBarFront !== false,
  };
}

export function resolveCanonicalValue(source, canonical = {}) {
  switch (source) {
    case 'site.title':       return canonical.title;
    case 'site.description': return canonical.tagline;
    case 'site.url':         return canonical.url;
    case 'site.language':    return canonical.language;
    case 'site.icon':        return canonical.iconId;
    case 'site.icon_url':    return canonical.iconUrl;
    case 'site.admin_email': return canonical.adminEmail;
    case 'site.locale':      return canonical.locale;
    case 'site.timezone':    return canonical.timezone;
    default:                 return null;
  }
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

export function buildFieldDefinitions({ schema, model, recordsByModel, includeContentField, ImageControl, RepeaterControl, canonical = {} }) {
  const filterable = new Set(schema.view?.filters ?? []);
  return (schema.fields ?? [])
    .filter((field) => {
      if (field.id === 'excerpt' && !model.supports?.includes('excerpt')) return false;
      if (field.id === 'content') return includeContentField;
      return true;
    })
    .map((field) => {
      const inheritedValue = field.inheritsFrom
        ? resolveCanonicalValue(field.inheritsFrom, canonical)
        : null;
      const inheritedHint =
        field.inheritsFrom && inheritedValue !== null && inheritedValue !== undefined && inheritedValue !== ''
          ? `Inherits from ${field.inheritsFrom}: ${inheritedValue}`
          : null;
      const description = [field.help, inheritedHint].filter(Boolean).join(' — ');

      const baseField = {
        id: field.id,
        label: field.label,
        description: description || undefined,
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
  const flatFields = [];
  collectFormFieldIds(schema.form?.children ?? [], included, flatFields);
  return { layout: { type: 'regular', labelPosition: 'top' }, fields: flatFields };
}

function collectFormFieldIds(nodes, included, output) {
  for (const node of nodes) {
    if (typeof node === 'string') {
      if (included.has(node)) output.push(node);
      continue;
    }
    if (node?.children) collectFormFieldIds(node.children, included, output);
  }
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

export function createEmptyRecord(model, { commentsEnabled = false, includeCommentStatus = false } = {}) {
  const record = {
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    date: '',
    featuredMedia: 0,
    postStatus: model.id === 'inquiry' ? 'publish' : 'draft',
  };

  if (includeCommentStatus) {
    record.commentStatus = commentsEnabled ? 'open' : 'closed';
  }

  return record;
}

export function createEmptySingleton() {
  return {};
}

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed) {
  let state = seed || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function deriveTrafficSeries(seedStr, days = 30, base = 120, variance = 0.6) {
  const rand = seededRandom(hashSeed(seedStr));
  const series = [];
  let momentum = 0;
  for (let i = 0; i < days; i++) {
    momentum = momentum * 0.7 + (rand() - 0.5) * variance;
    const weekend = [0, 6].includes((new Date().getDay() + i) % 7) ? 0.75 : 1;
    const value = Math.max(5, Math.round(base * weekend * (1 + momentum)));
    series.push(value);
  }
  return series;
}

function sumSeries(arr) {
  return arr.reduce((s, n) => s + n, 0);
}

function deltaPct(series) {
  if (series.length < 14) return 0;
  const mid = Math.floor(series.length / 2);
  const prev = sumSeries(series.slice(0, mid)) || 1;
  const curr = sumSeries(series.slice(mid));
  return Math.round(((curr - prev) / prev) * 100);
}

export function deriveActionVerb(record) {
  if (!record.modified || !record.created) return 'Updated';
  try {
    const created = new Date(record.created).getTime();
    const modified = new Date(record.modified).getTime();
    if (Math.abs(modified - created) < 60_000) return 'Created';
  } catch {}
  return 'Updated';
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
        recordId: record.id,
        title: record.title || '(Untitled)',
        modelLabel: model.label,
        modelId: model.id,
        modified: record.modified,
        action: deriveActionVerb(record),
      });
    }
  }
  recentActivity.sort((a, b) => (b.modified ?? '').localeCompare(a.modified ?? ''));

  // Mock analytics — deterministic per-site so numbers feel real but reproducible
  const siteSeed = bootstrap.site?.title || 'wplite';
  const visitorsSeries = deriveTrafficSeries(`${siteSeed}::visitors`, 30, 140);
  const sessionsSeries = deriveTrafficSeries(`${siteSeed}::sessions`, 30, 210);
  const visitors = sumSeries(visitorsSeries);
  const sessions = sumSeries(sessionsSeries);
  const avgSessionSec = 90 + (hashSeed(siteSeed) % 240);
  const bounceRate = 32 + (hashSeed(`${siteSeed}::bounce`) % 30);

  // Top content leaderboard — views seeded per record
  const trackable = [];
  for (const model of bootstrap.models) {
    if (model.type !== 'collection' && model.id !== 'post') continue;
    for (const record of recordsByModel[model.id] ?? []) {
      const viewsSeries = deriveTrafficSeries(`${siteSeed}::${model.id}::${record.id}`, 30, 18, 0.9);
      trackable.push({
        id: `${model.id}-${record.id}`,
        recordId: record.id,
        modelId: model.id,
        modelLabel: model.label,
        title: record.title || '(Untitled)',
        views: sumSeries(viewsSeries),
        trend: deltaPct(viewsSeries),
      });
    }
  }
  const topContent = trackable.sort((a, b) => b.views - a.views).slice(0, 6);

  const referrers = [
    { source: 'Direct', share: 38 + (hashSeed(`${siteSeed}::r0`) % 12) },
    { source: 'Google', share: 24 + (hashSeed(`${siteSeed}::r1`) % 10) },
    { source: 'Instagram', share: 12 + (hashSeed(`${siteSeed}::r2`) % 8) },
    { source: 'LinkedIn', share: 8 + (hashSeed(`${siteSeed}::r3`) % 6) },
    { source: 'Other', share: 4 + (hashSeed(`${siteSeed}::r4`) % 6) },
  ];
  const refTotal = referrers.reduce((s, r) => s + r.share, 0);
  for (const r of referrers) r.share = Math.round((r.share / refTotal) * 100);

  return {
    totalPosts: postRecords.length,
    totalRecords,
    featuredProjects: projectRecords.filter((item) => item.featured).length,
    profileCompleteness: Math.round((filled / profileFields.length) * 100),
    totalCollections: bootstrap.models.filter((m) => m.type === 'collection').length,
    recentInquiries: inquiryRecords.slice(0, 5),
    collectionBreakdown,
    recentActivity: recentActivity.slice(0, 12),
    analytics: {
      visitors,
      visitorsSeries,
      visitorsTrend: deltaPct(visitorsSeries),
      sessions,
      sessionsSeries,
      sessionsTrend: deltaPct(sessionsSeries),
      avgSessionSec,
      bounceRate,
      topContent,
      referrers,
    },
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

function extractRawField(field, { fieldLabel, itemLabel } = {}) {
  if (field == null) return '';
  if (typeof field === 'string') return field;
  if (typeof field?.raw === 'string') return field.raw;
  if (typeof field?.rendered === 'string') {
    if (typeof console !== 'undefined') {
      console.warn(
        `[wplite] REST response for ${itemLabel ?? 'record'} is missing ${fieldLabel ?? 'field'}.raw — falling back to rendered HTML. Likely cause: the request did not apply context=edit, or the current user lacks edit permissions. Parsed blocks will be recovered from HTML and may appear as classic/freeform blocks.`
      );
    }
    return field.rendered;
  }
  return '';
}

export function normalizePageRecord(page) {
  return {
    id: page.id,
    title: page.title?.raw ?? decodeRenderedText(page.title?.rendered) ?? '',
    slug: page.slug ?? '',
    routeId: page.portfolioRouteId ?? '',
    sourcePath: page.wpliteSourcePath ?? '',
    postStatus: page.status ?? 'draft',
    commentStatus: page.comment_status ?? 'closed',
    content: extractRawField(page.content, { fieldLabel: 'content', itemLabel: `page ${page.id}` }),
    excerpt: page.excerpt?.raw ?? decodeRenderedText(page.excerpt?.rendered) ?? '',
    parent: page.parent ?? 0,
    template: page.template ?? '',
    menuOrder: page.menu_order ?? 0,
    featuredMedia: page.featured_media ?? 0,
    link: page.link ?? '',
    date: page.date_gmt ?? page.date ?? '',
    modified: page.modified ?? '',
  };
}

export function getRouteManifestEntry(bootstrap, routeId) {
  if (!routeId) return null;
  const manifest = bootstrap?.routeManifest ?? {};
  return manifest?.[routeId] ?? null;
}

export function getRouteManifestForPage(bootstrap, page) {
  const manifest = bootstrap?.routeManifest ?? {};
  if (!manifest || typeof manifest !== 'object') {
    return null;
  }

  if (page?.routeId && manifest[page.routeId]) {
    return manifest[page.routeId];
  }

  const slug = String(page?.slug ?? '');
  if (!slug) {
    return null;
  }

  return Object.values(manifest).find((entry) => String(entry?.slug ?? '') === slug) ?? null;
}

/**
 * Parse a Gutenberg template markup blob and return the source files that
 * actually render it. Used by the assistant surface so the agent knows
 * whether to edit post-content, a pattern, or a template part.
 *
 *   - `<!-- wp:post-content /-->` → rendersPostContent = true
 *   - `<!-- wp:pattern {"slug":"<theme>/<name>"} /-->` → theme/patterns/<name>.html
 *   - `<!-- wp:template-part {"slug":"<name>"} /-->` → theme/parts/<name>.html
 *
 * Theme prefix on pattern slugs (e.g. "elsewhere-theme/hero") is stripped.
 */
export function analyzeTemplateMarkup(markup, { templateSlug = null } = {}) {
  const text = String(markup || '');
  const rendersPostContent = /<!--\s*wp:post-content\b/.test(text);

  const patterns = new Set();
  const patternMatcher = /<!--\s*wp:pattern\s+({[^}]*})\s*\/?-->/g;
  let match;
  while ((match = patternMatcher.exec(text)) !== null) {
    try {
      const attrs = JSON.parse(match[1]);
      if (attrs?.slug) patterns.add(String(attrs.slug));
    } catch {
      /* skip malformed attrs */
    }
  }

  const parts = new Set();
  const partMatcher = /<!--\s*wp:template-part\s+({[^}]*})\s*\/?-->/g;
  while ((match = partMatcher.exec(text)) !== null) {
    try {
      const attrs = JSON.parse(match[1]);
      if (attrs?.slug) parts.add(String(attrs.slug));
    } catch {
      /* skip */
    }
  }

  const renderSources = [];
  if (templateSlug) {
    renderSources.push(`theme/templates/${templateSlug}.html`);
  }
  for (const slug of patterns) {
    const bare = slug.includes('/') ? slug.split('/').pop() : slug;
    renderSources.push(`theme/patterns/${bare}.html`);
  }
  for (const slug of parts) {
    renderSources.push(`theme/parts/${slug}.html`);
  }

  return {
    rendersPostContent,
    renderSources,
    patternSlugs: [...patterns],
    templatePartSlugs: [...parts],
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

export function normalizeCommentStatus(status) {
  const normalized = String(status ?? '').trim().toLowerCase();
  if (!normalized) return 'hold';
  if (normalized === 'approved') return 'approve';
  if (normalized === 'pending') return 'hold';
  return normalized;
}

export function normalizeCommentRecord(comment) {
  const contentRendered = comment.content?.rendered ?? '';
  const contentRaw = comment.content?.raw ?? decodeRenderedText(contentRendered) ?? '';
  const contentText = decodeRenderedText(contentRendered || contentRaw);
  const embeddedPost = comment._embedded?.up?.[0] ?? null;

  return {
    id: comment.id,
    postId: comment.post ?? 0,
    postTitle: decodeRenderedText(embeddedPost?.title?.rendered) || `Post #${comment.post ?? '—'}`,
    postLink: embeddedPost?.link ?? '',
    parent: comment.parent ?? 0,
    authorId: comment.author ?? 0,
    authorName: comment.author_name ?? '',
    authorEmail: comment.author_email ?? '',
    authorUrl: comment.author_url ?? '',
    authorAvatarUrl: comment.author_avatar_urls?.['96'] ?? comment.author_avatar_urls?.['48'] ?? comment.author_avatar_urls?.['24'] ?? '',
    content: contentRaw,
    contentText,
    contentRendered,
    excerpt: contentText.length > 140 ? `${contentText.slice(0, 137)}...` : contentText,
    date: comment.date ?? '',
    dateGmt: comment.date_gmt ?? '',
    status: normalizeCommentStatus(comment.status),
    type: comment.type ?? 'comment',
    link: comment.link ?? '',
  };
}

export function normalizeUserRecord(user) {
  const avatarUrls = user.avatar_urls ?? user.avatarUrls ?? {};
  const customAvatarUrl =
    user.meta?.wplite_avatar_url
    || user.wpliteAvatarUrl
    || '';
  const customAvatarId =
    user.meta?.wplite_avatar_id
    || user.wpliteAvatarId
    || 0;
  const avatarUrl =
    customAvatarUrl
    || avatarUrls['96']
    || avatarUrls['48']
    || avatarUrls['24']
    || '';
  return {
    id: user.id,
    displayName: user.name ?? '',
    name: user.name ?? '',
    username: user.username ?? user.slug ?? '',
    firstName: user.first_name ?? user.firstName ?? '',
    lastName: user.last_name ?? user.lastName ?? '',
    nickname: user.nickname ?? '',
    email: user.email ?? '',
    url: user.url ?? '',
    description: user.description ?? '',
    locale: user.locale ?? '',
    roles: user.roles ?? [],
    avatarUrls: customAvatarUrl
      ? { ...avatarUrls, 24: customAvatarUrl, 48: customAvatarUrl, 96: customAvatarUrl }
      : avatarUrls,
    avatarUrl,
    wpliteAvatarId: Number(customAvatarId) || 0,
    wpliteAvatarUrl: customAvatarUrl,
    preferences: normalizeUserPreferences(user.wplitePreferences ?? user.preferences),
  };
}
