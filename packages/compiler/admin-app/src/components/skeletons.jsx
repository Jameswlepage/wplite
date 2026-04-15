import React from 'react';

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

function ScreenSkeleton() {
  return <div className="screen-skeleton" aria-hidden="true" />;
}

export function AppLoadingSkeleton() {
  return (
    <div className="app-shell app-shell--workspace app-loading-skeleton">
      <header className="workspace-topbar">
        <div className="workspace-topbar__left">
          <div className="workspace-topbar__wp-button" aria-hidden="true">
            <span className="skeleton skeleton-circle" style={{ width: 22, height: 22 }} />
          </div>
          <div className="workspace-topbar__identity">
            <span className="skeleton" style={{ width: 88, height: 12, borderRadius: 4 }} />
          </div>
        </div>
        <div className="workspace-topbar__right">
          <div className="workspace-topbar__toggles">
            <span className="skeleton" style={{ width: 32, height: 32, borderRadius: 6 }} />
            <span className="skeleton" style={{ width: 32, height: 32, borderRadius: 6 }} />
            <span className="skeleton" style={{ width: 32, height: 32, borderRadius: 6 }} />
            <span className="skeleton" style={{ width: 32, height: 32, borderRadius: 6 }} />
          </div>
          <div className="workspace-topbar__actions">
            <span className="skeleton" style={{ width: 64, height: 32, borderRadius: 8 }} />
            <span className="skeleton" style={{ width: 78, height: 32, borderRadius: 8 }} />
          </div>
        </div>
      </header>
      <div className="workspace-layout">
        <aside className="workspace-rail" aria-hidden="true" />
        <div className="workspace-main">
          <div className="workspace-canvas">
            <div className="workspace-canvas__inner" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PageListSkeleton() { return <ScreenSkeleton />; }
export function EditorSkeleton() { return <ScreenSkeleton />; }
export function MediaSkeleton() { return <ScreenSkeleton />; }
export function UsersSkeleton() { return <ScreenSkeleton />; }
export function SettingsFormSkeleton() { return <ScreenSkeleton />; }
export function LogsSkeleton() { return <ScreenSkeleton />; }

export function SkeletonScreenHeader() { return null; }
export function SkeletonTableRows() { return null; }
export function SkeletonFormFields() { return null; }
