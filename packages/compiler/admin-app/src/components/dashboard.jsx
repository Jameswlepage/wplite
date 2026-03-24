import React, { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Popover,
} from '@wordpress/components';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CarbonIcon, DragVertical, ViewOff, View } from '../lib/icons.jsx';
import {
  deriveDashboard,
  collectionPathForModel,
  editorRouteForModel,
  formatDate,
  formatRelativeTime,
  formatRouteLabel,
  toTitleCase,
} from '../lib/helpers.js';

/* ── Sortable Widget Wrapper ── */
function SortableWidget({ id, label, visible, span, onToggleVisibility, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  if (!visible) {
    return (
      <div ref={setNodeRef} style={style} className="dash-widget dash-widget--hidden" data-span={span || 'half'}>
        <button className="dash-widget__restore" onClick={() => onToggleVisibility(id)} type="button">
          <View size={14} />
          <span>{label}</span>
        </button>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} className={`dash-widget${isDragging ? ' is-dragging' : ''}`} data-span={span || 'half'}>
      <div className="dash-widget__chrome">
        <button className="dash-widget__handle" {...attributes} {...listeners} type="button" title="Drag to reorder">
          <DragVertical size={14} />
        </button>
        <button className="dash-widget__hide" onClick={() => onToggleVisibility(id)} type="button" title="Hide widget">
          <ViewOff size={14} />
        </button>
      </div>
      {children}
    </div>
  );
}

/* ── Counter Card Widget ── */
function WidgetCounterCards({ dashboard, bootstrap, navigate }) {
  const cards = [
    { label: 'Total Content', value: dashboard.totalRecords, color: '#3858e9', path: null },
    { label: 'Posts', value: dashboard.totalPosts, color: '#24a148', path: '/posts' },
    { label: 'Featured', value: dashboard.featuredProjects, color: '#8a3ffc', path: '/projects' },
    { label: 'Profile', value: `${dashboard.profileCompleteness}%`, color: '#ee5396', path: '/settings/profile' },
  ];
  return (
    <div className="counter-cards">
      {cards.map((c) => (
        <button
          key={c.label}
          className="counter-card"
          style={{ '--counter-accent': c.color }}
          onClick={c.path ? () => navigate(c.path) : undefined}
          type="button"
        >
          <span className="counter-card__label">{c.label}</span>
          <strong className="counter-card__value">{c.value}</strong>
        </button>
      ))}
    </div>
  );
}

/* ── Welcome Widget ── */
function WidgetWelcome({ bootstrap, handleShare }) {
  return (
    <div className="welcome-card">
      <div className="welcome-card__text">
        <h2>Welcome to {bootstrap.site.title}</h2>
        <p>{bootstrap.site.tagline}</p>
      </div>
      <div className="welcome-card__actions">
        <Button variant="primary" href="/" target="_blank">View Site</Button>
        <Button variant="secondary" onClick={handleShare}>Copy Link</Button>
      </div>
    </div>
  );
}

/* ── Content Breakdown Widget ── */
function WidgetContentBreakdown({ dashboard }) {
  const total = dashboard.collectionBreakdown.reduce((s, c) => s + c.count, 0);
  if (total === 0) {
    return (
      <Card className="surface-card">
        <CardHeader><h2>Content Distribution</h2></CardHeader>
        <CardBody><p className="field-hint">No content yet.</p></CardBody>
      </Card>
    );
  }
  return (
    <Card className="surface-card">
      <CardHeader><h2>Content Distribution</h2></CardHeader>
      <CardBody>
        <div className="content-bar">
          {dashboard.collectionBreakdown.map((c) => (
            <div key={c.id} className="content-bar__segment" style={{ flexGrow: c.count || 0.1, background: `hsl(${c.hue}, 55%, 55%)` }} title={`${c.label}: ${c.count}`} />
          ))}
        </div>
        <div className="content-bar__legend">
          {dashboard.collectionBreakdown.map((c) => (
            <span className="content-bar__legend-item" key={c.id}>
              <span className="content-bar__legend-dot" style={{ background: `hsl(${c.hue}, 55%, 55%)` }} />
              {c.label} <strong>{c.count}</strong>
            </span>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

/* ── Activity Feed Widget ── */
function WidgetActivityFeed({ dashboard }) {
  if (!dashboard.recentActivity || dashboard.recentActivity.length === 0) {
    return (
      <Card className="surface-card">
        <CardHeader><h2>Recent Activity</h2></CardHeader>
        <CardBody><p className="field-hint">No activity yet.</p></CardBody>
      </Card>
    );
  }
  return (
    <Card className="surface-card">
      <CardHeader><h2>Recent Activity</h2></CardHeader>
      <CardBody>
        <div className="activity-feed">
          {dashboard.recentActivity.map((item) => (
            <div className="activity-feed__item" key={item.id}>
              <span className="activity-feed__dot" style={{ background: `hsl(${(item.modelId.charCodeAt(0) * 47) % 360}, 55%, 55%)` }} />
              <div className="activity-feed__body">
                <span className="activity-feed__title">{item.title}</span>
                <span className="activity-feed__meta">
                  <span className="activity-feed__badge">{item.modelLabel}</span>
                  {item.modified && <span className="activity-feed__time">{formatRelativeTime(item.modified)}</span>}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

/* ── Collection Table Widget ── */
function WidgetCollectionTable({ model, schema, records }) {
  const navigate = useNavigate();
  const columns = (schema?.view?.columns ?? ['title', 'modified']).slice(0, 4);
  const sorted = [...records].sort((a, b) => (b.modified ?? '').localeCompare(a.modified ?? '')).slice(0, 5);
  return (
    <Card className="surface-card">
      <CardHeader>
        <h2>{model.label} <span className="dash-count">({records.length})</span></h2>
      </CardHeader>
      <CardBody>
        {sorted.length === 0 ? (
          <div className="dash-empty">
            <p>No {model.label.toLowerCase()} yet.</p>
            <Button variant="primary" size="compact" onClick={() => navigate(editorRouteForModel(model))}>
              Create {model.singularLabel || model.label}
            </Button>
          </div>
        ) : (
          <Fragment>
            <table className="core-list-table">
              <thead><tr>{columns.map((col) => <th key={col}>{toTitleCase(col)}</th>)}</tr></thead>
              <tbody>
                {sorted.map((record) => (
                  <tr key={record.id} style={{ cursor: 'pointer' }} onClick={() => navigate(editorRouteForModel(model, record.id))}>
                    {columns.map((col) => (
                      <td key={col}>
                        {col === 'modified' ? formatDate(record[col]) :
                         typeof record[col] === 'boolean' ? (record[col] ? 'Yes' : 'No') :
                         Array.isArray(record[col]) ? record[col].join(', ') :
                         String(record[col] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="dash-view-all">
              <Button variant="tertiary" size="compact" onClick={() => navigate(collectionPathForModel(model))}>
                View all {model.label.toLowerCase()}
              </Button>
            </div>
          </Fragment>
        )}
      </CardBody>
    </Card>
  );
}

/* ── Recent Inquiries Widget ── */
function WidgetRecentInquiries({ items }) {
  return (
    <Card className="surface-card">
      <CardHeader><h2>Recent Inquiries</h2></CardHeader>
      <CardBody>
        {items.length === 0 ? (
          <p className="field-hint">No inquiries yet.</p>
        ) : (
          <div className="activity-feed">
            {items.map((item) => (
              <div className="activity-feed__item" key={item.id}>
                <span className="activity-feed__dot" style={{ background: item.status === 'replied' ? '#24a148' : item.status === 'read' ? '#f5a623' : '#949494' }} />
                <div className="activity-feed__body">
                  <span className="activity-feed__title">{item.title}</span>
                  <span className="activity-feed__meta">
                    {item.email && <span>{item.email}</span>}
                    {item.status && <span className="activity-feed__badge">{item.status}</span>}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/* ── Site Structure Widget ── */
function WidgetSiteStructure({ routes }) {
  return (
    <Card className="surface-card">
      <CardHeader><h2>Site Structure</h2></CardHeader>
      <CardBody>
        <table className="core-list-table">
          <thead><tr><th>Page</th><th>Path</th><th>Template</th></tr></thead>
          <tbody>
            {routes.map((route) => (
              <tr key={route.id}>
                <td><strong>{route.title}</strong></td>
                <td>{formatRouteLabel(route)}</td>
                <td style={{ color: 'var(--wp-admin-text-muted)' }}>{route.template}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}

/* ── Dashboard Settings Popover ── */
export function DashboardSettingsButton({ widgets, onToggle, onReset }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button className="dash-settings-btn" onClick={() => setOpen(!open)} type="button" title="Dashboard settings">
        <CarbonIcon name="Settings" size={20} />
      </button>
      {open && (
        <Popover placement="bottom-end" onClose={() => setOpen(false)} shift>
          <div className="dash-settings-popover">
            <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: '13px' }}>Widgets</p>
            {widgets.map((w) => (
              <label className="dash-settings-popover__item" key={w.id}>
                <input type="checkbox" checked={w.visible} onChange={() => onToggle(w.id)} />
                <span>{w.label}</span>
              </label>
            ))}
            <div className="dash-settings__reset">
              <Button variant="tertiary" size="compact" onClick={onReset}>Reset layout</Button>
            </div>
          </div>
        </Popover>
      )}
    </div>
  );
}

/* ── Dashboard Page ── */
const DASH_STORAGE_KEY = 'portfolio-light-dash-widgets-v2';

export function DashboardPage({ bootstrap, recordsByModel, singletonData, pushNotice, onWidgetConfig }) {
  const navigate = useNavigate();
  const dashboard = useMemo(
    () => deriveDashboard({ recordsByModel, singletonData, bootstrap }),
    [recordsByModel, singletonData, bootstrap]
  );

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      pushNotice({ status: 'success', message: 'Site link copied.' });
    } catch {
      pushNotice({ status: 'warning', message: 'Copy failed.' });
    }
  }

  const defaultWidgets = useMemo(() => {
    const list = [
      { id: 'welcome', type: 'welcome', label: 'Welcome', visible: true, span: 'full' },
      { id: 'counters', type: 'counters', label: 'Counter Cards', visible: true, span: 'full' },
      { id: 'activity-feed', type: 'activity-feed', label: 'Recent Activity', visible: true, span: 'half' },
      { id: 'content-breakdown', type: 'content-breakdown', label: 'Content Distribution', visible: true, span: 'half' },
    ];
    for (const model of bootstrap.models) {
      if (model.type !== 'collection') continue;
      list.push({ id: `collection-${model.id}`, type: 'collection-table', modelId: model.id, label: model.label, visible: true, span: 'half' });
    }
    if (bootstrap.models.some((m) => m.id === 'inquiry')) {
      list.push({ id: 'recent-inquiries', type: 'recent-inquiries', label: 'Recent Inquiries', visible: true, span: 'half' });
    }
    list.push({ id: 'site-structure', type: 'site-structure', label: 'Site Structure', visible: true, span: 'half' });
    return list;
  }, [bootstrap.models]);

  const [widgetState, setWidgetState] = useState(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(DASH_STORAGE_KEY));
      if (Array.isArray(saved) && saved.length > 0) {
        const savedIds = new Set(saved.map((w) => w.id));
        const merged = [...saved];
        for (const def of defaultWidgets) {
          if (!savedIds.has(def.id)) merged.push(def);
        }
        return merged;
      }
    } catch {}
    return defaultWidgets;
  });

  function persistWidgets(next) {
    setWidgetState(next);
    try {
      window.localStorage.setItem(DASH_STORAGE_KEY, JSON.stringify(
        next.map(({ id, type, modelId, label, visible, span }) => ({ id, type, modelId, label, visible, span }))
      ));
    } catch {}
  }

  function toggleVisibility(widgetId) {
    persistWidgets(widgetState.map((w) => w.id === widgetId ? { ...w, visible: !w.visible } : w));
  }

  function resetWidgets() {
    persistWidgets(defaultWidgets);
    try { window.localStorage.removeItem(DASH_STORAGE_KEY); } catch {}
  }

  useEffect(() => {
    if (onWidgetConfig) onWidgetConfig({ widgets: widgetState, toggle: toggleVisibility, reset: resetWidgets });
  }, [widgetState]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = widgetState.findIndex((w) => w.id === active.id);
    const newIndex = widgetState.findIndex((w) => w.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    persistWidgets(arrayMove(widgetState, oldIndex, newIndex));
  }

  function renderWidgetContent(widget) {
    switch (widget.type) {
      case 'welcome':
        return <WidgetWelcome bootstrap={bootstrap} handleShare={handleShare} />;
      case 'counters':
        return <WidgetCounterCards dashboard={dashboard} bootstrap={bootstrap} navigate={navigate} />;
      case 'content-breakdown':
        return <WidgetContentBreakdown dashboard={dashboard} />;
      case 'activity-feed':
        return <WidgetActivityFeed dashboard={dashboard} />;
      case 'collection-table': {
        const model = bootstrap.models.find((m) => m.id === widget.modelId);
        if (!model) return null;
        const schema = bootstrap.adminSchema.views?.[model.id];
        return <WidgetCollectionTable model={model} schema={schema} records={recordsByModel[model.id] ?? []} />;
      }
      case 'recent-inquiries':
        return <WidgetRecentInquiries items={(dashboard.recentInquiries ?? []).slice(0, 5)} />;
      case 'site-structure':
        return <WidgetSiteStructure routes={bootstrap.routes} />;
      default:
        return null;
    }
  }

  return (
    <div className="screen">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={widgetState.map((w) => w.id)} strategy={rectSortingStrategy}>
          <div className="dash-canvas">
            {widgetState.map((widget) => (
              <SortableWidget key={widget.id} id={widget.id} label={widget.label} visible={widget.visible} span={widget.span} onToggleVisibility={toggleVisibility}>
                {renderWidgetContent(widget)}
              </SortableWidget>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
