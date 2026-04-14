import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Button, DropdownMenu } from '@wordpress/components';
import {
  CarbonIcon,
  getNavIcon,
} from '../lib/icons.jsx';
import { normalizeAppPath } from '../lib/config.js';
import {
  collectionPathForModel,
  editorRouteForModel,
  normalizeAdminColor,
} from '../lib/helpers.js';
import { NoticeStack } from './controls.jsx';
import { CommandBar } from './command-bar.jsx';
import { AssistantChat } from './assistant-chat.jsx';
import { NotificationBell, useNotificationArchive } from './notifications.jsx';
import { DashboardPage } from './dashboard.jsx';
import { PagesPage, PageEditorPage } from './pages.jsx';
import { CommentsPage, CommentEditorPage } from './comments.jsx';
import { MediaEditorPage } from './media.jsx';
import { UsersPage, UserEditorPage } from './users.jsx';
import { CollectionListPage, CollectionEditorPage } from './collections.jsx';
import { SiteSettingsPage, SingletonEditorPage } from './settings.jsx';
import { DomainsPage, IntegrationsPage, ApiPage, LogsPage, PlaceholderPage } from './workspace.jsx';
import { DocsPage } from '../docs.jsx';
import {
  ContentPopover,
  MediaPopover,
  NotificationsPopover,
  SettingsPopover,
  WordPressMenuPopover,
} from './workspace-popovers.jsx';
import { WorkspaceSurfaceProvider, useWorkspaceSurface } from './workspace-context.jsx';

function NotFoundScreen() {
  return (
    <div className="screen">
      <div className="workspace-empty-panel workspace-empty-panel--compact">
        <strong>Not Found</strong>
        <p>This admin route does not exist.</p>
      </div>
    </div>
  );
}

function WordPressMark({ size = 16 }) {
  return (
    <svg viewBox="0 0 122.52 122.523" width={size} height={size} aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M8.708 61.26c0 20.802 12.089 38.779 29.619 47.298L13.258 39.872a52.32 52.32 0 0 0-4.55 21.388zm90.061-2.713c0-6.495-2.333-10.993-4.334-14.494-2.664-4.329-5.161-7.995-5.161-12.324 0-4.831 3.664-9.328 8.825-9.328.233 0 .454.029.681.042-9.35-8.566-21.807-13.796-35.489-13.796-18.36 0-34.513 9.42-43.91 23.688 1.233.037 2.395.063 3.382.063 5.497 0 14.006-.667 14.006-.667 2.833-.167 3.167 3.994.337 4.329 0 0-2.847.335-6.015.501l19.138 56.925 11.501-34.493-8.188-22.434c-2.83-.166-5.511-.5-5.511-.5-2.832-.166-2.5-4.496.332-4.329 0 0 8.679.667 13.843.667 5.496 0 14.006-.667 14.006-.667 2.835-.167 3.168 3.994.337 4.329 0 0-2.853.335-6.015.501l18.992 56.494 5.242-17.517c2.272-7.269 4.001-12.49 4.001-16.988zM64.087 65.796l-15.768 45.819c4.708 1.384 9.687 2.141 14.851 2.141 6.125 0 11.999-1.058 17.465-2.979-.141-.225-.269-.464-.374-.724l-16.174-44.257zm45.304-29.877c.226 1.674.354 3.471.354 5.404 0 5.333-.996 11.328-3.996 18.824l-16.053 46.413c15.624-9.111 26.133-26.038 26.133-45.426.002-9.137-2.333-17.729-6.438-25.215zM61.262 0C27.484 0 0 27.482 0 61.26c0 33.783 27.484 61.263 61.262 61.263 33.778 0 61.265-27.48 61.265-61.263C122.526 27.482 95.039 0 61.262 0zm0 119.715c-32.23 0-58.453-26.223-58.453-58.455 0-32.23 26.222-58.451 58.453-58.451 32.229 0 58.45 26.221 58.45 58.451 0 32.232-26.221 58.455-58.45 58.455z"
      />
    </svg>
  );
}

function resolveDefaultCanvasPath(bootstrap, recordsByModel) {
  const pages = bootstrap?.pages ?? [];
  const frontPageId = Number(bootstrap?.site?.pageOnFront || 0);

  if (frontPageId) {
    const frontPage = pages.find((page) => Number(page.id) === frontPageId);
    if (frontPage) {
      return `/pages/${frontPage.id}`;
    }
  }

  const homeManifest = Object.values(bootstrap?.routeManifest ?? {}).find((entry) => entry?.path === '/' && entry?.page?.id);
  if (homeManifest?.page?.id) {
    return `/pages/${homeManifest.page.id}`;
  }

  if (pages[0]?.id) {
    return `/pages/${pages[0].id}`;
  }

  const postModel = (bootstrap?.models ?? []).find((item) => item?.id === 'post');
  if (postModel && recordsByModel?.post?.[0]?.id) {
    return editorRouteForModel(postModel, recordsByModel.post[0].id);
  }

  const editorModel = (bootstrap?.models ?? []).find((model) => model?.supports?.includes('editor') && (recordsByModel?.[model.id] ?? []).length > 0);
  if (editorModel) {
    return editorRouteForModel(editorModel, recordsByModel[editorModel.id][0].id);
  }

  return '/dashboard';
}

function WorkspaceShellFrame({ bootstrap, setBootstrap, recordsByModel, setRecordsByModel, singletonData, setSingletonData }) {
  const { surface } = useWorkspaceSurface();
  const [notices, setNotices] = useState([]);
  const [commandBarOpen, setCommandBarOpen] = useState(false);
  const {
    notifications,
    archiveNotification,
    markAllRead,
    clearAll: clearAllNotifications,
  } = useNotificationArchive();
  const location = useLocation();
  const navigate = useNavigate();
  const [openPopover, setOpenPopover] = useState(null);
  const [contentSection, setContentSection] = useState('pages');
  const [settingsSection, setSettingsSection] = useState('site');
  const [menuPath, setMenuPath] = useState([]);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const wpMenuRef = useRef(null);
  const notificationsRef = useRef(null);

  const defaultCanvasPath = useMemo(
    () => resolveDefaultCanvasPath(bootstrap, recordsByModel),
    [bootstrap, recordsByModel]
  );

  const adminColorScheme = normalizeAdminColor(
    bootstrap.currentUser?.preferences?.adminColor ?? singletonData.profile?.color_scheme
  );

  const dismissNotice = useCallback((id) => {
    setNotices((current) => current.filter((notice) => notice.id !== id));
  }, []);

  const pushNotice = useCallback((notice) => {
    const id = Date.now() + Math.random();
    setNotices((current) => [...current, { id, ...notice }]);
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
  }, [archiveNotification, dismissNotice]);

  const contentSections = useMemo(() => {
    const sections = [
      {
        id: 'pages',
        label: 'Pages',
        listPath: '/pages',
      },
    ];

    const postModel = (bootstrap.models ?? []).find((item) => item?.id === 'post');
    if (postModel) {
      sections.push({
        id: 'post',
        label: postModel.label || 'Posts',
        listPath: '/posts',
      });
    }

    for (const model of bootstrap.models ?? []) {
      if (!model || model.public === false || model.id === 'page' || model.id === 'post') continue;
      sections.push({
        id: model.id,
        label: model.label,
        listPath: collectionPathForModel(model),
      });
    }

    return sections;
  }, [bootstrap.models]);

  const routeSettingsSections = useMemo(() => {
    return [
      { id: 'site', path: '/settings/site' },
      ...(bootstrap.singletons ?? []).map((singleton) => ({ id: singleton.id, path: `/settings/${singleton.id}` })),
      { id: 'api', path: '/settings/api' },
      { id: 'logs', path: '/settings/logs' },
    ];
  }, [bootstrap.singletons]);

  useEffect(() => {
    const path = location.pathname.replace(/\/+$/, '') || '/';

    if (path === '/') {
      navigate(defaultCanvasPath, { replace: true });
      return;
    }

    const contentMatch = contentSections.find((section) => section.listPath === path);
    if (contentMatch) {
      setContentSection(contentMatch.id);
      setOpenPopover('content');
      navigate(defaultCanvasPath, { replace: true });
      return;
    }

    if (path === '/media') {
      setOpenPopover('media');
      navigate(defaultCanvasPath, { replace: true });
      return;
    }

    const settingsMatch = routeSettingsSections.find((section) => section.path === path);
    if (settingsMatch) {
      setSettingsSection(settingsMatch.id);
      setOpenPopover('settings');
      navigate(defaultCanvasPath, { replace: true });
      return;
    }
  }, [contentSections, defaultCanvasPath, location.pathname, navigate, routeSettingsSections]);

  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/pages/')) {
      setContentSection('pages');
      return;
    }
    if (path.startsWith('/posts/')) {
      setContentSection('post');
      return;
    }
    for (const model of bootstrap.models ?? []) {
      if (!model || model.id === 'page' || model.id === 'post') continue;
      const modelPath = `${collectionPathForModel(model)}/`;
      if (path.startsWith(modelPath)) {
        setContentSection(model.id);
        return;
      }
    }
  }, [bootstrap.models, location.pathname]);

  function togglePopover(name) {
    setOpenPopover((current) => (current === name ? null : name));
  }

  async function handleShare() {
    try {
      if (typeof surface.share === 'function') {
        await surface.share();
      } else {
        await navigator.clipboard.writeText(window.location.href);
        pushNotice({ status: 'success', message: 'Link copied.' });
      }
    } catch (error) {
      pushNotice({ status: 'error', message: error?.message || 'Failed to share.' });
    }
  }

  async function handleSave() {
    if (typeof surface.save !== 'function' || surface.isSaving) return;
    await surface.save();
  }

  async function handlePublish() {
    if (typeof surface.publish !== 'function' || surface.isSaving) return;
    await surface.publish();
  }

  function handleOpenCanvasPath(path) {
    setOpenPopover(null);
    navigate(normalizeAppPath(path));
  }

  function handleCommandAction(item) {
    if (!item?.action) return false;

    if (item.action === 'open-overlay') {
      if (item.section) {
        if (item.overlay === 'content') setContentSection(item.section);
        if (item.overlay === 'settings') setSettingsSection(item.section);
      }
      setOpenPopover(item.overlay);
      return true;
    }

    return false;
  }

  const menuTree = useMemo(() => ([
    {
      id: 'content',
      label: 'Content',
      children: contentSections.map((section) => ({
        id: section.id,
        label: section.label,
        onSelect: () => {
          setContentSection(section.id);
          setOpenPopover('content');
        },
      })),
    },
    {
      id: 'media',
      label: 'Media',
      onSelect: () => setOpenPopover('media'),
    },
    {
      id: 'settings',
      label: 'Settings',
      children: [
        {
          id: 'general',
          label: 'General',
          onSelect: () => {
            setSettingsSection('site');
            setOpenPopover('settings');
          },
        },
        {
          id: 'singletons',
          label: 'Singletons',
          children: (bootstrap.singletons ?? []).map((singleton) => ({
            id: singleton.id,
            label: singleton.label,
            onSelect: () => {
              setSettingsSection(singleton.id);
              setOpenPopover('settings');
            },
          })),
        },
        {
          id: 'account',
          label: 'Account',
          onSelect: () => {
            setSettingsSection('account');
            setOpenPopover('settings');
          },
        },
      ],
    },
    {
      id: 'view-site',
      label: 'View Site',
      onSelect: () => {
        window.open(window.location.origin, '_blank', 'noopener,noreferrer');
        setOpenPopover(null);
      },
    },
    {
      id: 'classic-admin',
      label: 'Classic WP Admin',
      onSelect: () => {
        window.open(`${window.location.origin}/wp-admin/?classic-admin=1`, '_blank', 'noopener,noreferrer');
        setOpenPopover(null);
      },
    },
  ]), [bootstrap.singletons, contentSections]);

  useEffect(() => {
    if (openPopover === 'wp-menu') {
      setMenuPath([menuTree[0]?.id]);
    }
  }, [menuTree, openPopover]);

  const contextControls = useMemo(() => {
    const controls = [...(surface.moreActions ?? [])];
    if (!controls.length) return [];
    return controls.map((item, index) => ({
      title: item.title,
      icon: item.icon || null,
      onClick: item.onClick,
      isDisabled: item.isDisabled,
      key: item.key || `${item.title}-${index}`,
    }));
  }, [surface.moreActions]);

  const commandShortcut = useMemo(() => {
    try {
      return /Mac|iPhone|iPad|iPod/.test(window.navigator.platform) ? '⌘K' : 'Ctrl K';
    } catch {
      return 'Ctrl K';
    }
  }, []);

  return (
    <div className={`app-shell app-shell--workspace color-scheme-${adminColorScheme}${mobileChatOpen ? ' chat-mobile-open' : ''}`}>
      <div className="workspace-layout">
        <aside className="workspace-rail">
          <div className="workspace-rail__header">
            <button type="button" className="workspace-rail__logo" onClick={() => navigate(normalizeAppPath(defaultCanvasPath))}>
              <WordPressMark size={18} />
            </button>
            <div>
              <p>Workspace</p>
              <strong>{bootstrap.site.title}</strong>
            </div>
          </div>
          <AssistantChat />
        </aside>

        <div className="workspace-main">
          <header className="workspace-topbar">
            <div className="workspace-topbar__left">
              <button
                type="button"
                className="workspace-topbar__mobile-chat"
                onClick={() => setMobileChatOpen((current) => !current)}
                aria-label="Toggle AI sidebar"
              >
                <CarbonIcon name="Chat" size={16} />
              </button>
              <button
                ref={wpMenuRef}
                type="button"
                className={`workspace-topbar__wp-button${openPopover === 'wp-menu' ? ' is-active' : ''}`}
                onClick={() => togglePopover('wp-menu')}
                aria-label="Open WordPress menu"
              >
                <WordPressMark size={16} />
              </button>
              <div className="workspace-topbar__site">
                <strong>{bootstrap.site.title}</strong>
              </div>
              <button
                type="button"
                className="workspace-topbar__search"
                onClick={() => setCommandBarOpen(true)}
                aria-label={`Search content or run a command (${commandShortcut})`}
              >
                <CarbonIcon name="Search" size={16} />
                <span>{surface.title ? `Search or jump from ${surface.title}` : 'Search pages, posts, media, settings'}</span>
                <kbd>{commandShortcut}</kbd>
              </button>
            </div>

            <div className="workspace-topbar__right">
              <div className="workspace-topbar__toggles">
                <Button className={`workspace-topbar__toggle${openPopover === 'content' ? ' is-active' : ''}`} onClick={() => togglePopover('content')}>
                  Content
                </Button>
                <Button className={`workspace-topbar__toggle${openPopover === 'media' ? ' is-active' : ''}`} onClick={() => togglePopover('media')}>
                  Media
                </Button>
                <Button className={`workspace-topbar__toggle${openPopover === 'settings' ? ' is-active' : ''}`} onClick={() => togglePopover('settings')}>
                  Settings
                </Button>
                <div ref={notificationsRef}>
                  <NotificationBell
                    unreadCount={notifications.filter((item) => !item.read).length}
                    isOpen={openPopover === 'notifications'}
                    onClick={() => togglePopover('notifications')}
                  />
                </div>
              </div>

              <div className="workspace-topbar__actions">
                <Button variant="secondary" onClick={handleShare}>Share</Button>
                <Button variant="secondary" onClick={handleSave} disabled={!surface.canSave} isBusy={surface.isSaving}>
                  {surface.saveLabel || 'Save'}
                </Button>
                <Button variant="primary" onClick={handlePublish} disabled={!surface.canPublish} isBusy={surface.isSaving}>
                  {surface.publishLabel || 'Publish'}
                </Button>
                {contextControls.length > 0 ? (
                  <DropdownMenu
                    icon={<CarbonIcon name="OverflowMenuVertical" size={18} />}
                    label="Context actions"
                    controls={contextControls}
                    toggleProps={{ className: 'workspace-topbar__context' }}
                    popoverProps={{ placement: 'bottom-end' }}
                  />
                ) : (
                  <Button className="workspace-topbar__context" disabled>
                    <CarbonIcon name="OverflowMenuVertical" size={18} />
                  </Button>
                )}
              </div>
            </div>
          </header>

          <div className="workspace-canvas">
            <div className="workspace-canvas__inner">
              <Routes>
                <Route path="/" element={<Navigate to={defaultCanvasPath} replace />} />
                <Route path="/dashboard" element={<DashboardPage bootstrap={bootstrap} recordsByModel={recordsByModel} singletonData={singletonData} pushNotice={pushNotice} />} />
                <Route path="/docs" element={<DocsPage bootstrap={bootstrap} />} />
                <Route path="/domains" element={<DomainsPage bootstrap={bootstrap} pushNotice={pushNotice} />} />
                <Route path="/integrations" element={<IntegrationsPage pushNotice={pushNotice} />} />
                <Route path="/automations" element={<PlaceholderPage eyebrow="Workspace" title="Automations" lede="Triggers, actions, and background workflows will attach to content once the service layer lands." summary="Site-wide configuration and preferences." />} />
                <Route path="/pages" element={<PagesPage pushNotice={pushNotice} />} />
                <Route path="/pages/:pageId" element={<PageEditorPage key={`page-editor:${location.pathname}`} bootstrap={bootstrap} setBootstrap={setBootstrap} pushNotice={pushNotice} />} />
                <Route path="/comments" element={<CommentsPage bootstrap={bootstrap} pushNotice={pushNotice} />} />
                <Route path="/comments/:commentId" element={<CommentEditorPage key={`comment-editor:${location.pathname}`} bootstrap={bootstrap} pushNotice={pushNotice} />} />
                <Route path="/media/:mediaId" element={<MediaEditorPage key={`media-editor:${location.pathname}`} pushNotice={pushNotice} />} />
                <Route path="/users" element={<UsersPage bootstrap={bootstrap} pushNotice={pushNotice} />} />
                <Route path="/users/:userId" element={<UserEditorPage key={`user-editor:${location.pathname}`} bootstrap={bootstrap} setBootstrap={setBootstrap} pushNotice={pushNotice} />} />
                <Route path="/:collectionPath" element={<CollectionListPage bootstrap={bootstrap} recordsByModel={recordsByModel} />} />
                <Route path="/:collectionPath/:itemId" element={<CollectionEditorPage key={`collection-editor:${location.pathname}`} bootstrap={bootstrap} recordsByModel={recordsByModel} setRecordsByModel={setRecordsByModel} pushNotice={pushNotice} />} />
                <Route path="/settings/site" element={<SiteSettingsPage key={`site-settings:${location.pathname}`} bootstrap={bootstrap} setBootstrap={setBootstrap} pushNotice={pushNotice} />} />
                <Route path="/settings/:singletonId" element={<SingletonEditorPage key={`singleton-settings:${location.pathname}`} bootstrap={bootstrap} singletonData={singletonData} setSingletonData={setSingletonData} pushNotice={pushNotice} />} />
                <Route path="/settings/logs" element={<LogsPage />} />
                <Route path="/settings/api" element={<ApiPage bootstrap={bootstrap} />} />
                <Route path="*" element={<NotFoundScreen />} />
              </Routes>
            </div>
          </div>
        </div>
      </div>

      <ContentPopover
        open={openPopover === 'content'}
        bootstrap={bootstrap}
        recordsByModel={recordsByModel}
        currentPath={location.pathname}
        currentSection={contentSection}
        onChangeSection={setContentSection}
        onOpenItem={handleOpenCanvasPath}
        onClose={() => setOpenPopover(null)}
      />
      <MediaPopover
        open={openPopover === 'media'}
        onClose={() => setOpenPopover(null)}
        onOpenItem={handleOpenCanvasPath}
        pushNotice={pushNotice}
      />
      <SettingsPopover
        open={openPopover === 'settings'}
        bootstrap={bootstrap}
        setBootstrap={setBootstrap}
        singletonData={singletonData}
        setSingletonData={setSingletonData}
        currentSection={settingsSection}
        onChangeSection={setSettingsSection}
        onClose={() => setOpenPopover(null)}
        pushNotice={pushNotice}
        onNavigate={handleOpenCanvasPath}
      />
      <NotificationsPopover
        open={openPopover === 'notifications'}
        anchorRef={notificationsRef}
        notifications={notifications}
        onClose={() => setOpenPopover(null)}
        onMarkAllRead={markAllRead}
        onClearAll={clearAllNotifications}
      />
      <WordPressMenuPopover
        open={openPopover === 'wp-menu'}
        anchorRef={wpMenuRef}
        menuTree={menuTree}
        menuPath={menuPath}
        onChangePath={setMenuPath}
        onClose={() => setOpenPopover(null)}
      />

      <CommandBar
        bootstrap={bootstrap}
        recordsByModel={recordsByModel}
        isOpen={commandBarOpen}
        onOpen={() => setCommandBarOpen(true)}
        onClose={() => setCommandBarOpen(false)}
        onExecuteAction={handleCommandAction}
      />
      <NoticeStack notices={notices} onDismiss={dismissNotice} />
    </div>
  );
}

export function AppShell(props) {
  return (
    <WorkspaceSurfaceProvider>
      <WorkspaceShellFrame {...props} />
    </WorkspaceSurfaceProvider>
  );
}
