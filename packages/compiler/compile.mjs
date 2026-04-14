import { cp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import matter from 'gray-matter';
import { marked } from 'marked';

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

function pluginMainFile(site = {}) {
  const pluginName = toTitleCase(site.plugin?.slug ?? 'wp-light-app');
  const siteTitle = site.title ?? 'WP Light';
  return `<?php
/**
 * Plugin Name: ${pluginName}
 * Description: Generated runtime for ${siteTitle}.
 */

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/inc/helpers.php';
require_once __DIR__ . '/inc/register-post-types.php';
require_once __DIR__ . '/inc/register-taxonomies.php';
require_once __DIR__ . '/inc/register-meta.php';
require_once __DIR__ . '/inc/register-singletons.php';
require_once __DIR__ . '/inc/register-rest.php';
require_once __DIR__ . '/inc/register-admin-app.php';
require_once __DIR__ . '/inc/register-login-style.php';
require_once __DIR__ . '/inc/seed.php';

add_action( 'init', function() {
\tforeach ( portfolio_light_get_block_dirs() as $block_dir ) {
\t\tif ( file_exists( $block_dir . '/block.json' ) ) {
\t\t\tregister_block_type( $block_dir );
\t\t}
\t}
} );

register_activation_hook(
\t__FILE__,
\tfunction() {
\t\tportfolio_light_seed_site();
\t\tflush_rewrite_rules();
\t}
);

register_deactivation_hook(
\t__FILE__,
\tfunction() {
\t\tflush_rewrite_rules();
\t}
);
`;
}

function phpHelpersFile() {
  return `<?php
defined( 'ABSPATH' ) || exit;

function portfolio_light_get_compiled_site_path() {
\treturn dirname( __DIR__ ) . '/compiled/site-schema.json';
}

function portfolio_light_get_compiled_site() {
\tstatic $compiled = null;

\tif ( null !== $compiled ) {
\t\treturn $compiled;
\t}

\t$path = portfolio_light_get_compiled_site_path();
\tif ( ! file_exists( $path ) ) {
\t\t$compiled = [];
\t\treturn $compiled;
\t}

\t$contents = file_get_contents( $path );
\t$compiled = json_decode( $contents, true ) ?: [];

\treturn $compiled;
}

function portfolio_light_get_compiled_generated_at() {
\t$path = portfolio_light_get_compiled_site_path();
\tif ( ! file_exists( $path ) ) {
\t\treturn null;
\t}

\t$timestamp = filemtime( $path );
\tif ( false === $timestamp ) {
\t\treturn null;
\t}

\treturn gmdate( DATE_ATOM, $timestamp );
}

function portfolio_light_get_site_config() {
\t$compiled = portfolio_light_get_compiled_site();
\treturn $compiled['site'] ?? [];
}

function portfolio_light_get_builtin_post_model() {
\treturn [
\t\t'id'            => 'post',
\t\t'label'         => 'Posts',
\t\t'singularLabel' => 'Post',
\t\t'type'          => 'collection',
\t\t'postType'      => 'post',
\t\t'public'        => true,
\t\t'supports'      => [ 'title', 'editor', 'excerpt', 'thumbnail', 'revisions' ],
\t\t'taxonomies'    => [ 'category', 'post_tag' ],
\t\t'adminPath'     => 'posts',
\t\t'fields'        => [],
\t];
}

function portfolio_light_get_builtin_page_model() {
\treturn [
\t\t'id'            => 'page',
\t\t'label'         => 'Pages',
\t\t'singularLabel' => 'Page',
\t\t'type'          => 'collection',
\t\t'postType'      => 'page',
\t\t'public'        => true,
\t\t'supports'      => [ 'title', 'editor', 'excerpt', 'thumbnail', 'revisions', 'page-attributes' ],
\t\t'taxonomies'    => [],
\t\t'adminPath'     => 'pages',
\t\t'fields'        => [],
\t];
}

function portfolio_light_get_models() {
\t$compiled = portfolio_light_get_compiled_site();
\treturn $compiled['models'] ?? [];
}

function portfolio_light_get_model( $id ) {
\tif ( 'post' === $id ) {
\t\treturn portfolio_light_get_builtin_post_model();
\t}
\tif ( 'page' === $id ) {
\t\treturn portfolio_light_get_builtin_page_model();
\t}

\tforeach ( portfolio_light_get_models() as $model ) {
\t\tif ( ( $model['id'] ?? '' ) === $id ) {
\t\t\treturn $model;
\t\t}
\t}

\treturn null;
}

function portfolio_light_get_admin_models() {
\t$models = portfolio_light_get_models();
\t$models[] = portfolio_light_get_builtin_post_model();
\treturn $models;
}

function portfolio_light_get_singletons() {
\t$compiled = portfolio_light_get_compiled_site();
\treturn $compiled['singletons'] ?? [];
}

function portfolio_light_get_singleton_schema( $id ) {
\tforeach ( portfolio_light_get_singletons() as $singleton ) {
\t\tif ( ( $singleton['id'] ?? '' ) === $id ) {
\t\t\treturn $singleton;
\t\t}
\t}

\treturn null;
}

function portfolio_light_get_routes() {
\t$compiled = portfolio_light_get_compiled_site();
\treturn $compiled['routes'] ?? [];
}

function portfolio_light_get_route( $id ) {
\tforeach ( portfolio_light_get_routes() as $route ) {
\t\tif ( ( $route['id'] ?? '' ) === $id ) {
\t\t\treturn $route;
\t\t}
\t}

\treturn null;
}

function portfolio_light_get_blocks() {
\t$compiled = portfolio_light_get_compiled_site();
\treturn $compiled['blocks'] ?? [];
}

function portfolio_light_get_menus() {
\t$compiled = portfolio_light_get_compiled_site();
\treturn $compiled['menus'] ?? [];
}

function portfolio_light_get_editor_templates() {
\t$compiled = portfolio_light_get_compiled_site();
\treturn $compiled['editorTemplates'] ?? [];
}

function portfolio_light_get_content_collections() {
\t$compiled = portfolio_light_get_compiled_site();
\treturn $compiled['content']['collections'] ?? [];
}

function portfolio_light_get_content_singletons() {
\t$compiled = portfolio_light_get_compiled_site();
\treturn $compiled['content']['singletons'] ?? [];
}

function portfolio_light_get_theme_json() {
\t$path = get_stylesheet_directory() . '/theme.json';
\tif ( ! file_exists( $path ) ) {
\t\treturn null;
\t}
\treturn json_decode( file_get_contents( $path ), true );
}

function portfolio_light_get_theme_css() {
\t$path = get_stylesheet_directory() . '/style.css';
\tif ( ! file_exists( $path ) ) {
\t\treturn '';
\t}
\treturn (string) file_get_contents( $path );
}

function portfolio_light_get_admin_schema( $name, $suffix ) {
\t$path = dirname( __DIR__ ) . '/compiled/admin-schema/' . $name . '.' . $suffix . '.json';
\tif ( ! file_exists( $path ) ) {
\t\treturn null;
\t}

\treturn json_decode( file_get_contents( $path ), true );
}

function portfolio_light_get_dev_state() {
\tstatic $state = null;

\tif ( null !== $state ) {
\t\treturn $state;
\t}

\t$path = dirname( __DIR__ ) . '/compiled/dev-state.json';
\tif ( ! file_exists( $path ) ) {
\t\t$state = [
\t\t\t'enabled' => false,
\t\t\t'version' => null,
\t\t\t'heartbeatAt' => null,
\t\t];
\t\treturn $state;
\t}

\t$decoded = json_decode( file_get_contents( $path ), true );
\tif ( ! is_array( $decoded ) ) {
\t\t$decoded = [];
\t}

\t$state = array_merge(
\t\t[
\t\t\t'enabled' => false,
\t\t\t'version' => null,
\t\t\t'heartbeatAt' => null,
\t\t],
\t\t$decoded
\t);

\t$heartbeat = ! empty( $state['heartbeatAt'] ) ? strtotime( $state['heartbeatAt'] ) : false;
\tif ( ! $heartbeat || ( time() - $heartbeat ) > 6 ) {
\t\t$state['enabled'] = false;
\t}

\treturn $state;
}

function portfolio_light_get_admin_navigation() {
\t$navigation = [
\t\t[
\t\t\t'id'    => 'dashboard',
\t\t\t'label' => 'Dashboard',
\t\t\t'path'  => '/',
\t\t\t'kind'  => 'dashboard',
\t\t],
\t];

\tforeach ( portfolio_light_get_admin_models() as $model ) {
\t\t$nav_item = [
\t\t\t'id'       => $model['id'],
\t\t\t'label'    => $model['label'],
\t\t\t'path'     => '/' . ( $model['adminPath'] ?? $model['id'] ),
\t\t\t'kind'     => 'collection',
\t\t\t'resource' => $model['id'],
\t\t];
\t\tif ( ! empty( $model['icon'] ) ) {
\t\t\t$nav_item['icon'] = $model['icon'];
\t\t}
\t\t$navigation[] = $nav_item;
\t}

\tforeach ( portfolio_light_get_singletons() as $singleton ) {
\t\t$nav_item = [
\t\t\t'id'       => $singleton['id'],
\t\t\t'label'    => $singleton['label'],
\t\t\t'path'     => '/settings/' . $singleton['id'],
\t\t\t'kind'     => 'singleton',
\t\t\t'resource' => $singleton['id'],
\t\t];
\t\tif ( ! empty( $singleton['icon'] ) ) {
\t\t\t$nav_item['icon'] = $singleton['icon'];
\t\t}
\t\t$navigation[] = $nav_item;
\t}

\treturn $navigation;
}

function portfolio_light_get_block_dirs() {
\t$plugin_root = dirname( __DIR__ );
\t$entries     = glob( $plugin_root . '/blocks/*', GLOB_ONLYDIR ) ?: [];
\treturn array_values( $entries );
}

function portfolio_light_field_meta_type( $field ) {
\t$type = $field['type'] ?? 'text';

\tswitch ( $type ) {
\t\tcase 'integer':
\t\tcase 'relation':
\t\t\treturn 'integer';
\t\tcase 'boolean':
\t\t\treturn 'boolean';
\t\tcase 'repeater':
\t\t\treturn 'array';
\t\tdefault:
\t\t\treturn 'string';
\t}
}

function portfolio_light_cast_field_value( $field, $value ) {
\t$type = $field['type'] ?? 'text';

\tif ( null === $value ) {
\t\treturn null;
\t}

\tswitch ( $type ) {
\t\tcase 'integer':
\t\tcase 'image':
\t\t\treturn '' === $value ? '' : (int) $value;
\t\tcase 'relation':
\t\t\treturn portfolio_light_resolve_relation_value( $field, $value );
\t\tcase 'boolean':
\t\t\treturn ! empty( $value );
\t\tcase 'repeater':
\t\t\tif ( is_array( $value ) ) {
\t\t\t\treturn array_map(
\t\t\t\t\tfunction( $item ) {
\t\t\t\t\t\treturn [
\t\t\t\t\t\t\t'label' => sanitize_text_field( $item['label'] ?? '' ),
\t\t\t\t\t\t\t'value' => sanitize_text_field( $item['value'] ?? '' ),
\t\t\t\t\t\t];
\t\t\t\t\t},
\t\t\t\t\t$value
\t\t\t\t);
\t\t\t}
\t\t\treturn [];
\t\tcase 'richtext':
\t\t\treturn wp_kses_post( $value );
\t\tcase 'email':
\t\t\treturn sanitize_email( $value );
\t\tcase 'url':
\t\t\treturn esc_url_raw( $value );
\t\tcase 'select':
\t\t\treturn sanitize_text_field( $value );
\t\tdefault:
\t\t\treturn sanitize_text_field( is_string( $value ) ? $value : wp_json_encode( $value ) );
\t}
}

function portfolio_light_prepare_record( $post, $model ) {
\t$record = [
\t\t'id'         => (int) $post->ID,
\t\t'title'      => $post->post_title,
\t\t'slug'       => $post->post_name,
\t\t'postStatus' => $post->post_status,
\t\t'content'    => $post->post_content,
\t\t'excerpt'    => $post->post_excerpt,
\t\t'date'       => get_post_time( DATE_ATOM, true, $post ),
\t\t'modified'   => get_post_modified_time( DATE_ATOM, true, $post ),
\t\t'link'       => get_permalink( $post ),
\t];

\tforeach ( $model['fields'] ?? [] as $field_id => $field ) {
\t\t$value = get_post_meta( $post->ID, $field_id, true );
\t\tif ( 'boolean' === ( $field['type'] ?? '' ) ) {
\t\t\t$value = ! empty( $value );
\t\t}
\t\t$record[ $field_id ] = $value;
\t}

\tforeach ( $model['taxonomies'] ?? [] as $taxonomy ) {
\t\t$terms = wp_get_post_terms( $post->ID, $taxonomy, [ 'fields' => 'names' ] );
\t\t$record[ $taxonomy ] = is_wp_error( $terms ) ? [] : array_values( $terms );
\t}

\treturn $record;
}

function portfolio_light_prepare_page_record( $post ) {
\treturn [
\t\t'id'         => (int) $post->ID,
\t\t'routeId'    => (string) get_post_meta( $post->ID, '_portfolio_route_id', true ),
\t\t'sourceId'   => (string) get_post_meta( $post->ID, '_portfolio_source_id', true ),
\t\t'title'      => $post->post_title,
\t\t'slug'       => $post->post_name,
\t\t'postStatus' => $post->post_status,
\t\t'content'    => $post->post_content,
\t\t'excerpt'    => $post->post_excerpt,
\t\t'parent'     => (int) $post->post_parent,
\t\t'template'   => (string) get_post_meta( $post->ID, '_wp_page_template', true ),
\t\t'menuOrder'  => (int) $post->menu_order,
\t\t'link'       => get_permalink( $post ),
\t\t'date'       => get_post_time( DATE_ATOM, true, $post ),
\t\t'modified'   => get_post_modified_time( DATE_ATOM, true, $post ),
\t];
}

function portfolio_light_resolve_relation_value( $field, $value ) {
\t$target_id = $field['target'] ?? '';
\tif ( ! $target_id ) {
\t\treturn is_numeric( $value ) ? (int) $value : 0;
\t}

\tif ( is_numeric( $value ) ) {
\t\treturn (int) $value;
\t}

\t$target_model = portfolio_light_get_model( $target_id );
\tif ( ! $target_model ) {
\t\treturn 0;
\t}

\tif ( is_string( $value ) && false !== strpos( $value, '.' ) ) {
\t\t$results = get_posts(
\t\t\t[
\t\t\t\t'post_type'      => $target_model['postType'],
\t\t\t\t'posts_per_page' => 1,
\t\t\t\t'post_status'    => 'any',
\t\t\t\t'meta_query'     => [
\t\t\t\t\t[
\t\t\t\t\t\t'key'   => '_portfolio_source_id',
\t\t\t\t\t\t'value' => $value,
\t\t\t\t\t],
\t\t\t\t],
\t\t\t]
\t\t);
\t\tif ( ! empty( $results ) ) {
\t\t\treturn (int) $results[0]->ID;
\t\t}
\t}

\t$existing = get_page_by_path( sanitize_title( $value ), OBJECT, $target_model['postType'] );
\treturn $existing ? (int) $existing->ID : 0;
}

function portfolio_light_upsert_record( $model, $payload, $existing_id = 0 ) {
\t$postarr = [
\t\t'post_type'    => $model['postType'],
\t\t'post_status'  => sanitize_key( $payload['postStatus'] ?? 'publish' ),
\t\t'post_title'   => sanitize_text_field( $payload['title'] ?? '' ),
\t\t'post_excerpt' => sanitize_textarea_field( $payload['excerpt'] ?? '' ),
\t\t'post_content' => wp_kses_post( $payload['content'] ?? '' ),
\t];

\tif ( ! empty( $payload['slug'] ) ) {
\t\t$postarr['post_name'] = sanitize_title( $payload['slug'] );
\t}

\tif ( $existing_id ) {
\t\t$postarr['ID'] = (int) $existing_id;
\t\t$post_id       = wp_update_post( wp_slash( $postarr ), true );
\t} else {
\t\t$post_id = wp_insert_post( wp_slash( $postarr ), true );
\t}

\tif ( is_wp_error( $post_id ) ) {
\t\treturn $post_id;
\t}

\tforeach ( $model['fields'] ?? [] as $field_id => $field ) {
\t\tif ( ! array_key_exists( $field_id, $payload ) ) {
\t\t\tcontinue;
\t\t}
\t\tupdate_post_meta( $post_id, $field_id, portfolio_light_cast_field_value( $field, $payload[ $field_id ] ) );
\t}

\tforeach ( $model['taxonomies'] ?? [] as $taxonomy ) {
\t\tif ( ! array_key_exists( $taxonomy, $payload ) ) {
\t\t\tcontinue;
\t\t}

\t\t$terms = array_values(
\t\t\tarray_filter(
\t\t\t\tarray_map(
\t\t\t\t\t'sanitize_text_field',
\t\t\t\t\t(array) $payload[ $taxonomy ]
\t\t\t\t)
\t\t\t)
\t\t);
\t\twp_set_object_terms( $post_id, $terms, $taxonomy, false );
\t}

\treturn get_post( $post_id );
}

function portfolio_light_profile_completeness() {
\t$schema = portfolio_light_get_singleton_schema( 'profile' );
\t$data   = get_option( 'portfolio_singleton_profile', [] );
\t$fields = array_keys( $schema['fields'] ?? [] );
\tif ( empty( $fields ) ) {
\t\treturn 0;
\t}

\t$completed = 0;
\tforeach ( $fields as $field ) {
\t\tif ( ! empty( $data[ $field ] ) || false === empty( $data[ $field ] ) ) {
\t\t\t$completed++;
\t\t}
\t}

\treturn (int) round( ( $completed / count( $fields ) ) * 100 );
}

function portfolio_light_get_dashboard_data() {
\t$projects_model = portfolio_light_get_model( 'project' );
\t$inquiry_model  = portfolio_light_get_model( 'inquiry' );
\t$featured_count = 0;
\t$recent         = [];

\tif ( $projects_model ) {
\t\t$featured_query = new WP_Query(
\t\t\t[
\t\t\t\t'post_type'      => $projects_model['postType'],
\t\t\t\t'post_status'    => 'any',
\t\t\t\t'posts_per_page' => 1,
\t\t\t\t'fields'         => 'ids',
\t\t\t\t'meta_query'     => [
\t\t\t\t\t[
\t\t\t\t\t\t'key'   => 'featured',
\t\t\t\t\t\t'value' => '1',
\t\t\t\t\t],
\t\t\t\t],
\t\t\t]
\t\t);
\t\t$featured_count = (int) $featured_query->found_posts;
\t}

\tif ( $inquiry_model ) {
\t\t$inquiries = get_posts(
\t\t\t[
\t\t\t\t'post_type'      => $inquiry_model['postType'],
\t\t\t\t'post_status'    => 'any',
\t\t\t\t'posts_per_page' => 5,
\t\t\t\t'orderby'        => 'modified',
\t\t\t\t'order'          => 'DESC',
\t\t\t]
\t\t);

\t\t$recent = array_map(
\t\t\tfunction( $post ) use ( $inquiry_model ) {
\t\t\t\t$record = portfolio_light_prepare_record( $post, $inquiry_model );
\t\t\t\treturn [
\t\t\t\t\t'id'       => $record['id'],
\t\t\t\t\t'title'    => $record['title'],
\t\t\t\t\t'email'    => $record['email'] ?? '',
\t\t\t\t\t'company'  => $record['company'] ?? '',
\t\t\t\t\t'status'   => $record['status'] ?? '',
\t\t\t\t\t'modified' => $record['modified'],
\t\t\t\t];
\t\t\t},
\t\t\t$inquiries
\t\t);
\t}

\treturn [
\t\t'featuredProjects'   => $featured_count,
\t\t'profileCompleteness'=> portfolio_light_profile_completeness(),
\t\t'recentInquiries'    => $recent,
\t];
}

function portfolio_light_export_pull_data() {
\t$payload = [
\t\t'collections' => [],
\t\t'pages'       => [],
\t\t'singletons'  => [],
\t];

\tforeach ( portfolio_light_get_models() as $model ) {
\t\tif ( 'collection' !== ( $model['type'] ?? '' ) ) {
\t\t\tcontinue;
\t\t}

\t\t$posts = get_posts(
\t\t\t[
\t\t\t\t'post_type'      => $model['postType'],
\t\t\t\t'post_status'    => 'any',
\t\t\t\t'posts_per_page' => -1,
\t\t\t\t'orderby'        => 'modified',
\t\t\t\t'order'          => 'DESC',
\t\t\t]
\t\t);

\t\t$payload['collections'][ $model['id'] ] = array_map(
\t\t\tfunction( $post ) use ( $model ) {
\t\t\t\t$fields = [];
\t\t\t\t$terms  = [];

\t\t\t\tforeach ( $model['fields'] ?? [] as $field_id => $field ) {
\t\t\t\t\t$fields[ $field_id ] = get_post_meta( $post->ID, $field_id, true );
\t\t\t\t\tif ( 'relation' === ( $field['type'] ?? '' ) && ! empty( $fields[ $field_id ] ) ) {
\t\t\t\t\t\t$related_post = get_post( (int) $fields[ $field_id ] );
\t\t\t\t\t\tif ( $related_post ) {
\t\t\t\t\t\t\t$related_source = get_post_meta( $related_post->ID, '_portfolio_source_id', true );
\t\t\t\t\t\t\t$fields[ $field_id ] = $related_source ?: $related_post->post_name;
\t\t\t\t\t\t}
\t\t\t\t\t}
\t\t\t\t\tif ( 'boolean' === ( $field['type'] ?? '' ) ) {
\t\t\t\t\t\t$fields[ $field_id ] = ! empty( $fields[ $field_id ] );
\t\t\t\t\t}
\t\t\t\t}

\t\t\t\tforeach ( $model['taxonomies'] ?? [] as $taxonomy ) {
\t\t\t\t\t$taxonomy_terms   = wp_get_post_terms( $post->ID, $taxonomy, [ 'fields' => 'names' ] );
\t\t\t\t\t$terms[ $taxonomy ] = is_wp_error( $taxonomy_terms ) ? [] : array_values( $taxonomy_terms );
\t\t\t\t}

\t\t\t\treturn [
\t\t\t\t\t'id'       => (int) $post->ID,
\t\t\t\t\t'model'    => $model['id'],
\t\t\t\t\t'sourceId' => get_post_meta( $post->ID, '_portfolio_source_id', true ),
\t\t\t\t\t'slug'     => $post->post_name,
\t\t\t\t\t'title'    => $post->post_title,
\t\t\t\t\t'excerpt'  => $post->post_excerpt,
\t\t\t\t\t'status'   => $post->post_status,
\t\t\t\t\t'fields'   => $fields,
\t\t\t\t\t'terms'    => $terms,
\t\t\t\t\t'body'     => $post->post_content,
\t\t\t\t];
\t\t\t},
\t\t\t$posts
\t\t);
\t}

\t$posts = get_posts(
\t\t[
\t\t\t'post_type'      => 'post',
\t\t\t'post_status'    => 'any',
\t\t\t'posts_per_page' => -1,
\t\t\t'orderby'        => 'modified',
\t\t\t'order'          => 'DESC',
\t\t]
\t);

\t$payload['collections']['post'] = array_map(
\t\tfunction( $post ) {
\t\t\t$terms = [];
\t\t\tforeach ( [ 'category', 'post_tag' ] as $taxonomy ) {
\t\t\t\t$taxonomy_terms   = wp_get_post_terms( $post->ID, $taxonomy, [ 'fields' => 'names' ] );
\t\t\t\t$terms[ $taxonomy ] = is_wp_error( $taxonomy_terms ) ? [] : array_values( $taxonomy_terms );
\t\t\t}

\t\t\treturn [
\t\t\t\t'id'       => (int) $post->ID,
\t\t\t\t'model'    => 'post',
\t\t\t\t'sourceId' => get_post_meta( $post->ID, '_portfolio_source_id', true ),
\t\t\t\t'slug'     => $post->post_name,
\t\t\t\t'title'    => $post->post_title,
\t\t\t\t'excerpt'  => $post->post_excerpt,
\t\t\t\t'status'   => $post->post_status,
\t\t\t\t'fields'   => [],
\t\t\t\t'terms'    => $terms,
\t\t\t\t'body'     => $post->post_content,
\t\t\t];
\t\t},
\t\t$posts
\t);

\tforeach ( portfolio_light_get_singletons() as $singleton ) {
\t\t$payload['singletons'][ $singleton['id'] ] = get_option(
\t\t\t'portfolio_singleton_' . $singleton['id'],
\t\t\t[]
\t\t);
\t}

\t$pages = get_posts(
\t\t[
\t\t\t'post_type'      => 'page',
\t\t\t'post_status'    => 'any',
\t\t\t'posts_per_page' => -1,
\t\t\t'orderby'        => 'modified',
\t\t\t'order'          => 'DESC',
\t\t]
\t);
\t$payload['pages'] = array_map( 'portfolio_light_prepare_page_record', $pages );

\treturn $payload;
}

function portfolio_light_is_app_request() {
\t$request_path = wp_parse_url( home_url( add_query_arg( [] ) ), PHP_URL_PATH );
\t$uri_path     = wp_parse_url( $_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH );
\t$app_base     = wp_parse_url( home_url( '/app' ), PHP_URL_PATH );

\treturn ! empty( $uri_path ) && 0 === strpos( trailingslashit( $uri_path ), trailingslashit( $app_base ) );
}
`;
}

function phpRegisterPostTypesFile() {
  return `<?php
defined( 'ABSPATH' ) || exit;

add_action( 'init', function() {
\tforeach ( portfolio_light_get_models() as $model ) {
\t\tif ( 'collection' !== ( $model['type'] ?? '' ) ) {
\t\t\tcontinue;
\t\t}

\t\t$labels = [
\t\t\t'name'          => $model['label'],
\t\t\t'singular_name' => $model['singularLabel'] ?? $model['label'],
\t\t];

\t\t$args = [
\t\t\t'label'          => $model['label'],
\t\t\t'labels'         => $labels,
\t\t\t'public'         => (bool) ( $model['public'] ?? true ),
\t\t\t'show_ui'        => (bool) ( $model['showUi'] ?? true ),
\t\t\t'show_in_rest'   => true,
\t\t\t'supports'       => $model['supports'] ?? [ 'title', 'editor', 'excerpt', 'thumbnail', 'revisions' ],
\t\t\t'has_archive'    => $model['archiveSlug'] ?? false,
\t\t\t'rewrite'        => ! empty( $model['archiveSlug'] ) ? [ 'slug' => $model['archiveSlug'] ] : true,
\t\t\t'menu_position'  => 20,
\t\t];

\t\tif ( ! empty( $model['editorTemplate'] ) ) {
\t\t\t$args['template'] = $model['editorTemplate'];
\t\t}

\t\tif ( ! empty( $model['templateLock'] ) ) {
\t\t\t$args['template_lock'] = $model['templateLock'];
\t\t}

\t\tregister_post_type( $model['postType'], $args );
\t}
} );
`;
}

function phpRegisterTaxonomiesFile() {
  return `<?php
defined( 'ABSPATH' ) || exit;

add_action( 'init', function() {
\t$taxonomies = [];

\tforeach ( portfolio_light_get_models() as $model ) {
\t\tforeach ( $model['taxonomies'] ?? [] as $taxonomy ) {
\t\t\t$taxonomies[ $taxonomy ][] = $model['postType'];
\t\t}
\t}

\tforeach ( $taxonomies as $taxonomy => $post_types ) {
\t\tregister_taxonomy(
\t\t\t$taxonomy,
\t\t\tarray_values( array_unique( $post_types ) ),
\t\t\t[
\t\t\t\t'label'        => ucwords( str_replace( '_', ' ', $taxonomy ) ),
\t\t\t\t'public'       => true,
\t\t\t\t'show_ui'      => true,
\t\t\t\t'show_in_rest' => true,
\t\t\t\t'rewrite'      => [ 'slug' => $taxonomy ],
\t\t\t]
\t\t);
\t}
} );
`;
}

function phpRegisterMetaFile() {
  return `<?php
defined( 'ABSPATH' ) || exit;

add_action( 'init', function() {
\tforeach ( portfolio_light_get_models() as $model ) {
\t\tforeach ( $model['fields'] ?? [] as $field_id => $field ) {
\t\t\tif ( 'repeater' === ( $field['type'] ?? '' ) ) {
\t\t\t\tcontinue;
\t\t\t}

\t\t\t$args = [
\t\t\t\t'object_subtype' => $model['postType'],
\t\t\t\t'type'           => portfolio_light_field_meta_type( $field ),
\t\t\t\t'single'         => true,
\t\t\t\t'show_in_rest'   => true,
\t\t\t];

\t\t\tregister_meta( 'post', $field_id, $args );
\t\t}
\t}
} );
`;
}

function phpRegisterSingletonsFile() {
  return `<?php
defined( 'ABSPATH' ) || exit;

function portfolio_get_singleton( $key ) {
\treturn get_option( "portfolio_singleton_{$key}", [] );
}

function portfolio_update_singleton( $key, $data ) {
\treturn update_option( "portfolio_singleton_{$key}", $data );
}
`;
}

function phpRegisterRestFile() {
  return `<?php
defined( 'ABSPATH' ) || exit;

function portfolio_light_rest_can_edit() {
\treturn current_user_can( 'edit_posts' );
}

add_action( 'rest_api_init', function() {
\tregister_rest_field(
\t\t'page',
\t\t'portfolioRouteId',
\t\t[
\t\t\t'get_callback' => function( $page ) {
\t\t\t\treturn (string) get_post_meta( (int) ( $page['id'] ?? 0 ), '_portfolio_route_id', true );
\t\t\t},
\t\t\t'schema'       => [
\t\t\t\t'description' => 'Compiler-managed route identifier for seeded pages.',
\t\t\t\t'type'        => 'string',
\t\t\t\t'context'     => [ 'view', 'edit' ],
\t\t\t],
\t\t]
\t);

\tregister_rest_route(
\t\t'portfolio/v1',
\t\t'/bootstrap',
\t\t[
\t\t\t'methods'             => 'GET',
\t\t\t'permission_callback' => 'portfolio_light_rest_can_edit',
\t\t\t'callback'            => function() {
\t\t\t\t$models      = portfolio_light_get_admin_models();
\t\t\t\t$singletons  = portfolio_light_get_singletons();
\t\t\t\t$records     = [];
\t\t\t\t$pages       = [];
\t\t\t\t$singleton_data = [];
\t\t\t\t$admin_schema = [ 'views' => [], 'forms' => [] ];

\t\t\t\tforeach ( $models as $model ) {
\t\t\t\t\t$admin_schema['views'][ $model['id'] ] = portfolio_light_get_admin_schema( $model['id'], 'view' );
\t\t\t\t\t$admin_schema['forms'][ $model['id'] ] = portfolio_light_get_admin_schema( $model['id'], 'form' );
\t\t\t\t\t$posts = get_posts(
\t\t\t\t\t\t[
\t\t\t\t\t\t\t'post_type'      => $model['postType'],
\t\t\t\t\t\t\t'post_status'    => 'any',
\t\t\t\t\t\t\t'posts_per_page' => -1,
\t\t\t\t\t\t\t'orderby'        => 'modified',
\t\t\t\t\t\t\t'order'          => 'DESC',
\t\t\t\t\t\t]
\t\t\t\t\t);
\t\t\t\t\t$records[ $model['id'] ] = array_map(
\t\t\t\t\t\tfunction( $post ) use ( $model ) {
\t\t\t\t\t\t\treturn portfolio_light_prepare_record( $post, $model );
\t\t\t\t\t\t},
\t\t\t\t\t\t$posts
\t\t\t\t\t);
\t\t\t\t}

\t\t\t\tforeach ( $singletons as $singleton ) {
\t\t\t\t\t$admin_schema['forms'][ $singleton['id'] ] = portfolio_light_get_admin_schema( $singleton['id'], 'form' );
\t\t\t\t\t$singleton_data[ $singleton['id'] ] = get_option( 'portfolio_singleton_' . $singleton['id'], [] );
\t\t\t\t}

\t\t\t\t$page_posts = get_posts(
\t\t\t\t\t[
\t\t\t\t\t\t'post_type'      => 'page',
\t\t\t\t\t\t'post_status'    => 'any',
\t\t\t\t\t\t'posts_per_page' => -1,
\t\t\t\t\t\t'orderby'        => 'modified',
\t\t\t\t\t\t'order'          => 'DESC',
\t\t\t\t\t]
\t\t\t\t);
\t\t\t\t$pages = array_map( 'portfolio_light_prepare_page_record', $page_posts );

\t\t\t\treturn new WP_REST_Response(
\t\t\t\t\t[
\t\t\t\t\t\t'site'          => portfolio_light_get_site_config(),
\t\t\t\t\t\t'generatedAt'   => portfolio_light_get_compiled_generated_at(),
\t\t\t\t\t\t'blocks'        => portfolio_light_get_blocks(),
\t\t\t\t\t\t'models'        => $models,
\t\t\t\t\t\t'singletons'    => $singletons,
\t\t\t\t\t\t'routes'        => portfolio_light_get_routes(),
\t\t\t\t\t\t'menus'         => portfolio_light_get_menus(),
\t\t\t\t\t\t'editorTemplates' => portfolio_light_get_editor_templates(),
\t\t\t\t\t\t'adminSchema'   => $admin_schema,
\t\t\t\t\t\t'navigation'    => portfolio_light_get_admin_navigation(),
\t\t\t\t\t\t'dashboard'     => portfolio_light_get_dashboard_data(),
\t\t\t\t\t\t'records'       => $records,
\t\t\t\t\t\t'pages'         => $pages,
\t\t\t\t\t\t'singletonData' => $singleton_data,
\t\t\t\t\t\t'themeJson'     => portfolio_light_get_theme_json(),
\t\t\t\t\t\t'themeCss'      => portfolio_light_get_theme_css(),
\t\t\t\t\t],
\t\t\t\t\t200
\t\t\t\t);
\t\t\t},
\t\t]
\t);

\tregister_rest_route(
\t\t'portfolio/v1',
\t\t'/seed',
\t\t[
\t\t\t'methods'             => 'POST',
\t\t\t'permission_callback' => 'portfolio_light_rest_can_edit',
\t\t\t'callback'            => function() {
\t\t\t\tportfolio_light_seed_site();
\t\t\t\treturn new WP_REST_Response( [ 'ok' => true ], 200 );
\t\t\t},
\t\t]
\t);

\tregister_rest_route(
\t\t'portfolio/v1',
\t\t'/dev-state',
\t\t[
\t\t\t'methods'             => 'GET',
\t\t\t'permission_callback' => '__return_true',
\t\t\t'callback'            => function() {
\t\t\t\treturn new WP_REST_Response( portfolio_light_get_dev_state(), 200 );
\t\t\t},
\t\t]
\t);

\tregister_rest_route(
\t\t'portfolio/v1',
\t\t'/collection/(?P<model>[a-z0-9_-]+)',
\t\t[
\t\t\t[
\t\t\t\t'methods'             => 'GET',
\t\t\t\t'permission_callback' => 'portfolio_light_rest_can_edit',
\t\t\t\t'callback'            => function( WP_REST_Request $request ) {
\t\t\t\t\t$model = portfolio_light_get_model( $request['model'] );
\t\t\t\t\tif ( ! $model ) {
\t\t\t\t\t\treturn new WP_REST_Response( [ 'message' => 'Unknown model.' ], 404 );
\t\t\t\t\t}

\t\t\t\t\t$posts = get_posts(
\t\t\t\t\t\t[
\t\t\t\t\t\t\t'post_type'      => $model['postType'],
\t\t\t\t\t\t\t'post_status'    => 'any',
\t\t\t\t\t\t\t'posts_per_page' => -1,
\t\t\t\t\t\t\t'orderby'        => 'modified',
\t\t\t\t\t\t\t'order'          => 'DESC',
\t\t\t\t\t\t]
\t\t\t\t\t);

\t\t\t\t\t$records = array_map(
\t\t\t\t\t\tfunction( $post ) use ( $model ) {
\t\t\t\t\t\t\treturn portfolio_light_prepare_record( $post, $model );
\t\t\t\t\t\t},
\t\t\t\t\t\t$posts
\t\t\t\t\t);

\t\t\t\t\treturn new WP_REST_Response( [ 'items' => $records ], 200 );
\t\t\t\t},
\t\t\t],
\t\t\t[
\t\t\t\t'methods'             => 'POST',
\t\t\t\t'permission_callback' => 'portfolio_light_rest_can_edit',
\t\t\t\t'callback'            => function( WP_REST_Request $request ) {
\t\t\t\t\t$model = portfolio_light_get_model( $request['model'] );
\t\t\t\t\tif ( ! $model ) {
\t\t\t\t\t\treturn new WP_REST_Response( [ 'message' => 'Unknown model.' ], 404 );
\t\t\t\t\t}

\t\t\t\t\t$created = portfolio_light_upsert_record( $model, $request->get_json_params() ?: [] );
\t\t\t\t\tif ( is_wp_error( $created ) ) {
\t\t\t\t\t\treturn new WP_REST_Response( [ 'message' => $created->get_error_message() ], 500 );
\t\t\t\t\t}

\t\t\t\t\treturn new WP_REST_Response(
\t\t\t\t\t\t[
\t\t\t\t\t\t\t'item' => portfolio_light_prepare_record( $created, $model ),
\t\t\t\t\t\t],
\t\t\t\t\t\t200
\t\t\t\t\t);
\t\t\t\t},
\t\t\t],
\t\t]
\t);

\tregister_rest_route(
\t\t'portfolio/v1',
\t\t'/collection/(?P<model>[a-z0-9_-]+)/(?P<id>\\d+)',
\t\t[
\t\t\t[
\t\t\t\t'methods'             => 'GET',
\t\t\t\t'permission_callback' => 'portfolio_light_rest_can_edit',
\t\t\t\t'callback'            => function( WP_REST_Request $request ) {
\t\t\t\t\t$model = portfolio_light_get_model( $request['model'] );
\t\t\t\t\t$post  = get_post( (int) $request['id'] );

\t\t\t\t\tif ( ! $model || ! $post || $post->post_type !== $model['postType'] ) {
\t\t\t\t\t\treturn new WP_REST_Response( [ 'message' => 'Not found.' ], 404 );
\t\t\t\t\t}

\t\t\t\t\treturn new WP_REST_Response(
\t\t\t\t\t\t[
\t\t\t\t\t\t\t'item' => portfolio_light_prepare_record( $post, $model ),
\t\t\t\t\t\t],
\t\t\t\t\t\t200
\t\t\t\t\t);
\t\t\t\t},
\t\t\t],
\t\t\t[
\t\t\t\t'methods'             => 'POST',
\t\t\t\t'permission_callback' => 'portfolio_light_rest_can_edit',
\t\t\t\t'callback'            => function( WP_REST_Request $request ) {
\t\t\t\t\t$model = portfolio_light_get_model( $request['model'] );
\t\t\t\t\tif ( ! $model ) {
\t\t\t\t\t\treturn new WP_REST_Response( [ 'message' => 'Unknown model.' ], 404 );
\t\t\t\t\t}

\t\t\t\t\t$updated = portfolio_light_upsert_record(
\t\t\t\t\t\t$model,
\t\t\t\t\t\t$request->get_json_params() ?: [],
\t\t\t\t\t\t(int) $request['id']
\t\t\t\t\t);

\t\t\t\t\tif ( is_wp_error( $updated ) ) {
\t\t\t\t\t\treturn new WP_REST_Response( [ 'message' => $updated->get_error_message() ], 500 );
\t\t\t\t\t}

\t\t\t\t\treturn new WP_REST_Response(
\t\t\t\t\t\t[
\t\t\t\t\t\t\t'item' => portfolio_light_prepare_record( $updated, $model ),
\t\t\t\t\t\t],
\t\t\t\t\t\t200
\t\t\t\t\t);
\t\t\t\t},
\t\t\t],
\t\t\t[
\t\t\t\t'methods'             => 'DELETE',
\t\t\t\t'permission_callback' => 'portfolio_light_rest_can_edit',
\t\t\t\t'callback'            => function( WP_REST_Request $request ) {
\t\t\t\t\t$model = portfolio_light_get_model( $request['model'] );
\t\t\t\t\t$post  = get_post( (int) $request['id'] );
\t\t\t\t\tif ( ! $model || ! $post || $post->post_type !== $model['postType'] ) {
\t\t\t\t\t\treturn new WP_REST_Response( [ 'message' => 'Not found.' ], 404 );
\t\t\t\t\t}

\t\t\t\t\twp_delete_post( $post->ID, true );
\t\t\t\t\treturn new WP_REST_Response( [ 'ok' => true ], 200 );
\t\t\t\t},
\t\t\t],
\t\t]
\t);

\tregister_rest_route(
\t\t'portfolio/v1',
\t\t'/singleton/(?P<singleton>[a-z0-9_-]+)',
\t\t[
\t\t\t[
\t\t\t\t'methods'             => 'GET',
\t\t\t\t'permission_callback' => 'portfolio_light_rest_can_edit',
\t\t\t\t'callback'            => function( WP_REST_Request $request ) {
\t\t\t\t\t$schema = portfolio_light_get_singleton_schema( $request['singleton'] );
\t\t\t\t\tif ( ! $schema ) {
\t\t\t\t\t\treturn new WP_REST_Response( [ 'message' => 'Unknown singleton.' ], 404 );
\t\t\t\t\t}

\t\t\t\t\treturn new WP_REST_Response(
\t\t\t\t\t\t[
\t\t\t\t\t\t\t'item' => get_option( 'portfolio_singleton_' . $schema['id'], [] ),
\t\t\t\t\t\t],
\t\t\t\t\t\t200
\t\t\t\t\t);
\t\t\t\t},
\t\t\t],
\t\t\t[
\t\t\t\t'methods'             => 'POST',
\t\t\t\t'permission_callback' => 'portfolio_light_rest_can_edit',
\t\t\t\t'callback'            => function( WP_REST_Request $request ) {
\t\t\t\t\t$schema = portfolio_light_get_singleton_schema( $request['singleton'] );
\t\t\t\t\tif ( ! $schema ) {
\t\t\t\t\t\treturn new WP_REST_Response( [ 'message' => 'Unknown singleton.' ], 404 );
\t\t\t\t\t}

\t\t\t\t\t$payload = $request->get_json_params() ?: [];
\t\t\t\t\t$data    = [];
\t\t\t\t\tforeach ( $schema['fields'] ?? [] as $field_id => $field ) {
\t\t\t\t\t\tif ( array_key_exists( $field_id, $payload ) ) {
\t\t\t\t\t\t\t$data[ $field_id ] = portfolio_light_cast_field_value( $field, $payload[ $field_id ] );
\t\t\t\t\t\t}
\t\t\t\t\t}

\t\t\t\t\tupdate_option( 'portfolio_singleton_' . $schema['id'], $data );

\t\t\t\t\treturn new WP_REST_Response( [ 'item' => $data ], 200 );
\t\t\t\t},
\t\t\t],
\t\t]
\t);

\tregister_rest_route(
\t\t'portfolio/v1',
\t\t'/inquiry',
\t\t[
\t\t\t'methods'             => 'POST',
\t\t\t'permission_callback' => '__return_true',
\t\t\t'callback'            => function( WP_REST_Request $request ) {
\t\t\t\t$model = portfolio_light_get_model( 'inquiry' );
\t\t\t\tif ( ! $model ) {
\t\t\t\t\treturn new WP_REST_Response( [ 'ok' => false ], 500 );
\t\t\t\t}

\t\t\t\t$params = $request->get_json_params();
\t\t\t\t$payload = [
\t\t\t\t\t'title'      => sanitize_text_field( $params['name'] ?? 'Inquiry' ),
\t\t\t\t\t'postStatus' => 'publish',
\t\t\t\t\t'content'    => sanitize_textarea_field( $params['message'] ?? '' ),
\t\t\t\t\t'email'      => sanitize_email( $params['email'] ?? '' ),
\t\t\t\t\t'company'    => sanitize_text_field( $params['company'] ?? '' ),
\t\t\t\t\t'source'     => 'contact_form',
\t\t\t\t\t'status'     => 'new',
\t\t\t\t];

\t\t\t\t$created = portfolio_light_upsert_record( $model, $payload );
\t\t\t\tif ( is_wp_error( $created ) ) {
\t\t\t\t\treturn new WP_REST_Response( [ 'ok' => false ], 500 );
\t\t\t\t}

\t\t\t\treturn new WP_REST_Response( [ 'ok' => true ], 200 );
\t\t\t},
\t\t]
\t);
	register_rest_route(
		'portfolio/v1',
		'/logs',
		[
			[
				'methods'             => 'GET',
				'permission_callback' => function() {
					return current_user_can( 'manage_options' );
				},
				'callback'            => function() {
					$log_file = WP_CONTENT_DIR . '/debug.log';
					if ( ! file_exists( $log_file ) ) {
						return new WP_REST_Response( [ 'lines' => [] ], 200 );
					}

					$contents = file_get_contents( $log_file );
					$lines    = $contents ? explode( "\\n", $contents ) : [];
					$lines = array_slice( $lines, -500 );
					if ( end( $lines ) === '' ) {
						array_pop( $lines );
					}

					return new WP_REST_Response( [ 'lines' => array_values( $lines ) ], 200 );
				},
			],
			[
				'methods'             => 'DELETE',
				'permission_callback' => function() {
					return current_user_can( 'manage_options' );
				},
				'callback'            => function() {
					$log_file = WP_CONTENT_DIR . '/debug.log';
					if ( file_exists( $log_file ) ) {
						file_put_contents( $log_file, '' );
					}
					return new WP_REST_Response( [ 'ok' => true ], 200 );
				},
			],
		]
	);

	register_rest_route(
		'portfolio/v1',
		'/app-password',
		[
			[
				'methods'             => 'GET',
				'permission_callback' => function() {
					return current_user_can( 'edit_posts' );
				},
				'callback'            => function() {
					$user = wp_get_current_user();
					$passwords = WP_Application_Passwords::get_user_application_passwords( $user->ID );

					foreach ( $passwords as $item ) {
						if ( $item['name'] === 'WPLite App' ) {
							return new WP_REST_Response( [ 'exists' => true, 'password' => null, 'uuid' => $item['uuid'] ], 200 );
						}
					}

					return new WP_REST_Response( [ 'exists' => false, 'password' => null ], 200 );
				},
			],
			[
				'methods'             => 'POST',
				'permission_callback' => function() {
					return current_user_can( 'edit_posts' );
				},
				'callback'            => function() {
					$user = wp_get_current_user();

					$passwords = WP_Application_Passwords::get_user_application_passwords( $user->ID );
					foreach ( $passwords as $item ) {
						if ( $item['name'] === 'WPLite App' ) {
							WP_Application_Passwords::delete_application_password( $user->ID, $item['uuid'] );
						}
					}

					$result = WP_Application_Passwords::create_new_application_password(
						$user->ID,
						[ 'name' => 'WPLite App' ]
					);

					if ( is_wp_error( $result ) ) {
						return new WP_REST_Response( [ 'message' => $result->get_error_message() ], 500 );
					}

					return new WP_REST_Response( [ 'password' => $result[0] ], 200 );
				},
			],
		]
	);
} );
`;
}

function phpRegisterAdminAppFile() {
  return `<?php
defined( 'ABSPATH' ) || exit;

add_action( 'init', function() {
\tadd_rewrite_rule( '^app/?$', 'index.php?portfolio_app=1', 'top' );
\tadd_rewrite_rule( '^app/(.*)?$', 'index.php?portfolio_app=1', 'top' );
} );

add_filter(
\t'query_vars',
\tfunction( $vars ) {
\t\t$vars[] = 'portfolio_app';
\t\treturn $vars;
\t}
);

add_filter( 'show_admin_bar', '__return_false' );

add_action(
\t'admin_init',
\tfunction() {
\t\tif ( wp_doing_ajax() || isset( $_GET['classic-admin'] ) ) {
\t\t\treturn;
\t\t}

\t\tif ( current_user_can( 'edit_posts' ) ) {
\t\t\twp_safe_redirect( home_url( '/app' ) );
\t\t\texit;
\t\t}
\t}
);

add_action(
\t'template_redirect',
\tfunction() {
\t\tif ( ! get_query_var( 'portfolio_app' ) && ! portfolio_light_is_app_request() ) {
\t\t\treturn;
\t\t}

\t\tif ( ! is_user_logged_in() ) {
\t\t\tauth_redirect();
\t\t}

\t\t$script_path = dirname( __DIR__ ) . '/build/admin-app.js';
\t\t$style_path  = dirname( __DIR__ ) . '/build/admin-app.css';
\t\t$plugin_file = glob( dirname( __DIR__ ) . '/*.php' )[0] ?? __FILE__;
\t\t$script_url  = plugins_url( 'build/admin-app.js', $plugin_file );
\t\t$style_url   = plugins_url( 'build/admin-app.css', $plugin_file );
\t\t$current_user = wp_get_current_user();
\t\t$config      = [
\t\t\t'restRoot'    => esc_url_raw( rest_url( 'portfolio/v1/' ) ),
\t\t\t'wpRestRoot'  => esc_url_raw( rest_url() ),
\t\t\t'nonce'       => wp_create_nonce( 'wp_rest' ),
\t\t\t'appBase'     => home_url( '/app' ),
\t\t\t'currentUser' => $current_user->user_login,
\t\t];

\t\tstatus_header( 200 );
\t\tnocache_headers();
\t\t?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
\t<meta charset="<?php bloginfo( 'charset' ); ?>" />
\t<meta name="viewport" content="width=device-width, initial-scale=1" />
\t<title><?php echo esc_html( get_bloginfo( 'name' ) . ' App' ); ?></title>
\t<?php if ( file_exists( $style_path ) ) : ?>
\t\t<link rel="stylesheet" href="<?php echo esc_url( $style_url ); ?>" />
\t<?php endif; ?>
\t<script>window.PORTFOLIO_LIGHT = <?php echo wp_json_encode( $config ); ?>;</script>
\t<script>
\t(function() {
\t\tconst endpoint = <?php echo wp_json_encode( rest_url( 'portfolio/v1/dev-state' ) ); ?>;
\t\tlet currentVersion = null;

\t\tasync function checkDevState() {
\t\t\ttry {
\t\t\t\tconst response = await fetch(endpoint, {
\t\t\t\t\tcache: 'no-store',
\t\t\t\t\tcredentials: 'same-origin',
\t\t\t\t});
\t\t\t\tif (!response.ok) {
\t\t\t\t\treturn;
\t\t\t\t}

\t\t\t\tconst payload = await response.json();
\t\t\t\tif (!payload?.enabled || !payload.version) {
\t\t\t\t\treturn;
\t\t\t\t}

\t\t\t\tif (currentVersion && currentVersion !== payload.version) {
\t\t\t\t\twindow.location.reload();
\t\t\t\t\treturn;
\t\t\t\t}

\t\t\t\tcurrentVersion = payload.version;
\t\t\t} catch (error) {
\t\t\t\t// Keep polling quietly during local development.
\t\t\t}
\t\t}

\t\tcheckDevState();
\t\twindow.setInterval(checkDevState, 1500);
\t})();
\t</script>
\t<?php wp_head(); ?>
</head>
<body <?php body_class( 'portfolio-light-admin-app' ); ?>>
\t<div id="portfolio-admin-root"></div>
\t<?php if ( file_exists( $script_path ) ) : ?>
\t\t<script type="module" src="<?php echo esc_url( $script_url ); ?>"></script>
\t<?php else : ?>
\t\t<p>Admin app build not found. Run the build step.</p>
\t<?php endif; ?>
\t<?php wp_footer(); ?>
</body>
</html><?php
\t\texit;
\t}
);
`;
}

function phpRegisterLoginStyleFile() {
  return `<?php
defined( 'ABSPATH' ) || exit;

function wplite_login_logo_url() {
\t$logo_id = get_theme_mod( 'custom_logo' );
\tif ( $logo_id ) {
\t\t$src = wp_get_attachment_image_src( $logo_id, 'full' );
\t\tif ( $src ) {
\t\t\treturn $src[0];
\t\t}
\t}
\t$icon = get_site_icon_url( 256 );
\treturn $icon ?: '';
}

add_action(
\t'login_enqueue_scripts',
\tfunction() {
\t\t$plugin_file = glob( dirname( __DIR__ ) . '/*.php' )[0] ?? __FILE__;
\t\t$style_url   = plugins_url( 'assets/login.css', $plugin_file );
\t\twp_enqueue_style( 'wplite-login', $style_url, [], null );

\t\t$logo_url = wplite_login_logo_url();
\t\tif ( $logo_url ) {
\t\t\techo '<style id="wplite-login-logo">body.login.wplite-login-with-logo h1 a{background-image:url(' . esc_url( $logo_url ) . ') !important;}</style>';
\t\t}
\t}
);

add_filter(
\t'login_headerurl',
\tfunction() {
\t\treturn home_url( '/' );
\t}
);

add_filter(
\t'login_headertext',
\tfunction() {
\t\treturn get_bloginfo( 'name' );
\t}
);

add_filter(
\t'login_body_class',
\tfunction( $classes ) {
\t\t$classes[] = 'wplite-login';
\t\tif ( wplite_login_logo_url() ) {
\t\t\t$classes[] = 'wplite-login-with-logo';
\t\t}
\t\treturn $classes;
\t}
);

add_action(
\t'login_footer',
\tfunction() {
\t\t?>
\t\t<div class="wplite-login-footer" aria-hidden="false">
\t\t\t<span class="wplite-login-footer__left">Built on wplite</span>
\t\t\t<span class="wplite-login-footer__right" role="img" aria-label="WordPress">
\t\t\t\t<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="14" height="14" aria-hidden="true" focusable="false"><path d="M10 .5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19Zm0 1.2a8.3 8.3 0 1 1 0 16.6 8.3 8.3 0 0 1 0-16.6ZM5 6.6h1.6L8 11.2l1.1-3.1-.5-1.5H10l1.9 5.2 1.3-4.5a2.7 2.7 0 0 0-.1-1l1.3-.1-.2 1L12 14.2h-.3l-2-5-1.9 5H7.5L5 6.6Z"/></svg>
\t\t\t</span>
\t\t</div>
\t\t<?php
\t}
);
`;
}

function loginStyleCss() {
  return `:root {
  --wplite-bg: #f5f5f5;
  --wplite-surface: #ffffff;
  --wplite-border: #e0e0e0;
  --wplite-text: #1e1e1e;
  --wplite-text-muted: #757575;
  --wplite-accent: #3858e9;
  --wplite-accent-hover: #1d35b4;
  --wplite-destructive: #cc1818;
  --wplite-radius: 8px;
  --wplite-radius-sm: 6px;
  --wplite-font: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif;
}

body.login {
  background: var(--wplite-bg);
  color: var(--wplite-text);
  font-family: var(--wplite-font);
  font-size: 13px;
  -webkit-font-smoothing: antialiased;
  margin: 0;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

body.login div#login {
  width: 360px;
  padding: 0;
  margin: 0;
}

body.login h1 {
  text-align: center;
  margin-bottom: 16px;
}

body.login h1 a {
  background-image: none !important;
  width: auto;
  height: auto;
  text-indent: 0;
  overflow: visible;
  display: inline-block;
  font-family: var(--wplite-font);
  font-size: 18px;
  font-weight: 600;
  color: var(--wplite-text);
  letter-spacing: -0.01em;
  line-height: 1.3;
  outline: none;
  box-shadow: none;
}

body.login h1 a:hover,
body.login h1 a:focus {
  color: var(--wplite-accent);
}

body.login.wplite-login-with-logo h1 {
  margin-bottom: 20px;
}

body.login.wplite-login-with-logo h1 a {
  width: 64px;
  height: 64px;
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
  border-radius: 12px;
  font-size: 0;
  color: transparent;
  text-indent: -9999px;
  overflow: hidden;
}

.wplite-login-footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  font-family: var(--wplite-font);
  font-size: 11px;
  color: var(--wplite-text-muted);
  letter-spacing: 0.01em;
  pointer-events: none;
}

.wplite-login-footer > * {
  pointer-events: auto;
}

.wplite-login-footer__right svg {
  display: block;
  fill: var(--wplite-text-muted);
  opacity: 0.7;
}

body.login form {
  background: var(--wplite-surface);
  border: 1px solid var(--wplite-border);
  border-radius: var(--wplite-radius);
  box-shadow: none;
  padding: 24px;
  margin: 0;
  font-weight: normal;
  overflow: visible;
}

body.login form p {
  margin-bottom: 12px;
}

body.login form label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--wplite-text);
  margin-bottom: 4px;
}

body.login form .input,
body.login input[type="text"],
body.login input[type="password"],
body.login input[type="email"] {
  width: 100%;
  height: 36px;
  padding: 6px 10px;
  font-size: 13px;
  font-family: var(--wplite-font);
  color: var(--wplite-text);
  background: var(--wplite-surface);
  border: 1px solid var(--wplite-border);
  border-radius: var(--wplite-radius-sm);
  box-shadow: none;
  transition: border-color 80ms ease, box-shadow 80ms ease;
  margin: 0 0 4px;
}

body.login form .input:focus,
body.login input[type="text"]:focus,
body.login input[type="password"]:focus,
body.login input[type="email"]:focus {
  border-color: var(--wplite-accent);
  box-shadow: none;
  outline: none;
}

body.login .wp-pwd {
  position: relative;
}

body.login .wp-pwd input[type="password"],
body.login .wp-pwd input[type="text"] {
  padding-right: 40px;
}

body.login .wp-pwd .button.wp-hide-pw {
  background: transparent;
  border: 0;
  box-shadow: none;
  color: var(--wplite-text-muted);
  height: 34px;
  top: 1px;
  right: 1px;
}

body.login .wp-pwd .button.wp-hide-pw:hover {
  color: var(--wplite-text);
}

body.login .forgetmenot {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--wplite-text-muted);
  margin-bottom: 16px;
  float: none;
}

body.login .forgetmenot input[type="checkbox"] {
  width: 16px;
  height: 16px;
  margin: 0;
  border: 1px solid var(--wplite-border);
  border-radius: 4px;
  background: var(--wplite-surface);
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
  position: relative;
  transition: border-color 80ms ease, background 80ms ease;
}

body.login .forgetmenot input[type="checkbox"]:checked {
  background: var(--wplite-accent);
  border-color: var(--wplite-accent);
}

body.login .forgetmenot input[type="checkbox"]:checked::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 1px;
  width: 5px;
  height: 9px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

body.login .forgetmenot input[type="checkbox"]:focus {
  border-color: var(--wplite-accent);
  box-shadow: none;
  outline: none;
}

body.login .forgetmenot label {
  margin: 0;
  font-size: 12px;
  color: var(--wplite-text-muted);
}

body.login .submit {
  margin: 0;
}

body.login .button-primary,
body.login #wp-submit {
  width: 100%;
  height: 36px;
  float: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--wplite-accent);
  border: 1px solid var(--wplite-accent);
  border-radius: var(--wplite-radius-sm);
  color: #fff;
  font-family: var(--wplite-font);
  font-size: 13px;
  font-weight: 500;
  padding: 0 14px;
  text-shadow: none;
  box-shadow: none;
  cursor: pointer;
  transition: background 80ms ease, border-color 80ms ease;
}

body.login .button-primary:hover,
body.login #wp-submit:hover,
body.login .button-primary:focus,
body.login #wp-submit:focus {
  background: var(--wplite-accent-hover);
  border-color: var(--wplite-accent-hover);
  color: #fff;
  box-shadow: none;
  outline: none;
}

body.login #nav,
body.login #backtoblog {
  text-align: center;
  margin: 12px 0 0;
  padding: 0 24px;
  font-size: 12px;
  color: var(--wplite-text-muted);
  text-shadow: none;
}

body.login #nav a,
body.login #backtoblog a {
  color: var(--wplite-text-muted);
  text-decoration: none;
  transition: color 80ms ease;
}

body.login #nav a:hover,
body.login #backtoblog a:hover,
body.login #nav a:focus,
body.login #backtoblog a:focus {
  color: var(--wplite-accent);
  box-shadow: none;
  outline: none;
}

body.login .message,
body.login .notice,
body.login #login_error {
  background: var(--wplite-surface);
  border: 1px solid var(--wplite-border);
  border-left: 3px solid var(--wplite-accent);
  border-radius: var(--wplite-radius-sm);
  box-shadow: none;
  padding: 10px 12px;
  margin: 0 0 16px;
  font-size: 12px;
  color: var(--wplite-text);
}

body.login #login_error {
  border-left-color: var(--wplite-destructive);
  color: var(--wplite-destructive);
}

body.login .privacy-policy-page-link {
  text-align: center;
  margin-top: 16px;
}

body.login .privacy-policy-page-link a {
  font-size: 12px;
  color: var(--wplite-text-muted);
}

body.login .language-switcher {
  margin-top: 16px;
}

body.login .language-switcher select {
  height: 32px;
  border: 1px solid var(--wplite-border);
  border-radius: var(--wplite-radius-sm);
  padding: 4px 8px;
  font-family: var(--wplite-font);
  font-size: 12px;
  background: var(--wplite-surface);
  color: var(--wplite-text);
}
`;
}

async function writeStaticAssets(pluginDir) {
  const assetsDir = path.join(pluginDir, 'assets');
  await ensureDir(assetsDir);
  await writeFile(path.join(assetsDir, 'login.css'), loginStyleCss());
}

function phpSeedFile() {
  return `<?php
defined( 'ABSPATH' ) || exit;

function portfolio_light_build_post_index( $post_type ) {
\t$index = [
\t\t'by_source_id' => [],
\t\t'by_route_id'  => [],
\t\t'by_slug'      => [],
\t\t'by_title'     => [],
\t\t'posts'        => [],
\t];

\t$posts = get_posts(
\t\t[
\t\t\t'post_type'      => $post_type,
\t\t\t'post_status'    => 'any',
\t\t\t'posts_per_page' => -1,
\t\t\t'orderby'        => 'date',
\t\t\t'order'          => 'ASC',
\t\t]
\t);

\tforeach ( $posts as $post ) {
\t\t$index['posts'][ (int) $post->ID ] = $post;
\t\t$source_id = (string) get_post_meta( $post->ID, '_portfolio_source_id', true );
\t\t$route_id  = (string) get_post_meta( $post->ID, '_portfolio_route_id', true );
\t\tif ( $source_id && ! isset( $index['by_source_id'][ $source_id ] ) ) {
\t\t\t$index['by_source_id'][ $source_id ] = $post;
\t\t}
\t\tif ( $route_id && ! isset( $index['by_route_id'][ $route_id ] ) ) {
\t\t\t$index['by_route_id'][ $route_id ] = $post;
\t\t}
\t\tif ( $post->post_name && ! isset( $index['by_slug'][ $post->post_name ] ) ) {
\t\t\t$index['by_slug'][ $post->post_name ] = $post;
\t\t}
\t\tif ( $post->post_title && ! isset( $index['by_title'][ $post->post_title ] ) ) {
\t\t\t$index['by_title'][ $post->post_title ] = $post;
\t\t}
\t}

\treturn $index;
}

function portfolio_light_find_route_page_in_index( $route, $index ) {
\t$route_id = (string) ( $route['id'] ?? '' );
\t$slug     = (string) ( $route['slug'] ?? '' );
\t$title    = (string) ( $route['title'] ?? ucfirst( $route_id ?: 'Page' ) );

\tif ( $route_id && isset( $index['by_route_id'][ $route_id ] ) ) {
\t\treturn $index['by_route_id'][ $route_id ];
\t}

\tif ( $slug && isset( $index['by_slug'][ $slug ] ) ) {
\t\treturn $index['by_slug'][ $slug ];
\t}

\tif ( ! $slug ) {
\t\t$current_front = (int) get_option( 'page_on_front' );
\t\tif ( $current_front && isset( $index['posts'][ $current_front ] ) ) {
\t\t\t$front = $index['posts'][ $current_front ];
\t\t\tif ( $front instanceof WP_Post && 'page' === $front->post_type ) {
\t\t\t\treturn $front;
\t\t\t}
\t\t}

\t\tif ( $title && isset( $index['by_title'][ $title ] ) ) {
\t\t\treturn $index['by_title'][ $title ];
\t\t}
\t}

\treturn null;
}

function portfolio_light_find_route_page( $route ) {
\t$route_id = (string) ( $route['id'] ?? '' );
\t$slug     = (string) ( $route['slug'] ?? '' );
\t$title    = (string) ( $route['title'] ?? ucfirst( $route_id ?: 'Page' ) );

\tif ( $route_id ) {
\t\t$existing = get_posts(
\t\t\t[
\t\t\t\t'post_type'      => 'page',
\t\t\t\t'post_status'    => 'any',
\t\t\t\t'posts_per_page' => 1,
\t\t\t\t'meta_query'     => [
\t\t\t\t\t[
\t\t\t\t\t\t'key'   => '_portfolio_route_id',
\t\t\t\t\t\t'value' => $route_id,
\t\t\t\t\t],
\t\t\t\t],
\t\t\t]
\t\t);
\t\tif ( ! empty( $existing ) ) {
\t\t\treturn $existing[0];
\t\t}
\t}

\tif ( $slug ) {
\t\t$existing = get_page_by_path( $slug, OBJECT, 'page' );
\t\tif ( $existing ) {
\t\t\treturn $existing;
\t\t}
\t}

\tif ( ! $slug ) {
\t\t$current_front = (int) get_option( 'page_on_front' );
\t\tif ( $current_front ) {
\t\t\t$front = get_post( $current_front );
\t\t\tif ( $front instanceof WP_Post && 'page' === $front->post_type ) {
\t\t\t\treturn $front;
\t\t\t}
\t\t}

\t\t$matches = get_posts(
\t\t\t[
\t\t\t\t'post_type'      => 'page',
\t\t\t\t'post_status'    => 'any',
\t\t\t\t'posts_per_page' => 1,
\t\t\t\t'title'          => $title,
\t\t\t\t'orderby'        => 'date',
\t\t\t\t'order'          => 'ASC',
\t\t\t]
\t\t);
\t\tif ( ! empty( $matches ) ) {
\t\t\treturn $matches[0];
\t\t}
\t}

\treturn null;
}

function portfolio_light_find_page_content_entry( $route ) {
\t$route_id = (string) ( $route['id'] ?? '' );
\t$slug     = (string) ( $route['slug'] ?? '' );

\tforeach ( portfolio_light_get_content_collections()['page'] ?? [] as $entry ) {
\t\tif ( $route_id && (string) ( $entry['routeId'] ?? '' ) === $route_id ) {
\t\t\treturn $entry;
\t\t}

\t\tif ( $slug && (string) ( $entry['slug'] ?? '' ) === $slug ) {
\t\t\treturn $entry;
\t\t}
\t}

\treturn null;
}

function portfolio_light_seed_page_from_route( $route, $page_index = null ) {
\tif ( 'page' !== ( $route['type'] ?? '' ) || empty( $route['seed']['createPageShell'] ) ) {
\t\treturn 0;
\t}

\t$slug     = (string) ( $route['slug'] ?? '' );
\t$existing = $page_index
\t\t? portfolio_light_find_route_page_in_index( $route, $page_index )
\t\t: portfolio_light_find_route_page( $route );
\t$content_entry = portfolio_light_find_page_content_entry( $route );
\t$payload  = [
\t\t'post_type'    => 'page',
\t\t'post_status'  => $route['seed']['status'] ?? ( $content_entry['status'] ?? 'publish' ),
\t\t'post_title'   => $route['title'] ?? ( $content_entry['title'] ?? ucfirst( $route['id'] ?? 'Page' ) ),
\t\t'post_name'    => $slug,
\t\t'post_excerpt' => $content_entry['excerpt'] ?? '',
\t\t'post_content' => $content_entry['body'] ?? ( $route['seed']['content'] ?? '' ),
\t];

\tif ( $existing ) {
\t\t$payload['ID'] = $existing->ID;
\t\t$page_id       = wp_update_post( wp_slash( $payload ), true );
\t} else {
\t\t$page_id = wp_insert_post( wp_slash( $payload ), true );
\t}

\tif ( is_wp_error( $page_id ) ) {
\t\treturn 0;
\t}

\tupdate_post_meta( $page_id, '_portfolio_route_id', (string) ( $route['id'] ?? '' ) );
\tupdate_post_meta(
\t\t$page_id,
\t\t'_portfolio_source_id',
\t\t(string) ( $content_entry['sourceId'] ?? ( ! empty( $route['id'] ) ? 'page.' . $route['id'] : 'page.' . $slug ) )
\t);

\tif ( ! empty( $route['template'] ) && ! in_array( $route['template'], [ 'front-page', 'page' ], true ) ) {
\t\tupdate_post_meta( $page_id, '_wp_page_template', $route['template'] );
\t} else {
\t\tdelete_post_meta( $page_id, '_wp_page_template' );
\t}

\treturn (int) $page_id;
}

function portfolio_light_cleanup_route_duplicates( $page_ids ) {
\t$managed_ids = array_values( array_filter( array_map( 'intval', $page_ids ) ) );

\tif ( empty( $managed_ids ) ) {
\t\treturn;
\t}

\t$duplicates = get_posts(
\t\t[
\t\t\t'post_type'      => 'page',
\t\t\t'post_status'    => 'any',
\t\t\t'posts_per_page' => -1,
\t\t\t'meta_query'     => [
\t\t\t\t[
\t\t\t\t\t'key'     => '_portfolio_route_id',
\t\t\t\t\t'compare' => 'EXISTS',
\t\t\t\t],
\t\t\t],
\t\t]
\t);

\t$seen = [];
\tforeach ( $duplicates as $post ) {
\t\t$route_id = (string) get_post_meta( $post->ID, '_portfolio_route_id', true );
\t\tif ( ! isset( $seen[ $route_id ] ) ) {
\t\t\t$seen[ $route_id ] = (int) $post->ID;
\t\t\tcontinue;
\t\t}
\t\twp_delete_post( $post->ID, true );
\t}

\t$legacy_pages = get_posts(
\t\t[
\t\t\t'post_type'      => 'page',
\t\t\t'post_status'    => 'any',
\t\t\t'posts_per_page' => -1,
\t\t]
\t);
\tforeach ( $legacy_pages as $post ) {
\t\tif ( in_array( (int) $post->ID, $managed_ids, true ) ) {
\t\t\tcontinue;
\t\t}
\t\tif ( preg_match( '/^home(?:-[0-9]+)?$/', $post->post_name ) ) {
\t\t\twp_delete_post( $post->ID, true );
\t\t}
\t}
}

function portfolio_light_seed_singletons() {
\t$site = portfolio_light_get_site_config();
\tif (
\t\tempty( $site['content']['push'] ) ||
\t\t'database' === ( $site['content']['mode'] ?? 'files' ) ||
\t\t! empty( $site['content']['databaseFirst'] )
\t) {
\t\treturn;
\t}

\tforeach ( portfolio_light_get_content_singletons() as $singleton_id => $entry ) {
\t\tupdate_option( 'portfolio_singleton_' . $singleton_id, $entry['data'] ?? [] );
\t}
}

function portfolio_light_cleanup_default_content() {
\t$hello_world = get_page_by_path( 'hello-world', OBJECT, 'post' );
\tif ( $hello_world && 'Hello world!' === $hello_world->post_title ) {
\t\twp_delete_post( $hello_world->ID, true );
\t}

\t$sample_page = get_page_by_path( 'sample-page', OBJECT, 'page' );
\tif ( $sample_page && 'Sample Page' === $sample_page->post_title ) {
\t\twp_delete_post( $sample_page->ID, true );
\t}

\t$privacy_page = get_page_by_path( 'privacy-policy', OBJECT, 'page' );
\tif ( $privacy_page && 'Privacy Policy' === $privacy_page->post_title ) {
\t\twp_delete_post( $privacy_page->ID, true );
\t}
}

function portfolio_light_seed_collection_items( $indexes = null ) {
\t$site        = portfolio_light_get_site_config();
\tif (
\t\tempty( $site['content']['push'] ) ||
\t\t'database' === ( $site['content']['mode'] ?? 'files' ) ||
\t\t! empty( $site['content']['databaseFirst'] )
\t) {
\t\treturn;
\t}

\tif ( null === $indexes ) {
\t\t$indexes = [];
\t}

\t$collections = portfolio_light_get_content_collections();
\tforeach ( $collections as $directory => $items ) {
\t\tforeach ( $items as $entry ) {
\t\t\tif ( 'page' === ( $entry['model'] ?? '' ) ) {
\t\t\t\tif ( ! empty( $site['content']['collections']['page'] ) && empty( $site['content']['collections']['page']['sync'] ) ) {
\t\t\t\t\tcontinue;
\t\t\t\t}

\t\t\t\t$route = null;
\t\t\t\tif ( ! empty( $entry['routeId'] ) ) {
\t\t\t\t\t$route = portfolio_light_get_route( (string) $entry['routeId'] );
\t\t\t\t}

\t\t\t\t$page_index = $indexes['page'] ?? null;
\t\t\t\tif ( $route ) {
\t\t\t\t\t$existing = $page_index
\t\t\t\t\t\t? portfolio_light_find_route_page_in_index( $route, $page_index )
\t\t\t\t\t\t: portfolio_light_find_route_page( $route );
\t\t\t\t} else {
\t\t\t\t\t$existing = null;
\t\t\t\t\tif ( ! empty( $entry['sourceId'] ) && $page_index && isset( $page_index['by_source_id'][ $entry['sourceId'] ] ) ) {
\t\t\t\t\t\t$existing = $page_index['by_source_id'][ $entry['sourceId'] ];
\t\t\t\t\t}

\t\t\t\t\tif ( ! $existing && ! empty( $entry['slug'] ) ) {
\t\t\t\t\t\tif ( $page_index && isset( $page_index['by_slug'][ $entry['slug'] ] ) ) {
\t\t\t\t\t\t\t$existing = $page_index['by_slug'][ $entry['slug'] ];
\t\t\t\t\t\t} else {
\t\t\t\t\t\t\t$existing = get_page_by_path( $entry['slug'], OBJECT, 'page' );
\t\t\t\t\t\t}
\t\t\t\t\t}
\t\t\t\t}

\t\t\t\t$payload = [
\t\t\t\t\t'post_type'    => 'page',
\t\t\t\t\t'post_status'  => $route['seed']['status'] ?? ( $entry['status'] ?? 'publish' ),
\t\t\t\t\t'post_title'   => $route['title'] ?? ( $entry['title'] ?? 'Page' ),
\t\t\t\t\t'post_name'    => $route['slug'] ?? ( $entry['slug'] ?? '' ),
\t\t\t\t\t'post_excerpt' => $entry['excerpt'] ?? '',
\t\t\t\t\t'post_content' => $entry['body'] ?? '',
\t\t\t\t];

\t\t\t\tif ( $existing ) {
\t\t\t\t\t$payload['ID'] = $existing->ID;
\t\t\t\t\t$page_id       = wp_update_post( wp_slash( $payload ), true );
\t\t\t\t} else {
\t\t\t\t\t$page_id = wp_insert_post( wp_slash( $payload ), true );
\t\t\t\t}

\t\t\t\tif ( ! is_wp_error( $page_id ) ) {
\t\t\t\t\tupdate_post_meta( $page_id, '_portfolio_source_id', $entry['sourceId'] ?? '' );
\t\t\t\t\tif ( $route ) {
\t\t\t\t\t\tupdate_post_meta( $page_id, '_portfolio_route_id', (string) ( $route['id'] ?? '' ) );
\t\t\t\t\t\tif ( ! empty( $route['template'] ) && ! in_array( $route['template'], [ 'front-page', 'page' ], true ) ) {
\t\t\t\t\t\t\tupdate_post_meta( $page_id, '_wp_page_template', $route['template'] );
\t\t\t\t\t\t} else {
\t\t\t\t\t\t\tdelete_post_meta( $page_id, '_wp_page_template' );
\t\t\t\t\t\t}
\t\t\t\t\t} elseif ( array_key_exists( 'template', $entry ) ) {
\t\t\t\t\t\tif ( ! empty( $entry['template'] ) && ! in_array( $entry['template'], [ 'default', 'page', 'front-page' ], true ) ) {
\t\t\t\t\t\t\tupdate_post_meta( $page_id, '_wp_page_template', $entry['template'] );
\t\t\t\t\t\t} else {
\t\t\t\t\t\t\tdelete_post_meta( $page_id, '_wp_page_template' );
\t\t\t\t\t\t}
\t\t\t\t\t}
\t\t\t\t}
\t\t\t\tcontinue;
\t\t\t}

\t\t\tif ( 'post' === ( $entry['model'] ?? '' ) ) {
\t\t\t\t$post_index = $indexes['post'] ?? null;
\t\t\t\t$existing   = null;
\t\t\t\tif ( ! empty( $entry['sourceId'] ) && $post_index && isset( $post_index['by_source_id'][ $entry['sourceId'] ] ) ) {
\t\t\t\t\t$existing = $post_index['by_source_id'][ $entry['sourceId'] ];
\t\t\t\t} elseif ( ! empty( $entry['slug'] ) ) {
\t\t\t\t\t$existing = $post_index && isset( $post_index['by_slug'][ $entry['slug'] ] )
\t\t\t\t\t\t? $post_index['by_slug'][ $entry['slug'] ]
\t\t\t\t\t\t: get_page_by_path( $entry['slug'], OBJECT, 'post' );
\t\t\t\t}
\t\t\t\t$payload  = [
\t\t\t\t\t'post_type'    => 'post',
\t\t\t\t\t'post_status'  => $entry['status'] ?? 'publish',
\t\t\t\t\t'post_title'   => $entry['title'],
\t\t\t\t\t'post_name'    => $entry['slug'],
\t\t\t\t\t'post_excerpt' => $entry['excerpt'] ?? '',
\t\t\t\t\t'post_content' => $entry['body'] ?? '',
\t\t\t\t];

\t\t\t\tif ( $existing ) {
\t\t\t\t\t$payload['ID'] = $existing->ID;
\t\t\t\t\t$post_id       = wp_update_post( wp_slash( $payload ), true );
\t\t\t\t} else {
\t\t\t\t\t$post_id = wp_insert_post( wp_slash( $payload ), true );
\t\t\t\t}

\t\t\t\tif ( ! is_wp_error( $post_id ) ) {
\t\t\t\t\tupdate_post_meta( $post_id, '_portfolio_source_id', $entry['sourceId'] ?? '' );
\t\t\t\t}
\t\t\t\tcontinue;
\t\t\t}

\t\t\t$model = portfolio_light_get_model( $entry['model'] ?? '' );
\t\t\tif ( ! $model ) {
\t\t\t\tcontinue;
\t\t\t}

\t\t\t$model_index = $indexes[ $model['postType'] ] ?? null;
\t\t\t$existing    = null;
\t\t\tif ( ! empty( $entry['sourceId'] ) && $model_index && isset( $model_index['by_source_id'][ $entry['sourceId'] ] ) ) {
\t\t\t\t$existing = $model_index['by_source_id'][ $entry['sourceId'] ];
\t\t\t}

\t\t\tif ( ! $existing && ! empty( $entry['slug'] ) ) {
\t\t\t\t$existing = $model_index && isset( $model_index['by_slug'][ $entry['slug'] ] )
\t\t\t\t\t? $model_index['by_slug'][ $entry['slug'] ]
\t\t\t\t\t: get_page_by_path( $entry['slug'], OBJECT, $model['postType'] );
\t\t\t}

\t\t\tif ( ! empty( $site['content']['collections'][ $entry['model'] ] ) && empty( $site['content']['collections'][ $entry['model'] ]['sync'] ) ) {
\t\t\t\tcontinue;
\t\t\t}

\t\t\t$payload = [
\t\t\t\t'title'      => $entry['title'] ?? '',
\t\t\t\t'slug'       => $entry['slug'] ?? '',
\t\t\t\t'excerpt'    => $entry['excerpt'] ?? '',
\t\t\t\t'postStatus' => $entry['status'] ?? 'publish',
\t\t\t\t'content'    => $entry['body'] ?? '',
\t\t\t];

\t\t\tforeach ( $entry['fields'] ?? [] as $field_id => $value ) {
\t\t\t\t$payload[ $field_id ] = $value;
\t\t\t}

\t\t\tforeach ( $entry['terms'] ?? [] as $taxonomy => $terms ) {
\t\t\t\t$payload[ $taxonomy ] = $terms;
\t\t\t}

\t\t\t$saved = portfolio_light_upsert_record( $model, $payload, $existing ? $existing->ID : 0 );
\t\t\tif ( ! is_wp_error( $saved ) && ! empty( $entry['sourceId'] ) ) {
\t\t\t\tupdate_post_meta( $saved->ID, '_portfolio_source_id', $entry['sourceId'] );
\t\t\t}
\t\t}
\t}
}

function portfolio_light_seed_site() {
\t$indexes = [
\t\t'page' => portfolio_light_build_post_index( 'page' ),
\t\t'post' => portfolio_light_build_post_index( 'post' ),
\t];
\tforeach ( portfolio_light_get_models() as $model ) {
\t\tif ( 'collection' !== ( $model['type'] ?? '' ) ) {
\t\t\tcontinue;
\t\t}
\t\t$pt = $model['postType'] ?? '';
\t\tif ( $pt && ! isset( $indexes[ $pt ] ) ) {
\t\t\t$indexes[ $pt ] = portfolio_light_build_post_index( $pt );
\t\t}
\t}

\t$page_ids = [];
\tforeach ( portfolio_light_get_routes() as $route ) {
\t\t$page_ids[ $route['id'] ] = portfolio_light_seed_page_from_route( $route, $indexes['page'] );
\t}

\tportfolio_light_cleanup_route_duplicates( $page_ids );

\tportfolio_light_seed_singletons();
\tportfolio_light_cleanup_default_content();
\tportfolio_light_seed_collection_items( $indexes );

\t$site = portfolio_light_get_site_config();
\tif ( ! empty( $site['theme']['slug'] ) ) {
\t\tswitch_theme( $site['theme']['slug'] );
\t}
\t$front_page = $page_ids[ $site['frontPage'] ?? '' ] ?? 0;
\t$posts_page = $page_ids[ $site['postsPage'] ?? '' ] ?? 0;

\tif ( ! empty( $site['title'] ) ) {
\t\tupdate_option( 'blogname', $site['title'] );
\t}

\tif ( ! empty( $site['tagline'] ) ) {
\t\tupdate_option( 'blogdescription', $site['tagline'] );
\t}

\tif ( $front_page ) {
\t\tupdate_option( 'show_on_front', 'page' );
\t\tupdate_option( 'page_on_front', $front_page );
\t}

\tif ( $posts_page ) {
\t\tupdate_option( 'page_for_posts', $posts_page );
\t}

\tupdate_option( 'permalink_structure', '/%postname%/' );

\tflush_rewrite_rules();
}
`;
}

async function writeGeneratedPlugin(siteSchema, adminSchemas, site, paths) {
  const incDir = path.join(paths.pluginRoot, 'inc');
  const compiledDir = path.join(paths.pluginRoot, 'compiled');
  const compiledAdminDir = path.join(compiledDir, 'admin-schema');

  await ensureDir(incDir);
  await ensureDir(compiledAdminDir);
  await ensureDir(path.join(paths.pluginRoot, 'build'));

  const pluginSlug = site.plugin?.slug ?? 'wp-light-app';
  await writeFile(path.join(paths.pluginRoot, `${pluginSlug}.php`), pluginMainFile(site));
  await writeFile(path.join(incDir, 'helpers.php'), phpHelpersFile());
  await writeFile(path.join(incDir, 'register-post-types.php'), phpRegisterPostTypesFile());
  await writeFile(path.join(incDir, 'register-taxonomies.php'), phpRegisterTaxonomiesFile());
  await writeFile(path.join(incDir, 'register-meta.php'), phpRegisterMetaFile());
  await writeFile(path.join(incDir, 'register-singletons.php'), phpRegisterSingletonsFile());
  await writeFile(path.join(incDir, 'register-rest.php'), phpRegisterRestFile());
  await writeFile(path.join(incDir, 'register-admin-app.php'), phpRegisterAdminAppFile());
  await writeFile(path.join(incDir, 'register-login-style.php'), phpRegisterLoginStyleFile());
  await writeFile(path.join(incDir, 'seed.php'), phpSeedFile());
  await writeStaticAssets(paths.pluginRoot);
  await writeFile(
    path.join(compiledDir, 'site-schema.json'),
    JSON.stringify(siteSchema, null, 2)
  );
  await writeFile(
    path.join(compiledDir, 'dev-state.json'),
    `${JSON.stringify({ enabled: false, version: null, heartbeatAt: null }, null, 2)}\n`
  );

  for (const [fileName, schema] of Object.entries(adminSchemas)) {
    await writeFile(
      path.join(compiledAdminDir, fileName),
      JSON.stringify(schema, null, 2)
    );
  }

  await cp(path.join(paths.root, 'blocks'), path.join(paths.pluginRoot, 'blocks'), {
    recursive: true,
  });
  await writeFile(path.join(paths.pluginRoot, 'build', '.gitkeep'), '');
}

async function hashPath(target) {
  const hash = createHash('sha1');
  async function walk(p) {
    let stat;
    try {
      const entries = await readdir(p, { withFileTypes: true });
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
        const full = path.join(p, entry.name);
        hash.update(entry.name + (entry.isDirectory() ? '/' : ''));
        if (entry.isDirectory()) {
          await walk(full);
        } else if (entry.isFile()) {
          hash.update(await readFile(full));
        }
      }
      return;
    } catch (err) {
      if (err.code === 'ENOTDIR') {
        try {
          hash.update(await readFile(p));
        } catch {}
        return;
      }
      if (err.code !== 'ENOENT') throw err;
    }
  }
  await walk(target);
  return hash.digest('hex');
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
