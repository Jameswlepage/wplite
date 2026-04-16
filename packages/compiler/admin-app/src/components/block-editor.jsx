import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BlockBreadcrumb,
  BlockContextProvider,
  BlockIcon,
  BlockList,
  BlockEditorKeyboardShortcuts,
  BlockEditorProvider,
  BlockTools,
  InspectorControls,
  LinkControl,
  __unstableEditorStyles as GutenbergEditorStyles,
  __unstableIframe as GutenbergIframe,
  __unstableUseBlockSelectionClearer as useBlockSelectionClearer,
  useBlockCommands,
} from '@wordpress/block-editor';
import {
  Button,
  PanelBody,
  Popover,
  SearchControl,
  TabPanel,
  Tooltip,
} from '@wordpress/components';
import { getBlockType, parse as parseBlocks } from '@wordpress/blocks';
import { useMergeRefs } from '@wordpress/compose';
import { dispatch, useDispatch, useSelect } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { __ } from '@wordpress/i18n';
import { useLocation } from 'react-router-dom';
import { ArrowUpRight, CarbonIcon, Launch, Link } from '../lib/icons.jsx';
import { wpApiFetch } from '../lib/helpers.js';
import {
  buildBlockEditorSettings,
  buildCanvasStyles,
} from '../lib/blocks.jsx';
import { getCachedEditorBundle, loadEditorBundle } from '../lib/editor-bundle.js';
import { EditorRecordProvider } from '../lib/editor-record-context.jsx';
import { useRegisterEditorChrome } from './workspace-context.jsx';
import { useAssistant } from './assistant-provider.jsx';
import BlockTypesTab from '@wplite/block-editor-inserter/block-types-tab.mjs';
import BlockPatternsTab from '@wplite/block-editor-inserter/block-patterns-tab/index.mjs';
import { PatternCategoryPreviews } from '@wplite/block-editor-inserter/block-patterns-tab/pattern-category-previews.mjs';
import { allPatternsCategory } from '@wplite/block-editor-inserter/block-patterns-tab/utils.mjs';
import { MediaTab, MediaCategoryPanel } from '@wplite/block-editor-inserter/media-tab/index.mjs';
import InserterSearchResults from '@wplite/block-editor-inserter/search-results.mjs';
import useInsertionPoint from '@wplite/block-editor-inserter/hooks/use-insertion-point.mjs';

/**
 * Mounted inside BlockEditorProvider to bridge the inner block-editor
 * sub-registry's selected-block state out to parent React state. Needed
 * because the parent component's top-level useSelect reads the OUTER
 * registry and never sees iframe selections.
 */
function InspectorSelectionBridge({ onChange }) {
  const selectedBlockId = useSelect(
    (select) => select(blockEditorStore).getSelectedBlockClientId(),
    []
  );
  const selectedBlock = useSelect(
    (select) => (selectedBlockId ? select(blockEditorStore).getBlock(selectedBlockId) : null),
    [selectedBlockId]
  );
  useEffect(() => {
    onChange?.({ clientId: selectedBlockId || null, block: selectedBlock || null });
  }, [selectedBlockId, selectedBlock, onChange]);
  return null;
}

/**
 * Native-chrome replacement for @wordpress/block-editor's BlockInspector.
 * Mounts the InspectorControls slot groups directly so we own the visual
 * structure (block card header, group sections, footer) instead of
 * reskinning Gutenberg's composite.
 */
function NativeBlockInspector({ blockSidebarFooter }) {
  const selectedBlockId = useSelect(
    (select) => select(blockEditorStore).getSelectedBlockClientId(),
    []
  );
  const blockName = useSelect(
    (select) => (selectedBlockId
      ? select(blockEditorStore).getBlockName(selectedBlockId)
      : null),
    [selectedBlockId]
  );
  const blockType = blockName ? getBlockType(blockName) : null;

  if (!selectedBlockId) {
    return (
      <div className="native-editor__block-sidebar-empty">
        <div className="native-editor__block-sidebar-empty-icon" aria-hidden="true">
          <CarbonIcon name="Edit" size={20} />
        </div>
        <p className="native-editor__block-sidebar-empty-title">No block selected</p>
        <p className="native-editor__block-sidebar-empty-hint">
          Click a block in the canvas to edit its settings, or pick one from the inserter.
        </p>
      </div>
    );
  }

  return (
    <div className="native-inspector">
      {blockType ? (
        <header className="native-inspector__card">
          <div className="native-inspector__card-icon" aria-hidden="true">
            <BlockIcon icon={blockType.icon} />
          </div>
          <div className="native-inspector__card-copy">
            <div className="native-inspector__card-title">{blockType.title || blockName}</div>
            {blockType.description ? (
              <div className="native-inspector__card-desc">{blockType.description}</div>
            ) : null}
          </div>
        </header>
      ) : null}

      <div className="native-inspector__group">
        <InspectorControls.Slot />
      </div>
      <InspectorGroupSection group="list" />
      <InspectorGroupSection group="content" />
      <InspectorGroupSection group="color" label="Color" />
      <InspectorGroupSection group="background" label="Background" />
      <InspectorGroupSection group="typography" label="Typography" />
      <InspectorGroupSection group="dimensions" label="Dimensions" />
      <InspectorGroupSection group="border" label="Border" />
      <InspectorGroupSection group="styles" />
      <InspectorGroupSection group="bindings" label="Bindings" />

      {blockSidebarFooter ? (
        <section className="native-inspector__section">
          <div className="native-inspector__section-title">Actions</div>
          <div className="native-inspector__section-body">
            {blockSidebarFooter}
          </div>
        </section>
      ) : null}
    </div>
  );
}

/**
 * Mount a single InspectorControls.Slot group inside a titled section.
 * The slot itself renders the fills contributed by the selected block's
 * registered controls. If no fills resolve, the section stays collapsed
 * to empty markup (no visual noise).
 */
function InspectorGroupSection({ group, label }) {
  return (
    <section className={`native-inspector__section native-inspector__section--${group}`}>
      {label ? (
        <div className="native-inspector__section-title">{label}</div>
      ) : null}
      <div className="native-inspector__section-body">
        <InspectorControls.Slot group={group} label={label} />
      </div>
    </section>
  );
}

/**
 * Mounted inside BlockEditorProvider so it can read the block-editor
 * sub-registry. Pushes the currently-selected block up to the global
 * AssistantProvider, along with a clear callback that targets the same
 * sub-registry. Renders nothing.
 */
function AssistantSelectionBridge() {
  const { publishSelectedBlock } = useAssistant();
  const selectedClientId = useSelect(
    (select) => select(blockEditorStore).getSelectedBlockClientId(),
    []
  );
  const selected = useSelect(
    (select) => (selectedClientId ? select(blockEditorStore).getBlock(selectedClientId) : null),
    [selectedClientId]
  );
  const { clearSelectedBlock } = useDispatch(blockEditorStore);

  useEffect(() => {
    publishSelectedBlock(selected || null, clearSelectedBlock);
    return () => {
      publishSelectedBlock(null, null);
    };
  }, [selected, clearSelectedBlock, publishSelectedBlock]);

  return null;
}

// Shared across editor mounts so we only pay the REST round-trip once per
// session. WP's editor settings don't change within a session, and caching
// also avoids re-registering server block types on every navigation.
const EDITOR_SCROLL_STORAGE_KEY = 'wplite.editorScroll.v1';
const editorScrollCache = new Map();

function getEditorScrollCacheKey(locationKey = '', pathname = '') {
  const normalizedLocationKey = String(locationKey || '').trim();
  const normalizedPathname = String(pathname || '').trim();
  return normalizedPathname || normalizedLocationKey || 'root';
}

function hydrateEditorScrollCache() {
  if (editorScrollCache.size > 0) {
    return editorScrollCache;
  }

  try {
    const raw = window.sessionStorage?.getItem(EDITOR_SCROLL_STORAGE_KEY);
    if (!raw) {
      return editorScrollCache;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return editorScrollCache;
    }

    for (const [key, value] of Object.entries(parsed)) {
      if (
        value
        && typeof value === 'object'
        && Number.isFinite(Number(value.x))
        && Number.isFinite(Number(value.y))
      ) {
        editorScrollCache.set(key, {
          x: Number(value.x),
          y: Number(value.y),
        });
      }
    }
  } catch {
    // Ignore malformed persisted scroll state.
  }

  return editorScrollCache;
}

function writeEditorScrollPosition(cacheKey, position) {
  if (!cacheKey || !position) {
    return;
  }

  const cache = hydrateEditorScrollCache();
  cache.set(cacheKey, {
    x: Number.isFinite(Number(position.x)) ? Number(position.x) : 0,
    y: Number.isFinite(Number(position.y)) ? Number(position.y) : 0,
  });

  try {
    window.sessionStorage?.setItem(
      EDITOR_SCROLL_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(cache.entries()))
    );
  } catch {
    // Ignore storage failures in private browsing / low quota environments.
  }
}

function readEditorScrollPosition(cacheKey) {
  return hydrateEditorScrollCache().get(cacheKey) ?? { x: 0, y: 0 };
}

/* ── Icon wrappers for WP Button/DropdownMenu icon props ── */
const BackIcon = () => <CarbonIcon name="ArrowLeft" size={20} />;
const AddIcon = () => <CarbonIcon name="Add" size={20} />;
const CloseIcon = () => <CarbonIcon name="Close" size={16} />;
const OverflowIcon = () => <CarbonIcon name="OverflowMenuVertical" size={20} />;
const LaunchIcon = () => <CarbonIcon name="Launch" size={16} />;
const SidebarCloseIcon = () => <CarbonIcon name="SidePanelClose" size={20} />;
const SidebarOpenIcon = () => <CarbonIcon name="SidePanelOpen" size={20} />;
const ViewIcon = () => <CarbonIcon name="ArrowRight" size={16} />;

function findBlockByClientId(blocks = [], clientId) {
  for (const block of blocks ?? []) {
    if (block?.clientId === clientId) {
      return block;
    }

    const nested = findBlockByClientId(block?.innerBlocks ?? [], clientId);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function normalizeComparableHref(href) {
  if (!href) return null;

  try {
    const url = new URL(href, window.location.origin);
    return `${url.origin}${url.pathname.replace(/\/+$/, '') || '/'}${url.search}`;
  } catch {
    return null;
  }
}

function linkMatchesHref(candidate, href) {
  return normalizeComparableHref(candidate) === normalizeComparableHref(href);
}

function extractHtmlLinkSource(markup, href) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${markup}</div>`, 'text/html');
  const container = doc.body.firstElementChild;
  if (!container) {
    return null;
  }

  const anchor = [...container.querySelectorAll('a[href]')].find((item) => linkMatchesHref(item.getAttribute('href'), href));
  return anchor ? { container, anchor } : null;
}

function resolveEditableLinkSource(block, href) {
  if (!block) return null;

  const attributes = block.attributes ?? {};
  for (const key of ['url', 'href']) {
    if (typeof attributes[key] === 'string' && linkMatchesHref(attributes[key], href)) {
      return { type: 'attribute', key };
    }
  }

  for (const key of ['content', 'text', 'caption']) {
    if (typeof attributes[key] !== 'string' || !attributes[key].includes('<a')) continue;
    const htmlLink = extractHtmlLinkSource(attributes[key], href);
    if (htmlLink) {
      return { type: 'html', key };
    }
  }

  return null;
}

function extractPrimaryLink(block) {
  if (!block) return null;

  const attributes = block.attributes ?? {};
  for (const key of ['url', 'href']) {
    if (typeof attributes[key] === 'string' && attributes[key]) {
      return {
        href: attributes[key],
        text:
          attributes.label
          || attributes.text
          || attributes.title
          || block.name.replace(/^core\//, '').replace(/-/g, ' '),
      };
    }
  }

  for (const key of ['content', 'text', 'caption']) {
    if (typeof attributes[key] !== 'string' || !attributes[key].includes('<a')) continue;
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${attributes[key]}</div>`, 'text/html');
    const anchor = doc.querySelector('a[href]');
    if (anchor) {
      return {
        href: anchor.getAttribute('href'),
        text: anchor.textContent?.trim() || block.name.replace(/^core\//, '').replace(/-/g, ' '),
      };
    }
  }

  return null;
}

function getEditorActionLabel(resolution, currentPath = '') {
  if (!resolution?.adminPath) {
    return 'Open link';
  }
  if (resolution.adminPath === currentPath) {
    return 'Edit block';
  }
  return `Edit ${resolution.modelLabel || 'content'}`;
}

function getEditorActionTitle(target, currentPath = '') {
  if (!target?.resolution?.adminPath) {
    const href = getLinkHref(target);
    return href ? `Open ${href} in new tab` : 'Open link in new tab';
  }
  if (target.resolution.adminPath === currentPath) {
    return 'Focus this block in the current editor';
  }
  return `Open ${target.resolution.label || 'record'} in editor`;
}

function getLinkDisplayLabel(target) {
  return target?.resolution?.label || target?.text || 'Linked content';
}

function getLinkHref(target) {
  return target?.href || target?.resolution?.href || '';
}

function getBlockClientIdFromNode(node) {
  const blockNode = node?.closest?.('[data-block]');
  return blockNode?.getAttribute?.('data-block') ?? null;
}

function getLinkedBlockClientId(target) {
  if (target?.clientId) {
    return target.clientId;
  }

  return getBlockClientIdFromNode(target?.node);
}

function extractQueryRecordHints(node) {
  const queryItem = node?.closest?.('.wp-block-post');
  if (!queryItem) {
    return null;
  }

  const dataPostId = Number.parseInt(
    queryItem.getAttribute?.('data-wplite-post-id') || '',
    10
  );
  const className = String(queryItem.getAttribute?.('class') || '');
  const classPostId = Number.parseInt(
    className.match(/(?:^|\s)post-(\d+)(?:\s|$)/)?.[1] || '',
    10
  );
  const postId = dataPostId || classPostId;
  const postType = String(
    queryItem.getAttribute?.('data-wplite-post-type')
    || className.match(/(?:^|\s)type-([^\s]+)/)?.[1]
    || ''
  ).trim();

  if (!Number.isFinite(postId) || postId <= 0 || !postType) {
    return null;
  }

  return {
    postId,
    postType,
    node: queryItem,
  };
}

function extractBlockTargetHints(block) {
  if (!block || typeof block !== 'object') {
    return null;
  }

  const attributes = block.attributes ?? {};
  const targetKind = String(
    attributes.wpliteTargetKind
    ?? attributes.targetKind
    ?? ''
  ).trim();

  const routeId = String(
    attributes.wpliteRouteId
    ?? attributes.routeId
    ?? ''
  ).trim();

  const modelId = String(
    attributes.wpliteModelId
    ?? attributes.modelId
    ?? ''
  ).trim();

  const postId = Number.parseInt(
    String(
      attributes.wplitePostId
      ?? attributes.postId
      ?? attributes.id
      ?? ''
    ),
    10
  );

  const postType = String(
    attributes.wplitePostType
    ?? attributes.postType
    ?? ''
  ).trim();

  const hints = {};
  if (targetKind) hints.targetKind = targetKind;
  if (routeId) hints.routeId = routeId;
  if (modelId) hints.modelId = modelId;
  if (Number.isFinite(postId) && postId > 0) hints.postId = postId;
  if (postType) hints.postType = postType;

  return Object.keys(hints).length > 0 ? hints : null;
}

function getNavigationUrlBinding({ kind, type, id }) {
  const numericId = Number(id);
  if (kind !== 'post-type' || !type || !Number.isFinite(numericId) || numericId <= 0) {
    return null;
  }

  return {
    kind,
    type,
    id: numericId,
    metadata: {
      bindings: {
        url: {
          source: 'core/post-data',
          args: {
            field: 'link',
          },
        },
      },
    },
  };
}

function getNavigationBindingForResolution(resolution) {
  if (!resolution) {
    return null;
  }

  if (resolution.kind === 'page') {
    return getNavigationUrlBinding({
      kind: 'post-type',
      type: 'page',
      id: resolution.id,
    });
  }

  return null;
}

function omitNavigationUrlBinding(metadata = {}) {
  const nextMetadata = { ...(metadata ?? {}) };
  const nextBindings = { ...(nextMetadata.bindings ?? {}) };
  delete nextBindings.url;

  if (Object.keys(nextBindings).length > 0) {
    nextMetadata.bindings = nextBindings;
  } else {
    delete nextMetadata.bindings;
  }

  return nextMetadata;
}

function normalizeNavigationBlock(block, resolveInternalLink) {
  if (!block || typeof block !== 'object') {
    return block;
  }

  let attributesChanged = false;
  let innerBlocksChanged = false;
  let nextAttributes = block.attributes ?? {};

  if (block.name === 'core/navigation-link') {
    const resolution = resolveInternalLink?.({
      ...(extractBlockTargetHints(block) ?? {}),
      href: block.attributes?.url,
    });
    const binding = getNavigationBindingForResolution(resolution);
    const hasBinding = block.attributes?.metadata?.bindings?.url?.source === 'core/post-data';
    if (
      binding
      && (
        block.attributes?.kind !== binding.kind
        || block.attributes?.type !== binding.type
        || Number(block.attributes?.id) !== binding.id
        || !hasBinding
      )
    ) {
      const existingBindings = block.attributes?.metadata?.bindings ?? {};
      nextAttributes = {
        ...nextAttributes,
        kind: binding.kind,
        type: binding.type,
        id: binding.id,
        url: resolution?.href || block.attributes?.url,
        metadata: {
          ...(block.attributes?.metadata ?? {}),
          bindings: {
            ...existingBindings,
            ...binding.metadata.bindings,
          },
        },
      };
      attributesChanged = true;
    }
  }

  const nextInnerBlocks = (block.innerBlocks ?? []).map((innerBlock) => {
    const normalized = normalizeNavigationBlock(innerBlock, resolveInternalLink);
    if (normalized !== innerBlock) {
      innerBlocksChanged = true;
    }
    return normalized;
  });

  if (!attributesChanged && !innerBlocksChanged) {
    return block;
  }

  return {
    ...block,
    attributes: nextAttributes,
    innerBlocks: innerBlocksChanged ? nextInnerBlocks : block.innerBlocks,
  };
}

function upgradeNavigationBlocks(blocks, resolveInternalLink) {
  let changed = false;
  const nextBlocks = (blocks ?? []).map((block) => {
    const normalized = normalizeNavigationBlock(block, resolveInternalLink);
    if (normalized !== block) {
      changed = true;
    }
    return normalized;
  });

  return changed ? nextBlocks : blocks;
}

/* ── Inline title widget for the topbar center ── */
function TopbarTitle({ title, placeholder, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title ?? '');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!editing) setDraft(title ?? '');
  }, [title, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function commit() {
    const next = draft;
    setEditing(false);
    if (next !== title) {
      onChange?.(next);
    }
  }

  function cancel() {
    setDraft(title ?? '');
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="native-editor__title-input"
        type="text"
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            cancel();
          }
        }}
      />
    );
  }

  const hasTitle = Boolean(title);
  const display = hasTitle ? title : (placeholder || 'Add title');

  return (
    <button
      type="button"
      className={`native-editor__title-display${hasTitle ? '' : ' is-placeholder'}`}
      onClick={() => setEditing(true)}
      title={display}
    >
      {display}
    </button>
  );
}

function NativeLinkViewerActions({
  currentPath,
  resolveInternalLink,
  routeTarget,
}) {
  return (
    <LinkControl.ViewerFill>
      {(value = {}) => {
        const href = String(value.url ?? '').trim();
        const resolution = resolveInternalLink?.({
          href,
          kind: value.kind,
          type: value.type,
          id: value.id,
          postId: value.postId,
          postType: value.postType,
          routeId: value.routeId,
          modelId: value.modelId,
        }) ?? null;

        if (!href && !resolution?.adminPath) {
          return null;
        }

        return (
          <>
            {resolution?.adminPath ? (
              <Button
                icon={ViewIcon}
                label={getEditorActionLabel(resolution, currentPath)}
                onClick={() => routeTarget({ ...value, href, resolution })}
                size="compact"
                showTooltip
              />
            ) : null}
            {href && !href.startsWith('#') ? (
              <Button
                icon={LaunchIcon}
                label="View on site"
                onClick={() => routeTarget({ ...value, href, resolution }, { newTab: true })}
                size="compact"
                showTooltip
              />
            ) : null}
          </>
        );
      }}
    </LinkControl.ViewerFill>
  );
}

function NativeInserterPanel({
  onSelect = () => {},
  onClose = () => {},
}) {
  const [selectedTab, setSelectedTab] = useState('blocks');
  const [filterValue, setFilterValue] = useState('');
  const [selectedPatternCategory, setSelectedPatternCategory] = useState(null);
  const [patternFilter, setPatternFilter] = useState('all');
  const [selectedMediaCategory, setSelectedMediaCategory] = useState(null);
  const blockTypesTabRef = useRef(null);

  const [destinationRootClientId, onInsertBlocks, onToggleInsertionPoint] = useInsertionPoint({
    shouldFocusBlock: true,
  });

  const handleInsert = useCallback((blocks, meta, shouldForceFocusBlock, rootClientId) => {
    onInsertBlocks(blocks, meta, shouldForceFocusBlock, rootClientId);
    onSelect(blocks);
  }, [onInsertBlocks, onSelect]);

  const handleInsertPattern = useCallback((blocks, patternName, ...args) => {
    onToggleInsertionPoint(false);
    onInsertBlocks(blocks, { patternName }, ...args);
    onSelect(blocks);
  }, [onInsertBlocks, onSelect, onToggleInsertionPoint]);

  const handleHoverItem = useCallback((item) => {
    onToggleInsertionPoint(item);
  }, [onToggleInsertionPoint]);

  const handleSelectTab = useCallback((nextTab) => {
    setSelectedTab(nextTab);
    setFilterValue('');
    if (nextTab === 'patterns') {
      // Auto-select "All Patterns" so content shows immediately without
      // requiring the user to click a category first.
      setSelectedPatternCategory(allPatternsCategory);
      setPatternFilter('all');
    } else {
      setSelectedPatternCategory(null);
    }
    if (nextTab !== 'media') {
      setSelectedMediaCategory(null);
    }
  }, []);

  const handlePatternCategory = useCallback((patternCategory, nextFilter = 'all') => {
    setSelectedPatternCategory(patternCategory);
    setPatternFilter(nextFilter);
  }, []);

  const showSearch = selectedTab !== 'media';
  const showSearchResults = showSearch && filterValue.trim().length > 0;

  return (
    <aside className="native-editor__inserter-panel" aria-label="Block inserter">
      <div className="native-editor__inserter-header">
        <div className="native-editor__inserter-tablist" role="tablist" aria-label="Insert content">
          {[
            ['blocks', 'Blocks'],
            ['patterns', 'Patterns'],
            ['media', 'Media'],
          ].map(([tabId, label]) => (
            <button
              key={tabId}
              type="button"
              role="tab"
              aria-selected={selectedTab === tabId}
              className={`native-editor__inserter-tab${selectedTab === tabId ? ' is-active' : ''}`}
              onClick={() => handleSelectTab(tabId)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="native-editor__inserter-close"
          aria-label="Close inserter"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </div>
      <div className="native-editor__inserter-search">
        {showSearch ? (
          <SearchControl
            value={filterValue}
            onChange={setFilterValue}
            label={__('Search')}
            placeholder={__('Search')}
            className="native-editor__inserter-search-control"
          />
        ) : (
          <div className="native-editor__inserter-search-placeholder">
            Browse media sources and insert directly into the canvas.
          </div>
        )}
      </div>
      <div className="native-editor__inserter-panel-body">
        {showSearchResults ? (
          <div className="native-editor__inserter-results">
            <InserterSearchResults
              filterValue={filterValue}
              onSelect={onSelect}
              onHover={handleHoverItem}
              rootClientId={destinationRootClientId}
              shouldFocusBlock={true}
              prioritizePatterns={selectedTab === 'patterns'}
            />
          </div>
        ) : null}

        {!showSearchResults && selectedTab === 'blocks' ? (
          <div className="native-editor__inserter-results native-editor__inserter-results--blocks">
            <BlockTypesTab
              ref={blockTypesTabRef}
              rootClientId={destinationRootClientId}
              onInsert={handleInsert}
              onHover={handleHoverItem}
              showMostUsedBlocks={true}
            />
          </div>
        ) : null}

        {!showSearchResults && selectedTab === 'patterns' ? (
          <div className="native-editor__inserter-results native-editor__inserter-results--patterns">
            <BlockPatternsTab
              rootClientId={destinationRootClientId}
              onInsert={handleInsertPattern}
              onSelectCategory={handlePatternCategory}
              selectedCategory={selectedPatternCategory}
            >
              {selectedPatternCategory ? (
                <PatternCategoryPreviews
                  rootClientId={destinationRootClientId}
                  onInsert={handleInsertPattern}
                  category={selectedPatternCategory}
                  patternFilter={patternFilter}
                  showTitlesAsTooltip
                />
              ) : (
                <div className="native-editor__inserter-empty-state">
                  <p>Choose a pattern category to browse and insert ready-made layouts.</p>
                </div>
              )}
            </BlockPatternsTab>
          </div>
        ) : null}

        {!showSearchResults && selectedTab === 'media' ? (
          <div className="native-editor__inserter-results native-editor__inserter-results--media">
            <MediaTab
              rootClientId={destinationRootClientId}
              selectedCategory={selectedMediaCategory}
              onSelectCategory={setSelectedMediaCategory}
              onInsert={handleInsert}
            >
              {selectedMediaCategory ? (
                <MediaCategoryPanel
                  rootClientId={destinationRootClientId}
                  onInsert={handleInsert}
                  category={selectedMediaCategory}
                />
              ) : (
                <div className="native-editor__inserter-empty-state">
                  <p>Select a media source to insert images, video, or audio.</p>
                </div>
              )}
            </MediaTab>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function getCanonicalHref(anchor) {
  if (!anchor) return '';
  const raw = anchor.getAttribute('href');
  if (!raw) return '';
  const trimmed = String(raw).trim();
  if (!trimmed || trimmed.startsWith('#')) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  try {
    return new URL(trimmed, window.location.origin).toString();
  } catch {
    return trimmed;
  }
}

function resolveInteractiveTargetFromNode(node, {
  getBlockFromNode,
  resolveInternalLink,
}) {
  if (!node || typeof node.closest !== 'function') {
    return null;
  }

  const anchor = node.closest('a[href]');
  const block = getBlockFromNode(node);
  const blockHints = extractBlockTargetHints(block) ?? {};
  const queryRecord = extractQueryRecordHints(node);
  const href = anchor ? getCanonicalHref(anchor) : '';
  const linkSource = anchor && block
    ? resolveEditableLinkSource(block, href)
    : null;
  const resolverInput = {
    ...blockHints,
    ...(queryRecord ? {
      postId: queryRecord.postId,
      postType: queryRecord.postType,
    } : {}),
    ...(href && !href.startsWith('#') ? { href } : {}),
  };
  const resolution = resolveInternalLink?.(resolverInput) ?? null;

  if (!anchor && !queryRecord && Object.keys(blockHints).length === 0) {
    return null;
  }

  if (!resolution && !resolverInput.href && !queryRecord) {
    return null;
  }

  const targetNode = queryRecord?.node || anchor || node.closest('[data-block]') || node;

  return {
    ...resolverInput,
    href: resolverInput.href || resolution?.href || '',
    text:
      anchor?.textContent?.trim()
      || block?.attributes?.label
      || block?.attributes?.text
      || block?.attributes?.title
      || '',
    resolution,
    node: targetNode,
    anchor: anchor || null,
    clientId: getBlockClientIdFromNode(targetNode),
    blockName: block?.name || '',
    isInlineTextLink: linkSource?.type === 'html',
    isQueryRecordLink: Boolean(queryRecord),
    isNavigationLink: block?.name === 'core/navigation-link' || block?.name === 'core/navigation-submenu',
    isBlockAttributeLink: linkSource?.type === 'attribute',
  };
}

function RouterBlockEditorCanvas({
  canvasLayout,
  canvasStyles,
  getBlockFromNode,
  locationKey,
  registerCanvasScrollReader,
  recordContextValue,
  pathname,
  resolveInternalLinkRef,
  routeTarget,
  setSelectedLinkedTarget,
  selectBlock,
  undoRef,
  redoRef,
}) {
  useBlockCommands();

  const selectionClearerRef = useBlockSelectionClearer();
  const contentNodeRef = useRef(null);
  const [frameBody, setFrameBody] = useState(null);
  const [isCanvasBooting, setIsCanvasBooting] = useState(true);

  const setContentRef = useCallback((node) => {
    contentNodeRef.current = node;
    setFrameBody(node);
  }, []);

  const contentRef = useMergeRefs([selectionClearerRef, setContentRef]);

  useEffect(() => {
    setIsCanvasBooting(true);
  }, [locationKey]);

  useEffect(() => {
    if (!frameBody?.ownerDocument?.defaultView) {
      return undefined;
    }

    const frameWin = frameBody.ownerDocument.defaultView;
    let frameA = 0;
    let frameB = 0;

    frameA = frameWin.requestAnimationFrame(() => {
      frameB = frameWin.requestAnimationFrame(() => {
        setIsCanvasBooting(false);
      });
    });

    return () => {
      frameWin.cancelAnimationFrame?.(frameA);
      frameWin.cancelAnimationFrame?.(frameB);
    };
  }, [frameBody, locationKey]);

  useEffect(() => {
    if (!frameBody?.ownerDocument?.defaultView) {
      return undefined;
    }

    const frameDoc = frameBody.ownerDocument;
    const frameWin = frameDoc.defaultView;
    const scrollingElement = frameDoc.scrollingElement || frameDoc.documentElement;
    const cacheKey = getEditorScrollCacheKey(locationKey, pathname);

    function persistScrollPosition() {
      writeEditorScrollPosition(cacheKey, {
        x: scrollingElement?.scrollLeft ?? frameWin.scrollX,
        y: scrollingElement?.scrollTop ?? frameWin.scrollY,
      });
    }

    const restorePosition = readEditorScrollPosition(cacheKey);
    let restoreFrameA = 0;
    let restoreFrameB = 0;

    restoreFrameA = frameWin.requestAnimationFrame(() => {
      restoreFrameB = frameWin.requestAnimationFrame(() => {
        frameWin.scrollTo(restorePosition.x, restorePosition.y);
      });
    });

    scrollingElement?.addEventListener('scroll', persistScrollPosition, { passive: true });

    return () => {
      frameWin.cancelAnimationFrame?.(restoreFrameA);
      frameWin.cancelAnimationFrame?.(restoreFrameB);
      scrollingElement?.removeEventListener('scroll', persistScrollPosition);
    };
  }, [frameBody, locationKey, pathname]);

  useEffect(() => {
    if (!frameBody?.ownerDocument?.defaultView) {
      registerCanvasScrollReader?.(null);
      return undefined;
    }

    const frameDoc = frameBody.ownerDocument;
    const frameWin = frameDoc.defaultView;
    registerCanvasScrollReader?.(() => ({
      x: frameWin.scrollX,
      y: frameWin.scrollY,
    }));

    return () => {
      registerCanvasScrollReader?.(null);
    };
  }, [frameBody, registerCanvasScrollReader]);

  useEffect(() => {
    if (!frameBody?.ownerDocument?.defaultView?.frameElement) {
      return undefined;
    }

    const frameDoc = frameBody.ownerDocument;

    function selectContainingBlock(node) {
      const clientId = getBlockClientIdFromNode(node);
      if (clientId) {
        selectBlock(clientId);
      }
    }

    function resolveTarget(node) {
      return resolveInteractiveTargetFromNode(node, {
        getBlockFromNode,
        resolveInternalLink: resolveInternalLinkRef.current,
      });
    }

    let pointerDownState = { preserveRichTextInteraction: false };

    function handlePointerDown(event) {
      const editableRoot = event.target.closest?.('[contenteditable="true"]');
      const activeElement = frameDoc.activeElement;
      pointerDownState = {
        preserveRichTextInteraction: Boolean(
          editableRoot
          && activeElement
          && (editableRoot === activeElement || editableRoot.contains(activeElement))
        ),
      };
    }

    function handleLinkActivation(event) {
      const isPrimaryButton = event.button === 0 || event.button === undefined;
      const isMiddleButton = event.type === 'auxclick' && event.button === 1;
      if (!isPrimaryButton && !isMiddleButton) {
        return;
      }

      const targetInfo = resolveTarget(event.target);
      const anchor = event.target.closest?.('a[href]');
      const isEditingRichText = pointerDownState.preserveRichTextInteraction;

      if (isEditingRichText && isPrimaryButton && !isMiddleButton && !event.metaKey && !event.ctrlKey && event.detail < 2) {
        return;
      }

      if (anchor || targetInfo?.isQueryRecordLink || targetInfo?.resolution?.adminPath) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
      }

      if (!targetInfo) {
        setSelectedLinkedTarget(null);
        if (anchor) {
          selectContainingBlock(anchor);
        }
        return;
      }

      setSelectedLinkedTarget(targetInfo);

      if (isMiddleButton || event.metaKey || event.ctrlKey) {
        routeTarget(targetInfo, { newTab: true });
        return;
      }

      if (event.altKey || event.shiftKey) {
        if (targetInfo.node) {
          selectContainingBlock(targetInfo.node);
        }
        return;
      }

      if (event.detail >= 2) {
        routeTarget(targetInfo);
        return;
      }

      if (targetInfo.node) {
        selectContainingBlock(targetInfo.node);
      }
    }

    function handleHistoryKeydown(event) {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      const key = event.key?.toLowerCase?.();
      if (key === 'z' && !event.shiftKey) {
        if (undoRef.current?.()) {
          event.preventDefault();
          event.stopPropagation();
        }
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        if (redoRef.current?.()) {
          event.preventDefault();
          event.stopPropagation();
        }
      }
    }

    frameDoc.addEventListener('mousedown', handlePointerDown, true);
    frameDoc.addEventListener('click', handleLinkActivation, true);
    frameDoc.addEventListener('auxclick', handleLinkActivation, true);
    frameDoc.addEventListener('keydown', handleHistoryKeydown, true);

    return () => {
      frameDoc.removeEventListener('mousedown', handlePointerDown, true);
      frameDoc.removeEventListener('click', handleLinkActivation, true);
      frameDoc.removeEventListener('auxclick', handleLinkActivation, true);
      frameDoc.removeEventListener('keydown', handleHistoryKeydown, true);
    };
  }, [frameBody, getBlockFromNode, resolveInternalLinkRef, routeTarget, selectBlock, setSelectedLinkedTarget, undoRef, redoRef]);

  return (
    <div className={`native-editor__canvas-frame-wrap${isCanvasBooting ? ' is-booting' : ''}`}>
      <GutenbergIframe
        contentRef={contentRef}
        style={{ height: '100%', width: '100%' }}
        className={`native-editor__canvas-frame native-editor__canvas-frame--${canvasLayout === 'template' ? 'template' : 'content'}`}
      >
        <GutenbergEditorStyles styles={canvasStyles} />
        {recordContextValue ? (
          <BlockContextProvider value={recordContextValue}>
            <BlockList
              className={`native-editor__canvas-block-list native-editor__canvas-block-list--${canvasLayout === 'template' ? 'template' : 'content'}`}
            />
          </BlockContextProvider>
        ) : (
          <BlockList
            className={`native-editor__canvas-block-list native-editor__canvas-block-list--${canvasLayout === 'template' ? 'template' : 'content'}`}
          />
        )}
      </GutenbergIframe>
      {isCanvasBooting ? <div className="native-editor__canvas-boot-cover" aria-hidden="true" /> : null}
    </div>
  );
}

/* ── Empty-page pattern picker ───────────────────────────────────────
   Shown as an overlay inside the canvas shell when a page is empty
   and the user preference allows it. Fetches WP block patterns,
   filters to the `full-page` category, and lets the user apply one
   as a starting point. */
const EMPTY_PAGE_PICKER_PREF_KEY = 'wplite.emptyPagePatternPicker.enabled.v1';

function readEmptyPagePickerEnabled() {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(EMPTY_PAGE_PICKER_PREF_KEY);
    if (raw === null) return true;
    return raw !== '0';
  } catch {
    return true;
  }
}

function writeEmptyPagePickerEnabled(enabled) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(EMPTY_PAGE_PICKER_PREF_KEY, enabled ? '1' : '0');
  } catch {
    /* swallow */
  }
}

function EmptyPagePatternPicker({ onApply, onDismiss }) {
  const [patterns, setPatterns] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [rememberPref, setRememberPref] = useState(true);

  useEffect(() => {
    let cancelled = false;
    wpApiFetch('wp/v2/block-patterns')
      .then((list) => {
        if (cancelled) return;
        const full = (Array.isArray(list) ? list : [])
          .filter((item) => Array.isArray(item?.categories) && item.categories.includes('full-page'));
        setPatterns(full);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error);
      });
    return () => { cancelled = true; };
  }, []);

  const handleApply = useCallback((pattern) => {
    try {
      const blocks = parseBlocks(String(pattern?.content || ''));
      if (Array.isArray(blocks) && blocks.length) {
        onApply?.(blocks);
      }
    } catch {
      /* ignore parse errors — bail silently */
    }
  }, [onApply]);

  const handleDismiss = useCallback(() => {
    if (!rememberPref) {
      writeEmptyPagePickerEnabled(false);
    }
    onDismiss?.();
  }, [onDismiss, rememberPref]);

  return (
    <div className="native-editor__empty-picker" role="dialog" aria-label="Choose a starting pattern">
      <div className="native-editor__empty-picker-head">
        <div className="native-editor__empty-picker-title">Start with a layout</div>
        <div className="native-editor__empty-picker-sub">
          Pick a full-page pattern to begin with, or close this and start from a blank canvas.
        </div>
      </div>
      <div className="native-editor__empty-picker-body">
        {loadError ? (
          <div className="native-editor__empty-picker-empty">Failed to load patterns.</div>
        ) : patterns === null ? (
          <div className="native-editor__empty-picker-empty">Loading patterns…</div>
        ) : patterns.length === 0 ? (
          <div className="native-editor__empty-picker-empty">
            No full-page patterns are registered yet. Tag a pattern with
            <code> Categories: full-page </code> in its header to surface it here.
          </div>
        ) : (
          <ul className="native-editor__empty-picker-grid">
            {patterns.map((pattern) => (
              <li key={pattern.name} className="native-editor__empty-picker-item">
                <button
                  type="button"
                  className="native-editor__empty-picker-card"
                  onClick={() => handleApply(pattern)}
                  title={pattern.description || pattern.title}
                >
                  <span className="native-editor__empty-picker-card-title">{pattern.title}</span>
                  {pattern.description ? (
                    <span className="native-editor__empty-picker-card-desc">{pattern.description}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="native-editor__empty-picker-foot">
        <label className="native-editor__empty-picker-toggle">
          <input
            type="checkbox"
            checked={rememberPref}
            onChange={(event) => setRememberPref(event.target.checked)}
          />
          <span>Show this on future empty pages</span>
        </label>
        <button
          type="button"
          className="native-editor__empty-picker-dismiss"
          onClick={handleDismiss}
        >
          Start blank
        </button>
      </div>
    </div>
  );
}

/* ── Native Block Editor Frame ── */
export function NativeBlockEditorFrame({
  eyebrow = 'Editor',
  label,
  title,
  titlePlaceholder,
  onChangeTitle,
  showTitleInput = true,
  showBackButton = true,
  showPrimaryAction = true,
  showMoreActions = true,
  blocks,
  onChangeBlocks,
  backLabel,
  onBack,
  primaryActionLabel = 'Save',
  onPrimaryAction,
  isPrimaryBusy = false,
  viewUrl,
  documentLabel = 'Page',
  documentSidebar,
  blockSidebarFooter = null,
  wpAdminUrl,
  wpAdminTemplateUrl,
  canvasLayout = 'content',
  recordContext = null,
  resolveInternalLink = null,
  onOpenInternalLink = null,
  showEmptyPatternPicker = false,
}) {
  const [editorBundle, setEditorBundle] = useState(() => getCachedEditorBundle());
  const [bundleError, setBundleError] = useState(null);
  const { selectBlock, updateBlockAttributes } = useDispatch(blockEditorStore);
  const routerLocation = useLocation();
  const currentAdminPathRef = useRef(routerLocation.pathname);
  useEffect(() => { currentAdminPathRef.current = routerLocation.pathname; }, [routerLocation.pathname]);

  useEffect(() => {
    let cancelled = false;
    loadEditorBundle()
      .then((bundle) => {
        if (!cancelled) setEditorBundle(bundle);
      })
      .catch((error) => {
        if (!cancelled) setBundleError(error);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const moreActionsControls = [];
  if (viewUrl) {
    moreActionsControls.push({
      title: 'View on site',
      icon: LaunchIcon,
      onClick: () => {
        window.open(viewUrl, '_blank', 'noopener,noreferrer');
      },
    });
  }
  if (wpAdminUrl) {
    moreActionsControls.push({
      title: 'Open in wp-admin',
      onClick: () => {
        window.open(wpAdminUrl, '_blank', 'noopener,noreferrer');
      },
    });
  }
  if (wpAdminTemplateUrl) {
    moreActionsControls.push({
      title: 'Edit template in wp-admin',
      onClick: () => {
        window.open(wpAdminTemplateUrl, '_blank', 'noopener,noreferrer');
      },
    });
  }

  // Selection state bridged out of the inner block-editor sub-registry by
  // InspectorSelectionBridge (mounted below inside BlockEditorProvider).
  // Reading selection via useSelect at this level would query the OUTER
  // registry and always be null when the editor runs in an iframe.
  const [bridgedSelection, setBridgedSelection] = useState({ clientId: null, block: null });
  const selectedBlockId = bridgedSelection.clientId;
  const selectedBlock = bridgedSelection.block;
  const handleBridgedSelection = useCallback((next) => {
    setBridgedSelection((current) =>
      current.clientId === next.clientId && current.block === next.block ? current : next
    );
  }, []);
  const [inspectorTab, setInspectorTab] = useState('document');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inserterOpen, setInserterOpen] = useState(false);
  const [emptyPickerEnabled, setEmptyPickerEnabled] = useState(() => readEmptyPagePickerEnabled());
  const [emptyPickerDismissedSession, setEmptyPickerDismissedSession] = useState(false);
  const [selectedLinkedTarget, setSelectedLinkedTarget] = useState(null);
  const [isLinkSwitcherOpen, setIsLinkSwitcherOpen] = useState(false);
  const canvasScrollReaderRef = useRef(null);
  const linkSwitcherButtonRef = useRef(null);

  // Refs to keep editor callbacks stable while the canvas remains mounted.
  const blocksRef = useRef(blocks);
  useEffect(() => { blocksRef.current = blocks; }, [blocks]);

  const getBlockFromNode = useCallback((node) => {
    const clientId = getBlockClientIdFromNode(node);
    return clientId ? findBlockByClientId(blocksRef.current, clientId) : null;
  }, []);

  // ── Undo / redo ────────────────────────────────────────────────────
  // BlockEditorProvider doesn't manage history on its own (that belongs
  // to @wordpress/editor). Track committed states (onChange firings) in
  // a capped stack and expose undo/redo bound to Cmd/Ctrl+Z and
  // Cmd/Ctrl+Shift+Z / Cmd/Ctrl+Y.
  const historyRef = useRef({ past: [], future: [], last: blocks });
  useEffect(() => {
    // Keep `last` in sync with external block changes (e.g. initial load)
    // that aren't coming through the editor's onChange.
    if (!historyRef.current.past.length && !historyRef.current.future.length) {
      historyRef.current.last = blocks;
    }
  }, [blocks]);

  const handleInput = useCallback((nextBlocks) => {
    // Transient change — update state but don't record a history entry.
    const normalizedBlocks = resolveInternalLinkRef.current
      ? upgradeNavigationBlocks(nextBlocks, resolveInternalLinkRef.current)
      : nextBlocks;
    onChangeBlocks?.(normalizedBlocks);
  }, [onChangeBlocks]);

  const handleChange = useCallback((nextBlocks) => {
    const normalizedBlocks = resolveInternalLinkRef.current
      ? upgradeNavigationBlocks(nextBlocks, resolveInternalLinkRef.current)
      : nextBlocks;
    const history = historyRef.current;
    if (history.last !== normalizedBlocks) {
      history.past.push(history.last);
      if (history.past.length > 100) history.past.shift();
      history.future.length = 0;
      history.last = normalizedBlocks;
    }
    onChangeBlocks?.(normalizedBlocks);
  }, [onChangeBlocks]);

  const undo = useCallback(() => {
    const history = historyRef.current;
    if (!history.past.length) return false;
    const previous = history.past.pop();
    history.future.push(history.last);
    history.last = previous;
    onChangeBlocks?.(previous);
    return true;
  }, [onChangeBlocks]);

  const redo = useCallback(() => {
    const history = historyRef.current;
    if (!history.future.length) return false;
    const next = history.future.pop();
    history.past.push(history.last);
    history.last = next;
    onChangeBlocks?.(next);
    return true;
  }, [onChangeBlocks]);

  const undoRef = useRef(undo);
  const redoRef = useRef(redo);
  useEffect(() => { undoRef.current = undo; }, [undo]);
  useEffect(() => { redoRef.current = redo; }, [redo]);

  useEffect(() => {
    function onWindowKeyDown(event) {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        if (undoRef.current?.()) {
          event.preventDefault();
          event.stopPropagation();
        }
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        if (redoRef.current?.()) {
          event.preventDefault();
          event.stopPropagation();
        }
      }
    }
    window.addEventListener('keydown', onWindowKeyDown);
    return () => window.removeEventListener('keydown', onWindowKeyDown);
  }, []);
  const resolveInternalLinkRef = useRef(resolveInternalLink);
  useEffect(() => { resolveInternalLinkRef.current = resolveInternalLink; }, [resolveInternalLink]);
  const onOpenInternalLinkRef = useRef(onOpenInternalLink);
  useEffect(() => { onOpenInternalLinkRef.current = onOpenInternalLink; }, [onOpenInternalLink]);

  const routeTarget = useCallback((target, { newTab = false } = {}) => {
    if (!target) {
      return false;
    }

    const href = getLinkHref(target);
    const resolution = target.resolution
      ?? resolveInternalLinkRef.current?.({
        ...target,
        ...(href ? { href } : {}),
      })
      ?? null;
    const currentPath = currentAdminPathRef.current || '';
    const openHandler = onOpenInternalLinkRef.current || onOpenInternalLink;
    const currentScrollPosition = canvasScrollReaderRef.current?.();

    if (currentPath && currentScrollPosition) {
      writeEditorScrollPosition(
        getEditorScrollCacheKey(currentPath, currentPath),
        currentScrollPosition
      );
    }

    if (newTab) {
      if (href && !href.startsWith('#')) {
        window.open(href, '_blank', 'noopener,noreferrer');
        return true;
      }
      return false;
    }

    if (resolution?.adminPath && typeof openHandler === 'function') {
      if (resolution.adminPath === currentPath) {
        const clientId = getLinkedBlockClientId(target);
        if (clientId) {
          selectBlock(clientId);
        }
        return true;
      }

      openHandler(resolution.adminPath);
      return true;
    }

    if (
      target?.postType === 'wp_template_part'
      && wpAdminTemplateUrl
    ) {
      window.open(wpAdminTemplateUrl, '_blank', 'noopener,noreferrer');
      return true;
    }

    return false;
  }, [selectBlock, wpAdminTemplateUrl]);

  const handleNavigateToEntityRecord = useCallback((target) => {
    routeTarget(target);
  }, [routeTarget]);

  const selectedBlockLinkTarget = useMemo(() => {
    if (!selectedBlock) {
      return null;
    }

    const primaryLink = extractPrimaryLink(selectedBlock);
    const blockHints = extractBlockTargetHints(selectedBlock) ?? {};
    const resolution = resolveInternalLink?.({
      ...blockHints,
      ...(primaryLink?.href ? { href: primaryLink.href } : {}),
    }) ?? null;

    if (!resolution?.adminPath && !primaryLink?.href) {
      return null;
    }

    return {
      ...blockHints,
      href: primaryLink?.href || resolution?.href || '',
      text:
        primaryLink?.text
        || selectedBlock?.attributes?.label
        || selectedBlock?.attributes?.text
        || selectedBlock?.attributes?.title
        || '',
      resolution,
      clientId: selectedBlock.clientId,
      blockName: selectedBlock.name,
      isBlockAttributeLink: Boolean(primaryLink?.href),
    };
  }, [resolveInternalLink, selectedBlock]);

  const activeLinkedTarget = useMemo(() => {
    if (
      selectedLinkedTarget?.clientId
      && selectedBlockId
      && selectedLinkedTarget.clientId === selectedBlockId
    ) {
      return selectedLinkedTarget;
    }

    return selectedBlockLinkTarget;
  }, [selectedBlockId, selectedBlockLinkTarget, selectedLinkedTarget]);

  // True for core/button and similar "pure link" blocks where the user edits the URL directly.
  // Navigation links are excluded because they use the switcher popover.
  const isEditableLinkBlock = useMemo(() => {
    if (!selectedBlock) return false;
    const n = selectedBlock.name;
    return n === 'core/button' || n === 'core/file';
  }, [selectedBlock]);

  const [linkEditorUrl, setLinkEditorUrl] = useState('');
  const [linkEditorNewTab, setLinkEditorNewTab] = useState(false);

  // Sync link editor state when the selected block changes
  useEffect(() => {
    if (!isEditableLinkBlock || !selectedBlock) return;
    setLinkEditorUrl(selectedBlock.attributes?.url || '');
    setLinkEditorNewTab(selectedBlock.attributes?.linkTarget === '_blank');
  }, [isEditableLinkBlock, selectedBlock?.clientId]);

  const applyLinkEdit = useCallback(() => {
    if (!isEditableLinkBlock || !selectedBlock) return;
    updateBlockAttributes(selectedBlock.clientId, {
      url: linkEditorUrl,
      linkTarget: linkEditorNewTab ? '_blank' : undefined,
      rel: linkEditorNewTab ? 'noreferrer noopener' : undefined,
    });
  }, [isEditableLinkBlock, linkEditorNewTab, linkEditorUrl, selectedBlock, updateBlockAttributes]);

  const navigationLinkControlValue = useMemo(() => {
    if (selectedBlock?.name !== 'core/navigation-link') {
      return null;
    }

    return {
      url: getLinkHref(activeLinkedTarget) || selectedBlock?.attributes?.url || '',
      title:
        selectedBlock?.attributes?.label
        || selectedBlock?.attributes?.title
        || activeLinkedTarget?.text
        || '',
      kind: selectedBlock?.attributes?.kind || 'custom',
      type: selectedBlock?.attributes?.type || 'custom',
      id: Number.isFinite(Number(selectedBlock?.attributes?.id))
        ? Number(selectedBlock.attributes.id)
        : undefined,
    };
  }, [activeLinkedTarget, selectedBlock]);

  const canSwitchNavigationLink = useMemo(
    () => selectedBlock?.name === 'core/navigation-link' && Boolean(navigationLinkControlValue?.url || selectedBlock?.attributes?.url || selectedBlock?.attributes?.label),
    [navigationLinkControlValue, selectedBlock]
  );

  useEffect(() => {
    if (!selectedBlockId) {
      setSelectedLinkedTarget(null);
      setIsLinkSwitcherOpen(false);
      return;
    }

    if (
      selectedLinkedTarget?.clientId
      && selectedLinkedTarget.clientId !== selectedBlockId
    ) {
      setSelectedLinkedTarget(null);
      setIsLinkSwitcherOpen(false);
    }
  }, [selectedBlockId, selectedLinkedTarget]);

  // When core/navigation is selected, enter its inner-blocks editing mode so
  // individual nav-link children become clickable.
  useEffect(() => {
    if (selectedBlock?.name !== 'core/navigation' || !selectedBlockId) return;
    const { setBlockEditingMode } = dispatch(blockEditorStore);
    if (typeof setBlockEditingMode === 'function') {
      setBlockEditingMode(selectedBlockId, 'default');
    }
  }, [selectedBlockId, selectedBlock?.name]);

  const handleNavigationLinkChange = useCallback((nextValue = {}) => {
    if (selectedBlock?.name !== 'core/navigation-link') {
      return;
    }

    const nextUrl = String(nextValue?.url ?? '').trim();
    const nextKind = String(nextValue?.kind ?? '').trim() || 'custom';
    const nextType = String(nextValue?.type ?? '').trim() || (nextKind === 'custom' ? 'custom' : '');
    const nextId = Number.parseInt(String(nextValue?.id ?? ''), 10);
    const isEntityLink = nextKind === 'post-type' && nextType && Number.isFinite(nextId) && nextId > 0;
    const binding = isEntityLink
      ? getNavigationUrlBinding({ kind: nextKind, type: nextType, id: nextId })
      : null;
    const resolvedTarget = resolveInternalLinkRef.current?.({
      href: nextUrl,
      kind: nextKind,
      type: nextType,
      id: isEntityLink ? nextId : undefined,
    }) ?? null;

    const nextMetadata = binding
      ? {
        ...(omitNavigationUrlBinding(selectedBlock.attributes?.metadata) ?? {}),
        ...(binding.metadata ?? {}),
      }
      : omitNavigationUrlBinding(selectedBlock.attributes?.metadata);

    const nextAttributes = {
      url: nextUrl || undefined,
      kind: isEntityLink ? nextKind : 'custom',
      type: isEntityLink ? nextType : 'custom',
      id: isEntityLink ? nextId : undefined,
      metadata: nextMetadata,
      wpliteTargetKind: resolvedTarget?.kind === 'archive' ? 'archive' : undefined,
      wpliteModelId: resolvedTarget?.kind === 'archive' ? resolvedTarget.modelId : undefined,
      wpliteRouteId: undefined,
      wplitePostId: undefined,
      wplitePostType: undefined,
    };

    const currentLabel = String(selectedBlock?.attributes?.label ?? '').trim();
    if (!currentLabel) {
      const suggestedLabel = String(nextValue?.title ?? nextValue?.label ?? '').trim();
      if (suggestedLabel) {
        nextAttributes.label = suggestedLabel;
      }
    }

    updateBlockAttributes(selectedBlock.clientId, nextAttributes);
    setSelectedLinkedTarget(null);
    setIsLinkSwitcherOpen(false);
  }, [selectedBlock, updateBlockAttributes]);

  const toggleInserter = useCallback(() => setInserterOpen((v) => !v), []);
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);

  const editorChrome = useMemo(() => ({
    inserterOpen,
    sidebarOpen,
    toggleInserter,
    toggleSidebar,
  }), [inserterOpen, sidebarOpen, toggleInserter, toggleSidebar]);

  useRegisterEditorChrome(editorChrome);

  useEffect(() => {
    if (!inserterOpen) return undefined;
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setInserterOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [inserterOpen]);

  useEffect(() => {
    if (selectedBlockId) {
      setInspectorTab('block');
    }
  }, [selectedBlockId]);

  const canvasStyles = useMemo(
    () => buildCanvasStyles(editorBundle),
    [editorBundle]
  );

  const editorSettings = useMemo(
    () => buildBlockEditorSettings(editorBundle, {
      onNavigateToEntityRecord: handleNavigateToEntityRecord,
    }),
    [editorBundle, handleNavigateToEntityRecord]
  );
  const recordContextValue = useMemo(() => {
    const postType = String(recordContext?.postType ?? '').trim();
    const postId = Number.parseInt(String(recordContext?.postId ?? ''), 10);

    if (!postType || !Number.isFinite(postId) || postId <= 0) {
      return null;
    }

    return { postType, postId };
  }, [recordContext]);

  if (bundleError) {
    return (
      <div className="native-editor native-editor--error">
        <p>Failed to load editor: {bundleError.message}</p>
      </div>
    );
  }

  if (!editorBundle) {
    return (
      <div className="native-editor native-editor--loading">
        <p>Loading editor…</p>
      </div>
    );
  }

  return (
    <EditorRecordProvider value={recordContext}>
      <BlockEditorProvider
        value={blocks}
        onInput={handleInput}
        onChange={handleChange}
        settings={editorSettings}
      >
        <AssistantSelectionBridge />
        <InspectorSelectionBridge onChange={handleBridgedSelection} />
        <NativeLinkViewerActions
          currentPath={routerLocation.pathname}
          resolveInternalLink={resolveInternalLink}
          routeTarget={routeTarget}
        />
        <div className="native-editor">
        <BlockEditorKeyboardShortcuts />
        <BlockTools className="native-editor__block-tools">
          <div
            className={`native-editor__layout${sidebarOpen ? '' : ' native-editor__layout--no-sidebar'}${inserterOpen ? ' native-editor__layout--with-inserter' : ''}`}
          >
            {inserterOpen ? (
              <NativeInserterPanel
                onSelect={() => setInserterOpen(false)}
                onClose={() => setInserterOpen(false)}
              />
            ) : null}
            <section className="native-editor__main">
              <div className="native-editor__canvas-shell">
                <div className={`native-editor__canvas native-editor__canvas--${canvasLayout === 'template' ? 'template' : 'content'}`}>
                  <RouterBlockEditorCanvas
                    canvasLayout={canvasLayout}
                    canvasStyles={canvasStyles}
                    getBlockFromNode={getBlockFromNode}
                    locationKey={routerLocation.key}
                    registerCanvasScrollReader={(reader) => {
                      canvasScrollReaderRef.current = reader;
                    }}
                    recordContextValue={recordContextValue}
                    pathname={routerLocation.pathname}
                    resolveInternalLinkRef={resolveInternalLinkRef}
                    routeTarget={routeTarget}
                    setSelectedLinkedTarget={setSelectedLinkedTarget}
                    selectBlock={selectBlock}
                    undoRef={undoRef}
                    redoRef={redoRef}
                  />
                </div>
                {showEmptyPatternPicker
                  && emptyPickerEnabled
                  && !emptyPickerDismissedSession
                  && (!Array.isArray(blocks) || blocks.length === 0) ? (
                    <EmptyPagePatternPicker
                      onApply={(nextBlocks) => {
                        handleChange(nextBlocks);
                        setEmptyPickerDismissedSession(true);
                      }}
                      onDismiss={() => {
                        setEmptyPickerDismissedSession(true);
                        setEmptyPickerEnabled(readEmptyPagePickerEnabled());
                      }}
                    />
                  ) : null}
                {activeLinkedTarget?.resolution?.adminPath || getLinkHref(activeLinkedTarget) ? (
                  <div className="native-editor__linked-target-actions" role="status" aria-live="polite">
                    <div className="native-editor__linked-target-copy">
                      <span className="native-editor__linked-target-icon" aria-hidden="true"><Link size={16} /></span>
                      <span className="native-editor__linked-target-eyebrow">Linked</span>
                      <strong className="native-editor__linked-target-title">
                        {getLinkDisplayLabel(activeLinkedTarget)}
                      </strong>
                    </div>

                    {isEditableLinkBlock ? (
                      <div className="native-editor__link-editor">
                        <input
                          type="url"
                          className="native-editor__link-editor__input"
                          value={linkEditorUrl}
                          placeholder="https://"
                          onChange={(e) => setLinkEditorUrl(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyLinkEdit(); } }}
                        />
                        <button
                          type="button"
                          className={`native-editor__link-editor__newtab${linkEditorNewTab ? ' is-active' : ''}`}
                          onClick={() => setLinkEditorNewTab((v) => !v)}
                          title="Open in new tab"
                        >
                          New tab
                        </button>
                        <Button className="native-editor__link-editor__apply" onClick={applyLinkEdit}>
                          Apply
                        </Button>
                      </div>
                    ) : (
                      <div className="native-editor__linked-target-buttons">
                        {canSwitchNavigationLink ? (
                          <>
                            <Button
                              ref={linkSwitcherButtonRef}
                              className="native-editor__linked-target-edit"
                              variant="secondary"
                              onClick={() => setIsLinkSwitcherOpen((open) => !open)}
                            >
                              Switch link
                            </Button>
                            {isLinkSwitcherOpen ? (
                              <Popover
                                anchor={linkSwitcherButtonRef.current}
                                className="native-editor__linked-target-popover"
                                placement="top-start"
                                offset={10}
                                onClose={() => setIsLinkSwitcherOpen(false)}
                              >
                                <div className="native-editor__linked-target-popover-body">
                                  <LinkControl
                                    value={navigationLinkControlValue}
                                    onChange={handleNavigationLinkChange}
                                    forceIsEditingLink={true}
                                  />
                                </div>
                              </Popover>
                            ) : null}
                          </>
                        ) : null}
                        {activeLinkedTarget?.resolution?.adminPath && activeLinkedTarget.resolution.adminPath !== routerLocation.pathname ? (
                          <Button
                            className="native-editor__linked-target-edit"
                            variant="secondary"
                            onClick={() => routeTarget(activeLinkedTarget)}
                          >
                            {getEditorActionLabel(activeLinkedTarget.resolution, routerLocation.pathname)}
                          </Button>
                        ) : null}
                        {getLinkHref(activeLinkedTarget) && !getLinkHref(activeLinkedTarget).startsWith('#') ? (
                          <Tooltip text="View on site">
                            <Button
                              className="native-editor__linked-target-view"
                              onClick={() => routeTarget(activeLinkedTarget, { newTab: true })}
                              aria-label="View on site"
                            >
                              <Launch size={14} />
                            </Button>
                          </Tooltip>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
              <footer className="native-editor__footer">
                <BlockBreadcrumb rootLabelText={documentLabel} />
              </footer>
            </section>

            {sidebarOpen ? (
              <aside className="native-editor__sidebar" aria-label="Inspector sidebar">
                <div className="native-editor__sidebar-header">
                  <div
                    className="native-editor__sidebar-tablist"
                    role="tablist"
                    aria-label="Inspector sections"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={inspectorTab === 'document'}
                      className={`native-editor__sidebar-tab${inspectorTab === 'document' ? ' is-active' : ''}`}
                      onClick={() => setInspectorTab('document')}
                    >
                      {documentLabel}
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={inspectorTab === 'block'}
                      className={`native-editor__sidebar-tab${inspectorTab === 'block' ? ' is-active' : ''}`}
                      onClick={() => setInspectorTab('block')}
                    >
                      Block
                    </button>
                  </div>
                  <button
                    type="button"
                    className="native-editor__sidebar-close"
                    onClick={() => setSidebarOpen(false)}
                    aria-label="Close sidebar"
                  >
                    <CarbonIcon name="Close" size={16} />
                  </button>
                </div>
                <div className="native-editor__sidebar-body">
                  {inspectorTab === 'document' ? (
                    <div className="native-editor__document-sidebar">
                      {documentSidebar}
                    </div>
                  ) : (
                    <div className="native-editor__block-sidebar">
                      <NativeBlockInspector blockSidebarFooter={blockSidebarFooter} />
                    </div>
                  )}
                </div>
              </aside>
            ) : null}
          </div>
        </BlockTools>
        </div>
        <Popover.Slot />
      </BlockEditorProvider>
    </EditorRecordProvider>
  );
}
