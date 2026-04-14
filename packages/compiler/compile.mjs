import { cp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import matter from 'gray-matter';
import { marked } from 'marked';
import { pluginMainFile } from './lib/php/plugin-main.mjs';
import { phpHelpersFile } from './lib/php/helpers.mjs';
import { phpRegisterPostTypesFile } from './lib/php/register-post-types.mjs';
import { phpRegisterTaxonomiesFile } from './lib/php/register-taxonomies.mjs';
import { phpRegisterMetaFile } from './lib/php/register-meta.mjs';
import { phpRegisterSingletonsFile } from './lib/php/register-singletons.mjs';
import { phpRegisterRestFile } from './lib/php/register-rest.mjs';
import { phpRegisterAdminAppFile } from './lib/php/register-admin-app.mjs';
import { phpRegisterLoginStyleFile } from './lib/php/register-login-style.mjs';
import { phpSeedFile } from './lib/php/seed.mjs';

function resolveRoot() {
  const idx = process.argv.indexOf('--root');
  if (idx !== -1 && process.argv[idx + 1]) {
    return path.resolve(process.argv[idx + 1]);
  }
  return process.cwd();
}

function resolvePaths(root, site = {}) {
  const generatedRoot = path.join(root, 'generated');
  const wpContentRoot = path.join(generatedRoot, 'wp-content');
  const pluginSlug = site.plugin?.slug ?? 'portfolio-light-app';
  const themeSlug = site.theme?.slug ?? 'portfolio-light-theme';
  return {
    root,
    generatedRoot,
    wpContentRoot,
    pluginRoot: path.join(wpContentRoot, 'plugins', pluginSlug),
    themeRoot: path.join(wpContentRoot, 'themes', themeSlug),
    adminSchemaRoot: path.join(generatedRoot, 'admin-schema'),
  };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

async function readJsonDirectory(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const data = {};

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    data[path.basename(entry.name, '.json')] = await readJson(fullPath);
  }

  return data;
}

async function readHtmlDirectory(dirPath) {
  let entries = [];

  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    return {};
  }

  const data = {};

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.html')) {
      continue;
    }

    data[path.basename(entry.name, '.html')] = await readFile(path.join(dirPath, entry.name), 'utf8');
  }

  return data;
}

async function readBlockDirectory(dirPath) {
  let entries = [];

  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const blocks = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const blockJsonPath = path.join(dirPath, entry.name, 'block.json');

    try {
      const metadata = await readJson(blockJsonPath);
      blocks.push({
        name: metadata.name,
        title: metadata.title,
        category: metadata.category,
        icon: metadata.icon,
        description: metadata.description,
        attributes: metadata.attributes ?? {},
        supports: metadata.supports ?? {},
      });
    } catch {
      // Ignore folders that are not valid blocks.
    }
  }

  return blocks;
}

function serializeBlock(name, html, attributes = null) {
  const serializedAttributes =
    attributes && Object.keys(attributes).length > 0 ? ` ${JSON.stringify(attributes)}` : '';

  return `<!-- wp:${name}${serializedAttributes} -->\n${html.trim()}\n<!-- /wp:${name} -->`;
}

function tokenToBlockMarkup(token, attrOverrides = {}) {
  switch (token.type) {
    case 'paragraph':
      return serializeBlock('paragraph', marked.parser([token]).trim(), attrOverrides.paragraph || null);
    case 'heading': {
      const attributes = { ...(token.depth && token.depth !== 2 ? { level: token.depth } : {}) };
      let workingToken = token;
      const anchorMatch = /\s*\{#([a-zA-Z0-9_-]+)\}\s*$/.exec(token.text || '');
      if (anchorMatch) {
        attributes.anchor = anchorMatch[1];
        const strippedText = token.text.replace(anchorMatch[0], '').trimEnd();
        workingToken = { ...token, text: strippedText, tokens: marked.lexer(strippedText)[0]?.tokens ?? token.tokens };
      }
      if (attrOverrides.heading) Object.assign(attributes, attrOverrides.heading);
      const html = marked.parser([workingToken]).trim();
      const withAnchor = attributes.anchor
        ? html.replace(/^<h(\d)([^>]*)>/, (m, d, rest) => `<h${d}${rest} id="${attributes.anchor}">`)
        : html;
      return serializeBlock('heading', withAnchor, Object.keys(attributes).length ? attributes : null);
    }
    case 'list':
      return serializeBlock('list', marked.parser([token]).trim(), attrOverrides.list || null);
    case 'blockquote':
      return serializeBlock('quote', marked.parser([token]).trim(), attrOverrides.quote || null);
    case 'code': {
      const html = marked.parser([token]).trim();
      const attributes = { ...(token.lang ? { className: `language-${token.lang}` } : {}) };
      if (attrOverrides.code) Object.assign(attributes, attrOverrides.code);
      return serializeBlock('code', html, Object.keys(attributes).length ? attributes : null);
    }
    case 'hr':
      return '<!-- wp:separator -->\n<hr class="wp-block-separator"/>\n<!-- /wp:separator -->';
    case 'html':
      return serializeBlock('html', (token.raw ?? token.text ?? '').trim());
    default:
      return serializeBlock('html', (token.raw ?? marked.parser([token])).trim());
  }
}

function markdownToBlockMarkup(source, attrOverrides = {}) {
  const trimmed = String(source ?? '').trim();

  if (!trimmed) {
    return '';
  }

  const tokens = marked.lexer(trimmed);

  return tokens
    .filter((token) => token.type !== 'space')
    .map((token) => tokenToBlockMarkup(token, attrOverrides))
    .join('\n\n');
}

async function readMarkdownContentDirectory(dirPath) {
  let entries = [];

  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const items = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) {
      continue;
    }

    const filePath = path.join(dirPath, entry.name);
    const source = await readFile(filePath, 'utf8');
    const parsed = matter(source);

    items.push({
      ...parsed.data,
      markdown: parsed.content.trim(),
      body: markdownToBlockMarkup(parsed.content),
      sourceFile: entry.name,
    });
  }

  return items;
}

async function readContentEntries(rootDir, collections) {
  const content = {};

  for (const collection of collections) {
    content[collection.id] = await readMarkdownContentDirectory(
      path.join(rootDir, collection.directory)
    );
  }

  return content;
}

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

function singularLabel(value) {
  if (!value) {
    return '';
  }

  if (value.endsWith('ies')) {
    return `${value.slice(0, -3)}y`;
  }

  if (value.endsWith('s')) {
    return value.slice(0, -1);
  }

  return value;
}

function toTitleCase(value) {
  return value
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function getBuiltinPostModel() {
  return {
    id: 'post',
    label: 'Posts',
    singularLabel: 'Post',
    type: 'collection',
    postType: 'post',
    public: true,
    supports: ['title', 'editor', 'excerpt', 'thumbnail', 'revisions'],
    taxonomies: ['category', 'post_tag'],
    adminPath: 'posts',
    fields: {},
  };
}

function getBuiltinPageModel() {
  return {
    id: 'page',
    label: 'Pages',
    singularLabel: 'Page',
    type: 'collection',
    postType: 'page',
    public: true,
    supports: ['title', 'editor', 'excerpt', 'thumbnail', 'revisions', 'page-attributes'],
    taxonomies: [],
    adminPath: 'pages',
    fields: {},
  };
}

function fieldTypeForAdmin(field) {
  switch (field?.type) {
    case 'integer':
      return 'integer';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'email':
      return 'email';
    case 'url':
      return 'url';
    case 'image':
      return 'image';
    case 'richtext':
      return 'richtext';
    case 'relation':
      return 'relation';
    case 'repeater':
      return 'repeater';
    case 'select':
      return 'select';
    default:
      return 'text';
  }
}

function normalizeFieldDescriptor(id, field) {
  const descriptor = {
    id,
    label: field?.label ?? toTitleCase(id),
    type: fieldTypeForAdmin(field),
  };

  if (Array.isArray(field?.options)) {
    descriptor.options = field.options;
  }

  if (field?.target) {
    descriptor.target = field.target;
  }

  if (field?.item) {
    descriptor.item = field.item;
  }

  return descriptor;
}

function buildModelAdminFields(model) {
  const fields = [
    { id: 'title', label: 'Title', type: 'text' },
    { id: 'excerpt', label: 'Excerpt', type: 'text' },
    { id: 'modified', label: 'Updated', type: 'datetime' },
  ];

  for (const [fieldId, field] of Object.entries(model.fields ?? {})) {
    fields.push(normalizeFieldDescriptor(fieldId, field));
  }

  for (const taxonomy of model.taxonomies ?? []) {
    fields.push({
      id: taxonomy,
      label: toTitleCase(taxonomy),
      type: 'array',
    });
  }

  return fields;
}

function buildCollectionViewSchema(model, override) {
  const fields = buildModelAdminFields(model);
  const columns =
    override?.columns ??
    ['title', ...fields.map((field) => field.id).filter((id) => id !== 'title').slice(0, 4)];
  const filters =
    override?.filters ??
    fields
      .filter((field) => ['boolean', 'select', 'integer', 'array'].includes(field.type))
      .map((field) => field.id);

  return {
    entity: {
      kind: 'postType',
      name: model.postType,
    },
    fields,
    view: {
      type: override?.defaultLayout ?? 'table',
      columns,
      filters,
      sort: override?.defaultSort ?? {
        field: 'modified',
        direction: 'desc',
      },
    },
  };
}

function buildCollectionFormSchema(model, override) {
  const systemFields = [
    { id: 'title', label: 'Title', type: 'text' },
    { id: 'excerpt', label: 'Excerpt', type: 'text' },
    { id: 'content', label: 'Content', type: 'richtext' },
  ];
  const fields = [
    ...systemFields,
    ...buildModelAdminFields(model).filter(
      (field) => !['title', 'excerpt', 'modified'].includes(field.id)
    ),
  ];
  const fieldMap = Object.fromEntries(fields.map((f) => [f.id, f]));
  const defaultGroups = [];
  const remaining = fields.map((field) => field.id);

  while (remaining.length > 0) {
    const chunk = remaining.splice(0, 4);
    const groupLabel = remaining.length === 0 && defaultGroups.length === 0
      ? toTitleCase(model.id)
      : chunk.map((id) => fieldMap[id]?.label ?? toTitleCase(id)).slice(0, 2).join(' & ');
    defaultGroups.push({
      id: `section-${defaultGroups.length + 1}`,
      label: groupLabel,
      children: chunk,
    });
  }

  return {
    entity: {
      kind: 'postType',
      name: model.postType,
    },
    fields,
    form: override?.layout ?? {
      type: 'card',
      children: defaultGroups,
    },
  };
}

function buildSingletonFormSchema(singleton, override) {
  const fields = Object.entries(singleton.fields ?? {}).map(([fieldId, field]) =>
    normalizeFieldDescriptor(fieldId, field)
  );
  const fieldMap = Object.fromEntries(fields.map((f) => [f.id, f]));
  const groups = [];
  const remaining = fields.map((field) => field.id);

  while (remaining.length > 0) {
    const chunk = remaining.splice(0, 4);
    const groupLabel = remaining.length === 0 && groups.length === 0
      ? (singleton.label ?? toTitleCase(singleton.id))
      : chunk.map((id) => fieldMap[id]?.label ?? toTitleCase(id)).slice(0, 2).join(' & ');
    groups.push({
      id: `section-${groups.length + 1}`,
      label: groupLabel,
      children: chunk,
    });
  }

  return {
    entity: {
      kind: 'singleton',
      name: singleton.id,
    },
    fields,
    form: override?.layout ?? {
      type: 'card',
      children: groups,
    },
  };
}

function buildMenuLinkUrl(item, { routesById, modelsById }) {
  if (item.type === 'page') {
    const route = routesById.get(item.object);
    if (!route) {
      return '#';
    }

    return route.slug ? `/${route.slug}/` : '/';
  }

  if (item.type === 'archive') {
    const model = modelsById.get(item.object);
    if (!model) {
      return '#';
    }

    return model.archiveSlug ? `/${model.archiveSlug}/` : `/${pluralize(model.id)}/`;
  }

  if (item.type === 'url') {
    return item.url ?? '#';
  }

  return '#';
}

function compileNavigationMarkup(menuItems, { routes, models }) {
  const routesById = new Map(routes.map((route) => [route.id, route]));
  const modelsById = new Map(models.map((model) => [model.id, model]));
  const itemsMarkup = (menuItems ?? [])
    .map((item) => {
      const url = buildMenuLinkUrl(item, { routesById, modelsById });
      return `\t\t\t\t<!-- wp:navigation-link {"label":"${String(item.label ?? '').replace(/"/g, '\\"')}","type":"custom","url":"${url}","kind":"custom","isTopLevelLink":true} /-->`;
    })
    .join('\n');

  return `<!-- wp:navigation {"layout":{"type":"flex","justifyContent":"right"}} -->
<nav class="wp-block-navigation">
${itemsMarkup}
</nav>
<!-- /wp:navigation -->`;
}

function compileNavigationTemplate(source, menuItems, siteSchema) {
  const navigationMarkup = compileNavigationMarkup(menuItems ?? [], {
    routes: siteSchema.routes ?? [],
    models: siteSchema.models ?? [],
  });

  return source.replace(
    /<!-- wp:navigation [\s\S]*?\/-->/,
    navigationMarkup
  );
}

function resolvePatternName(slug) {
  return String(slug ?? '').split('/').pop() ?? '';
}

function expandTemplateReferences(source, assets, stack = []) {
  if (!source) {
    return '';
  }

  let output = source;

  output = output.replace(/<!--\s+wp:template-part\s+({[\s\S]*?})\s+\/-->/g, (match, rawAttrs) => {
    const attrs = JSON.parse(rawAttrs);
    const slug = String(attrs.slug ?? '');
    const key = `part:${slug}`;

    if (!slug || !assets.parts[slug]) {
      return '';
    }

    if (stack.includes(key)) {
      throw new Error(`Template cycle detected: ${[...stack, key].join(' -> ')}`);
    }

    return expandTemplateReferences(assets.parts[slug], assets, [...stack, key]);
  });

  output = output.replace(/<!--\s+wp:pattern\s+({[\s\S]*?})\s+\/-->/g, (match, rawAttrs) => {
    const attrs = JSON.parse(rawAttrs);
    const patternName = resolvePatternName(attrs.slug);
    const key = `pattern:${patternName}`;

    if (!patternName || !assets.patterns[patternName]) {
      return '';
    }

    if (stack.includes(key)) {
      throw new Error(`Template cycle detected: ${[...stack, key].join(' -> ')}`);
    }

    return expandTemplateReferences(assets.patterns[patternName], assets, [...stack, key]);
  });

  return output;
}

function resolveSingleTemplateName(postType, templates) {
  const candidates = [
    postType === 'page' ? 'page' : null,
    `single-${postType}`,
    postType === 'post' ? 'single' : null,
    'single',
  ].filter(Boolean);

  return candidates.find((name) => templates[name]) ?? '';
}

async function buildEditorTemplates(themeSourceRoot, siteSchema) {
  const templates = await readHtmlDirectory(path.join(themeSourceRoot, 'templates'));
  const rawParts = await readHtmlDirectory(path.join(themeSourceRoot, 'parts'));
  const patterns = await readHtmlDirectory(path.join(themeSourceRoot, 'patterns'));
  const parts = Object.fromEntries(
    Object.entries(rawParts).map(([name, markup]) => {
      const menuItems =
        name === 'header'
          ? siteSchema.menus?.primary ?? []
          : name === 'footer'
            ? siteSchema.menus?.footer ?? []
            : null;

      return [
        name,
        menuItems ? compileNavigationTemplate(markup, menuItems, siteSchema) : markup,
      ];
    })
  );
  const assets = { templates, parts, patterns };

  const namedTemplates = Object.fromEntries(
    Object.keys(templates).map((name) => [
      name,
      {
        name,
        markup: expandTemplateReferences(templates[name], assets),
      },
    ])
  );

  const routeTemplates = Object.fromEntries(
    (siteSchema.routes ?? [])
      .filter((route) => route.type === 'page')
      .map((route) => {
        const templateName = route.template || 'page';
        return [
          route.id,
          {
            routeId: route.id,
            template: templateName,
            markup: namedTemplates[templateName]?.markup ?? namedTemplates.page?.markup ?? '',
          },
        ];
      })
  );

  const postTypeTemplates = {
    page: {
      template: 'page',
      markup: namedTemplates.page?.markup ?? '',
    },
    post: {
      template: resolveSingleTemplateName('post', templates),
      markup: namedTemplates[resolveSingleTemplateName('post', templates)]?.markup ?? '',
    },
  };

  for (const model of siteSchema.models ?? []) {
    if (!model?.postType || !model?.supports?.includes('editor')) {
      continue;
    }

    const templateName = resolveSingleTemplateName(model.postType, templates);
    if (!templateName) {
      continue;
    }

    postTypeTemplates[model.postType] = {
      template: templateName,
      markup: namedTemplates[templateName]?.markup ?? '',
    };
  }

  return {
    routes: routeTemplates,
    templates: namedTemplates,
    postTypes: postTypeTemplates,
  };
}

async function copyThemeSource(themeSourceRoot, themeTargetRoot, themeSlug, siteSchema) {
  await ensureDir(themeTargetRoot);
  await cp(themeSourceRoot, themeTargetRoot, { recursive: true });
  let themeStylesheet = '';
  try {
    themeStylesheet = await readFile(path.join(themeSourceRoot, 'style.css'), 'utf8');
  } catch {
    themeStylesheet = '';
  }
  await writeFile(
    path.join(themeTargetRoot, 'style.css'),
    `/*\nTheme Name: ${toTitleCase(themeSlug)}\n*/\n\n${themeStylesheet}`
  );
  await writeFile(
    path.join(themeTargetRoot, 'functions.php'),
    `<?php\nadd_action( 'init', function() {\n\tregister_block_pattern_category( '${themeSlug}', [\n\t\t'label' => __( '${toTitleCase(
      themeSlug
    )}', '${themeSlug}' ),\n\t] );\n} );\n\nadd_action( 'wp_enqueue_scripts', function() {\n\t$stylesheet = get_stylesheet_directory() . '/style.css';\n\twp_enqueue_style(\n\t\t'${themeSlug}-theme',\n\t\tget_stylesheet_uri(),\n\t\t[],\n\t\tfile_exists( $stylesheet ) ? (string) filemtime( $stylesheet ) : wp_get_theme()->get( 'Version' )\n\t);\n} );\n\nadd_action(\n\t'wp_footer',\n\tfunction() {\n\t\t?>\n<script>\n(function() {\n\tconst endpoint = <?php echo wp_json_encode( rest_url( 'portfolio/v1/dev-state' ) ); ?>;\n\tlet currentVersion = null;\n\n\tasync function checkDevState() {\n\t\ttry {\n\t\t\tconst response = await fetch(endpoint, {\n\t\t\t\tcache: 'no-store',\n\t\t\t\tcredentials: 'same-origin',\n\t\t\t});\n\t\t\tif (!response.ok) {\n\t\t\t\treturn;\n\t\t\t}\n\n\t\t\tconst payload = await response.json();\n\t\t\tif (!payload?.enabled || !payload.version) {\n\t\t\t\treturn;\n\t\t\t}\n\n\t\t\tif (currentVersion && currentVersion !== payload.version) {\n\t\t\t\twindow.location.reload();\n\t\t\t\treturn;\n\t\t\t}\n\n\t\t\tcurrentVersion = payload.version;\n\t\t} catch (error) {\n\t\t\t// Keep polling quietly during local development.\n\t\t}\n\t}\n\n\tcheckDevState();\n\twindow.setInterval(checkDevState, 1500);\n})();\n</script>\n<?php\n\t},\n\t100\n);\n`
  );

  const headerPath = path.join(themeTargetRoot, 'parts', 'header.html');
  try {
    const headerSource = await readFile(headerPath, 'utf8');
    await writeFile(
      headerPath,
      compileNavigationTemplate(headerSource, siteSchema.menus.primary ?? [], siteSchema)
    );
  } catch {
    // Ignore themes without a header part.
  }

  const footerPath = path.join(themeTargetRoot, 'parts', 'footer.html');
  try {
    const footerSource = await readFile(footerPath, 'utf8');
    await writeFile(
      footerPath,
      compileNavigationTemplate(footerSource, siteSchema.menus.footer ?? [], siteSchema)
    );
  } catch {
    // Ignore themes without a footer part.
  }

  const patternsDir = path.join(themeSourceRoot, 'patterns');
  const generatedPatternsDir = path.join(themeTargetRoot, 'patterns');
  const patternEntries = await readdir(patternsDir, { withFileTypes: true });

  for (const entry of patternEntries) {
    if (!entry.isFile() || !entry.name.endsWith('.html')) {
      continue;
    }

    const fileName = path.basename(entry.name, '.html');
    const source = await readFile(path.join(patternsDir, entry.name), 'utf8');
    const pattern = `<?php\n/**\n * Title: ${toTitleCase(fileName)}\n * Slug: ${themeSlug}/${fileName}\n * Categories: ${themeSlug}\n * Inserter: yes\n */\n?>\n${source}\n`;
    await writeFile(path.join(generatedPatternsDir, `${fileName}.php`), pattern);
    await rm(path.join(generatedPatternsDir, entry.name), { force: true });
  }
}

function compilerSelfHash() {
  // Cheap invariant: fall back to full rebuild if compiler source changes.
  return createHash('sha1')
    .update(phpSeedFile())
    .update(phpHelpersFile())
    .update(phpRegisterPostTypesFile())
    .update(phpRegisterTaxonomiesFile())
    .update(phpRegisterMetaFile())
    .update(phpRegisterSingletonsFile())
    .update(phpRegisterRestFile())
    .update(phpRegisterAdminAppFile())
    .update(phpRegisterLoginStyleFile())
    .update(loginStyleCss())
    .digest('hex');
}

async function computeInputHashes(root) {
  const [app, content, theme, blocks, admin, adminApp, pkg] = await Promise.all([
    hashPath(path.join(root, 'app')),
    hashPath(path.join(root, 'content')),
    hashPath(path.join(root, 'theme')),
    hashPath(path.join(root, 'blocks')),
    hashPath(path.join(root, 'admin')),
    hashPath(path.join(path.dirname(new URL(import.meta.url).pathname), 'admin-app')),
    hashPath(path.join(root, 'package.json')),
  ]);

  return {
    app,
    content,
    theme,
    blocks,
    admin,
    adminApp,
    pkg,
    compiler: compilerSelfHash(),
  };
}

async function readCompileCache(generatedRoot) {
  try {
    return JSON.parse(await readFile(path.join(generatedRoot, '.compile-cache.json'), 'utf8'));
  } catch {
    return null;
  }
}

async function writeCompileCache(generatedRoot, hashes) {
  await writeFile(
    path.join(generatedRoot, '.compile-cache.json'),
    `${JSON.stringify(hashes, null, 2)}\n`
  );
}

async function pathExists(p) {
  try {
    await readdir(p);
    return true;
  } catch {
    return false;
  }
}

async function computeBuildArtifacts(root) {
  const site = await readJson(path.join(root, 'app', 'site.json'));
  const paths = resolvePaths(root, site);

  const models = Object.values(await readJsonDirectory(path.join(root, 'app', 'models'))).map(
    (model) => ({
      singularLabel: singularLabel(model.label),
      adminPath: pluralize(model.id),
      ...model,
    })
  );
  const singletons = Object.values(
    await readJsonDirectory(path.join(root, 'app', 'singletons'))
  );
  const routes = Object.values(await readJsonDirectory(path.join(root, 'app', 'routes')));
  const menus = await readJsonDirectory(path.join(root, 'app', 'menus'));
  const contentSources = [
    ...models
      .filter((model) => model.type === 'collection')
      .map((model) => ({ id: model.id, directory: pluralize(model.id) })),
    { id: 'page', directory: 'pages' },
    { id: 'post', directory: 'posts' },
  ];
  const contentCollections = await readContentEntries(path.join(root, 'content'), contentSources);
  const contentSingletons = await readJsonDirectory(path.join(root, 'content', 'singletons'));
  const adminOverrides = await readJsonDirectory(path.join(root, 'admin'));
  const blocks = await readBlockDirectory(path.join(root, 'blocks'));
  const editorTemplates = await buildEditorTemplates(path.join(root, 'theme'), { models, routes, menus });

  const siteSchema = {
    site,
    blocks,
    models,
    singletons,
    routes,
    menus,
    editorTemplates,
    content: {
      collections: Object.fromEntries(
        contentSources.map((source) => [source.id, contentCollections[source.id] ?? []])
      ),
      singletons: Object.fromEntries(
        Object.entries(contentSingletons).map(([key, value]) => [key, value])
      ),
    },
    admin: adminOverrides,
  };

  const adminSchemas = {};
  for (const model of models) {
    adminSchemas[`${model.id}.view.json`] = buildCollectionViewSchema(model, adminOverrides[`${model.id}.view`]);
    adminSchemas[`${model.id}.form.json`] = buildCollectionFormSchema(model, adminOverrides[`${model.id}.form`]);
  }
  for (const singleton of singletons) {
    adminSchemas[`${singleton.id}.form.json`] = buildSingletonFormSchema(
      singleton,
      adminOverrides[`settings-${singleton.id}.form`] ?? adminOverrides[`${singleton.id}.form`]
    );
  }
  const builtinPostModel = getBuiltinPostModel();
  adminSchemas['post.view.json'] = buildCollectionViewSchema(builtinPostModel, adminOverrides['post.view']);
  adminSchemas['post.form.json'] = buildCollectionFormSchema(builtinPostModel, adminOverrides['post.form']);

  return { site, paths, siteSchema, adminSchemas };
}

async function emitSchemaArtifacts(root, generatedRoot, site, siteSchema, adminSchemas) {
  const paths = resolvePaths(root, site);
  // Rebase paths onto generatedRoot (since callers may pass a tmp dir).
  const rebased = {
    root,
    generatedRoot,
    wpContentRoot: path.join(generatedRoot, 'wp-content'),
    pluginRoot: path.join(generatedRoot, 'wp-content', 'plugins', site.plugin?.slug ?? paths.pluginRoot.split(path.sep).pop()),
    themeRoot: path.join(generatedRoot, 'wp-content', 'themes', site.theme?.slug ?? paths.themeRoot.split(path.sep).pop()),
    adminSchemaRoot: path.join(generatedRoot, 'admin-schema'),
  };

  await ensureDir(rebased.adminSchemaRoot);
  for (const [fileName, schema] of Object.entries(adminSchemas)) {
    await writeFile(path.join(rebased.adminSchemaRoot, fileName), JSON.stringify(schema, null, 2));
  }

  await ensureDir(generatedRoot);
  await writeFile(
    path.join(generatedRoot, 'blueprint.json'),
    await readFile(path.join(root, 'build', 'blueprint.json'), 'utf8')
  );
  await writeFile(
    path.join(generatedRoot, 'site-schema.json'),
    JSON.stringify(siteSchema, null, 2)
  );

  await writeGeneratedPlugin(siteSchema, adminSchemas, site, rebased);
  return rebased;
}

async function emitThemeArtifacts(root, generatedRoot, site, siteSchema) {
  const themeRoot = path.join(generatedRoot, 'wp-content', 'themes', site.theme.slug);
  await rm(themeRoot, { recursive: true, force: true });
  await copyThemeSource(path.join(root, 'theme'), themeRoot, site.theme.slug, siteSchema);
}

async function emitContentArtifacts(generatedRoot, site, siteSchema) {
  // Content lives entirely inside site-schema.json (seeded at activation by PHP).
  const pluginSlug = site.plugin?.slug ?? 'wp-light-app';
  const compiledDir = path.join(generatedRoot, 'wp-content', 'plugins', pluginSlug, 'compiled');
  await ensureDir(compiledDir);
  await writeFile(path.join(compiledDir, 'site-schema.json'), JSON.stringify(siteSchema, null, 2));
  await writeFile(path.join(generatedRoot, 'site-schema.json'), JSON.stringify(siteSchema, null, 2));
}

async function runFullBuild(root, site, paths, hashes) {
  const tmpRoot = `${paths.generatedRoot}.tmp-${process.pid}`;
  await rm(tmpRoot, { recursive: true, force: true });
  await ensureDir(tmpRoot);

  try {
    const { siteSchema, adminSchemas } = await computeBuildArtifacts(root);

    await emitSchemaArtifacts(root, tmpRoot, site, siteSchema, adminSchemas);
    await emitThemeArtifacts(root, tmpRoot, site, siteSchema);

    // Preserve prior admin-app build if present (not part of schema artifacts).
    const priorBuildDir = path.join(paths.pluginRoot, 'build');
    const tmpPluginBuildDir = path.join(tmpRoot, 'wp-content', 'plugins', site.plugin?.slug ?? 'wp-light-app', 'build');
    try {
      await cp(priorBuildDir, tmpPluginBuildDir, { recursive: true });
    } catch {}

    await writeCompileCache(tmpRoot, hashes);

    const oldRoot = `${paths.generatedRoot}.old-${process.pid}`;
    const prevExists = await pathExists(paths.generatedRoot);
    if (prevExists) {
      await rename(paths.generatedRoot, oldRoot);
    }
    try {
      await rename(tmpRoot, paths.generatedRoot);
    } catch (err) {
      if (prevExists) {
        await rename(oldRoot, paths.generatedRoot);
      }
      throw err;
    }
    if (prevExists) {
      await rm(oldRoot, { recursive: true, force: true });
    }
  } catch (err) {
    await rm(tmpRoot, { recursive: true, force: true });
    throw err;
  }
}

async function build(root) {
  root = root || resolveRoot();
  const site = await readJson(path.join(root, 'app', 'site.json'));
  const paths = resolvePaths(root, site);

  const hashes = await computeInputHashes(root);
  const prior = await readCompileCache(paths.generatedRoot);

  const needsFull =
    !prior ||
    !(await pathExists(paths.generatedRoot)) ||
    prior.compiler !== hashes.compiler ||
    prior.pkg !== hashes.pkg;

  if (needsFull) {
    await runFullBuild(root, site, paths, hashes);
  } else {
    const changed = {
      app: prior.app !== hashes.app,
      content: prior.content !== hashes.content,
      theme: prior.theme !== hashes.theme,
      blocks: prior.blocks !== hashes.blocks,
      admin: prior.admin !== hashes.admin,
      adminApp: prior.adminApp !== hashes.adminApp,
    };

    const anyChanged = Object.values(changed).some(Boolean);

    if (!anyChanged) {
      return {
        generatedRoot: paths.generatedRoot,
        pluginRoot: paths.pluginRoot,
        themeRoot: paths.themeRoot,
        incremental: { skipped: true },
      };
    }

    try {
      const { siteSchema, adminSchemas } = await computeBuildArtifacts(root);

      if (changed.app || changed.admin || changed.blocks) {
        await emitSchemaArtifacts(root, paths.generatedRoot, site, siteSchema, adminSchemas);
      } else if (changed.content) {
        await emitContentArtifacts(paths.generatedRoot, site, siteSchema);
      }

      if (changed.theme) {
        await emitThemeArtifacts(root, paths.generatedRoot, site, siteSchema);
      }

      if (changed.blocks) {
        const pluginBlocks = path.join(paths.pluginRoot, 'blocks');
        await rm(pluginBlocks, { recursive: true, force: true });
        await cp(path.join(root, 'blocks'), pluginBlocks, { recursive: true });
      }

      await writeCompileCache(paths.generatedRoot, hashes);
      return {
        generatedRoot: paths.generatedRoot,
        pluginRoot: paths.pluginRoot,
        themeRoot: paths.themeRoot,
        incremental: changed,
      };
    } catch (err) {
      // Fall back to a full rebuild if anything goes wrong incrementally.
      await runFullBuild(root, site, paths, hashes);
    }
  }

  return {
    generatedRoot: paths.generatedRoot,
    pluginRoot: paths.pluginRoot,
    themeRoot: paths.themeRoot,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  build()
    .then((result) => {
      process.stdout.write(
        `Built wp-light artifacts.\nPlugin: ${result.pluginRoot}\nTheme: ${result.themeRoot}\n`
      );
    })
    .catch((error) => {
      process.stderr.write(`${error.stack || error.message}\n`);
      process.exitCode = 1;
    });
}

export { build, resolveRoot };
