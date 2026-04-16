import { collectionPathForModel, editorRouteForModel } from './helpers.js';

function normalizeInternalUrl(href) {
  if (!href) return null;

  try {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function normalizePathname(pathname) {
  return pathname.replace(/\/+$/, '') || '/';
}

function normalizeSearch(searchParams) {
  const pairs = [...searchParams.entries()]
    .filter(([key]) => key.toLowerCase() !== 'preview')
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      if (leftKey === rightKey) return leftValue.localeCompare(rightValue);
      return leftKey.localeCompare(rightKey);
    });

  if (pairs.length === 0) {
    return '';
  }

  const normalized = new URLSearchParams();
  for (const [key, value] of pairs) {
    normalized.append(key, value);
  }
  return `?${normalized.toString()}`;
}

function normalizeFullKey(url) {
  return `${normalizePathname(url.pathname)}${normalizeSearch(url.searchParams)}`;
}

function normalizePathKey(url) {
  return normalizePathname(url.pathname);
}

function parseNumericParam(searchParams, keys) {
  for (const key of keys) {
    const value = Number.parseInt(searchParams.get(key) || '', 10);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return 0;
}

function normalizeHintString(value) {
  return String(value ?? '').trim();
}

function normalizeHintNumber(value) {
  const numericValue = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
}

/**
 * Build an internal-link resolver that maps user-facing URLs to admin-app
 * editor routes.
 *
 *   - Every page permalink → /pages/{id}
 *   - The site homepage (either the page set as front-page, or the first
 *     page if show_on_front=posts) → /pages/{id} anchored to `/`.
 *   - Every post permalink → /posts/{id}
 *   - Every collection-record permalink → /{collectionPath}/{id}
 *   - Collection archives → collection list (e.g. /work → /projects)
 *
 * Returns `(href) => { adminPath, label, modelLabel, href } | null`.
 */
export function createInternalLinkResolver({ bootstrap, recordsByModel }) {
  const pathMap = new Map();
  const fullMap = new Map();
  const recordIdMap = new Map();
  const slugParamMap = new Map();
  const routeIdMap = new Map();
  const modelRecordMap = new Map();
  const postTypeRecordMap = new Map();
  const archiveMap = new Map();

  function registerRecordIdentity(modelId, postType, recordId, resolution) {
    const numericId = Number(recordId);
    if (!Number.isFinite(numericId) || numericId <= 0 || !resolution) {
      return;
    }

    recordIdMap.set(numericId, resolution);

    if (modelId) {
      const bucket = modelRecordMap.get(modelId) ?? new Map();
      bucket.set(numericId, resolution);
      modelRecordMap.set(modelId, bucket);
    }

    if (postType) {
      const bucket = postTypeRecordMap.get(postType) ?? new Map();
      bucket.set(numericId, resolution);
      postTypeRecordMap.set(postType, bucket);
    }
  }

  function registerRecordQueryVar(paramName, slug, resolution) {
    if (!paramName || !slug || !resolution) return;
    const normalizedKey = String(paramName).trim();
    if (!normalizedKey) return;
    const bucket = slugParamMap.get(normalizedKey) ?? new Map();
    if (!bucket.has(slug)) {
      bucket.set(slug, resolution);
    }
    slugParamMap.set(normalizedKey, bucket);
  }

  function register(href, adminPath, label, modelLabel, extra = {}) {
    const url = normalizeInternalUrl(href);
    if (!url || !adminPath) return null;

    const resolution = {
      href,
      adminPath,
      label,
      modelLabel,
      ...extra,
    };

    const fullKey = normalizeFullKey(url);
    if (!fullMap.has(fullKey)) {
      fullMap.set(fullKey, resolution);
    }

    const pathKey = normalizePathKey(url);
    if (!pathMap.has(pathKey)) {
      pathMap.set(pathKey, resolution);
    }

    return resolution;
  }

  // Pages
  const pageSlugMap = new Map();
  for (const page of bootstrap?.pages ?? []) {
    const resolution = register(
      page.link,
      `/pages/${page.id}`,
      page.title || 'Untitled Page',
      'Page',
      { kind: 'page', id: Number(page.id) }
    );

    if (resolution) {
      registerRecordIdentity('page', 'page', page.id, resolution);
      if (page.slug && !pageSlugMap.has(page.slug)) {
        pageSlugMap.set(page.slug, resolution);
      }
      if (page.routeId && !routeIdMap.has(page.routeId)) {
        routeIdMap.set(page.routeId, resolution);
      }
    }
  }

  // Homepage alias `/` → front-page editor. Prefer an explicit pageOnFront;
  // otherwise fall back to a page matching `/`, otherwise the first page.
  const pages = bootstrap?.pages ?? [];
  const frontPageId = Number(bootstrap?.site?.pageOnFront || 0);
  const rootEntry = (() => {
    if (frontPageId) {
      const page = pages.find((p) => Number(p.id) === frontPageId);
      if (page) return { adminPath: `/pages/${page.id}`, label: page.title || 'Home', modelLabel: 'Page', href: page.link };
    }
    const rootManifest = Object.values(bootstrap?.routeManifest ?? {})
      .find((entry) => entry?.path === '/' && entry?.page?.id);
    if (rootManifest?.page?.id) {
      const page = pages.find((p) => Number(p.id) === Number(rootManifest.page.id));
      if (page) return { adminPath: `/pages/${page.id}`, label: page.title || 'Home', modelLabel: 'Page', href: page.link };
    }
    if (pages[0]) {
      return { adminPath: `/pages/${pages[0].id}`, label: pages[0].title || 'Home', modelLabel: 'Page', href: pages[0].link };
    }
    return null;
  })();
  if (rootEntry && !pathMap.has('/')) {
    pathMap.set('/', rootEntry);
  }

  // Posts
  const postModel = (bootstrap?.models ?? []).find((model) => model?.id === 'post');
  if (postModel) {
    for (const record of recordsByModel?.post ?? []) {
      const resolution = register(
        record.link,
        editorRouteForModel(postModel, record.id),
        record.title || `Post ${record.id}`,
        postModel.singularLabel || 'Post',
        { kind: 'record', id: Number(record.id), modelId: postModel.id }
      );
      if (resolution) {
        registerRecordIdentity(postModel.id, postModel.postType, record.id, resolution);
        registerRecordQueryVar(postModel.postType, record.slug, resolution);
        registerRecordQueryVar('name', record.slug, resolution);
      }
    }
  }

  // Custom collections
  for (const model of bootstrap?.models ?? []) {
    if (!model || model.id === 'page' || model.id === 'post' || model.public === false) continue;
    for (const record of recordsByModel?.[model.id] ?? []) {
      const resolution = register(
        record.link,
        `${collectionPathForModel(model)}/${record.id}`,
        record.title || `${model.singularLabel || model.label} ${record.id}`,
        model.singularLabel || model.label,
        { kind: 'record', id: Number(record.id), modelId: model.id }
      );
      if (resolution) {
        registerRecordIdentity(model.id, model.postType, record.id, resolution);
        registerRecordQueryVar(model.postType, record.slug, resolution);
        registerRecordQueryVar(model.id, record.slug, resolution);
        if (model.postType) {
          registerRecordQueryVar(`${model.postType}_id`, String(record.id), resolution);
        }
      }
    }

    // Collection archive (e.g. /work → /projects)
    if (model.archiveSlug) {
      const archiveUrl = `${window.location.origin}/${model.archiveSlug}`;
      const archivePath = collectionPathForModel(model);
      const resolution = register(
        archiveUrl,
        archivePath,
        model.label || model.id,
        model.label || 'Collection',
        { kind: 'archive', modelId: model.id }
      );
      if (resolution) {
        archiveMap.set(model.id, resolution);
      }
    }
  }

  function resolveByHints(input = {}) {
    const routeId = normalizeHintString(input.routeId ?? input.wpliteRouteId);
    if (routeId && routeIdMap.has(routeId)) {
      return routeIdMap.get(routeId) ?? null;
    }

    const entityKind = normalizeHintString(input.kind);
    const entityType = normalizeHintString(input.type);
    const targetKind = normalizeHintString(
      input.targetKind
      ?? input.wpliteTargetKind
      ?? (entityKind === 'custom' ? 'custom' : '')
    );
    const modelId = normalizeHintString(input.modelId ?? input.wpliteModelId);
    if (targetKind === 'archive' && modelId && archiveMap.has(modelId)) {
      return archiveMap.get(modelId) ?? null;
    }

    const postId = normalizeHintNumber(
      input.postId
      ?? input.recordId
      ?? input.wplitePostId
      ?? ((entityKind === 'post-type' || !entityKind) ? input.id : '')
    );
    const postType = normalizeHintString(
      input.postType
      ?? input.wplitePostType
      ?? ((entityKind === 'post-type' || !entityKind) ? entityType : '')
    );

    if (Number.isFinite(postId) && postId > 0) {
      if (modelId) {
        const modelBucket = modelRecordMap.get(modelId);
        if (modelBucket?.has(postId)) {
          return modelBucket.get(postId) ?? null;
        }
      }

      if (postType) {
        const postTypeBucket = postTypeRecordMap.get(postType);
        if (postTypeBucket?.has(postId)) {
          return postTypeBucket.get(postId) ?? null;
        }
      }

      if (recordIdMap.has(postId)) {
        return recordIdMap.get(postId) ?? null;
      }
    }

    return null;
  }

  return (input) => {
    if (input && typeof input === 'object') {
      const hintedResolution = resolveByHints(input);
      if (hintedResolution) {
        return hintedResolution;
      }
    }

    const href = typeof input === 'string' ? input : input?.href;
    const url = normalizeInternalUrl(href);
    if (!url) return null;

    const searchParams = url.searchParams;
    const byId = parseNumericParam(searchParams, ['page_id', 'p', 'post', 'preview_id', 'attachment_id']);
    if (byId && recordIdMap.has(byId)) {
      return recordIdMap.get(byId) ?? null;
    }

    const pageSlug = searchParams.get('pagename');
    if (pageSlug && pageSlugMap.has(pageSlug)) {
      return pageSlugMap.get(pageSlug) ?? null;
    }

    const postType = searchParams.get('post_type');
    const genericName = searchParams.get('name');
    if (genericName && postType) {
      const postTypeBucket = slugParamMap.get(postType);
      if (postTypeBucket?.has(genericName)) {
        return postTypeBucket.get(genericName) ?? null;
      }
    }

    for (const [key, value] of searchParams.entries()) {
      const bucket = slugParamMap.get(key);
      if (bucket?.has(value)) {
        return bucket.get(value) ?? null;
      }
    }

    const fullKey = normalizeFullKey(url);
    if (fullMap.has(fullKey)) {
      return fullMap.get(fullKey) ?? null;
    }

    const pathKey = normalizePathKey(url);
    return pathMap.get(pathKey) ?? null;
  };
}
