/**
 * Wildcard fallback — runs for every selected block, regardless of name.
 * Gives the user a safety net of "do something with this block" actions
 * when no specific rules are registered.
 *
 * Kept at lower weight (40–60) so dedicated rules always lead.
 */

const generic = (ctx) => {
  const label = humanizeBlockName(ctx.blockName);
  return [
    {
      id: 'block:generic.describe',
      label: `Explain this ${label} block`,
      prompt: `Explain what the selected ${ctx.blockName || 'block'} does on this page, what its key attributes are, and what I can tweak.`,
      weight: 58,
      group: 'meta',
    },
    {
      id: 'block:generic.remove',
      label: 'Remove this block',
      prompt: `Remove the selected ${ctx.blockName || 'block'} from the source file.`,
      weight: 50,
      group: 'structure',
    },
    {
      id: 'block:generic.duplicate',
      label: 'Duplicate this block',
      prompt: `Duplicate the selected ${ctx.blockName || 'block'} and place the copy directly after it.`,
      weight: 48,
      group: 'structure',
    },
    {
      id: 'block:generic.move-up',
      label: 'Move it up',
      prompt: `Move the selected ${ctx.blockName || 'block'} one position earlier in its parent.`,
      weight: 44,
      group: 'structure',
    },
    {
      id: 'block:generic.move-down',
      label: 'Move it down',
      prompt: `Move the selected ${ctx.blockName || 'block'} one position later in its parent.`,
      weight: 42,
      group: 'structure',
    },
  ];
};

function humanizeBlockName(name) {
  if (!name) return '';
  const tail = String(name).split('/').pop() || '';
  return tail.replace(/[-_]/g, ' ');
}

export const genericBlockRules = {
  '*': [generic],
};
