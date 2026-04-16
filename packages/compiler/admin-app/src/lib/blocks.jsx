import React from 'react';
import {
  createBlock,
  getBlockType,
  parse,
  pasteHandler,
  rawHandler,
  registerBlockType,
} from '@wordpress/blocks';
import { createHigherOrderComponent } from '@wordpress/compose';
import { addFilter } from '@wordpress/hooks';
import ServerSideRender from '@wordpress/server-side-render';
import { wpApiFetch } from './helpers.js';

/**
 * When a dynamic block is rendered inside a post-template or other iterating
 * context, WP's block editor supplies `postId`, `postType`, `queryId`, etc.
 * via block context. The REST /block-renderer endpoint doesn't receive block
 * context by default, so forward the iteration's postId/postType as query
 * args so the PHP render callback sees the right current post.
 */
function buildBlockRendererQueryArgs(context) {
  if (!context || typeof context !== 'object') return undefined;
  const args = {};
  if (context.postId != null) args.post_id = context.postId;
  if (context.postType) args.post_type = context.postType;
  return Object.keys(args).length > 0 ? args : undefined;
}

let editorPreviewFiltersRegistered = false;

function registerEditorPreviewFilters() {
  if (editorPreviewFiltersRegistered) {
    return;
  }

  const withServerRenderedPostFeaturedImage = createHigherOrderComponent(
    (BlockEdit) => (props) => {
      if (props?.name !== 'core/post-featured-image') {
        return <BlockEdit {...props} />;
      }

      const urlQueryArgs = buildBlockRendererQueryArgs(props?.context);
      if (!urlQueryArgs?.post_id || !urlQueryArgs?.post_type) {
        return <BlockEdit {...props} />;
      }

      return (
        <div className="server-block-preview">
          <ServerSideRender
            block="core/post-featured-image"
            attributes={props.attributes}
            urlQueryArgs={urlQueryArgs}
          />
        </div>
      );
    },
    'withServerRenderedPostFeaturedImage'
  );

  addFilter(
    'editor.BlockEdit',
    'wplite/query-post-featured-image-preview',
    withServerRenderedPostFeaturedImage
  );

  editorPreviewFiltersRegistered = true;
}

registerEditorPreviewFilters();

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
      edit({ attributes, context }) {
        const urlQueryArgs = buildBlockRendererQueryArgs(context);
        return (
          <div className="server-block-preview">
            <ServerSideRender
              block={metadata.name}
              attributes={attributes}
              urlQueryArgs={urlQueryArgs}
            />
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
      if (bt.name !== 'core/freeform') {
        missingStatic.push(bt.name);
      }
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
      edit({ attributes, context }) {
        const urlQueryArgs = buildBlockRendererQueryArgs(context);
        return (
          <div className="server-block-preview">
            <ServerSideRender
              block={bt.name}
              attributes={attributes}
              urlQueryArgs={urlQueryArgs}
            />
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
      const isSingleHtmlFallback =
        result.length === 1 &&
        ['core/freeform', 'core/html'].includes(result[0]?.name);

      if (isSingleHtmlFallback) {
        result = sanitizeParsedBlocks(
          pasteHandler({ HTML: content, mode: 'BLOCKS' })
        );
      }
    } else {
      // Content has no block markers — this is usually rendered HTML or
      // legacy classic-editor markup. Use the block paste pipeline first so
      // Gutenberg can recover paragraphs/headings/lists instead of surfacing
      // deprecated classic/freeform blocks in the canvas.
      if (typeof console !== 'undefined') {
        console.warn(
          '[wplite] Parsing content without block markers via pasteHandler — '
          + 'source appears to be rendered HTML or legacy classic markup.'
        );
      }
      result = sanitizeParsedBlocks(
        pasteHandler({ HTML: content, mode: 'BLOCKS' })
      );
    }
  } catch {
    try {
      result = sanitizeParsedBlocks(
        pasteHandler({ HTML: content || '', mode: 'BLOCKS' })
      );
    } catch {
      try {
        result = sanitizeParsedBlocks(rawHandler({ HTML: content || '' }));
      } catch {
        return [];
      }
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
 * Upload a list of files to the WP media library. Mirrors the signature
 * `@wordpress/media-utils` exposes so block-editor internals (Image block,
 * Gallery, MediaPlaceholder, etc.) can call it the way they expect.
 */
function mediaUpload({
  filesList,
  onFileChange,
  onError,
  additionalData = {},
  allowedTypes,
}) {
  const files = Array.from(filesList ?? []);
  if (files.length === 0) return;

  function matchesAllowed(file) {
    if (!allowedTypes || allowedTypes.length === 0) return true;
    return allowedTypes.some((type) => {
      if (!type) return true;
      if (type.includes('/')) return file.type === type;
      return file.type?.startsWith(`${type}/`);
    });
  }

  const uploads = files.map(async (file) => {
    if (!matchesAllowed(file)) {
      throw new Error(`${file.name}: file type ${file.type || 'unknown'} is not allowed here.`);
    }
    const form = new FormData();
    form.append('file', file, file.name);
    for (const [key, value] of Object.entries(additionalData)) {
      if (value != null) form.append(key, value);
    }
    return wpApiFetch('wp/v2/media', { method: 'POST', body: form });
  });

  Promise.allSettled(uploads).then((results) => {
    const uploaded = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        uploaded.push(result.value);
      } else if (onError) {
        const message = result.reason?.message || 'Upload failed.';
        onError({ message, code: 'upload_failed' });
      }
    }
    if (uploaded.length > 0) onFileChange?.(uploaded);
  });
}

/**
 * Search handler for link popovers and page pickers. Gutenberg passes
 * `(search, { type, subtype, page, perPage })` and expects back
 * `[{ id, url, type, kind, title }]` items from WP's /search endpoint.
 */
async function fetchLinkSuggestions(search, { type, subtype, page = 1, perPage = 20 } = {}) {
  if (!search?.trim()) return [];
  const params = new URLSearchParams({
    search,
    per_page: String(perPage),
    page: String(page),
    _fields: 'id,title,url,type,subtype',
  });
  if (type) params.set('type', type);
  if (subtype) params.set('subtype', subtype);

  try {
    const results = await wpApiFetch(`wp/v2/search?${params.toString()}`);
    return (Array.isArray(results) ? results : []).map((item) => ({
      id: item.id,
      url: item.url,
      type: item.subtype || item.type || 'post',
      kind: item.type || 'post-type',
      title: item.title || item.url || '',
    }));
  } catch (error) {
    if (typeof console !== 'undefined') {
      console.warn('[wplite] Link suggestion lookup failed:', error);
    }
    return [];
  }
}

/**
 * Fetch rich metadata for an external URL (title, icon, image, description)
 * so the link UI can show a preview card.
 */
async function fetchUrlData(url) {
  if (!url) return {};
  try {
    const params = new URLSearchParams({ url });
    return await wpApiFetch(`wp-block-editor/v1/url-details?${params.toString()}`);
  } catch (error) {
    if (typeof console !== 'undefined') {
      console.warn('[wplite] URL metadata lookup failed:', error);
    }
    return {};
  }
}

/**
 * Build the settings object for BlockEditorProvider. Starts from the
 * server's canonical `get_block_editor_settings()` output (delivered via
 * the /editor-bundle REST endpoint) so every preset, fontFamily, color,
 * resolvedAsset, and layout feature WP would give its own editor flows
 * through unchanged. We layer in JS handlers (mediaUpload, link
 * suggestions, URL metadata) that PHP can't serialize.
 */
export function buildBlockEditorSettings(bundle, callbacks = {}) {
  const serverSettings = bundle?.editorSettings ?? {};

  return {
    ...serverSettings,
    hasFixedToolbar: true,
    focusMode: false,
    keepCaretInsideBlock: true,
    mediaUpload,
    __experimentalFetchLinkSuggestions: fetchLinkSuggestions,
    __experimentalFetchUrlData: fetchUrlData,
    ...callbacks,
  };
}

/**
 * Minimal component tokens for popovers rendered inside the iframed editor
 * canvas. We intentionally keep the inline inserter native instead of trying
 * to reskin its layout from outside wp-admin.
 */
const IFRAME_ADMIN_CSS = `
:root {
  --wp-admin-theme-color: #3858e9;
  --wp-admin-theme-color--rgb: 56, 88, 233;
  --wp-admin-theme-color-darker-10: rgb(33.0384615385, 68.7307692308, 230.4615384615);
  --wp-admin-theme-color-darker-10--rgb: 33.0384615385, 68.7307692308, 230.4615384615;
  --wp-admin-theme-color-darker-20: rgb(23.6923076923, 58.1538461538, 214.3076923077);
  --wp-admin-theme-color-darker-20--rgb: 23.6923076923, 58.1538461538, 214.3076923077;
  --wp-components-color-accent: var(--wp-admin-theme-color);
  --wp-components-color-accent-darker-10: var(--wp-admin-theme-color-darker-10);
  --wp-components-color-accent-darker-20: var(--wp-admin-theme-color-darker-20);
  --wp-components-color-accent-inverted: #fff;
  --wp-components-color-background: #fff;
  --wp-components-color-foreground: #1e1e1e;
}
`;

/**
 * Return the canvas styles array WP would pass to its own iframed editor.
 * These entries include the global stylesheet (theme.json-derived presets,
 * element styles, layout) and the theme stylesheet, resolved server-side.
 * We append minimal iframe-scoped component tokens so popovers rendered inside
 * the iframe inherit the same base WordPress component palette as the rest of
 * the app.
 *
 * Note: we intentionally preserve server-provided `id` fields on style
 * entries. Stripping them triggered stale core-data cycles inside the
 * iframe (e.g. query-loop stuck on its spinner). The "global-styles-inline-css
 * was added incorrectly" warning that appears in dev is cosmetic and comes
 * from running outside the wp-admin enqueue lifecycle — safe to ignore.
 */
export function buildCanvasStyles(bundle) {
  const serverStyles = Array.isArray(bundle?.editorSettings?.styles)
    ? [...bundle.editorSettings.styles]
    : [];
  return [...serverStyles, { css: IFRAME_ADMIN_CSS }];
}

export const defaultCanvasStyles = [{ css: IFRAME_ADMIN_CSS }];
