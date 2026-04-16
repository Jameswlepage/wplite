import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BlockBreadcrumb,
  BlockCanvas,
  BlockEditorKeyboardShortcuts,
  BlockEditorProvider,
  BlockInspector,
  BlockToolbar,
  BlockTools,
  __experimentalLibrary as InserterLibrary,
} from '@wordpress/block-editor';
import {
  Button,
  DropdownMenu,
  PanelBody,
  Popover,
  TabPanel,
} from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { useLocation } from 'react-router-dom';
import { CarbonIcon } from '../lib/icons.jsx';
import { apiFetch } from '../lib/helpers.js';
import {
  buildBlockEditorSettings,
  buildCanvasStyles,
  registerServerBlockTypes,
} from '../lib/blocks.jsx';
import { useRegisterEditorChrome } from './workspace-context.jsx';
import { useAssistant } from './assistant-provider.jsx';

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
let cachedEditorBundlePromise = null;

function loadEditorBundle() {
  if (!cachedEditorBundlePromise) {
    cachedEditorBundlePromise = apiFetch('editor-bundle')
      .then((bundle) => {
        registerServerBlockTypes(bundle?.blockTypes ?? []);
        return bundle;
      })
      .catch((error) => {
        cachedEditorBundlePromise = null;
        throw error;
      });
  }
  return cachedEditorBundlePromise;
}

/* ── Icon wrappers for WP Button/DropdownMenu icon props ── */
const BackIcon = () => <CarbonIcon name="ArrowLeft" size={20} />;
const AddIcon = () => <CarbonIcon name="Add" size={20} />;
const CloseIcon = () => <CarbonIcon name="Close" size={16} />;
const OverflowIcon = () => <CarbonIcon name="OverflowMenuVertical" size={20} />;
const LaunchIcon = () => <CarbonIcon name="Launch" size={16} />;
const SidebarCloseIcon = () => <CarbonIcon name="SidePanelClose" size={20} />;
const SidebarOpenIcon = () => <CarbonIcon name="SidePanelOpen" size={20} />;

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

function unwrapAnchor(anchor) {
  const parent = anchor.parentNode;
  while (anchor.firstChild) {
    parent.insertBefore(anchor.firstChild, anchor);
  }
  parent.removeChild(anchor);
}

function buildUpdatedLinkAttributes(block, source, nextHref) {
  if (!block || !source) return null;
  const attributes = block.attributes ?? {};

  if (source.type === 'attribute') {
    return { [source.key]: nextHref ?? '' };
  }

  if (source.type === 'html' && typeof attributes[source.key] === 'string') {
    const htmlLink = extractHtmlLinkSource(attributes[source.key], source.href);
    if (!htmlLink) return null;

    if (nextHref) {
      htmlLink.anchor.setAttribute('href', nextHref);
    } else {
      unwrapAnchor(htmlLink.anchor);
    }

    return { [source.key]: htmlLink.container.innerHTML };
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
  resolveInternalLink = null,
  onOpenInternalLink = null,
}) {
  const [editorBundle, setEditorBundle] = useState(null);
  const [bundleError, setBundleError] = useState(null);
  const canvasRef = useRef(null);
  const linkCardRef = useRef(null);
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

  const selectedBlockId = useSelect(
    (select) => select(blockEditorStore).getSelectedBlockClientId(),
    []
  );
  const selectedBlock = useSelect(
    (select) => (selectedBlockId ? select(blockEditorStore).getBlock(selectedBlockId) : null),
    [selectedBlockId]
  );
  const [inspectorTab, setInspectorTab] = useState(selectedBlockId ? 'block' : 'document');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inserterOpen, setInserterOpen] = useState(false);
  const [linkState, setLinkState] = useState(null);
  const [linkPeek, setLinkPeek] = useState(null);
  const linkPeekRef = useRef(null);

  // Refs to avoid re-binding the iframe click listener on every keystroke.
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
    onChangeBlocks?.(nextBlocks);
  }, [onChangeBlocks]);

  const handleChange = useCallback((nextBlocks) => {
    const history = historyRef.current;
    if (history.last !== nextBlocks) {
      history.past.push(history.last);
      if (history.past.length > 100) history.past.shift();
      history.future.length = 0;
      history.last = nextBlocks;
    }
    onChangeBlocks?.(nextBlocks);
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

  useEffect(() => {
    if (!selectedBlockId) setLinkState(null);
  }, [selectedBlockId]);
  // `linkState` is only used for edit-link state (prompt + remove). It is
  // no longer populated from clicks — clicks navigate directly via the
  // iframe listener above. The selected-block card in the footer renders
  // from `selectedLink` derived purely from selection.

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let frameCleanup = () => {};
    let observer = null;

    function bindToFrame(iframe) {
      frameCleanup();

      let hrefGuardObserver = null;

      function neutralizeAnchor(anchor) {
        if (!anchor || anchor.__wpliteNeutralized) return;
        // Make bypassed clicks inert rather than forcing target=_blank.
        // A forced _blank with an unresolvable href (e.g. "#" inside a
        // srcdoc iframe resolves to about:srcdoc#, which Chrome renders
        // as a "Can't open this page" error) would open a broken tab.
        // Keeping the click same-tab just means a no-op scroll on "#".
        const rel = (anchor.getAttribute('rel') || '').split(/\s+/).filter(Boolean);
        if (!rel.includes('noopener')) rel.push('noopener');
        if (!rel.includes('noreferrer')) rel.push('noreferrer');
        anchor.setAttribute('rel', rel.join(' '));
        anchor.__wpliteNeutralized = true;
      }

      function scanAnchors(root) {
        if (!root || typeof root.querySelectorAll !== 'function') return;
        if (root.tagName === 'A' && root.hasAttribute?.('href')) {
          neutralizeAnchor(root);
        }
        root.querySelectorAll('a[href]').forEach(neutralizeAnchor);
      }

      function bindFrameListeners() {
        const frameDoc = iframe.contentDocument;
        if (!frameDoc) return;

        // Neutralize anchors now + watch for new/changed ones.
        scanAnchors(frameDoc.body);
        if (hrefGuardObserver) hrefGuardObserver.disconnect();
        hrefGuardObserver = new MutationObserver((mutations) => {
          for (const m of mutations) {
            if (m.type === 'childList') {
              m.addedNodes.forEach((node) => {
                if (node.nodeType === 1) scanAnchors(node);
              });
            } else if (m.type === 'attributes' && m.target?.tagName === 'A') {
              m.target.__wpliteNeutralized = false;
              neutralizeAnchor(m.target);
            }
          }
        });
        hrefGuardObserver.observe(frameDoc.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['target', 'rel', 'href'],
        });

        // Canonical href: always prefer the raw `href` attribute and resolve
        // it against the parent admin origin — NEVER the iframe's own
        // resolved `anchor.href`, which inside a srcdoc iframe comes back as
        // `about:srcdoc/...` and trips Chrome's ERR_FILE_NOT_FOUND (code 6).
        function getCanonicalHref(anchor) {
          if (!anchor) return '';
          const raw = anchor.getAttribute('href');
          if (!raw) return '';
          const trimmed = String(raw).trim();
          if (!trimmed || trimmed.startsWith('#')) return trimmed;
          // Leave mailto:, tel:, javascript:, data:, http(s), and any other
          // absolute scheme intact.
          if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
          // Relative URL → resolve against the admin origin so window.open
          // and the internal-link resolver both see a usable absolute URL.
          try {
            return new URL(trimmed, window.location.origin).toString();
          } catch {
            return trimmed;
          }
        }

        function resolveInteractiveTarget(target) {
          if (!target || typeof target.closest !== 'function') return null;

          const anchor = target.closest('a[href]');
          const block = getBlockFromNode(target);
          const blockHints = extractBlockTargetHints(block) ?? {};
          const taggedRecord = target.closest('[data-wplite-post-id]');
          const postId = Number.parseInt(
            taggedRecord?.getAttribute?.('data-wplite-post-id') || '',
            10
          );
          const postType = String(
            taggedRecord?.getAttribute?.('data-wplite-post-type') || ''
          ).trim();
          const href = anchor ? getCanonicalHref(anchor) : '';
          const resolverInput = {
            ...blockHints,
            ...(Number.isFinite(postId) && postId > 0 ? { postId } : {}),
            ...(postType ? { postType } : {}),
            ...(href && !href.startsWith('#') ? { href } : {}),
          };
          const resolution = resolveInternalLinkRef.current?.(resolverInput) ?? null;

          if (!resolution && !resolverInput.href) {
            return null;
          }

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
            node: anchor || taggedRecord || target.closest('[data-block]') || target,
            anchor: anchor || null,
            clientId: getBlockClientIdFromNode(target),
          };
        }

        function selectContainingBlock(node) {
          const clientId = getBlockClientIdFromNode(node);
          if (clientId) selectBlock(clientId);
        }

        function openResolvedTarget(targetInfo, { newTab = false } = {}) {
          const href = getLinkHref(targetInfo);
          if (!href && !targetInfo?.resolution?.adminPath) {
            return;
          }

          if (newTab) {
            if (href) {
              try { window.open(href, '_blank', 'noopener,noreferrer'); } catch {}
            }
            return;
          }

          const openHandler = onOpenInternalLinkRef.current;
          const currentPath = currentAdminPathRef.current || '';
          if (targetInfo?.resolution?.adminPath && typeof openHandler === 'function') {
            if (targetInfo.resolution.adminPath === currentPath) {
              if (targetInfo?.node) {
                selectContainingBlock(targetInfo.node);
              }
              return;
            }
            openHandler(targetInfo.resolution.adminPath);
            return;
          }

          if (!href.startsWith('#')) {
            try { window.open(href, '_blank', 'noopener,noreferrer'); } catch {}
          }
        }

        function handleLinkActivation(event) {
          const isPrimaryButton = event.button === 0 || event.button === undefined;
          const isMiddleButton = event.type === 'auxclick' && event.button === 1;
          if (!isPrimaryButton && !isMiddleButton) return;

          const targetInfo = resolveInteractiveTarget(event.target);
          const anchor = event.target.closest?.('a[href]');
          if (anchor || targetInfo) {
            // The iframe must never navigate away from the editor, and
            // frontend/theme runtime click handlers inside the frame must not
            // receive the event. Selection/follow behavior is handled here.
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation?.();
          }

          if (!targetInfo) {
            if (anchor) {
              selectContainingBlock(anchor);
            }
            return;
          }

          if (isMiddleButton || event.metaKey || event.ctrlKey) {
            openResolvedTarget(targetInfo, { newTab: true });
            return;
          }

          if (event.altKey || event.shiftKey) {
            if (targetInfo.node) {
              selectContainingBlock(targetInfo.node);
            }
            return;
          }

          if (event.detail >= 2) {
            openResolvedTarget(targetInfo);
            return;
          }

          if (targetInfo.node) {
            selectContainingBlock(targetInfo.node);
          }
        }

        // ── Hover peek ─────────────────────────────────────────────────
        // Show a floating action card anchored to hovered links/query items
        // so authors can jump straight to the linked object editor.
        let peekTimer = null;
        function positionPeek(targetInfo) {
          const iframeRect = iframe.getBoundingClientRect();
          const anchorRect = targetInfo.node.getBoundingClientRect();
          setLinkPeek({
            href: targetInfo.href || targetInfo.resolution?.href || '',
            text: targetInfo.text || '',
            resolution: targetInfo.resolution,
            top: iframeRect.top + anchorRect.top - 6,
            left: iframeRect.left + anchorRect.right + 8,
          });
        }

        function handleMouseOver(event) {
          const targetInfo = resolveInteractiveTarget(event.target);
          if (!targetInfo?.href && !targetInfo?.resolution?.adminPath) return;
          if (peekTimer) clearTimeout(peekTimer);
          positionPeek(targetInfo);
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

        function handleMouseOut(event) {
          const fromTarget = resolveInteractiveTarget(event.target);
          if (!fromTarget?.node) return;

          const toTarget = resolveInteractiveTarget(event.relatedTarget);
          if (toTarget?.node === fromTarget.node) {
            return;
          }

          if (peekTimer) clearTimeout(peekTimer);
          peekTimer = setTimeout(() => setLinkPeek(null), 140);
        }

        frameDoc.addEventListener('click', handleLinkActivation, true);
        frameDoc.addEventListener('auxclick', handleLinkActivation, true);
        frameDoc.addEventListener('mouseover', handleMouseOver, true);
        frameDoc.addEventListener('mouseout', handleMouseOut, true);
        frameDoc.addEventListener('keydown', handleHistoryKeydown, true);

        frameCleanup = () => {
          frameDoc.removeEventListener('click', handleLinkActivation, true);
          frameDoc.removeEventListener('auxclick', handleLinkActivation, true);
          frameDoc.removeEventListener('mouseover', handleMouseOver, true);
          frameDoc.removeEventListener('mouseout', handleMouseOut, true);
          frameDoc.removeEventListener('keydown', handleHistoryKeydown, true);
          if (peekTimer) clearTimeout(peekTimer);
          if (hrefGuardObserver) hrefGuardObserver.disconnect();
        };
      }

      // Always listen for 'load' — Gutenberg's Iframe may call
      // document.open()/write()/close() which wipes listeners attached to
      // the prior document. Re-binding on each load is required.
      const handleLoad = () => bindFrameListeners();
      iframe.addEventListener('load', handleLoad);

      // If already loaded, bind immediately — the 'load' listener above
      // also re-binds on any future navigation/reload.
      if (iframe.contentDocument?.readyState === 'complete') {
        bindFrameListeners();
      }

      const existing = frameCleanup;
      frameCleanup = () => {
        existing();
        iframe.removeEventListener('load', handleLoad);
      };
    }

    function connect() {
      const iframe = canvas.querySelector('iframe');
      if (!iframe) return false;
      bindToFrame(iframe);
      return true;
    }

    if (!connect()) {
      observer = new MutationObserver(() => {
        if (connect()) {
          observer.disconnect();
          observer = null;
        }
      });
      observer.observe(canvas, { childList: true, subtree: true });
    }

    return () => {
      frameCleanup();
      observer?.disconnect();
    };
    // Stable deps — refs carry the latest resolver/callback/blocks.
  }, [getBlockFromNode, selectBlock]);

  useEffect(() => {
    if (!linkState) return undefined;

    function handlePointerDown(event) {
      if (linkCardRef.current?.contains(event.target)) {
        return;
      }
      setLinkState(null);
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setLinkState(null);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [linkState]);

  const selectedLink = useMemo(() => {
    if (linkState && linkState.clientId === selectedBlockId) {
      return linkState;
    }

    const primaryLink = extractPrimaryLink(selectedBlock);
    const blockHints = extractBlockTargetHints(selectedBlock);
    if (!primaryLink && !blockHints) {
      return null;
    }

    const resolutionInput = {
      ...(blockHints ?? {}),
      ...(primaryLink?.href ? { href: primaryLink.href } : {}),
    };
    const resolution = resolveInternalLink?.(resolutionInput) ?? null;
    const editableSource = primaryLink?.href && selectedBlock
      ? resolveEditableLinkSource(selectedBlock, primaryLink.href)
      : null;

    return {
      ...resolutionInput,
      href: primaryLink?.href || resolution?.href || '',
      text:
        primaryLink?.text
        || selectedBlock?.attributes?.label
        || selectedBlock?.attributes?.text
        || selectedBlock?.attributes?.title
        || '',
      clientId: selectedBlockId,
      source: editableSource
        ? { ...editableSource, href: primaryLink.href }
        : null,
      resolution,
      cardPosition: null,
    };
  }, [linkState, resolveInternalLink, selectedBlock, selectedBlockId]);

  function focusLinkedBlock(target = selectedLink) {
    const clientId = getLinkedBlockClientId(target);
    if (!clientId) return false;
    selectBlock(clientId);
    return true;
  }

  function openLinkTarget(target = selectedLink) {
    const href = getLinkHref(target);
    if (!href && !target?.resolution?.adminPath) return;
    const currentPath = currentAdminPathRef.current || '';
    const openHandler = onOpenInternalLinkRef.current || onOpenInternalLink;
    if (target.resolution?.adminPath && typeof openHandler === 'function') {
      if (target.resolution.adminPath === currentPath && focusLinkedBlock(target)) {
        return;
      }
      openHandler(target.resolution.adminPath);
      return;
    }
    window.open(href, '_blank', 'noopener,noreferrer');
  }

  function viewLinkTarget(target = selectedLink) {
    const href = getLinkHref(target);
    if (!href) return;
    window.open(href, '_blank', 'noopener,noreferrer');
  }

  async function copyLinkTarget(target = selectedLink) {
    const href = getLinkHref(target);
    if (!href) return;
    await navigator.clipboard.writeText(href);
  }

  function editLinkTarget(target = selectedLink) {
    if (!target?.clientId || !target?.source) return;
    const block = findBlockByClientId(blocks, target.clientId);
    if (!block) return;

    const nextHref = window.prompt('Edit link', getLinkHref(target));
    if (typeof nextHref !== 'string') return;

    const updated = buildUpdatedLinkAttributes(block, target.source, nextHref.trim());
    if (!updated) return;

    updateBlockAttributes(target.clientId, updated);
    setLinkState((current) => current ? ({
      ...current,
      href: nextHref.trim(),
      resolution: resolveInternalLink?.({
        ...(extractBlockTargetHints(block) ?? {}),
        href: nextHref.trim(),
      }) ?? null,
    }) : current);
  }

  function removeLinkTarget(target = selectedLink) {
    if (!target?.clientId || !target?.source) return;
    const block = findBlockByClientId(blocks, target.clientId);
    if (!block) return;

    const updated = buildUpdatedLinkAttributes(block, target.source, null);
    if (!updated) return;

    updateBlockAttributes(target.clientId, updated);
    setLinkState(null);
  }

  const canvasStyles = useMemo(
    () => buildCanvasStyles(editorBundle),
    [editorBundle]
  );

  const editorSettings = useMemo(
    () => buildBlockEditorSettings(editorBundle),
    [editorBundle]
  );

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
    <BlockEditorProvider
      value={blocks}
      onInput={handleInput}
      onChange={handleChange}
      settings={editorSettings}
    >
      <AssistantSelectionBridge />
      <div className="native-editor">
        <BlockEditorKeyboardShortcuts />
        <BlockTools className="native-editor__block-tools">
          <div
            className={`native-editor__layout${sidebarOpen ? '' : ' native-editor__layout--no-sidebar'}${inserterOpen ? ' native-editor__layout--with-inserter' : ''}`}
          >
            {inserterOpen ? (
              <aside className="native-editor__inserter-panel">
                <div className="native-editor__inserter-panel-body">
                  <InserterLibrary
                    showInserterHelpPanel={false}
                    onSelect={() => setInserterOpen(false)}
                  />
                </div>
              </aside>
            ) : null}
            <section className="native-editor__main">
              <div className="native-editor__canvas-shell">
                <div
                  ref={canvasRef}
                  className={`native-editor__canvas native-editor__canvas--${canvasLayout === 'template' ? 'template' : 'content'}`}
                >
                  <BlockCanvas height="100%" styles={canvasStyles} />
                </div>
              </div>
              <footer className="native-editor__footer">
                <BlockBreadcrumb rootLabelText={documentLabel} />
                {selectedLink ? (
                  <div className="native-editor__footer-actions">
                    <span className="native-editor__footer-link-meta">
                      {getLinkDisplayLabel(selectedLink)}
                    </span>
                    <button type="button" className="native-editor__footer-action" onClick={() => openLinkTarget(selectedLink)}>
                      {getEditorActionLabel(selectedLink.resolution, currentAdminPathRef.current)}
                    </button>
                    {selectedLink.resolution?.adminPath ? (
                      <button type="button" className="native-editor__footer-action" onClick={() => viewLinkTarget(selectedLink)}>
                        View
                      </button>
                    ) : null}
                    <button type="button" className="native-editor__footer-action" onClick={() => copyLinkTarget(selectedLink)}>
                      Copy
                    </button>
                    {selectedLink.source ? (
                      <>
                        <button type="button" className="native-editor__footer-action" onClick={() => editLinkTarget(selectedLink)}>
                          Edit
                        </button>
                        <button type="button" className="native-editor__footer-action" onClick={() => removeLinkTarget(selectedLink)}>
                          Remove
                        </button>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </footer>
            </section>

            {sidebarOpen ? (
              <aside className="native-editor__sidebar">
                <TabPanel
                  className="native-editor__inspector-tabs"
                  activeClass="is-active"
                  initialTabName={inspectorTab}
                  onSelect={setInspectorTab}
                  tabs={[
                    { name: 'document', title: documentLabel },
                    { name: 'block', title: 'Block' },
                  ]}
                >
                  {(tab) => (
                    <div className="native-editor__inspector-panel">
                      {tab.name === 'document' ? (
                        <div className="native-editor__document-sidebar">
                          {documentSidebar}
                        </div>
                      ) : (
                        <div className="native-editor__block-sidebar">
                          {selectedBlockId ? (
                            <>
                              <BlockInspector />
                              {blockSidebarFooter ? (
                                <PanelBody title="Actions" initialOpen={true}>
                                  {blockSidebarFooter}
                                </PanelBody>
                              ) : null}
                            </>
                          ) : (
                            <div className="native-editor__block-sidebar-empty">
                              <div className="native-editor__block-sidebar-empty-icon" aria-hidden="true">
                                <CarbonIcon name="Edit" size={20} />
                              </div>
                              <p className="native-editor__block-sidebar-empty-title">No block selected</p>
                              <p className="native-editor__block-sidebar-empty-hint">
                                Click a block in the canvas to edit its settings, or pick one from the inserter.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </TabPanel>
                <button
                  type="button"
                  className="native-editor__sidebar-close"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Close sidebar"
                >
                  <CarbonIcon name="Close" size={16} />
                </button>
              </aside>
            ) : null}
          </div>
        </BlockTools>
      </div>
      {linkPeek ? (
        <div
          ref={linkPeekRef}
          className="native-editor__link-peek"
          style={{ top: `${linkPeek.top}px`, left: `${linkPeek.left}px` }}
          onMouseEnter={() => { /* keep open */ }}
          onMouseLeave={() => setLinkPeek(null)}
        >
          <div className="native-editor__link-peek-card">
            <div className="native-editor__link-peek-meta">
              <span className="native-editor__link-peek-eyebrow">
                {linkPeek.resolution?.modelLabel || 'Link'}
              </span>
              <strong className="native-editor__link-peek-title">
                {getLinkDisplayLabel(linkPeek)}
              </strong>
            </div>
            <div className="native-editor__link-peek-actions">
              <button
                type="button"
                className="native-editor__link-peek-btn native-editor__link-peek-btn--primary"
                onClick={() => {
                  openLinkTarget(linkPeek);
                  setLinkPeek(null);
                }}
                title={getEditorActionTitle(linkPeek, currentAdminPathRef.current)}
              >
                <CarbonIcon name={linkPeek.resolution?.adminPath ? 'ArrowRight' : 'Launch'} size={14} />
                <span>{getEditorActionLabel(linkPeek.resolution, currentAdminPathRef.current)}</span>
              </button>
              {linkPeek.resolution?.adminPath ? (
                <button
                  type="button"
                  className="native-editor__link-peek-btn"
                  onClick={() => {
                    viewLinkTarget(linkPeek);
                    setLinkPeek(null);
                  }}
                  title={`Open ${linkPeek.href} in new tab`}
                >
                  <CarbonIcon name="Launch" size={14} />
                  <span>View</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      <Popover.Slot />
    </BlockEditorProvider>
  );
}
