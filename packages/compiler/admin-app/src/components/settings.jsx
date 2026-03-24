import React, { Fragment, useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  SelectControl,
  TextControl,
} from '@wordpress/components';
import { DataForm } from '@wordpress/dataviews';
import {
  apiFetch,
  buildFieldDefinitions,
  buildFormConfig,
  createEmptySingleton,
  normalizePageRecord,
  wpApiFetch,
} from '../lib/helpers.js';
import { ImageControl, RepeaterControl } from './controls.jsx';
import { SettingsFormSkeleton } from './skeletons.jsx';

/* ── Site Settings Page ── */
export function SiteSettingsPage({ bootstrap, setBootstrap, pushNotice }) {
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
          timezone: settings.timezone ?? '',
          date_format: settings.date_format ?? 'F j, Y',
          time_format: settings.time_format ?? 'g:i a',
          start_of_week: settings.start_of_week ?? 1,
          posts_per_page: settings.posts_per_page ?? 10,
          show_on_front: settings.show_on_front ?? 'posts',
          page_on_front: settings.page_on_front ?? 0,
          page_for_posts: settings.page_for_posts ?? 0,
        });
        setPages(pageItems.map(normalizePageRecord));
      } catch (error) {
        if (!cancelled) {
          pushNotice({ status: 'error', message: `Failed to load site settings: ${error.message}` });
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

  async function handleSave() {
    if (!draft) return;
    setIsSaving(true);
    try {
      const payload = await wpApiFetch('wp/v2/settings', {
        method: 'POST',
        body: {
          title: draft.title,
          description: draft.description,
          timezone: draft.timezone,
          date_format: draft.date_format,
          time_format: draft.time_format,
          start_of_week: Number(draft.start_of_week || 0),
          posts_per_page: Number(draft.posts_per_page || 10),
          show_on_front: draft.show_on_front,
          page_on_front: draft.show_on_front === 'page' ? Number(draft.page_on_front || 0) : 0,
          page_for_posts: draft.show_on_front === 'page' ? Number(draft.page_for_posts || 0) : 0,
        },
      });

      setDraft((current) => ({
        ...current,
        title: payload.title ?? current.title,
        description: payload.description ?? current.description,
      }));
      setBootstrap((current) => ({
        ...current,
        site: {
          ...current.site,
          title: payload.title ?? current.site.title,
          tagline: payload.description ?? current.site.tagline,
        },
      }));
      pushNotice({ status: 'success', message: 'Site settings saved.' });
    } catch (error) {
      pushNotice({ status: 'error', message: error.message });
    } finally {
      setIsSaving(false);
    }
  }

  if (loading || !draft) {
    return <SettingsFormSkeleton />;
  }

  const pageOptions = [{ value: '0', label: 'Select a page' }].concat(
    pages.map((page) => ({ value: String(page.id), label: page.title || `Page ${page.id}` }))
  );

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Site</h1>
          <p className="screen-header__lede">Configure your site identity, homepage, and formatting preferences.</p>
        </div>
        <div className="screen-header__actions">
          <Button variant="primary" isBusy={isSaving} onClick={handleSave}>Save Settings</Button>
        </div>
      </header>

      <div className="settings-layout">
        <div className="settings-layout__main">
          {/* Identity */}
          <Card className="surface-card">
            <CardHeader><h2>Identity</h2></CardHeader>
            <CardBody>
              <div className="settings-field-group">
                <TextControl
                  label="Site Title"
                  value={draft.title}
                  onChange={(value) => setDraft((c) => ({ ...c, title: value }))}
                  __next40pxDefaultSize
                />
                <TextControl
                  label="Tagline"
                  value={draft.description}
                  onChange={(value) => setDraft((c) => ({ ...c, description: value }))}
                  help="A short description of your site."
                  __next40pxDefaultSize
                />
              </div>
            </CardBody>
          </Card>

          {/* Homepage */}
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
                  onChange={(value) => setDraft((c) => ({ ...c, show_on_front: value }))}
                  __next40pxDefaultSize
                />
                {draft.show_on_front === 'page' && (
                  <div className="inline-field-grid">
                    <SelectControl
                      label="Homepage"
                      value={String(draft.page_on_front)}
                      options={pageOptions}
                      onChange={(value) => setDraft((c) => ({ ...c, page_on_front: Number(value || 0) }))}
                      __next40pxDefaultSize
                    />
                    <SelectControl
                      label="Posts Page"
                      value={String(draft.page_for_posts)}
                      options={pageOptions}
                      onChange={(value) => setDraft((c) => ({ ...c, page_for_posts: Number(value || 0) }))}
                      __next40pxDefaultSize
                    />
                  </div>
                )}
                <TextControl
                  label="Posts Per Page"
                  type="number"
                  value={String(draft.posts_per_page)}
                  onChange={(value) => setDraft((c) => ({ ...c, posts_per_page: Number(value || 10) }))}
                  __next40pxDefaultSize
                />
              </div>
            </CardBody>
          </Card>

          {/* Formatting */}
          <Card className="surface-card">
            <CardHeader><h2>Date &amp; Time</h2></CardHeader>
            <CardBody>
              <div className="settings-field-group">
                <TextControl
                  label="Timezone"
                  value={draft.timezone}
                  onChange={(value) => setDraft((c) => ({ ...c, timezone: value }))}
                  help="Example: America/New_York, Europe/London, Asia/Tokyo"
                  __next40pxDefaultSize
                />
                <div className="inline-field-grid">
                  <TextControl
                    label="Date Format"
                    value={draft.date_format}
                    onChange={(value) => setDraft((c) => ({ ...c, date_format: value }))}
                    __next40pxDefaultSize
                  />
                  <TextControl
                    label="Time Format"
                    value={draft.time_format}
                    onChange={(value) => setDraft((c) => ({ ...c, time_format: value }))}
                    __next40pxDefaultSize
                  />
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
                  onChange={(value) => setDraft((c) => ({ ...c, start_of_week: Number(value || 0) }))}
                  __next40pxDefaultSize
                />
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="settings-layout__sidebar">
          <Card className="surface-card">
            <CardBody>
              <div className="settings-info">
                <h3>Quick Reference</h3>
                <dl className="settings-info__list">
                  <dt>Site URL</dt>
                  <dd>{window.location.origin}</dd>
                  <dt>Admin</dt>
                  <dd>{window.location.origin}/app</dd>
                  <dt>WordPress</dt>
                  <dd>
                    <a href={`${window.location.origin}/wp-admin/?classic-admin=1`} target="_blank" rel="noreferrer">
                      Classic Admin
                    </a>
                  </dd>
                </dl>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ── Singleton Editor Page ── */
export function SingletonEditorPage({ bootstrap, singletonData, setSingletonData, pushNotice }) {
  const { singletonId } = useParams();
  const singleton = bootstrap.singletons.find((item) => item.id === singletonId) ?? null;
  const schema = singleton ? bootstrap.adminSchema.forms?.[singleton.id] : null;
  const [draft, setDraft] = useState(() => (singleton ? singletonData[singleton.id] ?? createEmptySingleton() : {}));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (singleton) setDraft(singletonData[singleton.id] ?? createEmptySingleton());
  }, [singleton, singletonData]);

  const pseudoModel = useMemo(() => ({ ...singleton, supports: [] }), [singleton]);

  const fields = useMemo(() => {
    if (!schema || !pseudoModel) return [];
    return buildFieldDefinitions({ schema, model: pseudoModel, recordsByModel: {}, includeContentField: true, ImageControl, RepeaterControl });
  }, [pseudoModel, schema, singletonData]);

  const form = useMemo(() => {
    if (!schema) return null;
    return buildFormConfig(schema, fields.map((f) => f.id));
  }, [fields, schema]);

  if (!singleton || !schema || !form) return <Navigate to="/" replace />;

  async function handleSave() {
    setIsSaving(true);
    try {
      const payload = await apiFetch(`singleton/${singleton.id}`, { method: 'POST', body: draft });
      setSingletonData((current) => ({ ...current, [singleton.id]: payload.item }));
      pushNotice({ status: 'success', message: `${singleton.label} saved.` });
    } catch (error) {
      pushNotice({ status: 'error', message: error.message });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>{singleton.label}</h1>
        </div>
        <div className="screen-header__actions">
          <Button variant="primary" isBusy={isSaving} onClick={handleSave}>Save Settings</Button>
        </div>
      </header>

      <div className="settings-layout">
        <div className="settings-layout__main">
          <Card className="surface-card">
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
      </div>
    </div>
  );
}
