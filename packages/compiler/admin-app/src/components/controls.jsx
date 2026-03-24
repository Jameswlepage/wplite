import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Modal,
  Notice,
  SearchControl,
  Spinner,
  TextControl,
} from '@wordpress/components';
import { Image } from '@carbon/icons-react';
import {
  decodeRenderedText,
  formatDateTime,
  toTitleCase,
  wpApiFetch,
} from '../lib/helpers.js';

function getMediaPreviewUrl(item) {
  return (
    item?.media_details?.sizes?.medium?.source_url
    ?? item?.media_details?.sizes?.thumbnail?.source_url
    ?? item?.source_url
    ?? ''
  );
}

function getMediaLabel(item) {
  return decodeRenderedText(item?.title?.rendered) || item?.title?.raw || item?.slug || '(untitled)';
}

/* ── Image Control ── */
export function ImageControl({ data, field, onChange }) {
  const value = field.getValue({ item: data });
  const attachmentId = Number(value) > 0 ? Number(value) : 0;
  const [previewItem, setPreviewItem] = useState(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryItems, setLibraryItems] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(attachmentId || null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!attachmentId) {
      setPreviewItem(null);
      return;
    }
    wpApiFetch(`wp/v2/media/${attachmentId}`)
      .then((media) => setPreviewItem(media))
      .catch(() => setPreviewItem(null));
  }, [attachmentId]);

  useEffect(() => {
    setSelectedId(attachmentId || null);
  }, [attachmentId]);

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return libraryItems;
    }

    return libraryItems.filter((item) => {
      const title = getMediaLabel(item).toLowerCase();
      const altText = String(item.alt_text ?? '').toLowerCase();
      const fileName = String(item.slug ?? '').toLowerCase();
      return title.includes(needle) || altText.includes(needle) || fileName.includes(needle);
    });
  }, [libraryItems, query]);

  const selectedItem = useMemo(
    () => filteredItems.find((item) => item.id === selectedId)
      ?? libraryItems.find((item) => item.id === selectedId)
      ?? null,
    [filteredItems, libraryItems, selectedId]
  );

  async function loadLibrary() {
    setLibraryLoading(true);
    setLibraryError('');
    try {
      const media = await wpApiFetch(
        'wp/v2/media?per_page=100&media_type=image&orderby=date&order=desc&context=edit'
      );
      setLibraryItems(media);
      setSelectedId((current) => current ?? media[0]?.id ?? null);
    } catch (error) {
      setLibraryError(error.message);
    } finally {
      setLibraryLoading(false);
    }
  }

  async function handleOpenLibrary() {
    setLibraryOpen(true);
    setQuery('');
    await loadLibrary();
  }

  async function handleFileSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', file.name);
      const media = await wpApiFetch('wp/v2/media', {
        method: 'POST',
        body: formData,
      });

      setPreviewItem(media);
      setLibraryItems((current) => [media, ...current.filter((item) => item.id !== media.id)]);
      setSelectedId(media.id);
      onChange(field.setValue({ item: data, value: media.id }));
      setLibraryOpen(true);
    } catch (error) {
      setLibraryError(error.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function handleChooseSelected() {
    if (!selectedId) return;
    const nextItem = libraryItems.find((item) => item.id === selectedId) ?? null;
    onChange(field.setValue({ item: data, value: selectedId }));
    setPreviewItem(nextItem);
    setLibraryOpen(false);
  }

  function handleRemove() {
    onChange(field.setValue({ item: data, value: 0 }));
    setPreviewItem(null);
    setSelectedId(null);
    setLibraryOpen(false);
  }

  return (
    <div className="image-control">
      <span className="image-control__label">{field.label}</span>
      {previewItem ? (
        <div className="image-control__card">
          <div className="image-control__preview">
            <img src={getMediaPreviewUrl(previewItem)} alt={previewItem.alt_text || field.label} />
          </div>
          <div className="image-control__card-meta">
            <strong>{getMediaLabel(previewItem)}</strong>
            <span>{previewItem.mime_type || 'image'}</span>
            <div className="image-control__actions">
              <Button variant="secondary" size="compact" onClick={handleOpenLibrary}>
                Choose Image
              </Button>
              <Button variant="tertiary" size="compact" onClick={() => fileRef.current?.click()}>
                Upload New
              </Button>
              <Button variant="tertiary" size="compact" isDestructive onClick={handleRemove}>
                Remove
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button type="button" className="image-control__empty" onClick={handleOpenLibrary}>
          <Image size={24} />
          <strong>{uploading ? 'Uploading image…' : 'Choose an image'}</strong>
          <span>Browse the library or upload a new file.</span>
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {libraryOpen ? (
        <Modal
          title={field.label || 'Select image'}
          onRequestClose={() => setLibraryOpen(false)}
          className="media-picker-modal"
        >
          <div className="media-picker-modal__toolbar">
            <SearchControl
              className="media-picker-modal__search"
              label="Search images"
              value={query}
              onChange={setQuery}
              __nextHasNoMarginBottom
            />
            <Button variant="secondary" isBusy={uploading} onClick={() => fileRef.current?.click()}>
              Upload Image
            </Button>
          </div>

          {libraryError ? (
            <Notice status="error" isDismissible={false}>
              <p>{libraryError}</p>
            </Notice>
          ) : null}

          {libraryLoading ? (
            <div className="media-picker-modal__loading">
              <Spinner />
            </div>
          ) : (
            <div className="media-picker-modal__layout">
              <div className="media-picker-modal__library">
                {filteredItems.length === 0 ? (
                  <div className="empty-state">
                    <h2>No images found</h2>
                    <p>Upload a new image or refine your search.</p>
                  </div>
                ) : (
                  <div className="media-grid">
                    {filteredItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={item.id === selectedId ? 'media-tile is-selected' : 'media-tile'}
                        onClick={() => setSelectedId(item.id)}
                      >
                        <div className="media-tile__preview">
                          <img src={getMediaPreviewUrl(item)} alt={item.alt_text || ''} />
                        </div>
                        <div className="media-tile__meta">
                          <strong>{getMediaLabel(item)}</strong>
                          <span>{item.mime_type}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <aside className="media-picker-modal__inspector">
                {selectedItem ? (
                  <div className="media-picker-modal__inspector-card">
                    <div className="media-inspector__preview">
                      <img src={selectedItem.source_url} alt={selectedItem.alt_text || ''} />
                    </div>
                    <div className="media-picker-modal__meta">
                      <strong>{getMediaLabel(selectedItem)}</strong>
                      <span>{selectedItem.mime_type}</span>
                      <span>{formatDateTime(selectedItem.modified || selectedItem.date)}</span>
                    </div>
                    <div className="stacked-actions">
                      <Button variant="primary" onClick={handleChooseSelected}>
                        Use Image
                      </Button>
                      <Button variant="secondary" href={selectedItem.source_url} target="_blank">
                        Open File
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="media-picker-modal__empty">
                    <p>Select an image to preview and use it here.</p>
                  </div>
                )}
              </aside>
            </div>
          )}
        </Modal>
      ) : null}
    </div>
  );
}

/* ── Repeater Control ── */
export function RepeaterControl({ data, field, onChange }) {
  const value = field.getValue({ item: data }) ?? [];
  const itemSchema = field.itemSchema ?? { label: { type: 'text' }, value: { type: 'text' } };
  const keys = Object.keys(itemSchema);

  function commit(nextValue) {
    onChange(field.setValue({ item: data, value: nextValue }));
  }
  function updateRow(rowIndex, key, next) {
    commit(value.map((row, i) => (i === rowIndex ? { ...row, [key]: next } : row)));
  }
  function addRow() {
    commit([...(Array.isArray(value) ? value : []), Object.fromEntries(keys.map((k) => [k, '']))]);
  }
  function removeRow(rowIndex) {
    commit(value.filter((_, i) => i !== rowIndex));
  }

  return (
    <div className="repeater-control">
      <div className="repeater-control__header">
        <strong>{field.label}</strong>
        <Button variant="secondary" size="compact" onClick={addRow}>Add Row</Button>
      </div>
      {value.length === 0 && <p className="field-hint">No rows yet.</p>}
      {value.map((row, rowIndex) => (
        <div className="repeater-control__row" key={`${field.id}-${rowIndex}`}>
          {keys.map((key) => (
            <TextControl
              key={key}
              label={itemSchema[key]?.label ?? toTitleCase(key)}
              value={row?.[key] ?? ''}
              onChange={(next) => updateRow(rowIndex, key, next)}
              __next40pxDefaultSize
            />
          ))}
          <Button className="repeater-control__remove" variant="tertiary" isDestructive onClick={() => removeRow(rowIndex)}>
            Remove
          </Button>
        </div>
      ))}
    </div>
  );
}

/* ── Notice Stack ── */
export function NoticeStack({ notices, onDismiss }) {
  if (notices.length === 0) return null;
  return (
    <div className="notice-stack">
      {notices.map((notice) => (
        <Notice key={notice.id} status={notice.status} isDismissible onRemove={() => onDismiss(notice.id)}>
          <p>{notice.message}</p>
        </Notice>
      ))}
    </div>
  );
}
