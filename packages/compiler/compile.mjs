import { cp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import matter from 'gray-matter';
import { marked } from 'marked';
import { phpHelpersFile } from './lib/php/helpers.mjs';
import { phpRegisterPostTypesFile } from './lib/php/register-post-types.mjs';
import { phpRegisterTaxonomiesFile } from './lib/php/register-taxonomies.mjs';
import { phpRegisterMetaFile } from './lib/php/register-meta.mjs';
import { phpRegisterSingletonsFile } from './lib/php/register-singletons.mjs';
import { phpRegisterRestFile } from './lib/php/register-rest.mjs';
import { phpRegisterAdminAppFile } from './lib/php/register-admin-app.mjs';
import { phpRegisterLoginStyleFile, loginStyleCss } from './lib/php/register-login-style.mjs';
import { phpSeedFile } from './lib/php/seed.mjs';
import { writeGeneratedPlugin, writeStaticAssets, hashPath } from './lib/emit-plugin.mjs';
import { resolveRoot, resolvePaths } from './lib/paths.mjs';
import { pluralize, singularLabel, toTitleCase } from './lib/strings.mjs';
import { serializeBlock, tokenToBlockMarkup, markdownToBlockMarkup } from './lib/markdown-blocks.mjs';
import { getBuiltinPostModel, getBuiltinPageModel, fieldTypeForAdmin, normalizeFieldDescriptor, buildModelAdminFields, buildCollectionViewSchema, buildCollectionFormSchema, buildSingletonFormSchema } from './lib/models.mjs';
import { buildMenuLinkUrl, compileNavigationMarkup, compileNavigationTemplate } from './lib/navigation.mjs';
import { resolvePatternName, expandTemplateReferences, resolveSingleTemplateName } from './lib/patterns.mjs';

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

async function readJsonIfExists(filePath) {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function buildGoogleFontsImport(fonts) {
  if (!fonts || !Array.isArray(fonts.families) || fonts.families.length === 0) {
    return { importUrl: null, css: '', fontFamilies: [] };
  }
  const googleFams = fonts.families.filter((f) => (f.source ?? 'google') === 'google');
  const specs = googleFams.map((f) => {
    const fam = encodeURIComponent(f.family).replace(/%20/g, '+');
    const weights = (f.weights && f.weights.length ? f.weights : [400]).slice().sort((a, b) => a - b);
    const styles = f.styles && f.styles.length ? f.styles : ['normal'];
    const hasItalic = styles.includes('italic');
    if (hasItalic) {
      const ital = [];
      for (const w of weights) ital.push(`0,${w}`);
      for (const w of weights) ital.push(`1,${w}`);
      return `family=${fam}:ital,wght@${ital.join(';')}`;
    }
    return `family=${fam}:wght@${weights.join(';')}`;
  });
  const importUrl = specs.length
    ? `https://fonts.googleapis.com/css2?${specs.join('&')}&display=swap`
    : null;

  const fontFamilies = fonts.families.map((f) => {
    const stack = f.stack ?? '';
    const primary = `'${f.family}'`;
    const fontFamily = stack ? `${primary}, ${stack}` : primary;
    return { slug: f.slug, name: f.name ?? f.family, fontFamily };
  });

  const css = importUrl ? `@import url('${importUrl}');\n` : '';
  return { importUrl, css, fontFamilies };
}

async function applyFontsManifestToThemeJson(themeTargetRoot, fontFamilies) {
  if (!fontFamilies || fontFamilies.length === 0) return;
  const themeJsonPath = path.join(themeTargetRoot, 'theme.json');
  try {
    const raw = await readFile(themeJsonPath, 'utf8');
    const themeJson = JSON.parse(raw);
    themeJson.settings = themeJson.settings ?? {};
    themeJson.settings.typography = themeJson.settings.typography ?? {};
    themeJson.settings.typography.fontFamilies = fontFamilies;
    await writeFile(themeJsonPath, JSON.stringify(themeJson, null, 2) + '\n');
  } catch {
    // no theme.json — skip
  }
}

async function copyThemeSource(themeSourceRoot, themeTargetRoot, themeSlug, siteSchema, siteRoot) {
  await ensureDir(themeTargetRoot);
  await cp(themeSourceRoot, themeTargetRoot, { recursive: true });

  const fontsManifest = await readJsonIfExists(path.join(themeSourceRoot, 'fonts.json'));
  const fonts = buildGoogleFontsImport(fontsManifest);
  if (fontsManifest) {
    await applyFontsManifestToThemeJson(themeTargetRoot, fonts.fontFamilies);
    await rm(path.join(themeTargetRoot, 'fonts.json'), { force: true });
  }

  if (siteRoot) {
    const mediaSrc = path.join(siteRoot, 'content', 'media');
    const mediaDst = path.join(themeTargetRoot, 'assets', 'media');
    try {
      await cp(mediaSrc, mediaDst, { recursive: true });
    } catch {
      // no content/media — skip
    }
  }

  let themeStylesheet = '';
  try {
    themeStylesheet = await readFile(path.join(themeSourceRoot, 'style.css'), 'utf8');
  } catch {
    themeStylesheet = '';
  }
  await writeFile(
    path.join(themeTargetRoot, 'style.css'),
    `/*\nTheme Name: ${toTitleCase(themeSlug)}\n*/\n\n${fonts.css}${themeStylesheet}`
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
  await copyThemeSource(path.join(root, 'theme'), themeRoot, site.theme.slug, siteSchema, root);
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
