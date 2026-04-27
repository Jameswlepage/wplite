import './styles.css';
import '@wordpress/block-editor/build-style/content.css';
import '@wordpress/block-editor/build-style/default-editor-styles.css';
import '@wordpress/block-editor/build-style/style.css';
import '@wordpress/block-library/build-style/common.css';
import '@wordpress/block-library/build-style/reset.css';
import '@wordpress/block-library/build-style/style.css';
import '@wordpress/block-library/build-style/editor.css';
import '@wordpress/block-library/build-style/editor-elements.css';
import '@wordpress/block-library/build-style/theme.css';
import '@wordpress/components/build-style/style.css';
import '@wordpress/dataviews/build-style/style.css';
import '../../../../node_modules/@wordpress/format-library/build-style/style.css';
import '@wordpress/core-data';
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { getBlockType } from '@wordpress/blocks';
import { registerCoreBlocks } from '@wordpress/block-library';
import '@wordpress/format-library';
import { Card, CardBody, SlotFillProvider } from '@wordpress/components';
import wpApiFetch from '@wordpress/api-fetch';

import { appBasePath, runtimeConfig, syncUrl, wpRestRoot } from './lib/config.js';
import { apiFetch } from './lib/helpers.js';
import { addFilter } from '@wordpress/hooks';
import { createWpliteSyncProvider } from './lib/wplite-sync-provider.js';
import { initWpliteEventBus } from './lib/wplite-event-bus.js';

if (wpRestRoot) {
  wpApiFetch.use(wpApiFetch.createRootURLMiddleware(wpRestRoot));
}
if (runtimeConfig.nonce) {
  wpApiFetch.use(wpApiFetch.createNonceMiddleware(runtimeConfig.nonce));
}

// Opt into @wordpress/sync's CRDT pipeline when the dev sync server is
// running. This must happen synchronously before any getEntityRecord() call
// resolves — the sync manager caches providerCreators on first access and
// late registration is silently ignored. See docs/hmr-crdt.md.
if (syncUrl) {
  window._wpCollaborationEnabled = true;
  const wpliteProviderCreator = createWpliteSyncProvider(syncUrl);
  addFilter('sync.providers', 'wplite/sync-provider', () => [wpliteProviderCreator]);
  initWpliteEventBus(syncUrl);
}

import { registerRuntimeBlocks } from './lib/blocks.jsx';
import { initDevHmr } from './lib/dev-hmr.js';
import { AppLoadingSkeleton } from './components/skeletons.jsx';
import { AppShell } from './components/shell.jsx';
import { SpaNavBridge } from './lib/spa-nav.js';

if (!getBlockType('core/paragraph')) {
  registerCoreBlocks();
}

/* ── App ── */
function App() {
  const [bootstrap, setBootstrap] = useState(null);
  const [recordsByModel, setRecordsByModel] = useState({});
  const [singletonData, setSingletonData] = useState({});
  const [error, setError] = useState(null);

  const refetchBootstrap = React.useCallback(async () => {
    try {
      const payload = await apiFetch('bootstrap');
      registerRuntimeBlocks(payload.blocks ?? []);
      setBootstrap(payload);
      setRecordsByModel(payload.records ?? {});
      setSingletonData(payload.singletonData ?? {});
    } catch (loadError) {
      setError(loadError);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payload = await apiFetch('bootstrap');
        if (cancelled) return;
        registerRuntimeBlocks(payload.blocks ?? []);
        setBootstrap(payload);
        setRecordsByModel(payload.records ?? {});
        setSingletonData(payload.singletonData ?? {});
      } catch (loadError) {
        if (!cancelled) setError(loadError);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handler = () => { refetchBootstrap(); };
    window.addEventListener('wplite-dev-hmr:bootstrap-refresh', handler);
    return () => window.removeEventListener('wplite-dev-hmr:bootstrap-refresh', handler);
  }, [refetchBootstrap]);

  if (error) {
    const systemFont = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif";
    return (
      <div className="app-loading">
        <Card className="surface-card" style={{ maxWidth: '480px', width: '100%', fontFamily: systemFont }}>
          <CardBody>
            <h1 style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: 600, fontFamily: systemFont, letterSpacing: '-0.005em' }}>Failed to load</h1>
            <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.45, color: 'var(--wp-admin-text-muted)', fontFamily: systemFont, wordBreak: 'break-word' }}>{error.message}</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (!bootstrap) {
    return <AppLoadingSkeleton />;
  }

  return (
    <SlotFillProvider>
      <BrowserRouter basename={appBasePath} unstable_useTransitions={false}>
        <SpaNavBridge />
        <AppShell
          bootstrap={bootstrap}
          setBootstrap={setBootstrap}
          recordsByModel={recordsByModel}
          setRecordsByModel={setRecordsByModel}
          singletonData={singletonData}
          setSingletonData={setSingletonData}
        />
      </BrowserRouter>
    </SlotFillProvider>
  );
}

initDevHmr();

const root = createRoot(document.getElementById('portfolio-admin-root'));
root.render(<App />);
