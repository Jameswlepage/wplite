/**
 * Aggregate registry: block name → rule[] map. Each rule is a function that
 * takes a SuggestionContext and returns a Suggestion[].
 *
 * To add rules for a new block type, create a module next to this file and
 * spread its exports into BLOCK_RULES below. Keep the per-block file small
 * — the point of the split is that each rule set stays reviewable.
 *
 * The `*` key is a wildcard — its rules run for every selected block after
 * any name-specific rules. Use sparingly.
 */
import { textBlockRules } from './text-blocks.js';
import { mediaBlockRules } from './media-blocks.js';
import { buttonBlockRules } from './button-blocks.js';
import { layoutBlockRules } from './layout-blocks.js';
import { spacingBlockRules } from './spacing-blocks.js';
import { postBlockRules } from './post-blocks.js';
import { queryBlockRules } from './query-blocks.js';
import { siteBlockRules } from './site-blocks.js';
import { templateBlockRules } from './template-blocks.js';
import { genericBlockRules } from './generic-block.js';

export const BLOCK_RULES = {
  ...textBlockRules,
  ...mediaBlockRules,
  ...buttonBlockRules,
  ...layoutBlockRules,
  ...spacingBlockRules,
  ...postBlockRules,
  ...queryBlockRules,
  ...siteBlockRules,
  ...templateBlockRules,
  ...genericBlockRules,
};
