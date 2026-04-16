/**
 * Media-oriented blocks: image, gallery, cover, media-text, video, audio,
 * file, embed.
 */

const image = () => [
  {
    id: 'block:image.alt',
    label: 'Suggest alt text',
    prompt: 'Suggest descriptive alt text for the selected image. Infer from filename, caption, and surrounding content. Keep under 125 characters.',
    weight: 92,
    group: 'copy',
  },
  {
    id: 'block:image.caption',
    label: 'Write a caption',
    prompt: 'Write a short caption for the selected image that fits the page voice.',
    weight: 86,
    group: 'copy',
  },
  {
    id: 'block:image.swap',
    label: 'Replace with a different image',
    prompt: 'Help me swap the selected image for a different one from the media library. If none fit, suggest what to search for.',
    weight: 78,
    group: 'structure',
  },
  {
    id: 'block:image.rounded',
    label: 'Round the corners',
    prompt: 'Apply rounded corners to the selected image using theme border-radius.',
    weight: 70,
    group: 'style',
  },
  {
    id: 'block:image.full-width',
    label: 'Stretch to full width',
    prompt: 'Change the selected image alignment to full width (align: full).',
    weight: 68,
    group: 'style',
    requires: (ctx) => ctx.blockAttrs?.align !== 'full',
  },
  {
    id: 'block:image.link',
    label: 'Link to another page',
    prompt: 'Wrap the selected image in a link. Ask me for the destination unless it is obvious from context.',
    weight: 64,
    group: 'structure',
  },
];

const gallery = () => [
  {
    id: 'block:gallery.add-more',
    label: 'Add more images',
    prompt: 'Help me add more images to the selected gallery from the media library.',
    weight: 90,
    group: 'structure',
  },
  {
    id: 'block:gallery.columns',
    label: 'Change column count',
    prompt: 'Change the column count of the selected gallery. Suggest a count that works with the current image count.',
    weight: 80,
    group: 'style',
  },
  {
    id: 'block:gallery.captions',
    label: 'Add captions to each image',
    prompt: 'Write short captions for each image in the selected gallery. Use filenames and surrounding context as hints.',
    weight: 78,
    group: 'copy',
  },
  {
    id: 'block:gallery.crop-match',
    label: 'Match crops across images',
    prompt: 'Enable the crop-to-match option on the selected gallery so all thumbnails share a uniform aspect ratio.',
    weight: 70,
    group: 'style',
  },
];

const cover = () => [
  {
    id: 'block:cover.swap-bg',
    label: 'Change background image',
    prompt: 'Swap the background image of the selected cover block. Suggest a choice from the media library or help me upload one.',
    weight: 92,
    group: 'structure',
  },
  {
    id: 'block:cover.overlay',
    label: 'Adjust overlay darkness',
    prompt: 'Adjust the overlay (dimRatio) on the selected cover block so the text remains readable against the background.',
    weight: 84,
    group: 'style',
  },
  {
    id: 'block:cover.full-height',
    label: 'Make it full viewport height',
    prompt: 'Set the selected cover block to 100vh (isRepeated = false, minHeight = 100, minHeightUnit = "vh").',
    weight: 78,
    group: 'style',
    requires: (ctx) => ctx.blockAttrs?.minHeightUnit !== 'vh' || (ctx.blockAttrs?.minHeight || 0) < 100,
  },
  {
    id: 'block:cover.swap-copy',
    label: 'Rewrite the cover copy',
    prompt: 'Rewrite the heading and subheading inside the selected cover block so it is more compelling.',
    weight: 80,
    group: 'copy',
  },
  {
    id: 'block:cover.to-media-text',
    label: 'Convert to media + text',
    prompt: 'Transform the selected cover block into a media & text block so the image sits beside the copy rather than behind it.',
    weight: 72,
    group: 'structure',
  },
];

const mediaText = () => [
  {
    id: 'block:media-text.flip',
    label: 'Flip media to the other side',
    prompt: 'Flip the selected media & text block so the image moves to the opposite side.',
    weight: 84,
    group: 'style',
  },
  {
    id: 'block:media-text.stack-mobile',
    label: 'Stack on mobile',
    prompt: 'Ensure the selected media & text block stacks vertically at the mobile breakpoint for readability.',
    weight: 76,
    group: 'style',
  },
  {
    id: 'block:media-text.swap-media',
    label: 'Swap the media',
    prompt: 'Help me replace the media side of the selected media & text block with a different image from the library.',
    weight: 80,
    group: 'structure',
  },
];

const video = () => [
  {
    id: 'block:video.poster',
    label: 'Set a poster image',
    prompt: 'Set a poster frame for the selected video block. Suggest an option from the media library or describe what to upload.',
    weight: 82,
    group: 'structure',
  },
  {
    id: 'block:video.caption',
    label: 'Add a caption',
    prompt: 'Write a concise caption for the selected video block.',
    weight: 76,
    group: 'copy',
  },
  {
    id: 'block:video.autoplay-mute',
    label: 'Autoplay muted',
    prompt: 'Configure the selected video to autoplay muted and loop, suitable for a background or hero.',
    weight: 68,
    group: 'style',
  },
];

const audio = () => [
  {
    id: 'block:audio.caption',
    label: 'Add a caption',
    prompt: 'Add a short caption below the selected audio block describing what it is.',
    weight: 80,
    group: 'copy',
  },
];

const file = () => [
  {
    id: 'block:file.button-label',
    label: 'Better button label',
    prompt: 'Rewrite the download button label on the selected file block so it is more action-oriented (e.g. "Download the whitepaper").',
    weight: 78,
    group: 'copy',
  },
];

const embed = () => [
  {
    id: 'block:embed.caption',
    label: 'Add a caption',
    prompt: 'Write a short caption below the selected embed block giving context for what the reader is about to see.',
    weight: 76,
    group: 'copy',
  },
  {
    id: 'block:embed.full-width',
    label: 'Stretch to full width',
    prompt: 'Set the selected embed block alignment to full so it spans the content width.',
    weight: 68,
    group: 'style',
    requires: (ctx) => ctx.blockAttrs?.align !== 'full',
  },
];

export const mediaBlockRules = {
  'core/image': [image],
  'core/gallery': [gallery],
  'core/cover': [cover],
  'core/media-text': [mediaText],
  'core/video': [video],
  'core/audio': [audio],
  'core/file': [file],
  'core/embed': [embed],
};
