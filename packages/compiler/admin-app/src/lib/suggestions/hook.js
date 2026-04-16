import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildSuggestionContext, contextKey } from './context.js';
import {
  DEFAULT_SUGGESTION_LIMIT,
  resolveSuggestionsSync,
  rotateSuggestions,
} from './index.js';
import { isAIRerankEnabled, rerankSuggestions } from './providers/ai-reranker.js';

/**
 * React hook that produces the display-ready suggestion state for the
 * assistant rail. Re-resolves whenever the inputs meaningfully change.
 *
 * Returns:
 *   {
 *     visible: Suggestion[],   // up to `limit` items, in display order
 *     queue:   Suggestion[],   // remainder, surfaced via refresh()
 *     total:   number,         // visible.length + queue.length
 *     canRefresh: boolean,
 *     refresh: () => void,     // rotate visible ↔ queue
 *   }
 */
export function useSuggestions({ selectedBlock, surfaceContext, surfaceExtension, route, limit = DEFAULT_SUGGESTION_LIMIT }) {
  const context = useMemo(
    () => buildSuggestionContext({ selectedBlock, surfaceContext, surfaceExtension, route }),
    [selectedBlock, surfaceContext, surfaceExtension, route]
  );

  // Stable key for the context — avoids re-resolving when React hands us a
  // new object reference but the meaningful fields haven't changed.
  const key = useMemo(() => contextKey(context), [context]);

  const initial = useMemo(() => resolveSuggestionsSync(context, { limit }), [context, limit]);
  const [state, setState] = useState(initial);
  const lastKeyRef = useRef(key);

  useEffect(() => {
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;
    setState(resolveSuggestionsSync(context, { limit }));
  }, [key, context, limit]);

  // Optional async AI reranking pass. Kicks in only if the reranker is
  // enabled; otherwise we stay with the deterministic result. The reranker
  // is non-blocking — the deterministic list has already painted.
  useEffect(() => {
    if (!isAIRerankEnabled()) return;
    let cancelled = false;
    (async () => {
      try {
        const ranked = await rerankSuggestions(context, [...state.visible, ...state.queue]);
        if (cancelled || !Array.isArray(ranked) || ranked.length === 0) return;
        setState({
          visible: ranked.slice(0, limit),
          queue: ranked.slice(limit),
          all: ranked,
        });
      } catch {
        // Reranker failures fall back silently to deterministic order.
      }
    })();
    return () => { cancelled = true; };
    // Intentionally depends on key, not state, to avoid re-triggering on
    // each rotate. Reranking re-runs when the underlying context changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, limit]);

  const refresh = useCallback(() => {
    setState((current) => {
      const next = rotateSuggestions(current, { limit });
      return { ...next, all: [...next.visible, ...next.queue] };
    });
  }, [limit]);

  return {
    visible: state.visible,
    queue: state.queue,
    total: state.visible.length + state.queue.length,
    canRefresh: state.queue.length > 0,
    refresh,
  };
}
