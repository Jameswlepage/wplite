# Portfolio Example

This is the simpler reference site inside `wplite`.

It demonstrates:

- flat site schema in `app/`
- markdown-first content in `content/`
- a generated `/app` admin
- a WordPress block theme frontend
- push/pull flow between files and WordPress
- a sync-enabled page model that uses `content/pages/*.md`

## Structure

- `app/site.json`  
  Site contract, front page, posts page, slugs, and content sync behavior.
- `app/models/*.json`  
  Collections like projects, testimonials, experiences, and inquiries.
- `app/singletons/*.json`  
  Settings surfaces like profile, contact, and SEO.
- `app/routes/*.json`  
  Route-backed pages and template assignment.
- `content/pages/*.md`  
  Page body content that round-trips with the page editor because this site has `content.collections.page.sync = true`.
- `content/<collection>/*.md`  
  Collection content that compiles into native Gutenberg block markup.
- `theme/`  
  Block theme files for the frontend.
- `blocks/`  
  Dynamic blocks for frontend/runtime data.
- `admin/*.json`  
  Optional DataViews/DataForm overrides.

## Mental Model

- DataViews manages collection lists.
- DataForm manages structured fields and settings.
- Gutenberg manages long-form body content.
- The block theme renders the frontend.

The admin at `/app` is not `wp-admin` customization. It is a separate runtime app that uses WordPress as the backend.

## Commands

Run from `sites/portfolio`:

```bash
npm run build
npm run apply
npm run dev
npm run pull
```

## Content Sync

The main content controls live in `app/site.json`:

- `content.push`  
  When `true`, file content seeds into WordPress.
- `content.pull`  
  When `true`, `wp-light pull` writes supported content back into markdown and singleton data.
- `content.databaseFirst`  
  When `true`, content stops pushing from files and the site can shift toward database-first editing.

## Notes

This example is intentionally more minimal than `sites/kanso`. It is the cleaner reference if you want to understand the current file contract before looking at the more visually opinionated example site.

Use `sites/portfolio` when you want the clearest example of the current source model.
Use `sites/kanso` when you want to inspect the more editorial theme direction and the remaining compiler/native-WordPress gaps.

For the canonical source schema, see [`../../docs/schema/README.md`](../../docs/schema/README.md).
