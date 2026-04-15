import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const DEFAULT_SURFACE = {
  entityId: '',
  entityLabel: '',
  entityCollectionLabel: '',
  title: '',
  titlePlaceholder: '',
  status: '',
  saveLabel: 'Save',
  publishLabel: 'Publish',
  canSave: false,
  canPublish: false,
  isSaving: false,
  setTitle: null,
  share: null,
  save: null,
  publish: null,
  moreActions: [],
};

const DEFAULT_EDITOR_CHROME = {
  hasEditor: false,
  inserterOpen: false,
  sidebarOpen: false,
  toggleInserter: null,
  toggleSidebar: null,
};

/**
 * The assistant sidebar reads a "surface" contract so any screen can adapt
 * its composer. Fields:
 *
 *   placeholder    — string shown as the textarea placeholder.
 *   presets        — [{ id, label, prompt?, run?(api) }] quick buttons above
 *                    the composer. Clicking `prompt` drops it into the input;
 *                    `run` is a free-form handler that receives { submit,
 *                    setPrompt, state }.
 *   controls       — ReactNode rendered beneath the prompt (e.g. sliders).
 *   suggestions    — [{ id, label, prompt }] chips above the composer for
 *                    non-deterministic, content-seeded ideas.
 *   onSubmit       — async ({ prompt, state, block }) => void. If defined, the
 *                    composer routes submissions through this handler instead
 *                    of the default ACP path. Must push notices/messages
 *                    itself.
 *   scope          — free-form object with screen-specific state (e.g. the
 *                    current generate/enhance settings). Passed back in
 *                    onSubmit + presets.run as `state`.
 *   seedSuggestions — async () => suggestions[]. Called when the surface
 *                    registers; results populate `suggestions` asynchronously.
 */
const DEFAULT_ASSISTANT_SURFACE = {
  placeholder: '',
  presets: [],
  controls: null,
  suggestions: [],
  onSubmit: null,
  scope: null,
};

const WorkspaceSurfaceContext = createContext(null);
const EditorChromeContext = createContext(null);
const AssistantSurfaceContext = createContext(null);

export function WorkspaceSurfaceProvider({ children }) {
  const [surface, setSurface] = useState(DEFAULT_SURFACE);
  const [editorChrome, setEditorChrome] = useState(DEFAULT_EDITOR_CHROME);
  const [assistantSurface, setAssistantSurface] = useState(DEFAULT_ASSISTANT_SURFACE);
  const resetSurface = useCallback(() => setSurface(DEFAULT_SURFACE), []);
  const resetEditorChrome = useCallback(() => setEditorChrome(DEFAULT_EDITOR_CHROME), []);
  const resetAssistantSurface = useCallback(
    () => setAssistantSurface(DEFAULT_ASSISTANT_SURFACE),
    []
  );

  const surfaceValue = useMemo(
    () => ({ surface, setSurface, resetSurface }),
    [resetSurface, surface]
  );

  const editorChromeValue = useMemo(
    () => ({ editorChrome, setEditorChrome, resetEditorChrome }),
    [editorChrome, resetEditorChrome]
  );

  const assistantValue = useMemo(
    () => ({ assistantSurface, setAssistantSurface, resetAssistantSurface }),
    [assistantSurface, resetAssistantSurface]
  );

  return (
    <WorkspaceSurfaceContext.Provider value={surfaceValue}>
      <EditorChromeContext.Provider value={editorChromeValue}>
        <AssistantSurfaceContext.Provider value={assistantValue}>
          {children}
        </AssistantSurfaceContext.Provider>
      </EditorChromeContext.Provider>
    </WorkspaceSurfaceContext.Provider>
  );
}

export function useWorkspaceSurface() {
  const context = useContext(WorkspaceSurfaceContext);
  if (!context) {
    throw new Error('useWorkspaceSurface must be used within WorkspaceSurfaceProvider');
  }
  return context;
}

export function useEditorChrome() {
  const context = useContext(EditorChromeContext);
  if (!context) {
    throw new Error('useEditorChrome must be used within WorkspaceSurfaceProvider');
  }
  return context;
}

export function useRegisterWorkspaceSurface(surface) {
  const { setSurface, resetSurface } = useWorkspaceSurface();

  useEffect(() => {
    setSurface({
      ...DEFAULT_SURFACE,
      ...(surface ?? {}),
      moreActions: Array.isArray(surface?.moreActions) ? surface.moreActions : [],
    });

    return () => {
      resetSurface();
    };
  }, [resetSurface, setSurface, surface]);
}

export function useRegisterEditorChrome(chrome) {
  const { setEditorChrome, resetEditorChrome } = useEditorChrome();

  useEffect(() => {
    setEditorChrome({
      ...DEFAULT_EDITOR_CHROME,
      ...(chrome ?? {}),
      hasEditor: true,
    });

    return () => {
      resetEditorChrome();
    };
  }, [chrome, resetEditorChrome, setEditorChrome]);
}

export function useAssistantSurface() {
  const context = useContext(AssistantSurfaceContext);
  if (!context) {
    throw new Error('useAssistantSurface must be used within WorkspaceSurfaceProvider');
  }
  return context;
}

/**
 * Register a deterministic surface extension for the assistant sidebar.
 * Pass a memoized object so unmount cleans up reliably.
 *
 * Supports async seed suggestions via `seedSuggestions`. The result is merged
 * into the surface's `suggestions` field when it resolves.
 */
export function useRegisterAssistantSurface(extension) {
  const { setAssistantSurface, resetAssistantSurface } = useAssistantSurface();

  useEffect(() => {
    const merged = {
      ...DEFAULT_ASSISTANT_SURFACE,
      ...(extension ?? {}),
    };
    setAssistantSurface(merged);

    let cancelled = false;
    if (typeof extension?.seedSuggestions === 'function') {
      Promise.resolve()
        .then(() => extension.seedSuggestions())
        .then((result) => {
          if (cancelled || !Array.isArray(result)) return;
          setAssistantSurface((current) => ({
            ...current,
            suggestions: [...(current.suggestions || []), ...result],
          }));
        })
        .catch(() => {
          /* swallow — suggestions are non-critical */
        });
    }

    return () => {
      cancelled = true;
      resetAssistantSurface();
    };
  }, [extension, resetAssistantSurface, setAssistantSurface]);
}
