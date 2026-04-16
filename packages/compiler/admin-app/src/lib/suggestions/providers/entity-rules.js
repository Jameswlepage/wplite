/**
 * Entity-level suggestions: driven by the surface context (entity kind,
 * whether the template renders post-content, the current view) rather than
 * by the selected block. These fire even when nothing is selected, and act
 * as the "what can I do with this whole page?" layer.
 *
 * Block-rule suggestions outrank these (weights here cluster around 40–65)
 * so a selection always leads with block-specific actions.
 */
export function collectEntitySuggestions(ctx) {
  if (!ctx) return [];
  const out = [];
  const entity = ctx.entity || null;
  const kind = entity?.kind || null;
  const view = ctx.view || null;

  // Template renders <!-- wp:post-content /--> → edits to the body propagate.
  if (kind === 'page' && ctx.rendersPostContent === true) {
    out.push(
      {
        id: 'entity:page.proofread',
        label: 'Proofread this page',
        prompt: 'Proofread the current page. Fix typos, grammar, and awkward phrasing. Keep voice and formatting.',
        weight: 62,
        group: 'copy',
      },
      {
        id: 'entity:page.tighten',
        label: 'Tighten the whole page',
        prompt: 'Rewrite the page to be more concise and scannable without losing key meaning. Prefer short paragraphs and clear headings.',
        weight: 60,
        group: 'copy',
      },
      {
        id: 'entity:page.add-cta',
        label: 'Add a closing CTA',
        prompt: 'Append a prominent call-to-action section near the bottom of the page with a heading, a short lede, and a button.',
        weight: 55,
        group: 'structure',
      },
      {
        id: 'entity:page.seo',
        label: 'Improve SEO',
        prompt: 'Improve the page for SEO: tighten the H1, add useful H2s, and rewrite the opening paragraph with the primary topic in the first sentence.',
        weight: 52,
        group: 'copy',
      },
    );
  }

  // Template does NOT render post-content → editing the .md body is a
  // phantom write. Point the user at the render sources.
  if (kind === 'page' && ctx.rendersPostContent === false) {
    const sources = Array.isArray(entity?.renderSources) ? entity.renderSources : [];
    if (sources.length > 0) {
      out.push({
        id: 'entity:page.edit-template',
        label: 'Edit the template for this page',
        prompt: `This page's template does not include wp:post-content, so the visible markup lives in: ${sources.join(', ')}. Help me modify the relevant template/pattern file.`,
        weight: 60,
        group: 'structure',
      });
    }
  }

  // Collection items (e.g. blog posts) always render their own content.
  if (kind === 'collection-item' || kind === 'post') {
    out.push(
      {
        id: 'entity:post.rewrite-voice',
        label: 'Rewrite in a warmer voice',
        prompt: 'Rewrite the body of this post in a warmer, more conversational voice while keeping all facts and structure.',
        weight: 58,
        group: 'copy',
      },
      {
        id: 'entity:post.tldr',
        label: 'Add a TL;DR up top',
        prompt: 'Add a brief TL;DR (three bullets) near the top of this post, before the first H2.',
        weight: 54,
        group: 'structure',
      },
      {
        id: 'entity:post.proofread',
        label: 'Proofread this post',
        prompt: 'Proofread this post. Fix typos, grammar, and awkward phrasing. Keep voice, links, and formatting.',
        weight: 56,
        group: 'copy',
      },
    );
  }

  // Media editor → content-free view, suggest organizational ops.
  if (view === 'media-editor' || kind === 'media-item') {
    out.push(
      {
        id: 'entity:media.alt',
        label: 'Suggest alt text',
        prompt: 'Suggest descriptive alt text for this media item based on what it depicts. Keep it under 125 characters.',
        weight: 60,
        group: 'copy',
      },
      {
        id: 'entity:media.caption',
        label: 'Draft a caption',
        prompt: 'Write a short, engaging caption for this media item suitable for inline use on a page.',
        weight: 55,
        group: 'copy',
      },
    );
  }

  return out;
}
