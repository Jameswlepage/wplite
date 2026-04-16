/**
 * Layout / container blocks: group, row, stack, columns, column, details.
 */

const group = (ctx) => {
  const layoutType = ctx.blockAttrs?.layout?.type || 'default';
  const out = [
    {
      id: 'block:group.pad',
      label: 'Add padding',
      prompt: 'Apply comfortable padding (top, bottom, inline) to the selected group using theme spacing presets.',
      weight: 82,
      group: 'style',
    },
    {
      id: 'block:group.color-bg',
      label: 'Give it a background color',
      prompt: 'Set a subtle background color on the selected group using a color from the theme palette.',
      weight: 78,
      group: 'style',
    },
    {
      id: 'block:group.round',
      label: 'Round the corners',
      prompt: 'Round the corners of the selected group using theme border-radius.',
      weight: 70,
      group: 'style',
    },
    {
      id: 'block:group.split-sections',
      label: 'Split into sections',
      prompt: 'Break the contents of the selected group into clearly-labelled sections with H2 headings and visible spacing between each.',
      weight: 74,
      group: 'structure',
    },
  ];
  if (layoutType === 'flex') {
    out.push({
      id: 'block:group.flex-reverse',
      label: 'Reverse flex direction',
      prompt: 'Reverse the flex direction of the selected group (flex-direction reverse) so children appear in the opposite order.',
      weight: 68,
      group: 'structure',
    });
  }
  if (layoutType === 'default' || layoutType === 'constrained') {
    out.push({
      id: 'block:group.to-row',
      label: 'Lay out children in a row',
      prompt: 'Change the selected group layout to a horizontal row (flex, horizontal).',
      weight: 66,
      group: 'structure',
    });
  }
  return out;
};

const columns = () => [
  {
    id: 'block:columns.count',
    label: 'Change column count',
    prompt: 'Change the number of columns in the selected columns block. Suggest a count that fits the current content.',
    weight: 88,
    group: 'structure',
  },
  {
    id: 'block:columns.equal-width',
    label: 'Equalize column widths',
    prompt: 'Reset all columns in the selected columns block so they share equal widths.',
    weight: 76,
    group: 'structure',
  },
  {
    id: 'block:columns.stack-mobile',
    label: 'Stack on mobile',
    prompt: 'Ensure the selected columns block stacks vertically on mobile.',
    weight: 72,
    group: 'style',
  },
  {
    id: 'block:columns.gap',
    label: 'Adjust column gap',
    prompt: 'Set a comfortable gap between columns in the selected columns block using theme spacing.',
    weight: 68,
    group: 'style',
  },
  {
    id: 'block:columns.add-column',
    label: 'Add another column',
    prompt: 'Append a new column to the selected columns block with a sensible placeholder heading and paragraph.',
    weight: 82,
    group: 'structure',
  },
];

const column = () => [
  {
    id: 'block:column.width',
    label: 'Change this column\'s width',
    prompt: 'Change the width of the selected column. Suggest a value that balances the other columns.',
    weight: 82,
    group: 'style',
  },
  {
    id: 'block:column.vertical-align',
    label: 'Change vertical alignment',
    prompt: 'Change the vertical alignment (top / center / bottom) of the content inside the selected column.',
    weight: 72,
    group: 'style',
  },
];

const row = () => [
  {
    id: 'block:row.justify',
    label: 'Change horizontal alignment',
    prompt: 'Change the horizontal justification of the items inside the selected row (start / center / space-between).',
    weight: 80,
    group: 'style',
  },
  {
    id: 'block:row.gap',
    label: 'Adjust item gap',
    prompt: 'Set a comfortable gap between items in the selected row using theme spacing presets.',
    weight: 70,
    group: 'style',
  },
  {
    id: 'block:row.wrap',
    label: 'Allow items to wrap',
    prompt: 'Allow items inside the selected row to wrap to a new line when they no longer fit.',
    weight: 64,
    group: 'style',
  },
];

const stack = () => [
  {
    id: 'block:stack.gap',
    label: 'Adjust item spacing',
    prompt: 'Adjust the vertical gap between items inside the selected stack using theme spacing.',
    weight: 74,
    group: 'style',
  },
  {
    id: 'block:stack.align',
    label: 'Align items',
    prompt: 'Change the horizontal alignment of items inside the selected stack (left / center / right).',
    weight: 70,
    group: 'style',
  },
];

const details = () => [
  {
    id: 'block:details.summary',
    label: 'Rewrite the summary',
    prompt: 'Rewrite the summary label on the selected details block so it is clearer and more inviting to open.',
    weight: 84,
    group: 'copy',
  },
  {
    id: 'block:details.add-answer',
    label: 'Add another Q&A row',
    prompt: 'Insert a new details block below the selected one with a placeholder question and answer.',
    weight: 76,
    group: 'structure',
  },
];

export const layoutBlockRules = {
  'core/group': [group],
  'core/columns': [columns],
  'core/column': [column],
  'core/row': [row],
  'core/stack': [stack],
  'core/details': [details],
};
