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
import {
  __experimentalPublishDateTimePicker as PublishDateTimePicker,
  MediaPlaceholder,
  MediaReplaceFlow,
  PlainText,
  useBlockProps,
} from '@wordpress/block-editor';
import { Button, Popover, Spinner } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import ServerSideRender from '@wordpress/server-side-render';
import { wpApiFetch } from './helpers.js';
import { useEditorRecord } from './editor-record-context.jsx';

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
const PARSED_BLOCK_CACHE_LIMIT = 40;
const parsedBlockCache = new Map();

function cloneParsedBlocks(blocks = []) {
  return (blocks ?? []).map((block) =>
    createBlock(
      block.name,
      { ...(block.attributes ?? {}) },
      cloneParsedBlocks(block.innerBlocks ?? [])
    )
  );
}

function getCachedParsedBlocks(content) {
  const cached = parsedBlockCache.get(content);
  if (!cached) {
    return null;
  }

  parsedBlockCache.delete(content);
  parsedBlockCache.set(content, cached);
  return cloneParsedBlocks(cached);
}

function rememberParsedBlocks(content, blocks) {
  if (!content || !Array.isArray(blocks)) {
    return;
  }

  parsedBlockCache.set(content, blocks);
  while (parsedBlockCache.size > PARSED_BLOCK_CACHE_LIMIT) {
    const oldestKey = parsedBlockCache.keys().next().value;
    parsedBlockCache.delete(oldestKey);
  }
}

function shouldUseEditorRecordBlock(props, record) {
  if (!record?.setField) {
    return false;
  }

  if (Number.isFinite(props?.context?.queryId)) {
    return false;
  }

  const recordPostType = String(record.postType ?? '').trim();
  const blockPostType = String(props?.context?.postType ?? '').trim();
  if (recordPostType && blockPostType && recordPostType !== blockPostType) {
    return false;
  }

  const recordPostId = Number.parseInt(String(record.postId ?? ''), 10);
  const blockPostId = Number.parseInt(String(props?.context?.postId ?? ''), 10);
  if (
    Number.isFinite(recordPostId)
    && recordPostId > 0
    && Number.isFinite(blockPostId)
    && blockPostId > 0
    && recordPostId !== blockPostId
  ) {
    return false;
  }

  return true;
}

function normalizeIsoDate(value) {
  if (!value) {
    return new Date().toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function formatRecordDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return __('Set date');
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

function getAttachmentPreviewUrl(item) {
  return (
    item?.media_details?.sizes?.large?.source_url
    ?? item?.media_details?.sizes?.medium?.source_url
    ?? item?.media_details?.sizes?.thumbnail?.source_url
    ?? item?.source_url
    ?? ''
  );
}

function EditorRecordPostTitleEdit({ BlockEdit, ...props }) {
  const record = useEditorRecord();
  if (!shouldUseEditorRecordBlock(props, record)) {
    return <BlockEdit {...props} />;
  }

  const {
    attributes: { level = 1, isLink, rel, linkTarget },
  } = props;
  const TagName = level === 0 ? 'p' : `h${level}`;
  const blockProps = useBlockProps();
  const title = String(record.title ?? '');

  if (isLink && record.link) {
    return (
      <TagName {...blockProps}>
        <PlainText
          tagName="a"
          href={record.link}
          target={linkTarget}
          rel={rel}
          value={title}
          onChange={(nextTitle) => record.setField('title', nextTitle)}
          placeholder={!title.length ? __('(no title)') : null}
          __experimentalVersion={2}
        />
      </TagName>
    );
  }

  return (
    <PlainText
      tagName={TagName}
      value={title}
      onChange={(nextTitle) => record.setField('title', nextTitle)}
      placeholder={__('(no title)')}
      __experimentalVersion={2}
      {...blockProps}
    />
  );
}

function EditorRecordPostDateEdit({ BlockEdit, ...props }) {
  const record = useEditorRecord();
  const [isOpen, setIsOpen] = React.useState(false);
  const anchorRef = React.useRef(null);

  if (!shouldUseEditorRecordBlock(props, record)) {
    return <BlockEdit {...props} />;
  }

  const blockProps = useBlockProps();
  const currentDate = normalizeIsoDate(record.date);

  return (
    <>
      <div {...blockProps}>
        <button
          ref={anchorRef}
          type="button"
          className="wplite-editor-record-date-button"
          onClick={() => setIsOpen(true)}
        >
          {formatRecordDate(currentDate)}
        </button>
      </div>
      {isOpen ? (
        <Popover
          anchor={anchorRef.current}
          onClose={() => setIsOpen(false)}
          placement="bottom-start"
        >
          <PublishDateTimePicker
            title={__('Publish Date')}
            currentDate={currentDate}
            onChange={(nextDate) => {
              record.setField('date', normalizeIsoDate(nextDate));
            }}
            onClose={() => setIsOpen(false)}
          />
        </Popover>
      ) : null}
    </>
  );
}

function EditorRecordFeaturedImageEdit({ BlockEdit, ...props }) {
  const record = useEditorRecord();
  const featuredMediaId = Number.parseInt(String(record?.featuredMedia ?? ''), 10) || 0;
  const [attachment, setAttachment] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    if (!featuredMediaId) {
      setAttachment(null);
      return () => {
        cancelled = true;
      };
    }

    setIsLoading(true);
    wpApiFetch(`wp/v2/media/${featuredMediaId}?context=edit`)
      .then((media) => {
        if (!cancelled) {
          setAttachment(media);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAttachment(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [featuredMediaId]);

  if (!shouldUseEditorRecordBlock(props, record)) {
    return <BlockEdit {...props} />;
  }

  const blockProps = useBlockProps();
  const fallbackUrl = String(record.heroUrl ?? '');
  const imageUrl = getAttachmentPreviewUrl(attachment) || fallbackUrl;

  function syncImageFields(nextMediaId, nextImageUrl = '') {
    record.setField('featuredMedia', nextMediaId);
    if (record.heroUrlFieldKey) {
      record.setField(record.heroUrlFieldKey, nextImageUrl);
    }
  }

  function handleSelectMedia(media) {
    if (!media) return;
    setAttachment(media);
    syncImageFields(Number(media.id) || 0, media.url || media.source_url || '');
  }

  function handleRemoveMedia() {
    setAttachment(null);
    syncImageFields(0, '');
  }

  if (isLoading && !imageUrl) {
    return (
      <div {...blockProps} className="wplite-editor-record-image-loading">
        <Spinner />
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div {...blockProps}>
        <MediaPlaceholder
          icon="format-image"
          labels={{ title: __('Featured image') }}
          onSelect={handleSelectMedia}
          accept="image/*"
          allowedTypes={['image']}
          multiple={false}
        />
      </div>
    );
  }

  return (
    <figure {...blockProps} className="wplite-editor-record-image">
      <img
        src={imageUrl}
        alt={attachment?.alt_text || record.title || ''}
        className="wplite-editor-record-image__preview"
      />
      <div className="wplite-editor-record-image__toolbar">
        <MediaReplaceFlow
          mediaId={featuredMediaId || undefined}
          mediaURL={imageUrl}
          allowedTypes={['image']}
          accept="image/*"
          onSelect={handleSelectMedia}
          name={__('Replace')}
        />
        <Button
          variant="secondary"
          size="compact"
          onClick={handleRemoveMedia}
        >
          {__('Remove')}
        </Button>
      </div>
    </figure>
  );
}

function registerEditorPreviewFilters() {
  if (editorPreviewFiltersRegistered) {
    return;
  }

  const withServerRenderedPostFeaturedImage = createHigherOrderComponent(
    (BlockEdit) => (props) => {
      if (props?.name !== 'core/post-featured-image') {
        return <BlockEdit {...props} />;
      }

      if (!Number.isFinite(props?.context?.queryId)) {
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

  const withEditorRecordPostTitle = createHigherOrderComponent(
    (BlockEdit) => (props) => {
      if (props?.name !== 'core/post-title') {
        return <BlockEdit {...props} />;
      }

      return <EditorRecordPostTitleEdit {...props} BlockEdit={BlockEdit} />;
    },
    'withEditorRecordPostTitle'
  );

  const withEditorRecordPostDate = createHigherOrderComponent(
    (BlockEdit) => (props) => {
      if (props?.name !== 'core/post-date') {
        return <BlockEdit {...props} />;
      }

      return <EditorRecordPostDateEdit {...props} BlockEdit={BlockEdit} />;
    },
    'withEditorRecordPostDate'
  );

  const withEditorRecordPostFeaturedImage = createHigherOrderComponent(
    (BlockEdit) => (props) => {
      if (props?.name !== 'core/post-featured-image') {
        return <BlockEdit {...props} />;
      }

      return <EditorRecordFeaturedImageEdit {...props} BlockEdit={BlockEdit} />;
    },
    'withEditorRecordPostFeaturedImage'
  );

  addFilter(
    'editor.BlockEdit',
    'wplite/editor-record-post-title',
    withEditorRecordPostTitle
  );

  addFilter(
    'editor.BlockEdit',
    'wplite/editor-record-post-date',
    withEditorRecordPostDate
  );

  addFilter(
    'editor.BlockEdit',
    'wplite/editor-record-post-featured-image',
    withEditorRecordPostFeaturedImage
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

  const cached = getCachedParsedBlocks(content);
  if (cached) {
    return cached;
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

  rememberParsedBlocks(content, result);
  return cloneParsedBlocks(result);
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
 * Fetch WP media items of a given type and transform them into the shape
 * that Gutenberg's media inserter expects: { id, url, previewUrl, alt, caption }.
 * The PHP get_block_editor_settings() may include inserterMediaCategories as
 * plain objects (name/labels/mediaType) but without fetch functions, which are
 * JS-only. This provides the fetch implementations.
 */
function makeWpMediaFetch(mediaType) {
  return async ({ per_page = 10, search = '' } = {}) => {
    const params = new URLSearchParams({
      per_page: String(per_page),
      media_type: mediaType,
      orderby: 'date',
      order: 'desc',
      _fields: 'id,source_url,alt_text,caption,media_details,mime_type',
    });
    if (search) params.set('search', search);
    try {
      const items = await wpApiFetch(`wp/v2/media?${params.toString()}`);
      return (Array.isArray(items) ? items : []).map((item) => ({
        id: item.id,
        url: item.source_url,
        previewUrl:
          item.media_details?.sizes?.medium?.source_url
          ?? item.media_details?.sizes?.thumbnail?.source_url
          ?? item.source_url,
        alt: item.alt_text || '',
        caption: item.caption?.rendered || '',
        mime_type: item.mime_type,
        type: mediaType,
      }));
    } catch {
      return [];
    }
  };
}

const WP_INSERTER_MEDIA_CATEGORIES = [
  {
    name: 'images',
    labels: { name: 'Images', search_items: 'Search images' },
    mediaType: 'image',
    fetch: makeWpMediaFetch('image'),
  },
  {
    name: 'videos',
    labels: { name: 'Videos', search_items: 'Search videos' },
    mediaType: 'video',
    fetch: makeWpMediaFetch('video'),
  },
  {
    name: 'audio',
    labels: { name: 'Audio', search_items: 'Search audio' },
    mediaType: 'audio',
    fetch: makeWpMediaFetch('audio'),
  },
];

/**
 * Build the settings object for BlockEditorProvider. Starts from the
 * server's canonical `get_block_editor_settings()` output (delivered via
 * the /editor-bundle REST endpoint) so every preset, fontFamily, color,
 * resolvedAsset, and layout feature WP would give its own editor flows
 * through unchanged. We layer in JS handlers (mediaUpload, link
 * suggestions, URL metadata, media inserter categories) that PHP can't serialize.
 */
export function buildBlockEditorSettings(bundle, callbacks = {}) {
  const serverSettings = bundle?.editorSettings ?? {};

  // Wire up fetch functions for media inserter categories. PHP serialises these
  // as plain metadata objects (name/labels/mediaType) without the JS fetch
  // callbacks, so we must attach them here. Fall back to our WP library
  // defaults if PHP didn't include the setting at all.
  const rawMediaCategories = serverSettings.inserterMediaCategories;
  const inserterMediaCategories = Array.isArray(rawMediaCategories) && rawMediaCategories.length > 0
    ? rawMediaCategories.map((cat) => cat.fetch ? cat : { ...cat, fetch: makeWpMediaFetch(cat.mediaType) })
    : WP_INSERTER_MEDIA_CATEGORIES;

  // allowedMimeTypes is required by getInserterMediaCategories to gate which
  // media types are shown. PHP provides it from get_allowed_mime_types(); fall
  // back to a sensible set so the media tab always appears.
  const allowedMimeTypes = serverSettings.allowedMimeTypes ?? {
    'jpg|jpeg|jpe': 'image/jpeg',
    'gif': 'image/gif',
    'png': 'image/png',
    'webp': 'image/webp',
    'mp4|m4v': 'video/mp4',
    'mp3|m4a': 'audio/mpeg',
    'wav': 'audio/wav',
  };

  return {
    ...serverSettings,
    allowedMimeTypes,
    hasFixedToolbar: true,
    focusMode: false,
    keepCaretInsideBlock: true,
    mediaUpload,
    __experimentalFetchLinkSuggestions: fetchLinkSuggestions,
    __experimentalFetchUrlData: fetchUrlData,
    inserterMediaCategories,
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
  --wplite-editor-frame-bg: #242424;
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

html,
body,
body.block-editor-iframe__body {
  background: var(--wplite-editor-frame-bg) !important;
}

.editor-styles-wrapper {
  background: transparent;
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
