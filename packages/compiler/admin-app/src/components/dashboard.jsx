import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Popover } from '@wordpress/components';
import ServerSideRender from '@wordpress/server-side-render';
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
import { hydrateInteractivity } from '../lib/interactivity.js';

/* ── Sortable widget shell (drag handle + hide affordance) ── */
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

/* ── Error boundary — one bad widget shouldn't blank the dashboard ── */
class WidgetErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('[dashboard widget]', this.props.label, error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <section className="dash-card">
          <header className="dash-card__header">
            <div className="dash-card__titles">
              <span className="dash-card__eyebrow">Widget</span>
              <h2 className="dash-card__title">{this.props.label || 'Widget'}</h2>
            </div>
          </header>
          <div className="dash-card__body">
            <p className="dash-empty__text">This widget crashed while rendering. Check the widget source.</p>
            <code style={{ fontSize: 11, color: 'var(--wp-admin-text-muted)', wordBreak: 'break-word' }}>
              {String(this.state.error?.message || this.state.error)}
            </code>
          </div>
        </section>
      );
    }
    return this.props.children;
  }
}

/* ── Block widget renderer: ServerSideRender + Interactivity hydration ── */
function BlockWidget({ widget }) {
  const hostRef = useRef(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const observer = new MutationObserver(() => hydrateInteractivity(hostRef.current));
    observer.observe(hostRef.current, { childList: true, subtree: true });
    hydrateInteractivity(hostRef.current);
    return () => observer.disconnect();
  }, [widget.blockName]);

  return (
    <section className="dash-card">
      <div ref={hostRef} className="block-widget-host">
        <ServerSideRender
          block={widget.blockName}
          attributes={{}}
          EmptyResponsePlaceholder={() => (
            <p className="dash-empty__text">Widget returned no content.</p>
          )}
          LoadingResponsePlaceholder={() => (
            <p className="dash-empty__text">Loading…</p>
          )}
          ErrorResponsePlaceholder={({ response }) => (
            <p className="dash-empty__text">{response?.errorMsg || 'Failed to render widget.'}</p>
          )}
        />
      </div>
    </section>
  );
}

/* ── Dashboard settings popover (toggle visibility, reset layout) ── */
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

/* ── Dashboard Page — pure host for block widgets registered in bootstrap ── */
const DASH_STORAGE_KEY = 'portfolio-light-dash-widgets-v5';
const DASHBOARD_WIDGET_PRIORITY = {
  'kanso-welcome': 0,
  'kanso-traffic-overview': 10,
  'kanso-key-metrics': 20,
  'kanso-site-pulse': 30,
  'kanso-top-content': 40,
  'kanso-top-referrers': 50,
  'kanso-recent-activity': 60,
};

function sortDashboardWidgets(widgets) {
  return [...widgets].sort((left, right) => {
    const leftPriority = DASHBOARD_WIDGET_PRIORITY[left.id] ?? 500;
    const rightPriority = DASHBOARD_WIDGET_PRIORITY[right.id] ?? 500;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return String(left.label ?? left.id).localeCompare(String(right.label ?? right.id));
  });
}

export function DashboardPage({ bootstrap, onWidgetConfig }) {
  const defaultWidgets = useMemo(() => {
    return sortDashboardWidgets((bootstrap.dashboardWidgets ?? []).map((widget) => ({
      id: widget.id,
      type: 'block-widget',
      blockName: widget.name,
      label: widget.title,
      icon: widget.icon,
      description: widget.description,
      visible: true,
      span: widget.span === 'full' ? 'full' : 'half',
    })));
  }, [bootstrap.dashboardWidgets]);

  const [widgetState, setWidgetState] = useState(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(DASH_STORAGE_KEY));
      if (Array.isArray(saved) && saved.length > 0) {
        const savedIds = new Set(saved.map((w) => w.id));
        const merged = [...saved];
        for (const def of defaultWidgets) {
          if (!savedIds.has(def.id)) merged.push(def);
        }
        const liveIds = new Set(defaultWidgets.map((d) => d.id));
        return merged.filter((w) => liveIds.has(w.id));
      }
    } catch {}
    return defaultWidgets;
  });

  function persistWidgets(next) {
    setWidgetState(next);
    try {
      window.localStorage.setItem(DASH_STORAGE_KEY, JSON.stringify(
        next.map(({ id, type, blockName, label, visible, span }) => ({ id, type, blockName, label, visible, span }))
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

  if (widgetState.length === 0) {
    return (
      <div className="screen">
        <section className="dash-card">
          <div className="dash-card__body">
            <p className="dash-empty__text">
              No dashboard widgets registered. Add a block with <code>"category": "dashboard"</code> in its <code>block.json</code> to populate the dashboard.
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="screen">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={widgetState.map((w) => w.id)} strategy={rectSortingStrategy}>
          <div className="dash-canvas">
            {widgetState.map((widget) => (
              <SortableWidget key={widget.id} id={widget.id} label={widget.label} visible={widget.visible} span={widget.span} onToggleVisibility={toggleVisibility}>
                <WidgetErrorBoundary label={widget.label}>
                  <BlockWidget widget={widget} />
                </WidgetErrorBoundary>
              </SortableWidget>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
