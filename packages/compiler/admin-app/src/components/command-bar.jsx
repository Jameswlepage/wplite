import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Spinner } from '@wordpress/components';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  buildCommandPaletteIndex,
  buildEmptyCommandPaletteSections,
  groupCommandPaletteItems,
  loadRecentCommandIds,
  rememberRecentCommand,
  searchCommandPaletteItems,
} from '../lib/command-bar.js';
import {
  formatDateTime,
  normalizeCommentRecord,
  normalizeMediaRecord,
  normalizeUserRecord,
  wpApiFetch,
} from '../lib/helpers.js';
import { CarbonIcon } from '../lib/icons.jsx';

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable || target.closest('[contenteditable="true"]')) {
    return true;
  }

  if (target.closest('input, textarea, select')) {
    return true;
  }

  return Boolean(
    target.closest(
      '.block-editor-rich-text__editable, .editor-post-title__input, .components-input-control__input'
    )
  );
}

function buildRemoteUserItem(user) {
  return {
    id: `remote:user:${user.id}`,
    kind: 'remote',
    group: 'People',
    title: user.displayName || user.name || user.username || `User ${user.id}`,
    subtitle: [user.username ? `@${user.username}` : '', user.email].filter(Boolean).join(' • '),
    path: `/users/${user.id}`,
    iconName: 'User',
    keywords: ['user', 'person', user.username, user.email],
    priority: 320,
  };
}

function buildRemoteMediaItem(media) {
  return {
    id: `remote:media:${media.id}`,
    kind: 'remote',
    group: 'Media',
    title: media.title || 'Untitled media item',
    subtitle: [media.mimeType || 'Media', formatDateTime(media.modified)].filter(Boolean).join(' • '),
    path: `/media/${media.id}`,
    iconName: 'Image',
    keywords: ['media', 'asset', media.mimeType, media.altText],
    priority: 300,
  };
}

function buildRemoteCommentItem(comment) {
  return {
    id: `remote:comment:${comment.id}`,
    kind: 'remote',
    group: 'Comments',
    title: comment.excerpt || `Comment by ${comment.authorName || 'Anonymous'}`,
    subtitle: [comment.authorName || 'Anonymous', comment.postTitle].filter(Boolean).join(' • '),
    path: `/comments/${comment.id}`,
    iconName: 'Chat',
    keywords: ['comment', 'discussion', comment.authorName, comment.postTitle, comment.contentText],
    priority: 280,
  };
}

async function fetchRemoteSearchResults(query, signal, { commentsEnabled = false } = {}) {
  const params = new URLSearchParams({
    search: query,
    per_page: '5',
    context: 'edit',
  });
  const commentParams = new URLSearchParams({
    search: query,
    per_page: '5',
    context: 'edit',
    status: 'all',
    _embed: 'up',
  });

  const requests = [
    wpApiFetch(`wp/v2/users?${params.toString()}`, { signal }),
    wpApiFetch(`wp/v2/media?${params.toString()}`, { signal }),
    commentsEnabled
      ? wpApiFetch(`wp/v2/comments?${commentParams.toString()}`, { signal })
      : Promise.resolve([]),
  ];

  const [users, media, comments] = await Promise.allSettled(requests);
  const items = [];
  let error = null;

  if (users.status === 'fulfilled') {
    items.push(...users.value.map(normalizeUserRecord).map(buildRemoteUserItem));
  } else {
    error = users.reason?.message || 'User search failed.';
  }

  if (media.status === 'fulfilled') {
    items.push(...media.value.map(normalizeMediaRecord).map(buildRemoteMediaItem));
  } else if (!error) {
    error = media.reason?.message || 'Media search failed.';
  }

  if (comments.status === 'fulfilled') {
    items.push(...comments.value.map(normalizeCommentRecord).map(buildRemoteCommentItem));
  } else if (!error) {
    error = comments.reason?.message || 'Comment search failed.';
  }

  return { items, error };
}

function CommandBarItem({ item, active, onSelect, onHover }) {
  return (
    <button
      type="button"
      className={active ? 'command-bar__item is-active' : 'command-bar__item'}
      onMouseEnter={onHover}
      onMouseDown={(event) => {
        event.preventDefault();
        onSelect();
      }}
    >
      <span className="command-bar__item-icon">
        <CarbonIcon name={item.iconName || 'Document'} size={18} />
      </span>
      <span className="command-bar__item-body">
        <span className="command-bar__item-title">{item.title}</span>
        {item.subtitle ? (
          <span className="command-bar__item-subtitle">{item.subtitle}</span>
        ) : null}
      </span>
      {item.openInNewTab ? (
        <span className="command-bar__item-meta">
          <CarbonIcon name="ArrowUpRight" size={16} />
        </span>
      ) : null}
    </button>
  );
}

export function CommandBar({
  bootstrap,
  recordsByModel,
  isOpen,
  onOpen,
  onClose,
  closeMobileSidebar,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef(null);
  const cacheRef = useRef(new Map());
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentIds, setRecentIds] = useState(() => loadRecentCommandIds());
  const [remoteResults, setRemoteResults] = useState([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState(null);

  const indexedItems = useMemo(
    () => buildCommandPaletteIndex({ bootstrap, recordsByModel }),
    [bootstrap, recordsByModel]
  );
  const commentsEnabled = bootstrap?.site?.commentsEnabled === true;
  const hasPosts = Boolean((bootstrap?.models ?? []).find((model) => model?.id === 'post'));
  const placeholder = useMemo(() => {
    const surfaces = ['pages'];
    if (hasPosts) {
      surfaces.push('posts');
    }
    surfaces.push('media', 'users');
    if (commentsEnabled) {
      surfaces.push('comments');
    }
    return `Search ${surfaces.join(', ')}, or type > for commands`;
  }, [commentsEnabled, hasPosts]);

  const commandsOnly = query.trim().startsWith('>');
  const searchQuery = commandsOnly ? query.trim().slice(1).trim() : query.trim();

  useEffect(() => {
    function handleGlobalShortcut(event) {
      if ((event.metaKey || event.ctrlKey) && String(event.key).toLowerCase() === 'k') {
        if (isEditableTarget(event.target)) {
          return;
        }
        event.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          onOpen();
        }
      }
    }

    window.addEventListener('keydown', handleGlobalShortcut);
    return () => window.removeEventListener('keydown', handleGlobalShortcut);
  }, [isOpen, onClose, onOpen]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setRemoteResults([]);
      setRemoteError(null);
      setRemoteLoading(false);
      return;
    }

    const handle = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(handle);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || commandsOnly || searchQuery.length < 2) {
      setRemoteResults([]);
      setRemoteLoading(false);
      setRemoteError(null);
      return;
    }

    const cacheKey = searchQuery.toLowerCase();
    if (cacheRef.current.has(cacheKey)) {
      const cached = cacheRef.current.get(cacheKey);
      setRemoteResults(cached.items);
      setRemoteError(cached.error);
      setRemoteLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setRemoteLoading(true);
      try {
        const next = await fetchRemoteSearchResults(searchQuery, controller.signal, { commentsEnabled });
        if (controller.signal.aborted) {
          return;
        }
        cacheRef.current.set(cacheKey, next);
        setRemoteResults(next.items);
        setRemoteError(next.error);
      } catch (error) {
        if (!controller.signal.aborted) {
          setRemoteResults([]);
          setRemoteError(error.message || 'Live search failed.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setRemoteLoading(false);
        }
      }
    }, 140);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [commandsOnly, commentsEnabled, isOpen, searchQuery]);

  const visibleSections = useMemo(() => {
    if (!searchQuery) {
      return buildEmptyCommandPaletteSections(indexedItems, recentIds, { commandsOnly });
    }

    const localResults = searchCommandPaletteItems(indexedItems, searchQuery, { commandsOnly });
    const deduped = new Map();

    for (const item of [...localResults, ...remoteResults]) {
      if (!deduped.has(item.id)) {
        deduped.set(item.id, item);
      }
    }

    const rankedItems = searchCommandPaletteItems([...deduped.values()], searchQuery, {
      commandsOnly,
      limit: 36,
    });

    return groupCommandPaletteItems(rankedItems);
  }, [commandsOnly, indexedItems, recentIds, remoteResults, searchQuery]);

  const flatItems = useMemo(
    () => visibleSections.flatMap((section) => section.items),
    [visibleSections]
  );
  const itemIndexMap = useMemo(
    () => new Map(flatItems.map((item, index) => [item.id, index])),
    [flatItems]
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query, isOpen]);

  useEffect(() => {
    setActiveIndex((current) => {
      if (flatItems.length === 0) {
        return 0;
      }
      return Math.min(current, flatItems.length - 1);
    });
  }, [flatItems.length]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setRecentIds(loadRecentCommandIds());
  }, [isOpen, location.key]);

  function executeItem(item) {
    if (!item) {
      return;
    }

    if (item.id) {
      setRecentIds((current) => rememberRecentCommand(item.id, current));
    }

    onClose();
    closeMobileSidebar?.();

    if (item.path) {
      navigate(item.path);
      return;
    }

    if (item.href) {
      window.open(
        item.href,
        item.openInNewTab ? '_blank' : '_self',
        item.openInNewTab ? 'noopener,noreferrer' : undefined
      );
    }
  }

  function handleInputKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (flatItems.length > 0) {
        setActiveIndex((current) => (current + 1) % flatItems.length);
      }
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (flatItems.length > 0) {
        setActiveIndex((current) => (current - 1 + flatItems.length) % flatItems.length);
      }
      return;
    }

    if (event.key === 'Enter') {
      if (flatItems[activeIndex]) {
        event.preventDefault();
        executeItem(flatItems[activeIndex]);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      className="command-bar-modal"
      onRequestClose={onClose}
      title="Command Bar"
      __experimentalHideHeader={true}
    >
      <div className="command-bar">
        <div className="command-bar__search">
          <span className="command-bar__search-icon">
            <CarbonIcon name="Search" size={18} />
          </span>
          <input
            ref={inputRef}
            className="command-bar__input"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={placeholder}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>

        <div className="command-bar__results">
          {visibleSections.length === 0 ? (
            <div className="command-bar__empty">
              <h2>No results</h2>
              <p>
                {commandsOnly
                  ? 'No commands matched. Remove > to search content and live WordPress data too.'
                  : 'Try a title, slug, route, user, media item, or command name.'}
              </p>
            </div>
          ) : (
            visibleSections.map((section) => (
              <section key={section.label} className="command-bar__section">
                <header className="command-bar__section-header">{section.label}</header>
                <div className="command-bar__section-list" role="listbox" aria-label={section.label}>
                  {section.items.map((item) => {
                    const itemIndex = itemIndexMap.get(item.id) ?? 0;
                    return (
                      <CommandBarItem
                        key={item.id}
                        item={item}
                        active={itemIndex === activeIndex}
                        onHover={() => setActiveIndex(itemIndex)}
                        onSelect={() => executeItem(item)}
                      />
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>

        <footer className="command-bar__footer">
          <div className="command-bar__footer-hints">
            <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
            <span><kbd>↵</kbd> Open</span>
            <span><kbd>esc</kbd> Close</span>
            <span><kbd>&gt;</kbd> Commands only</span>
          </div>
          <div className="command-bar__footer-status">
            {remoteLoading ? (
              <span className="command-bar__status command-bar__status--loading">
                <Spinner />
                Searching WordPress
              </span>
            ) : null}
            {!remoteLoading && remoteError ? (
              <span className="command-bar__status command-bar__status--error">{remoteError}</span>
            ) : null}
          </div>
        </footer>
      </div>
    </Modal>
  );
  }
