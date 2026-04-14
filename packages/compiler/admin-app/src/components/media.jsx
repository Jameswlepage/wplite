import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  SelectControl,
  TextControl,
  TextareaControl,
} from '@wordpress/components';
import {
  Video,
  Music,
  DocumentPdf,
  Document,
  CloudUpload,
  Upload,
  Copy,
} from '@carbon/icons-react';
import {
  decodeRenderedText,
  formatDateTime,
  normalizeMediaRecord,
  wpApiFetch,
} from '../lib/helpers.js';
import { CarbonIcon } from '../lib/icons.jsx';
import { SkeletonBox } from './skeletons.jsx';

/* ── Mime helpers (Carbon icons, no emoji) ── */
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
          <div className="media-dropzone__overlay-inner">
            <Upload size={40} />
            <strong>Drop files to upload</strong>
            <span>Release to add to the Media Library</span>
          </div>
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
  const [search, setSearch] = useState('');
  const [mimeFilter, setMimeFilter] = useState('all');
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

  // Filter by search + mime bucket
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return media.filter((item) => {
      if (mimeFilter !== 'all' && getMimeBucket(item.mime_type) !== mimeFilter) return false;
      if (!q) return true;
      const title = getTitle(item).toLowerCase();
      return title.includes(q) || (item.mime_type || '').includes(q);
    });
  }, [media, search, mimeFilter]);

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Media</p>
          <h1>Media Library</h1>
          <p className="screen-header__lede">
            {media.length} file{media.length !== 1 ? 's' : ''} in your library.
          </p>
        </div>
        <div className="screen-header__actions">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => { doUpload(Array.from(e.target.files ?? [])); e.target.value = ''; }}
          />
          <Button
            variant="primary"
            isBusy={isUploading}
            onClick={() => fileInputRef.current?.click()}
            icon={<Upload size={16} />}
          >
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
              <div className="empty-state media-upload-empty" onClick={() => fileInputRef.current?.click()}>
                <CloudUpload size={48} className="empty-state__icon" />
                <h2>Your media library is empty</h2>
                <p>Drag files here or click to upload images, videos, audio, and documents.</p>
                <Button
                  variant="primary"
                  icon={<Upload size={16} />}
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                >
                  Upload Files
                </Button>
              </div>
            </CardBody>
          </Card>
        ) : (
          <Fragment>
            <div className="media-toolbar">
              <div className="media-toolbar__filters">
                <TextControl
                  placeholder="Search media…"
                  value={search}
                  onChange={setSearch}
                  className="media-toolbar__search"
                  __next40pxDefaultSize
                  __nextHasNoMarginBottom
                  hideLabelFromVision
                  label="Search media"
                />
                <SelectControl
                  value={mimeFilter}
                  onChange={setMimeFilter}
                  options={[
                    { label: 'All types', value: 'all' },
                    { label: 'Images', value: 'image' },
                    { label: 'Videos', value: 'video' },
                    { label: 'Audio', value: 'audio' },
                    { label: 'Documents', value: 'document' },
                  ]}
                  __next40pxDefaultSize
                  __nextHasNoMarginBottom
                  hideLabelFromVision
                  label="Filter by type"
                />
              </div>
              <span className="media-toolbar__count">
                {filtered.length} {filtered.length === 1 ? 'file' : 'files'}
                {filtered.length !== media.length ? ` of ${media.length}` : ''}
              </span>
            </div>
            {filtered.length === 0 ? (
              <Card className="surface-card">
                <CardBody>
                  <div className="empty-state">
                    <h2>No files match</h2>
                    <p>Try adjusting your search or filter.</p>
                    <Button variant="secondary" onClick={() => { setSearch(''); setMimeFilter('all'); }}>
                      Clear filters
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ) : (
              <div className="media-grid">
                {filtered.map((item) => {
                  const thumb = getThumb(item);
                  const IconComp = getMimeIconComponent(item.mime_type);
                  return (
                    <button
                      key={item.id}
                      className="media-tile"
                      onClick={() => navigate(`/media/${item.id}`)}
                      type="button"
                    >
                      <div className="media-tile__preview">
                        {IconComp ? (
                          <IconComp size={36} className="media-tile__mime-icon" />
                        ) : (
                          <img src={thumb} alt={item.alt_text || ''} loading="lazy" />
                        )}
                      </div>
                      <div className="media-tile__meta">
                        <strong className="media-tile__name" title={getTitle(item)}>{getTitle(item)}</strong>
                        <span className="media-tile__mime">{item.mime_type}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Fragment>
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
    if (!draft?.id || !window.confirm(`Delete ${draft.title || 'this file'}? This cannot be undone.`)) return;
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

  const IconComp = getMimeIconComponent(item.mime_type);
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
                {IconComp ? (
                  <IconComp size={72} className="media-editor__preview-icon" />
                ) : (
                  <img src={item.source_url} alt={draft.altText || ''} />
                )}
              </div>
            </CardBody>
          </Card>
          <Card className="surface-card">
            <CardHeader><h2>Details</h2></CardHeader>
            <CardBody>
              <div className="settings-field-group">
                <TextControl label="Title" value={draft.title} onChange={(v) => setDraft((c) => ({ ...c, title: v }))} __next40pxDefaultSize __nextHasNoMarginBottom />
                <TextControl label="Alt Text" value={draft.altText} onChange={(v) => setDraft((c) => ({ ...c, altText: v }))} help="Describes the image for screen readers and search engines." __next40pxDefaultSize __nextHasNoMarginBottom />
                <TextareaControl label="Caption" value={draft.caption} onChange={(v) => setDraft((c) => ({ ...c, caption: v }))} rows={2} __nextHasNoMarginBottom />
                <TextareaControl label="Description" value={draft.description} onChange={(v) => setDraft((c) => ({ ...c, description: v }))} rows={3} __nextHasNoMarginBottom />
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="settings-layout__sidebar">
          <Card className="surface-card">
            <CardHeader><h2>File Info</h2></CardHeader>
            <CardBody>
              <dl className="settings-info__list">
                <dt>File Name</dt>
                <dd>{item.source_url?.split('/').pop() || '—'}</dd>
                <dt>Type</dt>
                <dd>{item.mime_type}</dd>
                {dimensions && (
                  <Fragment>
                    <dt>Dimensions</dt>
                    <dd>{dimensions}</dd>
                  </Fragment>
                )}
                <dt>Size</dt>
                <dd>{formatFileSize(item.media_details?.filesize)}</dd>
                <dt>Uploaded</dt>
                <dd>{formatDateTime(item.date)}</dd>
                <dt>ID</dt>
                <dd>{item.id}</dd>
              </dl>
            </CardBody>
          </Card>
          <Card className="surface-card">
            <CardHeader><h2>File URL</h2></CardHeader>
            <CardBody>
              <div className="media-editor__url">
                <TextControl
                  label="File URL"
                  hideLabelFromVision
                  value={draft.sourceUrl}
                  readOnly
                  onChange={() => {}}
                  onClick={(e) => e.target.select?.()}
                  __next40pxDefaultSize
                  __nextHasNoMarginBottom
                />
                <Button
                  variant="secondary"
                  onClick={copyUrl}
                  icon={<Copy size={16} />}
                  __next40pxDefaultSize
                >
                  {copySuccess ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <div className="media-editor__actions">
                <Button variant="secondary" href={draft.sourceUrl} target="_blank" rel="noreferrer">
                  Open Original
                </Button>
              </div>
              <div className="media-editor__danger">
                <Button
                  variant="tertiary"
                  isDestructive
                  isBusy={isDeleting}
                  onClick={handleDelete}
                >
                  Delete File
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
