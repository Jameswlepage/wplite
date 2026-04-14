import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@wordpress/components';
import { Notification as BellIcon, CheckmarkFilled, WarningAlt, Information, Close } from '@carbon/icons-react';

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
  if (status === 'error') return <WarningAlt size={16} />;
  if (status === 'success') return <CheckmarkFilled size={16} />;
  return <Information size={16} />;
}

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
      // Errors stay unread until viewed; others can be auto-read when opened.
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

export function NotificationCenter({
  notifications,
  onMarkAllRead,
  onClearAll,
  onOpen,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function handleKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      if (next && typeof onOpen === 'function') onOpen();
      return next;
    });
  }

  return (
    <div className="notification-center" ref={containerRef}>
      <button
        type="button"
        className={`notification-center__trigger${open ? ' is-open' : ''}`}
        onClick={toggle}
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
        aria-expanded={open}
        title="Notifications"
      >
        <BellIcon size={18} />
        {unreadCount > 0 && (
          <span className="notification-center__badge" aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="notification-popover" role="dialog" aria-label="Notification center">
          <div className="notification-popover__header">
            <strong>Notifications</strong>
            <div className="notification-popover__header-actions">
              <Button
                variant="tertiary"
                size="small"
                onClick={onMarkAllRead}
                disabled={notifications.length === 0 || unreadCount === 0}
              >
                Mark all read
              </Button>
              <Button
                variant="tertiary"
                size="small"
                onClick={onClearAll}
                disabled={notifications.length === 0}
              >
                Clear all
              </Button>
            </div>
          </div>
          <div className="notification-popover__list">
            {notifications.length === 0 ? (
              <div className="notification-popover__empty">
                No notifications yet.
              </div>
            ) : (
              notifications.map((n) => (
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
                      <span className="notification-item__status">{n.status || 'info'}</span>
                      <span className="notification-item__time">{formatRelative(n.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
