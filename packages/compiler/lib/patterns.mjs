// Theme pattern + template reference expansion.
export function resolvePatternName(slug) {
  return String(slug ?? '').split('/').pop() ?? '';
}

export function expandTemplateReferences(source, assets, stack = []) {
  if (!source) {
    return '';
  }

  let output = source;

  output = output.replace(/<!--\s+wp:template-part\s+({[\s\S]*?})\s+\/-->/g, (match, rawAttrs) => {
    const attrs = JSON.parse(rawAttrs);
    const slug = String(attrs.slug ?? '');
    const key = `part:${slug}`;

    if (!slug || !assets.parts[slug]) {
      return '';
    }

    if (stack.includes(key)) {
      throw new Error(`Template cycle detected: ${[...stack, key].join(' -> ')}`);
    }

    return expandTemplateReferences(assets.parts[slug], assets, [...stack, key]);
  });

  output = output.replace(/<!--\s+wp:pattern\s+({[\s\S]*?})\s+\/-->/g, (match, rawAttrs) => {
    const attrs = JSON.parse(rawAttrs);
    const patternName = resolvePatternName(attrs.slug);
    const key = `pattern:${patternName}`;

    if (!patternName || !assets.patterns[patternName]) {
      return '';
    }

    if (stack.includes(key)) {
      throw new Error(`Template cycle detected: ${[...stack, key].join(' -> ')}`);
    }

    return expandTemplateReferences(assets.patterns[patternName], assets, [...stack, key]);
  });

  return output;
}

export function resolveSingleTemplateName(postType, templates) {
  const candidates = [
    postType === 'page' ? 'page' : null,
    `single-${postType}`,
    postType === 'post' ? 'single' : null,
    'single',
  ].filter(Boolean);

  return candidates.find((name) => templates[name]) ?? '';
}

