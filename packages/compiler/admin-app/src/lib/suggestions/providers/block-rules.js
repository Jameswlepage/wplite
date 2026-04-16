import { BLOCK_RULES } from '../rules/index.js';

/**
 * Look up rules for the currently-selected block and ask each one for
 * candidates. A rule is `(ctx) => Suggestion[]`. Multiple rules can register
 * for the same block name (e.g. a generic "text block" rule plus a
 * paragraph-specific one); we run them all and de-dupe upstream.
 *
 * No block selected → no rules fire. Block rules are the highest-priority
 * provider, so weights in this provider cluster in the 70–100 range.
 */
export function collectBlockRuleSuggestions(ctx) {
  if (!ctx?.hasBlock || !ctx.blockName) return [];
  const name = ctx.blockName;
  const direct = BLOCK_RULES[name];
  const wildcardRules = BLOCK_RULES['*'] || [];
  const rules = [...(Array.isArray(direct) ? direct : []), ...wildcardRules];
  const out = [];
  for (const rule of rules) {
    try {
      const result = rule(ctx);
      if (Array.isArray(result)) out.push(...result);
    } catch {
      // rules must not crash the resolver — swallow and continue
    }
  }
  return out;
}
