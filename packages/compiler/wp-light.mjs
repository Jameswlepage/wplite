#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, watch, writeFileSync } from 'node:fs';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import matter from 'gray-matter';
import TurndownService from 'turndown';
import { build, resolveRoot } from './compile.mjs';

function parseCliArgs(argv) {
  const flags = {};
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];

    if (next && !next.startsWith('--')) {
      flags[key] = next;
      index += 1;
      continue;
    }

    flags[key] = true;
  }

  return {
    flags,
    positional,
    command: positional[0] ?? 'build',
  };
}

const CLI = parseCliArgs(process.argv.slice(2));
const ROOT = resolveRoot();
const command = CLI.command;
const OUTPUT_JSON = CLI.flags.json === true;
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

function note(message) {
  const output = OUTPUT_JSON ? process.stderr : process.stdout;
  output.write(`${message}\n`);
}

function errorOut(message) {
  process.stderr.write(`${message}\n`);
}

function stringFlag(name, fallback = null) {
  const value = CLI.flags[name];
  return typeof value === 'string' ? value : fallback;
}

function boolFlag(name) {
  return CLI.flags[name] === true;
}

function emitResult(payload) {
  if (OUTPUT_JSON) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  if (payload?.summary) {
    note(payload.summary);
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function toKebabCase(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function parseBlockMarkup(source) {
  const blocks = [];
  const re = /<!--\s+wp:([a-z0-9_-]+(?:\/[a-z0-9_-]+)?)\s*({[\s\S]*?})?\s*(\/)?-->/g;
  let match;
  let lastIndex = 0;

  while ((match = re.exec(source)) !== null) {
    const [full, name, rawAttrs, selfClosing] = match;
    const attrs = rawAttrs ? JSON.parse(rawAttrs) : {};

    if (selfClosing) {
      blocks.push({ name, attrs, inner: '' });
      lastIndex = re.lastIndex;
      continue;
    }

    const closeTag = new RegExp(`<!--\\s+/wp:${name.replace(/[/-]/g, (c) => `\\${c}`)}\\s+-->`, 'g');
    closeTag.lastIndex = re.lastIndex;
    const closeMatch = closeTag.exec(source);
    if (!closeMatch) {
      lastIndex = re.lastIndex;
      continue;
    }

    const inner = source.slice(re.lastIndex, closeMatch.index).trim();
    blocks.push({ name, attrs, inner });
    re.lastIndex = closeTag.lastIndex;
    lastIndex = re.lastIndex;
  }

  return blocks;
}

function blockToMarkdown(block) {
  const { name, attrs, inner } = block;

  if (name === 'html') {
    return inner;
  }

  if (name === 'separator') {
    return '---';
  }

  if (name === 'heading') {
    const level = attrs.level || 2;
    const stripped = inner.replace(/^<h\d[^>]*>/, '').replace(/<\/h\d>\s*$/, '');
    const text = turndown.turndown(stripped).trim();
    const anchor = attrs.anchor ? ` {#${attrs.anchor}}` : '';
    return `${'#'.repeat(level)} ${text}${anchor}`;
  }

  if (name === 'code') {
    const className = attrs.className || '';
    const langMatch = className.match(/language-([a-zA-Z0-9_-]+)/);
    const lang = langMatch ? langMatch[1] : '';
    const codeText = inner.replace(/^<pre[^>]*><code[^>]*>/i, '').replace(/<\/code><\/pre>$/i, '');
    const decoded = codeText
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"');
    return `\`\`\`${lang}\n${decoded}\n\`\`\``;
  }

  return turndown.turndown(inner).trim();
}

function blockMarkupToMarkdown(source) {
  const raw = String(source ?? '').trim();
  if (!raw) return '';

  if (!raw.includes('<!-- wp:')) {
    return turndown.turndown(raw).trim();
  }

  const blocks = parseBlockMarkup(raw);
  return blocks
    .map(blockToMarkdown)
    .filter((text) => text.length > 0)
    .join('\n\n');
}

function run(commandName, args, options = {}) {
  return new Promise((resolve, reject) => {
    const shouldPipe = OUTPUT_JSON && options.stdio === undefined;
    const childStdio = shouldPipe ? ['ignore', 'pipe', 'pipe'] : 'inherit';
    const child = spawn(commandName, args, {
      cwd: ROOT,
      stdio: childStdio,
      shell: false,
      ...options,
    });

    if (shouldPipe) {
      child.stdout?.on('data', (chunk) => {
        process.stderr.write(chunk);
      });
      child.stderr?.on('data', (chunk) => {
        process.stderr.write(chunk);
      });
    }

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

function adminRuntimeCacheRoot() {
  const base =
    process.env.XDG_CACHE_HOME
      ? path.join(process.env.XDG_CACHE_HOME, 'wplite')
      : path.join(os.homedir(), '.cache', 'wplite');

  return path.join(base, 'admin-runtime');
}

function resolveAdminRuntimeCacheDir(runtimeHash) {
  return path.join(adminRuntimeCacheRoot(), runtimeHash);
}

function resolveAdminRuntimeMarker(dirPath) {
  return path.join(dirPath, '.runtime-meta.json');
}

async function readAdminRuntimeMarker(dirPath) {
  try {
    return JSON.parse(await readFile(resolveAdminRuntimeMarker(dirPath), 'utf8'));
  } catch {
    return null;
  }
}

async function writeAdminRuntimeMarker(dirPath, payload) {
  await ensureDir(dirPath);
  await writeFile(resolveAdminRuntimeMarker(dirPath), `${JSON.stringify(payload, null, 2)}\n`);
}

function hasRuntimeBundle(dirPath) {
  return (
    existsSync(path.join(dirPath, 'admin-app.js')) &&
    existsSync(path.join(dirPath, 'admin-app.css'))
  );
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

async function ensureAdminRuntimeBundle(buildResult) {
  const runtimeHash = buildResult.adminRuntimeHash;
  const runtimeCacheDir = resolveAdminRuntimeCacheDir(runtimeHash);
  const adminOutDir = path.join(buildResult.pluginRoot, 'build');
  let built = false;

  if (buildResult.adminBundleDirty || !hasRuntimeBundle(runtimeCacheDir)) {
    await rm(runtimeCacheDir, { recursive: true, force: true });
    await ensureDir(runtimeCacheDir);

    const viteConfig = path.join(compilerDir(), 'admin-app/vite.config.mjs');
    await run('npx', ['vite', 'build', '--config', viteConfig], {
      env: { ...process.env, WPLITE_ADMIN_OUT_DIR: runtimeCacheDir },
    });

    await writeAdminRuntimeMarker(runtimeCacheDir, {
      hash: runtimeHash,
      builtAt: new Date().toISOString(),
    });
    built = true;
  }

  const currentMarker = await readAdminRuntimeMarker(adminOutDir);
  const syncedHash = currentMarker?.hash ?? null;
  const needsSync = syncedHash !== runtimeHash || !hasRuntimeBundle(adminOutDir);

  if (needsSync) {
    await rm(adminOutDir, { recursive: true, force: true });
    await cp(runtimeCacheDir, adminOutDir, { recursive: true });
  }

  return {
    built,
    synced: needsSync,
    runtimeHash,
    cacheDir: runtimeCacheDir,
    adminOutDir,
  };
}

async function buildGeneratedSite() {
  const startedAt = Date.now();
  const result = await build(ROOT);
  const incremental = result.incremental;
  const runtime = await ensureAdminRuntimeBundle(result);

  if (incremental) {
    const changed = incremental.skipped
      ? 'nothing'
      : Object.entries(incremental).filter(([, v]) => v).map(([k]) => k).join(',') || 'nothing';
    note(`wplite: incremental build (${changed}) in ${Date.now() - startedAt}ms`);
  } else {
    note(`wplite: full build in ${Date.now() - startedAt}ms`);
  }

  return {
    ...result,
    runtime,
    durationMs: Date.now() - startedAt,
  };
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
      note(`Multiple matching Playground sites found. Using ${chosenUrl} and ignoring ${duplicates.join(', ')}`);
    }

    await writePlaygroundState({
      url: chosenUrl,
      pluginSlug: site?.plugin?.slug ?? null,
      updatedAt: new Date().toISOString(),
    });
    note(`Playground already available at ${chosenUrl}`);
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
  note(`Playground started at ${siteUrl}`);
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

  return blockMarkupToMarkdown(html);
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

function resolvePullCredentials(siteUrl) {
  const host = (() => {
    try { return new URL(siteUrl).hostname; } catch { return ''; }
  })();
  const isLocalhost = host === '127.0.0.1' || host === 'localhost';

  const args = process.argv.slice(2);
  let flagUser = null;
  let flagPass = null;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--user' && args[i + 1]) flagUser = args[i + 1];
    if (args[i] === '--pass' && args[i + 1]) flagPass = args[i + 1];
  }

  const user = flagUser ?? process.env.WPLITE_USER ?? (isLocalhost ? 'admin' : null);
  const pass = flagPass ?? process.env.WPLITE_PASS ?? (isLocalhost ? 'password' : null);

  if (!user || !pass) {
    throw new Error(
      `Pull target ${siteUrl} is not localhost; credentials required. Pass --user/--pass or set WPLITE_USER/WPLITE_PASS.`
    );
  }

  return { user, pass };
}

async function createLocalAdminSession(siteUrl) {
  const { user, pass } = resolvePullCredentials(siteUrl);
  const loginResponse = await fetch(`${siteUrl}/wp-login.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      log: user,
      pwd: pass,
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
  const buildInfo = await buildGeneratedSite();
  return {
    summary: `Built artifacts in ${buildInfo.durationMs}ms.`,
    data: buildInfo,
  };
}

async function syncRunningSite({ useDocker } = {}) {
  const buildResult = await buildGeneratedSite();
  const site = await loadSiteConfig();
  const shouldSeed = buildResult.seedRequired;

  if (useDocker ?? (await canUseDocker())) {
    await run('npx', ['wp-env', 'start']);
    if (shouldSeed) {
      await run('npx', ['wp-env', 'run', 'cli', 'wp', 'eval', 'portfolio_light_seed_site();']);
    }
    return {
      siteUrl: null,
      mode: 'docker',
      buildResult,
      seeded: shouldSeed,
    };
  }

  const siteUrl = await startPlaygroundServer(site);
  if (shouldSeed) {
    await runLocalSeed(siteUrl);
  }
  return {
    siteUrl,
    mode: 'playground',
    buildResult,
    seeded: shouldSeed,
  };
}

async function applyCommand() {
  const { siteUrl, mode, buildResult, seeded } = await syncRunningSite();
  if (mode === 'playground' && siteUrl) {
    note(`Applied site to ${siteUrl}`);
  }
  return {
    summary: mode === 'playground' && siteUrl
      ? `Applied ${seeded ? 'and reseeded' : 'without reseeding'} ${siteUrl}`
      : `Applied ${seeded ? 'and reseeded' : 'without reseeding'} via Docker wp-env.`,
    data: {
      mode,
      siteUrl,
      seeded,
      changes: buildResult.changes,
      runtime: buildResult.runtime,
    },
  };
}

async function seedCommand() {
  if (await canUseDocker()) {
    await run('npx', ['wp-env', 'start']);
    await run('npx', ['wp-env', 'run', 'cli', 'wp', 'eval', 'portfolio_light_seed_site();']);
    return {
      summary: 'Seeded content via Docker wp-env.',
      data: { mode: 'docker', siteUrl: null },
    };
  }

  const site = await loadSiteConfig();
  const siteUrl = await startPlaygroundServer(site);
  await runLocalSeed(siteUrl);
  return {
    summary: `Seeded content at ${siteUrl}`,
    data: { mode: 'playground', siteUrl },
  };
}

function watchPath(target, onChange) {
  const absoluteTarget = path.join(ROOT, target);
  if (!existsSync(absoluteTarget)) {
    note(`Skipping watch (not present): ${target}`);
    return null;
  }
  const watcher = watch(
    absoluteTarget,
    { recursive: path.extname(target) === '' },
    (eventType, fileName) => {
      const changedPath = fileName ? path.join(target, String(fileName)) : target;
      onChange({ eventType, changedPath });
    }
  );

  watcher.on('error', (error) => {
    errorOut(`Watcher error for ${target}: ${error.message}`);
  });

  return watcher;
}

async function devCommand() {
  const useDocker = await canUseDocker();
  const initialSync = await syncRunningSite({ useDocker });
  await bumpDevState();

  note('Development environment started with live rebuilds.');
  if (initialSync.mode === 'playground' && initialSync.siteUrl) {
    note(`Local site: ${initialSync.siteUrl}`);
  }
  note(`Watching ${WATCH_TARGETS.join(', ')} for changes. Press Ctrl+C to stop.`);

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
  })).filter(Boolean);

  async function flushChanges() {
    if (syncing) {
      queued = true;
      return;
    }

    syncing = true;
    const reasons = [...changedPaths];
    changedPaths.clear();
    note(`Detected changes: ${reasons.join(', ')}`);

    try {
      const syncResult = await syncRunningSite({ useDocker });
      await bumpDevState();
      if (syncResult.mode === 'playground' && syncResult.siteUrl) {
        note(`Updated ${syncResult.siteUrl}`);
      }
      const changeList = Object.entries(syncResult.buildResult.changes ?? {})
        .filter(([, value]) => value)
        .map(([key]) => key);
      const activity = [];

      if (syncResult.buildResult.runtime?.built) {
        activity.push('rebuilt shared admin runtime');
      } else if (syncResult.buildResult.runtime?.synced) {
        activity.push('reused cached admin runtime');
      }

      if (syncResult.seeded) {
        activity.push('reseeded content');
      } else {
        activity.push('skipped reseed');
      }

      note(
        `${activity.join(', ')} and triggered browser refresh${changeList.length ? ` (${changeList.join(', ')})` : ''}.`
      );
    } catch (error) {
      errorOut(`Watch rebuild failed: ${error.stack || error.message}`);
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

  return {
    summary: 'Development session stopped.',
    data: { watched: WATCH_TARGETS },
  };
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

  note('Pulled WordPress content into markdown and singleton data files.');
  return {
    summary: 'Pulled WordPress content into source files.',
    data: {
      models: Object.keys(payload.collections ?? {}).length,
      pages: (payload.pages ?? []).length,
      singletons: Object.keys(payload.singletons ?? {}).length,
    },
  };
}

async function ejectCommand() {
  const filePath = path.join(ROOT, '.wp-light.ejected');
  await writeFile(filePath, JSON.stringify({ ejectedAt: new Date().toISOString() }, null, 2));
  note(`Recorded eject marker at ${filePath}`);
  return {
    summary: `Recorded eject marker at ${filePath}`,
    data: { filePath },
  };
}

async function writeJsonFile(filePath, value, { force = false } = {}) {
  if (!force && existsSync(filePath)) {
    throw new Error(`Refusing to overwrite existing file: ${path.relative(ROOT, filePath)}`);
  }
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeTextFile(filePath, value, { force = false } = {}) {
  if (!force && existsSync(filePath)) {
    throw new Error(`Refusing to overwrite existing file: ${path.relative(ROOT, filePath)}`);
  }
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, value.endsWith('\n') ? value : `${value}\n`);
}

async function loadInitBrief() {
  const briefPath = stringFlag('brief');
  let brief = {};

  if (briefPath) {
    const source = await readFile(path.resolve(ROOT, briefPath), 'utf8');
    brief = JSON.parse(source);
  }

  if (stringFlag('name')) brief.name = stringFlag('name');
  if (stringFlag('title')) brief.title = stringFlag('title');
  if (stringFlag('tagline')) brief.tagline = stringFlag('tagline');

  const fallbackName = toKebabCase(path.basename(ROOT));
  const name = toKebabCase(brief.name || brief.siteId || fallbackName || 'new-site');
  const title = brief.title || name.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
  const tagline = brief.tagline || 'Built with wplite.';
  const pageSync = brief.pageSync === true;
  const blogEnabled = brief.blogEnabled !== false;

  const routes = asArray(brief.routes).length > 0
    ? asArray(brief.routes)
    : [
        { id: 'home', type: 'page', slug: '', title: 'Home', template: 'front-page' },
        { id: 'about', type: 'page', slug: 'about', title: 'About', template: 'page' },
        { id: 'contact', type: 'page', slug: 'contact', title: 'Contact', template: 'page' },
        ...(blogEnabled ? [{ id: 'journal', type: 'page', slug: 'journal', title: 'Journal', template: 'index' }] : []),
      ];

  const collections = asArray(brief.collections).length > 0
    ? asArray(brief.collections)
    : [
        {
          id: 'project',
          label: 'Projects',
          postType: 'project',
          archiveSlug: 'work',
          supports: ['title', 'editor', 'excerpt', 'thumbnail', 'revisions'],
          fields: {
            featured: { type: 'boolean', label: 'Featured' },
          },
        },
      ];

  const singletons = asArray(brief.singletons).length > 0
    ? asArray(brief.singletons)
    : [
        {
          id: 'profile',
          label: 'Profile',
          fields: { short_bio: { type: 'richtext', label: 'Short Bio' } },
          seed: { short_bio: 'Add your studio profile here.' },
        },
        {
          id: 'contact',
          label: 'Contact',
          fields: {
            email: { type: 'email', label: 'Email' },
            phone: { type: 'text', label: 'Phone' },
          },
          seed: { email: 'hello@example.com', phone: '+1 555-0100' },
        },
        {
          id: 'seo',
          label: 'SEO',
          fields: {
            title_separator: { type: 'text', label: 'Title Separator' },
          },
          seed: { title_separator: '—' },
        },
      ];

  return {
    name,
    title,
    tagline,
    pageSync,
    blogEnabled,
    routes,
    collections,
    singletons,
    themeSlug: toKebabCase(brief.themeSlug || `${name}-theme`) || `${name}-theme`,
    pluginSlug: toKebabCase(brief.pluginSlug || `${name}-app`) || `${name}-app`,
  };
}

function defaultSeedMarkdown({ modelId, title, slug }) {
  const frontMatter = {
    model: modelId,
    sourceId: `${modelId}.${slug}`,
    slug,
    title,
    status: 'publish',
  };

  return matter.stringify(`## ${title}\n\nAdd your content here.\n`, frontMatter);
}

function agentContractMarkdown(brief) {
  return `# AGENTS

This site is authored with \`wplite\`. Treat files as source of truth and WordPress as runtime storage/rendering.

## Canonical Workflow
1. Update files in \`app/\`, \`content/\`, \`theme/\`, \`blocks/\`, and optional \`admin/\`.
2. Run \`npm run apply\` (or \`wp-light apply\`) to compile, activate, and seed.
3. Run \`wp-light verify --json\` and fail fast on \`errors > 0\`.
4. If content was edited in WordPress, run \`wp-light pull\` before committing.

## Contract Rules
- Keep public frontend as native block theme files under \`theme/\`.
- Keep structured schema in \`app/\` and editable copy/content in \`content/\`.
- Do not duplicate modeled content literals in theme templates/patterns when data already exists in singletons/models.
- Use custom blocks in \`blocks/\` only when core blocks cannot express required behavior.
- Keep admin experience compiler-owned; avoid site-local admin runtime hacks.

## Site Brief
- Site id: \`${brief.name}\`
- Title: ${brief.title}
- Tagline: ${brief.tagline}
- Plugin slug: \`${brief.pluginSlug}\`
- Theme slug: \`${brief.themeSlug}\`
- Page sync: \`${brief.pageSync}\`
- Blog enabled: \`${brief.blogEnabled}\`
`;
}

async function initCommand() {
  const force = boolFlag('force');
  const siteConfigPath = path.join(ROOT, 'app', 'site.json');

  if (existsSync(siteConfigPath) && !force) {
    throw new Error('Source tree already initialized. Use --force to overwrite.');
  }

  const brief = await loadInitBrief();
  const routeIds = new Set(brief.routes.map((route) => String(route.id)));
  const postsPage = routeIds.has('journal') ? 'journal' : null;

  await writeJsonFile(siteConfigPath, {
    id: brief.name,
    title: brief.title,
    tagline: brief.tagline,
    mode: 'light',
    content: {
      mode: 'files',
      format: 'markdown',
      pull: true,
      push: true,
      databaseFirst: false,
      collections: {
        ...Object.fromEntries(brief.collections.map((collection) => [collection.id, { sync: true }])),
        post: { sync: true },
        page: { sync: brief.pageSync },
      },
    },
    frontPage: 'home',
    ...(postsPage ? { postsPage } : {}),
    theme: { slug: brief.themeSlug, sourceDir: 'theme' },
    plugin: { slug: brief.pluginSlug },
  }, { force });

  for (const route of brief.routes) {
    await writeJsonFile(path.join(ROOT, 'app', 'routes', `${route.id}.json`), {
      id: route.id,
      type: route.type ?? 'page',
      slug: route.slug ?? '',
      title: route.title ?? route.id,
      template: route.template ?? 'page',
      seed: {
        createPageShell: true,
        status: 'publish',
        content: '',
      },
    }, { force });
  }

  await writeJsonFile(path.join(ROOT, 'app', 'menus', 'primary.json'), {
    id: 'primary',
    label: 'Primary',
    items: brief.routes
      .filter((route) => route.id !== 'journal')
      .map((route) => ({ kind: 'route', route: route.id, label: route.title })),
  }, { force });

  await writeJsonFile(path.join(ROOT, 'app', 'menus', 'footer.json'), {
    id: 'footer',
    label: 'Footer',
    items: brief.routes.map((route) => ({ kind: 'route', route: route.id, label: route.title })),
  }, { force });

  for (const collection of brief.collections) {
    await writeJsonFile(path.join(ROOT, 'app', 'models', `${collection.id}.json`), {
      id: collection.id,
      label: collection.label ?? collection.id,
      icon: collection.icon ?? 'Document',
      type: 'collection',
      postType: collection.postType ?? collection.id,
      archiveSlug: collection.archiveSlug ?? `${collection.id}s`,
      public: collection.public !== false,
      supports: collection.supports ?? ['title', 'editor', 'excerpt', 'thumbnail', 'revisions'],
      taxonomies: collection.taxonomies ?? [],
      fields: collection.fields ?? {},
    }, { force });
  }

  for (const singleton of brief.singletons) {
    await writeJsonFile(path.join(ROOT, 'app', 'singletons', `${singleton.id}.json`), {
      id: singleton.id,
      label: singleton.label ?? singleton.id,
      icon: singleton.icon ?? 'Settings',
      type: 'singleton',
      storage: 'option',
      fields: singleton.fields ?? {},
    }, { force });

    await writeJsonFile(path.join(ROOT, 'content', 'singletons', `${singleton.id}.json`), {
      singleton: singleton.id,
      data: singleton.seed ?? {},
    }, { force });
  }

  const firstCollection = brief.collections[0];
  const sampleSlug = firstCollection ? `${firstCollection.id}-example` : 'post-example';
  if (firstCollection) {
    await writeTextFile(
      path.join(ROOT, 'content', `${pluralize(firstCollection.id)}`, `${sampleSlug}.md`),
      defaultSeedMarkdown({
        modelId: firstCollection.id,
        slug: sampleSlug,
        title: `${firstCollection.label ?? firstCollection.id} Example`,
      }),
      { force }
    );
  }

  if (brief.pageSync) {
    await writeTextFile(
      path.join(ROOT, 'content', 'pages', 'home.md'),
      matter.stringify('Welcome to your new wplite site.\n', {
        model: 'page',
        routeId: 'home',
        sourceId: 'page.home',
      }),
      { force }
    );
  }

  await writeTextFile(path.join(ROOT, 'theme', 'theme.json'), JSON.stringify({
    $schema: 'https://schemas.wp.org/trunk/theme.json',
    version: 3,
    settings: {
      color: {
        palette: [
          { slug: 'base', name: 'Base', color: '#f4f1ea' },
          { slug: 'ink', name: 'Ink', color: '#191716' },
          { slug: 'accent', name: 'Accent', color: '#6b4f3a' },
        ],
      },
      typography: {
        fluid: true,
        fontFamilies: [
          { slug: 'serif', name: 'Serif', fontFamily: '\"Iowan Old Style\", \"Times New Roman\", serif' },
          { slug: 'sans', name: 'Sans', fontFamily: '\"Avenir Next\", \"Helvetica Neue\", sans-serif' },
        ],
      },
    },
    styles: {
      color: {
        background: 'var(--wp--preset--color--base)',
        text: 'var(--wp--preset--color--ink)',
      },
      typography: {
        fontFamily: 'var(--wp--preset--font-family--sans)',
      },
    },
  }, null, 2), { force });

  await writeTextFile(path.join(ROOT, 'theme', 'style.css'), `/*
Theme Name: ${brief.title}
Description: Generated by wp-light init.
Version: 0.1.0
*/

:root { --site-max-width: 1120px; }
.is-layout-constrained > :where(:not(.alignleft):not(.alignright):not(.alignfull)) {
  max-width: var(--site-max-width);
}
`, { force });

  await writeTextFile(path.join(ROOT, 'theme', 'parts', 'header.html'), `<!-- wp:group {"style":{"spacing":{"padding":{"top":"24px","bottom":"24px"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group" style="padding-top:24px;padding-bottom:24px">
<!-- wp:site-title {"level":0} /-->
<!-- wp:navigation {"overlayMenu":"never","layout":{"type":"flex","justifyContent":"right"}} /-->
</div>
<!-- /wp:group -->`, { force });

  await writeTextFile(path.join(ROOT, 'theme', 'parts', 'footer.html'), `<!-- wp:group {"style":{"spacing":{"padding":{"top":"32px","bottom":"32px"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group" style="padding-top:32px;padding-bottom:32px">
<!-- wp:paragraph -->
<p>© ${new Date().getFullYear()} ${brief.title}</p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:group -->`, { force });

  await writeTextFile(path.join(ROOT, 'theme', 'patterns', 'hero.html'), `<!--
Title: Hero
Slug: ${brief.themeSlug}/hero
Inserter: no
-->
<!-- wp:group {"style":{"spacing":{"padding":{"top":"80px","bottom":"64px"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group" style="padding-top:80px;padding-bottom:64px">
<!-- wp:heading {"level":1,"fontSize":"x-large"} -->
<h1 class="wp-block-heading has-x-large-font-size">${brief.title}</h1>
<!-- /wp:heading -->
<!-- wp:paragraph {"fontSize":"large"} -->
<p class="has-large-font-size">${brief.tagline}</p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:group -->`, { force });

  await writeTextFile(path.join(ROOT, 'theme', 'templates', 'front-page.html'), `<!-- wp:template-part {"slug":"header","tagName":"header"} /-->
<!-- wp:pattern {"slug":"${brief.themeSlug}/hero"} /-->
<!-- wp:template-part {"slug":"footer","tagName":"footer"} /-->`, { force });

  await writeTextFile(path.join(ROOT, 'theme', 'templates', 'page.html'), `<!-- wp:template-part {"slug":"header","tagName":"header"} /-->
<!-- wp:group {"layout":{"type":"constrained"}} --><div class="wp-block-group">
<!-- wp:post-title {"level":1} /-->
<!-- wp:post-content /-->
</div><!-- /wp:group -->
<!-- wp:template-part {"slug":"footer","tagName":"footer"} /-->`, { force });

  await writeTextFile(path.join(ROOT, 'theme', 'templates', 'index.html'), `<!-- wp:template-part {"slug":"header","tagName":"header"} /-->
<!-- wp:group {"layout":{"type":"constrained"}} --><div class="wp-block-group">
<!-- wp:query {"query":{"perPage":10,"postType":"post"}} -->
<div class="wp-block-query">
<!-- wp:post-template -->
<!-- wp:post-title {"isLink":true} /-->
<!-- wp:post-excerpt /-->
<!-- /wp:post-template -->
</div>
<!-- /wp:query -->
</div><!-- /wp:group -->
<!-- wp:template-part {"slug":"footer","tagName":"footer"} /-->`, { force });

  await writeTextFile(path.join(ROOT, 'AGENTS.md'), agentContractMarkdown(brief), { force });

  return {
    summary: `Initialized ${brief.name} in ${ROOT}`,
    data: {
      siteId: brief.name,
      themeSlug: brief.themeSlug,
      pluginSlug: brief.pluginSlug,
      routeCount: brief.routes.length,
      collectionCount: brief.collections.length,
      singletonCount: brief.singletons.length,
      files: [
        'AGENTS.md',
        'app/site.json',
        'app/models/*.json',
        'app/routes/*.json',
        'app/singletons/*.json',
        'app/menus/*.json',
        'content/**/*',
        'theme/**/*',
      ],
    },
  };
}

async function listFilesRecursive(dirPath, predicate = () => true) {
  const results = [];
  const stack = [dirPath];

  while (stack.length > 0) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolute);
      } else if (entry.isFile() && predicate(absolute)) {
        results.push(absolute);
      }
    }
  }

  return results;
}

function pushIssue(issues, issue) {
  issues.push({
    severity: issue.severity ?? 'error',
    code: issue.code ?? 'UNKNOWN',
    message: issue.message,
    ...(issue.path ? { path: issue.path } : {}),
  });
}

async function verifyCommand() {
  const issues = [];
  const requiredDirs = ['app', 'content', 'theme', 'app/routes', 'app/menus', 'app/singletons'];
  const requiredFiles = ['app/site.json'];

  for (const dir of requiredDirs) {
    if (!existsSync(path.join(ROOT, dir))) {
      pushIssue(issues, { code: 'MISSING_DIR', message: `Missing required directory: ${dir}`, path: dir });
    }
  }

  for (const filePath of requiredFiles) {
    if (!existsSync(path.join(ROOT, filePath))) {
      pushIssue(issues, { code: 'MISSING_FILE', message: `Missing required file: ${filePath}`, path: filePath });
    }
  }

  let site = {};
  try {
    site = await loadSiteConfig();
  } catch (err) {
    pushIssue(issues, { code: 'INVALID_SITE_JSON', message: `Unable to parse app/site.json: ${err.message}`, path: 'app/site.json' });
  }

  if (!site?.id) {
    pushIssue(issues, { code: 'SITE_ID_REQUIRED', message: 'app/site.json must define `id`.', path: 'app/site.json' });
  }
  if (!site?.title) {
    pushIssue(issues, { code: 'SITE_TITLE_REQUIRED', message: 'app/site.json must define `title`.', path: 'app/site.json' });
  }
  if (!site?.theme?.slug) {
    pushIssue(issues, { code: 'THEME_SLUG_REQUIRED', message: 'app/site.json must define `theme.slug`.', path: 'app/site.json' });
  }
  if (!site?.plugin?.slug) {
    pushIssue(issues, { code: 'PLUGIN_SLUG_REQUIRED', message: 'app/site.json must define `plugin.slug`.', path: 'app/site.json' });
  }

  const routeFiles = await listFilesRecursive(path.join(ROOT, 'app', 'routes'), (filePath) => filePath.endsWith('.json'));
  const routes = [];
  const routeIdSet = new Set();
  const slugSet = new Set();
  for (const filePath of routeFiles) {
    const relative = path.relative(ROOT, filePath);
    try {
      const route = JSON.parse(await readFile(filePath, 'utf8'));
      routes.push(route);
      if (!route.id) {
        pushIssue(issues, { code: 'ROUTE_ID_REQUIRED', message: `Route file missing id: ${relative}`, path: relative });
        continue;
      }
      if (routeIdSet.has(route.id)) {
        pushIssue(issues, { code: 'ROUTE_ID_DUPLICATE', message: `Duplicate route id: ${route.id}`, path: relative });
      }
      routeIdSet.add(route.id);
      const slugKey = `${route.type ?? 'page'}:${route.slug ?? ''}`;
      if (slugSet.has(slugKey)) {
        pushIssue(issues, { code: 'ROUTE_SLUG_DUPLICATE', message: `Duplicate route slug: ${route.slug ?? ''}`, path: relative });
      }
      slugSet.add(slugKey);
      if (route.template) {
        const templateFile = path.join(ROOT, 'theme', 'templates', `${route.template}.html`);
        if (!existsSync(templateFile)) {
          pushIssue(issues, { code: 'MISSING_TEMPLATE', message: `Route ${route.id} references missing template ${route.template}.html`, path: relative });
        }
      }
    } catch (err) {
      pushIssue(issues, { code: 'INVALID_ROUTE_JSON', message: `Unable to parse ${relative}: ${err.message}`, path: relative });
    }
  }

  if (site?.frontPage && !routeIdSet.has(site.frontPage)) {
    pushIssue(issues, { code: 'FRONT_PAGE_ROUTE_MISSING', message: `frontPage references missing route id: ${site.frontPage}`, path: 'app/site.json' });
  }
  if (site?.postsPage && !routeIdSet.has(site.postsPage)) {
    pushIssue(issues, { code: 'POSTS_PAGE_ROUTE_MISSING', message: `postsPage references missing route id: ${site.postsPage}`, path: 'app/site.json' });
  }

  const pageSync = site?.content?.collections?.page?.sync === true;
  const pageContentFiles = await listFilesRecursive(path.join(ROOT, 'content', 'pages'), (filePath) => filePath.endsWith('.md'));
  if (!pageSync && pageContentFiles.length > 0) {
    pushIssue(issues, {
      severity: 'warning',
      code: 'PAGE_SYNC_DISABLED_WITH_CONTENT',
      message: 'content/pages has markdown files, but app/site.json has content.collections.page.sync=false.',
      path: 'content/pages',
    });
  }

  const legacyPatterns = [
    /portfolio_light_/g,
    /PORTFOLIO_LIGHT/g,
    /\/wp-json\/portfolio\/v1/g,
    /portfolio-light/g,
  ];
  const legacySearchRoots = ['app', 'content', 'theme', 'blocks', 'admin', 'build']
    .map((segment) => path.join(ROOT, segment))
    .filter((segmentPath) => existsSync(segmentPath));
  const checkFiles = (
    await Promise.all(
      legacySearchRoots.map((segmentPath) =>
        listFilesRecursive(segmentPath, (filePath) => /\.(json|mjs|js|php|html|md|css)$/.test(filePath))
      )
    )
  ).flat();
  for (const filePath of checkFiles) {
    const source = await readFile(filePath, 'utf8');
    for (const pattern of legacyPatterns) {
      if (pattern.test(source)) {
        pushIssue(issues, {
          severity: 'error',
          code: 'LEGACY_RUNTIME_REFERENCE',
          message: `Legacy runtime marker found (${pattern}).`,
          path: path.relative(ROOT, filePath),
        });
        break;
      }
    }
  }

  const singletonValues = [];
  const singletonFiles = await listFilesRecursive(path.join(ROOT, 'content', 'singletons'), (filePath) => filePath.endsWith('.json'));
  for (const filePath of singletonFiles) {
    try {
      const parsed = JSON.parse(await readFile(filePath, 'utf8'));
      const singletonId = parsed.singleton || path.basename(filePath, '.json');
      const stack = [parsed.data ?? {}];
      while (stack.length > 0) {
        const value = stack.pop();
        if (Array.isArray(value)) {
          for (const item of value) stack.push(item);
          continue;
        }
        if (value && typeof value === 'object') {
          for (const next of Object.values(value)) stack.push(next);
          continue;
        }
        if (typeof value === 'string') {
          const normalized = value.trim();
          if (normalized.length >= 18 && /\s/.test(normalized)) {
            singletonValues.push({ singletonId, value: normalized });
          }
        }
      }
    } catch {}
  }

  const themeFiles = await listFilesRecursive(path.join(ROOT, 'theme'), (filePath) => filePath.endsWith('.html'));
  for (const { singletonId, value } of singletonValues) {
    for (const filePath of themeFiles) {
      const source = await readFile(filePath, 'utf8');
      if (source.includes(value)) {
        pushIssue(issues, {
          severity: 'warning',
          code: 'MODELED_LITERAL_DUPLICATION',
          message: `Theme literal duplicates singleton content from ${singletonId}.`,
          path: path.relative(ROOT, filePath),
        });
        break;
      }
    }
  }

  const counts = {
    errors: issues.filter((issue) => issue.severity === 'error').length,
    warnings: issues.filter((issue) => issue.severity === 'warning').length,
  };

  const result = {
    summary: counts.errors === 0
      ? `Verify passed with ${counts.warnings} warning(s).`
      : `Verify failed with ${counts.errors} error(s) and ${counts.warnings} warning(s).`,
    data: {
      counts,
      routeCount: routes.length,
      issues,
    },
  };

  if (counts.errors > 0) {
    const verifyError = new Error(result.summary);
    verifyError.details = result;
    throw verifyError;
  }

  return result;
}

const commands = {
  init: initCommand,
  build: buildCommand,
  apply: applyCommand,
  seed: seedCommand,
  dev: devCommand,
  pull: pullCommand,
  verify: verifyCommand,
  eject: ejectCommand,
};

if (!commands[command]) {
  if (OUTPUT_JSON) {
    emitResult({
      ok: false,
      command,
      error: `Unknown wp-light command: ${command}`,
    });
  } else {
    errorOut(`Unknown wp-light command: ${command}`);
  }
  process.exitCode = 1;
} else {
  commands[command]()
    .then((result) => {
      emitResult({
        ok: true,
        command,
        ...(result ?? {}),
      });
    })
    .catch((error) => {
      if (OUTPUT_JSON) {
        emitResult({
          ok: false,
          command,
          error: error.message,
          ...(error.details ?? {}),
        });
      } else {
        errorOut(`${error.stack || error.message}`);
      }
      process.exitCode = 1;
    });
}
