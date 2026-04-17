import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Button, CheckboxControl, Modal, Tooltip } from '@wordpress/components';
import { CarbonIcon } from '../lib/icons.jsx';
import { normalizeAppPath } from '../lib/config.js';
import {
  collectionPathForModel,
  editorRouteForModel,
  normalizeAdminColor,
  wpApiFetch,
} from '../lib/helpers.js';
import { NoticeStack } from './controls.jsx';
import { CommandBar } from './command-bar.jsx';
import { AssistantChat } from './assistant-chat.jsx';
import { AssistantProvider, useAssistant, AcpStatus } from './assistant-provider.jsx';
import { NotificationBell, useNotificationArchive } from './notifications.jsx';
import { PagesPage, PageEditorPage } from './pages.jsx';
import { CommentsPage, CommentEditorPage } from './comments.jsx';
import { MediaEditorPage } from './media.jsx';
import { UsersPage, UserEditorPage } from './users.jsx';
import { CollectionListPage, CollectionEditorPage } from './collections.jsx';
import { SiteSettingsPage, SingletonEditorPage } from './settings.jsx';
import { DomainsPage, IntegrationsPage, ApiPage, ConnectorsPage, LogsPage, PlaceholderPage } from './workspace.jsx';
import { DocsPage } from '../docs.jsx';
import {
  CommentsPopover,
  ContentPopover,
  MediaPopover,
  NotificationsPopover,
  SettingsPopover,
  UsersPopover,
  WordPressMenuPopover,
} from './workspace-popovers.jsx';
import { WorkspaceSurfaceProvider, useWorkspaceSurface, useEditorChrome } from './workspace-context.jsx';

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

function selectEditableText(element) {
  if (!element) return;
  const selection = window.getSelection?.();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
}

function InlineEditableTopbarText({
  value,
  placeholder,
  className,
  onCommit,
  confirmTitle,
  confirmDescription,
  confirmRememberKey = null,
  confirmRememberLabel = '',
}) {
  const editable = typeof onCommit === 'function';
  const elementRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [pendingValue, setPendingValue] = useState(null);
  const [rememberConfirm, setRememberConfirm] = useState(false);

  useEffect(() => {
    if (!editing && pendingValue == null) {
      setDraft(value ?? '');
    }
  }, [editing, pendingValue, value]);

  useEffect(() => {
    if (editing) return;
    const element = elementRef.current;
    if (!element) return;
    element.textContent = value || placeholder || '';
  }, [editing, placeholder, value]);

  useEffect(() => {
    if (!editing) return;
    const element = elementRef.current;
    if (!element) return;
    requestAnimationFrame(() => {
      element.focus();
      selectEditableText(element);
    });
  }, [editing]);

  async function applyChange(nextValue) {
    const result = await onCommit?.(nextValue);
    if (result === false) {
      setDraft(value ?? '');
      return;
    }
    setDraft(nextValue);
  }

  function commit(nextRaw) {
    const nextValue = nextRaw.trim();
    setEditing(false);
    if (nextValue === (value ?? '')) {
      setDraft(value ?? '');
      return;
    }

    if (confirmRememberKey) {
      try {
        if (window.localStorage.getItem(confirmRememberKey) === '1') {
          void applyChange(nextValue);
          return;
        }
      } catch {}
    }

    setPendingValue(nextValue);
  }

  function cancelEdit() {
    setEditing(false);
    setDraft(value ?? '');
  }

  if (!editable) {
    return (
      <span className={`${className}${value ? '' : ' is-placeholder'}`}>
        {value || placeholder || 'Untitled'}
      </span>
    );
  }

  return (
    <>
      <span
        ref={elementRef}
        className={`${className}${value ? '' : ' is-placeholder'}${editing ? ' is-editing' : ''}`}
        contentEditable={editing}
        suppressContentEditableWarning
        role={editing ? 'textbox' : 'button'}
        tabIndex={0}
        onClick={() => setEditing(true)}
        onFocus={() => {
          if (!editing) {
            setEditing(true);
          }
        }}
        onInput={(event) => setDraft(event.currentTarget.textContent ?? '')}
        onBlur={(event) => {
          if (pendingValue != null) return;
          commit(event.currentTarget.textContent ?? '');
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit(event.currentTarget.textContent ?? '');
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            cancelEdit();
          }
        }}
      >
        {value || placeholder || 'Untitled'}
      </span>

      {pendingValue != null ? (
        <Modal
          title={confirmTitle}
          onRequestClose={() => {
            setPendingValue(null);
            setRememberConfirm(false);
            setDraft(value ?? '');
          }}
        >
          <div className="workspace-confirm-modal">
            <p>{confirmDescription}</p>
            {confirmRememberKey && confirmRememberLabel ? (
              <CheckboxControl
                label={confirmRememberLabel}
                checked={rememberConfirm}
                onChange={setRememberConfirm}
              />
            ) : null}
            <div className="workspace-confirm-modal__actions">
              <Button
                variant="secondary"
                onClick={() => {
                  setPendingValue(null);
                  setRememberConfirm(false);
                  setDraft(value ?? '');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={async () => {
                  if (confirmRememberKey && rememberConfirm) {
                    try {
                      window.localStorage.setItem(confirmRememberKey, '1');
                    } catch {}
                  }
                  const nextValue = pendingValue;
                  setPendingValue(null);
                  setRememberConfirm(false);
                  await applyChange(nextValue);
                }}
              >
                Confirm
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
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

  return '/pages';
}

function ClaudeMark({ size = 14 }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      className="workspace-rail__claude-mark"
    >
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

function AssistantRailHeader({ onHide }) {
  const { status, statusError, sessionListOpen, setSessionListOpen, newSession } = useAssistant();

  let tone = 'muted';
  let statusTitle = status;
  if (status === AcpStatus.Ready) { tone = 'ok'; statusTitle = 'Ready'; }
  else if (status === AcpStatus.Prompting) { tone = 'active'; statusTitle = 'Thinking'; }
  else if (status === AcpStatus.Connecting || status === AcpStatus.Initializing) {
    tone = 'active'; statusTitle = 'Connecting';
  }
  else if (status === AcpStatus.Disconnected) {
    tone = 'warn';
    statusTitle = statusError
      ? `Disconnected: ${statusError}`
      : 'Disconnected — is the ACP bridge still running? Check the wp-lite dev terminal.';
  }
  else if (status === AcpStatus.Error) {
    tone = 'err'; statusTitle = statusError ? `Error: ${statusError}` : 'Error';
  }
  else if (status === AcpStatus.Idle) { statusTitle = 'Idle'; }

  return (
    <div className="workspace-rail__header">
      <span className="workspace-rail__title">
        <Tooltip text={statusTitle}>
          <span
            className={`workspace-rail__claude-status workspace-rail__claude-status--${tone}`}
            aria-label={statusTitle}
            tabIndex={0}
          >
            <ClaudeMark size={14} />
          </span>
        </Tooltip>
        <span>Assistant</span>
      </span>
      <div className="workspace-rail__header-actions">
        <Tooltip text={sessionListOpen ? 'Hide history' : 'Show history'}>
          <button
            type="button"
            className={`workspace-rail__icon-btn${sessionListOpen ? ' is-active' : ''}`}
            onClick={() => setSessionListOpen(!sessionListOpen)}
            aria-label="Toggle conversation history"
          >
            <CarbonIcon name="Chat" size={16} />
          </button>
        </Tooltip>
        <Tooltip text="New conversation">
          <button
            type="button"
            className="workspace-rail__icon-btn"
            onClick={newSession}
            aria-label="New conversation"
          >
            <CarbonIcon name="Add" size={16} />
          </button>
        </Tooltip>
        <Tooltip text="Hide assistant">
          <button
            type="button"
            className="workspace-rail__close"
            onClick={onHide}
            aria-label="Hide assistant"
          >
            <CarbonIcon name="SidePanelClose" size={16} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

function WorkspaceShellFrame({ bootstrap, setBootstrap, recordsByModel, setRecordsByModel, singletonData, setSingletonData }) {
  const { surface } = useWorkspaceSurface();
  const { editorChrome } = useEditorChrome();
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
  const [aboutOpen, setAboutOpen] = useState(false);
  const [contentSection, setContentSection] = useState('pages');
  const [settingsSection, setSettingsSection] = useState('site');
  const [railHidden, setRailHidden] = useState(() => {
    try { return window.localStorage.getItem('wplite:rail-hidden') === '1'; } catch { return false; }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem('wplite:rail-hidden', railHidden ? '1' : '0');
    } catch {}
  }, [railHidden]);

  useEffect(() => {
    function onStorage(event) {
      if (event.key === 'wplite:rail-hidden') {
        setRailHidden(event.newValue === '1');
      }
    }
    function onShowAssistant() {
      setRailHidden(false);
    }
    window.addEventListener('storage', onStorage);
    window.addEventListener('wplite:show-assistant', onShowAssistant);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('wplite:show-assistant', onShowAssistant);
    };
  }, []);
  const wpMenuRef = useRef(null);
  const notificationsRef = useRef(null);
  const contextMenuRef = useRef(null);

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

    if (notice?.status !== 'error' && !notice?.sticky) {
      setTimeout(() => {
        dismissNotice(id);
      }, 4000);
    }

    return id;
  }, [archiveNotification, dismissNotice]);

  useEffect(() => {
    const handleStale = (event) => {
      const detail = event?.detail ?? {};
      const targets = Array.isArray(detail.targets) ? detail.targets : [];
      const label = targets.length === 1
        ? `${targets[0].postType} #${targets[0].id}`
        : `${targets.length} open records`;
      const id = pushNotice({
        status: 'warning',
        sticky: true,
        message: `Source changed for ${label}. You have unsaved edits — reload will discard them.`,
        actions: [
          {
            label: 'Reload from source',
            onClick: () => {
              try {
                detail.onReload?.();
              } finally {
                dismissNotice(id);
              }
            },
          },
        ],
      });
    };
    window.addEventListener('wplite-dev-hmr:stale', handleStale);
    return () => window.removeEventListener('wplite-dev-hmr:stale', handleStale);
  }, [dismissNotice, pushNotice]);

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
      { id: 'connectors', path: '/settings/connectors' },
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
    {
      id: 'about',
      label: 'About WP Lite',
      onSelect: () => {
        setAboutOpen(true);
        setOpenPopover(null);
      },
    },
  ]), [bootstrap.singletons, contentSections]);

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

  const currentSearchScopeLabel = useMemo(() => {
    const path = location.pathname;

    if (path.startsWith('/pages/')) {
      return contentSections.find((section) => section.id === 'pages')?.label || 'Pages';
    }

    if (path.startsWith('/posts/')) {
      return contentSections.find((section) => section.id === 'post')?.label || 'Posts';
    }

    if (path.startsWith('/media/')) {
      return 'Media';
    }

    if (path.startsWith('/users/')) {
      return 'Users';
    }

    if (path.startsWith('/comments/')) {
      return 'Comments';
    }

    for (const section of contentSections) {
      if (section.id !== 'pages' && section.id !== 'post' && path.startsWith(`${section.listPath}/`)) {
        return section.label;
      }
    }

    return surface.entityCollectionLabel || surface.entityLabel || 'Content';
  }, [contentSections, location.pathname, surface.entityCollectionLabel, surface.entityLabel]);

  return (
    <div className={`app-shell app-shell--workspace color-scheme-${adminColorScheme}`}>
      <header className="workspace-topbar">
        <div className="workspace-topbar__left">
          <button
            ref={wpMenuRef}
            type="button"
            className={`workspace-topbar__wp-button${openPopover === 'wp-menu' ? ' is-active' : ''}`}
            onClick={() => togglePopover('wp-menu')}
            aria-label="Open WordPress menu"
          >
            <WordPressMark size={22} />
          </button>
          <div className="workspace-topbar__identity">
            <button
              type="button"
              className="workspace-topbar__site-name workspace-topbar__site-name--link"
              onClick={() => navigate(defaultCanvasPath)}
              title={`${bootstrap.site.title || 'Site'} — open homepage`}
            >
              {bootstrap.site.title || 'Site'}
            </button>
            {(surface.setTitle || surface.title) ? (
              <InlineEditableTopbarText
                value={surface.title}
                placeholder={surface.titlePlaceholder || 'Untitled'}
                className="workspace-topbar__entity-title"
                onCommit={surface.setTitle}
                confirmTitle={`Change ${String(surface.entityLabel || 'page').toLowerCase()} title?`}
                confirmDescription="This updates the current document title."
                confirmRememberKey="wplite:skip-document-title-confirm"
                confirmRememberLabel="Don't show this again"
              />
            ) : null}
          </div>
          <CommandBar
            bootstrap={bootstrap}
            recordsByModel={recordsByModel}
            isOpen={commandBarOpen}
            onOpen={() => setCommandBarOpen(true)}
            onClose={() => setCommandBarOpen(false)}
            onExecuteAction={handleCommandAction}
            searchScopeLabel={currentSearchScopeLabel}
            shortcutLabel={commandShortcut}
          />
          {editorChrome.hasEditor ? (
            <Tooltip text={editorChrome.inserterOpen ? 'Close inserter' : 'Add elements'}>
              <button
                type="button"
                className={`workspace-topbar__icon-button workspace-topbar__icon-button--inserter${editorChrome.inserterOpen ? ' is-active' : ''}`}
                onClick={editorChrome.toggleInserter}
                aria-label={editorChrome.inserterOpen ? 'Close inserter' : 'Add elements'}
                aria-expanded={editorChrome.inserterOpen}
              >
                <CarbonIcon name={editorChrome.inserterOpen ? 'Close' : 'Add'} size={16} />
              </button>
            </Tooltip>
          ) : null}
        </div>

        <div className="workspace-topbar__right">
          <div className="workspace-topbar__toggles">
            <Tooltip text="Content">
              <button
                type="button"
                className={`workspace-topbar__icon-button${openPopover === 'content' ? ' is-active' : ''}`}
                onClick={() => togglePopover('content')}
                aria-label="Open content"
              >
                <CarbonIcon name="Document" size={16} />
              </button>
            </Tooltip>
            <Tooltip text="Media">
              <button
                type="button"
                className={`workspace-topbar__icon-button${openPopover === 'media' ? ' is-active' : ''}`}
                onClick={() => togglePopover('media')}
                aria-label="Open media"
              >
                <CarbonIcon name="Image" size={16} />
              </button>
            </Tooltip>
            <Tooltip text="Settings">
              <button
                type="button"
                className={`workspace-topbar__icon-button${openPopover === 'settings' ? ' is-active' : ''}`}
                onClick={() => togglePopover('settings')}
                aria-label="Open settings"
              >
                <CarbonIcon name="Settings" size={16} />
              </button>
            </Tooltip>
            <div ref={notificationsRef}>
              <NotificationBell
                unreadCount={notifications.filter((item) => !item.read).length}
                isOpen={openPopover === 'notifications'}
                onClick={() => togglePopover('notifications')}
              />
            </div>
          </div>
          <div className="workspace-topbar__actions">
            <Button variant="secondary" onClick={handleSave} disabled={!surface.canSave} isBusy={surface.isSaving}>
              {surface.saveLabel || 'Save'}
            </Button>
            <Button variant="primary" onClick={handlePublish} disabled={!surface.canPublish} isBusy={surface.isSaving}>
              {surface.publishLabel || 'Publish'}
            </Button>
            {(contextControls.length > 0 || editorChrome.hasEditor) ? (
              <div ref={contextMenuRef}>
                <Tooltip text="More options">
                  <button
                    type="button"
                    className={`workspace-topbar__icon-button workspace-topbar__context${openPopover === 'context' ? ' is-active' : ''}`}
                    onClick={() => togglePopover('context')}
                    aria-label="More options"
                    aria-haspopup="menu"
                    aria-expanded={openPopover === 'context'}
                  >
                    <CarbonIcon name="OverflowMenuVertical" size={16} />
                  </button>
                </Tooltip>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className={`workspace-layout${railHidden ? ' workspace-layout--rail-hidden' : ''}`}>
        {!railHidden ? (
          <aside className="workspace-rail">
            <AssistantRailHeader onHide={() => setRailHidden(true)} />
            <div className="workspace-rail__body">
              <AssistantChat />
            </div>
          </aside>
        ) : null}

        <div className="workspace-main">
          <div className="workspace-canvas">
            <div className="workspace-canvas__inner">
              <Routes>
                <Route path="/" element={<Navigate to={defaultCanvasPath} replace />} />
                <Route path="/dashboard" element={<Navigate to={defaultCanvasPath} replace />} />
                <Route path="/docs" element={<DocsPage bootstrap={bootstrap} />} />
                <Route path="/domains" element={<DomainsPage bootstrap={bootstrap} pushNotice={pushNotice} />} />
                <Route path="/integrations" element={<IntegrationsPage pushNotice={pushNotice} />} />
                <Route path="/automations" element={<PlaceholderPage eyebrow="Workspace" title="Automations" lede="Triggers, actions, and background workflows will attach to content once the service layer lands." summary="Site-wide configuration and preferences." />} />
                <Route path="/pages" element={<PagesPage pushNotice={pushNotice} />} />
                <Route path="/pages/:pageId" element={<PageEditorPage bootstrap={bootstrap} recordsByModel={recordsByModel} setBootstrap={setBootstrap} pushNotice={pushNotice} />} />
                <Route path="/comments" element={<CommentsPage bootstrap={bootstrap} pushNotice={pushNotice} />} />
                <Route path="/comments/:commentId" element={<CommentEditorPage key={`comment-editor:${location.pathname}`} bootstrap={bootstrap} pushNotice={pushNotice} />} />
                <Route path="/media/:mediaId" element={<MediaEditorPage key={`media-editor:${location.pathname}`} pushNotice={pushNotice} />} />
                <Route path="/users" element={<UsersPage bootstrap={bootstrap} pushNotice={pushNotice} />} />
                <Route path="/users/:userId" element={<UserEditorPage key={`user-editor:${location.pathname}`} bootstrap={bootstrap} setBootstrap={setBootstrap} pushNotice={pushNotice} />} />
                <Route path="/:collectionPath" element={<CollectionListPage bootstrap={bootstrap} recordsByModel={recordsByModel} />} />
                <Route path="/:collectionPath/:itemId" element={<CollectionEditorPage bootstrap={bootstrap} recordsByModel={recordsByModel} setRecordsByModel={setRecordsByModel} pushNotice={pushNotice} />} />
                <Route path="/settings/site" element={<SiteSettingsPage key={`site-settings:${location.pathname}`} bootstrap={bootstrap} setBootstrap={setBootstrap} pushNotice={pushNotice} />} />
                <Route path="/settings/:singletonId" element={<SingletonEditorPage key={`singleton-settings:${location.pathname}`} bootstrap={bootstrap} singletonData={singletonData} setSingletonData={setSingletonData} pushNotice={pushNotice} />} />
                <Route path="/settings/logs" element={<LogsPage />} />
                <Route path="/settings/api" element={<ApiPage bootstrap={bootstrap} />} />
                <Route path="/settings/connectors" element={<ConnectorsPage bootstrap={bootstrap} />} />
                <Route path="*" element={<NotFoundScreen />} />
              </Routes>
            </div>
          </div>
        </div>
      </div>

      {railHidden ? (
        <Tooltip text="Show assistant">
          <button
            type="button"
            className="workspace-rail-tab"
            onClick={() => setRailHidden(false)}
            aria-label="Show assistant"
          >
            <CarbonIcon name="ChevronRight" size={14} />
          </button>
        </Tooltip>
      ) : null}

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
      <UsersPopover
        open={openPopover === 'users'}
        onClose={() => setOpenPopover(null)}
        onOpenItem={handleOpenCanvasPath}
        pushNotice={pushNotice}
      />
      <CommentsPopover
        open={openPopover === 'comments'}
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
        onClose={() => setOpenPopover(null)}
      />
      <WordPressMenuPopover
        open={openPopover === 'context'}
        anchorRef={contextMenuRef}
        menuTree={[
          ...(editorChrome.hasEditor ? [{
            id: 'toggle-doc-sidebar',
            label: editorChrome.sidebarOpen ? 'Hide document sidebar' : 'Show document sidebar',
            onSelect: () => { editorChrome.toggleSidebar?.(); setOpenPopover(null); },
          }] : []),
          ...contextControls.map((control, index) => ({
            id: `ctx-${index}`,
            label: control.title,
            onSelect: () => { control.onClick?.(); setOpenPopover(null); },
          })),
        ]}
        onClose={() => setOpenPopover(null)}
      />

      {aboutOpen ? <AboutModal onClose={() => setAboutOpen(false)} /> : null}

      <NoticeStack notices={notices} onDismiss={dismissNotice} />
    </div>
  );
}

function AboutModal({ onClose }) {
  return (
    <Modal
      title=""
      aria={{ labelledby: 'wplite-about-title' }}
      onRequestClose={onClose}
      className="wplite-about-modal"
    >
      <div className="wplite-about">
        <div className="wplite-about__mark" aria-hidden="true">
          <WordPressMark size={44} />
        </div>
        <h2 id="wplite-about-title" className="wplite-about__name">WP Lite</h2>
        <p className="wplite-about__tagline">
          A flat, schema-first authoring layer for WordPress.
        </p>
        <div className="wplite-about__body">
          <p>
            WP Lite turns plain files — markdown, schema, and theme source — into
            a live WordPress site. You write content and configuration in
            <code> app/</code>, <code>content/</code>, <code>theme/</code>,
            <code> blocks/</code>, and <code>admin/</code>. The compiler emits a
            generated plugin, a block theme, and this custom <code>/app</code>
            admin UI, then keeps the running site in sync as you edit.
          </p>
          <p>
            The assistant rail on the right is Claude running locally through
            the Agent Client Protocol — it can read and modify your source files
            directly while you're working.
          </p>
        </div>
        <div className="wplite-about__footer">
          <span>Built on WordPress · Open source</span>
        </div>
      </div>
    </Modal>
  );
}

export function AppShell(props) {
  return (
    <WorkspaceSurfaceProvider>
      <AssistantProvider>
        <WorkspaceShellFrame {...props} />
      </AssistantProvider>
    </WorkspaceSurfaceProvider>
  );
}
