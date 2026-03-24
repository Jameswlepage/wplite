#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, watch, writeFileSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import matter from 'gray-matter';
import TurndownService from 'turndown';
import { build, resolveRoot } from './compile.mjs';

const ROOT = resolveRoot();
const command = (() => {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root') { i++; continue; }
    return args[i];
  }
  return 'build';
})();
const PLAYGROUND_HOST = '127.0.0.1';
const PLAYGROUND_DEFAULT_PORT = 9400;
const PLAYGROUND_MAX_PORT = 9410;
const DEV_HEARTBEAT_INTERVAL_MS = 2000;
const WATCH_TARGETS = [
  'app',
  'content',
  'theme',
  'admin',
  'blocks',
  'admin-app',
  'scripts',
  'package.json',
];
const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});

function run(commandName, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(commandName, args, {
      cwd: ROOT,
      stdio: 'inherit',
      shell: false,
      ...options,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${commandName} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

function capture(commandName, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(commandName, args, {
      cwd: ROOT,
      shell: false,
      ...options,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(
        new Error(
          `${commandName} ${args.join(' ')} exited with code ${code}\n${stderr || stdout}`
        )
      );
    });
  });
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

function extractJsonBlock(raw) {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');

  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Unable to find JSON in output:\n${raw}`);
  }

  return raw.slice(start, end + 1);
}

async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

async function loadGeneratedSiteSchema() {
  return JSON.parse(await readFile(path.join(ROOT, 'generated', 'site-schema.json'), 'utf8'));
}

async function loadSiteConfig() {
  return JSON.parse(await readFile(path.join(ROOT, 'app', 'site.json'), 'utf8'));
}

function loadSiteConfigSync() {
  try {
    return JSON.parse(readFileSync(path.join(ROOT, 'app', 'site.json'), 'utf8'));
  } catch {
    return {};
  }
}

function resolveDevStatePathFromSite(site = {}) {
  const pluginSlug = site?.plugin?.slug ?? 'wp-light-app';

  return path.join(
    ROOT,
    'generated',
    'wp-content',
    'plugins',
    pluginSlug,
    'compiled',
    'dev-state.json'
  );
}

async function resolveDevStatePath() {
  return resolveDevStatePathFromSite(await loadSiteConfig());
}

function compilerDir() {
  return path.dirname(new URL(import.meta.url).pathname);
}

function playgroundUrlForPort(port) {
  return `http://${PLAYGROUND_HOST}:${port}`;
}

function parsePortFromUrl(url) {
  try {
    const parsed = new URL(url);
    return Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80));
  } catch {
    return null;
  }
}

function resolvePlaygroundStatePath() {
  return path.join(ROOT, 'generated', 'playground-state.json');
}

async function readPlaygroundState() {
  try {
    return JSON.parse(await readFile(resolvePlaygroundStatePath(), 'utf8'));
  } catch {
    return null;
  }
}

async function writePlaygroundState(state) {
  const filePath = resolvePlaygroundStatePath();
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`);
}

async function isPortListening(port) {
  try {
    const stdout = await capture('lsof', ['-ti', `tcp:${port}`]);
    return stdout
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean)
      .length > 0;
  } catch {
    return false;
  }
}

async function buildGeneratedSite() {
  const result = await build(ROOT);
  const adminOutDir = path.join(result.pluginRoot, 'build');
  const viteConfig = path.join(compilerDir(), 'admin-app/vite.config.mjs');
  await run('npx', ['vite', 'build', '--config', viteConfig], {
    env: { ...process.env, WPLITE_ADMIN_OUT_DIR: adminOutDir },
  });
}

async function writeDevState(state) {
  const devStatePath = await resolveDevStatePath();
  await ensureDir(path.dirname(devStatePath));
  await writeFile(devStatePath, `${JSON.stringify(state, null, 2)}\n`);
}

async function readDevState() {
  const devStatePath = await resolveDevStatePath();
  try {
    return JSON.parse(await readFile(devStatePath, 'utf8'));
  } catch {
    return {
      enabled: false,
      version: null,
      heartbeatAt: null,
    };
  }
}

async function disableDevState() {
  await writeDevState({ enabled: false, version: null, heartbeatAt: null });
}

async function bumpDevState() {
  const timestamp = new Date().toISOString();
  await writeDevState({
    enabled: true,
    version: timestamp,
    heartbeatAt: timestamp,
  });
}

async function heartbeatDevState() {
  const current = await readDevState();
  await writeDevState({
    enabled: true,
    version: current.version ?? new Date().toISOString(),
    heartbeatAt: new Date().toISOString(),
  });
}

function disableDevStateSync() {
  const devStatePath = resolveDevStatePathFromSite(loadSiteConfigSync());
  mkdirSync(path.dirname(devStatePath), { recursive: true });
  writeFileSync(
    devStatePath,
    `${JSON.stringify({ enabled: false, version: null, heartbeatAt: null }, null, 2)}\n`
  );
}

async function isUrlReachable(url) {
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(2000),
    });

    return response.status < 500;
  } catch {
    return false;
  }
}

async function currentPlaygroundMatchesSite(siteUrl, site) {
  const pluginSlug = site?.plugin?.slug;

  if (!pluginSlug) {
    return false;
  }

  try {
    const response = await fetch(
      `${siteUrl}/wp-content/plugins/${pluginSlug}/build/admin-app.js`,
      {
        redirect: 'manual',
        signal: AbortSignal.timeout(2000),
      }
    );

    return response.status === 200;
  } catch {
    return false;
  }
}

async function stopProcessOnPort(port) {
  let stdout = '';

  try {
    stdout = await capture('lsof', ['-ti', `tcp:${port}`]);
  } catch {
    return;
  }

  const pids = stdout
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // Ignore processes that already exited.
    }
  }

  if (pids.length > 0) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

async function findMatchingPlaygroundUrls(site) {
  const state = await readPlaygroundState();
  const candidateUrls = [];

  if (state?.url) {
    candidateUrls.push(String(state.url));
  }

  for (let port = PLAYGROUND_DEFAULT_PORT; port <= PLAYGROUND_MAX_PORT; port += 1) {
    candidateUrls.push(playgroundUrlForPort(port));
  }

  const uniqueUrls = [...new Set(candidateUrls)];
  const matches = [];

  for (const siteUrl of uniqueUrls) {
    if (!(await isUrlReachable(siteUrl))) {
      continue;
    }

    if (await currentPlaygroundMatchesSite(siteUrl, site)) {
      matches.push(siteUrl);
    }
  }

  return matches;
}

async function findAvailablePlaygroundPort(preferredPort = PLAYGROUND_DEFAULT_PORT) {
  const ports = [];

  if (preferredPort >= PLAYGROUND_DEFAULT_PORT && preferredPort <= PLAYGROUND_MAX_PORT) {
    ports.push(preferredPort);
  }

  for (let port = PLAYGROUND_DEFAULT_PORT; port <= PLAYGROUND_MAX_PORT; port += 1) {
    if (!ports.includes(port)) {
      ports.push(port);
    }
  }

  for (const port of ports) {
    if (!(await isPortListening(port))) {
      return port;
    }
  }

  throw new Error(
    `Unable to find a free Playground port between ${PLAYGROUND_DEFAULT_PORT} and ${PLAYGROUND_MAX_PORT}.`
  );
}

async function waitForUrl(url, timeoutMs = 45000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isUrlReachable(url)) {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function startPlaygroundServer(site) {
  const matchingUrls = await findMatchingPlaygroundUrls(site);
  if (matchingUrls.length > 0) {
    const state = await readPlaygroundState();
    const chosenUrl = state?.url && matchingUrls.includes(state.url)
      ? state.url
      : matchingUrls[0];

    const duplicates = matchingUrls.filter((siteUrl) => siteUrl !== chosenUrl);
    if (duplicates.length > 0) {
      process.stdout.write(
        `Multiple matching Playground sites found. Using ${chosenUrl} and ignoring ${duplicates.join(', ')}\n`
      );
    }

    await writePlaygroundState({
      url: chosenUrl,
      pluginSlug: site?.plugin?.slug ?? null,
      updatedAt: new Date().toISOString(),
    });
    process.stdout.write(`Playground already available at ${chosenUrl}\n`);
    return chosenUrl;
  }

  const pluginSlug = site?.plugin?.slug ?? 'wp-light-app';
  const themeSlug = site?.theme?.slug ?? 'wp-light-theme';
  const state = await readPlaygroundState();
  const preferredPort = parsePortFromUrl(state?.url ?? '') ?? PLAYGROUND_DEFAULT_PORT;
  const port = await findAvailablePlaygroundPort(preferredPort);
  const siteUrl = playgroundUrlForPort(port);
  const pluginMount = `${path.join(
    ROOT,
    'generated',
    'wp-content',
    'plugins',
    pluginSlug
  )}:/wordpress/wp-content/plugins/${pluginSlug}`;
  const themeMount = `${path.join(
    ROOT,
    'generated',
    'wp-content',
    'themes',
    themeSlug
  )}:/wordpress/wp-content/themes/${themeSlug}`;

  const child = spawn(
    'npx',
    [
      '@wp-playground/cli@latest',
      'server',
      '--port',
      String(port),
      '--login',
      '--mount',
      pluginMount,
      '--mount',
      themeMount,
      '--blueprint',
      path.join(ROOT, 'generated', 'blueprint.json'),
      '--blueprint-may-read-adjacent-files',
      '--verbosity',
      'quiet',
    ],
    {
      cwd: ROOT,
      detached: true,
      stdio: 'ignore',
      shell: false,
    }
  );

  child.unref();
  await waitForUrl(siteUrl);
  await writePlaygroundState({
    url: siteUrl,
    pluginSlug,
    updatedAt: new Date().toISOString(),
  });
  process.stdout.write(`Playground started at ${siteUrl}\n`);
  return siteUrl;
}

async function canUseDocker() {
  try {
    await capture('docker', ['info']);
    return true;
  } catch {
    return false;
  }
}

function collectionSourcesFromSchema(schema) {
  return [
    ...schema.models
      .filter((model) => model.type === 'collection')
      .map((model) => ({
        id: model.id,
        directory: pluralize(model.id),
      })),
    {
      id: 'post',
      directory: 'posts',
    },
  ];
}

function pageContentDir() {
  return path.join(ROOT, 'content', 'pages');
}

async function clearMarkdownFiles(dirPath) {
  await ensureDir(dirPath);
  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      await rm(path.join(dirPath, entry.name), { force: true });
    }
  }
}

function sanitizeFrontMatter(entry) {
  const frontMatter = {
    model: entry.model,
    sourceId: entry.sourceId || `${entry.model}.${entry.slug}`,
    slug: entry.slug,
    title: entry.title,
    excerpt: entry.excerpt || undefined,
    status: entry.status,
  };

  if (entry.terms && Object.keys(entry.terms).length > 0) {
    frontMatter.terms = entry.terms;
  }

  if (entry.fields && Object.keys(entry.fields).length > 0) {
    frontMatter.fields = entry.fields;
  }

  return Object.fromEntries(
    Object.entries(frontMatter).filter(([, value]) => value !== undefined && value !== '')
  );
}

function sanitizePageFrontMatter(entry) {
  if (entry.routeId) {
    return Object.fromEntries(
      Object.entries({
        model: 'page',
        routeId: entry.routeId,
        sourceId: entry.sourceId || `page.${entry.routeId}`,
        excerpt: entry.excerpt || undefined,
      }).filter(([, value]) => value !== undefined && value !== '')
    );
  }

  return Object.fromEntries(
    Object.entries({
      model: 'page',
      sourceId: entry.sourceId || `page.${entry.slug}`,
      slug: entry.slug,
      title: entry.title,
      excerpt: entry.excerpt || undefined,
      status: entry.status ?? entry.postStatus,
      template: entry.template || undefined,
    }).filter(([, value]) => value !== undefined && value !== '')
  );
}

function htmlToMarkdown(html) {
  if (!html) {
    return '';
  }

  return turndown.turndown(html).trim();
}

async function writePulledCollections(schema, payload) {
  const collectionSources = collectionSourcesFromSchema(schema);
  const siteContent = schema.site.content ?? {};
  const pullEnabled = siteContent.pull !== false;

  if (!pullEnabled) {
    return;
  }

  for (const source of collectionSources) {
    const collectionSettings = siteContent.collections?.[source.id];
    if (collectionSettings?.sync === false) {
      continue;
    }

    const dirPath = path.join(ROOT, 'content', source.directory);
    await clearMarkdownFiles(dirPath);

    for (const item of payload.collections?.[source.id] ?? []) {
      const slug = item.slug || `${source.id}-${item.id}`;
      const markdown = htmlToMarkdown(item.body);
      const fileContents = matter.stringify(markdown ? `${markdown}\n` : '', sanitizeFrontMatter(item));
      await writeFile(path.join(dirPath, `${slug}.md`), fileContents);
    }
  }
}

async function writePulledPages(schema, payload) {
  const siteContent = schema.site.content ?? {};
  const pullEnabled = siteContent.pull !== false;

  if (!pullEnabled || siteContent.collections?.page?.sync === false) {
    return;
  }

  const dirPath = pageContentDir();
  await clearMarkdownFiles(dirPath);

  for (const page of payload.pages ?? []) {
    const fileName = `${page.routeId || page.slug || `page-${page.id}`}.md`;
    const markdown = htmlToMarkdown(page.body ?? page.content ?? '');
    const fileContents = matter.stringify(
      markdown ? `${markdown}\n` : '',
      sanitizePageFrontMatter(page)
    );
    await writeFile(path.join(dirPath, fileName), fileContents);
  }
}

async function writePulledSingletons(payload) {
  const singletonsDir = path.join(ROOT, 'content', 'singletons');
  await ensureDir(singletonsDir);

  for (const [singletonId, data] of Object.entries(payload.singletons ?? {})) {
    await writeFile(
      path.join(singletonsDir, `${singletonId}.json`),
      `${JSON.stringify({ singleton: singletonId, data }, null, 2)}\n`
    );
  }
}

async function buildExistingPageSourceMaps() {
  const bySlug = new Map();
  const byRouteId = new Map();
  const dirPath = pageContentDir();
  const entries = [];

  try {
    entries.push(...(await readdir(dirPath, { withFileTypes: true })));
  } catch {
    return { bySlug, byRouteId };
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) {
      continue;
    }

    const filePath = path.join(dirPath, entry.name);
    const parsed = matter(await readFile(filePath, 'utf8'));
    const fileStem = path.basename(entry.name, '.md');
    const slug = parsed.data.slug || fileStem;
    const routeId = parsed.data.routeId || '';
    const sourceId = parsed.data.sourceId || `page.${routeId || slug}`;

    bySlug.set(String(slug), sourceId);
    if (routeId) {
      byRouteId.set(String(routeId), sourceId);
    }
  }

  return { bySlug, byRouteId };
}

async function writePulledRoutes(schema, payload) {
  const siteContent = schema.site.content ?? {};
  const pullEnabled = siteContent.pull !== false;

  if (!pullEnabled) {
    return;
  }

  const syncPagesToMarkdown = siteContent.collections?.page?.sync !== false;

  const routesById = new Map(
    (schema.routes ?? [])
      .filter((route) => route.type === 'page')
      .map((route) => [String(route.id), route])
  );

  for (const page of payload.pages ?? []) {
    if (!page.routeId) {
      continue;
    }

    const existingRoute = routesById.get(String(page.routeId));
    if (!existingRoute) {
      continue;
    }

    const preserveRootSlug =
      page.routeId === schema.site?.frontPage && String(existingRoute.slug ?? '') === '';

    const nextRoute = {
      ...existingRoute,
      title: page.title || existingRoute.title,
      slug: preserveRootSlug ? '' : (page.slug ?? existingRoute.slug ?? ''),
      seed: {
        ...(existingRoute.seed ?? {}),
        createPageShell: true,
        status: page.status ?? page.postStatus ?? existingRoute.seed?.status ?? 'publish',
        ...(syncPagesToMarkdown
          ? {}
          : {
              content: page.body ?? page.content ?? existingRoute.seed?.content ?? '',
            }),
      },
    };

    if (page.template && page.template !== 'default') {
      nextRoute.template = page.template;
    }

    await writeFile(
      path.join(ROOT, 'app', 'routes', `${page.routeId}.json`),
      `${JSON.stringify(nextRoute, null, 2)}\n`
    );
  }
}

async function buildExistingSourceMaps(schema) {
  const sourceMaps = {};

  for (const source of collectionSourcesFromSchema(schema)) {
    const dirPath = path.join(ROOT, 'content', source.directory);
    const entries = [];

    try {
      entries.push(...(await readdir(dirPath, { withFileTypes: true })));
    } catch {
      sourceMaps[source.id] = new Map();
      continue;
    }

    const sourceMap = new Map();

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) {
        continue;
      }

      const filePath = path.join(dirPath, entry.name);
      const parsed = matter(await readFile(filePath, 'utf8'));
      const slug = parsed.data.slug || path.basename(entry.name, '.md');
      const sourceId = parsed.data.sourceId || `${source.id}.${slug}`;

      sourceMap.set(String(slug), sourceId);
    }

    sourceMaps[source.id] = sourceMap;
  }

  return sourceMaps;
}

function getBuiltinPostModel() {
  return {
    id: 'post',
    label: 'Posts',
    type: 'collection',
    postType: 'post',
    taxonomies: ['category', 'post_tag'],
    fields: {},
  };
}

async function fetchBootstrapFromLocalSite(siteUrl) {
  const session = await createLocalAdminSession(siteUrl);

  return fetch(`${siteUrl}/wp-json/portfolio/v1/bootstrap`, {
    headers: {
      Cookie: session.cookies,
      'X-WP-Nonce': session.nonce,
    },
  }).then(async (response) => {
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.message || 'Failed to fetch local bootstrap payload.');
    }

    return payload;
  });
}

async function createLocalAdminSession(siteUrl) {
  const loginResponse = await fetch(`${siteUrl}/wp-login.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      log: 'admin',
      pwd: 'password',
      'wp-submit': 'Log In',
      redirect_to: `${siteUrl}/wp-admin/`,
      testcookie: '1',
    }),
    redirect: 'manual',
  });

  const cookies = loginResponse.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';', 1)[0])
    .join('; ');

  if (!cookies) {
    throw new Error('Unable to establish a local admin session for pull.');
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const html = await fetch(`${siteUrl}/app/`, {
      headers: {
        Cookie: cookies,
      },
    }).then((response) => response.text());

    const nonceMatch = html.match(/"nonce":"([^"]+)"/);
    if (nonceMatch) {
      return {
        cookies,
        nonce: nonceMatch[1],
      };
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });
  }

  throw new Error('Unable to find the REST nonce in the local admin shell.');
}

async function runLocalSeed(siteUrl) {
  const session = await createLocalAdminSession(siteUrl);

  const response = await fetch(`${siteUrl}/wp-json/portfolio/v1/seed`, {
    method: 'POST',
    headers: {
      Cookie: session.cookies,
      'X-WP-Nonce': session.nonce,
    },
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.message || 'Failed to seed the local site.');
  }
}

async function normalizePullPayloadFromBootstrap(schema, bootstrap) {
  const existingSourceMaps = await buildExistingSourceMaps(schema);
  const existingPageSourceMaps = await buildExistingPageSourceMaps();
  const modelMap = Object.fromEntries(
    [...schema.models, getBuiltinPostModel()].map((model) => [model.id, model])
  );
  const relationSourceMaps = {};

  for (const [modelId, records] of Object.entries(bootstrap.records ?? {})) {
    const sourceMap = new Map();

    for (const record of records) {
      const existing = existingSourceMaps[modelId]?.get(String(record.slug));
      sourceMap.set(String(record.id), existing || `${modelId}.${record.slug}`);
    }

    relationSourceMaps[modelId] = sourceMap;
  }

  const collections = {};

  for (const source of collectionSourcesFromSchema(schema)) {
    const model = modelMap[source.id];
    const modelFields = model?.fields ?? {};
    const modelTaxonomies = model?.taxonomies ?? [];

    collections[source.id] = (bootstrap.records?.[source.id] ?? []).map((record) => {
      const fields = {};
      const terms = {};

      for (const [fieldId, field] of Object.entries(modelFields)) {
        let value = record[fieldId];

        if (field.type === 'relation' && value) {
          const relatedRecords = bootstrap.records?.[field.target] ?? [];
          const related = relatedRecords.find((item) => String(item.id) === String(value));

          if (related) {
            value =
              relationSourceMaps[field.target]?.get(String(related.id)) ??
              `${field.target}.${related.slug}`;
          }
        }

        if (value !== undefined && value !== null && value !== '') {
          fields[fieldId] = value;
        }
      }

      for (const taxonomy of modelTaxonomies) {
        if (Array.isArray(record[taxonomy]) && record[taxonomy].length > 0) {
          terms[taxonomy] = record[taxonomy];
        }
      }

      const sourceId =
        existingSourceMaps[source.id]?.get(String(record.slug)) ?? `${source.id}.${record.slug}`;

      return {
        model: source.id,
        sourceId,
        slug: record.slug,
        title: record.title,
        excerpt: record.excerpt || undefined,
        status: record.postStatus,
        fields,
        terms,
        body: record.content,
      };
    });
  }

  const pages = (bootstrap.pages ?? []).map((page) => {
    const sourceId =
      existingPageSourceMaps.byRouteId.get(String(page.routeId || '')) ||
      existingPageSourceMaps.bySlug.get(String(page.slug || '')) ||
      `page.${page.routeId || page.slug || page.id}`;

    return {
      id: page.id,
      model: 'page',
      routeId: page.routeId || undefined,
      sourceId,
      slug: page.slug,
      title: page.title,
      excerpt: page.excerpt || undefined,
      status: page.status ?? page.postStatus,
      template: page.template || undefined,
      body: page.body ?? page.content ?? '',
    };
  });

  return {
    collections,
    pages,
    singletons: bootstrap.singletonData ?? {},
  };
}

async function buildCommand() {
  await buildGeneratedSite();
}

async function syncRunningSite({ useDocker } = {}) {
  await buildGeneratedSite();
  const site = await loadSiteConfig();

  if (useDocker ?? (await canUseDocker())) {
    await run('npx', ['wp-env', 'start']);
    await run('npx', ['wp-env', 'run', 'cli', 'wp', 'eval', 'portfolio_light_seed_site();']);
    return { siteUrl: null, mode: 'docker' };
  }

  const siteUrl = await startPlaygroundServer(site);
  await runLocalSeed(siteUrl);
  return { siteUrl, mode: 'playground' };
}

async function applyCommand() {
  const { siteUrl, mode } = await syncRunningSite();
  if (mode === 'playground' && siteUrl) {
    process.stdout.write(`Applied site to ${siteUrl}\n`);
  }
}

function watchPath(target, onChange) {
  const absoluteTarget = path.join(ROOT, target);
  const watcher = watch(
    absoluteTarget,
    { recursive: path.extname(target) === '' },
    (eventType, fileName) => {
      const changedPath = fileName ? path.join(target, String(fileName)) : target;
      onChange({ eventType, changedPath });
    }
  );

  watcher.on('error', (error) => {
    process.stderr.write(`Watcher error for ${target}: ${error.message}\n`);
  });

  return watcher;
}

async function devCommand() {
  const useDocker = await canUseDocker();
  const initialSync = await syncRunningSite({ useDocker });
  await bumpDevState();

  process.stdout.write('Development environment started with live rebuilds.\n');
  if (initialSync.mode === 'playground' && initialSync.siteUrl) {
    process.stdout.write(`Local site: ${initialSync.siteUrl}\n`);
  }
  process.stdout.write(
    `Watching ${WATCH_TARGETS.join(', ')} for changes. Press Ctrl+C to stop.\n`
  );

  let timer = null;
  const heartbeatTimer = setInterval(() => {
    void heartbeatDevState();
  }, DEV_HEARTBEAT_INTERVAL_MS);
  let syncing = false;
  let queued = false;
  const changedPaths = new Set();
  const watchers = WATCH_TARGETS.map((target) => watchPath(target, ({ changedPath }) => {
    changedPaths.add(changedPath);
    clearTimeout(timer);
    timer = setTimeout(() => {
      void flushChanges();
    }, 250);
  }));

  async function flushChanges() {
    if (syncing) {
      queued = true;
      return;
    }

    syncing = true;
    const reasons = [...changedPaths];
    changedPaths.clear();
    process.stdout.write(`Detected changes: ${reasons.join(', ')}\n`);

    try {
      const syncResult = await syncRunningSite({ useDocker });
      await bumpDevState();
      if (syncResult.mode === 'playground' && syncResult.siteUrl) {
        process.stdout.write(`Updated ${syncResult.siteUrl}\n`);
      }
      process.stdout.write('Rebuilt, reseeded, and triggered browser refresh.\n');
    } catch (error) {
      process.stderr.write(`Watch rebuild failed: ${error.stack || error.message}\n`);
    } finally {
      syncing = false;
    }

    if (queued || changedPaths.size > 0) {
      queued = false;
      await flushChanges();
    }
  }

  await new Promise((resolve) => {
    let cleanedUp = false;

    const cleanup = () => {
      if (cleanedUp) {
        return;
      }

      cleanedUp = true;
      clearTimeout(timer);
      clearInterval(heartbeatTimer);
      for (const watcher of watchers) {
        watcher.close();
      }
      disableDevStateSync();
    };

    const shutdown = (exitCode = 0) => {
      cleanup();
      resolve();
      process.exit(exitCode);
    };

    process.once('exit', () => {
      cleanup();
    });

    process.once('SIGINT', () => {
      shutdown(0);
    });
    process.once('SIGTERM', () => {
      shutdown(0);
    });
  });
}

async function pullCommand() {
  await buildGeneratedSite();
  const schema = await loadGeneratedSiteSchema();

  let payload;

  if (await canUseDocker()) {
    await run('npx', ['wp-env', 'start']);
    const raw = await capture('npx', [
      'wp-env',
      'run',
      'cli',
      'wp',
      'eval',
      'echo wp_json_encode( portfolio_light_export_pull_data() );',
    ]);
    payload = JSON.parse(extractJsonBlock(raw));
  } else {
    const site = await loadSiteConfig();
    const siteUrl = await startPlaygroundServer(site);

    const bootstrap = await fetchBootstrapFromLocalSite(siteUrl);
    payload = await normalizePullPayloadFromBootstrap(schema, bootstrap);
  }

  await writePulledCollections(schema, payload);
  await writePulledPages(schema, payload);
  await writePulledRoutes(schema, payload);
  await writePulledSingletons(payload);

  process.stdout.write('Pulled WordPress content into markdown and singleton data files.\n');
}

async function ejectCommand() {
  const filePath = path.join(ROOT, '.wp-light.ejected');
  await writeFile(filePath, JSON.stringify({ ejectedAt: new Date().toISOString() }, null, 2));
  process.stdout.write(`Recorded eject marker at ${filePath}\n`);
}

async function initCommand() {
  const siteConfig = await readFile(path.join(ROOT, 'app', 'site.json'), 'utf8');
  process.stdout.write(`Source tree already initialized.\n${siteConfig}\n`);
}

const commands = {
  init: initCommand,
  build: buildCommand,
  apply: applyCommand,
  dev: devCommand,
  pull: pullCommand,
  eject: ejectCommand,
};

if (!commands[command]) {
  process.stderr.write(`Unknown wp-light command: ${command}\n`);
  process.exitCode = 1;
} else {
  commands[command]().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}
