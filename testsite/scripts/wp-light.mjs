#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import matter from 'gray-matter';
import TurndownService from 'turndown';
import { build } from './compile.mjs';

const ROOT = process.cwd();
const command = process.argv[2] ?? 'build';
const PLAYGROUND_URL = 'http://127.0.0.1:9400';
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

async function buildGeneratedSite() {
  await build();
  await run('npx', ['vite', 'build', '--config', './admin-app/vite.config.mjs']);
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

async function startPlaygroundServer() {
  if (await isUrlReachable(PLAYGROUND_URL)) {
    process.stdout.write(`Playground already available at ${PLAYGROUND_URL}\n`);
    return;
  }

  const pluginMount = `${path.join(
    ROOT,
    'generated',
    'wp-content',
    'plugins',
    'portfolio-light-app'
  )}:/wordpress/wp-content/plugins/portfolio-light-app`;
  const themeMount = `${path.join(
    ROOT,
    'generated',
    'wp-content',
    'themes',
    'portfolio-light-theme'
  )}:/wordpress/wp-content/themes/portfolio-light-theme`;

  const child = spawn(
    'npx',
    [
      '@wp-playground/cli@latest',
      'server',
      '--port',
      '9400',
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
  await waitForUrl(PLAYGROUND_URL);
  process.stdout.write(`Playground started at ${PLAYGROUND_URL}\n`);
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

  const html = await fetch(`${siteUrl}/app/`, {
    headers: {
      Cookie: cookies,
    },
  }).then((response) => response.text());

  const nonceMatch = html.match(/"nonce":"([^"]+)"/);
  if (!nonceMatch) {
    throw new Error('Unable to find the REST nonce in the local admin shell.');
  }

  return {
    cookies,
    nonce: nonceMatch[1],
  };
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

  return {
    collections,
    singletons: bootstrap.singletonData ?? {},
  };
}

async function buildCommand() {
  await buildGeneratedSite();
}

async function applyCommand() {
  await buildGeneratedSite();

  if (await canUseDocker()) {
    await run('npx', ['wp-env', 'start']);
    await run('npx', ['wp-env', 'run', 'cli', 'wp', 'eval', 'portfolio_light_seed_site();']);
    return;
  }

  await startPlaygroundServer();
  await runLocalSeed(PLAYGROUND_URL);
}

async function devCommand() {
  await applyCommand();
  process.stdout.write(
    'Development environment started. Re-run `npx wp-light build` after edits.\n'
  );
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
    if (!(await isUrlReachable(PLAYGROUND_URL))) {
      await startPlaygroundServer();
    }

    const bootstrap = await fetchBootstrapFromLocalSite(PLAYGROUND_URL);
    payload = await normalizePullPayloadFromBootstrap(schema, bootstrap);
  }

  await writePulledCollections(schema, payload);
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
