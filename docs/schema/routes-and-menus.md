# Routes And Menus

Routes live in `app/routes/*.json`.
Menus live in `app/menus/*.json`.

Routes define page identity and template assignment.
Menus define navigation in data instead of raw HTML.

## Route Example

```json
{
  "id": "about",
  "type": "page",
  "slug": "about",
  "title": "About",
  "template": "about",
  "seed": {
    "createPageShell": true,
    "status": "publish",
    "content": ""
  }
}
```

## Menu Example

```json
[
  { "label": "Work", "type": "archive", "object": "project" },
  { "label": "About", "type": "page", "object": "about" },
  { "label": "Journal", "type": "page", "object": "journal" },
  { "label": "Contact", "type": "page", "object": "contact" },
  { "label": "Instagram", "type": "url", "url": "https://instagram.com/example" }
]
```

## Route Keys

- `id`
  Stable route id used by menus and `app/site.json`.
- `type`
  Current repo examples use `"page"`.
- `slug`
  Public path. Use `""` for the home route when it is the front page.
- `title`
  Page title used during shell creation.
- `template`
  Template file name without `.html`.
- `seed.createPageShell`
  Whether the compiler should ensure the corresponding WordPress page exists.
- `seed.status`
  Initial post status for the route page.
- `seed.content`
  Seeded body content when page sync is off or when you want a route-defined starting shell.

## Menu Item Types

- `page`
  Uses `object` to point at a route id.
- `archive`
  Uses `object` to point at a model id.
- `url`
  Uses `url` directly.

## Important Behavior

- `frontPage` and `postsPage` in `app/site.json` should point at route ids.
- The compiler only rewrites navigation in theme files when those files contain actual `wp:navigation` blocks.
- If a header or footer hardcodes links in raw HTML, it bypasses `app/menus/*.json`.

## Guidance

- Define menus in `app/menus/`, not in static HTML.
- Keep route files focused on identity, slug, status, and template assignment.
- Use page-body markdown only if page sync is enabled for the site.
