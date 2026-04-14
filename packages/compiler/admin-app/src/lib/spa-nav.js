/**
 * Bridges server-rendered dashboard block widgets into the SPA router.
 *
 * Widgets can use either of two escape hatches:
 *   1. Render <a href="/collection/123" data-spa-nav>…</a> — same-origin
 *      clicks are intercepted and dispatched through react-router.
 *   2. Call window.wpliteNavigate('/collection/123') from an Interactivity
 *      store action.
 *
 * Both paths avoid a full-page reload so the dashboard → editor transition
 * feels native. The bridge is idempotent per-session.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function SpaNavBridge() {
  useSpaNavBridge(useNavigate());
  return null;
}

export function useSpaNavBridge(navigate) {
  useEffect(() => {
    if (!navigate) return;

    window.wpliteNavigate = (to, options) => {
      if (typeof to !== 'string' || !to) return;
      navigate(to, options);
    };

    function onClick(event) {
      if (event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target.closest?.('a[data-spa-nav]');
      if (!anchor) return;
      const href = anchor.getAttribute('href') || '';
      if (!href || href.startsWith('http') || href.startsWith('//') || href.startsWith('#')) return;
      event.preventDefault();
      navigate(href);
    }

    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('click', onClick);
      if (window.wpliteNavigate) delete window.wpliteNavigate;
    };
  }, [navigate]);
}
