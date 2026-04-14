import React, { Fragment, useMemo, useState } from 'react';
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  Button,
  Card,
  CardBody,
} from '@wordpress/components';
import { CarbonIcon, ChevronLeft, OpenPanelLeft, Menu, getNavIcon } from '../lib/icons.jsx';
import { collectionPathForModel, normalizeAdminColor, toTitleCase } from '../lib/helpers.js';
import { NoticeStack } from './controls.jsx';
import { NotificationBell, SidekickPanel, useNotificationArchive } from './notifications.jsx';
import { DashboardPage } from './dashboard.jsx';
import { PagesPage, PageEditorPage } from './pages.jsx';
import { CommentsPage, CommentEditorPage } from './comments.jsx';
import { MediaPage, MediaEditorPage } from './media.jsx';
import { UsersPage, UserEditorPage } from './users.jsx';
import { CollectionListPage, CollectionEditorPage } from './collections.jsx';
import { SiteSettingsPage, SingletonEditorPage } from './settings.jsx';
import { DomainsPage, IntegrationsPage, ApiPage, LogsPage, PlaceholderPage } from './workspace.jsx';
import { DocsPage } from '../docs.jsx';

/* ── Not Found ── */
function NotFoundScreen() {
  return (
    <div className="screen">
      <Card className="surface-card">
        <CardBody>
          <h1 style={{ margin: 0, fontSize: '16px' }}>Not Found</h1>
          <p className="field-hint">This admin route does not exist.</p>
        </CardBody>
      </Card>
    </div>
  );
}

/* ── Navigation Group ── */
export function NavigationGroup({ id, title, items, state, onToggle }) {
  if (!items.length) return null;
  const isOpen = state[id] ?? true;
  return (
    <section className="navigation-group">
      <button className="navigation-group__toggle" onClick={() => onToggle(id)} type="button">
        <span>{title}</span>
        <span className={isOpen ? 'navigation-group__chevron is-open' : 'navigation-group__chevron'}>▾</span>
      </button>
      {isOpen ? (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <NavLink
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) => (isActive ? 'nav-link is-active' : 'nav-link')}
              >
                <span className="nav-link__icon">{getNavIcon(item)}</span>
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/* ── Sidebar User Menu ── */
function SidebarUserMenu({ currentUser, sidebarCollapsed, navigate }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);
  const triggerRef = React.useRef(null);
  const [popoverStyle, setPopoverStyle] = useState(null);
  const displayName = currentUser?.name || currentUser?.displayName || currentUser?.username || 'User';
  const username = currentUser?.username ? `@${currentUser.username}` : '';
  const primaryRole = currentUser?.roles?.[0] ? toTitleCase(currentUser.roles[0]) : 'User';
  const avatarUrl = currentUser?.avatarUrl || currentUser?.avatarUrls?.['96'] || currentUser?.avatar_urls?.['96'] || '';

  const updatePopoverPosition = React.useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const gutter = 12;
    const desiredWidth = sidebarCollapsed
      ? 280
      : Math.max(240, Math.min(320, rect.width + 24));
    const width = Math.min(desiredWidth, viewportWidth - (gutter * 2));
    const left = Math.min(
      Math.max(gutter, rect.left),
      viewportWidth - width - gutter
    );
    const bottom = Math.max(gutter, viewportHeight - rect.top + 10);

    setPopoverStyle({
      left: `${left}px`,
      bottom: `${bottom}px`,
      width: `${width}px`,
      maxWidth: `calc(100vw - ${gutter * 2}px)`,
    });
  }, [sidebarCollapsed]);

  React.useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  React.useEffect(() => {
    if (!open) return undefined;

    updatePopoverPosition();

    function handleViewportChange() {
      updatePopoverPosition();
    }

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [open, updatePopoverPosition]);

  return (
    <div className="sidebar__footer" ref={ref}>
      <button
        ref={triggerRef}
        className="sidebar__user-profile"
        onClick={() => setOpen((v) => !v)}
        title={sidebarCollapsed ? displayName : undefined}
        type="button"
      >
        <div className="sidebar__user-avatar">
          {avatarUrl ? <img src={avatarUrl} alt="" /> : <CarbonIcon name="UserAvatar" size={20} />}
        </div>
        {!sidebarCollapsed && (
          <div className="sidebar__user-info">
            <span className="sidebar__user-name">{displayName}</span>
            <span className="sidebar__user-role">{primaryRole}</span>
          </div>
        )}
      </button>
      {open && (
        <div
          className={`sidebar-popover${sidebarCollapsed ? ' is-floating' : ''}`}
          style={popoverStyle ?? undefined}
        >
          <div className="sidebar-popover__header">
            <div className="sidebar__user-avatar" style={{ width: 36, height: 36 }}>
              {avatarUrl ? <img src={avatarUrl} alt="" /> : <CarbonIcon name="UserAvatar" size={22} />}
            </div>
            <div>
              <strong>{displayName}</strong>
              <span style={{ display: 'block', fontSize: 11, color: 'var(--wp-admin-text-muted)' }}>
                {username || primaryRole}
              </span>
            </div>
          </div>
          <div className="sidebar-popover__items">
            <button className="sidebar-popover__item" onClick={() => { setOpen(false); navigate('/users/me'); }}>
              Edit Profile
            </button>
            <button className="sidebar-popover__item" onClick={() => { setOpen(false); navigate('/docs'); }}>
              Docs
            </button>
            <a className="sidebar-popover__item" href={window.location.origin} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
              View Site
            </a>
            <a className="sidebar-popover__item" href={`${window.location.origin}/wp-admin/?classic-admin=1`} onClick={() => setOpen(false)}>
              Classic WP Admin
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── App Shell ── */
export function AppShell({ bootstrap, setBootstrap, recordsByModel, setRecordsByModel, singletonData, setSingletonData }) {
  const [notices, setNotices] = useState([]);
  const [dashWidgetConfig, setDashWidgetConfig] = useState(null);
  const {
    notifications,
    archiveNotification,
    markAllRead,
    markNonErrorsRead,
    clearAll: clearAllNotifications,
  } = useNotificationArchive();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem('portfolio-light-sidebar-collapsed') === '1';
    } catch {
      return false;
    }
  });
  const [groupState, setGroupState] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem('portfolio-light-nav-groups') || '{}');
    } catch {
      return {};
    }
  });

  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidekickOpen, setSidekickOpen] = useState(() => {
    try {
      return window.localStorage.getItem('wplite-sidekick-open') === '1';
    } catch {
      return false;
    }
  });
  const [sidekickTab, setSidekickTab] = useState(() => {
    try {
      return window.localStorage.getItem('wplite-sidekick-tab') || 'notifications';
    } catch {
      return 'notifications';
    }
  });

  function toggleSidekick() {
    setSidekickOpen((prev) => {
      const next = !prev;
      try { window.localStorage.setItem('wplite-sidekick-open', next ? '1' : '0'); } catch {}
      return next;
    });
  }

  function closeSidekick() {
    setSidekickOpen(false);
    try { window.localStorage.setItem('wplite-sidekick-open', '0'); } catch {}
  }

  function handleSidekickTabChange(name) {
    setSidekickTab(name);
    try { window.localStorage.setItem('wplite-sidekick-tab', name); } catch {}
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  function toggleSidebar() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try { window.localStorage.setItem('portfolio-light-sidebar-collapsed', next ? '1' : '0'); } catch {}
      return next;
    });
  }

  function closeMobileSidebar() {
    setMobileOpen(false);
  }

  function dismissNotice(id) {
    setNotices((current) => current.filter((n) => n.id !== id));
  }

  function pushNotice(notice) {
    const id = Date.now() + Math.random();
    setNotices((current) => [...current, { id, ...notice }]);
    // Mirror to the persistent notification archive so users have a
    // "what happened recently" surface alongside the transient Snackbar.
    archiveNotification({
      id,
      status: notice?.status,
      message: notice?.message,
      timestamp: Date.now(),
    });
    if (notice?.status !== 'error') {
      setTimeout(() => {
        dismissNotice(id);
      }, 4000);
    }
  }

  function toggleGroup(id) {
    setGroupState((current) => {
      const next = { ...current, [id]: !(current[id] ?? true) };
      window.localStorage.setItem('portfolio-light-nav-groups', JSON.stringify(next));
      return next;
    });
  }

  const groupedNavigation = useMemo(() => {
    const commentsEnabled = bootstrap.site?.commentsEnabled === true;

    // Top-level items (not collapsible)
    const topLevel = [
      { id: 'dashboard', label: 'Dashboard', path: '/', kind: 'dashboard' },
      { id: 'domains', label: 'Domains', path: '/domains', kind: 'service' },
      { id: 'integrations', label: 'Integrations', path: '/integrations', kind: 'service' },
    ];

    const core = [
      { id: 'pages', label: 'Pages', path: '/pages', kind: 'core' },
      { id: 'post', label: 'Posts', path: '/posts', kind: 'core' },
      ...(commentsEnabled ? [{ id: 'comments', label: 'Comments', path: '/comments', kind: 'core' }] : []),
      { id: 'media', label: 'Media', path: '/media', kind: 'core' },
    ];

    const coreIds = new Set(core.map((c) => c.id));
    const collections = bootstrap.navigation
      .filter((item) => item.kind === 'collection' && !coreIds.has(item.id))
      .map((item) => ({ ...item }));

    const settings = [
      { id: 'site', label: 'Site', path: '/settings/site', kind: 'setting' },
      { id: 'users', label: 'Users', path: '/users', kind: 'setting' },
      ...bootstrap.navigation
      .filter((item) => item.kind === 'singleton')
      .map((item) => ({ ...item })),
      { id: 'logs', label: 'Logs', path: '/settings/logs', kind: 'setting' },
      { id: 'api', label: 'API', path: '/settings/api', kind: 'setting' },
    ];

    return { topLevel, core, collections, settings };
  }, [bootstrap.navigation, bootstrap.site?.commentsEnabled]);

  const breadcrumbSegments = useMemo(() => {
    if (location.pathname === '/') return [{ label: 'Dashboard', path: '/' }];
    const parts = location.pathname.split('/').filter(Boolean);
    return parts.map((seg, i) => ({
      label: toTitleCase(seg),
      path: '/' + parts.slice(0, i + 1).join('/'),
    }));
  }, [location.pathname]);
  const isEditorRoute = useMemo(() => {
    const editorPaths = [
      '/pages',
      ...bootstrap.models
        .filter((model) => model?.supports?.includes('editor'))
        .map((model) => collectionPathForModel(model)),
    ];

    return editorPaths.some((path) => {
      const rest = location.pathname.slice(path.length).replace(/\/+$/, '');
      return location.pathname.startsWith(path) && rest.length > 1 && rest.startsWith('/');
    });
  }, [bootstrap.models, location.pathname]);
  const adminColorScheme = normalizeAdminColor(
    bootstrap.currentUser?.preferences?.adminColor ?? singletonData.profile?.color_scheme
  );

  return (
    <div className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}${mobileOpen ? ' sidebar-mobile-open' : ''}${isEditorRoute ? ' is-editor-route' : ''}${sidekickOpen ? ' sidekick-open' : ''} color-scheme-${adminColorScheme}`}>
      <div className="sidebar-overlay" onClick={closeMobileSidebar} />
      <aside className="sidebar">
        <div className="sidebar__brand">
          <div className="sidebar__brand-row">
            <button
              className={`sidebar__site-icon${!sidebarCollapsed && !bootstrap.site.icon_url ? ' sidebar__site-icon--placeholder' : ''}`}
              type="button"
              onClick={toggleSidebar}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? (
                <OpenPanelLeft size={18} />
              ) : bootstrap.site.icon_url ? (
                <img src={bootstrap.site.icon_url} alt="" />
              ) : (
                (bootstrap.site.title || 'S')[0].toUpperCase()
              )}
            </button>
            {!sidebarCollapsed && (
              <div className="sidebar__brand-text">
                <h1>{bootstrap.site.title}</h1>
                <p>{bootstrap.site.tagline}</p>
              </div>
            )}
          </div>
          <button
            className="sidebar__collapse-btn"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            type="button"
          >
            {sidebarCollapsed ? <OpenPanelLeft size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className="sidebar__nav" onClick={closeMobileSidebar}>
          <ul className="navigation-group">
            {groupedNavigation.topLevel.map((item) => (
              <li key={item.id}>
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) => (isActive ? 'nav-link is-active' : 'nav-link')}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <span className="nav-link__icon">{getNavIcon(item)}</span>
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
          {!sidebarCollapsed ? (
            <Fragment>
              <NavigationGroup id="core" title="Core" items={groupedNavigation.core} state={groupState} onToggle={toggleGroup} />
              <NavigationGroup id="collections" title="Collections" items={groupedNavigation.collections} state={groupState} onToggle={toggleGroup} />
              <NavigationGroup id="settings" title="Settings" items={groupedNavigation.settings} state={groupState} onToggle={toggleGroup} />
            </Fragment>
          ) : (
            <Fragment>
              {[...groupedNavigation.core, ...groupedNavigation.collections, ...groupedNavigation.settings].map((item) => (
                <NavLink
                  key={item.id}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) => (isActive ? 'nav-link is-active' : 'nav-link')}
                  title={item.label}
                >
                  <span className="nav-link__icon">{getNavIcon(item)}</span>
                </NavLink>
              ))}
            </Fragment>
          )}
        </nav>

        <SidebarUserMenu
          currentUser={bootstrap.currentUser}
          sidebarCollapsed={sidebarCollapsed}
          navigate={navigate}
        />
      </aside>

      <div className="canvas-frame">
        <main className="main-panel">
          <div className="main-panel__topbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)} type="button" title="Open menu">
                <Menu size={20} />
              </button>
              <nav className="breadcrumbs" aria-label="Breadcrumb">
                {breadcrumbSegments.map((seg, i) => (
                  <Fragment key={seg.path}>
                    {i > 0 && <span className="breadcrumbs__sep">/</span>}
                    {i < breadcrumbSegments.length - 1 ? (
                      <NavLink to={seg.path} className="breadcrumbs__link">{seg.label}</NavLink>
                    ) : (
                      <span className="breadcrumbs__current">{seg.label}</span>
                    )}
                  </Fragment>
                ))}
              </nav>
            </div>
            <div className="main-panel__topbar-actions">
              <NotificationBell
                unreadCount={unreadCount}
                isOpen={sidekickOpen}
                onClick={toggleSidekick}
              />
            </div>
          </div>
          <div className="main-panel__content">
            <Routes>
              <Route
                path="/"
                element={
                  <DashboardPage
                    bootstrap={bootstrap}
                    recordsByModel={recordsByModel}
                    singletonData={singletonData}
                    pushNotice={pushNotice}
                  />
                }
              />
              <Route
                path="/docs"
                element={<DocsPage bootstrap={bootstrap} />}
              />
              <Route
                path="/domains"
                element={<DomainsPage bootstrap={bootstrap} pushNotice={pushNotice} />}
              />
              <Route
                path="/integrations"
                element={<IntegrationsPage pushNotice={pushNotice} />}
              />
              <Route
                path="/automations"
                element={
                  <PlaceholderPage
                    eyebrow="Workspace"
                    title="Automations"
                    lede="Triggers, actions, and background workflows will attach to content once the service layer lands."
                    summary="Site-wide configuration and preferences."
                  />
                }
              />
              <Route path="/pages" element={<PagesPage pushNotice={pushNotice} />} />
              <Route path="/pages/:pageId" element={<PageEditorPage bootstrap={bootstrap} pushNotice={pushNotice} />} />
              <Route path="/comments" element={<CommentsPage bootstrap={bootstrap} pushNotice={pushNotice} />} />
              <Route path="/comments/:commentId" element={<CommentEditorPage bootstrap={bootstrap} pushNotice={pushNotice} />} />
              <Route path="/media" element={<MediaPage pushNotice={pushNotice} />} />
              <Route path="/media/:mediaId" element={<MediaEditorPage pushNotice={pushNotice} />} />
              <Route path="/users" element={<UsersPage bootstrap={bootstrap} pushNotice={pushNotice} />} />
              <Route path="/users/:userId" element={<UserEditorPage bootstrap={bootstrap} setBootstrap={setBootstrap} pushNotice={pushNotice} />} />
              <Route
                path="/:collectionPath"
                element={<CollectionListPage bootstrap={bootstrap} recordsByModel={recordsByModel} />}
              />
              <Route
                path="/:collectionPath/:itemId"
                element={
                  <CollectionEditorPage
                    bootstrap={bootstrap}
                    recordsByModel={recordsByModel}
                    setRecordsByModel={setRecordsByModel}
                    pushNotice={pushNotice}
                  />
                }
              />
              <Route
                path="/settings/site"
                element={
                  <SiteSettingsPage
                    bootstrap={bootstrap}
                    setBootstrap={setBootstrap}
                    pushNotice={pushNotice}
                  />
                }
              />
              <Route
                path="/settings/:singletonId"
                element={
                  <SingletonEditorPage
                    bootstrap={bootstrap}
                    singletonData={singletonData}
                    setSingletonData={setSingletonData}
                    pushNotice={pushNotice}
                  />
                }
              />
              <Route
                path="/settings/logs"
                element={<LogsPage />}
              />
              <Route
                path="/settings/api"
                element={<ApiPage bootstrap={bootstrap} />}
              />
              <Route path="*" element={<NotFoundScreen />} />
            </Routes>
          </div>
        </main>
      </div>
      <SidekickPanel
        open={sidekickOpen}
        onClose={closeSidekick}
        activeTab={sidekickTab}
        onTabChange={handleSidekickTabChange}
        notifications={notifications}
        onMarkAllRead={markAllRead}
        onClearAll={clearAllNotifications}
        onOpen={markNonErrorsRead}
      />
      <NoticeStack notices={notices} onDismiss={dismissNotice} />
    </div>
  );
}
