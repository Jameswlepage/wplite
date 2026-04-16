/**
 * Site-level blocks used inside templates: site-title, site-logo,
 * site-tagline, navigation, page-list, home-link.
 */

const siteTitle = () => [
  {
    id: 'block:site-title.level',
    label: 'Change heading level',
    prompt: 'Change the heading level on the selected site-title block.',
    weight: 74,
    group: 'structure',
  },
  {
    id: 'block:site-title.size',
    label: 'Change font size',
    prompt: 'Change the font size on the selected site-title block using a theme preset.',
    weight: 68,
    group: 'style',
  },
  {
    id: 'block:site-title.link-toggle',
    label: 'Toggle link to home',
    prompt: 'Toggle whether the selected site-title block is a link to the home page.',
    weight: 64,
    group: 'structure',
  },
];

const siteLogo = () => [
  {
    id: 'block:site-logo.swap',
    label: 'Replace the logo image',
    prompt: 'Help me replace the site logo image used by the selected site-logo block. Ask me for the new file if needed.',
    weight: 82,
    group: 'structure',
  },
  {
    id: 'block:site-logo.size',
    label: 'Change logo size',
    prompt: 'Change the width of the selected site-logo block.',
    weight: 72,
    group: 'style',
  },
  {
    id: 'block:site-logo.rounded',
    label: 'Round the corners',
    prompt: 'Apply rounded corners to the selected site-logo block.',
    weight: 64,
    group: 'style',
  },
];

const siteTagline = () => [
  {
    id: 'block:site-tagline.rewrite',
    label: 'Rewrite the tagline',
    prompt: 'Rewrite the site tagline shown by the selected site-tagline block so it is more distinctive and short.',
    weight: 82,
    group: 'copy',
  },
];

const navigation = () => [
  {
    id: 'block:navigation.add-link',
    label: 'Add a menu item',
    prompt: 'Add a new menu item to the selected navigation block. Ask me for the label and destination if they are not obvious from context.',
    weight: 88,
    group: 'structure',
  },
  {
    id: 'block:navigation.reorder',
    label: 'Reorder menu items',
    prompt: 'Suggest a more logical ordering of the menu items inside the selected navigation block and apply it.',
    weight: 80,
    group: 'structure',
  },
  {
    id: 'block:navigation.mobile-menu',
    label: 'Enable mobile overlay',
    prompt: 'Configure the selected navigation block to collapse into an overlay/drawer menu on mobile.',
    weight: 74,
    group: 'style',
  },
  {
    id: 'block:navigation.cta-button',
    label: 'Add a CTA button',
    prompt: 'Append a CTA button (primary style) to the end of the selected navigation block. Ask me for the label and destination if unclear.',
    weight: 78,
    group: 'structure',
  },
];

const navigationLink = () => [
  {
    id: 'block:navigation-link.rewrite',
    label: 'Rewrite this link label',
    prompt: 'Rewrite the label of the selected navigation link so it is shorter and clearer.',
    weight: 82,
    group: 'copy',
  },
  {
    id: 'block:navigation-link.destination',
    label: 'Change destination',
    prompt: 'Change the destination of the selected navigation link. Ask me where it should point if ambiguous.',
    weight: 74,
    group: 'structure',
  },
];

const pageList = () => [
  {
    id: 'block:page-list.filter',
    label: 'Limit to top-level pages',
    prompt: 'Configure the selected page-list block to show only top-level pages (no nested children).',
    weight: 78,
    group: 'structure',
  },
];

const homeLink = () => [
  {
    id: 'block:home-link.label',
    label: 'Rename "Home"',
    prompt: 'Rename the label on the selected home-link block to something warmer (e.g. "Start here").',
    weight: 70,
    group: 'copy',
  },
];

export const siteBlockRules = {
  'core/site-title': [siteTitle],
  'core/site-logo': [siteLogo],
  'core/site-tagline': [siteTagline],
  'core/navigation': [navigation],
  'core/navigation-link': [navigationLink],
  'core/navigation-submenu': [navigationLink],
  'core/page-list': [pageList],
  'core/home-link': [homeLink],
};
