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
import { createBlock, serialize } from '@wordpress/blocks';
import { DataViews, filterSortAndPaginate } from '@wordpress/dataviews';
import {
  analyzeTemplateMarkup,
  formatDate,
  formatDateTime,
  getStatusBadgeClass,
  getRouteManifestForPage,
  normalizePageRecord,
  wpApiFetch,
} from '../lib/helpers.js';
import { createInternalLinkResolver } from '../lib/internal-links.js';
import { blocksFromContent } from '../lib/blocks.jsx';
import { SkeletonTableRows, EditorSkeleton } from './skeletons.jsx';
import { NativeBlockEditorFrame } from './block-editor.jsx';
import { useRegisterWorkspaceSurface } from './workspace-context.jsx';
import { useRegisterAssistantContext } from './assistant-provider.jsx';

const PAGE_TEMPLATE_SLOT_CLASS = 'wplite-page-template-slot';

function cloneBlockTree(block) {
  return createBlock(
    block.name,
    { ...(block.attributes ?? {}) },
    (block.innerBlocks ?? []).map(cloneBlockTree)
  );
}

export const PAGE_TEMPLATE_SLOT = PAGE_TEMPLATE_SLOT_CLASS;

export function cloneBlocks_(blocks = []) { return cloneBlocks(blocks); }
export function composeTemplateEditorBlocks_(t, p) { return composeTemplateEditorBlocks(t, p); }
export function splitTemplateEditorBlocks_(b) { return splitTemplateEditorBlocks(b); }

function cloneBlocks(blocks = []) {
  return (blocks ?? []).map(cloneBlockTree);
}

function createPageTemplateSlot(pageBlocks = []) {
  return createBlock(
    'core/group',
    {
      className: PAGE_TEMPLATE_SLOT_CLASS,
      lock: {
        move: true,
        remove: true,
      },
      metadata: {
        name: 'Page content',
      },
    },
    cloneBlocks(pageBlocks)
  );
}

function isPageTemplateSlot(block) {
  const className = String(block?.attributes?.className ?? '');
  return block?.name === 'core/group' && className.split(/\s+/).includes(PAGE_TEMPLATE_SLOT_CLASS);
}

function composeTemplateEditorBlocks(templateBlocks, pageBlocks) {
  let slotFound = false;

  function visit(block) {
    if (block?.name === 'core/post-content') {
      slotFound = true;
      return createPageTemplateSlot(pageBlocks);
    }

    return createBlock(
      block.name,
      { ...(block.attributes ?? {}) },
      (block.innerBlocks ?? []).map(visit)
    );
  }

  return {
    blocks: (templateBlocks ?? []).map(visit),
    slotFound,
  };
}

function splitTemplateEditorBlocks(editorBlocks) {
  let extractedPageBlocks = [];

  function visit(block) {
    if (isPageTemplateSlot(block)) {
      extractedPageBlocks = cloneBlocks(block.innerBlocks ?? []);
      return createBlock('core/post-content');
    }

    return createBlock(
      block.name,
      { ...(block.attributes ?? {}) },
      (block.innerBlocks ?? []).map(visit)
    );
  }

  return {
    templateBlocks: (editorBlocks ?? []).map(visit),
    pageContentBlocks: extractedPageBlocks,
  };
}

function resolvePageTemplateSlug(page, bootstrap) {
  const routeManifest = getRouteManifestForPage(bootstrap, page);
  if (routeManifest?.editor?.template) {
    return routeManifest.editor.template;
  }

  if (page?.template && !['default', ''].includes(page.template)) {
    return page.template;
  }

  // Fallback: every page renders *some* template in WP's hierarchy. When a
  // page isn't route-bound (Sample Page, draft, orphan), the editor would
  // otherwise show an empty canvas. Default to the generic 'page' template
  // so at least chrome (header/footer/post-content slot) renders.
  return 'page';
}

/**
 * Resolve the expanded template markup for this page, trying every
 * available source before falling back to empty.
 *
 *   1. The page's route manifest entry (compiler-built, expanded).
 *   2. A route whose template matches the resolved template slug.
 *   3. The postTypes.page shell from editorTemplates (default page chrome).
 */
function resolvePreviewMarkup(page, bootstrap, templateSlug, routeManifest) {
  const direct = String(routeManifest?.editor?.previewMarkup || '');
  if (direct) return direct;

  const editorTemplates = bootstrap?.editorTemplates || {};
  const routes = editorTemplates.routes || {};
  if (templateSlug) {
    for (const key of Object.keys(routes)) {
      if (routes[key]?.template === templateSlug && routes[key]?.markup) {
        return String(routes[key].markup);
      }
    }
  }

  const postTypeShell = editorTemplates.postTypes?.page?.markup;
  if (postTypeShell) return String(postTypeShell);

  return '';
}

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

export function PageEditorPage({ bootstrap, recordsByModel, setBootstrap, pushNotice }) {
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
    commentStatus: bootstrap.site?.commentsEnabled ? 'open' : 'closed',
    content: '',
    date: '',
    featuredMedia: 0,
    parent: 0,
    template: '',
    menuOrder: 0,
    link: '',
    modified: '',
  }));
  const [blocks, setBlocks] = useState([]);
  const [templateRecord, setTemplateRecord] = useState(null);
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
            commentStatus: bootstrap.site?.commentsEnabled ? 'open' : 'closed',
            content: '',
            date: '',
            featuredMedia: 0,
            parent: 0,
            template: '',
            menuOrder: 0,
            link: '',
            modified: '',
          };
          setDraft(nextDraft);
          setBlocks([]);
          setTemplateRecord(null);
          return;
        }

        const page = await wpApiFetch(`wp/v2/pages/${pageId}?context=edit`);
        if (cancelled) return;
        const normalized = normalizePageRecord(page);
        const routeManifest = getRouteManifestForPage(bootstrap, normalized);
        const templateSlug = resolvePageTemplateSlug(normalized, bootstrap);
        const previewMarkup = resolvePreviewMarkup(normalized, bootstrap, templateSlug, routeManifest);

        setDraft(normalized);

        if (templateSlug) {
          const pageBlocks = blocksFromContent(normalized.content);
          let template = null;

          try {
            template = await wpApiFetch(`portfolio/v1/template/${encodeURIComponent(templateSlug)}`);
          } catch (error) {
            if (!previewMarkup) {
              throw error;
            }
          }

          if (cancelled) return;

          // Prefer the compiler's expanded previewMarkup (template-parts and
          // wp:pattern references already inlined) over the raw REST template
          // markup. The browser-side block parser can't resolve those
          // references, so using the unexpanded markup renders a blank canvas.
          const templateMarkup = String(previewMarkup || template?.content?.raw || '');
          const templateBlocks = blocksFromContent(templateMarkup);
          const composed = composeTemplateEditorBlocks(templateBlocks, pageBlocks);

          setTemplateRecord({
            id: String(template?.id ?? routeManifest?.editor?.templateEntityId ?? ''),
            slug: String(template?.slug ?? templateSlug),
            title:
              template?.title?.raw
              ?? template?.title?.rendered
              ?? routeManifest?.title
              ?? normalized.title
              ?? templateSlug,
            slotFound: composed.slotFound,
            source: template?.content?.raw ? 'template-rest' : 'route-manifest',
          });
          setBlocks(composed.blocks);
        } else {
          setTemplateRecord(null);
          setBlocks(blocksFromContent(normalized.content));
        }
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

  async function handleSave(overrides = {}) {
    setIsSaving(true);
    try {
      const endpoint = isNew ? 'wp/v2/pages' : `wp/v2/pages/${pageId}`;
      const nextDraft = { ...draft, ...overrides };
      const templateSplit = templateRecord
        ? splitTemplateEditorBlocks(blocks)
        : { templateBlocks: [], pageContentBlocks: blocks };
      const pageContentBlocks = templateRecord?.slotFound
        ? templateSplit.pageContentBlocks
        : blocksFromContent(nextDraft.content);

      const pageSavePromise = wpApiFetch(endpoint, {
        method: 'POST',
        body: {
          title: nextDraft.title,
          slug: nextDraft.slug,
          status: nextDraft.postStatus,
          comment_status: nextDraft.commentStatus === 'open' ? 'open' : 'closed',
          content: serialize(pageContentBlocks),
          date_gmt: nextDraft.date || null,
          featured_media: Number(nextDraft.featuredMedia || 0),
          parent: Number(nextDraft.parent || 0),
          template: nextDraft.template || '',
          menu_order: Number(nextDraft.menuOrder || 0),
        },
      });

      const templateSavePromise = templateRecord
        ? wpApiFetch(`portfolio/v1/template/${encodeURIComponent(templateRecord.slug)}`, {
          method: 'POST',
          body: {
            content: serialize(templateSplit.templateBlocks),
          },
        })
        : Promise.resolve(null);

      const [payload, savedTemplate] = await Promise.all([pageSavePromise, templateSavePromise]);

      const normalized = normalizePageRecord(payload);
      setDraft(normalized);
      if (typeof setBootstrap === 'function') {
        setBootstrap((current) => {
          const existingPages = Array.isArray(current?.pages) ? current.pages : [];
          const nextPages = [...existingPages];
          const existingIndex = nextPages.findIndex((item) => String(item.id) === String(normalized.id));

          if (existingIndex >= 0) {
            nextPages[existingIndex] = normalized;
          } else {
            nextPages.unshift(normalized);
          }

          return {
            ...current,
            pages: nextPages,
          };
        });
      }
      if (savedTemplate) {
        const composed = composeTemplateEditorBlocks(
          blocksFromContent(savedTemplate?.content?.raw ?? ''),
          blocksFromContent(normalized.content)
        );
        setTemplateRecord({
          id: savedTemplate.id,
          slug: savedTemplate.slug,
          title: savedTemplate.title?.raw ?? savedTemplate.title?.rendered ?? templateRecord?.title ?? 'Template',
          slotFound: composed.slotFound,
        });
        setBlocks(composed.blocks);
      } else {
        setBlocks(blocksFromContent(normalized.content));
      }
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

  async function handlePublish() {
    await handleSave({ postStatus: 'publish' });
  }

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(draft.link || window.location.href);
      pushNotice({ status: 'success', message: 'Page link copied.' });
    } catch {
      pushNotice({ status: 'error', message: 'Failed to copy page link.' });
    }
  }

  async function handleDelete() {
    if (isNew || !window.confirm(`Delete ${draft.title || 'this page'}?`)) return;
    setIsDeleting(true);
    try {
      await wpApiFetch(`wp/v2/pages/${pageId}?force=true`, { method: 'DELETE' });
      if (typeof setBootstrap === 'function') {
        setBootstrap((current) => ({
          ...current,
          pages: (current?.pages ?? []).filter((page) => String(page.id) !== String(pageId)),
        }));
      }
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

  const routeManifest = getRouteManifestForPage(bootstrap, draft);
  const route = routeManifest?.route ?? (bootstrap?.routes ?? []).find((item) => item?.id === draft.routeId);

  const workspaceSurface = useMemo(() => ({
    entityId: draft.id ? `page:${draft.id}` : 'page:new',
    entityLabel: 'Page',
    entityCollectionLabel: 'Pages',
    title: draft.title || 'Untitled Page',
    titlePlaceholder: 'Add page title',
    status: draft.postStatus || 'draft',
    saveLabel: 'Save',
    publishLabel: draft.postStatus === 'publish' ? 'Update' : 'Publish',
    canSave: !loading,
    canPublish: !loading,
    isSaving,
    setTitle: (value) => {
      setDraft((current) => ({ ...current, title: value }));
    },
    save: handleSave,
    publish: handlePublish,
    share: handleShare,
    moreActions: [
      draft.link ? {
        title: 'View on site',
        onClick: () => window.open(draft.link, '_blank', 'noopener,noreferrer'),
      } : null,
      !isNew ? {
        title: 'Open in wp-admin',
        onClick: () => window.open(`/wp-admin/post.php?post=${draft.id}&action=edit`, '_blank', 'noopener,noreferrer'),
      } : null,
      templateRecord ? {
        title: 'Edit template in wp-admin',
        onClick: () => window.open(`/wp-admin/site-editor.php?postType=wp_template&postId=${encodeURIComponent(templateRecord.id)}&canvas=edit`, '_blank', 'noopener,noreferrer'),
      } : null,
      !isNew ? {
        title: 'Delete Page',
        onClick: handleDelete,
      } : null,
    ].filter(Boolean),
  }), [
    draft.id,
    draft.link,
    draft.postStatus,
    draft.title,
    handleDelete,
    handlePublish,
    handleSave,
    handleShare,
    isNew,
    isSaving,
    loading,
    templateRecord,
  ]);

  const resolveInternalLink = useMemo(
    () => createInternalLinkResolver({ bootstrap, recordsByModel }),
    [bootstrap, recordsByModel]
  );

  useRegisterWorkspaceSurface(workspaceSurface);

  const assistantContext = useMemo(() => {
    const hasSource = Boolean(draft.sourcePath);
    const targetPath = hasSource
      ? draft.sourcePath
      : `content/pages/${draft.slug || (isNew ? '<new-slug>' : pageId)}.md`;
    let currentContent = '';
    try {
      currentContent = blocks?.length ? serialize(blocks) : (draft.content || '');
    } catch {
      currentContent = draft.content || '';
    }

    // Figure out what *actually* renders this page. The route's template
    // may render the page content, a chain of theme patterns, template
    // parts, or any combination. Without this, the agent edits
    // content/pages/<slug>.md even when the template never pulls post
    // content in (as in elsewhere's front-page → hero pattern).
    const templateSlug = routeManifest?.template
      || (draft.template && !['default', ''].includes(draft.template) ? draft.template : null)
      || 'page';
    const previewMarkup = resolvePreviewMarkup(draft, bootstrap, templateSlug, routeManifest);
    const renderAnalysis = previewMarkup
      ? analyzeTemplateMarkup(previewMarkup, { templateSlug })
      : { rendersPostContent: true, renderSources: [], patternSlugs: [], templatePartSlugs: [] };

    const primaryTargets = renderAnalysis.rendersPostContent
      ? (hasSource ? [draft.sourcePath] : [targetPath])
      : renderAnalysis.renderSources;

    let notes;
    if (renderAnalysis.rendersPostContent) {
      notes = hasSource
        ? `Authoritative source for this page is ${draft.sourcePath}. Read and edit that file directly. The wplite://current-page-content resource holds a live snapshot of the rendered markup.`
        : `This page has no source file yet. The wplite://current-page-content resource contains the FULL current rendered block markup. To modify it, CREATE ${targetPath} with that content plus the requested change.`;
    } else {
      const sourcesList = renderAnalysis.renderSources.map((p) => `  - ${p}`).join('\n');
      notes =
        `IMPORTANT: The template for this page (${templateSlug || 'unknown'}.html) does NOT render post-content. Editing content/pages/<slug>.md will have NO visible effect. The visible content is rendered from these files:\n${sourcesList}\n\nRead the relevant file(s) above and edit them directly. Do not edit ${targetPath}.`;
    }

    return {
      view: 'page-editor',
      currentContent,
      entity: {
        kind: 'page',
        id: isNew ? 'new' : pageId,
        label: draft.title || 'Untitled page',
        slug: draft.slug || undefined,
        template: templateSlug || undefined,
        rendersPostContent: renderAnalysis.rendersPostContent,
        renderSources: renderAnalysis.renderSources.length ? renderAnalysis.renderSources : undefined,
        sourceFile: renderAnalysis.rendersPostContent && hasSource ? draft.sourcePath : null,
        possibleSourcePaths: primaryTargets,
        notes,
      },
    };
  }, [blocks, draft.content, draft.slug, draft.sourcePath, draft.template, draft.title, isNew, pageId, routeManifest]);
  useRegisterAssistantContext(assistantContext);

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

  const recordContext = !isNew ? {
    postId: draft.id,
    postType: 'page',
    title: draft.title,
    date: draft.date,
    link: draft.link,
    featuredMedia: draft.featuredMedia,
    setField: (field, value) => {
      setDraft((current) => ({ ...current, [field]: value }));
    },
  } : null;

  return (
    <NativeBlockEditorFrame
      label="Pages"
      title={draft.title}
      titlePlaceholder="Add page title"
      onChangeTitle={(value) => {
        setDraft((current) => ({ ...current, title: value }));
      }}
      showTitleInput={false}
      showBackButton={false}
      showPrimaryAction={false}
      showMoreActions={false}
      blocks={blocks}
      onChangeBlocks={handleBlocksChange}
      backLabel="Back to Pages"
      onBack={() => navigate('/pages')}
      primaryActionLabel="Save Page"
      onPrimaryAction={handleSave}
      isPrimaryBusy={isSaving}
      viewUrl={draft.link}
      documentLabel="Page"
      canvasLayout={Boolean(templateRecord || routeManifest) ? 'template' : 'content'}
      recordContext={recordContext}
      resolveInternalLink={resolveInternalLink}
      onOpenInternalLink={(path) => navigate(path)}
      wpAdminTemplateUrl={templateRecord ? `/wp-admin/site-editor.php?postType=wp_template&postId=${encodeURIComponent(templateRecord.id)}&canvas=edit` : undefined}
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

            <SelectControl
              label="Comments"
              value={draft.commentStatus ?? 'closed'}
              options={[
                { value: 'closed', label: 'Disabled' },
                { value: 'open', label: 'Enabled' },
              ]}
              onChange={(value) => setDraft((current) => ({ ...current, commentStatus: value }))}
              help="New pages inherit the Site setting. This page can override it."
              __next40pxDefaultSize
            />
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
              {templateRecord ? (
                <p className="field-hint">
                  This route is using the shared route manifest for <strong>{templateRecord.title}</strong>, so the editor canvas follows the same template shell the router uses on the frontend.
                </p>
              ) : null}
              {route?.postsPage ? (
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
