/**
 * Button blocks — both the singular core/button and the core/buttons
 * container. Button copy is the #1 conversion lever so the top slots go to
 * label rewrites.
 */

const button = () => [
  {
    id: 'block:button.punchier',
    label: 'Rewrite as a stronger CTA',
    prompt: 'Rewrite the selected button label as a stronger, action-first CTA. Keep it three words or fewer when possible.',
    weight: 92,
    group: 'copy',
  },
  {
    id: 'block:button.options',
    label: 'Suggest three label options',
    prompt: 'Suggest three alternative labels for the selected button — each with a different angle (benefit, curiosity, urgency). Let me pick one.',
    weight: 88,
    group: 'copy',
  },
  {
    id: 'block:button.primary-style',
    label: 'Make it the primary style',
    prompt: 'Apply the theme\'s primary / filled button style to the selected button block.',
    weight: 80,
    group: 'style',
  },
  {
    id: 'block:button.secondary-style',
    label: 'Make it an outline button',
    prompt: 'Apply the theme\'s outline / secondary button style to the selected button block.',
    weight: 76,
    group: 'style',
  },
  {
    id: 'block:button.link',
    label: 'Set link destination',
    prompt: 'Set or update the link destination for the selected button. Ask me where it should point if it is ambiguous.',
    weight: 74,
    group: 'structure',
  },
  {
    id: 'block:button.full-width',
    label: 'Stretch to full width',
    prompt: 'Make the selected button full-width within its container.',
    weight: 66,
    group: 'style',
  },
];

const buttons = () => [
  {
    id: 'block:buttons.add-secondary',
    label: 'Add a secondary button',
    prompt: 'Add a secondary outline-style button inside the selected buttons group, paired with the existing primary.',
    weight: 90,
    group: 'structure',
  },
  {
    id: 'block:buttons.align-center',
    label: 'Center the buttons',
    prompt: 'Center-align the buttons inside the selected buttons group.',
    weight: 72,
    group: 'style',
  },
  {
    id: 'block:buttons.stack-mobile',
    label: 'Stack on mobile',
    prompt: 'Ensure the buttons inside the selected buttons group stack vertically on mobile for thumb-friendly tapping.',
    weight: 70,
    group: 'style',
  },
  {
    id: 'block:buttons.rewrite-all',
    label: 'Rewrite all button labels',
    prompt: 'Rewrite the labels of every button in the selected buttons group so they are action-first and complement each other.',
    weight: 84,
    group: 'copy',
  },
];

export const buttonBlockRules = {
  'core/button': [button],
  'core/buttons': [buttons],
};
