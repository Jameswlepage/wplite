/**
 * Query Loop family: core/query, core/post-template, core/query-title,
 * core/query-pagination*, core/query-no-results.
 */

const query = (ctx) => {
  const postType = ctx.blockAttrs?.query?.postType || 'post';
  return [
    {
      id: 'block:query.add-item',
      label: `Add a new ${postType}`,
      prompt: `Create a new ${postType} that will appear in the selected query loop. Ask me for the title and a one-line description, then generate a full draft and the source file.`,
      weight: 92,
      group: 'structure',
    },
    {
      id: 'block:query.change-post-type',
      label: 'Change what this queries',
      prompt: 'Change the post type / collection that the selected query loop displays. Ask me which one if it is not obvious, and update the query attribute.',
      weight: 86,
      group: 'structure',
    },
    {
      id: 'block:query.layout-grid',
      label: 'Switch layout to grid',
      prompt: 'Change the selected query loop to display in a grid layout (flex, horizontal) with an appropriate column count for the current item count.',
      weight: 82,
      group: 'structure',
      requires: (c) => c.blockAttrs?.displayLayout?.type !== 'flex',
    },
    {
      id: 'block:query.layout-list',
      label: 'Switch layout to list',
      prompt: 'Change the selected query loop to display in a single-column list layout (default).',
      weight: 82,
      group: 'structure',
      requires: (c) => c.blockAttrs?.displayLayout?.type === 'flex',
    },
    {
      id: 'block:query.columns',
      label: 'Change column count',
      prompt: 'Change the column count of the grid used by the selected query loop.',
      weight: 78,
      group: 'style',
      requires: (c) => c.blockAttrs?.displayLayout?.type === 'flex',
    },
    {
      id: 'block:query.per-page',
      label: 'Change items per page',
      prompt: 'Change the number of items per page on the selected query loop (query.perPage).',
      weight: 76,
      group: 'structure',
    },
    {
      id: 'block:query.category-filter',
      label: 'Filter by category',
      prompt: 'Filter the selected query loop to a specific category / taxonomy term. Ask me which if it is ambiguous.',
      weight: 74,
      group: 'structure',
    },
    {
      id: 'block:query.sort',
      label: 'Change sort order',
      prompt: 'Change the order and orderBy on the selected query loop (e.g. newest first, alphabetical, featured first).',
      weight: 72,
      group: 'structure',
    },
    {
      id: 'block:query.inherit-toggle',
      label: 'Toggle inherit from URL',
      prompt: 'Toggle the selected query loop\'s "inherit query from template" setting so it either follows the main URL query or uses its own.',
      weight: 68,
      group: 'structure',
    },
    {
      id: 'block:query.empty-state',
      label: 'Improve the empty state',
      prompt: 'Rewrite the selected query loop\'s no-results message to be more helpful and on-brand.',
      weight: 66,
      group: 'copy',
    },
  ];
};

const postTemplate = () => [
  {
    id: 'block:post-template.redesign-card',
    label: 'Redesign the card',
    prompt: 'Redesign the inside of the selected post template so each post card is more visually appealing — tweak the featured image ratio, title size, excerpt length, and metadata placement.',
    weight: 90,
    group: 'structure',
  },
  {
    id: 'block:post-template.add-excerpt',
    label: 'Add an excerpt under the title',
    prompt: 'Add a core/post-excerpt block under the title inside the selected post template so each card shows a preview of the body.',
    weight: 84,
    group: 'structure',
  },
  {
    id: 'block:post-template.add-read-more',
    label: 'Add a "Read more" link',
    prompt: 'Add a core/read-more block at the bottom of the selected post template.',
    weight: 78,
    group: 'structure',
  },
  {
    id: 'block:post-template.spacing',
    label: 'Tighten card spacing',
    prompt: 'Reduce the vertical gap between elements inside the selected post template for a tighter card.',
    weight: 70,
    group: 'style',
  },
];

const queryTitle = () => [
  {
    id: 'block:query-title.rewrite',
    label: 'Rewrite the title',
    prompt: 'Rewrite the text shown by the selected query-title block so it is clearer and more welcoming.',
    weight: 80,
    group: 'copy',
  },
  {
    id: 'block:query-title.level',
    label: 'Change heading level',
    prompt: 'Change the heading level of the selected query-title block (e.g. H1 → H2).',
    weight: 72,
    group: 'structure',
  },
];

const queryPagination = () => [
  {
    id: 'block:query-pagination.style',
    label: 'Change pagination style',
    prompt: 'Change the pagination style on the selected query (e.g. Previous/Next, numbered, load more). Pick one that fits the layout.',
    weight: 78,
    group: 'structure',
  },
  {
    id: 'block:query-pagination.labels',
    label: 'Rewrite the labels',
    prompt: 'Rewrite the Previous/Next labels on the selected query pagination to be friendlier (e.g. "← Older posts" / "Newer posts →").',
    weight: 72,
    group: 'copy',
  },
];

const queryNoResults = () => [
  {
    id: 'block:query-no-results.rewrite',
    label: 'Rewrite the empty-state',
    prompt: 'Rewrite the copy inside the selected query-no-results block to be more helpful. Suggest next steps or related links.',
    weight: 80,
    group: 'copy',
  },
];

export const queryBlockRules = {
  'core/query': [query],
  'core/post-template': [postTemplate],
  'core/query-title': [queryTitle],
  'core/query-pagination': [queryPagination],
  'core/query-pagination-next': [queryPagination],
  'core/query-pagination-previous': [queryPagination],
  'core/query-pagination-numbers': [queryPagination],
  'core/query-no-results': [queryNoResults],
};
