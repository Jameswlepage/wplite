import {
  getModelByCollectionPath,
  getRouteManifestForPage,
  normalizePageRecord,
  wpApiFetch,
} from './helpers.js';
import { loadEditorBundle } from './editor-bundle.js';

const pageRecordCache = new Map();
const templateCache = new Map();

function normalizeTemplateSlug(page, bootstrap) {
  const routeManifest = getRouteManifestForPage(bootstrap, page);
  if (routeManifest?.editor?.template) {
    return routeManifest.editor.template;
  }

  if (page?.template && !['default', ''].includes(page.template)) {
    return page.template;
  }

  return 'page';
}

function getCollectionTemplateCandidates(modelId) {
  return [`single-${modelId}`, 'single'];
}

export function loadCachedPageRecord(pageId) {
  const normalizedId = String(pageId ?? '').trim();
  if (!normalizedId || normalizedId === 'new') {
    return Promise.resolve(null);
  }

  if (!pageRecordCache.has(normalizedId)) {
    pageRecordCache.set(
      normalizedId,
      wpApiFetch(`wp/v2/pages/${normalizedId}?context=edit`)
        .then((page) => normalizePageRecord(page))
        .catch((error) => {
          pageRecordCache.delete(normalizedId);
          throw error;
        })
    );
  }

  return pageRecordCache.get(normalizedId);
}

export function loadCachedTemplateRecord(slug) {
  const normalizedSlug = String(slug ?? '').trim();
  if (!normalizedSlug) {
    return Promise.resolve(null);
  }

  if (!templateCache.has(normalizedSlug)) {
    templateCache.set(
      normalizedSlug,
      wpApiFetch(`portfolio/v1/template/${encodeURIComponent(normalizedSlug)}`)
        .catch((error) => {
          templateCache.delete(normalizedSlug);
          throw error;
        })
    );
  }

  return templateCache.get(normalizedSlug);
}

export async function prefetchEditorRouteData(path, { bootstrap, recordsByModel } = {}) {
  const normalizedPath = String(path ?? '').trim();
  if (!normalizedPath || normalizedPath.startsWith('/docs')) {
    return;
  }

  void loadEditorBundle();

  const [pathname] = normalizedPath.split('?');
  const segments = pathname.split('/').filter(Boolean);

  if (segments[0] === 'pages') {
    const pageId = segments[1];
    if (!pageId || pageId === 'new') {
      return;
    }

    const seededPage = (bootstrap?.pages ?? []).find((page) => String(page.id) === String(pageId));
    const page = seededPage ?? await loadCachedPageRecord(pageId);
    if (!page) {
      return;
    }

    const routeManifest = getRouteManifestForPage(bootstrap, page);
    const templateSlug = normalizeTemplateSlug(page, bootstrap);
    const previewMarkup =
      routeManifest?.editor?.previewMarkup
      || bootstrap?.editorTemplates?.routes?.[routeManifest?.route?.id]?.markup
      || bootstrap?.editorTemplates?.postTypes?.page?.markup
      || '';

    if (!previewMarkup && templateSlug) {
      void loadCachedTemplateRecord(templateSlug).catch(() => {});
    }

    return;
  }

  if (segments.length >= 2) {
    const [collectionPath, itemId] = segments;
    if (!collectionPath || !itemId || itemId === 'new') {
      return;
    }

    const model = getModelByCollectionPath(bootstrap?.models ?? [], collectionPath);
    if (!model?.supports?.includes('editor')) {
      return;
    }

    const existing = (recordsByModel?.[model.id] ?? []).find((item) => String(item.id) === String(itemId));
    if (!existing) {
      return;
    }

    for (const slug of getCollectionTemplateCandidates(model.id)) {
      void loadCachedTemplateRecord(slug).catch(() => {});
    }
  }
}
