/**
 * Lowest-priority provider. Surfaces anything the per-screen extension
 * registered via `useRegisterAssistantSurface({ suggestions: [...] })`.
 *
 * These come last so block-specific and entity-level suggestions dominate
 * the top slots. Surface-registered items weight in at 20–40 by default so
 * a screen can still promote an item with an explicit `weight`.
 */
export function collectSurfaceFallback(ctx) {
  const ext = ctx?.surfaceExtension;
  const list = Array.isArray(ext?.suggestions) ? ext.suggestions : [];
  return list.map((item, index) => ({
    id: item.id || `surface:${index}:${item.label}`,
    label: item.label,
    prompt: typeof item.prompt === 'string' ? item.prompt : '',
    weight: Number.isFinite(item.weight) ? item.weight : 30,
    group: item.group || 'surface',
  }));
}
