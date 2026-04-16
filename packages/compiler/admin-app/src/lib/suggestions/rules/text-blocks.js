/**
 * Text blocks: paragraph, heading, list, list-item, quote, pullquote,
 * preformatted, verse, code. These share "transform the copy" suggestions
 * (rewrite, tighten, expand, tone shift) and visual tweaks (size, weight,
 * color) but the prompts name the concrete block so the agent knows what
 * to edit.
 */

const hasContent = (ctx) => {
  const c = ctx.blockAttrs?.content;
  return typeof c === 'string' && c.replace(/<[^>]+>/g, '').trim().length > 0;
};

const paragraph = () => [
  {
    id: 'block:paragraph.tighten',
    label: 'Tighten this paragraph',
    prompt: 'Rewrite the selected paragraph to be more concise and scannable. Keep meaning, drop filler.',
    weight: 92,
    group: 'copy',
    requires: hasContent,
  },
  {
    id: 'block:paragraph.expand',
    label: 'Expand with more detail',
    prompt: 'Expand the selected paragraph with one or two more sentences that add concrete detail or an example. Keep the same voice.',
    weight: 90,
    group: 'copy',
    requires: hasContent,
  },
  {
    id: 'block:paragraph.tone-friendly',
    label: 'Make it more friendly',
    prompt: 'Rewrite the selected paragraph in a warmer, more approachable tone without losing information.',
    weight: 86,
    group: 'copy',
    requires: hasContent,
  },
  {
    id: 'block:paragraph.tone-formal',
    label: 'Make it more formal',
    prompt: 'Rewrite the selected paragraph in a more formal, precise tone suitable for a business audience.',
    weight: 84,
    group: 'copy',
    requires: hasContent,
  },
  {
    id: 'block:paragraph.fix-grammar',
    label: 'Fix grammar and typos',
    prompt: 'Proofread the selected paragraph. Fix grammar, spelling, and punctuation without changing the meaning or voice.',
    weight: 82,
    group: 'copy',
    requires: hasContent,
  },
  {
    id: 'block:paragraph.bigger',
    label: 'Make it bigger',
    prompt: 'Increase the font size of the selected paragraph one step (e.g. set fontSize to "large").',
    weight: 72,
    group: 'style',
  },
  {
    id: 'block:paragraph.smaller',
    label: 'Make it smaller',
    prompt: 'Decrease the font size of the selected paragraph one step (e.g. set fontSize to "small").',
    weight: 70,
    group: 'style',
  },
  {
    id: 'block:paragraph.color',
    label: 'Change text color',
    prompt: 'Change the text color of the selected paragraph. Suggest a color that fits the theme palette and apply it.',
    weight: 68,
    group: 'style',
  },
  {
    id: 'block:paragraph.add-link',
    label: 'Add a link',
    prompt: 'Add a link to a relevant phrase inside the selected paragraph. If the destination is unclear, ask me before inserting.',
    weight: 64,
    group: 'structure',
    requires: hasContent,
  },
];

const heading = () => [
  {
    id: 'block:heading.rewrite-punchier',
    label: 'Make it punchier',
    prompt: 'Rewrite the selected heading so it is shorter, more specific, and more compelling. Preserve meaning.',
    weight: 92,
    group: 'copy',
    requires: hasContent,
  },
  {
    id: 'block:heading.rewrite-options',
    label: 'Suggest three alternatives',
    prompt: 'Offer three alternative rewrites for the selected heading with different angles (benefit-led, curiosity, direct). Let me pick one.',
    weight: 88,
    group: 'copy',
    requires: hasContent,
  },
  {
    id: 'block:heading.bump-level',
    label: 'Bump down a level (H2 → H3)',
    prompt: 'Lower the selected heading one level (for example, change level 2 to level 3). Preserve the content.',
    weight: 78,
    group: 'structure',
  },
  {
    id: 'block:heading.lift-level',
    label: 'Lift up a level (H3 → H2)',
    prompt: 'Raise the selected heading one level (for example, change level 3 to level 2). Preserve the content.',
    weight: 76,
    group: 'structure',
  },
  {
    id: 'block:heading.bigger',
    label: 'Make it bigger',
    prompt: 'Increase the font size of the selected heading one step.',
    weight: 72,
    group: 'style',
  },
  {
    id: 'block:heading.color',
    label: 'Change text color',
    prompt: 'Change the text color of the selected heading to something that fits the theme palette.',
    weight: 68,
    group: 'style',
  },
  {
    id: 'block:heading.add-lede',
    label: 'Add a lede paragraph',
    prompt: 'Insert a short introductory paragraph directly after the selected heading, around 2–3 sentences, matching the page voice.',
    weight: 64,
    group: 'structure',
  },
];

const list = () => [
  {
    id: 'block:list.add-items',
    label: 'Add three more items',
    prompt: 'Extend the selected list with three more items that fit the same theme and voice.',
    weight: 90,
    group: 'copy',
  },
  {
    id: 'block:list.tighten',
    label: 'Tighten each item',
    prompt: 'Rewrite every item in the selected list to be shorter and parallel in structure.',
    weight: 88,
    group: 'copy',
  },
  {
    id: 'block:list.sort',
    label: 'Sort items logically',
    prompt: 'Reorder the items in the selected list into the most useful reading order (priority, alphabetical, or narrative — pick the best fit).',
    weight: 82,
    group: 'structure',
  },
  {
    id: 'block:list.to-ordered',
    label: 'Convert to numbered list',
    prompt: 'Convert the selected list to an ordered (numbered) list.',
    weight: 74,
    group: 'structure',
    requires: (ctx) => ctx.blockAttrs?.ordered !== true,
  },
  {
    id: 'block:list.to-unordered',
    label: 'Convert to bulleted list',
    prompt: 'Convert the selected list to an unordered (bulleted) list.',
    weight: 74,
    group: 'structure',
    requires: (ctx) => ctx.blockAttrs?.ordered === true,
  },
];

const listItem = () => [
  {
    id: 'block:list-item.tighten',
    label: 'Tighten this item',
    prompt: 'Rewrite the selected list item to be shorter and more parallel with typical list-item phrasing.',
    weight: 88,
    group: 'copy',
    requires: hasContent,
  },
  {
    id: 'block:list-item.add-detail',
    label: 'Add supporting detail',
    prompt: 'Expand the selected list item with a short clause of concrete supporting detail.',
    weight: 84,
    group: 'copy',
    requires: hasContent,
  },
];

const quote = () => [
  {
    id: 'block:quote.tighten',
    label: 'Tighten this quote',
    prompt: 'Trim the selected quote to its most powerful sentence or two. Preserve attribution.',
    weight: 86,
    group: 'copy',
  },
  {
    id: 'block:quote.attribution',
    label: 'Add attribution',
    prompt: 'Add or improve the attribution (cite) on the selected quote. Keep it concise.',
    weight: 76,
    group: 'structure',
  },
  {
    id: 'block:quote.to-pullquote',
    label: 'Convert to pullquote',
    prompt: 'Convert the selected quote block to a pullquote for more visual emphasis.',
    weight: 72,
    group: 'structure',
  },
];

const pullquote = () => [
  {
    id: 'block:pullquote.tighten',
    label: 'Make it more striking',
    prompt: 'Rewrite the selected pullquote to be shorter and more striking. Keep attribution if present.',
    weight: 86,
    group: 'copy',
  },
  {
    id: 'block:pullquote.color',
    label: 'Change accent color',
    prompt: 'Change the accent/background color of the selected pullquote to a color that fits the theme palette.',
    weight: 70,
    group: 'style',
  },
];

const code = () => [
  {
    id: 'block:code.explain',
    label: 'Add an explanation above',
    prompt: 'Insert a short paragraph above the selected code block that explains what the code does for a reader who is unfamiliar with it.',
    weight: 82,
    group: 'copy',
  },
  {
    id: 'block:code.simplify',
    label: 'Simplify the snippet',
    prompt: 'Rewrite the selected code block so it is shorter and clearer while preserving behavior. Prefer idiomatic style for the language.',
    weight: 80,
    group: 'copy',
  },
];

const verse = () => [
  {
    id: 'block:verse.tighten',
    label: 'Tighten this verse',
    prompt: 'Tighten the selected verse block by removing weak words while keeping rhythm and intent.',
    weight: 80,
    group: 'copy',
  },
];

const preformatted = () => [
  {
    id: 'block:preformatted.to-code',
    label: 'Convert to code block',
    prompt: 'Convert the selected preformatted block to a code block so syntax handling is appropriate.',
    weight: 76,
    group: 'structure',
  },
];

export const textBlockRules = {
  'core/paragraph': [paragraph],
  'core/heading': [heading],
  'core/list': [list],
  'core/list-item': [listItem],
  'core/quote': [quote],
  'core/pullquote': [pullquote],
  'core/code': [code],
  'core/verse': [verse],
  'core/preformatted': [preformatted],
};
