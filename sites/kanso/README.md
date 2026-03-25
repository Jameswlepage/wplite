# Kanso Example

This is the more editorial example site in `wplite`.

It demonstrates:

- a more opinionated block theme
- richer page-driven content
- custom dynamic blocks
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
  Runtime blocks like the contact form and studio profile.
- `admin/`  
  Generated admin overrides for views/forms.

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
- `theme/templates/*.html` for the frontend template layer
- `content/projects/*.md` for markdown-driven content
- `theme/style.css` for the public visual system

## Editor Note

This site is the better example of the current `/app` editor boundary:

- body content edits work inside the custom Gutenberg-based editor
- simple template shells can be previewed there
- true Site Editor / template-entity behavior still needs a dedicated template route

See [`../../docs/editor-and-sync.md`](../../docs/editor-and-sync.md) for the current model.
