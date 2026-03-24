import React, { Fragment, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
} from '@wordpress/components';
import { DataForm, DataViews, filterSortAndPaginate } from '@wordpress/dataviews';
import {
  normalizeUserRecord,
  toTitleCase,
  wpApiFetch,
} from '../lib/helpers.js';
import { SkeletonTableRows, SkeletonFormFields } from './skeletons.jsx';
import { CarbonIcon } from '../lib/icons.jsx';

function getInitials(name) {
  return (name || '?')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const ROLE_COLORS = {
  administrator: { bg: '#fce4ec', color: '#c62828' },
  editor: { bg: '#e8eaf6', color: '#3f51b5' },
  author: { bg: '#e8f5e9', color: '#2e7d32' },
  contributor: { bg: '#fff3e0', color: '#e65100' },
  subscriber: { bg: '#f5f5f5', color: '#757575' },
};

/* ── Users List Page ── */
export function UsersPage({ pushNotice }) {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const response = await wpApiFetch('wp/v2/users?per_page=100&context=edit');
        setUsers(response.map(normalizeUserRecord).map((u) => ({
          ...u,
          role: u.roles?.[0] ?? 'subscriber',
        })));
      } catch (err) {
        pushNotice({ status: 'error', message: `Failed to load users: ${err.message}` });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const roleElements = useMemo(() =>
    ['subscriber', 'contributor', 'author', 'editor', 'administrator'].map((r) => ({
      value: r,
      label: toTitleCase(r),
    })), []);

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
          <strong>{item.name || item.username}</strong>
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
      elements: roleElements,
      filterBy: {},
      render: ({ item }) => {
        const colors = ROLE_COLORS[item.role] ?? ROLE_COLORS.subscriber;
        return <span className="role-badge" style={{ background: colors.bg, color: colors.color }}>{item.role}</span>;
      },
    },
  ], [roleElements]);

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
    for (const u of users) counts[u.role] = (counts[u.role] || 0) + 1;
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
              ? `${users.length} user${users.length !== 1 ? 's' : ''} — ${Object.entries(roleSummary).map(([r, c]) => `${c} ${r}${c !== 1 ? 's' : ''}`).join(', ')}`
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
              onClickItem={(item) => navigate(`/users/${item.id}`)}
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
export function UserEditorPage({ pushNotice }) {
  const navigate = useNavigate();
  const { userId } = useParams();
  const isNew = userId === 'new';
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isNew) {
      setDraft({ id: 'new', name: '', username: '', email: '', role: 'editor', password: '' });
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function load() {
      try {
        const user = await wpApiFetch(`wp/v2/users/${userId}?context=edit`);
        if (cancelled) return;
        const normalized = normalizeUserRecord(user);
        setDraft({ ...normalized, role: normalized.roles?.[0] ?? 'editor', password: '' });
      } catch (err) {
        if (!cancelled) pushNotice({ status: 'error', message: `Failed to load user: ${err.message}` });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId, isNew]);

  const roleElements = useMemo(() =>
    ['subscriber', 'contributor', 'author', 'editor', 'administrator'].map((r) => ({
      value: r,
      label: toTitleCase(r),
    })), []);

  const fields = useMemo(() => [
    { id: 'name', label: 'Full Name', type: 'text', getValue: ({ item }) => item.name, setValue: ({ value }) => ({ name: value }) },
    ...(isNew ? [{ id: 'username', label: 'Username', type: 'text', getValue: ({ item }) => item.username, setValue: ({ value }) => ({ username: value }) }] : []),
    { id: 'email', label: 'Email', type: 'email', getValue: ({ item }) => item.email, setValue: ({ value }) => ({ email: value }) },
    { id: 'role', label: 'Role', type: 'text', Edit: 'select', elements: roleElements, getValue: ({ item }) => item.role, setValue: ({ value }) => ({ role: value }) },
    ...(isNew ? [{ id: 'password', label: 'Password', type: 'text', getValue: ({ item }) => item.password ?? '', setValue: ({ value }) => ({ password: value }) }] : []),
  ], [roleElements, isNew]);

  const form = useMemo(() => ({
    layout: { type: 'regular', labelPosition: 'top' },
    fields: isNew ? ['name', 'username', 'email', 'role', 'password'] : ['name', 'email', 'role'],
  }), [isNew]);

  async function handleSave() {
    if (!draft) return;
    setIsSaving(true);
    try {
      const endpoint = isNew ? 'wp/v2/users' : `wp/v2/users/${draft.id}`;
      const body = { name: draft.name, email: draft.email, roles: draft.role ? [draft.role] : [] };
      if (isNew) { body.username = draft.username; body.password = draft.password; }
      const payload = await wpApiFetch(endpoint, { method: 'POST', body });
      const normalized = normalizeUserRecord(payload);
      pushNotice({ status: 'success', message: isNew ? 'User created.' : 'User saved.' });
      if (isNew) navigate(`/users/${normalized.id}`, { replace: true });
      else setDraft({ ...normalized, role: normalized.roles?.[0] ?? 'editor', password: '' });
    } catch (error) {
      pushNotice({ status: 'error', message: error.message });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (isNew || !draft) return;
    if (!window.confirm(`Delete user "${draft.name || draft.username}"? This cannot be undone.`)) return;
    setIsDeleting(true);
    try {
      await wpApiFetch(`wp/v2/users/${draft.id}?reassign=1&force=true`, { method: 'DELETE' });
      pushNotice({ status: 'success', message: 'User deleted.' });
      navigate('/users');
    } catch (error) {
      pushNotice({ status: 'error', message: error.message });
    } finally {
      setIsDeleting(false);
    }
  }

  if (loading || !draft) {
    return <SkeletonFormFields fields={5} />;
  }

  const colors = ROLE_COLORS[draft.role] ?? ROLE_COLORS.subscriber;

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Users</p>
          <h1>{isNew ? 'New User' : draft.name || draft.username || 'User'}</h1>
        </div>
        <div className="screen-header__actions">
          <Button variant="secondary" onClick={() => navigate('/users')}>Back to Users</Button>
          <Button variant="primary" isBusy={isSaving} onClick={handleSave}>
            {isNew ? 'Create User' : 'Save Changes'}
          </Button>
        </div>
      </header>

      <div className="settings-layout">
        <div className="settings-layout__main">
          <Card className="surface-card">
            <CardHeader><h2>{isNew ? 'User Details' : 'Edit User'}</h2></CardHeader>
            <CardBody>
              <DataForm
                data={draft}
                fields={fields}
                form={form}
                onChange={(edits) => setDraft((c) => ({ ...c, ...edits }))}
              />
            </CardBody>
          </Card>
        </div>

        <div className="settings-layout__sidebar">
          <Card className="surface-card">
            <CardBody>
              <div className="user-inspector__header">
                {draft.avatarUrl ? (
                  <img src={draft.avatarUrl} alt="" className="user-avatar user-avatar--large" />
                ) : (
                  <div className="user-avatar user-avatar--large">
                    {isNew ? '+' : getInitials(draft.name || draft.username)}
                  </div>
                )}
                <h3 style={{ margin: '8px 0 2px', fontSize: '14px', fontWeight: 600 }}>
                  {isNew ? 'New User' : draft.name || draft.username}
                </h3>
                {draft.email && <span style={{ fontSize: '12px', color: 'var(--wp-admin-text-muted)' }}>{draft.email}</span>}
                {draft.role && (
                  <span className="role-badge" style={{ background: colors.bg, color: colors.color, marginTop: '6px' }}>
                    {draft.role}
                  </span>
                )}
              </div>
            </CardBody>
          </Card>

          {!isNew && (
            <Card className="surface-card">
              <CardBody>
                <div className="editor-meta">
                  <span>ID: {draft.id}</span>
                  <span>Username: @{draft.username}</span>
                </div>
                <div style={{ marginTop: '12px' }}>
                  <Button variant="tertiary" isDestructive isBusy={isDeleting} onClick={handleDelete}>
                    Delete User
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
