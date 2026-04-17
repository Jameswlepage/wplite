import { apiFetch } from './helpers.js';
import { registerServerBlockTypes } from './blocks.jsx';

let cachedEditorBundlePromise = null;
let cachedEditorBundleValue = null;

export function getCachedEditorBundle() {
  return cachedEditorBundleValue;
}

export function clearCachedEditorBundle() {
  cachedEditorBundlePromise = null;
  cachedEditorBundleValue = null;
}

export function loadEditorBundle() {
  if (!cachedEditorBundlePromise) {
    cachedEditorBundlePromise = apiFetch('editor-bundle')
      .then((bundle) => {
        registerServerBlockTypes(bundle?.blockTypes ?? []);
        cachedEditorBundleValue = bundle;
        return bundle;
      })
      .catch((error) => {
        cachedEditorBundlePromise = null;
        cachedEditorBundleValue = null;
        throw error;
      });
  }
  return cachedEditorBundlePromise;
}
