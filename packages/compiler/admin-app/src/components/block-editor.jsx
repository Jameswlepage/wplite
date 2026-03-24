import React, { useEffect, useMemo, useState } from 'react';
import {
  BlockBreadcrumb,
  BlockCanvas,
  BlockEditorKeyboardShortcuts,
  BlockEditorProvider,
  Inserter,
  BlockInspector,
} from '@wordpress/block-editor';
import {
  Button,
  Popover,
  TabPanel,
} from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { buildBlockEditorSettings, buildCanvasStyles } from '../lib/blocks.jsx';

/* ── Native Block Editor Frame ── */
export function NativeBlockEditorFrame({
  eyebrow = 'Editor',
  label,
  title,
  titlePlaceholder,
  onChangeTitle,
  showTitleInput = true,
  blocks,
  onChangeBlocks,
  backLabel,
  onBack,
  primaryActionLabel = 'Save',
  onPrimaryAction,
  isPrimaryBusy = false,
  viewUrl,
  documentLabel = 'Page',
  documentSidebar,
  blockSidebarFooter = null,
  themeJson,
  themeCss,
}) {
  const selectedBlockId = useSelect(
    (select) => select(blockEditorStore).getSelectedBlockClientId(),
    []
  );
  const [inspectorTab, setInspectorTab] = useState(selectedBlockId ? 'block' : 'document');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (selectedBlockId) {
      setInspectorTab('block');
    }
  }, [selectedBlockId]);

  const canvasStyles = useMemo(
    () => buildCanvasStyles(themeJson, themeCss),
    [themeJson, themeCss]
  );

  const editorSettings = useMemo(
    () => buildBlockEditorSettings(themeJson, themeCss),
    [themeJson, themeCss]
  );

  return (
    <BlockEditorProvider
      value={blocks}
      onInput={onChangeBlocks}
      onChange={onChangeBlocks}
      settings={editorSettings}
    >
      <div className="native-editor">
        <BlockEditorKeyboardShortcuts />
        <header className="native-editor__topbar">
          <div className="native-editor__topbar-leading">
            <Button variant="tertiary" onClick={onBack}>
              {backLabel}
            </Button>
          </div>
          <div className="native-editor__topbar-center">
            <Inserter
              isAppender={false}
              toggleProps={{
                variant: 'tertiary',
                label: 'Add block',
              }}
            />
            <div className="native-editor__breadcrumb">
              <BlockBreadcrumb rootLabelText={documentLabel} />
            </div>
          </div>
          <div className="native-editor__topbar-actions">
            <Button
              variant="tertiary"
              onClick={() => setSidebarOpen((v) => !v)}
              label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="15" y1="3" x2="15" y2="21" />
                </svg>
              }
            />
            {viewUrl ? (
              <Button variant="secondary" href={viewUrl} target="_blank">
                View on Site
              </Button>
            ) : null}
            <Button variant="primary" isBusy={isPrimaryBusy} onClick={onPrimaryAction}>
              {primaryActionLabel}
            </Button>
          </div>
        </header>

        <div className={`native-editor__layout${sidebarOpen ? '' : ' native-editor__layout--no-sidebar'}`}>
          <section className="native-editor__main">
            <div className="native-editor__canvas-shell">
              {showTitleInput ? (
                <input
                  className="native-editor__title"
                  type="text"
                  placeholder={titlePlaceholder}
                  value={title}
                  onChange={(event) => onChangeTitle(event.target.value)}
                />
              ) : null}
              <div className="native-editor__canvas">
                <BlockCanvas height="100%" styles={canvasStyles} />
              </div>
            </div>
          </section>

          {sidebarOpen ? <aside className="native-editor__sidebar">
            <TabPanel
              className="native-editor__inspector-tabs"
              activeClass="is-active"
              initialTabName={inspectorTab}
              onSelect={setInspectorTab}
              tabs={[
                { name: 'document', title: documentLabel },
                { name: 'block', title: 'Block' },
              ]}
            >
              {(tab) => (
                <div className="native-editor__inspector-panel">
                  {tab.name === 'document' ? (
                    <div className="native-editor__document-sidebar">
                      {documentSidebar}
                    </div>
                  ) : (
                    <div className="native-editor__block-sidebar">
                      <BlockInspector />
                      {blockSidebarFooter ? (
                        <div className="native-editor__sidebar-footer">
                          {blockSidebarFooter}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
            </TabPanel>
          </aside> : null}
        </div>
      </div>
      <Popover.Slot />
    </BlockEditorProvider>
  );
}
