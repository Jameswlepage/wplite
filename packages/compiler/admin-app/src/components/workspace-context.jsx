import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const DEFAULT_SURFACE = {
  entityId: '',
  entityLabel: '',
  title: '',
  status: '',
  saveLabel: 'Save',
  publishLabel: 'Publish',
  canSave: false,
  canPublish: false,
  isSaving: false,
  share: null,
  save: null,
  publish: null,
  moreActions: [],
};

const WorkspaceSurfaceContext = createContext(null);

export function WorkspaceSurfaceProvider({ children }) {
  const [surface, setSurface] = useState(DEFAULT_SURFACE);
  const resetSurface = useCallback(() => setSurface(DEFAULT_SURFACE), []);

  const value = useMemo(
    () => ({
      surface,
      setSurface,
      resetSurface,
    }),
    [resetSurface, surface]
  );

  return (
    <WorkspaceSurfaceContext.Provider value={value}>
      {children}
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
