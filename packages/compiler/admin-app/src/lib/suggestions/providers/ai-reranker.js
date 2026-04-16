/**
 * AI reranker — plug point for future lightweight-model augmentation.
 *
 * Contract:
 *   rerankSuggestions(ctx, candidates) -> Promise<Suggestion[]>
 *
 * A future implementation should:
 *  1. Send `ctx` (selected block attrs, entity metadata, view) plus the
 *     candidate list to a small local or hosted model.
 *  2. Ask the model to (a) optionally synthesize 2–3 novel candidates that
 *     fit the specific block content, and (b) re-rank the merged list by
 *     relevance to what the user is most likely to want next.
 *  3. Preserve the Suggestion shape exactly. Any malformed items must be
 *     filtered out before returning.
 *
 * Today this is a pass-through. The resolver falls back to the deterministic
 * order if we return null/undefined.
 */
export async function rerankSuggestions(_ctx, candidates) {
  return candidates;
}

/**
 * Soft opt-in for the future AI path. The resolver currently ignores this —
 * it's here so the consumer wiring doesn't have to change when we turn it on.
 */
export function isAIRerankEnabled() {
  return false;
}
