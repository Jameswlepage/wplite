import React from 'react';
import blockEditorContentCss from '@wordpress/block-editor/build-style/content.css?inline';
import blockEditorDefaultEditorStylesCss from '@wordpress/block-editor/build-style/default-editor-styles.css?inline';
import {
  createBlock,
  getBlockType,
  parse,
  rawHandler,
  registerBlockType,
  serialize,
} from '@wordpress/blocks';
import blockLibraryEditorCss from '@wordpress/block-library/build-style/editor.css?inline';
import blockLibraryEditorElementsCss from '@wordpress/block-library/build-style/editor-elements.css?inline';
import blockLibraryStyleCss from '@wordpress/block-library/build-style/style.css?inline';
import blockLibraryThemeCss from '@wordpress/block-library/build-style/theme.css?inline';
import ServerSideRender from '@wordpress/server-side-render';

const CONTENT_SLOT_CLASS = 'portfolio-editor-content-slot';
const TITLE_PREVIEW_CLASS = 'portfolio-editor-template-title';
const EXCERPT_PREVIEW_CLASS = 'portfolio-editor-template-excerpt';
const LOCKED_TEMPLATE_ATTRS = {
  move: true,
  remove: true,
};

export function registerRuntimeBlocks(blocks = []) {
  for (const metadata of blocks) {
    if (!metadata?.name || getBlockType(metadata.name)) {
      continue;
    }

    registerBlockType(metadata.name, {
      title: metadata.title,
      category: metadata.category || 'widgets',
      icon: metadata.icon,
      description: metadata.description,
      attributes: metadata.attributes ?? {},
      supports: metadata.supports ?? {},
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

function sanitizeParsedBlocks(blocks) {
  const output = [];
  for (const block of blocks ?? []) {
    if (!block?.name) {
      continue;
    }
    // rawHandler (and occasionally parse) can yield core/freeform (classic
    // block) for unrecognized HTML. Convert to core/html so content is
    // preserved without the deprecated classic editor warning.
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

  try {
    if (content.includes('<!-- wp:')) {
      return sanitizeParsedBlocks(parse(content));
    }

    return sanitizeParsedBlocks(rawHandler({ HTML: content }));
  } catch {
    try {
      return sanitizeParsedBlocks(parse(content || ''));
    } catch {
      return [];
    }
  }
}

const TEMPLATE_PREVIEW_UNSUPPORTED_BLOCKS = new Set([
  'core/site-logo',
  'core/query',
  'core/post-template',
  'core/query-pagination',
  'core/query-pagination-next',
  'core/query-pagination-numbers',
  'core/query-pagination-previous',
  'core/query-no-results',
  'core/query-title',
  'core/loginout',
]);

function collectBlockNames(blocks, output = new Set()) {
  for (const block of blocks ?? []) {
    if (block?.name) {
      output.add(block.name);
    }

    if (block?.innerBlocks?.length) {
      collectBlockNames(block.innerBlocks, output);
    }
  }

  return output;
}

export function getTemplatePreviewDiagnostics(templateMarkup) {
  const blockNames = [...collectBlockNames(blocksFromContent(templateMarkup))];
  const unsupported = blockNames.filter((name) => TEMPLATE_PREVIEW_UNSUPPORTED_BLOCKS.has(name));

  // Unsupported blocks (core/query, core/post-template, etc.) cannot be rendered
  // inside the editor iframe, but we can still show the rest of the template
  // chrome (header/footer/template-parts/patterns) by stripping those blocks
  // during preview assembly. See stripUnsupportedPreviewBlocks().
  return {
    compatible: true,
    blockNames,
    unsupported,
  };
}

export function isTemplatePreviewCompatible(templateMarkup) {
  return getTemplatePreviewDiagnostics(templateMarkup).compatible;
}

function stripUnsupportedPreviewBlocks(blocks) {
  const output = [];
  for (const block of blocks ?? []) {
    if (!block?.name) {
      continue;
    }

    if (TEMPLATE_PREVIEW_UNSUPPORTED_BLOCKS.has(block.name)) {
      // Hoist any compatible inner blocks so nested template-parts or
      // surrounding chrome survive (e.g. wrapping group inside a query).
      const innerBlocks = stripUnsupportedPreviewBlocks(block.innerBlocks ?? []);
      output.push(...innerBlocks);
      continue;
    }

    output.push({
      ...block,
      innerBlocks: stripUnsupportedPreviewBlocks(block.innerBlocks ?? []),
    });
  }
  return output;
}

function appendClassName(existing, next) {
  const parts = String(existing ?? '')
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.includes(next)) {
    parts.push(next);
  }

  return parts.join(' ');
}

function hasClassName(value, expected) {
  return String(value ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .includes(expected);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function serializePreviewBlock(name, attributes = {}, innerBlocks = []) {
  return serialize([createBlock(name, attributes, innerBlocks)]);
}

function parseFirstBlockAttributes(markup) {
  const [block] = blocksFromContent(markup);
  return block?.attributes ?? {};
}

function parseFirstBlock(markup) {
  const [block] = blocksFromContent(markup);
  return block ?? null;
}

function replaceTemplateBlockMarkup(markup, blockName, buildReplacement) {
  const escaped = escapeRegex(blockName);
  const patterns = [
    new RegExp(`<!--\\s+wp:${escaped}(?:\\s+{[\\s\\S]*?})?\\s+-->[\\s\\S]*?<!--\\s+\\/wp:${escaped}\\s+-->`, 'g'),
    new RegExp(`<!--\\s+wp:${escaped}(?:\\s+{[\\s\\S]*?})?\\s+\\/-->`, 'g'),
  ];

  return patterns.reduce(
    (output, pattern) => output.replace(pattern, (match) => buildReplacement(match)),
    markup
  );
}

function lockTemplatePreviewBlocks(blocks, insideContentSlot = false) {
  return (blocks ?? []).map((block) => {
    const nextAttributes = { ...(block.attributes ?? {}) };
    const isContentSlot = hasClassName(nextAttributes.className, CONTENT_SLOT_CLASS);
    const nextInsideContentSlot = insideContentSlot || isContentSlot;

    if (!insideContentSlot || isContentSlot) {
      nextAttributes.lock = LOCKED_TEMPLATE_ATTRS;
    }

    return {
      ...block,
      attributes: nextAttributes,
      innerBlocks: lockTemplatePreviewBlocks(block.innerBlocks ?? [], nextInsideContentSlot),
    };
  });
}

function buildTemplatePreviewMarkup({
  templateMarkup,
  contentBlocks,
  title,
  excerpt,
  siteTitle,
  siteTagline,
}) {
  let previewMarkup = String(templateMarkup ?? '');

  previewMarkup = replaceTemplateBlockMarkup(previewMarkup, 'site-title', (match) => {
    const attributes = parseFirstBlockAttributes(match);
    const {
      className,
      level,
      isLink,
      textAlign,
      ...rest
    } = attributes;

    const content = siteTitle || 'Site Title';
    const paragraphClassName = appendClassName(className, 'portfolio-editor-template-site-title');

    return serializePreviewBlock('core/paragraph', {
      ...rest,
      align: textAlign,
      className: paragraphClassName,
      content: isLink ? `<a href="/" rel="home">${content}</a>` : content,
    });
  });

  previewMarkup = replaceTemplateBlockMarkup(previewMarkup, 'site-tagline', (match) => {
    const attributes = parseFirstBlockAttributes(match);
    const { className, textAlign, ...rest } = attributes;

    if (!siteTagline) {
      return '';
    }

    return serializePreviewBlock('core/paragraph', {
      ...rest,
      align: textAlign,
      className: appendClassName(className, 'portfolio-editor-template-site-tagline'),
      content: siteTagline,
    });
  });

  previewMarkup = replaceTemplateBlockMarkup(previewMarkup, 'navigation', (match) => {
    const block = parseFirstBlock(match);
    const attributes = block?.attributes ?? {};
    const navItems = (block?.innerBlocks ?? [])
      .filter((innerBlock) => innerBlock?.name === 'core/navigation-link')
      .map((innerBlock) => {
        const itemAttrs = innerBlock.attributes ?? {};
        const label = String(itemAttrs.label ?? 'Link')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        const url = String(itemAttrs.url ?? '#')
          .replace(/"/g, '&quot;');
        return `<a href="${url}">${label}</a>`;
      });

    if (navItems.length === 0) {
      return '';
    }

    const content = navItems.join('&nbsp;·&nbsp;');

    return serializePreviewBlock('core/paragraph', {
      align: attributes.textAlign ?? 'right',
      className: appendClassName(attributes.className, 'portfolio-editor-template-navigation'),
      content,
    });
  });

  previewMarkup = replaceTemplateBlockMarkup(previewMarkup, 'post-title', (match) => {
    const attributes = parseFirstBlockAttributes(match);
    const { className, isLink, level, ...rest } = attributes;

    return serializePreviewBlock('core/heading', {
      ...rest,
      level: level ?? 1,
      className: appendClassName(className, TITLE_PREVIEW_CLASS),
      content: title ?? '',
    });
  });

  previewMarkup = replaceTemplateBlockMarkup(previewMarkup, 'post-excerpt', (match) => {
    const attributes = parseFirstBlockAttributes(match);
    const {
      className,
      excerptLength,
      moreText,
      showMoreOnNewLine,
      ...rest
    } = attributes;

    if (!excerpt) {
      return '';
    }

    return serializePreviewBlock('core/paragraph', {
      ...rest,
      className: appendClassName(className, EXCERPT_PREVIEW_CLASS),
      content: excerpt,
    });
  });

  previewMarkup = replaceTemplateBlockMarkup(previewMarkup, 'post-content', (match) => {
    const attributes = parseFirstBlockAttributes(match);

    return serializePreviewBlock(
      'core/group',
      {
        ...attributes,
        className: appendClassName(attributes.className, CONTENT_SLOT_CLASS),
      },
      contentBlocks.length > 0
        ? contentBlocks
        : [createBlock('core/paragraph', { placeholder: 'Start writing…' })]
    );
  });

  return previewMarkup;
}

export function buildEditorPreviewBlocks({
  templateMarkup,
  content = '',
  title = '',
  excerpt = '',
  siteTitle = '',
  siteTagline = '',
}) {
  if (!templateMarkup?.trim()) {
    return blocksFromContent(content);
  }

  const contentBlocks = blocksFromContent(content);
  const previewMarkup = buildTemplatePreviewMarkup({
    templateMarkup,
    contentBlocks,
    title,
    excerpt,
    siteTitle,
    siteTagline,
  });

  return lockTemplatePreviewBlocks(
    stripUnsupportedPreviewBlocks(blocksFromContent(previewMarkup))
  );
}

function findContentSlotBlocks(blocks) {
  for (const block of blocks ?? []) {
    if (hasClassName(block.attributes?.className, CONTENT_SLOT_CLASS)) {
      return block.innerBlocks ?? [];
    }

    const nested = findContentSlotBlocks(block.innerBlocks ?? []);
    if (nested) {
      return nested;
    }
  }

  return null;
}

export function extractContentSlotBlocks(blocks) {
  return findContentSlotBlocks(blocks) ?? blocks;
}

export function hasContentSlot(blocks) {
  return findContentSlotBlocks(blocks) !== null;
}

function findPreviewContent(blocks, className) {
  for (const block of blocks ?? []) {
    if (hasClassName(block.attributes?.className, className)) {
      return typeof block.attributes?.content === 'string' ? block.attributes.content : '';
    }

    const nested = findPreviewContent(block.innerBlocks ?? [], className);
    if (nested !== null) {
      return nested;
    }
  }

  return null;
}

export function extractTemplatePreviewTitle(blocks) {
  return findPreviewContent(blocks, TITLE_PREVIEW_CLASS);
}

export function extractTemplatePreviewExcerpt(blocks) {
  return findPreviewContent(blocks, EXCERPT_PREVIEW_CLASS);
}

function syncPreviewBlock(block, context) {
  const nextAttributes = { ...(block.attributes ?? {}) };

  if (hasClassName(nextAttributes.className, TITLE_PREVIEW_CLASS)) {
    nextAttributes.content = context.title ?? '';
  }

  if (hasClassName(nextAttributes.className, EXCERPT_PREVIEW_CLASS)) {
    nextAttributes.content = context.excerpt ?? '';
  }

  const nextInnerBlocks = (block.innerBlocks ?? []).map((innerBlock) =>
    syncPreviewBlock(innerBlock, context)
  );

  return {
    ...block,
    attributes: nextAttributes,
    innerBlocks: nextInnerBlocks,
  };
}

export function syncTemplatePreviewBlocks(blocks, context) {
  return (blocks ?? []).map((block) => syncPreviewBlock(block, context));
}

export const blockEditorSettings = {
  hasFixedToolbar: true,
  focusMode: false,
  keepCaretInsideBlock: true,
};

const CORE_IFRAME_CSS = [
  blockEditorContentCss,
  blockEditorDefaultEditorStylesCss,
  blockLibraryStyleCss,
  blockLibraryEditorCss,
  blockLibraryEditorElementsCss,
  blockLibraryThemeCss,
].join('\n');

const CORE_EDITOR_RESOLVED_ASSETS = {
  styles: `<style id="wplite-core-editor-iframe-styles">${CORE_IFRAME_CSS}</style>`,
  scripts: '',
};

function toKebabCase(value) {
  return String(value)
    .replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)
    .replace(/^ms-/, '-ms-');
}

function buildPresetCssVars(themeJson) {
  const palette = themeJson?.settings?.color?.palette ?? [];
  const gradients = themeJson?.settings?.color?.gradients ?? [];
  const spacingSizes = themeJson?.settings?.spacing?.spacingSizes ?? [];
  const fontFamilies = themeJson?.settings?.typography?.fontFamilies ?? [];
  const fontSizes = themeJson?.settings?.typography?.fontSizes ?? [];
  const layout = themeJson?.settings?.layout ?? {};

  return [
    ...palette.map((item) => `--wp--preset--color--${item.slug}: ${item.color};`),
    ...gradients.map((item) => `--wp--preset--gradient--${item.slug}: ${item.gradient};`),
    ...spacingSizes.map((item) => `--wp--preset--spacing--${item.slug}: ${item.size};`),
    ...fontFamilies.map((item) => `--wp--preset--font-family--${item.slug}: ${item.fontFamily};`),
    ...fontSizes.map((item) => `--wp--preset--font-size--${item.slug}: ${item.size};`),
    ...(layout.contentSize ? [`--wp--style--global--content-size: ${layout.contentSize};`] : []),
    ...(layout.wideSize ? [`--wp--style--global--wide-size: ${layout.wideSize};`] : []),
  ].join('\n        ');
}

function styleObjectToCssDeclarations(styleObject = {}) {
  const declarations = [];

  if (styleObject.color?.background) {
    declarations.push(`background-color: ${styleObject.color.background};`);
  }

  if (styleObject.color?.text) {
    declarations.push(`color: ${styleObject.color.text};`);
  }

  const typography = styleObject.typography ?? {};
  for (const [key, value] of Object.entries(typography)) {
    if (value == null || value === '') {
      continue;
    }

    declarations.push(`${toKebabCase(key)}: ${value};`);
  }

  const spacing = styleObject.spacing ?? {};
  if (spacing.blockGap) {
    declarations.push(`--wp--style--block-gap: ${spacing.blockGap};`);
  }

  for (const prop of ['padding', 'margin']) {
    const value = spacing[prop];
    if (!value) {
      continue;
    }

    if (typeof value === 'string') {
      declarations.push(`${prop}: ${value};`);
      continue;
    }

    for (const [edge, edgeValue] of Object.entries(value)) {
      if (edgeValue == null || edgeValue === '') {
        continue;
      }

      declarations.push(`${prop}-${toKebabCase(edge)}: ${edgeValue};`);
    }
  }

  const border = styleObject.border ?? {};
  for (const key of ['radius', 'color', 'style', 'width']) {
    if (border[key]) {
      declarations.push(`border-${toKebabCase(key)}: ${border[key]};`);
    }
  }

  for (const side of ['top', 'right', 'bottom', 'left']) {
    const sideBorder = border[side];
    if (!sideBorder || typeof sideBorder !== 'object') {
      continue;
    }

    for (const [key, value] of Object.entries(sideBorder)) {
      if (value == null || value === '') {
        continue;
      }

      declarations.push(`border-${side}-${toKebabCase(key)}: ${value};`);
    }
  }

  return declarations.join('\n        ');
}

function buildThemeJsonStyleRules(themeJson) {
  const styles = themeJson?.styles ?? {};
  const rules = [];
  const wrapperDeclarations = styleObjectToCssDeclarations(styles);

  if (wrapperDeclarations) {
    rules.push(`
      .editor-styles-wrapper {
        ${wrapperDeclarations}
      }
    `);
  }

  const elementSelectors = {
    heading: '.editor-styles-wrapper h1, .editor-styles-wrapper h2, .editor-styles-wrapper h3, .editor-styles-wrapper h4, .editor-styles-wrapper h5, .editor-styles-wrapper h6',
    h1: '.editor-styles-wrapper h1',
    h2: '.editor-styles-wrapper h2',
    h3: '.editor-styles-wrapper h3',
    h4: '.editor-styles-wrapper h4',
    h5: '.editor-styles-wrapper h5',
    h6: '.editor-styles-wrapper h6',
    link: '.editor-styles-wrapper a',
    button: '.editor-styles-wrapper .wp-element-button, .editor-styles-wrapper .wp-block-button__link',
  };

  for (const [elementName, selector] of Object.entries(elementSelectors)) {
    const elementStyles = styles.elements?.[elementName];
    if (!elementStyles) {
      continue;
    }

    const baseDeclarations = styleObjectToCssDeclarations(elementStyles);
    if (baseDeclarations) {
      rules.push(`
        ${selector} {
          ${baseDeclarations}
        }
      `);
    }

    const hoverDeclarations = styleObjectToCssDeclarations(elementStyles[':hover'] ?? {});
    if (hoverDeclarations) {
      rules.push(`
        ${selector}:hover {
          ${hoverDeclarations}
        }
      `);
    }
  }

  const blockSelectors = {
    'core/separator': '.editor-styles-wrapper .wp-block-separator',
    'core/quote': '.editor-styles-wrapper .wp-block-quote',
    'core/navigation': '.editor-styles-wrapper .wp-block-navigation',
    'core/site-title': '.editor-styles-wrapper .wp-block-site-title',
  };

  for (const [blockName, selector] of Object.entries(blockSelectors)) {
    const blockStyles = styles.blocks?.[blockName];
    if (!blockStyles) {
      continue;
    }

    const declarations = styleObjectToCssDeclarations(blockStyles);
    if (!declarations) {
      continue;
    }

    rules.push(`
      ${selector} {
        ${declarations}
      }
    `);
  }

  return rules.join('\n');
}

export function buildBlockEditorSettings(themeJson, themeCss = '') {
  return {
    ...blockEditorSettings,
    styles: buildCanvasStyles(themeJson, themeCss),
    __experimentalFeatures: themeJson?.settings ?? {},
    __unstableResolvedAssets: CORE_EDITOR_RESOLVED_ASSETS,
    colors: themeJson?.settings?.color?.palette ?? [],
    gradients: themeJson?.settings?.color?.gradients ?? [],
    fontSizes: (themeJson?.settings?.typography?.fontSizes ?? []).map((item) => ({
      name: item.name,
      slug: item.slug,
      size: item.size,
    })),
  };
}

function extractCssImports(css) {
  if (!css) return { imports: '', rest: '' };
  const importRegex = /@import\s+(?:url\([^)]*\)|["'][^"']*["'])[^;]*;/g;
  const matches = css.match(importRegex) ?? [];
  const rest = css.replace(importRegex, '');
  return { imports: matches.join('\n'), rest };
}

function buildFontFaceRules(themeJson) {
  const fontFamilies = themeJson?.settings?.typography?.fontFamilies ?? [];
  const rules = [];
  for (const family of fontFamilies) {
    const faces = Array.isArray(family?.fontFace) ? family.fontFace : [];
    for (const face of faces) {
      if (!face?.src) continue;
      const srcs = Array.isArray(face.src) ? face.src : [face.src];
      const srcList = srcs.map((s) => `url('${s}')`).join(', ');
      const familyName = face.fontFamily ?? family.fontFamily ?? family.name;
      const weight = face.fontWeight ? `\n  font-weight: ${face.fontWeight};` : '';
      const style = face.fontStyle ? `\n  font-style: ${face.fontStyle};` : '';
      rules.push(`@font-face {\n  font-family: ${familyName};${weight}${style}\n  font-display: swap;\n  src: ${srcList};\n}`);
    }
  }
  return rules.join('\n');
}

export function buildCanvasStyles(themeJson, themeCss = '') {
  const layout = themeJson?.settings?.layout ?? {};
  const cssVars = buildPresetCssVars(themeJson);
  const themeJsonStyleRules = buildThemeJsonStyleRules(themeJson);
  const { imports: themeCssImports, rest: themeCssRest } = extractCssImports(themeCss);
  const fontFaceRules = buildFontFaceRules(themeJson);

  const contentSize = layout.contentSize ?? '720px';
  const fontFamily = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', system-ui, sans-serif";
  const text = '#1e1e1e';
  const linkColor = '#3858e9';

  return [
    {
      css: `${themeCssImports}
      ${fontFaceRules}

      html {
        height: 100%;
        min-height: 100%;
        background: #ffffff;
      }

      body {
        ${cssVars}
        background: #ffffff;
        font-family: ${fontFamily};
        color: ${text};
        line-height: 1.5;
        min-height: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        padding: 56px 64px 180px;
      }

      body > .is-root-container,
      body > .editor-styles-wrapper,
      .editor-styles-wrapper.is-root-container {
        flex: 1;
        min-height: 100%;
      }

      .editor-styles-wrapper {
        max-width: ${contentSize};
        margin: 0 auto;
        color: ${text};
        font-family: ${fontFamily};
      }

      .editor-styles-wrapper.is-root-container,
      body > .is-root-container {
        display: flex;
        flex-direction: column;
        width: 100%;
      }

      .editor-styles-wrapper .block-editor-block-list__layout,
      .editor-styles-wrapper > .block-editor-block-list__layout {
        min-height: 100%;
      }

      .editor-styles-wrapper,
      .editor-styles-wrapper p,
      .editor-styles-wrapper li,
      .editor-styles-wrapper blockquote,
      .editor-styles-wrapper cite,
      .editor-styles-wrapper figcaption,
      .editor-styles-wrapper table,
      .editor-styles-wrapper input,
      .editor-styles-wrapper textarea,
      .editor-styles-wrapper select,
      .editor-styles-wrapper button {
        font-family: ${fontFamily};
        color: ${text};
      }

      .editor-styles-wrapper h1,
      .editor-styles-wrapper h2,
      .editor-styles-wrapper h3,
      .editor-styles-wrapper h4,
      .editor-styles-wrapper h5,
      .editor-styles-wrapper h6 {
        font-family: ${fontFamily};
        font-weight: 600;
        color: ${text};
      }

      .editor-styles-wrapper a {
        color: ${linkColor};
      }

      ${themeJsonStyleRules}

      ${themeCssRest}

      .editor-styles-wrapper,
      .editor-styles-wrapper p,
      .editor-styles-wrapper li,
      .editor-styles-wrapper blockquote,
      .editor-styles-wrapper cite,
      .editor-styles-wrapper figcaption,
      .editor-styles-wrapper table,
      .editor-styles-wrapper input,
      .editor-styles-wrapper textarea,
      .editor-styles-wrapper select,
      .editor-styles-wrapper button {
        font-family: ${fontFamily};
        color: ${text};
      }

      .editor-styles-wrapper h1,
      .editor-styles-wrapper h2,
      .editor-styles-wrapper h3,
      .editor-styles-wrapper h4,
      .editor-styles-wrapper h5,
      .editor-styles-wrapper h6 {
        font-family: ${fontFamily};
        font-weight: 600;
        color: ${text};
      }

      .editor-styles-wrapper a {
        color: ${linkColor};
      }
    `,
    },
  ];
}

export const defaultCanvasStyles = buildCanvasStyles(null);
