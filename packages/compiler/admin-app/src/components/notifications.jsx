import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, DropdownMenu } from '@wordpress/components';
import {
  Notification as BellIcon,
  Checkmark,
  WarningAlt,
  Information,
  Close,
  ChatBot,
  OverflowMenuVertical,
  Send,
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
  return (
    <button
      type="button"
      className={`notification-bell${isOpen ? ' is-pressed' : ''}`}
      onClick={onClick}
      aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
      aria-pressed={isOpen}
      title="Notifications"
    >
      <BellIcon size={18} />
      {unreadCount > 0 && (
        <span className="notification-bell__badge" aria-hidden="true">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
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

function AssistantPlaceholder() {
  const [value, setValue] = useState('');
  const canSend = value.trim().length > 0;
  return (
    <div className="sidekick-panel__assistant">
      <div className="sidekick-panel__assistant-empty">
        <div className="sidekick-panel__assistant-icon" aria-hidden="true">
          <ChatBot size={32} />
        </div>
        <h3 className="sidekick-panel__assistant-title">AI Assistant</h3>
        <p className="sidekick-panel__assistant-body">
          Draft content, navigate the site, and troubleshoot from this panel.
          <br />
          <span className="sidekick-panel__assistant-body-muted">Coming soon.</span>
        </p>
      </div>
      <form
        className="sidekick-panel__composer"
        onSubmit={(e) => e.preventDefault()}
        aria-label="AI assistant composer"
      >
        <textarea
          className="sidekick-panel__composer-input"
          placeholder="Ask anything…"
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) e.preventDefault();
          }}
        />
        <button
          type="submit"
          className="sidekick-panel__composer-send"
          aria-label="Send"
          disabled={!canSend}
          data-can-send={canSend ? 'true' : 'false'}
        >
          <Send size={14} />
        </button>
      </form>
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
            onClick={onClose}
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
          <AssistantPlaceholder />
        )}
      </div>
    </aside>
  );
}
