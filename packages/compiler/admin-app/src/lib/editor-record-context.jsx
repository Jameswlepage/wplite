import React, { createContext, useContext } from 'react';

const EditorRecordContext = createContext(null);

export function EditorRecordProvider({ value, children }) {
  return (
    <EditorRecordContext.Provider value={value ?? null}>
      {children}
    </EditorRecordContext.Provider>
  );
}

export function useEditorRecord() {
  return useContext(EditorRecordContext);
}
