import React from 'react';
import {
  createBlock,
  getBlockType,
  parse,
  rawHandler,
  registerBlockType,
} from '@wordpress/blocks';
import ServerSideRender from '@wordpress/server-side-render';

/**
 * Register site-specific dynamic blocks shipped in the bootstrap payload.
 * Static blocks (with JS save functions) must be registered by their own
 * scripts; we only stub dynamic ones using ServerSideRender for preview.
 */
export function registerRuntimeBlocks(blocks = []) {
  for (const metadata of blocks) {
    if (!metadata?.name || getBlockType(metadata.name)) {
      continue;
    }

    registerBlockType(metadata.name, {
      apiVersion: metadata.apiVersion ?? 2,
      title: metadata.title,
      category: metadata.category || 'widgets',
      icon: metadata.icon,
      description: metadata.description ?? '',
      keywords: metadata.keywords ?? [],
      attributes: metadata.attributes ?? {},
      supports: metadata.supports ?? {},
      usesContext: metadata.usesContext ?? [],
      providesContext: metadata.providesContext ?? {},
      parent: metadata.parent,
      ancestor: metadata.ancestor,
      example: metadata.example,
      edit({ attributes }) {
        return (
          <div className="server-block-preview">
            <ServerSideRender block={metadata.name} attributes={attributes} />
          </div>
        );
      },
      save: () => null,
    });
  }
}

/**
 * Register any server-registered block type the client hasn't picked up yet.
 * This closes the gap that otherwise produces "classic (freeform) block"
 * recovery UI for blocks the editor doesn't know about.
 *
 * We only stub DYNAMIC blocks. Static blocks require their real `save`
 * function (round-tripped block comments must match); if a static block
 * isn't already registered client-side, stubbing would trigger block-validation
 * errors on every render.
 */
export function registerServerBlockTypes(blockTypes = []) {
  const missingStatic = [];
  for (const bt of blockTypes) {
    if (!bt?.name || getBlockType(bt.name)) {
      continue;
    }

    if (!bt.isDynamic) {
      missingStatic.push(bt.name);
      continue;
    }

    registerBlockType(bt.name, {
      apiVersion: bt.apiVersion ?? 2,
      title: bt.title || bt.name,
      category: bt.category || 'widgets',
      icon: bt.icon,
      description: bt.description ?? '',
      keywords: bt.keywords ?? [],
      attributes: bt.attributes && typeof bt.attributes === 'object' ? bt.attributes : {},
      supports: bt.supports && typeof bt.supports === 'object' ? bt.supports : {},
      usesContext: Array.isArray(bt.usesContext) ? bt.usesContext : [],
      providesContext: bt.providesContext && typeof bt.providesContext === 'object' ? bt.providesContext : {},
      parent: bt.parent ?? undefined,
      ancestor: bt.ancestor ?? undefined,
      example: bt.example ?? undefined,
      edit({ attributes }) {
        return (
          <div className="server-block-preview">
            <ServerSideRender block={bt.name} attributes={attributes} />
          </div>
        );
      },
      save: () => null,
    });
  }

  if (missingStatic.length > 0 && typeof console !== 'undefined') {
    console.warn(
      '[wplite] Server registers static blocks that the client has no JS for:',
      missingStatic,
      '— content using these will surface as classic/freeform blocks until their editor JS ships.'
    );
  }
}

function collectBlockNames(blocks, output = new Set()) {
  for (const block of blocks ?? []) {
    if (block?.name) output.add(block.name);
    if (block?.innerBlocks?.length) collectBlockNames(block.innerBlocks, output);
  }
  return output;
}

function sanitizeParsedBlocks(blocks) {
  const output = [];
  for (const block of blocks ?? []) {
    if (!block?.name) continue;
    // rawHandler occasionally yields core/freeform (classic block) for
    // HTML that doesn't match any block transform. Convert to core/html so
    // the content is preserved without the classic-block warning banner.
    if (block.name === 'core/freeform') {
      const raw = block.attributes?.content ?? '';
      if (!String(raw).trim()) continue;
      output.push(createBlock('core/html', { content: String(raw) }));
      continue;
    }
    output.push({
      ...block,
      innerBlocks: sanitizeParsedBlocks(block.innerBlocks ?? []),
    });
  }
  return output;
}

export function blocksFromContent(content) {
  if (!content?.trim()) {
    return [];
  }

  let result;
  try {
    if (content.includes('<!-- wp:')) {
      result = sanitizeParsedBlocks(parse(content));
    } else {
      // Content has no block markers — this is rendered HTML, which is a
      // common sign that the REST response is missing `.raw` (e.g. the
      // request wasn't served with context=edit). rawHandler does its best
      // but unknown HTML becomes core/freeform (classic block).
      if (typeof console !== 'undefined') {
        console.warn(
          '[wplite] Parsing content without block markers via rawHandler — '
          + 'source appears to be rendered HTML. Any block that cannot be '
          + 'transformed will appear as a classic/freeform block.'
        );
      }
      result = sanitizeParsedBlocks(rawHandler({ HTML: content }));
    }
  } catch {
    try {
      result = sanitizeParsedBlocks(parse(content || ''));
    } catch {
      return [];
    }
  }

  if (typeof console !== 'undefined') {
    const names = collectBlockNames(result);
    const missing = [];
    for (const name of names) {
      if (!getBlockType(name)) missing.push(name);
    }
    if (missing.length > 0) {
      console.warn('[wplite] Parsed content references unregistered blocks:', missing);
    }
  }

  return result;
}

/**
 * Build the settings object for BlockEditorProvider. Starts from the
 * server's canonical `get_block_editor_settings()` output (delivered via
 * the /editor-bundle REST endpoint) so every preset, fontFamily, color,
 * resolvedAsset, and layout feature WP would give its own editor flows
 * through unchanged. Our only overrides are UI prefs.
 */
export function buildBlockEditorSettings(bundle) {
  const serverSettings = bundle?.editorSettings ?? {};

  return {
    ...serverSettings,
    hasFixedToolbar: true,
    focusMode: false,
    keepCaretInsideBlock: true,
  };
}

/**
 * Return the canvas styles array WP would pass to its own iframed editor.
 * These entries include the global stylesheet (theme.json-derived presets,
 * element styles, layout) and the theme stylesheet, resolved server-side.
 */
export function buildCanvasStyles(bundle) {
  const styles = Array.isArray(bundle?.editorSettings?.styles)
    ? [...bundle.editorSettings.styles]
    : [];
  const globalStylesheet = bundle?.globalStylesheet;
  if (globalStylesheet) {
    styles.unshift({ css: globalStylesheet });
  }

  const themeStylesheetUrl = bundle?.themeStylesheetUrl;
  if (themeStylesheetUrl) {
    const version = bundle?.themeStylesheetVersion
      ? `?ver=${encodeURIComponent(bundle.themeStylesheetVersion)}`
      : '';
    styles.push({
      css: `@import url("${themeStylesheetUrl}${version}");`,
    });
  }

  return styles;
}

export const defaultCanvasStyles = [];
