import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Notice,
} from '@wordpress/components';
import { DataForm, DataViews, filterSortAndPaginate } from '@wordpress/dataviews';
import {
  formatDateTime,
  normalizeCommentRecord,
  normalizeCommentStatus,
  toTitleCase,
  wpApiFetch,
} from '../lib/helpers.js';
import { SkeletonFormFields, SkeletonTableRows } from './skeletons.jsx';

const STATUS_ELEMENTS = [
  { value: 'approve', label: 'Approved' },
  { value: 'hold', label: 'Pending' },
  { value: 'spam', label: 'Spam' },
  { value: 'trash', label: 'Trash' },
];

const STATUS_META = {
  approve: { label: 'Approved', bg: '#e8f5e9', color: '#2e7d32' },
  hold: { label: 'Pending', bg: '#fff8e1', color: '#b26a00' },
  spam: { label: 'Spam', bg: '#fce4ec', color: '#ad1457' },
  trash: { label: 'Trash', bg: '#f5f5f5', color: '#616161' },
};

function getStatusMeta(status) {
  return STATUS_META[normalizeCommentStatus(status)] ?? STATUS_META.hold;
}

function getCommentEndpoint(commentId) {
  return `wp/v2/comments/${commentId}`;
}

function buildCommentStatusSummary(comments) {
  const counts = { approve: 0, hold: 0, spam: 0, trash: 0 };
  for (const comment of comments) {
    const status = normalizeCommentStatus(comment.status);
    counts[status] = (counts[status] || 0) + 1;
  }
  return counts;
}

function createCommentDraft(comment) {
  return normalizeCommentRecord(comment);
}

function CommentAuthor({ comment }) {
  return (
    <div className="comment-row">
      {comment.authorAvatarUrl ? (
        <img src={comment.authorAvatarUrl} alt="" className="user-avatar" />
      ) : (
        <div className="user-avatar">{(comment.authorName || '?').slice(0, 1).toUpperCase()}</div>
      )}
      <div className="comment-row__author">
        <strong>{comment.authorName || 'Anonymous'}</strong>
        {comment.authorEmail ? (
          <span>{comment.authorEmail}</span>
        ) : null}
      </div>
    </div>
  );
}

/* ── Comments List ── */
export function CommentsPage({ bootstrap, pushNotice }) {
  const navigate = useNavigate();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const commentsEnabled = bootstrap?.site?.commentsEnabled === true;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await wpApiFetch('wp/v2/comments?per_page=100&status=all&orderby=date_gmt&order=desc&context=edit&_embed=up');
        if (cancelled) return;
        setComments(response.map(createCommentDraft));
      } catch (error) {
        if (!cancelled) {
          pushNotice({ status: 'error', message: `Failed to load comments: ${error.message}` });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const fields = useMemo(() => [
    {
      id: 'authorName',
      label: 'Author',
      enableGlobalSearch: true,
      enableSorting: true,
      enableHiding: false,
      getValue: ({ item }) => item.authorName,
      render: ({ item }) => <CommentAuthor comment={item} />,
    },
    {
      id: 'excerpt',
      label: 'Comment',
      type: 'text',
      enableGlobalSearch: true,
      getValue: ({ item }) => item.excerpt,
      render: ({ item }) => (
        <div className="comment-row__excerpt">
          {item.excerpt || 'No comment text'}
        </div>
      ),
    },
    {
      id: 'postTitle',
      label: 'Response To',
      type: 'text',
      enableGlobalSearch: true,
      enableSorting: true,
      getValue: ({ item }) => item.postTitle,
      render: ({ item }) => (
        <span style={{ color: 'var(--wp-admin-text-muted)' }}>{item.postTitle}</span>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      type: 'text',
      enableSorting: true,
      elements: STATUS_ELEMENTS,
      filterBy: {},
      getValue: ({ item }) => item.status,
      render: ({ item }) => {
        const meta = getStatusMeta(item.status);
        return (
          <span className="comment-status-badge" style={{ background: meta.bg, color: meta.color }}>
            {meta.label}
          </span>
        );
      },
    },
    {
      id: 'date',
      label: 'Submitted',
      type: 'datetime',
      enableSorting: true,
      getValue: ({ item }) => item.date,
      render: ({ item }) => (
        <span style={{ color: 'var(--wp-admin-text-muted)' }}>{formatDateTime(item.date)}</span>
      ),
    },
  ], []);

  const [view, setView] = useState({
    type: 'table',
    perPage: 25,
    page: 1,
    sort: { field: 'date', direction: 'desc' },
    fields: ['authorName', 'excerpt', 'postTitle', 'status', 'date'],
    layout: {},
    filters: [],
    search: '',
  });

  const deferredComments = useDeferredValue(comments);
  const processed = useMemo(
    () => filterSortAndPaginate(deferredComments, view, fields),
    [deferredComments, view, fields]
  );
  const summary = useMemo(() => buildCommentStatusSummary(comments), [comments]);

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Discussion</p>
          <h1>Comments</h1>
          <p className="screen-header__lede">
            {comments.length > 0
              ? `${comments.length} comments — ${summary.hold} pending, ${summary.approve} approved, ${summary.spam} spam, ${summary.trash} trashed`
              : 'Moderate comments from the WordPress site.'}
          </p>
        </div>
      </header>

      {loading ? (
        <Card className="surface-card"><CardBody><SkeletonTableRows rows={6} cols={5} /></CardBody></Card>
      ) : (
        <Card className="surface-card">
          <CardBody>
            {!commentsEnabled ? (
              <Notice status="info" isDismissible={false}>
                <p>Comments are disabled in Site Settings. Existing comments can still be reviewed here.</p>
              </Notice>
            ) : null}
            <DataViews
              data={processed.data}
              fields={fields}
              view={view}
              onChangeView={setView}
              getItemId={(item) => String(item.id)}
              paginationInfo={processed.paginationInfo}
              onClickItem={(item) => navigate(`/comments/${item.id}`)}
              isItemClickable={() => true}
              defaultLayouts={{ table: {} }}
              search
              empty={
                <div className="empty-state">
                  <h2>No comments found</h2>
                  <p>Comments will appear here when discussion is enabled and people respond on the site.</p>
                </div>
              }
            >
              <div className="dataviews-shell">
                <div className="dataviews-toolbar">
                  <DataViews.Search label="Search comments" />
                  <DataViews.FiltersToggle />
                  <div className="dataviews-toolbar__spacer" />
                  <DataViews.ViewConfig />
                </div>
                <DataViews.FiltersToggled />
                <DataViews.Layout className="dataviews-layout" />
                <div className="dataviews-footer">
                  <span>{processed.paginationInfo.totalItems} comments</span>
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

/* ── Comment Editor ── */
export function CommentEditorPage({ bootstrap, pushNotice }) {
  const navigate = useNavigate();
  const { commentId } = useParams();
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const commentsEnabled = bootstrap?.site?.commentsEnabled === true;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const comment = await wpApiFetch(`${getCommentEndpoint(commentId)}?context=edit&_embed=up`);
        if (cancelled) return;
        setDraft(createCommentDraft(comment));
      } catch (error) {
        if (!cancelled) {
          pushNotice({ status: 'error', message: `Failed to load comment: ${error.message}` });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [commentId]);

  const commentFields = useMemo(() => [
    {
      id: 'content',
      label: 'Comment',
      type: 'text',
      Edit: { control: 'textarea', rows: 10 },
      getValue: ({ item }) => item.content,
      setValue: ({ value }) => ({ content: value }),
    },
    {
      id: 'status',
      label: 'Status',
      type: 'text',
      Edit: 'select',
      elements: STATUS_ELEMENTS,
      getValue: ({ item }) => item.status,
      setValue: ({ value }) => ({ status: value }),
    },
  ], []);

  const authorFields = useMemo(() => [
    {
      id: 'authorName',
      label: 'Author Name',
      type: 'text',
      getValue: ({ item }) => item.authorName,
      setValue: ({ value }) => ({ authorName: value }),
    },
    {
      id: 'authorEmail',
      label: 'Author Email',
      type: 'email',
      getValue: ({ item }) => item.authorEmail,
      setValue: ({ value }) => ({ authorEmail: value }),
    },
    {
      id: 'authorUrl',
      label: 'Author URL',
      type: 'url',
      getValue: ({ item }) => item.authorUrl,
      setValue: ({ value }) => ({ authorUrl: value }),
    },
  ], []);

  const regularForm = useMemo(() => ({ layout: { type: 'regular', labelPosition: 'top' } }), []);

  async function saveComment(overrides = {}, successMessage = 'Comment saved.') {
    if (!draft) return;
    setIsSaving(true);
    try {
      const payload = await wpApiFetch(getCommentEndpoint(draft.id), {
        method: 'POST',
        body: {
          content: draft.content,
          status: draft.status,
          author_name: draft.authorName,
          author_email: draft.authorEmail,
          author_url: draft.authorUrl,
          ...overrides,
        },
      });
      const normalized = createCommentDraft(payload);
      setDraft(normalized);
      pushNotice({ status: 'success', message: successMessage });
      return normalized;
    } catch (error) {
      pushNotice({ status: 'error', message: error.message });
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeletePermanently() {
    if (!draft) return;
    if (!window.confirm('Delete this comment permanently? This cannot be undone.')) return;
    setIsDeleting(true);
    try {
      await wpApiFetch(`${getCommentEndpoint(draft.id)}?force=true`, { method: 'DELETE' });
      pushNotice({ status: 'success', message: 'Comment deleted permanently.' });
      navigate('/comments');
    } catch (error) {
      pushNotice({ status: 'error', message: error.message });
    } finally {
      setIsDeleting(false);
    }
  }

  if (loading || !draft) {
    return <SkeletonFormFields fields={7} />;
  }

  const statusMeta = getStatusMeta(draft.status);

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Comments</p>
          <h1>{draft.authorName || 'Anonymous Comment'}</h1>
          <p className="screen-header__lede">{draft.postTitle}</p>
        </div>
        <div className="screen-header__actions">
          <Button variant="secondary" onClick={() => navigate('/comments')}>Back to Comments</Button>
          <Button variant="primary" isBusy={isSaving} onClick={() => saveComment()}>
            Save Changes
          </Button>
        </div>
      </header>

      {!commentsEnabled ? (
        <Notice status="info" isDismissible={false}>
          <p>Comments are disabled in Site Settings. Existing comments can still be reviewed and moderated here.</p>
        </Notice>
      ) : null}

      <div className="settings-layout">
        <div className="settings-layout__main">
          <Card className="surface-card">
            <CardHeader><h2>Comment</h2></CardHeader>
            <CardBody>
              <DataForm
                data={draft}
                fields={commentFields}
                form={{ ...regularForm, fields: commentFields.map((field) => field.id) }}
                onChange={(edits) => setDraft((current) => ({ ...current, ...edits }))}
              />
            </CardBody>
          </Card>

          <Card className="surface-card">
            <CardHeader><h2>Author</h2></CardHeader>
            <CardBody>
              <DataForm
                data={draft}
                fields={authorFields}
                form={{ ...regularForm, fields: authorFields.map((field) => field.id) }}
                onChange={(edits) => setDraft((current) => ({ ...current, ...edits }))}
              />
            </CardBody>
          </Card>
        </div>

        <div className="settings-layout__sidebar">
          <Card className="surface-card">
            <CardBody>
              <div className="user-inspector__header">
                {draft.authorAvatarUrl ? (
                  <img src={draft.authorAvatarUrl} alt="" className="user-avatar user-avatar--large" />
                ) : (
                  <div className="user-avatar user-avatar--large">
                    {(draft.authorName || '?').slice(0, 1).toUpperCase()}
                  </div>
                )}
                <h3 style={{ margin: '8px 0 2px', fontSize: '14px', fontWeight: 600 }}>
                  {draft.authorName || 'Anonymous'}
                </h3>
                {draft.authorEmail ? <span style={{ fontSize: '12px', color: 'var(--wp-admin-text-muted)' }}>{draft.authorEmail}</span> : null}
                <div className="user-inspector__badges">
                  <span className="comment-status-badge" style={{ background: statusMeta.bg, color: statusMeta.color }}>
                    {statusMeta.label}
                  </span>
                  <span className="role-badge">{toTitleCase(draft.type || 'comment')}</span>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card className="surface-card">
            <CardBody>
              <div className="editor-meta">
                <span>ID: {draft.id}</span>
                <span>Submitted: {formatDateTime(draft.date)}</span>
                <span>Response To: {draft.postTitle}</span>
              </div>
              <div className="comment-actions">
                {draft.status !== 'approve' ? (
                  <Button variant="secondary" isBusy={isSaving} onClick={() => saveComment({ status: 'approve' }, 'Comment approved.')}>
                    Approve
                  </Button>
                ) : (
                  <Button variant="secondary" isBusy={isSaving} onClick={() => saveComment({ status: 'hold' }, 'Comment moved to pending.')}>
                    Mark Pending
                  </Button>
                )}
                {draft.status !== 'spam' ? (
                  <Button variant="secondary" isBusy={isSaving} onClick={() => saveComment({ status: 'spam' }, 'Comment marked as spam.')}>
                    Mark as Spam
                  </Button>
                ) : (
                  <Button variant="secondary" isBusy={isSaving} onClick={() => saveComment({ status: 'hold' }, 'Comment restored to pending.')}>
                    Restore
                  </Button>
                )}
                {draft.status !== 'trash' ? (
                  <Button variant="tertiary" isDestructive isBusy={isSaving} onClick={() => saveComment({ status: 'trash' }, 'Comment moved to trash.')}>
                    Move to Trash
                  </Button>
                ) : (
                  <Button variant="tertiary" isDestructive isBusy={isDeleting} onClick={handleDeletePermanently}>
                    Delete Permanently
                  </Button>
                )}
              </div>
              <div className="comment-links">
                {draft.link ? (
                  <a href={draft.link} target="_blank" rel="noreferrer">View Comment</a>
                ) : null}
                {draft.postLink ? (
                  <a href={draft.postLink} target="_blank" rel="noreferrer">View Post</a>
                ) : null}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
