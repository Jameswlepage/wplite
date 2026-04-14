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

import { appBasePath } from './lib/config.js';
import { apiFetch } from './lib/helpers.js';
import { registerRuntimeBlocks } from './lib/blocks.jsx';
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

  useEffect(() => {
    let cancelled = false;
    async function load() {
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
    }
    load();
    return () => { cancelled = true; };
  }, []);

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
      <BrowserRouter basename={appBasePath}>
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

const root = createRoot(document.getElementById('portfolio-admin-root'));
root.render(<App />);
