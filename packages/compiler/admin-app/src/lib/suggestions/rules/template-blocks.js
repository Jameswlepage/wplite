/**
 * Structural template blocks: template-part, shortcode, html, search.
 */

const templatePart = (ctx) => {
  const slug = ctx.blockAttrs?.slug || null;
  return [
    {
      id: 'block:template-part.edit',
      label: slug ? `Edit the "${slug}" part` : 'Edit this template part',
      prompt: `Open and help me edit the template part ${slug ? `"${slug}" ` : ''}referenced by the selected template-part block. Treat edits to that part as the authoritative source.`,
      weight: 88,
      group: 'structure',
    },
    {
      id: 'block:template-part.swap',
      label: 'Swap for a different part',
      prompt: 'Change which template part the selected template-part block references. Ask me which one if ambiguous.',
      weight: 76,
      group: 'structure',
    },
  ];
};

const shortcode = () => [
  {
    id: 'block:shortcode.explain',
    label: 'Explain this shortcode',
    prompt: 'Explain what the selected shortcode block does and what it needs to render.',
    weight: 78,
    group: 'copy',
  },
  {
    id: 'block:shortcode.replace',
    label: 'Replace with native blocks',
    prompt: 'Propose how to replace the selected shortcode with native Gutenberg blocks that achieve the same result.',
    weight: 70,
    group: 'structure',
  },
];

const html = () => [
  {
    id: 'block:html.explain',
    label: 'Explain this HTML',
    prompt: 'Explain what the HTML inside the selected custom-HTML block does.',
    weight: 76,
    group: 'copy',
  },
  {
    id: 'block:html.sanitize',
    label: 'Convert to native blocks',
    prompt: 'Convert the HTML inside the selected custom-HTML block to equivalent native Gutenberg blocks where possible.',
    weight: 70,
    group: 'structure',
  },
];

const search = () => [
  {
    id: 'block:search.rewrite-button',
    label: 'Rewrite button label',
    prompt: 'Rewrite the button label on the selected search block to be more inviting (e.g. "Find an article").',
    weight: 78,
    group: 'copy',
  },
  {
    id: 'block:search.placeholder',
    label: 'Change placeholder',
    prompt: 'Change the placeholder text on the selected search block to be more specific and friendly.',
    weight: 72,
    group: 'copy',
  },
];

export const templateBlockRules = {
  'core/template-part': [templatePart],
  'core/shortcode': [shortcode],
  'core/html': [html],
  'core/search': [search],
};
