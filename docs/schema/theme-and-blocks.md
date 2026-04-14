# Theme And Blocks

The public frontend should remain a native WordPress block theme.

## Theme Files

Typical theme files are:

- `theme/theme.json`
- `theme/templates/*.html`
- `theme/patterns/*.html`
- `theme/parts/*.html`
- `theme/style.css`
- `theme/fonts.json` for optional font manifests

## Native Theme Contract

Prefer these patterns:

- `theme.json` for tokens and global styles
- template parts for shared header/footer structure
- patterns for reusable sections
- `wp:navigation` blocks for menus
- core post blocks such as `core/post-title`, `core/post-content`, `core/post-featured-image`, `core/post-terms`
- post-meta bindings for collection fields

### Example: Native Post-Meta Binding

```html
<!-- wp:heading {"level":6} -->
<h6>Year</h6>
<!-- /wp:heading -->
<!-- wp:paragraph {"metadata":{"bindings":{"content":{"source":"core/post-meta","args":{"key":"year"}}}}} -->
<p>Year</p>
<!-- /wp:paragraph -->
```

### Example: Navigation Placeholder

```html
<!-- wp:navigation {"layout":{"type":"flex","justifyContent":"right"}} /-->
```

The compiler replaces actual `wp:navigation` blocks in theme files with markup compiled from `app/menus/*.json`.

## `theme/fonts.json`

Optional font manifests let the compiler inject Google Fonts into the generated theme and project them into `theme.json`.

### Example

```json
{
  "source": "google",
  "families": [
    {
      "slug": "display",
      "name": "Display",
      "family": "Fraunces",
      "weights": [300, 400, 500, 600, 700, 900],
      "styles": ["normal", "italic"],
      "stack": "'EB Garamond', Georgia, serif"
    }
  ]
}
```

## Custom Blocks

Custom blocks live in `blocks/<block-name>/`.

Typical files are:

- `block.json`
- `render.php` for dynamic rendering
- `view.js` for frontend behavior when needed

### Example `block.json`

```json
{
  "apiVersion": 3,
  "name": "studio/contact-form",
  "title": "Contact Form",
  "category": "widgets",
  "icon": "email",
  "description": "A minimal contact form.",
  "supports": { "html": false },
  "render": "file:./render.php",
  "viewScript": "file:./view.js"
}
```

## Guidance

- Use blocks for public runtime behavior, not for admin-only dashboards.
- Prefer native WordPress theme primitives before inventing custom blocks.
- If data already exists in a model or singleton, do not hardcode it again in theme templates.
- If the theme needs a better bridge to modeled singleton data, that belongs in the compiler/runtime.
