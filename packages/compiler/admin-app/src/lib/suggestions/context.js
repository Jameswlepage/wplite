/**
 * SuggestionContext: the single snapshot every provider reads from.
 *
 * Shape:
 *   {
 *     block:            the currently selected Gutenberg block (or null),
 *     blockName:        e.g. "core/paragraph",
 *     blockAttrs:       block.attributes ({} when no block),
 *     innerCount:       number of inner blocks on the selection,
 *     hasBlock:         boolean shortcut,
 *     view:             surface view id (e.g. "page-editor"),
 *     entity:           surface entity { kind, slug, sourceFile, renderSources,
 *                       rendersPostContent, ... },
 *     rendersPostContent: boolean shortcut (null when unknown),
 *     route:            current pathname,
 *     surfaceExtension: the per-screen assistant surface object (used as a
 *                       fallback source of suggestions).
 *   }
 *
 * Providers receive this object and return Suggestion[] — they do not mutate
 * it. Keep it plain JSON so it can be passed to a future AI reranker as-is.
 */
export function buildSuggestionContext({ selectedBlock, surfaceContext, surfaceExtension, route }) {
  const block = selectedBlock || null;
  const entity = surfaceContext?.entity || null;
  const view = surfaceContext?.view || null;
  const innerCount = Array.isArray(block?.innerBlocks) ? block.innerBlocks.length : 0;
  return {
    block,
    blockName: block?.name || null,
    blockAttrs: block?.attributes || {},
    innerCount,
    hasBlock: !!block,
    view,
    entity,
    rendersPostContent:
      entity && typeof entity.rendersPostContent === 'boolean' ? entity.rendersPostContent : null,
    route: route || null,
    surfaceExtension: surfaceExtension || null,
  };
}

/**
 * Cheap equality check so the resolver can decide whether to re-run. Covers
 * the fields the rules actually read.
 */
export function contextKey(ctx) {
  if (!ctx) return '';
  const attrs = ctx.blockAttrs || {};
  const attrSig = [
    attrs.level,
    attrs.tagName,
    attrs.layout?.type,
    typeof attrs.content === 'string' ? attrs.content.length : 0,
    attrs.url ? 1 : 0,
    attrs.query?.postType || '',
  ].join('|');
  return [
    ctx.blockName || '',
    ctx.innerCount,
    attrSig,
    ctx.view || '',
    ctx.entity?.kind || '',
    ctx.entity?.slug || '',
    ctx.rendersPostContent,
    ctx.route || '',
  ].join('::');
}
