import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
} from '@wordpress/components';
import { DataForm, DataViews, filterSortAndPaginate } from '@wordpress/dataviews';
import {
  normalizeUserPreferences,
  normalizeUserRecord,
  toTitleCase,
  wpApiFetch,
} from '../lib/helpers.js';
import { SkeletonTableRows, SkeletonFormFields } from './skeletons.jsx';
import { useRegisterWorkspaceSurface } from './workspace-context.jsx';
import { useRegisterAssistantContext } from './assistant-provider.jsx';

function getInitials(name) {
  return (name || '?')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getUserEndpoint(userId) {
  return userId === 'me' ? 'wp/v2/users/me' : `wp/v2/users/${userId}`;
}

function createUserDraft(user, currentUserId) {
  const normalized = normalizeUserRecord(user);
  return {
    ...normalized,
    role: normalized.roles?.[0] ?? 'editor',
    isCurrentUser: Number(normalized.id) === Number(currentUserId),
    password: '',
    passwordConfirm: '',
    preferences: normalizeUserPreferences(normalized.preferences),
  };
}

function createEmptyUserDraft() {
  return {
    id: 'new',
    name: '',
    displayName: '',
    username: '',
    firstName: '',
    lastName: '',
    nickname: '',
    email: '',
    url: '',
    description: '',
    locale: '',
    role: 'editor',
    roles: ['editor'],
    avatarUrl: '',
    avatarUrls: {},
    isCurrentUser: false,
    password: '',
    passwordConfirm: '',
    preferences: normalizeUserPreferences({ adminColor: 'modern' }),
  };
}

function buildDisplayNameOptions(draft) {
  const candidates = [
    draft.username,
    draft.nickname,
    [draft.firstName, draft.lastName].filter(Boolean).join(' '),
    draft.firstName,
    draft.lastName,
    draft.name,
  ]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);

  return [...new Set(candidates)].map((value) => ({ value, label: value }));
}

const ROLE_ELEMENTS = ['subscriber', 'contributor', 'author', 'editor', 'administrator'].map((role) => ({
  value: role,
  label: toTitleCase(role),
}));

const ADMIN_COLOR_ELEMENTS = [
  { value: 'modern', label: 'Modern Blue' },
  { value: 'light', label: 'Light' },
  { value: 'blue', label: 'Blue' },
  { value: 'coffee', label: 'Coffee' },
  { value: 'ectoplasm', label: 'Ectoplasm' },
  { value: 'midnight', label: 'Midnight' },
  { value: 'ocean', label: 'Ocean' },
  { value: 'sunrise', label: 'Sunrise' },
];

const ROLE_COLORS = {
  administrator: { bg: '#fce4ec', color: '#c62828' },
  editor: { bg: '#e8eaf6', color: '#3f51b5' },
  author: { bg: '#e8f5e9', color: '#2e7d32' },
  contributor: { bg: '#fff3e0', color: '#e65100' },
  subscriber: { bg: '#f5f5f5', color: '#757575' },
};

/* ── Users List Page ── */
export function UsersPage({ bootstrap, pushNotice }) {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const currentUserId = bootstrap?.currentUser?.id;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await wpApiFetch('wp/v2/users?per_page=100&context=edit');
        if (cancelled) return;
        setUsers(response.map((user) => createUserDraft(user, currentUserId)));
      } catch (error) {
        try {
          const me = await wpApiFetch('wp/v2/users/me?context=edit');
          if (cancelled) return;
          setUsers([createUserDraft(me, currentUserId)]);
          pushNotice({
            status: 'warning',
            message: 'Showing your profile only. Your account can still be edited here.',
          });
        } catch {
          if (!cancelled) {
            pushNotice({ status: 'error', message: `Failed to load users: ${error.message}` });
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  const fields = useMemo(() => [
    {
      id: 'name',
      label: 'Name',
      enableGlobalSearch: true,
      enableSorting: true,
      enableHiding: false,
      getValue: ({ item }) => item.name,
      render: ({ item }) => (
        <div className="user-row">
          {item.avatarUrl ? (
            <img src={item.avatarUrl} alt="" className="user-avatar" />
          ) : (
            <div className="user-avatar">{getInitials(item.name || item.username)}</div>
          )}
          <div className="user-row__identity">
            <strong>{item.name || item.username}</strong>
            {item.isCurrentUser ? <span className="user-row__self-badge">You</span> : null}
          </div>
        </div>
      ),
    },
    {
      id: 'username',
      label: 'Username',
      enableGlobalSearch: true,
      enableSorting: true,
      getValue: ({ item }) => item.username,
      render: ({ item }) => (
        <span style={{ color: 'var(--wp-admin-text-muted)' }}>@{item.username}</span>
      ),
    },
    {
      id: 'email',
      label: 'Email',
      type: 'text',
      enableSorting: true,
      getValue: ({ item }) => item.email,
      render: ({ item }) => (
        <span style={{ color: 'var(--wp-admin-text-muted)' }}>{item.email}</span>
      ),
    },
    {
      id: 'role',
      label: 'Role',
      type: 'text',
      enableSorting: true,
      getValue: ({ item }) => item.role,
      elements: ROLE_ELEMENTS,
      filterBy: {},
      render: ({ item }) => {
        const colors = ROLE_COLORS[item.role] ?? ROLE_COLORS.subscriber;
        return (
          <span className="role-badge" style={{ background: colors.bg, color: colors.color }}>
            {item.role}
          </span>
        );
      },
    },
  ], []);

  const [view, setView] = useState({
    type: 'table',
    perPage: 25,
    page: 1,
    sort: { field: 'name', direction: 'asc' },
    fields: ['name', 'username', 'email', 'role'],
    layout: {},
    filters: [],
    search: '',
  });

  const deferredUsers = useDeferredValue(users);
  const processed = useMemo(
    () => filterSortAndPaginate(deferredUsers, view, fields),
    [deferredUsers, view, fields]
  );

  const roleSummary = useMemo(() => {
    const counts = {};
    for (const user of users) counts[user.role] = (counts[user.role] || 0) + 1;
    return counts;
  }, [users]);

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Users</h1>
          <p className="screen-header__lede">
            {users.length > 0
              ? `${users.length} user${users.length !== 1 ? 's' : ''} — ${Object.entries(roleSummary).map(([role, count]) => `${count} ${role}${count !== 1 ? 's' : ''}`).join(', ')}`
              : 'Manage user accounts and roles.'}
          </p>
        </div>
        <div className="screen-header__actions">
          <Button variant="primary" onClick={() => navigate('/users/new')}>
            Add New User
          </Button>
        </div>
      </header>

      {loading ? (
        <Card className="surface-card"><CardBody><SkeletonTableRows rows={5} cols={4} /></CardBody></Card>
      ) : (
        <Card className="surface-card">
          <CardBody>
            <DataViews
              data={processed.data}
              fields={fields}
              view={view}
              onChangeView={setView}
              getItemId={(item) => String(item.id)}
              paginationInfo={processed.paginationInfo}
              onClickItem={(item) => navigate(`/users/${item.isCurrentUser ? 'me' : item.id}`)}
              isItemClickable={() => true}
              defaultLayouts={{ table: {} }}
              search
              empty={
                <div className="empty-state">
                  <h2>No users found</h2>
                  <p>Create your first user to get started.</p>
                  <Button variant="primary" onClick={() => navigate('/users/new')}>Add New User</Button>
                </div>
              }
            >
              <div className="dataviews-shell">
                <div className="dataviews-toolbar">
                  <DataViews.Search label="Search users" />
                  <DataViews.FiltersToggle />
                  <div className="dataviews-toolbar__spacer" />
                  <DataViews.ViewConfig />
                </div>
                <DataViews.FiltersToggled />
                <DataViews.Layout className="dataviews-layout" />
                <div className="dataviews-footer">
                  <span>{processed.paginationInfo.totalItems} users</span>
                  <DataViews.Pagination />
                </div>
              </div>
            </DataViews>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

/* ── User Editor Page ── */
export function UserEditorPage({ bootstrap, setBootstrap, pushNotice }) {
  const navigate = useNavigate();
  const { userId } = useParams();
  const isNew = userId === 'new';
  const isSelfRoute = userId === 'me';
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const currentUserId = bootstrap?.currentUser?.id;
  const isCurrentUser = !isNew && (isSelfRoute || Number(draft?.id) === Number(currentUserId));

  useEffect(() => {
    if (isNew) {
      setDraft(createEmptyUserDraft());
      setLoading(false);
      return undefined;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const user = await wpApiFetch(`${getUserEndpoint(userId)}?context=edit`);
        if (cancelled) return;
        setDraft(createUserDraft(user, currentUserId));
      } catch (error) {
        if (!cancelled) pushNotice({ status: 'error', message: `Failed to load user: ${error.message}` });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [currentUserId, isNew, userId]);

  const displayNameElements = useMemo(
    () => buildDisplayNameOptions(draft ?? createEmptyUserDraft()),
    [draft]
  );

  const personalFields = useMemo(() => [
    {
      id: 'firstName',
      label: 'First Name',
      type: 'text',
      getValue: ({ item }) => item.firstName,
      setValue: ({ value }) => ({ firstName: value }),
    },
    {
      id: 'lastName',
      label: 'Last Name',
      type: 'text',
      getValue: ({ item }) => item.lastName,
      setValue: ({ value }) => ({ lastName: value }),
    },
    {
      id: 'nickname',
      label: 'Nickname',
      type: 'text',
      getValue: ({ item }) => item.nickname,
      setValue: ({ value }) => ({ nickname: value }),
    },
    {
      id: 'name',
      label: 'Display Name',
      type: 'text',
      Edit: displayNameElements.length > 0 ? 'select' : undefined,
      elements: displayNameElements,
      getValue: ({ item }) => item.name,
      setValue: ({ value }) => ({ name: value }),
    },
    {
      id: 'description',
      label: 'Biographical Info',
      type: 'text',
      Edit: { control: 'textarea', rows: 5 },
      getValue: ({ item }) => item.description,
      setValue: ({ value }) => ({ description: value }),
    },
  ], [displayNameElements]);

  const accountFields = useMemo(() => ([
    ...(isNew ? [{
      id: 'username',
      label: 'Username',
      type: 'text',
      getValue: ({ item }) => item.username,
      setValue: ({ value }) => ({ username: value }),
    }] : []),
    {
      id: 'email',
      label: 'Email',
      type: 'email',
      getValue: ({ item }) => item.email,
      setValue: ({ value }) => ({ email: value }),
    },
    {
      id: 'url',
      label: 'Website',
      type: 'url',
      getValue: ({ item }) => item.url,
      setValue: ({ value }) => ({ url: value }),
    },
    {
      id: 'locale',
      label: 'Locale',
      type: 'text',
      getValue: ({ item }) => item.locale,
      setValue: ({ value }) => ({ locale: value }),
    },
    ...(!isCurrentUser ? [{
      id: 'role',
      label: 'Role',
      type: 'text',
      Edit: 'select',
      elements: ROLE_ELEMENTS,
      getValue: ({ item }) => item.role,
      setValue: ({ value }) => ({ role: value }),
    }] : []),
    {
      id: 'password',
      label: isNew ? 'Password' : 'New Password',
      type: 'text',
      getValue: ({ item }) => item.password ?? '',
      setValue: ({ value }) => ({ password: value }),
    },
    {
      id: 'passwordConfirm',
      label: isNew ? 'Confirm Password' : 'Confirm New Password',
      type: 'text',
      getValue: ({ item }) => item.passwordConfirm ?? '',
      setValue: ({ value }) => ({ passwordConfirm: value }),
    },
  ]), [isCurrentUser, isNew]);

  const preferenceFields = useMemo(() => [
    {
      id: 'adminColor',
      label: 'Admin Color Scheme',
      type: 'text',
      Edit: 'select',
      elements: ADMIN_COLOR_ELEMENTS,
      getValue: ({ item }) => item.preferences?.adminColor ?? 'modern',
      setValue: ({ value }) => ({ preferences: { ...draft?.preferences, adminColor: value } }),
    },
    {
      id: 'richEditing',
      label: 'Visual editor',
      type: 'boolean',
      getValue: ({ item }) => item.preferences?.richEditing ?? true,
      setValue: ({ value }) => ({ preferences: { ...draft?.preferences, richEditing: value } }),
    },
    {
      id: 'syntaxHighlighting',
      label: 'Syntax highlighting',
      type: 'boolean',
      getValue: ({ item }) => item.preferences?.syntaxHighlighting ?? true,
      setValue: ({ value }) => ({ preferences: { ...draft?.preferences, syntaxHighlighting: value } }),
    },
    {
      id: 'commentShortcuts',
      label: 'Comment moderation shortcuts',
      type: 'boolean',
      getValue: ({ item }) => item.preferences?.commentShortcuts ?? false,
      setValue: ({ value }) => ({ preferences: { ...draft?.preferences, commentShortcuts: value } }),
    },
    {
      id: 'showAdminBarFront',
      label: 'Show admin bar on site front-end',
      type: 'boolean',
      getValue: ({ item }) => item.preferences?.showAdminBarFront ?? true,
      setValue: ({ value }) => ({ preferences: { ...draft?.preferences, showAdminBarFront: value } }),
    },
  ], [draft?.preferences]);

  const regularForm = useMemo(() => ({ layout: { type: 'regular', labelPosition: 'top' } }), []);

  async function handleSave() {
    if (!draft) return;
    if ((draft.password || draft.passwordConfirm) && draft.password !== draft.passwordConfirm) {
      pushNotice({ status: 'error', message: 'Passwords do not match.' });
      return;
    }
    if (isNew && !draft.password) {
      pushNotice({ status: 'error', message: 'A password is required for new users.' });
      return;
    }

    setIsSaving(true);
    try {
      const endpoint = isNew ? 'wp/v2/users' : getUserEndpoint(isCurrentUser ? 'me' : draft.id);
      const body = {
        name: draft.name,
        first_name: draft.firstName,
        last_name: draft.lastName,
        nickname: draft.nickname,
        email: draft.email,
        url: draft.url,
        description: draft.description,
        locale: draft.locale,
        wplitePreferences: draft.preferences,
      };

      if (!isCurrentUser && draft.role) {
        body.roles = [draft.role];
      }
      if (isNew) {
        body.username = draft.username;
      }
      if (draft.password) {
        body.password = draft.password;
      }

      const payload = await wpApiFetch(endpoint, { method: 'POST', body });
      const normalized = createUserDraft(payload, currentUserId);

      pushNotice({ status: 'success', message: isNew ? 'User created.' : 'User saved.' });

      if (normalized.isCurrentUser && typeof setBootstrap === 'function') {
        setBootstrap((current) => ({ ...current, currentUser: normalized }));
      }

      if (isNew) {
        navigate(`/users/${normalized.id}`, { replace: true });
      } else {
        setDraft(normalized);
      }
    } catch (error) {
      pushNotice({ status: 'error', message: error.message });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (isNew || !draft) return;
    if (isCurrentUser) {
      pushNotice({ status: 'error', message: 'You cannot delete the account you are currently using.' });
      return;
    }
    if (!window.confirm(`Delete user "${draft.name || draft.username}"? This cannot be undone.`)) return;

    setIsDeleting(true);
    try {
      const reassignId = currentUserId && Number(currentUserId) !== Number(draft.id)
        ? Number(currentUserId)
        : 1;
      await wpApiFetch(`wp/v2/users/${draft.id}?reassign=${reassignId}&force=true`, { method: 'DELETE' });
      pushNotice({ status: 'success', message: 'User deleted.' });
      navigate('/users');
    } catch (error) {
      pushNotice({ status: 'error', message: error.message });
    } finally {
      setIsDeleting(false);
    }
  }

  const avatarInputRef = useRef(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  async function handleAvatarFile(file) {
    if (!file || !draft) return;
    setIsUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('title', `Avatar for ${draft.username || draft.name || 'user'}`);
      const uploaded = await wpApiFetch('wp/v2/media', { method: 'POST', body: form });
      const attachmentId = uploaded?.id;
      const nextUrl =
        uploaded?.media_details?.sizes?.medium?.source_url
        || uploaded?.media_details?.sizes?.thumbnail?.source_url
        || uploaded?.source_url;
      if (!attachmentId) throw new Error('Upload failed.');

      let persistedAvatarUrl = nextUrl || '';
      if (!isNew && draft.id) {
        const endpoint = getUserEndpoint(isCurrentUser ? 'me' : draft.id);
        try {
          const updated = await wpApiFetch(endpoint, {
            method: 'POST',
            body: {
              meta: {
                wplite_avatar_id: attachmentId,
                wplite_avatar_url: nextUrl || '',
              },
            },
          });
          // Trust round-tripped meta if the plugin is active.
          if (updated?.meta?.wplite_avatar_url) {
            persistedAvatarUrl = updated.meta.wplite_avatar_url;
          }
        } catch (metaErr) {
          // Don't fail the whole flow — the attachment was still uploaded.
          pushNotice?.({
            status: 'warning',
            message: `Avatar uploaded, but server did not persist the reference: ${metaErr.message}`,
          });
        }
      }

      setDraft((current) => ({
        ...current,
        avatarUrl: persistedAvatarUrl || current.avatarUrl,
        avatarUrls: persistedAvatarUrl
          ? { ...(current.avatarUrls ?? {}), 24: persistedAvatarUrl, 48: persistedAvatarUrl, 96: persistedAvatarUrl }
          : current.avatarUrls,
        wpliteAvatarId: attachmentId,
        wpliteAvatarUrl: persistedAvatarUrl,
      }));

      if (isCurrentUser && typeof setBootstrap === 'function') {
        setBootstrap((current) => ({
          ...current,
          currentUser: {
            ...(current?.currentUser ?? {}),
            avatarUrl: nextUrl || current?.currentUser?.avatarUrl,
          },
        }));
      }

      pushNotice({ status: 'success', message: 'Profile picture updated.' });
    } catch (error) {
      pushNotice({ status: 'error', message: `Avatar upload failed: ${error.message}` });
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  const workspaceSurface = useMemo(() => ({
    entityId: draft?.id ? `user:${draft.id}` : 'user:new',
    entityLabel: 'User',
    title: isNew ? 'New User' : (draft?.name || draft?.username || 'User'),
    titlePlaceholder: 'User name',
    saveLabel: isNew ? 'Create' : 'Save',
    publishLabel: isNew ? 'Create' : 'Save',
    canSave: Boolean(draft) && !loading,
    canPublish: false,
    isSaving,
    setTitle: draft ? (value) => setDraft((current) => ({ ...current, name: value })) : null,
    save: draft ? handleSave : null,
    moreActions: [
      !isNew && !isCurrentUser && draft?.id ? {
        title: 'Delete User',
        onClick: handleDelete,
      } : null,
    ].filter(Boolean),
  }), [draft, handleDelete, handleSave, isCurrentUser, isNew, isSaving, loading]);

  useRegisterWorkspaceSurface(workspaceSurface);

  useRegisterAssistantContext(useMemo(() => ({
    view: 'user-editor',
    entity: {
      kind: 'user',
      id: isNew ? 'new' : userId,
      label: draft?.name || draft?.username || `User ${userId || ''}`,
      notes:
        'Users live in the WordPress database, not source files. Edits go through the wp/v2/users REST API. Roles, capabilities, and profile fields are mutable; usernames are not.',
    },
  }), [draft?.name, draft?.username, isNew, userId]));

  if (loading || !draft) {
    return <div className="media-editor-screen" aria-hidden="true" />;
  }

  const colors = ROLE_COLORS[draft.role] ?? ROLE_COLORS.subscriber;
  const displayName = isNew ? 'New User' : (draft.name || draft.username || 'User');

  return (
    <div className="media-editor-screen user-editor-screen">
      <div className="media-editor-screen__scroll">
        <section className="media-editor-screen__hero user-editor-screen__hero">
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) handleAvatarFile(file);
            }}
          />
          <button
            type="button"
            className={`user-editor-screen__avatar-button${isUploadingAvatar ? ' is-busy' : ''}`}
            onClick={() => avatarInputRef.current?.click()}
            aria-label="Change profile picture"
            title="Change profile picture"
            disabled={isUploadingAvatar}
          >
            {draft.avatarUrl ? (
              <img
                className="user-editor-screen__avatar"
                src={draft.avatarUrl}
                alt=""
              />
            ) : (
              <div className="user-editor-screen__avatar user-editor-screen__avatar--placeholder">
                {isNew ? '+' : getInitials(draft.name || draft.username)}
              </div>
            )}
            <span className="user-editor-screen__avatar-overlay">
              {isUploadingAvatar ? 'Uploading…' : 'Change'}
            </span>
          </button>
          <div className="user-editor-screen__identity">
            <h1 className="user-editor-screen__name">{displayName}</h1>
            {draft.email ? <p className="user-editor-screen__email">{draft.email}</p> : null}
            <div className="user-editor-screen__badges">
              {draft.role ? (
                <span className="role-badge" style={{ background: colors.bg, color: colors.color }}>
                  {draft.role}
                </span>
              ) : null}
              {isCurrentUser ? <span className="user-row__self-badge">You</span> : null}
              {!isNew ? <span className="user-editor-screen__meta">@{draft.username}</span> : null}
            </div>
          </div>
        </section>

        <section className="media-editor-screen__panel">
          <h2 className="media-editor-screen__panel-title">Personal Details</h2>
          <DataForm
            data={draft}
            fields={personalFields}
            form={{ ...regularForm, fields: personalFields.map((field) => field.id) }}
            onChange={(edits) => setDraft((current) => ({ ...current, ...edits }))}
          />
        </section>

        <section className="media-editor-screen__panel">
          <h2 className="media-editor-screen__panel-title">Account Settings</h2>
          <DataForm
            data={draft}
            fields={accountFields}
            form={{ ...regularForm, fields: accountFields.map((field) => field.id) }}
            onChange={(edits) => setDraft((current) => ({ ...current, ...edits }))}
          />
        </section>

        <section className="media-editor-screen__panel">
          <h2 className="media-editor-screen__panel-title">Editor Preferences</h2>
          <DataForm
            data={draft}
            fields={preferenceFields}
            form={{ ...regularForm, fields: preferenceFields.map((field) => field.id) }}
            onChange={(edits) => setDraft((current) => ({ ...current, ...edits }))}
          />
        </section>

        {!isNew ? (
          <section className="media-editor-screen__panel">
            <h2 className="media-editor-screen__panel-title">Meta</h2>
            <dl className="media-editor-screen__info">
              <div><dt>ID</dt><dd>{draft.id}</dd></div>
              <div><dt>Username</dt><dd>@{draft.username}</dd></div>
              {draft.locale ? <div><dt>Locale</dt><dd>{draft.locale}</dd></div> : null}
            </dl>
            {!isCurrentUser ? (
              <div className="user-editor-screen__danger">
                <Button variant="tertiary" isDestructive isBusy={isDeleting} onClick={handleDelete}>
                  Delete User
                </Button>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
