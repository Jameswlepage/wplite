import React, { Fragment, startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  CardBody,
  PanelBody,
  SelectControl,
  TextControl,
} from '@wordpress/components';
import { serialize } from '@wordpress/blocks';
import { DataViews, filterSortAndPaginate } from '@wordpress/dataviews';
import {
  formatDate,
  formatDateTime,
  getStatusBadgeClass,
  normalizePageRecord,
  wpApiFetch,
} from '../lib/helpers.js';
import { blocksFromContent } from '../lib/blocks.jsx';
import { SkeletonTableRows, EditorSkeleton } from './skeletons.jsx';
import { NativeBlockEditorFrame } from './block-editor.jsx';

/* ── Pages screen using DataViews ── */
export function PagesPage({ pushNotice }) {
  const navigate = useNavigate();
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const response = await wpApiFetch(
          'wp/v2/pages?per_page=100&orderby=modified&order=desc&context=edit&status=any'
        );
        setPages(response.map(normalizePageRecord));
      } catch (err) {
        pushNotice({ status: 'error', message: `Failed to load pages: ${err.message}` });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const fields = useMemo(() => [
    {
      id: 'title',
      label: 'Title',
      type: 'text',
      enableGlobalSearch: true,
      enableSorting: true,
      enableHiding: false,
      getValue: ({ item }) => item.title,
      render: ({ item }) => <strong>{item.title || '(no title)'}</strong>,
    },
    {
      id: 'postStatus',
      label: 'Status',
      type: 'text',
      enableSorting: true,
      enableHiding: true,
      elements: [
        { value: 'publish', label: 'Published' },
        { value: 'draft', label: 'Draft' },
        { value: 'pending', label: 'Pending' },
        { value: 'private', label: 'Private' },
      ],
      filterBy: {},
      getValue: ({ item }) => item.postStatus,
      render: ({ item }) => (
        <span className={getStatusBadgeClass(item.postStatus)}>{item.postStatus}</span>
      ),
    },
    {
      id: 'modified',
      label: 'Updated',
      type: 'datetime',
      enableSorting: true,
      enableHiding: true,
      getValue: ({ item }) => item.modified,
    },
  ], []);

  const [view, setView] = useState({
    type: 'table',
    search: '',
    page: 1,
    perPage: 20,
    fields: ['title', 'postStatus', 'modified'],
    filters: [],
    sort: { field: 'modified', direction: 'desc' },
    layout: {},
    titleField: 'title',
  });

  const deferredPages = useDeferredValue(pages);
  const processed = useMemo(() => {
    return filterSortAndPaginate(deferredPages, view, fields);
  }, [deferredPages, fields, view]);

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Pages</p>
          <h1>Pages</h1>
          <p className="screen-header__lede">Create and manage your site's pages.</p>
        </div>
        <div className="screen-header__actions">
          <Button variant="primary" onClick={() => navigate('/pages/new')}>
            Add New Page
          </Button>
        </div>
      </header>
      {loading ? (
        <Card className="surface-card"><CardBody><SkeletonTableRows rows={6} cols={3} /></CardBody></Card>
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
              onClickItem={(item) => navigate(`/pages/${item.id}`)}
              isItemClickable={() => true}
              defaultLayouts={{ table: {} }}
              search
              empty={
                <div className="empty-state">
                  <h2>No pages found</h2>
                  <p>Create your first page to get started.</p>
                  <Button variant="primary" onClick={() => navigate('/pages/new')}>
                    Add New Page
                  </Button>
                </div>
              }
            >
              <div className="dataviews-shell">
                <div className="dataviews-toolbar">
                  <DataViews.Search label="Search pages" />
                  <DataViews.FiltersToggle />
                  <div className="dataviews-toolbar__spacer" />
                  <DataViews.ViewConfig />
                </div>
                <DataViews.FiltersToggled />
                <DataViews.Layout className="dataviews-layout" />
                <div className="dataviews-footer">
                  <span>{processed.paginationInfo.totalItems} pages</span>
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

export function PageEditorPage({ bootstrap, pushNotice }) {
  const themeJson = bootstrap?.themeJson ?? null;
  const navigate = useNavigate();
  const { pageId } = useParams();
  const isNew = pageId === 'new';
  const [pages, setPages] = useState([]);
  const [draft, setDraft] = useState(() => ({
    title: '',
    slug: '',
    routeId: '',
    postStatus: 'draft',
    content: '',
    parent: 0,
    template: '',
    menuOrder: 0,
    link: '',
    modified: '',
  }));
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const pageItems = await wpApiFetch(
          'wp/v2/pages?per_page=100&orderby=modified&order=desc&context=edit&status=any'
        );
        if (cancelled) return;

        const normalizedPages = pageItems.map(normalizePageRecord);
        setPages(normalizedPages);

        if (isNew) {
          const nextDraft = {
            title: '',
            slug: '',
            routeId: '',
            postStatus: 'draft',
            content: '',
            parent: 0,
            template: '',
            menuOrder: 0,
            link: '',
            modified: '',
          };
          setDraft(nextDraft);
          setBlocks([]);
          return;
        }

        const page = await wpApiFetch(`wp/v2/pages/${pageId}?context=edit`);
        if (cancelled) return;
        const normalized = normalizePageRecord(page);
        setDraft(normalized);
        setBlocks(blocksFromContent(normalized.content));
      } catch (error) {
        if (!cancelled) {
          pushNotice({ status: 'error', message: `Failed to load page: ${error.message}` });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [bootstrap, isNew, pageId]);

  async function handleSave() {
    setIsSaving(true);
    try {
      const endpoint = isNew ? 'wp/v2/pages' : `wp/v2/pages/${pageId}`;
      const payload = await wpApiFetch(endpoint, {
        method: 'POST',
        body: {
          title: draft.title,
          slug: draft.slug,
          status: draft.postStatus,
          content: serialize(blocks),
          parent: Number(draft.parent || 0),
          template: draft.template || '',
          menu_order: Number(draft.menuOrder || 0),
        },
      });

      const normalized = normalizePageRecord(payload);
      setDraft(normalized);
      setBlocks(blocksFromContent(normalized.content));
      setPages((current) => {
        const next = [...current];
        const index = next.findIndex((item) => String(item.id) === String(normalized.id));
        if (index >= 0) next[index] = normalized;
        else next.unshift(normalized);
        return next;
      });
      pushNotice({ status: 'success', message: 'Page saved.' });

      if (isNew) {
        startTransition(() => navigate(`/pages/${normalized.id}`, { replace: true }));
      }
    } catch (error) {
      pushNotice({ status: 'error', message: error.message });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (isNew || !window.confirm(`Delete ${draft.title || 'this page'}?`)) return;
    setIsDeleting(true);
    try {
      await wpApiFetch(`wp/v2/pages/${pageId}?force=true`, { method: 'DELETE' });
      pushNotice({ status: 'success', message: 'Page deleted.' });
      navigate('/pages');
    } catch (error) {
      pushNotice({ status: 'error', message: error.message });
    } finally {
      setIsDeleting(false);
    }
  }

  useEffect(() => {
    function onKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key === 's') {
        event.preventDefault();
        if (!isSaving) handleSave();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  if (loading) {
    return <EditorSkeleton />;
  }

  const parentOptions = [
    { value: '0', label: 'No parent' },
    ...pages
      .filter((page) => String(page.id) !== String(pageId))
      .map((page) => ({ value: String(page.id), label: page.title || `Page ${page.id}` })),
  ];
  const templateOptions = [
    { value: '', label: 'Default template' },
    ...((themeJson?.customTemplates ?? []).map((template) => ({
      value: template.name,
      label: template.title,
    }))),
  ];
  function handleBlocksChange(nextBlocks) {
    setBlocks(nextBlocks);
  }

  return (
    <NativeBlockEditorFrame
      label="Pages"
      title={draft.title}
      titlePlaceholder="Add page title"
      onChangeTitle={(value) => {
        setDraft((current) => ({ ...current, title: value }));
      }}
      showTitleInput={true}
      blocks={blocks}
      onChangeBlocks={handleBlocksChange}
      backLabel="Back to Pages"
      onBack={() => navigate('/pages')}
      primaryActionLabel="Save Page"
      onPrimaryAction={handleSave}
      isPrimaryBusy={isSaving}
      viewUrl={draft.link}
      documentLabel="Page"
      wpAdminUrl={!isNew ? `/wp-admin/post.php?post=${draft.id}&action=edit` : undefined}
      documentSidebar={
        <>
          <PanelBody title="Summary" initialOpen={true}>
            <div className="inline-field-grid">
              <TextControl
                label="Slug"
                value={draft.slug ?? ''}
                onChange={(value) => setDraft((current) => ({ ...current, slug: value }))}
                __next40pxDefaultSize
              />
              <SelectControl
                label="Status"
                value={draft.postStatus ?? 'draft'}
                options={[
                  { value: 'draft', label: 'Draft' },
                  { value: 'publish', label: 'Published' },
                  { value: 'pending', label: 'Pending Review' },
                  { value: 'private', label: 'Private' },
                ]}
                onChange={(value) => setDraft((current) => ({ ...current, postStatus: value }))}
                __next40pxDefaultSize
              />
            </div>
          </PanelBody>

          <PanelBody title="Page attributes" initialOpen={true}>
            <div className="inline-field-grid">
              <SelectControl
                label="Parent"
                value={String(draft.parent ?? 0)}
                options={parentOptions}
                onChange={(value) => setDraft((current) => ({ ...current, parent: Number(value || 0) }))}
                __next40pxDefaultSize
              />
              <TextControl
                label="Menu Order"
                type="number"
                value={String(draft.menuOrder ?? 0)}
                onChange={(value) => setDraft((current) => ({ ...current, menuOrder: Number(value || 0) }))}
                __next40pxDefaultSize
              />
            </div>

            <SelectControl
              label="Template"
              value={draft.template ?? ''}
              options={templateOptions}
              onChange={(value) => setDraft((current) => ({ ...current, template: value }))}
              __next40pxDefaultSize
            />
          </PanelBody>

          {!isNew ? (
            <PanelBody title="Details" initialOpen={true}>
              <div className="editor-meta">
                <span>ID: {draft.id}</span>
                <span>Updated: {formatDateTime(draft.modified)}</span>
              </div>
              {draft.routeId === bootstrap?.site?.postsPage ? (
                <p className="field-hint">
                  This route is assigned as the posts page, so WordPress renders the archive
                  template instead of the page body.
                </p>
              ) : null}
            </PanelBody>
          ) : null}
        </>
      }
      blockSidebarFooter={!isNew ? (
        <Button variant="tertiary" isDestructive isBusy={isDeleting} onClick={handleDelete}>
          Delete
        </Button>
      ) : null}
    />
  );
}
