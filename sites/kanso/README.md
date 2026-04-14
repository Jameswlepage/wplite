# Kanso Example

This is the more editorial example site in `wplite`.

It is useful for two reasons:

- it shows a more expressive block-theme frontend than `sites/portfolio`
- it exposes some of the current compiler gaps around native WordPress theme data access

It demonstrates:

- a more opinionated block theme
- collection-backed project, team, testimonial, and journal content
- route-backed page shells with `page.sync` disabled
- custom public runtime blocks
- a styled `/app` editing experience
- the current boundary between page content editing and true template editing

## Structure

- `app/`  
  Site schema, models, routes, menus, and singleton definitions.
- `content/`  
  Markdown content for projects/testimonials and JSON for singletons.
- `theme/`  
  Block theme templates, parts, patterns, `theme.json`, and custom CSS.
- `blocks/`  
  Public runtime blocks like the contact form and project/team presentation blocks.
- `admin/`  
  Optional admin overrides for views/forms.

## Important Contract Notes

- `app/site.json` has `content.collections.page.sync = false`, so this site is not the example for `content/pages/*.md`.
- Routes still define page identity, slugs, and template assignment.
- The desired frontend contract is still native WordPress theming: templates, patterns, parts, menus, and native post blocks where possible.

This site also still contains some historical artifacts from earlier iterations:

- some theme templates and parts hardcode values that already exist in modeled content or singletons
- some site-local dashboard blocks exist even though that logic should move toward compiler-owned `/app` behavior

Treat those as migration debt, not as the preferred pattern for new sites.

## Commands

Run from `sites/kanso`:

```bash
npm run build
npm run apply
npm run dev
npm run pull
```

## What To Look At

- `app/routes/*.json` for page structure
- `app/menus/*.json` for the navigation contract
- `app/models/*.json` and `content/projects/*.md` for modeled content
- `theme/templates/*.html` for the frontend template layer
- `theme/style.css` for the public visual system

## Editor Note

This site is the better example of the current `/app` editor boundary:

- body content edits work inside the custom Gutenberg-based editor
- simple template shells can be previewed there
- true Site Editor / template-entity behavior still needs a dedicated template route

See [`../../docs/flat-site-contract.md`](../../docs/flat-site-contract.md) for the source/runtime contract, [`../../docs/schema/README.md`](../../docs/schema/README.md) for the file-by-file source schema, and [`../../docs/editor-and-sync.md`](../../docs/editor-and-sync.md) for the current editor model.
