/**
 * Spacing and divider blocks. Few knobs, few suggestions.
 */

const separator = () => [
  {
    id: 'block:separator.style',
    label: 'Change separator style',
    prompt: 'Change the style of the selected separator (default / wide / dots). Pick whichever fits the surrounding layout best.',
    weight: 72,
    group: 'style',
  },
  {
    id: 'block:separator.color',
    label: 'Change color',
    prompt: 'Change the color of the selected separator to a subtle tone from the theme palette.',
    weight: 66,
    group: 'style',
  },
];

const spacer = () => [
  {
    id: 'block:spacer.taller',
    label: 'Make it taller',
    prompt: 'Increase the height of the selected spacer by roughly one step (e.g. from 32 to 64).',
    weight: 70,
    group: 'style',
  },
  {
    id: 'block:spacer.shorter',
    label: 'Make it shorter',
    prompt: 'Decrease the height of the selected spacer by roughly one step.',
    weight: 68,
    group: 'style',
  },
  {
    id: 'block:spacer.replace-with-separator',
    label: 'Replace with a separator',
    prompt: 'Replace the selected spacer with a separator so there is a visible rule between sections.',
    weight: 60,
    group: 'structure',
  },
];

export const spacingBlockRules = {
  'core/separator': [separator],
  'core/spacer': [spacer],
};
