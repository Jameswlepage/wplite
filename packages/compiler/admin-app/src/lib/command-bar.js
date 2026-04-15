import { collectionPathForModel, editorRouteForModel, toTitleCase } from './helpers.js';

export const COMMAND_BAR_RECENTS_KEY = 'wplite-command-bar-recents';
export const COMMAND_BAR_RECENTS_LIMIT = 8;

const GROUP_ORDER = [
  'Recent',
  'Suggested',
  'Commands',
  'Docs',
  'Pages',
  'Posts',
  'Collections',
  'People',
  'Media',
  'Comments',
];

const DOC_SECTION_ITEMS = [
  ['structure', 'Docs: Source Tree', 'Project structure and authored source layers'],
  ['contract', 'Docs: Flat Site Contract', 'Compiler and site boundaries'],
  ['collections', 'Docs: Collections', 'Modeling repeatable content'],
  ['pages', 'Docs: Pages', 'Routes, shells, and page syncing'],
  ['settings', 'Docs: Settings', 'Singletons vs native WordPress settings'],
  ['themes', 'Docs: Themes', 'Theme contract and native block theming'],
  ['blocks', 'Docs: Blocks', 'Public runtime block guidance'],
  ['schemas', 'Docs: Schemas', 'Generated schema and admin overrides'],
  ['admin-app', 'Docs: Admin App', 'Admin shell, bootstrap, and routing'],
  ['workflow', 'Docs: Workflow', 'Build, apply, and dev commands'],
  ['plugins', 'Docs: Plugins', 'Generated runtime plugin structure'],
];

function normalizeSearchText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function compactList(values) {
  return values
    .flat()
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);
}

function createSearchText(item) {
  return normalizeSearchText([
    item.title,
    item.subtitle,
    item.group,
    ...(item.keywords ?? []),
  ].join(' '));
}

function withSearchText(item) {
  return {
    ...item,
    searchText: createSearchText(item),
  };
}

function createCommandItem(item) {
  return withSearchText({
    kind: 'command',
    group: 'Commands',
    priority: 200,
    ...item,
  });
}

function createRecordSubtitle(label, record) {
  return compactList([
    label,
    record?.slug ? `/${record.slug}` : '',
    record?.postStatus ? toTitleCase(record.postStatus) : '',
  ]).join(' • ');
}

export function loadRecentCommandIds() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(COMMAND_BAR_RECENTS_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed.map((value) => String(value ?? '').trim()).filter(Boolean).slice(0, COMMAND_BAR_RECENTS_LIMIT)
      : [];
  } catch {
    return [];
  }
}

export function saveRecentCommandIds(ids) {
  try {
    window.localStorage.setItem(
      COMMAND_BAR_RECENTS_KEY,
      JSON.stringify(ids.slice(0, COMMAND_BAR_RECENTS_LIMIT))
    );
  } catch {}
}

export function rememberRecentCommand(id, currentIds = []) {
  const next = [
    id,
    ...currentIds.filter((value) => value !== id),
  ].slice(0, COMMAND_BAR_RECENTS_LIMIT);
  saveRecentCommandIds(next);
  return next;
}

export function buildCommandPaletteIndex({ bootstrap, recordsByModel }) {
  const siteUrl = String(bootstrap?.site?.url || window.location.origin);
  const commentsEnabled = bootstrap?.site?.commentsEnabled === true;
  const hasPosts = Boolean((bootstrap?.models ?? []).find((model) => model?.id === 'post'));
  const items = [];

  items.push(
    createCommandItem({
      id: 'command:pages',
      title: 'Pages',
      subtitle: 'Manage routed and freeform pages',
      action: 'open-overlay',
      overlay: 'content',
      section: 'pages',
      iconName: 'Document',
      keywords: ['page', 'routes'],
      priority: 700,
      emptyPriority: 1050,
    }),
    createCommandItem({
      id: 'command:new-page',
      title: 'New Page',
      subtitle: 'Create a new page in the editor',
      path: '/pages/new',
      iconName: 'Add',
      keywords: ['create', 'page', 'add'],
      priority: 760,
      emptyPriority: 1100,
    }),
    createCommandItem({
      id: 'command:comments',
      title: 'Comments',
      subtitle: commentsEnabled ? 'Moderate site discussion' : 'Review comments while discussion is disabled',
      action: 'open-overlay',
      overlay: 'comments',
      iconName: 'Chat',
      keywords: ['discussion', 'moderation', 'spam'],
      priority: 620,
      emptyPriority: 0,
      hiddenWhenEmpty: !commentsEnabled,
    }),
    createCommandItem({
      id: 'command:media',
      title: 'Media Library',
      subtitle: 'Browse uploads and assets',
      action: 'open-overlay',
      overlay: 'media',
      iconName: 'Image',
      keywords: ['uploads', 'files', 'images'],
      priority: 650,
      emptyPriority: 920,
    }),
    createCommandItem({
      id: 'command:users',
      title: 'Users',
      subtitle: 'Manage WordPress users and roles',
      action: 'open-overlay',
      overlay: 'users',
      iconName: 'User',
      keywords: ['people', 'accounts', 'roles'],
      priority: 680,
      emptyPriority: 960,
    }),
    createCommandItem({
      id: 'command:profile',
      title: 'Edit Profile',
      subtitle: 'Open your current WordPress user profile',
      path: '/users/me',
      iconName: 'UserAvatar',
      keywords: ['me', 'account', 'preferences'],
      priority: 690,
      emptyPriority: 1000,
    }),
    createCommandItem({
      id: 'command:site-settings',
      title: 'Site Settings',
      subtitle: 'Homepage, identity, timezone, and discussion defaults',
      action: 'open-overlay',
      overlay: 'settings',
      section: 'site',
      iconName: 'Globe',
      keywords: ['settings', 'site', 'homepage', 'discussion', 'comments'],
      priority: 710,
      emptyPriority: 1080,
    }),
    createCommandItem({
      id: 'command:domains',
      title: 'Domains',
      subtitle: 'Domain configuration and status',
      path: '/domains',
      iconName: 'Earth',
      keywords: ['dns', 'domain'],
      priority: 520,
      emptyPriority: 760,
    }),
    createCommandItem({
      id: 'command:integrations',
      title: 'Integrations',
      subtitle: 'Connect external services and apps',
      path: '/integrations',
      iconName: 'Integration',
      keywords: ['apps', 'services', 'connections'],
      priority: 520,
      emptyPriority: 740,
    }),
    createCommandItem({
      id: 'command:automations',
      title: 'Automations',
      subtitle: 'Workflow triggers and actions',
      path: '/automations',
      iconName: 'Events',
      keywords: ['workflow', 'triggers', 'actions'],
      priority: 450,
      emptyPriority: 0,
      hiddenWhenEmpty: true,
    }),
    createCommandItem({
      id: 'command:api',
      title: 'API',
      subtitle: 'Inspect generated endpoints and runtime details',
      path: '/settings/api',
      iconName: 'Api',
      keywords: ['rest', 'endpoints', 'api'],
      priority: 520,
      emptyPriority: 0,
      hiddenWhenEmpty: true,
    }),
    createCommandItem({
      id: 'command:logs',
      title: 'Logs',
      subtitle: 'Review runtime and sync diagnostics',
      path: '/settings/logs',
      iconName: 'Activity',
      keywords: ['logging', 'errors', 'diagnostics'],
      priority: 500,
      emptyPriority: 0,
      hiddenWhenEmpty: true,
    }),
    createCommandItem({
      id: 'command:view-site',
      title: 'View Site',
      subtitle: 'Open the public frontend in a new tab',
      href: siteUrl,
      openInNewTab: true,
      iconName: 'Launch',
      keywords: ['frontend', 'visit', 'public'],
      priority: 560,
      emptyPriority: 0,
      hiddenWhenEmpty: true,
    }),
    createCommandItem({
      id: 'command:classic-admin',
      title: 'Classic WP Admin',
      subtitle: 'Open wp-admin in a new tab',
      href: `${siteUrl.replace(/\/$/, '')}/wp-admin/?classic-admin=1`,
      openInNewTab: true,
      iconName: 'Launch',
      keywords: ['wordpress', 'wp-admin', 'legacy'],
      priority: 480,
      emptyPriority: 0,
      hiddenWhenEmpty: true,
    }),
  );

  if (hasPosts) {
    items.push(
      createCommandItem({
        id: 'command:posts',
        title: 'Posts',
        subtitle: 'Browse and edit posts',
        action: 'open-overlay',
        overlay: 'content',
        section: 'post',
        iconName: 'Blog',
        keywords: ['post', 'blog', 'journal'],
        priority: 700,
        emptyPriority: 980,
      }),
      createCommandItem({
        id: 'command:new-post',
        title: 'New Post',
        subtitle: 'Create a new post',
        path: '/posts/new',
        iconName: 'Add',
        keywords: ['create', 'post', 'blog', 'add'],
        priority: 760,
        emptyPriority: 1020,
      })
    );
  }

  for (const singleton of bootstrap?.singletons ?? []) {
    items.push(
      createCommandItem({
        id: `command:singleton:${singleton.id}`,
        title: `Settings: ${singleton.label}`,
        subtitle: 'Open singleton settings',
        action: 'open-overlay',
        overlay: 'settings',
        section: singleton.id,
        iconName: 'Settings',
        keywords: ['settings', 'singleton', singleton.id, singleton.label],
        priority: 500,
        emptyPriority: 0,
      })
    );
  }

  for (const [anchor, title, subtitle] of DOC_SECTION_ITEMS) {
    items.push(
      createCommandItem({
        id: `docs:${anchor}`,
        title,
        subtitle,
        path: `/docs#${anchor}`,
        group: 'Docs',
        iconName: 'Document',
        keywords: ['docs', anchor, subtitle],
        priority: 380,
        emptyPriority: 0,
        hiddenWhenEmpty: true,
      })
    );
  }

  for (const model of bootstrap?.models ?? []) {
    if (!model || model.public === false || model.id === 'page' || model.id === 'post') {
      continue;
    }

    items.push(
      createCommandItem({
        id: `command:collection:${model.id}`,
        title: model.label,
        subtitle: 'Browse collection entries',
        action: 'open-overlay',
        overlay: 'content',
        section: model.id,
        iconName: 'List',
        keywords: ['collection', model.id, model.singularLabel],
        priority: 560,
        emptyPriority: 860,
      }),
      createCommandItem({
        id: `command:new:${model.id}`,
        title: `New ${model.singularLabel || toTitleCase(model.id)}`,
        subtitle: `Create a new ${String(model.singularLabel || model.label || model.id).toLowerCase()}`,
        path: editorRouteForModel(model, 'new'),
        iconName: 'Add',
        keywords: ['create', 'new', model.id, model.label],
        priority: 610,
        emptyPriority: 0,
        hiddenWhenEmpty: true,
      })
    );
  }

  for (const page of bootstrap?.pages ?? []) {
    items.push(withSearchText({
      id: `page:${page.id}`,
      kind: 'record',
      group: 'Pages',
      title: page.title || '(Untitled page)',
      subtitle: createRecordSubtitle('Page', page),
      path: `/pages/${page.id}`,
      iconName: 'Document',
      keywords: ['page', page.slug, page.routeId, page.postStatus, page.template],
      priority: 420,
    }));
  }

  for (const model of bootstrap?.models ?? []) {
    for (const record of recordsByModel?.[model.id] ?? []) {
      items.push(withSearchText({
        id: `record:${model.id}:${record.id}`,
        kind: 'record',
        group: model.id === 'post' ? 'Posts' : 'Collections',
        title: record.title || `(Untitled ${String(model.singularLabel || model.id).toLowerCase()})`,
        subtitle: createRecordSubtitle(model.singularLabel || toTitleCase(model.id), record),
        path: editorRouteForModel(model, record.id),
        iconName: model.id === 'post' ? 'Blog' : 'List',
        keywords: [model.id, model.label, record.slug, record.postStatus],
        priority: model.id === 'post' ? 410 : 360,
      }));
    }
  }

  return items;
}

export function resolveRecentCommandItems(items, recentIds = [], { commandsOnly = false } = {}) {
  const itemMap = new Map(items.map((item) => [item.id, item]));
  return recentIds
    .map((id) => itemMap.get(id))
    .filter((item) => item && !item.hiddenWhenEmpty && (!commandsOnly || item.kind === 'command'));
}

export function resolveSuggestedCommandItems(items, { commandsOnly = false } = {}) {
  return items
    .filter((item) => item.emptyPriority > 0 && !item.hiddenWhenEmpty && (!commandsOnly || item.kind === 'command'))
    .sort((left, right) => {
      if (right.emptyPriority !== left.emptyPriority) {
        return right.emptyPriority - left.emptyPriority;
      }
      return left.title.localeCompare(right.title);
    });
}

export function buildEmptyCommandPaletteSections(items, recentIds = [], { commandsOnly = false } = {}) {
  const recent = resolveRecentCommandItems(items, recentIds, { commandsOnly }).slice(0, 6);
  const recentIdsSet = new Set(recent.map((item) => item.id));
  const suggested = resolveSuggestedCommandItems(items, { commandsOnly })
    .filter((item) => !recentIdsSet.has(item.id))
    .slice(0, 8);

  return [
    recent.length > 0 ? { label: 'Recent', items: recent } : null,
    suggested.length > 0 ? { label: 'Suggested', items: suggested } : null,
  ].filter(Boolean);
}

export function scoreCommandPaletteItem(item, rawQuery) {
  const query = normalizeSearchText(rawQuery);
  if (!query) {
    return item.emptyPriority ?? item.priority ?? 0;
  }

  const terms = query.split(' ').filter(Boolean);
  if (terms.length === 0) {
    return item.priority ?? 0;
  }

  const title = normalizeSearchText(item.title);
  const subtitle = normalizeSearchText(item.subtitle);
  const group = normalizeSearchText(item.group);
  const haystack = item.searchText || createSearchText(item);

  if (!terms.every((term) => haystack.includes(term))) {
    return -1;
  }

  let score = item.priority ?? 0;

  for (const term of terms) {
    if (title === term) {
      score += 2400;
    } else if (title.startsWith(term)) {
      score += 1400;
    } else if (title.includes(term)) {
      score += 900;
    } else {
      score += 200;
    }

    if (subtitle.includes(term)) {
      score += 260;
    }

    if (group.includes(term)) {
      score += 120;
    }
  }

  if (query.startsWith('new ') && title.startsWith('new ')) {
    score += 220;
  }

  if (item.kind === 'command') {
    score += 40;
  }

  return score;
}

export function searchCommandPaletteItems(items, query, { commandsOnly = false, limit = 28 } = {}) {
  const results = items
    .filter((item) => !commandsOnly || item.kind === 'command')
    .map((item) => ({
      item,
      score: scoreCommandPaletteItem(item, query),
    }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.item.title.localeCompare(right.item.title);
    })
    .map((entry) => ({ ...entry.item, __score: entry.score }));

  return results.slice(0, limit);
}

export function groupCommandPaletteItems(items, { perGroup = 7, rankedBySearch = false } = {}) {
  const buckets = new Map();
  const topScore = new Map();

  for (const item of items) {
    const label = item.group || 'Results';
    if (!buckets.has(label)) {
      buckets.set(label, []);
    }

    const groupItems = buckets.get(label);
    if (groupItems.length < perGroup) {
      groupItems.push(item);
    }
    if (!topScore.has(label)) {
      topScore.set(label, item.__score ?? item.priority ?? 0);
    }
  }

  return [...buckets.entries()]
    .sort((left, right) => {
      if (rankedBySearch) {
        const diff = (topScore.get(right[0]) ?? 0) - (topScore.get(left[0]) ?? 0);
        if (diff !== 0) return diff;
      }
      const leftIndex = GROUP_ORDER.indexOf(left[0]);
      const rightIndex = GROUP_ORDER.indexOf(right[0]);

      if (leftIndex === -1 && rightIndex === -1) {
        return left[0].localeCompare(right[0]);
      }
      if (leftIndex === -1) {
        return 1;
      }
      if (rightIndex === -1) {
        return -1;
      }
      return leftIndex - rightIndex;
    })
    .map(([label, groupedItems]) => ({ label, items: groupedItems }));
}
