# wp-light Test Site

This site is intentionally flatter than a normal WordPress project.

## Source Layer

- `app/site.json`
  Global site contract. This is where front page, posts page, content sync mode, theme slug, and plugin slug live.
- `app/models/*.json`
  Collection schemas. These compile into post types, meta registration, taxonomies, DataViews configs, and DataForm configs.
- `app/singletons/*.json`
  Settings schemas. A singleton is just a named settings surface backed by an option.
- `app/routes/*.json`
  Page shells and template assignment. Routes are site structure, not long-form content.
- `app/menus/*.json`
  Declarative navigation.
- `content/<collection>/*.md`
  Markdown-first content with front matter. These sync into WordPress posts.
- `content/singletons/*.json`
  Seeded singleton/settings data.
- `theme/`
  Block theme files that render the public site.
- `blocks/`
  Dynamic blocks for places where the frontend needs runtime data.
- `admin/*.json`
  Optional overrides for generated list/form behavior.

## Mental Model

- DataViews manages collections.
- DataForm manages structured fields and settings.
- Gutenberg manages long-form body content.
- The block theme renders the frontend.

The generated admin is not wp-admin customization. It is a separate app at `/app` that uses WordPress for auth, storage, REST, block editing, and rendering.

## Content Modes

The content behavior is controlled in [`app/site.json`](/Users/jameslepage/Projects/wplite/testsite/app/site.json):

- `content.push`
  When `true`, file content seeds into WordPress.
- `content.pull`
  When `true`, `npx wp-light pull` writes content back into markdown and singleton data files.
- `content.databaseFirst`
  When `true`, file content stops pushing into WordPress, so the site can move toward database-first editing.
- `content.collections.<id>.sync`
  Per-collection switch. Pages are currently off because page layout is expected to stay theme-coded.

## Commands

- `npx wp-light build`
  Compile the site, generate the plugin/theme/admin schema, and bundle the `/app` admin.
- `npx wp-light apply`
  Build everything, start `wp-env`, and seed the site.
- `npx wp-light pull`
  Pull synced WordPress content back into markdown and singleton JSON.
- `npx wp-light dev`
  Start the local environment and seed the site.
- `npx wp-light eject`
  Record that the project has graduated out of the light layer.
