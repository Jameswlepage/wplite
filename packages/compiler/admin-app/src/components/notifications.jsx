import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, DropdownMenu, Tooltip } from '@wordpress/components';
import {
  Notification as BellIcon,
  Checkmark,
  WarningAlt,
  Information,
  Close,
  OverflowMenuVertical,
  ArrowUp,
  NotificationOff,
} from '@carbon/icons-react';

const STORAGE_KEY = 'wplite-notifications';
const MAX_ITEMS = 50;

function loadFromStorage() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveToStorage(items) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    /* quota / private mode — ignore */
  }
}

function formatRelative(ts) {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  try {
    return new Date(ts).toLocaleDateString();
  } catch {
    return '';
  }
}

function statusIcon(status) {
  if (status === 'error') return <WarningAlt size={14} />;
  if (status === 'success') return <Checkmark size={14} />;
  return <Information size={14} />;
}

const OverflowIcon = () => <OverflowMenuVertical size={16} />;

export function useNotificationArchive() {
  const [notifications, setNotifications] = useState(() => loadFromStorage());

  useEffect(() => {
    saveToStorage(notifications);
  }, [notifications]);

  const archiveNotification = useCallback((entry) => {
    const item = {
      id: entry?.id ?? (Date.now() + Math.random()),
      status: entry?.status || 'info',
      message: entry?.message || '',
      timestamp: entry?.timestamp || Date.now(),
      read: false,
    };
    setNotifications((current) => [item, ...current].slice(0, MAX_ITEMS));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((current) => current.map((n) => ({ ...n, read: true })));
  }, []);

  const markNonErrorsRead = useCallback(() => {
    setNotifications((current) =>
      current.map((n) => (n.status === 'error' ? n : { ...n, read: true }))
    );
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return { notifications, archiveNotification, markAllRead, markNonErrorsRead, clearAll };
}

export function NotificationBell({ unreadCount = 0, isOpen = false, onClick }) {
  const tooltipText = unreadCount > 0
    ? `${unreadCount} new notification${unreadCount === 1 ? '' : 's'}`
    : 'Notifications';
  return (
    <Tooltip text={tooltipText}>
      <button
        type="button"
        className={`notification-bell${isOpen ? ' is-pressed' : ''}`}
        onClick={onClick}
        aria-label={tooltipText}
        aria-pressed={isOpen}
      >
        <BellIcon size={18} />
        {unreadCount > 0 && (
          <span className="notification-bell__dot" aria-hidden="true" />
        )}
      </button>
    </Tooltip>
  );
}

function NotificationsList({ notifications }) {
  if (notifications.length === 0) {
    return (
      <div className="sidekick-panel__empty">
        <div className="sidekick-panel__empty-icon" aria-hidden="true">
          <NotificationOff size={28} />
        </div>
        <h3 className="sidekick-panel__empty-title">You're all caught up</h3>
        <p className="sidekick-panel__empty-body">
          Updates about builds, publishes, and errors will show up here as you work.
        </p>
      </div>
    );
  }
  return (
    <div className="sidekick-panel__list">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`notification-item notification-item--${n.status || 'info'}${n.read ? '' : ' is-unread'}`}
        >
          <span className={`notification-item__icon notification-item__icon--${n.status || 'info'}`}>
            {statusIcon(n.status)}
          </span>
          <div className="notification-item__body">
            <div className="notification-item__message">{n.message}</div>
            <div className="notification-item__meta">
              <span className="notification-item__time">{formatRelative(n.timestamp)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const MOCK_REPLIES = [
  "Sure — here's a quick take. This dashboard lives in the /app shell and every widget is a WordPress block with category \"dashboard\". Add one to any site by creating a block.json with that category.",
  "Good question. The compiler reads each site's blocks/ folder and emits them as a runtime plugin. Nothing is hardcoded to a specific site — it's all driven off block.json metadata.",
  "You can reorder widgets by dragging the handle that appears on hover, and hide any widget from the dashboard settings menu. Layout is persisted per-user in localStorage.",
  "For streaming content into blocks, look at the Interactivity API wiring in the traffic-overview block — it seeds state on the server and hydrates on the client.",
];

function pickMockReply(input) {
  const seed = input.split('').reduce((acc, ch) => (acc + ch.charCodeAt(0)) % 1000, 0);
  return MOCK_REPLIES[seed % MOCK_REPLIES.length];
}

function AssistantChat() {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const textareaRef = useRef(null);
  const scrollRef = useRef(null);
  const streamTimer = useRef(null);

  useEffect(() => () => {
    if (streamTimer.current) clearInterval(streamTimer.current);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  function autogrow() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }

  function streamReply(target, full) {
    let i = 0;
    const id = target.id;
    streamTimer.current = setInterval(() => {
      i += Math.max(1, Math.floor(Math.random() * 4));
      const next = full.slice(0, i);
      setMessages((current) => current.map((m) => (m.id === id ? { ...m, text: next } : m)));
      if (i >= full.length) {
        clearInterval(streamTimer.current);
        streamTimer.current = null;
        setIsStreaming(false);
      }
    }, 22);
  }

  function send() {
    const text = draft.trim();
    if (!text || isStreaming) return;
    const user = { id: `u-${Date.now()}`, role: 'user', text };
    const bot = { id: `a-${Date.now()}`, role: 'assistant', text: '' };
    setMessages((current) => [...current, user, bot]);
    setDraft('');
    setIsStreaming(true);
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.focus();
      }
    });
    streamReply(bot, pickMockReply(text));
  }

  function onComposerClick(event) {
    if (event.target.closest('.assistant-composer__send')) return;
    textareaRef.current?.focus();
  }

  const canSend = draft.trim().length > 0 && !isStreaming;

  return (
    <div className="assistant-chat">
      <div className="assistant-chat__scroll" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="assistant-chat__empty">
            <h3 className="assistant-chat__empty-title">Ask anything</h3>
            <p className="assistant-chat__empty-body">
              Ask about the dashboard, your content, or how to do something in this site.
            </p>
          </div>
        ) : (
          <ol className="assistant-chat__messages" aria-live="polite">
            {messages.map((m) => (
              <li key={m.id} className={`assistant-msg assistant-msg--${m.role}`}>
                <div className="assistant-msg__bubble">
                  {m.text}
                  {m.role === 'assistant' && isStreaming && m === messages[messages.length - 1] ? (
                    <span className="assistant-msg__caret" aria-hidden="true" />
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div
        className="assistant-composer"
        role="group"
        aria-label="AI assistant composer"
        onClick={onComposerClick}
      >
        <textarea
          ref={textareaRef}
          className="assistant-composer__input"
          placeholder="Ask anything…"
          rows={1}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); autogrow(); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button
          type="button"
          className="assistant-composer__send"
          aria-label="Send message"
          disabled={!canSend}
          onClick={send}
        >
          <ArrowUp size={16} />
        </button>
      </div>
    </div>
  );
}

export function SidekickPanel({
  open,
  onClose,
  activeTab = 'notifications',
  onTabChange,
  notifications = [],
  onMarkAllRead,
  onClearAll,
  onOpen,
}) {
  useEffect(() => {
    if (open && typeof onOpen === 'function') onOpen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function handleKey(e) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const tabs = useMemo(
    () => [
      { name: 'notifications', title: 'Notifications' },
      { name: 'assistant', title: 'Assistant' },
    ],
    []
  );

  if (!open) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const menuControls =
    activeTab === 'notifications'
      ? [
          {
            title: 'Mark all read',
            onClick: () => onMarkAllRead?.(),
            isDisabled: notifications.length === 0 || unreadCount === 0,
          },
          {
            title: 'Clear all',
            onClick: () => onClearAll?.(),
            isDisabled: notifications.length === 0,
          },
        ]
      : [];

  return (
    <aside
      className="sidekick-panel"
      role="complementary"
      aria-label="Sidekick panel"
    >
      <div className="sidekick-panel__tabstrip">
        <nav className="sidekick-panel__tabs" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.name}
              type="button"
              role="tab"
              aria-selected={activeTab === t.name}
              className={`sidekick-panel__tab${activeTab === t.name ? ' is-active' : ''}`}
              onClick={() => onTabChange?.(t.name)}
            >
              {t.title}
            </button>
          ))}
        </nav>
        <div className="sidekick-panel__tabstrip-actions">
          {menuControls.length > 0 ? (
            <DropdownMenu
              className="sidekick-panel__menu"
              icon={OverflowIcon}
              label="More actions"
              controls={menuControls}
            />
          ) : null}
          <button
            type="button"
            className="sidekick-panel__close"
            onClick={() => onClose?.()}
            aria-label="Close"
            title="Close"
          >
            <Close size={16} />
          </button>
        </div>
      </div>
      <div className="sidekick-panel__body">
        {activeTab === 'notifications' ? (
          <NotificationsList notifications={notifications} />
        ) : (
          <AssistantChat />
        )}
      </div>
    </aside>
  );
}
