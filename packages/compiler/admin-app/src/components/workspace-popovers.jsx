import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  SelectControl,
  TextControl,
  TextareaControl,
  ToggleControl,
} from '@wordpress/components';
import { DataForm, DataViews } from '@wordpress/dataviews';
import { Add, CloudUpload, Document, DocumentPdf, Music, NotificationOff, Upload, Video } from '@carbon/icons-react';
import {
  apiFetch,
  buildFieldDefinitions,
  buildFormConfig,
  collectionPathForModel,
  createEmptySingleton,
  decodeRenderedText,
  formatDateTime,
  normalizeCommentRecord,
  normalizeMediaRecord,
  normalizePageRecord,
  normalizeUserPreferences,
  normalizeUserRecord,
  wpApiFetch,
} from '../lib/helpers.js';
import { CarbonIcon } from '../lib/icons.jsx';
import { ImageControl, RepeaterControl } from './controls.jsx';
import { ApiPage, LogsPage } from './workspace.jsx';

const ACCOUNT_COLOR_OPTIONS = [
  { value: 'modern', label: 'Modern Blue' },
  { value: 'light', label: 'Light' },
  { value: 'blue', label: 'Blue' },
  { value: 'coffee', label: 'Coffee' },
  { value: 'ectoplasm', label: 'Ectoplasm' },
  { value: 'midnight', label: 'Midnight' },
  { value: 'ocean', label: 'Ocean' },
  { value: 'sunrise', label: 'Sunrise' },
];

function useAnchorPosition(anchorRef, { width = 280, offsetY = 10, align = 'left', open = true } = {}) {
  const [style, setStyle] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    function update() {
      const anchor = anchorRef?.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const gutter = 16;
      const nextWidth = Math.min(width, window.innerWidth - gutter * 2);
      const left = align === 'right'
        ? Math.max(gutter, Math.min(rect.right - nextWidth, window.innerWidth - nextWidth - gutter))
        : Math.max(gutter, Math.min(rect.left, window.innerWidth - nextWidth - gutter));

      setStyle({
        position: 'fixed',
        top: `${rect.bottom + offsetY}px`,
        left: `${left}px`,
        width: `${nextWidth}px`,
      });
    }

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [align, anchorRef, offsetY, width, open]);

  return style;
}

function OverlayBackdrop({ onClick, className = '' }) {
  return (
    <button
      type="button"
      className={`workspace-overlay-backdrop ${className}`.trim()}
      onClick={onClick}
      aria-label="Close overlay"
    />
  );
}

function OverlayPanel({ title, description, onClose, children, className = '' }) {
  return (
    <div className={`workspace-overlay ${className}`.trim()} role="dialog" aria-modal="true" aria-label={title}>
      <header className="workspace-overlay__header">
        <div>
          <p className="workspace-overlay__eyebrow">Workspace</p>
          <h2>{title}</h2>
          {description ? <p className="workspace-overlay__description">{description}</p> : null}
        </div>
        <button type="button" className="workspace-overlay__close" onClick={onClose} aria-label="Close overlay">
          <CarbonIcon name="Close" size={16} />
        </button>
      </header>
      {children}
    </div>
  );
}

function createAccountDraft(user = {}) {
  const normalized = normalizeUserRecord(user);

  return {
    id: normalized.id ?? null,
    name: normalized.name || normalized.displayName || '',
    firstName: normalized.firstName || '',
    lastName: normalized.lastName || '',
    username: normalized.username || '',
    email: normalized.email || '',
    url: normalized.url || '',
    description: normalized.description || '',
    locale: normalized.locale || '',
    avatarUrl: normalized.avatarUrl || '',
    preferences: normalizeUserPreferences(normalized.preferences),
    password: '',
    passwordConfirm: '',
  };
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

function statusClass(status) {
  if (status === 'publish') return 'is-publish';
  if (status === 'pending') return 'is-pending';
  if (status === 'private') return 'is-private';
  return 'is-draft';
}

export function NotificationsPopover({ open, anchorRef, notifications, onClose, onMarkAllRead, onClearAll }) {
  const style = useAnchorPosition(anchorRef, { width: 360, offsetY: 12, align: 'right', open });

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        onClose?.();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open || !style) return null;

  const unreadCount = notifications.filter((item) => !item.read).length;

  return (
    <Fragment>
      <OverlayBackdrop onClick={onClose} className="workspace-overlay-backdrop--clear" />
      <div className="workspace-flyout workspace-flyout--notifications" style={style}>
        <header className="workspace-flyout__header">
          <div>
            <h3>Notifications</h3>
            <p>{notifications.length > 0 ? `${unreadCount} unread` : 'Nothing new'}</p>
          </div>
          <div className="workspace-flyout__actions">
            <Button variant="tertiary" onClick={onMarkAllRead} disabled={notifications.length === 0 || unreadCount === 0}>Mark all read</Button>
            <Button variant="tertiary" onClick={onClearAll} disabled={notifications.length === 0}>Clear</Button>
          </div>
        </header>
        <div className="workspace-flyout__body">
          {notifications.length === 0 ? (
            <div className="workspace-empty-panel">
              <NotificationOff size={24} />
              <strong>You're all caught up</strong>
              <p>Builds, saves, publishes, and errors will collect here.</p>
            </div>
          ) : (
            <div className="workspace-notification-list">
              {notifications.map((notification) => (
                <article
                  key={notification.id}
                  className={`workspace-notification workspace-notification--${notification.status || 'info'}${notification.read ? '' : ' is-unread'}`}
                >
                  <div className="workspace-notification__icon">
                    <CarbonIcon
                      name={notification.status === 'error' ? 'WarningAlt' : notification.status === 'success' ? 'CheckmarkFilled' : 'Activity'}
                      size={16}
                    />
                  </div>
                  <div className="workspace-notification__body">
                    <strong>{notification.message}</strong>
                    <span>{formatRelative(notification.timestamp)}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </Fragment>
  );
}

const CONTENT_FIELDS = [
  {
    id: 'title',
    label: 'Title',
    enableHiding: false,
    enableGlobalSearch: true,
    getValue: ({ item }) => item.title || '(untitled)',
  },
  {
    id: 'slug',
    label: 'Slug',
    enableGlobalSearch: true,
    getValue: ({ item }) => item.slug ? `/${item.slug}` : '—',
  },
  {
    id: 'postStatus',
    label: 'Status',
    getValue: ({ item }) => item.postStatus || 'draft',
    elements: [
      { value: 'publish', label: 'Published' },
      { value: 'draft', label: 'Draft' },
      { value: 'pending', label: 'Pending' },
      { value: 'private', label: 'Private' },
    ],
    filterBy: { operators: ['is', 'isNot'] },
    render: ({ item }) => (
      <span className={`workspace-status-chip ${statusClass(item.postStatus)}`}>
        {item.postStatus || 'draft'}
      </span>
    ),
  },
  {
    id: 'modified',
    label: 'Updated',
    getValue: ({ item }) => item.modified || '',
    render: ({ item }) => formatDateTime(item.modified),
  },
];

const CONTENT_VIEW_DEFAULT = {
  type: 'table',
  page: 1,
  perPage: 20,
  search: '',
  fields: ['slug', 'postStatus', 'modified'],
  titleField: 'title',
  layout: {},
  filters: [],
};

export function ContentPopover({
  open,
  bootstrap,
  recordsByModel,
  currentPath,
  currentSection,
  onChangeSection,
  onOpenItem,
  onClose,
}) {
  const [view, setView] = useState(CONTENT_VIEW_DEFAULT);

  useEffect(() => {
    if (open) setView(CONTENT_VIEW_DEFAULT);
  }, [open]);

  const sections = useMemo(() => {
    const list = [
      {
        id: 'pages',
        label: 'Pages',
        icon: 'Document',
        records: bootstrap.pages ?? [],
        createLabel: 'New Page',
        getPath: (recordId) => `/pages/${recordId}`,
        getNewPath: () => '/pages/new',
      },
    ];

    const postModel = (bootstrap.models ?? []).find((item) => item?.id === 'post');
    if (postModel) {
      list.push({
        id: 'post',
        label: postModel.label || 'Posts',
        icon: 'Blog',
        records: recordsByModel.post ?? [],
        createLabel: 'New Post',
        getPath: (recordId) => `/posts/${recordId}`,
        getNewPath: () => '/posts/new',
      });
    }

    for (const model of bootstrap.models ?? []) {
      if (!model || model.public === false || model.id === 'page' || model.id === 'post') continue;
      list.push({
        id: model.id,
        label: model.label,
        icon: 'List',
        records: recordsByModel[model.id] ?? [],
        createLabel: `New ${model.singularLabel || model.label}`,
        getPath: (recordId) => `${collectionPathForModel(model)}/${recordId}`,
        getNewPath: () => `${collectionPathForModel(model)}/new`,
      });
    }

    return list;
  }, [bootstrap.models, bootstrap.pages, recordsByModel]);

  const activeSection = sections.find((section) => section.id === currentSection) ?? sections[0];

  const processed = useMemo(() => {
    const records = activeSection?.records ?? [];
    const term = (view.search || '').trim().toLowerCase();
    let filtered = records;
    if (term) {
      filtered = filtered.filter((record) => {
        const haystack = [record.title, record.slug, record.postStatus, record.routeId]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(term);
      });
    }
    for (const filter of view.filters || []) {
      if (filter.field === 'postStatus' && Array.isArray(filter.value) && filter.value.length) {
        filtered = filtered.filter((record) => {
          const status = record.postStatus || 'draft';
          return filter.operator === 'isNot'
            ? !filter.value.includes(status)
            : filter.value.includes(status);
        });
      }
    }
    return filtered;
  }, [activeSection, view.search, view.filters]);

  const actions = useMemo(() => [
    {
      id: 'open',
      label: 'Open',
      isPrimary: true,
      callback: (items) => {
        if (!items?.length) return;
        const item = items[0];
        onOpenItem(activeSection.getPath(item.id));
      },
    },
  ], [activeSection, onOpenItem]);

  if (!open) return null;

  return (
    <Fragment>
      <OverlayBackdrop onClick={onClose} />
      <OverlayPanel
        title="Content"
        description="Browse pages, posts, and collection entries without leaving the current canvas."
        onClose={onClose}
        className="workspace-overlay--content"
      >
        <div className="workspace-browser">
          <aside className="workspace-browser__sidebar">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`workspace-browser__nav-item${activeSection?.id === section.id ? ' is-active' : ''}`}
                onClick={() => onChangeSection(section.id)}
              >
                <span className="workspace-browser__nav-icon"><CarbonIcon name={section.icon} size={16} /></span>
                <span>{section.label}</span>
                <span className="workspace-browser__nav-count">{section.records.length}</span>
              </button>
            ))}
          </aside>
          <section className="workspace-browser__main workspace-browser__main--dataviews">
            <div className="workspace-browser__toolbar">
              <div>
                <h3>{activeSection?.label}</h3>
                <p>{activeSection?.records.length ?? 0} items</p>
              </div>
              <div className="workspace-browser__toolbar-actions">
                <Button variant="primary" onClick={() => onOpenItem(activeSection.getNewPath())}>
                  {activeSection?.createLabel || 'New'}
                </Button>
              </div>
            </div>
            <div className="workspace-dataviews-shell">
              <DataViews
                key={activeSection?.id}
                data={processed}
                fields={CONTENT_FIELDS}
                view={view}
                onChangeView={setView}
                paginationInfo={{ totalItems: processed.length, totalPages: Math.max(1, Math.ceil(processed.length / (view.perPage || 20))) }}
                defaultLayouts={{ table: {} }}
                getItemId={(item) => String(item.id)}
                isLoading={false}
                actions={actions}
                onClickItem={(item) => onOpenItem(activeSection.getPath(item.id))}
                selection={[]}
                onChangeSelection={() => {}}
              />
            </div>
          </section>
        </div>
      </OverlayPanel>
    </Fragment>
  );
}

function getMimeIconComponent(mimeType) {
  if (!mimeType) return Document;
  if (mimeType.startsWith('image/')) return null;
  if (mimeType.startsWith('video/')) return Video;
  if (mimeType.startsWith('audio/')) return Music;
  if (mimeType.includes('pdf')) return DocumentPdf;
  return Document;
}

function getMimeBucket(mimeType) {
  if (!mimeType) return 'other';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.includes('pdf') || mimeType.includes('msword') || mimeType.includes('officedocument') || mimeType.includes('text/')) return 'document';
  return 'other';
}

function getThumb(item) {
  return item.media_details?.sizes?.thumbnail?.source_url
    || item.media_details?.sizes?.medium?.source_url
    || item.source_url;
}

function getTitle(item) {
  return decodeRenderedText(item.title?.rendered) || item.slug || '(untitled)';
}

const MEDIA_VIEW_DEFAULT = {
  type: 'grid',
  page: 1,
  perPage: 40,
  search: '',
  fields: ['mimeBucket'],
  titleField: 'title',
  mediaField: 'thumb',
  descriptionField: 'mimeType',
  layout: {},
  filters: [],
};

export function MediaPopover({ open, onClose, onOpenItem, pushNotice }) {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [view, setView] = useState(MEDIA_VIEW_DEFAULT);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (open) setView(MEDIA_VIEW_DEFAULT);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const response = await wpApiFetch('wp/v2/media?per_page=100&orderby=date&order=desc&context=edit');
        if (!cancelled) setMedia(response);
      } catch (error) {
        if (!cancelled) {
          pushNotice?.({ status: 'error', message: `Failed to load media: ${error.message}` });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [open, pushNotice]);

  const doUpload = useCallback(async (files) => {
    if (files.length === 0) return;
    setIsUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', file.name.replace(/\.[^.]+$/, ''));
        uploaded.push(await wpApiFetch('wp/v2/media', { method: 'POST', body: formData }));
      }
      setMedia((current) => [...uploaded, ...current]);
      pushNotice?.({ status: 'success', message: `${uploaded.length} file${uploaded.length === 1 ? '' : 's'} uploaded.` });
    } catch (error) {
      pushNotice?.({ status: 'error', message: error.message });
    } finally {
      setIsUploading(false);
    }
  }, [pushNotice]);

  const items = useMemo(() => media.map((item) => {
    const normalized = normalizeMediaRecord(item);
    return {
      id: String(item.id),
      title: normalized.title || getTitle(item),
      mimeType: normalized.mimeType || item.mime_type || 'Media',
      mimeBucket: getMimeBucket(item.mime_type),
      thumb: getThumb(item),
      sourceUrl: normalized.sourceUrl,
      alt: item.alt_text || '',
    };
  }), [media]);

  const filtered = useMemo(() => {
    const query = (view.search || '').trim().toLowerCase();
    let list = items;
    for (const filter of view.filters || []) {
      if (filter.field === 'mimeBucket' && Array.isArray(filter.value) && filter.value.length) {
        list = list.filter((it) =>
          filter.operator === 'isNot'
            ? !filter.value.includes(it.mimeBucket)
            : filter.value.includes(it.mimeBucket)
        );
      }
    }
    if (!query) return list;
    return list.filter((it) => it.title.toLowerCase().includes(query) || it.mimeType.toLowerCase().includes(query));
  }, [items, view.search, view.filters]);

  const fields = useMemo(() => [
    {
      id: 'title',
      label: 'Title',
      enableHiding: false,
      enableGlobalSearch: true,
    },
    {
      id: 'thumb',
      label: 'Preview',
      render: ({ item }) => (
        <div className="workspace-media-card__preview">
          {item.mimeBucket === 'image' && item.thumb ? (
            <img src={item.thumb} alt={item.alt} loading="lazy" />
          ) : (
            (() => {
              const Icon = item.mimeBucket === 'video' ? Video
                : item.mimeBucket === 'audio' ? Music
                : item.mimeBucket === 'document' ? DocumentPdf
                : Document;
              return <Icon size={36} />;
            })()
          )}
        </div>
      ),
    },
    {
      id: 'mimeType',
      label: 'Type',
    },
    {
      id: 'mimeBucket',
      label: 'Category',
      elements: [
        { value: 'image', label: 'Images' },
        { value: 'video', label: 'Videos' },
        { value: 'audio', label: 'Audio' },
        { value: 'document', label: 'Documents' },
        { value: 'other', label: 'Other' },
      ],
      filterBy: { operators: ['is', 'isNot'] },
    },
  ], []);

  const actions = useMemo(() => [
    {
      id: 'open',
      label: 'Open',
      isPrimary: true,
      callback: (rows) => {
        if (!rows?.length) return;
        onOpenItem(`/media/${rows[0].id}`);
      },
    },
  ], [onOpenItem]);

  if (!open) return null;

  return (
    <Fragment>
      <OverlayBackdrop onClick={onClose} />
      <OverlayPanel
        title="Media"
        description="Upload, browse, and reopen assets without leaving the current editor canvas."
        onClose={onClose}
        className="workspace-overlay--media"
      >
        <div className="workspace-browser workspace-browser--media">
          <section className="workspace-browser__main workspace-browser__main--dataviews">
            <div className="workspace-browser__toolbar workspace-browser__toolbar--media">
              <div>
                <h3>Library</h3>
                <p>{filtered.length} of {media.length} assets</p>
              </div>
              <div className="workspace-browser__toolbar-actions">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  hidden
                  onChange={(event) => {
                    doUpload(Array.from(event.target.files ?? []));
                    event.target.value = '';
                  }}
                />
                <Button variant="primary" isBusy={isUploading} onClick={() => fileInputRef.current?.click()}>
                  Upload
                </Button>
              </div>
            </div>
            <div className="workspace-dataviews-shell">
              <DataViews
                data={filtered}
                fields={fields}
                view={view}
                onChangeView={setView}
                paginationInfo={{ totalItems: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / (view.perPage || 40))) }}
                defaultLayouts={{ grid: {}, table: {} }}
                getItemId={(item) => item.id}
                isLoading={loading}
                actions={actions}
                onClickItem={(item) => onOpenItem(`/media/${item.id}`)}
                selection={[]}
                onChangeSelection={() => {}}
              />
            </div>
          </section>
        </div>
      </OverlayPanel>
    </Fragment>
  );
}

const USERS_VIEW_DEFAULT = {
  type: 'table',
  page: 1,
  perPage: 20,
  search: '',
  fields: ['email', 'roles'],
  titleField: 'name',
  layout: {},
  filters: [],
};

const USER_FIELDS = [
  { id: 'name', label: 'Name', enableHiding: false, enableGlobalSearch: true },
  { id: 'username', label: 'Username', enableGlobalSearch: true },
  { id: 'email', label: 'Email', enableGlobalSearch: true },
  { id: 'roles', label: 'Roles', getValue: ({ item }) => (item.roles || []).join(', ') },
];

export function UsersPopover({ open, onClose, onOpenItem, pushNotice }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState(USERS_VIEW_DEFAULT);

  useEffect(() => {
    if (open) setView(USERS_VIEW_DEFAULT);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rows = await wpApiFetch('wp/v2/users?per_page=100&context=edit');
        if (!cancelled) {
          setUsers(rows.map((u) => {
            const n = normalizeUserRecord(u);
            return {
              id: String(n.id),
              name: n.name || n.displayName || n.username || 'User',
              username: n.username || '',
              email: n.email || '',
              roles: n.roles || [],
            };
          }));
        }
      } catch (error) {
        if (!cancelled) pushNotice?.({ status: 'error', message: `Failed to load users: ${error.message}` });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, pushNotice]);

  const filtered = useMemo(() => {
    const q = (view.search || '').trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => [u.name, u.username, u.email].some((v) => String(v).toLowerCase().includes(q)));
  }, [users, view.search]);

  const actions = useMemo(() => [
    {
      id: 'open',
      label: 'Open',
      isPrimary: true,
      callback: (rows) => {
        if (!rows?.length) return;
        onOpenItem(`/users/${rows[0].id}`);
      },
    },
  ], [onOpenItem]);

  if (!open) return null;

  return (
    <Fragment>
      <OverlayBackdrop onClick={onClose} />
      <OverlayPanel
        title="Users"
        description="Manage WordPress users and roles."
        onClose={onClose}
        className="workspace-overlay--users"
      >
        <div className="workspace-browser workspace-browser--media">
          <section className="workspace-browser__main workspace-browser__main--dataviews">
            <div className="workspace-browser__toolbar">
              <div>
                <h3>People</h3>
                <p>{filtered.length} of {users.length} users</p>
              </div>
              <div className="workspace-browser__toolbar-actions">
                <Button variant="primary" onClick={() => onOpenItem('/users/new')}>New User</Button>
              </div>
            </div>
            <div className="workspace-dataviews-shell">
              <DataViews
                data={filtered}
                fields={USER_FIELDS}
                view={view}
                onChangeView={setView}
                paginationInfo={{ totalItems: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / (view.perPage || 20))) }}
                defaultLayouts={{ table: {} }}
                getItemId={(item) => item.id}
                isLoading={loading}
                actions={actions}
                onClickItem={(item) => onOpenItem(`/users/${item.id}`)}
                selection={[]}
                onChangeSelection={() => {}}
              />
            </div>
          </section>
        </div>
      </OverlayPanel>
    </Fragment>
  );
}

const COMMENTS_VIEW_DEFAULT = {
  type: 'table',
  page: 1,
  perPage: 20,
  search: '',
  fields: ['author', 'postTitle', 'status', 'date'],
  titleField: 'excerpt',
  layout: {},
  filters: [],
};

const COMMENT_FIELDS = [
  {
    id: 'excerpt',
    label: 'Comment',
    enableHiding: false,
    enableGlobalSearch: true,
  },
  {
    id: 'author',
    label: 'Author',
    getValue: ({ item }) => item.authorName || '(unknown)',
    enableGlobalSearch: true,
  },
  {
    id: 'postTitle',
    label: 'On',
    getValue: ({ item }) => item.postTitle || '',
    enableGlobalSearch: true,
  },
  {
    id: 'status',
    label: 'Status',
    getValue: ({ item }) => item.status || 'approved',
    elements: [
      { value: 'approved', label: 'Approved' },
      { value: 'hold', label: 'Pending' },
      { value: 'spam', label: 'Spam' },
      { value: 'trash', label: 'Trash' },
    ],
    filterBy: { operators: ['is', 'isNot'] },
    render: ({ item }) => (
      <span className={`workspace-status-chip is-${item.status || 'approved'}`}>
        {item.status || 'approved'}
      </span>
    ),
  },
  {
    id: 'date',
    label: 'Date',
    getValue: ({ item }) => item.date || '',
    render: ({ item }) => formatDateTime(item.date),
  },
];

export function CommentsPopover({ open, onClose, onOpenItem, pushNotice }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState(COMMENTS_VIEW_DEFAULT);

  useEffect(() => {
    if (open) setView(COMMENTS_VIEW_DEFAULT);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rows = await wpApiFetch(
          'wp/v2/comments?per_page=100&status=all&orderby=date_gmt&order=desc&context=edit&_embed=up'
        );
        if (!cancelled) setComments(rows.map((c) => {
          const n = normalizeCommentRecord(c);
          return { ...n, id: String(n.id) };
        }));
      } catch (error) {
        if (!cancelled) pushNotice?.({ status: 'error', message: `Failed to load comments: ${error.message}` });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, pushNotice]);

  const filtered = useMemo(() => {
    const q = (view.search || '').trim().toLowerCase();
    let list = comments;
    for (const filter of view.filters || []) {
      if (filter.field === 'status' && Array.isArray(filter.value) && filter.value.length) {
        list = list.filter((c) =>
          filter.operator === 'isNot'
            ? !filter.value.includes(c.status)
            : filter.value.includes(c.status)
        );
      }
    }
    if (!q) return list;
    return list.filter((c) => [c.excerpt, c.authorName, c.postTitle].some((v) => String(v).toLowerCase().includes(q)));
  }, [comments, view.search, view.filters]);

  const actions = useMemo(() => [
    {
      id: 'open',
      label: 'Open',
      isPrimary: true,
      callback: (rows) => {
        if (!rows?.length) return;
        onOpenItem(`/comments/${rows[0].id}`);
      },
    },
  ], [onOpenItem]);

  if (!open) return null;

  return (
    <Fragment>
      <OverlayBackdrop onClick={onClose} />
      <OverlayPanel
        title="Comments"
        description="Moderate discussion across the site."
        onClose={onClose}
        className="workspace-overlay--comments"
      >
        <div className="workspace-browser workspace-browser--media">
          <section className="workspace-browser__main workspace-browser__main--dataviews">
            <div className="workspace-browser__toolbar">
              <div>
                <h3>Discussion</h3>
                <p>{filtered.length} of {comments.length} comments</p>
              </div>
            </div>
            <div className="workspace-dataviews-shell">
              <DataViews
                data={filtered}
                fields={COMMENT_FIELDS}
                view={view}
                onChangeView={setView}
                paginationInfo={{ totalItems: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / (view.perPage || 20))) }}
                defaultLayouts={{ table: {} }}
                getItemId={(item) => item.id}
                isLoading={loading}
                actions={actions}
                onClickItem={(item) => onOpenItem(`/comments/${item.id}`)}
                selection={[]}
                onChangeSelection={() => {}}
              />
            </div>
          </section>
        </div>
      </OverlayPanel>
    </Fragment>
  );
}

function EmbeddedSiteSettings({ bootstrap, setBootstrap, pushNotice }) {
  const [draft, setDraft] = useState(null);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [settings, pageItems] = await Promise.all([
          wpApiFetch('wp/v2/settings'),
          wpApiFetch('wp/v2/pages?per_page=100&orderby=menu_order&order=asc&context=edit&status=any'),
        ]);

        if (cancelled) return;

        setDraft({
          title: settings.title ?? '',
          description: settings.description ?? '',
          site_icon: settings.site_icon ?? 0,
          timezone: settings.timezone ?? '',
          date_format: settings.date_format ?? 'F j, Y',
          time_format: settings.time_format ?? 'g:i a',
          start_of_week: settings.start_of_week ?? 1,
          posts_per_page: settings.posts_per_page ?? 10,
          show_on_front: settings.show_on_front ?? 'posts',
          page_on_front: settings.page_on_front ?? 0,
          page_for_posts: settings.page_for_posts ?? 0,
          default_comment_status: settings.default_comment_status ?? (bootstrap.site?.commentsEnabled ? 'open' : 'closed'),
        });
        setPages(pageItems.map(normalizePageRecord));
      } catch (error) {
        if (!cancelled) {
          pushNotice?.({ status: 'error', message: `Failed to load site settings: ${error.message}` });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [bootstrap.site?.commentsEnabled, pushNotice]);

  async function handleSave() {
    if (!draft) return;
    setIsSaving(true);
    try {
      const payload = await wpApiFetch('wp/v2/settings', {
        method: 'POST',
        body: {
          title: draft.title,
          description: draft.description,
          site_icon: Number(draft.site_icon || 0),
          timezone: draft.timezone,
          date_format: draft.date_format,
          time_format: draft.time_format,
          start_of_week: Number(draft.start_of_week || 0),
          posts_per_page: Number(draft.posts_per_page || 10),
          show_on_front: draft.show_on_front,
          page_on_front: draft.show_on_front === 'page' ? Number(draft.page_on_front || 0) : 0,
          page_for_posts: draft.show_on_front === 'page' ? Number(draft.page_for_posts || 0) : 0,
          default_comment_status: draft.default_comment_status === 'open' ? 'open' : 'closed',
        },
      });

      setDraft((current) => ({
        ...current,
        title: payload.title ?? current.title,
        description: payload.description ?? current.description,
        default_comment_status: payload.default_comment_status ?? current.default_comment_status,
      }));

      setBootstrap((current) => ({
        ...current,
        site: {
          ...current.site,
          title: payload.title ?? current.site.title,
          tagline: payload.description ?? current.site.tagline,
          commentsEnabled: (payload.default_comment_status ?? draft.default_comment_status) === 'open',
          showOnFront: payload.show_on_front ?? draft.show_on_front,
          pageOnFront: payload.page_on_front ?? draft.page_on_front,
          pageForPosts: payload.page_for_posts ?? draft.page_for_posts,
        },
      }));

      pushNotice?.({ status: 'success', message: 'Site settings saved.' });
    } catch (error) {
      pushNotice?.({ status: 'error', message: error.message });
    } finally {
      setIsSaving(false);
    }
  }

  if (loading || !draft) {
    return (
      <div className="workspace-empty-panel workspace-empty-panel--compact">
        <strong>Loading settings...</strong>
      </div>
    );
  }

  const pageOptions = [{ value: '0', label: 'Select a page' }].concat(
    pages.map((page) => ({ value: String(page.id), label: page.title || `Page ${page.id}` }))
  );

  return (
    <div className="workspace-settings-pane">
      <div className="workspace-settings-pane__header">
        <div>
          <h3>General</h3>
          <p>Identity, homepage, and discussion defaults.</p>
        </div>
        <Button variant="primary" isBusy={isSaving} onClick={handleSave}>Save Settings</Button>
      </div>
      <div className="workspace-settings-pane__grid">
        <div className="workspace-settings-pane__main">
          <Card className="surface-card">
            <CardHeader><h2>Identity</h2></CardHeader>
            <CardBody>
              <div className="settings-field-group">
                <TextControl label="Site Title" value={draft.title} onChange={(value) => setDraft((current) => ({ ...current, title: value }))} __next40pxDefaultSize />
                <TextControl label="Tagline" value={draft.description} onChange={(value) => setDraft((current) => ({ ...current, description: value }))} __next40pxDefaultSize />
                <ImageControl
                  data={draft}
                  field={{
                    id: 'site_icon',
                    label: 'Site Icon',
                    help: 'Used as the browser favicon and site icon.',
                    getValue: ({ item }) => item?.site_icon ?? 0,
                  }}
                  onChange={(edits) => setDraft((current) => ({ ...current, ...edits }))}
                />
              </div>
            </CardBody>
          </Card>

          <Card className="surface-card">
            <CardHeader><h2>Homepage</h2></CardHeader>
            <CardBody>
              <div className="settings-field-group">
                <SelectControl
                  label="Homepage Displays"
                  value={draft.show_on_front}
                  options={[
                    { value: 'posts', label: 'Your latest posts' },
                    { value: 'page', label: 'A static page' },
                  ]}
                  onChange={(value) => setDraft((current) => ({ ...current, show_on_front: value }))}
                  __next40pxDefaultSize
                />
                {draft.show_on_front === 'page' ? (
                  <div className="inline-field-grid">
                    <SelectControl
                      label="Homepage"
                      value={String(draft.page_on_front)}
                      options={pageOptions}
                      onChange={(value) => setDraft((current) => ({ ...current, page_on_front: Number(value || 0) }))}
                      __next40pxDefaultSize
                    />
                    <SelectControl
                      label="Posts Page"
                      value={String(draft.page_for_posts)}
                      options={pageOptions}
                      onChange={(value) => setDraft((current) => ({ ...current, page_for_posts: Number(value || 0) }))}
                      __next40pxDefaultSize
                    />
                  </div>
                ) : null}
                <TextControl
                  label="Posts Per Page"
                  type="number"
                  value={String(draft.posts_per_page)}
                  onChange={(value) => setDraft((current) => ({ ...current, posts_per_page: Number(value || 10) }))}
                  __next40pxDefaultSize
                />
              </div>
            </CardBody>
          </Card>

          <Card className="surface-card">
            <CardHeader><h2>Discussion</h2></CardHeader>
            <CardBody>
              <div className="settings-field-group">
                <SelectControl
                  label="Comments"
                  value={draft.default_comment_status}
                  options={[
                    { value: 'closed', label: 'Disabled' },
                    { value: 'open', label: 'Enabled' },
                  ]}
                  onChange={(value) => setDraft((current) => ({ ...current, default_comment_status: value }))}
                  __next40pxDefaultSize
                />
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="workspace-settings-pane__side">
          <Card className="surface-card">
            <CardHeader><h2>Formatting</h2></CardHeader>
            <CardBody>
              <div className="settings-field-group">
                <TextControl label="Timezone" value={draft.timezone} onChange={(value) => setDraft((current) => ({ ...current, timezone: value }))} __next40pxDefaultSize />
                <div className="inline-field-grid">
                  <TextControl label="Date Format" value={draft.date_format} onChange={(value) => setDraft((current) => ({ ...current, date_format: value }))} __next40pxDefaultSize />
                  <TextControl label="Time Format" value={draft.time_format} onChange={(value) => setDraft((current) => ({ ...current, time_format: value }))} __next40pxDefaultSize />
                </div>
                <SelectControl
                  label="Week Starts On"
                  value={String(draft.start_of_week)}
                  options={[
                    { value: '0', label: 'Sunday' },
                    { value: '1', label: 'Monday' },
                    { value: '2', label: 'Tuesday' },
                    { value: '3', label: 'Wednesday' },
                    { value: '4', label: 'Thursday' },
                    { value: '5', label: 'Friday' },
                    { value: '6', label: 'Saturday' },
                  ]}
                  onChange={(value) => setDraft((current) => ({ ...current, start_of_week: Number(value || 0) }))}
                  __next40pxDefaultSize
                />
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function EmbeddedSingletonSettings({ bootstrap, singletonData, setSingletonData, singletonId, pushNotice }) {
  const singleton = (bootstrap.singletons ?? []).find((item) => item.id === singletonId) ?? null;
  const schema = singleton ? bootstrap.adminSchema.forms?.[singleton.id] : null;
  const [draft, setDraft] = useState(() => (singleton ? singletonData[singleton.id] ?? createEmptySingleton() : {}));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (singleton) {
      setDraft(singletonData[singleton.id] ?? createEmptySingleton());
    }
  }, [singleton, singletonData]);

  const pseudoModel = useMemo(() => (singleton ? { ...singleton, supports: [] } : null), [singleton]);

  const fields = useMemo(() => {
    if (!schema || !pseudoModel) return [];
    return buildFieldDefinitions({
      schema,
      model: pseudoModel,
      recordsByModel: {},
      includeContentField: true,
      ImageControl,
      RepeaterControl,
      canonical: bootstrap.site,
    });
  }, [bootstrap.site, pseudoModel, schema]);

  const form = useMemo(() => {
    if (!schema) return null;
    return buildFormConfig(schema, fields.map((field) => field.id));
  }, [fields, schema]);

  async function handleSave() {
    if (!singleton) return;
    setIsSaving(true);
    try {
      const payload = await apiFetch(`singleton/${singleton.id}`, { method: 'POST', body: draft });
      setSingletonData((current) => ({ ...current, [singleton.id]: payload.item }));
      pushNotice?.({ status: 'success', message: `${singleton.label} saved.` });
    } catch (error) {
      pushNotice?.({ status: 'error', message: error.message });
    } finally {
      setIsSaving(false);
    }
  }

  if (!singleton || !schema || !form) {
    return (
      <div className="workspace-empty-panel workspace-empty-panel--compact">
        <strong>Missing singleton schema</strong>
      </div>
    );
  }

  return (
    <div className="workspace-settings-pane">
      <div className="workspace-settings-pane__header">
        <div>
          <h3>{singleton.label}</h3>
          <p>Compiler-owned settings surface backed by WordPress options.</p>
        </div>
        <Button variant="primary" isBusy={isSaving} onClick={handleSave}>Save Settings</Button>
      </div>
      <Card className="surface-card">
        <CardBody>
          <DataForm
            data={draft}
            fields={fields}
            form={form}
            onChange={(edits) => setDraft((current) => ({ ...current, ...edits }))}
          />
        </CardBody>
      </Card>
    </div>
  );
}

function EmbeddedAccountSettings({ bootstrap, setBootstrap, pushNotice }) {
  const [draft, setDraft] = useState(() => createAccountDraft(bootstrap?.currentUser ?? {}));
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const payload = await wpApiFetch('wp/v2/users/me?context=edit');
        if (cancelled) return;
        setDraft(createAccountDraft(payload));
      } catch (error) {
        if (!cancelled) {
          pushNotice?.({ status: 'error', message: `Failed to load your profile: ${error.message}` });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [pushNotice]);

  async function handleSave() {
    if (!draft) return;

    if ((draft.password || draft.passwordConfirm) && draft.password !== draft.passwordConfirm) {
      pushNotice?.({ status: 'error', message: 'Passwords do not match.' });
      return;
    }

    setIsSaving(true);

    try {
      const payload = await wpApiFetch('wp/v2/users/me', {
        method: 'POST',
        body: {
          name: draft.name,
          first_name: draft.firstName,
          last_name: draft.lastName,
          email: draft.email,
          url: draft.url,
          description: draft.description,
          locale: draft.locale,
          wplitePreferences: draft.preferences,
          ...(draft.password ? { password: draft.password } : {}),
        },
      });

      const normalized = createAccountDraft(payload);
      setDraft(normalized);

      if (typeof setBootstrap === 'function') {
        setBootstrap((current) => ({
          ...current,
          currentUser: {
            ...(current?.currentUser ?? {}),
            ...normalizeUserRecord(payload),
          },
        }));
      }

      pushNotice?.({ status: 'success', message: 'Account settings saved.' });
    } catch (error) {
      pushNotice?.({ status: 'error', message: error.message });
    } finally {
      setIsSaving(false);
    }
  }

  if (loading || !draft) {
    return (
      <div className="workspace-empty-panel workspace-empty-panel--compact">
        <strong>Loading account settings...</strong>
      </div>
    );
  }

  return (
    <div className="workspace-settings-pane">
      <div className="workspace-settings-pane__header">
        <div>
          <h3>Account</h3>
          <p>Your WordPress profile, editor preferences, and security controls.</p>
        </div>
        <Button variant="primary" isBusy={isSaving} onClick={handleSave}>Save Settings</Button>
      </div>
      <div className="workspace-settings-pane__grid">
        <div className="workspace-settings-pane__main">
          <Card className="surface-card">
            <CardHeader><h2>Profile</h2></CardHeader>
            <CardBody>
              <div className="settings-field-group">
                <div className="inline-field-grid">
                  <TextControl
                    label="First Name"
                    value={draft.firstName}
                    onChange={(value) => setDraft((current) => ({ ...current, firstName: value }))}
                    __next40pxDefaultSize
                    __nextHasNoMarginBottom
                  />
                  <TextControl
                    label="Last Name"
                    value={draft.lastName}
                    onChange={(value) => setDraft((current) => ({ ...current, lastName: value }))}
                    __next40pxDefaultSize
                    __nextHasNoMarginBottom
                  />
                </div>
                <TextControl
                  label="Display Name"
                  value={draft.name}
                  onChange={(value) => setDraft((current) => ({ ...current, name: value }))}
                  __next40pxDefaultSize
                  __nextHasNoMarginBottom
                />
                <TextControl
                  label="Email"
                  type="email"
                  value={draft.email}
                  onChange={(value) => setDraft((current) => ({ ...current, email: value }))}
                  __next40pxDefaultSize
                  __nextHasNoMarginBottom
                />
                <TextControl
                  label="Website"
                  type="url"
                  value={draft.url}
                  onChange={(value) => setDraft((current) => ({ ...current, url: value }))}
                  __next40pxDefaultSize
                  __nextHasNoMarginBottom
                />
                <TextControl
                  label="Locale"
                  value={draft.locale}
                  onChange={(value) => setDraft((current) => ({ ...current, locale: value }))}
                  __next40pxDefaultSize
                  __nextHasNoMarginBottom
                />
                <TextareaControl
                  label="Biographical Info"
                  value={draft.description}
                  onChange={(value) => setDraft((current) => ({ ...current, description: value }))}
                  rows={5}
                  __nextHasNoMarginBottom
                />
              </div>
            </CardBody>
          </Card>

          <Card className="surface-card">
            <CardHeader><h2>Editor Preferences</h2></CardHeader>
            <CardBody>
              <div className="settings-field-group">
                <SelectControl
                  label="Admin Color Scheme"
                  value={draft.preferences.adminColor}
                  options={ACCOUNT_COLOR_OPTIONS}
                  onChange={(value) => setDraft((current) => ({
                    ...current,
                    preferences: { ...current.preferences, adminColor: value },
                  }))}
                  __next40pxDefaultSize
                  __nextHasNoMarginBottom
                />
                <ToggleControl
                  label="Visual editor"
                  checked={draft.preferences.richEditing}
                  onChange={(value) => setDraft((current) => ({
                    ...current,
                    preferences: { ...current.preferences, richEditing: value },
                  }))}
                />
                <ToggleControl
                  label="Syntax highlighting"
                  checked={draft.preferences.syntaxHighlighting}
                  onChange={(value) => setDraft((current) => ({
                    ...current,
                    preferences: { ...current.preferences, syntaxHighlighting: value },
                  }))}
                />
                <ToggleControl
                  label="Comment moderation shortcuts"
                  checked={draft.preferences.commentShortcuts}
                  onChange={(value) => setDraft((current) => ({
                    ...current,
                    preferences: { ...current.preferences, commentShortcuts: value },
                  }))}
                />
                <ToggleControl
                  label="Show admin bar on the front-end"
                  checked={draft.preferences.showAdminBarFront}
                  onChange={(value) => setDraft((current) => ({
                    ...current,
                    preferences: { ...current.preferences, showAdminBarFront: value },
                  }))}
                />
              </div>
            </CardBody>
          </Card>

          <Card className="surface-card">
            <CardHeader><h2>Security</h2></CardHeader>
            <CardBody>
              <div className="settings-field-group">
                <TextControl
                  label="New Password"
                  type="password"
                  value={draft.password}
                  onChange={(value) => setDraft((current) => ({ ...current, password: value }))}
                  __next40pxDefaultSize
                  __nextHasNoMarginBottom
                />
                <TextControl
                  label="Confirm New Password"
                  type="password"
                  value={draft.passwordConfirm}
                  onChange={(value) => setDraft((current) => ({ ...current, passwordConfirm: value }))}
                  __next40pxDefaultSize
                  __nextHasNoMarginBottom
                />
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="workspace-settings-pane__side">
          <Card className="surface-card">
            <CardBody>
              <div className="user-inspector__header">
                {draft.avatarUrl ? (
                  <img src={draft.avatarUrl} alt="" className="user-avatar user-avatar--large" />
                ) : (
                  <div className="user-avatar user-avatar--large">
                    {(draft.name || draft.username || 'A').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <h3 className="user-inspector__name">{draft.name || draft.username || 'Account'}</h3>
                {draft.email ? <span className="user-inspector__email">{draft.email}</span> : null}
              </div>
              <dl className="settings-info__list">
                <dt>Username</dt>
                <dd>@{draft.username || 'me'}</dd>
                <dt>Locale</dt>
                <dd>{draft.locale || 'Default'}</dd>
                <dt>Color Scheme</dt>
                <dd>{ACCOUNT_COLOR_OPTIONS.find((option) => option.value === draft.preferences.adminColor)?.label || 'Modern Blue'}</dd>
              </dl>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function EmbeddedSettingsScreen({ children }) {
  return (
    <div className="workspace-settings-surface">
      {children}
    </div>
  );
}

export function SettingsPopover({
  open,
  bootstrap,
  setBootstrap,
  singletonData,
  setSingletonData,
  currentSection,
  onChangeSection,
  onClose,
  pushNotice,
  onNavigate,
}) {
  const sections = useMemo(() => ([
    { id: 'site', label: 'General', icon: 'Globe' },
    { id: 'account', label: 'Account', icon: 'User' },
    ...(bootstrap.singletons ?? []).map((singleton) => ({ id: singleton.id, label: singleton.label, icon: 'Settings' })),
    { id: 'api', label: 'API', icon: 'Api' },
    { id: 'logs', label: 'Logs', icon: 'Activity' },
  ]), [bootstrap.singletons]);

  const activeSection = sections.find((section) => section.id === currentSection) ?? sections[0];

  if (!open) return null;

  return (
    <Fragment>
      <OverlayBackdrop onClick={onClose} />
      <OverlayPanel
        title="Settings"
        description="Move through site-level settings without losing the content currently loaded underneath."
        onClose={onClose}
        className="workspace-overlay--settings"
      >
        <div className="workspace-browser">
          <aside className="workspace-browser__sidebar">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`workspace-browser__nav-item${activeSection.id === section.id ? ' is-active' : ''}`}
                onClick={() => onChangeSection(section.id)}
              >
                <span className="workspace-browser__nav-icon"><CarbonIcon name={section.icon} size={16} /></span>
                <span>{section.label}</span>
              </button>
            ))}
          </aside>
          <section className="workspace-browser__main workspace-browser__main--settings">
            {activeSection.id === 'site' ? (
              <EmbeddedSiteSettings bootstrap={bootstrap} setBootstrap={setBootstrap} pushNotice={pushNotice} />
            ) : activeSection.id === 'account' ? (
              <EmbeddedAccountSettings bootstrap={bootstrap} setBootstrap={setBootstrap} pushNotice={pushNotice} />
            ) : activeSection.id === 'api' ? (
              <EmbeddedSettingsScreen>
                <ApiPage bootstrap={bootstrap} />
              </EmbeddedSettingsScreen>
            ) : activeSection.id === 'logs' ? (
              <EmbeddedSettingsScreen>
                <LogsPage />
              </EmbeddedSettingsScreen>
            ) : (
              <EmbeddedSingletonSettings
                bootstrap={bootstrap}
                singletonData={singletonData}
                setSingletonData={setSingletonData}
                singletonId={activeSection.id}
                pushNotice={pushNotice}
              />
            )}
          </section>
        </div>
      </OverlayPanel>
    </Fragment>
  );
}

function CascadingMenu({ items, onClose, style, className = '' }) {
  const [openId, setOpenId] = useState(null);
  const itemRefs = useRef({});

  function submenuStyle(id) {
    const anchor = itemRefs.current[id];
    if (!anchor) return null;
    const rect = anchor.getBoundingClientRect();
    const width = 240;
    const gap = 4;
    let left = rect.right + gap;
    if (left + width > window.innerWidth - 12) {
      left = Math.max(12, rect.left - width - gap);
    }
    return {
      position: 'fixed',
      top: `${Math.max(12, Math.min(rect.top, window.innerHeight - 240))}px`,
      left: `${left}px`,
      width: `${width}px`,
    };
  }

  return (
    <div className={`workspace-menu ${className}`.trim()} style={style} role="menu">
      {items.map((item) => {
        const hasChildren = Array.isArray(item.children) && item.children.length > 0;
        const isOpen = openId === item.id;
        return (
          <Fragment key={item.id}>
            <button
              ref={(el) => { itemRefs.current[item.id] = el; }}
              type="button"
              role="menuitem"
              className={`workspace-menu__item${isOpen ? ' is-active' : ''}`}
              onMouseEnter={() => {
                if (hasChildren) setOpenId(item.id);
                else setOpenId(null);
              }}
              onFocus={() => {
                if (hasChildren) setOpenId(item.id);
              }}
              onClick={() => {
                if (hasChildren) {
                  setOpenId((current) => (current === item.id ? null : item.id));
                  return;
                }
                item.onSelect?.();
              }}
              aria-haspopup={hasChildren ? 'menu' : undefined}
              aria-expanded={hasChildren ? isOpen : undefined}
            >
              <span>{item.label}</span>
              {item.shortcut ? <span className="workspace-menu__shortcut">{item.shortcut}</span> : null}
              {hasChildren ? <CarbonIcon name="ChevronRight" size={14} /> : null}
            </button>
            {hasChildren && isOpen ? (
              <CascadingMenu
                items={item.children}
                onClose={onClose}
                style={submenuStyle(item.id)}
                className="workspace-menu--submenu"
              />
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}

export function WordPressMenuPopover({ open, anchorRef, menuTree, onClose }) {
  const style = useAnchorPosition(anchorRef, { width: 240, offsetY: 8, align: 'left', open });

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open || !style) return null;

  return (
    <Fragment>
      <OverlayBackdrop onClick={onClose} className="workspace-overlay-backdrop--clear" />
      <CascadingMenu items={menuTree} onClose={onClose} style={style} />
    </Fragment>
  );
}
