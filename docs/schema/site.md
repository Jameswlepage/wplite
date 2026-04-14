# `app/site.json`

`app/site.json` is the top-level contract for a site.

It controls:

- site identity
- sync mode
- which collections round-trip to files
- which routes are the front page and posts page
- the generated theme slug
- the generated plugin slug

## Example

```json
{
  "id": "studio-site",
  "title": "Studio Name",
  "tagline": "Calm spaces, precise systems.",
  "mode": "light",
  "content": {
    "mode": "files",
    "format": "markdown",
    "pull": true,
    "push": true,
    "databaseFirst": false,
    "collections": {
      "project": { "sync": true },
      "post": { "sync": true },
      "page": { "sync": false }
    }
  },
  "frontPage": "home",
  "postsPage": "journal",
  "theme": {
    "slug": "studio-theme",
    "sourceDir": "theme"
  },
  "plugin": {
    "slug": "studio-app"
  }
}
```

## Keys

- `id`
  Stable machine id for the site.
- `title`
  Site title used for WordPress settings and admin surfaces.
- `tagline`
  Site description used for WordPress settings and admin surfaces.
- `mode`
  Current repo examples use `"light"`.
- `content.mode`
  Current repo examples use `"files"`.
- `content.format`
  Current repo examples use `"markdown"`.
- `content.pull`
  When `true`, `wp-light pull` writes supported WordPress content back into files.
- `content.push`
  When `true`, source content seeds into WordPress during build/apply/seed.
- `content.databaseFirst`
  When `true`, file push stops being authoritative even if source files still exist.
- `content.collections.<modelId>.sync`
  Controls whether that collection round-trips to files.
- `frontPage`
  Route id for the front page.
- `postsPage`
  Route id for the posts index page.
- `theme.slug`
  Generated theme slug mounted in WordPress.
- `theme.sourceDir`
  Usually `"theme"`.
- `plugin.slug`
  Generated runtime plugin slug mounted in WordPress.

## Important Notes

- `frontPage` and `postsPage` should match ids from `app/routes/*.json`.
- Page content sync is controlled by `content.collections.page.sync`.
- If page sync is `false`, do not treat `content/pages/*.md` as part of the site contract.
- If you are creating a clean new site, prefer `page.sync = false` unless you explicitly want page bodies authored in markdown.
- Native WordPress site settings like homepage display, posts-per-page, timezone, and default discussion state live in `/app/settings/site`, not in `app/site.json`.
- Default comment behavior is a native WordPress discussion setting. In `wplite`, comments should be treated as off by default unless the site explicitly enables them in Site Settings.

## AI Guidance

When generating a new site:

1. Pick a stable `id`, `theme.slug`, and `plugin.slug`.
2. Decide collection sync explicitly instead of inheriting it from another example.
3. Enable page sync only if the site genuinely wants editable page bodies in `content/pages/*.md`.
