#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import matter from 'gray-matter';
import TurndownService from 'turndown';
import { build } from '../compile.mjs';

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});

function parseBlockMarkup(source) {
  const blocks = [];
  const re = /<!--\s+wp:([a-z0-9_-]+(?:\/[a-z0-9_-]+)?)\s*({[\s\S]*?})?\s*(\/)?-->/g;
  let match;

  while ((match = re.exec(source)) !== null) {
    const [, name, rawAttrs, selfClosing] = match;
    const attrs = rawAttrs ? JSON.parse(rawAttrs) : {};

    if (selfClosing) {
      blocks.push({ name, attrs, inner: '' });
      continue;
    }

    const closeTag = new RegExp(`<!--\\s+/wp:${name.replace(/[/-]/g, (c) => `\\${c}`)}\\s+-->`, 'g');
    closeTag.lastIndex = re.lastIndex;
    const closeMatch = closeTag.exec(source);
    if (!closeMatch) continue;

    blocks.push({ name, attrs, inner: source.slice(re.lastIndex, closeMatch.index).trim() });
    re.lastIndex = closeTag.lastIndex;
  }

  return blocks;
}

function blockToMarkdown({ name, attrs, inner }) {
  if (name === 'html') return inner;
  if (name === 'separator') return '---';
  if (name === 'heading') {
    const level = attrs.level || 2;
    const stripped = inner.replace(/^<h\d[^>]*>/, '').replace(/<\/h\d>\s*$/, '');
    const text = turndown.turndown(stripped).trim();
    return `${'#'.repeat(level)} ${text}${attrs.anchor ? ` {#${attrs.anchor}}` : ''}`;
  }
  if (name === 'code') {
    const langMatch = (attrs.className || '').match(/language-([a-zA-Z0-9_-]+)/);
    const lang = langMatch ? langMatch[1] : '';
    const codeText = inner.replace(/^<pre[^>]*><code[^>]*>/i, '').replace(/<\/code><\/pre>$/i, '');
    const decoded = codeText.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
    return `\`\`\`${lang}\n${decoded}\n\`\`\``;
  }
  return turndown.turndown(inner).trim();
}

function blockMarkupToMarkdown(source) {
  const raw = String(source ?? '').trim();
  if (!raw) return '';
  if (!raw.includes('<!-- wp:')) return turndown.turndown(raw).trim();
  return parseBlockMarkup(raw).map(blockToMarkdown).filter(Boolean).join('\n\n');
}

function normalize(text) {
  return String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function collectSourceMarkdown(siteRoot) {
  const contentRoot = path.join(siteRoot, 'content');
  const results = [];
  const walkDirs = async (dir) => {
    let entries = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'singletons') continue;
        await walkDirs(full);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const parsed = matter(await readFile(full, 'utf8'));
        const key = parsed.data.sourceId || `${parsed.data.model ?? 'page'}.${parsed.data.slug ?? path.basename(entry.name, '.md')}`;
        results.push({ key, file: full, markdown: parsed.content });
      }
    }
  };
  await walkDirs(contentRoot);
  return results;
}

async function main() {
  const siteRoot = path.resolve(process.argv[2] || process.cwd());
  process.stdout.write(`Round-trip check for ${siteRoot}\n`);

  await build(siteRoot);

  const schema = JSON.parse(
    await readFile(path.join(siteRoot, 'generated', 'site-schema.json'), 'utf8')
  );

  const compiledByKey = new Map();
  for (const [collectionId, items] of Object.entries(schema.content?.collections ?? {})) {
    for (const item of items) {
      const key = item.sourceId || `${collectionId}.${item.slug || item.routeId}`;
      compiledByKey.set(key, item);
    }
  }

  const sources = await collectSourceMarkdown(siteRoot);
  let diffs = 0;

  for (const source of sources) {
    const compiled = compiledByKey.get(source.key);
    if (!compiled) {
      process.stdout.write(`  [skip] ${source.key} not in compiled output\n`);
      continue;
    }
    const roundTripped = blockMarkupToMarkdown(compiled.body || '');
    const a = normalize(source.markdown);
    const b = normalize(roundTripped);
    if (a !== b) {
      diffs += 1;
      process.stdout.write(`  [diff] ${source.key}\n`);
      process.stdout.write(`    --- source\n    +++ round-trip\n`);
      const aLines = a.split('\n');
      const bLines = b.split('\n');
      const max = Math.max(aLines.length, bLines.length);
      for (let i = 0; i < max; i += 1) {
        if (aLines[i] !== bLines[i]) {
          process.stdout.write(`    -${aLines[i] ?? ''}\n`);
          process.stdout.write(`    +${bLines[i] ?? ''}\n`);
        }
      }
    }
  }

  if (diffs === 0) {
    process.stdout.write(`OK: ${sources.length} entries round-trip cleanly.\n`);
  } else {
    process.stdout.write(`${diffs} entries have round-trip diffs out of ${sources.length}.\n`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  process.stderr.write(`${err.stack || err.message}\n`);
  process.exitCode = 1;
});
