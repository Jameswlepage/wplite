import React from 'react';
import {
  Card,
  CardBody,
} from '@wordpress/components';

export function SkeletonLine({ size, width, style }) {
  const cls = ['skeleton skeleton-line'];
  if (size === 'sm') cls.push('skeleton-line--sm');
  if (size === 'lg') cls.push('skeleton-line--lg');
  if (size === 'xl') cls.push('skeleton-line--xl');
  if (width === 'full') cls.push('skeleton-line--full');
  if (width === '60') cls.push('skeleton-line--60');
  if (width === '80') cls.push('skeleton-line--80');
  return <div className={cls.join(' ')} style={style} />;
}

export function SkeletonBox({ width, height, style, className = '' }) {
  return <div className={`skeleton skeleton-rect ${className}`} style={{ width, height, ...style }} />;
}

export function SkeletonScreenHeader({ actions = 1 }) {
  return (
    <div className="skeleton-screen-header">
      <div className="skeleton-screen-header__left">
        <SkeletonLine size="sm" style={{ width: 60 }} />
        <SkeletonLine size="lg" style={{ width: 200 }} />
        <SkeletonLine style={{ width: 280 }} />
      </div>
      <div className="skeleton-screen-header__actions">
        {Array.from({ length: actions }, (_, i) => (
          <SkeletonBox key={i} className="skeleton-btn" />
        ))}
      </div>
    </div>
  );
}

export function SkeletonTableRows({ rows = 5, cols = 3 }) {
  return (
    <div className="skeleton-table">
      <div className="skeleton-table__row skeleton-table__header">
        {Array.from({ length: cols }, (_, i) => (
          <SkeletonBox key={i} height={11} style={{ width: `${50 + i * 10}%` }} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="skeleton-table__row">
          {Array.from({ length: cols }, (_, c) => (
            <SkeletonBox key={c} height={13} style={{ width: `${60 + ((r + c) % 3) * 15}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonFormFields({ fields = 4 }) {
  return (
    <div className="skeleton-form">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="skeleton-form__field">
          <SkeletonBox height={11} style={{ width: 90 + (i % 3) * 20 }} />
          <SkeletonBox height={36} style={{ width: '100%' }} />
        </div>
      ))}
    </div>
  );
}

export function AppLoadingSkeleton() {
  return (
    <div className="app-loading-skeleton">
      <div className="app-loading-skeleton__sidebar">
        <div className="app-loading-skeleton__brand">
          <SkeletonBox width={40} height={40} style={{ borderRadius: 10 }} />
          <div>
            <SkeletonBox height={13} style={{ width: 120, marginBottom: 6 }} />
            <SkeletonBox height={10} style={{ width: 80 }} />
          </div>
        </div>
        <div className="app-loading-skeleton__nav">
          {[140, 100, 120, 90, 130, 110, 100, 80].map((w, i) => (
            <SkeletonBox key={i} className="app-loading-skeleton__nav-item" style={{ width: '100%' }} />
          ))}
        </div>
      </div>
      <div className="app-loading-skeleton__canvas">
        <SkeletonBox height={20} style={{ width: 140, borderRadius: 4 }} />
        <div className="app-loading-skeleton__canvas-inner">
          <SkeletonLine size="lg" style={{ width: 200 }} />
          <SkeletonLine style={{ width: 300 }} />
          <SkeletonBox height={180} style={{ width: '100%', borderRadius: 4 }} />
          <SkeletonBox height={120} style={{ width: '100%', borderRadius: 4 }} />
        </div>
      </div>
    </div>
  );
}

export function PageListSkeleton() {
  return (
    <div className="screen">
      <SkeletonScreenHeader actions={1} />
      <Card className="surface-card">
        <CardBody>
          <SkeletonTableRows rows={6} cols={3} />
        </CardBody>
      </Card>
    </div>
  );
}

export function EditorSkeleton() {
  return (
    <div className="screen">
      <div className="skeleton-editor">
        <div className="skeleton-editor__main">
          <Card className="surface-card">
            <CardBody>
              <div className="skeleton-editor__content">
                <SkeletonLine size="xl" style={{ width: '70%' }} />
                <SkeletonLine width="full" />
                <SkeletonLine width="80" />
                <SkeletonLine width="60" />
                <SkeletonBox height={100} style={{ width: '100%', marginTop: 8 }} />
                <SkeletonLine width="full" />
                <SkeletonLine width="80" />
              </div>
            </CardBody>
          </Card>
        </div>
        <div className="skeleton-editor__sidebar">
          <div className="skeleton-editor__sidebar-card">
            <SkeletonLine size="sm" style={{ width: 80 }} />
            <SkeletonFormFields fields={3} />
          </div>
          <div className="skeleton-editor__sidebar-card">
            <SkeletonLine size="sm" style={{ width: 100 }} />
            <SkeletonFormFields fields={2} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function MediaSkeleton() {
  return (
    <div className="screen">
      <SkeletonScreenHeader actions={2} />
      <Card className="surface-card">
        <CardBody>
          <div className="skeleton-media-grid">
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
    </div>
  );
}

export function UsersSkeleton() {
  return (
    <div className="screen">
      <SkeletonScreenHeader actions={1} />
      <div className="skeleton-workspace-split">
        <Card className="surface-card">
          <CardBody>
            <SkeletonTableRows rows={5} cols={4} />
          </CardBody>
        </Card>
        <Card className="surface-card">
          <CardBody>
            <SkeletonFormFields fields={5} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export function SettingsFormSkeleton() {
  return (
    <div className="screen">
      <SkeletonScreenHeader actions={1} />
      <Card className="surface-card">
        <CardBody>
          <SkeletonFormFields fields={6} />
        </CardBody>
      </Card>
    </div>
  );
}

export function LogsSkeleton() {
  return (
    <div className="screen">
      <SkeletonScreenHeader actions={3} />
      <SkeletonBox height={36} style={{ width: '100%' }} />
      <Card className="surface-card">
        <CardBody style={{ padding: 0 }}>
          <div className="skeleton-logs">
            {Array.from({ length: 15 }, (_, i) => (
              <div key={i} className="skeleton-log-line">
                <SkeletonBox height={14} style={{ width: 30 }} />
                <SkeletonBox height={14} style={{ width: `${40 + (i % 5) * 12}%` }} />
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
