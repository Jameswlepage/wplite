# wplite

`wplite` is a lightweight, flat-file authoring layer for modern WordPress. It lets you define an entire site in versioned files and compile it into a fully functional WordPress installation — without giving up any of the platform benefits that make WordPress worth using.

Everything lives in code. WordPress stays as the runtime.

<img width="3024" height="1728" alt="CleanShot 2026-04-16 at 14 57 57@2x" src="https://github.com/user-attachments/assets/98442faa-408c-4b04-bc1e-8300d74d7b13" />

---

## The Problem This Solves

A normal WordPress site splits its state across two places: the filesystem and the database. Templates and theme files live in code. Content, settings, menus, post types, options, and page structures live in the database. This split works fine when a human manages the site through `wp-admin`, but it creates real friction when you want to:

- **Version the full site in Git.** A git diff of a WordPress repo tells you almost nothing about what changed. The real state is in the database you can't commit.
- **Run an agent over the site.** A language model can read files. It cannot natively read a MySQL database, and asking it to issue WP-CLI or REST calls to navigate a site's structure is slow, error-prone, and context-expensive.
- **Treat the site as code.** Staging-to-production workflows, code review, and reproducible deploys all assume the authoritative state is in files. A database-first site breaks all of that.

`wplite` resolves this by making files the single authoritative source of truth, and compiling them into a real WordPress instance on demand.

---

## How It Works

A `wplite` site is a directory of plain files:

```text
my-site/
  app/         ← schema: models, routes, menus, singletons
  content/     ← posts, pages, singleton data (markdown + JSON/YAML)
  theme/       ← native WordPress block theme
  blocks/      ← custom runtime blocks (only when core blocks aren't enough)
  admin/       ← optional admin view/form overrides
```

The compiler (`wp-lite`) turns that tree into:

- a generated WordPress plugin (post types, meta, taxonomies, options, REST, seeded content)
- a generated block theme mount
- a generated `/app` admin shell (DataViews, DataForm, Gutenberg-backed content editor)

Run `wp-lite apply` and you get a live, working WordPress site — menus, post types, content, theme, and all. The site runs real WordPress. It serves a real block theme. It uses WordPress's block renderer, REST API, media handling, authentication, and cache layer. Nothing is faked or reimplemented.

When you edit a source file and save, the file watcher (`wp-lite dev`) rebuilds and reseeds the running instance automatically.

When you edit content through the `/app` admin, running `wp-lite pull` syncs supported WordPress state back into your source files, closing the round-trip.

---

## The Flat Layer

The "flat layer" is the idea that a WordPress site can be fully represented in files without losing any WordPress capabilities.

This is different from static-site generators. `wplite` does not produce a flat HTML export. It compiles a real WordPress install from a flat source tree. You get:

- WordPress's block renderer
- WordPress's database-backed storage, queries, and pagination
- WordPress's REST API and editing infrastructure
- WordPress's media handling and CDN/cache compatibility
- WordPress's authentication and user model
- Revisions, taxonomies, and native admin fallbacks when needed

The flat layer is just the authoring layer. The source files are the canonical definition of what the site is. The generated WordPress install is the runtime expression of that definition.

What this means in practice:

- **Git is the version control for your WordPress site.** A `git diff` shows what changed. A `git blame` shows when and why. Rollbacks are file restores, not database snapshots.
- **Agents can operate on the full site context.** All of the site's schema, structure, routes, content, and presentation are readable as files. An AI assistant embedded in the admin can pull the entire site definition into context, understand the structure, and make targeted file edits that compile forward into live changes.
- **Agent edits appear live in the browser.** When `wp-lite dev` is running, any file save — whether by a human or an agent — triggers an automatic recompile, reseed, and browser refresh. An agent editing a content file or theme pattern produces a visible result in the editor immediately, with no manual build step. Human and agent can collaborate on the same site in real time.
- **The site is reviewable and diffable.** PRs for content updates, schema changes, and layout edits look like any other code change.

---

## When To Use `wplite`

`wplite` is a good fit for:

- Marketing sites, editorial sites, portfolios, and other sites where the team authors content and manages structure — but the content volume is bounded
- Sites where you want full Git-based version control of site state
- Projects that benefit from AI-assisted authoring or automated content workflows
- WordPress sites that want a generated, opinionated admin experience instead of a lightly customized `wp-admin`
- Teams who want to graduate to full WordPress later without throwing away their work

---

## When Not To Use `wplite`

`wplite` is deliberately scoped. It does not work well for:

- **High-volume sites.** If your site has tens of thousands of posts generated dynamically from user activity, an external feed, or a database that outgrows file-based seeding, `wplite` is not the right fit. The flat model assumes the source of truth is files. Sites that write to WordPress programmatically at scale invert that assumption.
- **Plugin-heavy sites.** `wplite` does not have a first-class plugin system. If a site's functionality depends on WooCommerce, a contact form plugin, an LMS, or a membership system, those plugins operate outside the flat layer entirely. `wplite` cannot model, manage, or version them through its source files. The site would still work, but the benefits of the flat layer would be partial at best.
- **Sites that want `wp-admin` as the primary experience.** `wplite` replaces `wp-admin` with a generated `/app`. If users expect classic `wp-admin` workflows, this is wrong tool.

`wplite` does have limited plugin-like capability through:

- custom runtime blocks in `blocks/` (fully modeled, versioned, compiler-managed)
- singleton schemas in `app/singletons/` (compiled into named options surfaces in `/app`)
- dynamic data bindings and WordPress Interactivity API integrations
- compiler-provided REST and block bridges for exposing modeled data to native theme constructs

But these are extensions of the flat model, not a full plugin ecosystem. They work within the constraints of the source-first approach.

---

## Graduation to Full WordPress

`wplite` is not trying to be a permanent alternative to WordPress. It is a lighter entry point into modern WordPress, with a clear graduation path.

Because `wplite` compiles to a real WordPress install — real plugin, real theme, real database, real content — the exit is always available. The generated output is ordinary WordPress. If a site outgrows the flat layer (volume, plugins, editorial team size, workflow complexity), you can:

1. Run `wp-lite eject` to mark the site as graduating
2. Take the generated WordPress install as your new baseline
3. Continue developing it as a conventional WordPress site

The block theme, registered post types, meta, taxonomies, menus, and seeded content all carry over cleanly. Nothing in the generated output is tied to `wplite`.

Going the other direction — taking a conventional WordPress site back into `wplite` — is possible but constrained. The flat model requires that the site's state fits into the source file schema. Arbitrary database content, plugin-managed state, and hand-edited `wp-admin` configuration may not have clean file representations. Migration is feasible for sites that stayed close to the `wplite` contract; it is impractical for sites that diverged significantly.

---

## What `wplite` Is Not Doing

It is worth being explicit about what this project is not:

- **Not replacing WordPress.** WordPress handles auth, storage, REST, block rendering, media, caching, and CDN integration. `wplite` does not reimplement any of that. It sits in front of WordPress as an authoring and management layer.
- **Not a headless approach.** The public frontend is a real WordPress block theme. `theme.json`, templates, patterns, and template parts are native block theme files.
- **Not a static site generator.** The output is a live WordPress install, not HTML files.
- **Not an opinionated page builder.** Layout and presentation live in the block theme. `wplite` does not impose a visual design system.

---

## Repo Layout

```text
wplite/
  packages/
    compiler/
      admin-app/        ← the /app React admin UI
      compile.mjs       ← site compiler
      wp-lite.mjs       ← CLI entry point
      lib/              ← compiler utilities
  sites/
    kanso/              ← editorial design studio example
    elsewhere/
    field-notes/
  docs/
    architecture.md
    flat-site-contract.md
    editor-and-sync.md
    schema/
```

- [`packages/compiler`](./packages/compiler) — the `wp-lite` CLI, compiler, generated runtime bridge, and custom `/app` admin
- [`sites/kanso`](./sites/kanso) — editorial design-studio example; also exposes current compiler gaps around native WordPress theme data access
- [`docs/architecture.md`](./docs/architecture.md) — full system model
- [`docs/flat-site-contract.md`](./docs/flat-site-contract.md) — what belongs in source vs. compiler vs. WordPress; the intended site contract
- [`docs/schema/`](./docs/schema) — file-by-file source schema reference with an AI-ready scaffolding prompt
- [`docs/editor-and-sync.md`](./docs/editor-and-sync.md) — `/app` editor, Gutenberg, templates, and push/pull flow

---

## Quick Start

```bash
npm install
npm run apply:kanso
```

That compiles the kanso site, boots a local WordPress Playground instance, activates the generated plugin/theme, and seeds content.

Local URLs:

- public site: `http://127.0.0.1:9400/`
- app shell: `http://127.0.0.1:9400/app/`

---

## Common Commands

From a site directory (e.g. `sites/kanso`):

```bash
npm run build    # compile source files into generated WordPress outputs
npm run apply    # build, boot WP instance, sync plugin/theme, seed content
npm run dev      # watch source + compiler changes, rebuild, reseed, refresh
npm run pull     # sync supported WordPress state back into source files
```

Or from the repo root:

```bash
npm run build:kanso
npm run apply:kanso
npm run dev:kanso
npm run pull:kanso
```

---

## `wp-lite` CLI Reference

```bash
wp-lite init    # scaffold a contract-valid site source tree (--brief <file.json> --json)
wp-lite build   # compile source files into generated WordPress outputs
wp-lite apply   # build, boot WP instance, sync plugin/theme, seed content
wp-lite seed    # reseed content without a full build/apply cycle
wp-lite dev     # watch + rebuild + reseed + browser refresh
wp-lite pull    # pull supported WordPress state back into markdown and JSON
wp-lite verify  # run strict contract checks for agent safety and consistency
wp-lite eject   # mark a site as graduating away from the flat layer
```

All commands accept `--json` for structured stdout output, suitable for agent and CI workflows.

---

## Authoring Model

Each site follows the same source structure:

- **`app/site.json`** — site-level contract: mode, slugs, front page, posts page, content sync flags
- **`app/models/*.json`** — collection definitions: compile into post types, meta, taxonomies, DataViews/DataForm config
- **`app/singletons/*.json`** — named settings surfaces backed by WordPress options
- **`app/routes/*.json`** — page structure: slug, title, template assignment, route identity
- **`app/menus/*.json`** — declarative navigation that compiles into native WordPress menus
- **`content/**/*.md`** — markdown content that compiles into Gutenberg block markup
- **`content/singletons/*.json`** — singleton seed data
- **`theme/`** — native block theme: templates, template parts, patterns, `theme.json`, CSS
- **`blocks/`** — public runtime blocks for data or interactions core blocks cannot express
- **`admin/*.json`** — optional DataViews/DataForm overrides

The full file contract is documented in [`docs/flat-site-contract.md`](./docs/flat-site-contract.md).

---

## The `/app` Admin

The generated admin is a React app at `/app`, compiled from the site's source schema.

It provides:

- DataViews-driven collection management
- DataForm-driven structured field editing
- a Gutenberg-backed content editor for pages and post types
- a global `Cmd/Ctrl + K` command bar spanning routes, indexed records, and live WordPress entities
- in-app settings, media, users, and workspace surfaces

It does not rely on classic `wp-admin` for the primary authoring workflow.

Current boundary: the `/app` editor handles content editing and template-shell preview for editor-backed content. It does not yet provide full `wp_template` / `wp_template_part` entity editing or query-loop template-context editing. That boundary is documented in [`docs/editor-and-sync.md`](./docs/editor-and-sync.md).

---

## Agentic Workflow

`wplite` is designed to work well with AI-assisted authoring. Because the full site definition — schema, routes, content, theme, blocks — lives in files, an agent or language model can:

- read the entire site structure without querying a database
- make targeted edits to source files
- verify the results by reading back those same files
- run `wp-lite verify --json` to confirm contract integrity

For deterministic agent loops:

```bash
wp-lite init --brief brief.json --json
wp-lite apply --json
wp-lite verify --json
wp-lite pull --json   # if runtime edits should be written back to files
```

Scaffolded sites include an `AGENTS.md` with local project rules and the expected compile/sync workflow.

---

## Status

Working prototype. Not a stabilized public package.

The important pieces are real and working:

- file-defined sites with schema-driven post types, meta, and taxonomies
- compiler-generated WordPress runtime, theme, and admin schema
- local apply/dev/pull loop
- custom `/app` admin with DataViews, DataForm, and Gutenberg editing
- bidirectional push/pull content flow between files and WordPress

Main unfinished areas: full Site Editor parity inside `/app`, and a stronger compiler-owned bridge for exposing modeled site data to native WordPress theme files without site-local duplication.
