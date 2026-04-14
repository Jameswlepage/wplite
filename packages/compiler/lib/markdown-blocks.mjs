// Markdown-to-WordPress-block serialization.
import { marked } from 'marked';

export function serializeBlock(name, html, attributes = null) {
  const serializedAttributes =
    attributes && Object.keys(attributes).length > 0 ? ` ${JSON.stringify(attributes)}` : '';

  return `<!-- wp:${name}${serializedAttributes} -->\n${html.trim()}\n<!-- /wp:${name} -->`;
}

export function tokenToBlockMarkup(token, attrOverrides = {}) {
  switch (token.type) {
    case 'paragraph':
      return serializeBlock('paragraph', marked.parser([token]).trim(), attrOverrides.paragraph || null);
    case 'heading': {
      const attributes = { ...(token.depth && token.depth !== 2 ? { level: token.depth } : {}) };
      let workingToken = token;
      const anchorMatch = /\s*\{#([a-zA-Z0-9_-]+)\}\s*$/.exec(token.text || '');
      if (anchorMatch) {
        attributes.anchor = anchorMatch[1];
        const strippedText = token.text.replace(anchorMatch[0], '').trimEnd();
        workingToken = { ...token, text: strippedText, tokens: marked.lexer(strippedText)[0]?.tokens ?? token.tokens };
      }
      if (attrOverrides.heading) Object.assign(attributes, attrOverrides.heading);
      const html = marked.parser([workingToken]).trim();
      const withAnchor = attributes.anchor
        ? html.replace(/^<h(\d)([^>]*)>/, (m, d, rest) => `<h${d}${rest} id="${attributes.anchor}">`)
        : html;
      return serializeBlock('heading', withAnchor, Object.keys(attributes).length ? attributes : null);
    }
    case 'list':
      return serializeBlock('list', marked.parser([token]).trim(), attrOverrides.list || null);
    case 'blockquote':
      return serializeBlock('quote', marked.parser([token]).trim(), attrOverrides.quote || null);
    case 'code': {
      const html = marked.parser([token]).trim();
      const attributes = { ...(token.lang ? { className: `language-${token.lang}` } : {}) };
      if (attrOverrides.code) Object.assign(attributes, attrOverrides.code);
      return serializeBlock('code', html, Object.keys(attributes).length ? attributes : null);
    }
    case 'hr':
      return '<!-- wp:separator -->\n<hr class="wp-block-separator"/>\n<!-- /wp:separator -->';
    case 'html':
      return serializeBlock('html', (token.raw ?? token.text ?? '').trim());
    default:
      return serializeBlock('html', (token.raw ?? marked.parser([token])).trim());
  }
}

export function markdownToBlockMarkup(source, attrOverrides = {}) {
  const trimmed = String(source ?? '').trim();

  if (!trimmed) {
    return '';
  }

  const tokens = marked.lexer(trimmed);

  return tokens
    .filter((token) => token.type !== 'space')
    .map((token) => tokenToBlockMarkup(token, attrOverrides))
    .join('\n\n');
}

