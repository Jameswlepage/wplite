import { collectBlockRuleSuggestions } from './providers/block-rules.js';
import { collectEntitySuggestions } from './providers/entity-rules.js';
import { collectSurfaceFallback } from './providers/surface-fallback.js';
import { rerankSuggestions } from './providers/ai-reranker.js';

/**
 * Suggestion shape:
 *   {
 *     id:       stable string, provider-prefixed (e.g. "block:paragraph.tighten"),
 *     label:    short human-readable action,
 *     prompt:   string sent to the agent. Falls back to label when empty/null.
 *     weight:   deterministic ranking signal (higher = earlier). Default 50.
 *     group:    optional bucket label ("copy", "style", "structure"...) for
 *               future diversification.
 *     requires: optional (ctx) => bool guard. Suggestion is dropped when false.
 *   }
 *
 * The resolver runs providers in this order, merges candidates, de-dupes by
 * id (first wins — so higher-priority providers can override), filters by
 * `requires`, sorts by weight desc, then hands the full list to the reranker.
 * The reranker may reorder, add, or remove candidates. The UI then caps to
 * `limit` and keeps the rest as a refresh queue.
 */
export const DEFAULT_SUGGESTION_LIMIT = 5;

export async function resolveSuggestions(ctx, { limit = DEFAULT_SUGGESTION_LIMIT } = {}) {
  if (!ctx) return { all: [], visible: [], queue: [] };

  const candidates = [];
  const seen = new Set();

  const push = (items) => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (!item || !item.label) continue;
      const id = item.id || `auto:${item.label}`;
      if (seen.has(id)) continue;
      if (typeof item.requires === 'function') {
        try {
          if (!item.requires(ctx)) continue;
        } catch {
          continue;
        }
      }
      seen.add(id);
      candidates.push({
        id,
        label: item.label,
        prompt: typeof item.prompt === 'string' ? item.prompt : '',
        weight: Number.isFinite(item.weight) ? item.weight : 50,
        group: item.group || null,
      });
    }
  };

  push(collectBlockRuleSuggestions(ctx));
  push(collectEntitySuggestions(ctx));
  push(collectSurfaceFallback(ctx));

  candidates.sort((a, b) => b.weight - a.weight);

  const ranked = await rerankSuggestions(ctx, candidates);
  const safe = Array.isArray(ranked) && ranked.length > 0 ? ranked : candidates;

  return sliceForDisplay(safe, { limit });
}

/**
 * Synchronous variant. The deterministic providers are cheap so we don't
 * need to wait on them. The reranker is async and only runs when it has a
 * reason to (see ai-reranker.js — it's a no-op today). Callers that want a
 * zero-latency first paint use this; AI reranking happens in a follow-up
 * pass that can update the UI.
 */
export function resolveSuggestionsSync(ctx, { limit = DEFAULT_SUGGESTION_LIMIT } = {}) {
  if (!ctx) return { all: [], visible: [], queue: [] };

  const candidates = [];
  const seen = new Set();

  const push = (items) => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (!item || !item.label) continue;
      const id = item.id || `auto:${item.label}`;
      if (seen.has(id)) continue;
      if (typeof item.requires === 'function') {
        try {
          if (!item.requires(ctx)) continue;
        } catch {
          continue;
        }
      }
      seen.add(id);
      candidates.push({
        id,
        label: item.label,
        prompt: typeof item.prompt === 'string' ? item.prompt : '',
        weight: Number.isFinite(item.weight) ? item.weight : 50,
        group: item.group || null,
      });
    }
  };

  push(collectBlockRuleSuggestions(ctx));
  push(collectEntitySuggestions(ctx));
  push(collectSurfaceFallback(ctx));

  candidates.sort((a, b) => b.weight - a.weight);
  return sliceForDisplay(candidates, { limit });
}

function sliceForDisplay(ranked, { limit }) {
  const all = ranked.slice();
  const visible = all.slice(0, limit);
  const queue = all.slice(limit);
  return { all, visible, queue };
}

/**
 * Rotate the queue: take the next `limit` items off the queue and push the
 * currently-visible items to the end. Used by the "refresh suggestions"
 * affordance. Returns a new {visible, queue} pair without mutating input.
 */
export function rotateSuggestions({ visible, queue }, { limit = DEFAULT_SUGGESTION_LIMIT } = {}) {
  if (!queue || queue.length === 0) return { visible, queue };
  const take = Math.min(limit, queue.length);
  const nextVisible = queue.slice(0, take);
  const remainder = queue.slice(take);
  const nextQueue = [...remainder, ...visible];
  return { visible: nextVisible, queue: nextQueue };
}
