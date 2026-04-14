import React, { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Popover } from '@wordpress/components';
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
import {
  CarbonIcon,
  DragVertical,
  ViewOff,
  View,
  ArrowUpRight,
  ArrowDownRight,
  Add,
  Edit as EditIcon,
} from '../lib/icons.jsx';
import {
  deriveDashboard,
  collectionPathForModel,
  editorRouteForModel,
  formatDate,
  formatRelativeTime,
  formatRouteLabel,
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

/* ── Small utilities ── */
function Sparkline({ values, color = 'currentColor', height = 28, width = 80 }) {
  if (!values || values.length === 0) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const linePath = `M ${points.join(' L ')}`;
  const areaPath = `M 0,${height} L ${points.join(' L ')} L ${width},${height} Z`;
  return (
    <svg className="sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <path d={areaPath} fill={color} opacity="0.12" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function TrendBadge({ value }) {
  if (value === 0 || value == null) return <span className="trend trend--flat">—</span>;
  const positive = value > 0;
  return (
    <span className={`trend ${positive ? 'trend--up' : 'trend--down'}`}>
      {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {Math.abs(value)}%
    </span>
  );
}

function formatCompact(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

/* ── Section header shared across widgets ── */
function WidgetShell({ title, eyebrow, action, children, className = '' }) {
  return (
    <section className={`dash-card ${className}`}>
      <header className="dash-card__header">
        <div className="dash-card__titles">
          {eyebrow && <span className="dash-card__eyebrow">{eyebrow}</span>}
          <h2 className="dash-card__title">{title}</h2>
        </div>
        {action && <div className="dash-card__action">{action}</div>}
      </header>
      <div className="dash-card__body">{children}</div>
    </section>
  );
}

/* ── Welcome Widget ── */
function WidgetWelcome({ bootstrap, handleShare }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return (
    <div className="welcome-hero">
      <div className="welcome-hero__text">
        <span className="welcome-hero__eyebrow">{greeting}</span>
        <h1 className="welcome-hero__title">{bootstrap.site.title}</h1>
        {bootstrap.site.tagline && <p className="welcome-hero__tagline">{bootstrap.site.tagline}</p>}
      </div>
      <div className="welcome-hero__actions">
        <Button variant="primary" href="/" target="_blank">View site</Button>
        <Button variant="secondary" onClick={handleShare}>Copy link</Button>
      </div>
    </div>
  );
}

/* ── Stat Cards (enhanced counters) ── */
function WidgetStatCards({ dashboard, navigate }) {
  const { analytics } = dashboard;
  const cards = [
    {
      label: 'Visitors',
      value: formatCompact(analytics.visitors),
      trend: analytics.visitorsTrend,
      color: '#3858e9',
      series: analytics.visitorsSeries,
      sub: 'last 30 days',
    },
    {
      label: 'Sessions',
      value: formatCompact(analytics.sessions),
      trend: analytics.sessionsTrend,
      color: '#00a3a1',
      series: analytics.sessionsSeries,
      sub: 'last 30 days',
    },
    {
      label: 'Total content',
      value: dashboard.totalRecords,
      color: '#8a3ffc',
      sub: `${dashboard.totalCollections} collections`,
      path: null,
    },
    {
      label: 'Profile',
      value: `${dashboard.profileCompleteness}%`,
      color: '#ee5396',
      sub: 'completeness',
      path: '/settings/profile',
    },
  ];
  return (
    <div className="stat-cards">
      {cards.map((c) => (
        <button
          key={c.label}
          className="stat-card"
          style={{ '--stat-accent': c.color }}
          onClick={c.path ? () => navigate(c.path) : undefined}
          type="button"
        >
          <div className="stat-card__head">
            <span className="stat-card__label">{c.label}</span>
            {c.trend != null && <TrendBadge value={c.trend} />}
          </div>
          <div className="stat-card__value">{c.value}</div>
          <div className="stat-card__foot">
            <span className="stat-card__sub">{c.sub}</span>
            {c.series && (
              <div className="stat-card__spark" style={{ color: c.color }}>
                <Sparkline values={c.series} height={24} width={70} />
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

/* ── Traffic Chart Widget ── */
function TrafficChart({ series, color, label }) {
  const svgRef = useRef(null);
  const [hoverIdx, setHoverIdx] = useState(null);
  const [size, setSize] = useState({ w: 800, h: 220 });

  useEffect(() => {
    if (!svgRef.current) return;
    const el = svgRef.current;
    const observer = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setSize({ w: rect.width, h: rect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { w: width, h: height } = size;
  const padding = { top: 16, right: 16, bottom: 24, left: 36 };
  const innerW = Math.max(1, width - padding.left - padding.right);
  const innerH = Math.max(1, height - padding.top - padding.bottom);
  const max = Math.max(...series);
  const min = Math.min(...series);
  const niceMax = Math.ceil(max * 1.1);
  const niceMin = Math.max(0, Math.floor(min * 0.8));
  const range = niceMax - niceMin || 1;
  const step = innerW / (series.length - 1);

  const points = series.map((v, i) => {
    const x = padding.left + i * step;
    const y = padding.top + innerH - ((v - niceMin) / range) * innerH;
    return [x, y];
  });

  const linePath = 'M ' + points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ');
  const areaPath = `M ${padding.left},${padding.top + innerH} L ` +
    points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ') +
    ` L ${padding.left + innerW},${padding.top + innerH} Z`;

  const yTicks = 4;
  const today = new Date();

  function pointDate(i) {
    const d = new Date(today);
    d.setDate(d.getDate() - (series.length - 1 - i));
    return d;
  }

  const xLabelIndexes = [0, Math.floor(series.length / 3), Math.floor((series.length * 2) / 3), series.length - 1];

  function handleMouseMove(event) {
    const rect = svgRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const idx = Math.round((x - padding.left) / step);
    if (idx >= 0 && idx < series.length) setHoverIdx(idx);
    else setHoverIdx(null);
  }

  const hoverPoint = hoverIdx != null ? points[hoverIdx] : null;
  const hoverValue = hoverIdx != null ? series[hoverIdx] : null;
  const hoverDate = hoverIdx != null ? pointDate(hoverIdx) : null;

  return (
    <div className="traffic-chart-wrap">
      <svg
        ref={svgRef}
        className="traffic-chart"
        width="100%"
        height="220"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="traffic-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const y = padding.top + (innerH / yTicks) * i;
          const val = Math.round(niceMax - (range / yTicks) * i);
          return (
            <g key={i}>
              <line
                x1={padding.left}
                x2={padding.left + innerW}
                y1={y}
                y2={y}
                stroke="var(--wp-admin-border)"
                strokeDasharray={i === yTicks ? '' : '2,4'}
                strokeWidth="1"
              />
              <text x={padding.left - 8} y={y + 3} fontSize="10" fill="var(--wp-admin-text-muted)" textAnchor="end">
                {formatCompact(val)}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill="url(#traffic-grad)" />
        <path d={linePath} fill="none" stroke={color} strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" />

        {xLabelIndexes.map((i) => (
          <text
            key={i}
            x={padding.left + i * step}
            y={height - 6}
            fontSize="10"
            fill="var(--wp-admin-text-muted)"
            textAnchor={i === 0 ? 'start' : i === series.length - 1 ? 'end' : 'middle'}
          >
            {pointDate(i).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </text>
        ))}

        {hoverPoint && (
          <g className="traffic-chart__hover" pointerEvents="none">
            <line
              x1={hoverPoint[0]}
              x2={hoverPoint[0]}
              y1={padding.top}
              y2={padding.top + innerH}
              stroke="var(--wp-admin-text-muted)"
              strokeWidth="1"
              strokeDasharray="3,3"
              opacity="0.5"
            />
            <circle cx={hoverPoint[0]} cy={hoverPoint[1]} r="3.5" fill="var(--wp-admin-canvas-bg)" stroke={color} strokeWidth="1.5" />
          </g>
        )}
      </svg>
      {hoverPoint && hoverDate && (
        <div
          className="traffic-chart__tooltip"
          style={{
            left: `${(hoverPoint[0] / width) * 100}%`,
            top: `${(hoverPoint[1] / height) * 100}%`,
          }}
        >
          <div className="traffic-chart__tooltip-date">{hoverDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
          <div className="traffic-chart__tooltip-value">
            <span className="traffic-chart__tooltip-dot" style={{ background: color }} />
            <strong>{hoverValue.toLocaleString()}</strong>
            <span className="traffic-chart__tooltip-label">{label}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function WidgetTraffic({ dashboard }) {
  const { analytics } = dashboard;
  const [metric, setMetric] = useState('visitors');
  const series = metric === 'visitors' ? analytics.visitorsSeries : analytics.sessionsSeries;
  const total = metric === 'visitors' ? analytics.visitors : analytics.sessions;
  const trend = metric === 'visitors' ? analytics.visitorsTrend : analytics.sessionsTrend;
  const color = metric === 'visitors' ? '#3858e9' : '#00a3a1';

  return (
    <WidgetShell
      eyebrow="Analytics"
      title="Traffic overview"
      action={
        <div className="metric-toggle" role="tablist">
          {['visitors', 'sessions'].map((m) => (
            <button
              key={m}
              role="tab"
              type="button"
              className={`metric-toggle__btn${metric === m ? ' is-active' : ''}`}
              onClick={() => setMetric(m)}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      }
    >
      <div className="traffic-summary">
        <div className="traffic-summary__primary">
          <strong className="traffic-summary__value">{formatCompact(total)}</strong>
          <TrendBadge value={trend} />
        </div>
        <div className="traffic-summary__secondary">
          <div>
            <span className="traffic-summary__label">Avg. session</span>
            <strong>{formatDuration(analytics.avgSessionSec)}</strong>
          </div>
          <div>
            <span className="traffic-summary__label">Bounce rate</span>
            <strong>{analytics.bounceRate}%</strong>
          </div>
        </div>
      </div>
      <TrafficChart series={series} color={color} label={metric} />
      <p className="traffic-note">Preview analytics · connect a provider to replace with live data.</p>
    </WidgetShell>
  );
}

/* ── Top Content Widget ── */
function WidgetTopContent({ dashboard, bootstrap, navigate }) {
  const { topContent } = dashboard.analytics;
  if (!topContent.length) {
    return (
      <WidgetShell title="Top content">
        <p className="dash-empty__text">Publish a few records to see what's performing.</p>
      </WidgetShell>
    );
  }
  const max = Math.max(...topContent.map((t) => t.views));
  return (
    <WidgetShell eyebrow="Last 30 days" title="Top content">
      <ol className="leaderboard">
        {topContent.map((item, idx) => {
          const model = bootstrap.models.find((m) => m.id === item.modelId);
          return (
            <li
              key={item.id}
              className="leaderboard__row"
              onClick={model ? () => navigate(editorRouteForModel(model, item.recordId)) : undefined}
              style={{ cursor: model ? 'pointer' : 'default' }}
            >
              <span className="leaderboard__rank">{idx + 1}</span>
              <div className="leaderboard__body">
                <span className="leaderboard__title">{item.title}</span>
                <span className="leaderboard__meta">{item.modelLabel}</span>
              </div>
              <div className="leaderboard__bar-wrap" aria-hidden>
                <div className="leaderboard__bar" style={{ width: `${(item.views / max) * 100}%` }} />
              </div>
              <div className="leaderboard__numbers">
                <strong>{formatCompact(item.views)}</strong>
                <TrendBadge value={item.trend} />
              </div>
            </li>
          );
        })}
      </ol>
    </WidgetShell>
  );
}

/* ── Referrers Widget ── */
function WidgetReferrers({ dashboard }) {
  const { referrers } = dashboard.analytics;
  return (
    <WidgetShell eyebrow="Traffic sources" title="Top referrers">
      <ul className="referrers">
        {referrers.map((r) => (
          <li className="referrers__row" key={r.source}>
            <span className="referrers__name">{r.source}</span>
            <div className="referrers__bar-wrap" aria-hidden>
              <div className="referrers__bar" style={{ width: `${r.share}%` }} />
            </div>
            <span className="referrers__pct">{r.share}%</span>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}

/* ── Content Breakdown Widget ── */
function WidgetContentBreakdown({ dashboard }) {
  const total = dashboard.collectionBreakdown.reduce((s, c) => s + c.count, 0);
  if (total === 0) {
    return (
      <WidgetShell title="Content distribution">
        <p className="dash-empty__text">No content yet.</p>
      </WidgetShell>
    );
  }
  return (
    <WidgetShell title="Content distribution">
      <div className="content-bar">
        {dashboard.collectionBreakdown.map((c) => (
          <div
            key={c.id}
            className="content-bar__segment"
            style={{ flexGrow: c.count || 0.1, background: `hsl(${c.hue}, 55%, 55%)` }}
            title={`${c.label}: ${c.count}`}
          />
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
    </WidgetShell>
  );
}

/* ── Timeline Activity Widget ── */
function WidgetTimeline({ dashboard, bootstrap, navigate }) {
  if (!dashboard.recentActivity || dashboard.recentActivity.length === 0) {
    return (
      <WidgetShell title="Recent activity">
        <p className="dash-empty__text">No activity yet.</p>
      </WidgetShell>
    );
  }

  const groups = [];
  const byKey = new Map();
  for (const item of dashboard.recentActivity) {
    const key = item.modified ? new Date(item.modified).toDateString() : 'unknown';
    if (!byKey.has(key)) {
      const group = { key, label: formatGroupLabel(key), items: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    byKey.get(key).items.push(item);
  }

  return (
    <WidgetShell eyebrow="Timeline" title="Recent activity">
      <div className="timeline">
        {groups.map((group) => (
          <div className="timeline__group" key={group.key}>
            <div className="timeline__day">{group.label}</div>
            <ul className="timeline__list">
              {group.items.map((item) => {
                const model = bootstrap.models.find((m) => m.id === item.modelId);
                const hue = (item.modelId.charCodeAt(0) * 47) % 360;
                const IconCmp = item.action === 'Created' ? Add : EditIcon;
                const clickable = !!model;
                return (
                  <li
                    key={item.id}
                    className="timeline__item"
                    style={{ cursor: clickable ? 'pointer' : 'default' }}
                    onClick={clickable ? () => navigate(editorRouteForModel(model, item.recordId)) : undefined}
                  >
                    <span className="timeline__dot" style={{ '--dot-color': `hsl(${hue}, 60%, 50%)` }}>
                      <IconCmp size={10} />
                    </span>
                    <div className="timeline__body">
                      <div className="timeline__line">
                        <span className="timeline__action">{item.action}</span>
                        <span className="timeline__title">{item.title}</span>
                      </div>
                      <div className="timeline__meta">
                        <span className="timeline__tag">{item.modelLabel}</span>
                        {item.modified && <span>{formatRelativeTime(item.modified)}</span>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}

function formatGroupLabel(key) {
  if (key === 'unknown') return 'Earlier';
  const d = new Date(key);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/* ── Collection List Widget ── */
function WidgetCollectionList({ model, records }) {
  const navigate = useNavigate();
  const sorted = [...records].sort((a, b) => (b.modified ?? '').localeCompare(a.modified ?? '')).slice(0, 5);
  return (
    <WidgetShell
      eyebrow="Collection"
      title={model.label}
      action={
        <span className="dash-count-pill">{records.length}</span>
      }
    >
      {sorted.length === 0 ? (
        <div className="dash-empty">
          <p className="dash-empty__text">No {model.label.toLowerCase()} yet.</p>
          <Button variant="primary" size="compact" onClick={() => navigate(editorRouteForModel(model))}>
            <Add size={14} /> Create {model.singularLabel || model.label}
          </Button>
        </div>
      ) : (
        <Fragment>
          <ul className="record-list">
            {sorted.map((record) => (
              <li
                key={record.id}
                className="record-list__item"
                onClick={() => navigate(editorRouteForModel(model, record.id))}
              >
                <div className="record-list__main">
                  <span className="record-list__title">{record.title || '(Untitled)'}</span>
                  {record.slug && <span className="record-list__slug">/{record.slug}</span>}
                </div>
                <span className="record-list__time">{record.modified ? formatRelativeTime(record.modified) : '—'}</span>
              </li>
            ))}
          </ul>
          <div className="dash-card__footer">
            <Button variant="tertiary" size="compact" onClick={() => navigate(collectionPathForModel(model))}>
              View all {model.label.toLowerCase()}
            </Button>
          </div>
        </Fragment>
      )}
    </WidgetShell>
  );
}

/* ── Recent Inquiries Widget ── */
function WidgetRecentInquiries({ items }) {
  return (
    <WidgetShell title="Recent inquiries">
      {items.length === 0 ? (
        <p className="dash-empty__text">No inquiries yet.</p>
      ) : (
        <ul className="record-list">
          {items.map((item) => (
            <li className="record-list__item" key={item.id}>
              <div className="record-list__main">
                <span className="record-list__title">{item.title || '(Unnamed)'}</span>
                {item.email && <span className="record-list__slug">{item.email}</span>}
              </div>
              <span className={`status-pill status-pill--${item.status || 'new'}`}>{item.status || 'new'}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

/* ── Site Structure Widget ── */
function WidgetSiteStructure({ routes }) {
  return (
    <WidgetShell eyebrow="Pages" title="Site structure">
      <ul className="structure-list">
        {routes.map((route) => (
          <li className="structure-list__item" key={route.id}>
            <div className="structure-list__main">
              <span className="structure-list__title">{route.title}</span>
              <span className="structure-list__path">{formatRouteLabel(route)}</span>
            </div>
            {route.template && <span className="structure-list__tpl">{route.template}</span>}
          </li>
        ))}
      </ul>
    </WidgetShell>
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
const DASH_STORAGE_KEY = 'portfolio-light-dash-widgets-v3';

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
      { id: 'stats', type: 'stats', label: 'Key metrics', visible: true, span: 'full' },
      { id: 'traffic', type: 'traffic', label: 'Traffic overview', visible: true, span: 'full' },
      { id: 'timeline', type: 'timeline', label: 'Recent activity', visible: true, span: 'half' },
      { id: 'top-content', type: 'top-content', label: 'Top content', visible: true, span: 'half' },
      { id: 'content-breakdown', type: 'content-breakdown', label: 'Content distribution', visible: true, span: 'half' },
      { id: 'referrers', type: 'referrers', label: 'Top referrers', visible: true, span: 'half' },
    ];
    for (const model of bootstrap.models) {
      if (model.type !== 'collection') continue;
      list.push({ id: `collection-${model.id}`, type: 'collection-list', modelId: model.id, label: model.label, visible: true, span: 'half' });
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
      case 'stats':
        return <WidgetStatCards dashboard={dashboard} navigate={navigate} />;
      case 'traffic':
        return <WidgetTraffic dashboard={dashboard} />;
      case 'timeline':
        return <WidgetTimeline dashboard={dashboard} bootstrap={bootstrap} navigate={navigate} />;
      case 'top-content':
        return <WidgetTopContent dashboard={dashboard} bootstrap={bootstrap} navigate={navigate} />;
      case 'referrers':
        return <WidgetReferrers dashboard={dashboard} />;
      case 'content-breakdown':
        return <WidgetContentBreakdown dashboard={dashboard} />;
      case 'collection-list': {
        const model = bootstrap.models.find((m) => m.id === widget.modelId);
        if (!model) return null;
        return <WidgetCollectionList model={model} records={recordsByModel[model.id] ?? []} />;
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
