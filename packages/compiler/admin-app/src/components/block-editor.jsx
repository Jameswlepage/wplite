import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BlockBreadcrumb,
  BlockCanvas,
  BlockEditorKeyboardShortcuts,
  BlockEditorProvider,
  BlockInspector,
  BlockToolbar,
  BlockTools,
  Inserter,
} from '@wordpress/block-editor';
import {
  Button,
  DropdownMenu,
  PanelBody,
  Popover,
  TabPanel,
} from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { CarbonIcon } from '../lib/icons.jsx';
import { buildBlockEditorSettings, buildCanvasStyles } from '../lib/blocks.jsx';

/* ── Icon wrappers for WP Button/DropdownMenu icon props ── */
const BackIcon = () => <CarbonIcon name="ArrowLeft" size={20} />;
const AddIcon = () => <CarbonIcon name="Add" size={20} />;
const OverflowIcon = () => <CarbonIcon name="OverflowMenuVertical" size={20} />;
const LaunchIcon = () => <CarbonIcon name="Launch" size={16} />;
const SidebarCloseIcon = () => <CarbonIcon name="SidePanelClose" size={20} />;
const SidebarOpenIcon = () => <CarbonIcon name="SidePanelOpen" size={20} />;

/* ── Inline title widget for the topbar center ── */
function TopbarTitle({ title, placeholder, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title ?? '');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!editing) setDraft(title ?? '');
  }, [title, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function commit() {
    const next = draft;
    setEditing(false);
    if (next !== title) {
      onChange?.(next);
    }
  }

  function cancel() {
    setDraft(title ?? '');
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="native-editor__title-input"
        type="text"
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            cancel();
          }
        }}
      />
    );
  }

  const hasTitle = Boolean(title);
  const display = hasTitle ? title : (placeholder || 'Add title');

  return (
    <button
      type="button"
      className={`native-editor__title-display${hasTitle ? '' : ' is-placeholder'}`}
      onClick={() => setEditing(true)}
      title={display}
    >
      {display}
    </button>
  );
}

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
  wpAdminUrl,
  wpAdminTemplateUrl,
}) {
  const moreActionsControls = [];
  if (viewUrl) {
    moreActionsControls.push({
      title: 'View on site',
      icon: LaunchIcon,
      onClick: () => {
        window.open(viewUrl, '_blank', 'noopener,noreferrer');
      },
    });
  }
  if (wpAdminUrl) {
    moreActionsControls.push({
      title: 'Open in wp-admin',
      onClick: () => {
        window.open(wpAdminUrl, '_blank', 'noopener,noreferrer');
      },
    });
  }
  if (wpAdminTemplateUrl) {
    moreActionsControls.push({
      title: 'Edit template in wp-admin',
      onClick: () => {
        window.open(wpAdminTemplateUrl, '_blank', 'noopener,noreferrer');
      },
    });
  }

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
            <Button
              className="native-editor__back"
              icon={BackIcon}
              label={backLabel || 'Back'}
              showTooltip
              onClick={onBack}
            />
            <div className="native-editor__topbar-divider" aria-hidden="true" />
            <Inserter
              position="bottom right"
              rootClientId={undefined}
              isAppender={false}
              toggleProps={{
                icon: AddIcon,
                label: 'Add block',
                showTooltip: true,
                className: 'native-editor__inserter-toggle',
              }}
            />
          </div>

          <div className="native-editor__topbar-center">
            {showTitleInput ? (
              <TopbarTitle
                title={title}
                placeholder={titlePlaceholder}
                onChange={onChangeTitle}
              />
            ) : null}
          </div>

          <div className="native-editor__topbar-actions">
            <Button
              variant="primary"
              className="native-editor__save"
              isBusy={isPrimaryBusy}
              onClick={onPrimaryAction}
            >
              {primaryActionLabel}
            </Button>
            <Button
              className="native-editor__sidebar-toggle"
              isPressed={sidebarOpen}
              onClick={() => setSidebarOpen((v) => !v)}
              label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
              showTooltip
              icon={sidebarOpen ? SidebarCloseIcon : SidebarOpenIcon}
            />
            {moreActionsControls.length > 0 ? (
              <DropdownMenu
                className="native-editor__more-actions"
                icon={OverflowIcon}
                label="More actions"
                controls={moreActionsControls}
              />
            ) : null}
          </div>
        </header>

        <div className={`native-editor__layout${sidebarOpen ? '' : ' native-editor__layout--no-sidebar'}`}>
          <section className="native-editor__main">
            <BlockTools className="native-editor__block-tools">
              <div className="native-editor__block-toolbar">
                <BlockToolbar hideDragHandle />
              </div>
              <div className="native-editor__canvas-shell">
                <div className="native-editor__canvas">
                  <BlockCanvas height="100%" styles={canvasStyles} />
                </div>
              </div>
            </BlockTools>
            <footer className="native-editor__footer">
              <BlockBreadcrumb rootLabelText={documentLabel} />
            </footer>
          </section>

          {sidebarOpen ? (
            <aside className="native-editor__sidebar">
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
                          <PanelBody title="Actions" initialOpen={true}>
                            {blockSidebarFooter}
                          </PanelBody>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}
              </TabPanel>
            </aside>
          ) : null}
        </div>
      </div>
      <Popover.Slot />
    </BlockEditorProvider>
  );
}
