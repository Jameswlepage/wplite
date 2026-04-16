/**
 * Post-* template blocks. These render per-post inside a query loop (or at
 * the top of a single template). Suggestions here assume the user wants to
 * shape how the current post renders, not edit a specific piece of content.
 */

const postContent = () => [
  {
    id: 'block:post-content.proofread',
    label: 'Proofread the post body',
    prompt: 'Proofread the body that the selected post-content block will render. Fix typos, grammar, and awkward phrasing while keeping voice and formatting.',
    weight: 92,
    group: 'copy',
  },
  {
    id: 'block:post-content.rewrite-warm',
    label: 'Rewrite in a warmer voice',
    prompt: 'Rewrite the post body that the selected post-content block renders in a warmer, more conversational voice while keeping facts and structure.',
    weight: 88,
    group: 'copy',
  },
  {
    id: 'block:post-content.tldr',
    label: 'Add a TL;DR at the top',
    prompt: 'Add a three-bullet TL;DR at the very top of the post body (above the first H2) that the selected post-content block renders.',
    weight: 82,
    group: 'structure',
  },
  {
    id: 'block:post-content.internal-links',
    label: 'Suggest internal links',
    prompt: 'Identify 2–3 phrases in the post body that should link to other pages or posts on this site, and add those links.',
    weight: 76,
    group: 'structure',
  },
  {
    id: 'block:post-content.seo',
    label: 'Optimize for SEO',
    prompt: 'Optimize the post body that the selected post-content block renders for SEO: tighten the opening, make sure the primary topic is in the first paragraph, and add useful H2s.',
    weight: 74,
    group: 'copy',
  },
];

const postTitle = () => [
  {
    id: 'block:post-title.level',
    label: 'Change heading level',
    prompt: 'Change the heading level used by the selected post-title block (e.g. H1 → H2).',
    weight: 80,
    group: 'structure',
  },
  {
    id: 'block:post-title.as-link',
    label: 'Toggle title as link',
    prompt: 'Toggle whether the selected post-title block renders as a clickable link to the post.',
    weight: 72,
    group: 'structure',
  },
  {
    id: 'block:post-title.size',
    label: 'Change font size',
    prompt: 'Change the font size applied to the selected post-title block using a theme preset.',
    weight: 70,
    group: 'style',
  },
];

const postExcerpt = () => [
  {
    id: 'block:post-excerpt.length',
    label: 'Shorten the excerpt length',
    prompt: 'Reduce the excerpt length on the selected post-excerpt block so summaries are more scannable.',
    weight: 78,
    group: 'structure',
  },
  {
    id: 'block:post-excerpt.more-text',
    label: 'Change "read more" text',
    prompt: 'Change the "read more" text on the selected post-excerpt block to something more compelling (e.g. "Continue reading →").',
    weight: 74,
    group: 'copy',
  },
];

const postFeaturedImage = () => [
  {
    id: 'block:post-featured-image.aspect',
    label: 'Change aspect ratio',
    prompt: 'Change the aspect ratio of the selected post-featured-image block (e.g. 16/9, 4/3, square).',
    weight: 80,
    group: 'style',
  },
  {
    id: 'block:post-featured-image.link',
    label: 'Toggle image as link',
    prompt: 'Toggle whether the selected post-featured-image block links to the post.',
    weight: 72,
    group: 'structure',
  },
  {
    id: 'block:post-featured-image.full-width',
    label: 'Stretch to full width',
    prompt: 'Set the selected post-featured-image block alignment to full width.',
    weight: 70,
    group: 'style',
  },
];

const postDate = () => [
  {
    id: 'block:post-date.format',
    label: 'Change date format',
    prompt: 'Change the format of the selected post-date block (e.g. "F j, Y"). Pick a format that matches the theme voice.',
    weight: 74,
    group: 'style',
  },
  {
    id: 'block:post-date.toggle-modified',
    label: 'Show last-modified instead',
    prompt: 'Change the selected post-date block to display the last-modified date instead of the published date.',
    weight: 66,
    group: 'structure',
  },
];

const postAuthor = () => [
  {
    id: 'block:post-author.avatar',
    label: 'Toggle author avatar',
    prompt: 'Toggle the avatar on the selected post-author block.',
    weight: 72,
    group: 'structure',
  },
  {
    id: 'block:post-author.byline',
    label: 'Add "By" prefix',
    prompt: 'Add a "By" prefix to the selected post-author block.',
    weight: 64,
    group: 'copy',
  },
];

const postTerms = () => [
  {
    id: 'block:post-terms.separator',
    label: 'Change term separator',
    prompt: 'Change the separator used by the selected post-terms block (e.g. comma, middle dot).',
    weight: 70,
    group: 'style',
  },
];

const postCommentsForm = () => [
  {
    id: 'block:post-comments-form.heading',
    label: 'Rewrite the form heading',
    prompt: 'Rewrite the heading on the selected post-comments-form block to be friendlier (e.g. "Join the conversation").',
    weight: 72,
    group: 'copy',
  },
];

export const postBlockRules = {
  'core/post-content': [postContent],
  'core/post-title': [postTitle],
  'core/post-excerpt': [postExcerpt],
  'core/post-featured-image': [postFeaturedImage],
  'core/post-date': [postDate],
  'core/post-author': [postAuthor],
  'core/post-author-name': [postAuthor],
  'core/post-terms': [postTerms],
  'core/post-comments-form': [postCommentsForm],
};
