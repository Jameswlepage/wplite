// Classifies dev-watcher change events into a reseed strategy.
//
// Returns { strategy, reason, payload }.
//   strategy === 'partial': payload is suitable for POST /portfolio/v1/seed-partial.
//   strategy === 'full':    caller should run the full reseed + reload flow.
//   strategy === 'none':    pure asset-only change; no server work needed.
//
// Conservative: anything not recognised as a pure content-file edit falls
// back to 'full'. The dev loop still runs an incremental plugin rebuild in
// either case — this classifier only decides the seed + reload shape.

import path from 'node:path';

const POSIX_SEP = '/';

function splitPath(rawPath) {
  return String(rawPath).split(path.sep).join(POSIX_SEP).split(POSIX_SEP).filter(Boolean);
}

function stripExtension(name) {
  const idx = name.lastIndexOf('.');
  return idx <= 0 ? name : name.slice(0, idx);
}

function classifyOne(rawPath) {
  const parts = splitPath(rawPath);
  if (parts.length === 0) {
    return { kind: 'unknown', full: true };
  }

  const [root, ...rest] = parts;

  if (root === 'content') {
    if (rest.length < 2) {
      return { kind: 'content-root', full: true };
    }
    const [dir, ...tail] = rest;
    const fileName = tail[tail.length - 1];

    if (dir === 'singletons') {
      return { kind: 'singleton-data', singletonId: stripExtension(fileName) };
    }

    if (dir === 'media') {
      return { kind: 'media', full: true };
    }

    if (!fileName.endsWith('.md')) {
      return { kind: 'content-other', full: true };
    }

    return {
      kind: 'collection-item',
      model: dir,
      slug: stripExtension(fileName),
    };
  }

  if (root === 'app') {
    if (rest.length === 1 && rest[0] === 'site.json') {
      // Site-wide settings: reapply defaults + blogname + front/posts pages.
      return { kind: 'site-config' };
    }

    const [subdir, ...tail] = rest;
    const fileName = tail[tail.length - 1];

    if (subdir === 'routes' && fileName?.endsWith('.json')) {
      return { kind: 'route-def', routeId: stripExtension(fileName) };
    }

    if (subdir === 'singletons' && fileName?.endsWith('.json')) {
      // Singleton schema changed — admin UI needs updated schema; data shape
      // may have shifted, so reseed the singleton and refetch bootstrap.
      return { kind: 'singleton-schema', singletonId: stripExtension(fileName) };
    }

    if (subdir === 'menus') {
      // Menus: admin bootstrap carries the menu definition; there's no
      // targeted re-seed today. Refresh bootstrap and let the frontend
      // pull the new menu on its next render.
      return { kind: 'menus' };
    }

    if (subdir === 'models' && fileName?.endsWith('.json')) {
      // Model schemas control post-type registration + admin field schema.
      // register_post_type runs at WP init; a live request can't retroactively
      // register a type, so a full reload is the honest answer here.
      return { kind: 'model-schema', full: true };
    }

    return { kind: 'app-other', full: true };
  }

  if (root === 'theme') {
    if (rest[0] === 'templates' || rest[0] === 'parts') {
      return { kind: 'theme-template' };
    }
    if (rest[rest.length - 1] === 'theme.json' || rest.includes('theme.json')) {
      return { kind: 'theme-json', full: true };
    }
    return { kind: 'theme-other', full: true };
  }

  if (root === 'admin') {
    // Admin config drives the in-app schema; bootstrap refetch covers it.
    return { kind: 'admin-config' };
  }

  if (root === 'blocks') {
    // Block JS/CSS register through the plugin; requires full reload.
    return { kind: 'blocks', full: true };
  }

  if (root === 'scripts' || root === 'package.json') {
    return { kind: 'tooling', full: true };
  }

  if (root === 'admin-app') {
    return { kind: 'admin-app', none: true };
  }

  return { kind: 'unknown', full: true };
}

export function classifyChanges(changedPaths) {
  const entries = [...changedPaths].map((raw) => ({ raw, info: classifyOne(raw) }));

  const fullTriggers = entries.filter((entry) => entry.info.full);
  if (fullTriggers.length > 0) {
    return {
      strategy: 'full',
      reason: `Full reload for: ${fullTriggers.map((e) => e.raw).join(', ')}`,
      payload: null,
    };
  }

  const noneOnly = entries.length > 0 && entries.every((entry) => entry.info.none);
  if (noneOnly) {
    return { strategy: 'none', reason: 'Admin-app HMR handled the change.', payload: null };
  }

  const singletons = new Set();
  const itemsByModel = new Map();
  const routes = new Set();
  let templates = false;
  let siteSettings = false;
  let flushRewrites = false;
  let bootstrap = false;

  for (const { info } of entries) {
    switch (info.kind) {
      case 'singleton-data':
        singletons.add(info.singletonId);
        break;
      case 'collection-item':
        if (!itemsByModel.has(info.model)) {
          itemsByModel.set(info.model, new Set());
        }
        itemsByModel.get(info.model).add(info.slug);
        break;
      case 'route-def':
        routes.add(info.routeId);
        flushRewrites = true;
        bootstrap = true;
        break;
      case 'singleton-schema':
        singletons.add(info.singletonId);
        bootstrap = true;
        break;
      case 'site-config':
        siteSettings = true;
        bootstrap = true;
        break;
      case 'menus':
        bootstrap = true;
        break;
      case 'theme-template':
        templates = true;
        break;
      case 'admin-config':
        bootstrap = true;
        break;
      default:
        break;
    }
  }

  const collectionItems = [];
  for (const [model, slugs] of itemsByModel) {
    for (const slug of slugs) {
      collectionItems.push({ model, slug });
    }
  }

  const summaryParts = [];
  if (collectionItems.length) summaryParts.push(`${collectionItems.length} item(s)`);
  if (singletons.size) summaryParts.push(`${singletons.size} singleton(s)`);
  if (routes.size) summaryParts.push(`${routes.size} route(s)`);
  if (templates) summaryParts.push('templates');
  if (bootstrap) summaryParts.push('bootstrap');

  return {
    strategy: 'partial',
    reason: summaryParts.length ? `Partial reseed (${summaryParts.join(', ')})` : 'Partial reseed',
    payload: {
      singletons: [...singletons],
      collectionItems,
      routes: [...routes],
      templates,
      siteSettings,
      flushRewrites,
      bootstrap,
    },
  };
}
