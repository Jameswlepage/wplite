import React, { Fragment, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  TextControl,
  TextareaControl,
} from '@wordpress/components';
import { DataViews, filterSortAndPaginate } from '@wordpress/dataviews';
import {
  decodeRenderedText,
  formatDate,
  formatDateTime,
  normalizeMediaRecord,
  wpApiFetch,
} from '../lib/helpers.js';
import { CarbonIcon } from '../lib/icons.jsx';
import { SkeletonBox } from './skeletons.jsx';

function getMimeIcon(mimeType) {
  if (!mimeType) return '📄';
  if (mimeType.startsWith('image/')) return null;
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.includes('pdf')) return '📕';
  return '📄';
}

function getThumb(item) {
  return item.media_details?.sizes?.thumbnail?.source_url
    || item.media_details?.sizes?.medium?.source_url
    || item.source_url;
}

function formatFileSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getTitle(item) {
  return decodeRenderedText(item.title?.rendered) || item.slug || '(untitled)';
}

/* ── Drop Zone ── */
function UploadDropZone({ onUpload, children }) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      className={`media-dropzone${dragOver ? ' is-dragging' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); onUpload(Array.from(e.dataTransfer.files)); }}
    >
      {dragOver && (
        <div className="media-dropzone__overlay">
          <CarbonIcon name="Image" size={32} />
          <span>Drop files to upload</span>
        </div>
      )}
      {children}
    </div>
  );
}

/* ── Media Library ── */
export function MediaPage({ pushNotice }) {
  const navigate = useNavigate();
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [search, setSearch] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await wpApiFetch('wp/v2/media?per_page=100&orderby=date&order=desc&context=edit');
        setMedia(response);
      } catch (err) {
        pushNotice({ status: 'error', message: `Failed to load media: ${err.message}` });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

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
      pushNotice({ status: 'success', message: `${uploaded.length} file${uploaded.length === 1 ? '' : 's'} uploaded.` });
      if (uploaded.length === 1) navigate(`/media/${uploaded[0].id}`);
    } catch (error) {
      pushNotice({ status: 'error', message: error.message });
    } finally {
      setIsUploading(false);
    }
  }, [navigate, pushNotice]);

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return media;
    const q = search.toLowerCase();
    return media.filter((item) => {
      const title = getTitle(item).toLowerCase();
      return title.includes(q) || (item.mime_type || '').includes(q);
    });
  }, [media, search]);

  // DataViews fields for table mode
  const fields = useMemo(() => [
    {
      id: 'title',
      label: 'File',
      enableGlobalSearch: true,
      enableSorting: true,
      enableHiding: false,
      getValue: ({ item }) => getTitle(item),
      render: ({ item }) => {
        const thumb = getThumb(item);
        const icon = getMimeIcon(item.mime_type);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="media-list-thumb">
              {icon ? <span style={{ fontSize: '18px' }}>{icon}</span> : <img src={thumb} alt="" />}
            </div>
            <strong>{getTitle(item)}</strong>
          </div>
        );
      },
    },
    {
      id: 'mime_type',
      label: 'Type',
      type: 'text',
      enableSorting: true,
      getValue: ({ item }) => item.mime_type,
      render: ({ item }) => <span style={{ color: 'var(--wp-admin-text-muted)', fontSize: '12px' }}>{item.mime_type}</span>,
    },
    {
      id: 'filesize',
      label: 'Size',
      enableSorting: true,
      getValue: ({ item }) => item.media_details?.filesize ?? 0,
      render: ({ item }) => <span style={{ color: 'var(--wp-admin-text-muted)' }}>{formatFileSize(item.media_details?.filesize)}</span>,
    },
    {
      id: 'date',
      label: 'Uploaded',
      type: 'datetime',
      enableSorting: true,
      getValue: ({ item }) => item.date,
    },
  ], []);

  const [tableView, setTableView] = useState({
    type: 'table',
    search: '',
    page: 1,
    perPage: 25,
    fields: ['title', 'mime_type', 'filesize', 'date'],
    filters: [],
    sort: { field: 'date', direction: 'desc' },
    layout: {},
  });

  const deferredMedia = useDeferredValue(media);
  const tableProcessed = useMemo(
    () => filterSortAndPaginate(deferredMedia, tableView, fields),
    [deferredMedia, tableView, fields]
  );

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Media</p>
          <h1>Media Library</h1>
          <p className="screen-header__lede">{media.length} file{media.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="screen-header__actions">
          <Button variant="secondary" onClick={() => setViewMode(viewMode === 'grid' ? 'table' : 'grid')}>
            {viewMode === 'grid' ? 'List View' : 'Grid View'}
          </Button>
          <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => { doUpload(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
          <Button variant="primary" isBusy={isUploading} onClick={() => fileInputRef.current?.click()}>
            Upload Files
          </Button>
        </div>
      </header>

      <UploadDropZone onUpload={doUpload}>
        {loading ? (
          <Card className="surface-card">
            <CardBody>
              <div className="media-grid">
                {Array.from({ length: 12 }, (_, i) => (
                  <div key={i} className="skeleton-media-tile">
                    <div className="skeleton-media-tile__preview" />
                    <div className="skeleton-media-tile__label">
                      <SkeletonBox height={11} style={{ width: `${50 + (i % 4) * 12}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        ) : media.length === 0 ? (
          <Card className="surface-card">
            <CardBody>
              <div className="media-upload-empty" onClick={() => fileInputRef.current?.click()}>
                <CarbonIcon name="Image" size={32} />
                <strong>Drop files here or click to upload</strong>
                <span>Supports images, videos, documents, and audio</span>
              </div>
            </CardBody>
          </Card>
        ) : viewMode === 'grid' ? (
          <Fragment>
            <div className="media-toolbar">
              <div className="media-toolbar__search">
                <input
                  type="text"
                  placeholder="Search media..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="media-toolbar__input"
                />
              </div>
              <span className="media-toolbar__count">{filtered.length} file{filtered.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="media-grid">
              {filtered.map((item) => {
                const thumb = getThumb(item);
                const icon = getMimeIcon(item.mime_type);
                return (
                  <button
                    key={item.id}
                    className="media-tile"
                    onClick={() => navigate(`/media/${item.id}`)}
                    type="button"
                  >
                    <div className="media-tile__preview">
                      {icon ? (
                        <span style={{ fontSize: '36px' }}>{icon}</span>
                      ) : (
                        <img src={thumb} alt={item.alt_text || ''} />
                      )}
                    </div>
                    <div className="media-tile__meta">
                      <strong>{getTitle(item)}</strong>
                      <span>{item.mime_type}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </Fragment>
        ) : (
          <Card className="surface-card">
            <CardBody>
              <DataViews
                data={tableProcessed.data}
                fields={fields}
                view={tableView}
                onChangeView={setTableView}
                getItemId={(item) => String(item.id)}
                paginationInfo={tableProcessed.paginationInfo}
                onClickItem={(item) => navigate(`/media/${item.id}`)}
                isItemClickable={() => true}
                defaultLayouts={{ table: {} }}
                search
                empty={
                  <div className="empty-state">
                    <h2>No results</h2>
                    <p>Try adjusting your search.</p>
                  </div>
                }
              >
                <div className="dataviews-shell">
                  <div className="dataviews-toolbar">
                    <DataViews.Search label="Search media" />
                    <div className="dataviews-toolbar__spacer" />
                    <DataViews.ViewConfig />
                  </div>
                  <DataViews.Layout className="dataviews-layout" />
                  <div className="dataviews-footer">
                    <span>{tableProcessed.paginationInfo.totalItems} files</span>
                    <DataViews.Pagination />
                  </div>
                </div>
              </DataViews>
            </CardBody>
          </Card>
        )}
      </UploadDropZone>
    </div>
  );
}

/* ── Media Editor Page ── */
export function MediaEditorPage({ pushNotice }) {
  const navigate = useNavigate();
  const { mediaId } = useParams();
  const [item, setItem] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await wpApiFetch(`wp/v2/media/${mediaId}?context=edit`);
        if (cancelled) return;
        setItem(response);
        setDraft(normalizeMediaRecord(response));
      } catch (err) {
        if (!cancelled) pushNotice({ status: 'error', message: `Failed to load: ${err.message}` });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [mediaId]);

  async function handleSave() {
    if (!draft?.id) return;
    setIsSaving(true);
    try {
      const payload = await wpApiFetch(`wp/v2/media/${draft.id}`, {
        method: 'POST',
        body: { title: draft.title, alt_text: draft.altText, caption: draft.caption, description: draft.description },
      });
      setItem(payload);
      setDraft(normalizeMediaRecord(payload));
      pushNotice({ status: 'success', message: 'Saved.' });
    } catch (error) {
      pushNotice({ status: 'error', message: error.message });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!draft?.id || !window.confirm(`Delete ${draft.title || 'this file'}?`)) return;
    setIsDeleting(true);
    try {
      await wpApiFetch(`wp/v2/media/${draft.id}?force=true`, { method: 'DELETE' });
      pushNotice({ status: 'success', message: 'Deleted.' });
      navigate('/media');
    } catch (error) {
      pushNotice({ status: 'error', message: error.message });
    } finally {
      setIsDeleting(false);
    }
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(draft.sourceUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {}
  }

  if (loading || !item || !draft) {
    return (
      <div className="screen">
        <div className="settings-layout">
          <Card className="surface-card"><CardBody><SkeletonBox height={300} style={{ width: '100%', borderRadius: '6px' }} /></CardBody></Card>
          <Card className="surface-card"><CardBody><SkeletonBox height={200} style={{ width: '100%' }} /></CardBody></Card>
        </div>
      </div>
    );
  }

  const icon = getMimeIcon(item.mime_type);
  const dimensions = item.media_details?.width && item.media_details?.height
    ? `${item.media_details.width} × ${item.media_details.height}` : null;

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Media</p>
          <h1>{draft.title || '(untitled)'}</h1>
        </div>
        <div className="screen-header__actions">
          <Button variant="secondary" onClick={() => navigate('/media')}>Back to Media</Button>
          <Button variant="primary" isBusy={isSaving} onClick={handleSave}>Save</Button>
        </div>
      </header>

      <div className="settings-layout">
        <div className="settings-layout__main">
          <Card className="surface-card">
            <CardBody>
              <div className="media-editor__preview">
                {icon ? <span style={{ fontSize: '64px' }}>{icon}</span> : <img src={item.source_url} alt={draft.altText || ''} />}
              </div>
            </CardBody>
          </Card>
          <Card className="surface-card">
            <CardHeader><h2>Details</h2></CardHeader>
            <CardBody>
              <div className="settings-field-group">
                <TextControl label="Title" value={draft.title} onChange={(v) => setDraft((c) => ({ ...c, title: v }))} __next40pxDefaultSize />
                <TextControl label="Alt Text" value={draft.altText} onChange={(v) => setDraft((c) => ({ ...c, altText: v }))} help="Describes the image for screen readers and search engines." __next40pxDefaultSize />
                <TextareaControl label="Caption" value={draft.caption} onChange={(v) => setDraft((c) => ({ ...c, caption: v }))} rows={2} />
                <TextareaControl label="Description" value={draft.description} onChange={(v) => setDraft((c) => ({ ...c, description: v }))} rows={3} />
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="settings-layout__sidebar">
          <Card className="surface-card">
            <CardHeader><h2>File Info</h2></CardHeader>
            <CardBody>
              <dl className="settings-info__list">
                <dt>File Name</dt><dd>{item.source_url?.split('/').pop() || '—'}</dd>
                <dt>Type</dt><dd>{item.mime_type}</dd>
                {dimensions && <Fragment><dt>Dimensions</dt><dd>{dimensions}</dd></Fragment>}
                <dt>Size</dt><dd>{formatFileSize(item.media_details?.filesize)}</dd>
                <dt>Uploaded</dt><dd>{formatDateTime(item.date)}</dd>
                <dt>ID</dt><dd>{item.id}</dd>
              </dl>
            </CardBody>
          </Card>
          <Card className="surface-card">
            <CardBody>
              <div className="settings-field-group">
                <label className="media-url-label">File URL</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input type="text" readOnly value={draft.sourceUrl} onClick={(e) => e.target.select()} className="media-url-input" />
                  <Button variant="secondary" size="compact" onClick={copyUrl}>{copySuccess ? 'Copied' : 'Copy'}</Button>
                </div>
              </div>
              <div style={{ display: 'grid', gap: '6px', marginTop: '12px' }}>
                <Button variant="secondary" href={draft.sourceUrl} target="_blank">Open Original</Button>
                <Button variant="tertiary" isDestructive isBusy={isDeleting} onClick={handleDelete}>Delete File</Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
