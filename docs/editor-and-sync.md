# Editor And Sync Model

## The Short Version

`wplite` has two editing modes living side by side:

- structured editing for fields, settings, taxonomies, and lists
- Gutenberg-based editing for long-form block content

The `/app` shell is meant to unify those without sending the user back through classic `wp-admin`.

## What `/app` Is

The app at `/app` is a generated admin experience.

It is not just a menu customization layer over `wp-admin`.

It renders:

- DataViews for collections
- DataForm for structured data
- a Gutenberg-derived editor for body content
- workspace-level surfaces like settings, domains, integrations, and media

## What The Page And Entry Editor Actually Does

For editor-backed entities, the app uses Gutenberg block-editor primitives inside its own shell.

That means:

- the canvas is a block editor canvas
- the sidebar is app-owned but Gutenberg-informed
- the app manages save, routing, notices, and surrounding UI

## The Important Boundary

There is a real distinction between:

- editing post or page content
- editing site templates and template parts

Those are not the same thing in WordPress.

## Safe Template Preview

Some templates can be flattened into a preview shell around the editable content slot.

Examples:

- a page template with header, footer, and `post-content`
- a simple single template with `post-title`, `post-excerpt`, and `post-content`

For those cases, `/app` can show a preview shell in the editor while still saving only the real content slot.

## Incompatible Template Context

Some template blocks require real Site Editor or frontend entity context.

Examples:

- `core/query`
- `core/post-template`
- query pagination blocks
- true template part/entity editing flows

Those cannot be represented honestly inside a normal page/post editor just by flattening markup into a standalone block list.

When that context is required, the current app editor falls back to content-only editing instead of pretending to be a full Site Editor and producing invalid block recovery states.

## Why This Matters

Without that boundary, the editor shows:

- invalid block warnings
- broken navigation/query blocks
- mismatches between frontend output and backend canvas

The current implementation intentionally prefers a stable, honest content editor over a fake full Site Editor.

## Push / Pull Model

The intended flow is:

1. Write or edit source files.
2. Run `build` or `apply`.
3. WordPress gets the generated plugin, theme, schema, and seeded content.
4. Edit supported content in `/app`.
5. Run `pull` to sync eligible changes back into files.

## What Syncs Well Today

The current flow is strongest for:

- collection markdown content
- route-backed page body content
- singleton/settings JSON
- structured model fields and taxonomies

## What Still Needs A Dedicated Editor

The next real step is a dedicated template editor route inside `/app`, likely something like:

- `/app/templates/:templateId`
- `/app/template-parts/:partId`

That route would edit real `wp_template` and `wp_template_part` entities rather than simulating them inside a page/post editor.

That is the missing piece for true Site Editor parity.

## Practical Guidance

If you are authoring a site in this repo today:

- use `app/routes/*.json` for page structure and template assignment
- use `content/pages/*.md` for page body content
- use `content/<collection>/*.md` for editor-backed content
- keep template logic in `theme/templates`, `theme/parts`, and `theme/patterns`
- do not expect query-driven or entity-driven templates to behave like ordinary page content in the current `/app` editor

## Goal State

The long-term goal is still:

- flat files as the authored layer
- WordPress as the runtime platform
- `/app` as the primary admin
- Gutenberg primitives reused inside a simpler, more opinionated editing surface

The current implementation already achieves most of that for content and structured data. Full template/entity editing is the major remaining step.
