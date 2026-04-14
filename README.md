# wplite

`wplite` is a flat, schema-first authoring layer for building normal WordPress sites in code.

You define a site in files:

- `app/` for schema, routes, menus, and settings surfaces
- `content/` for markdown and singleton data
- `theme/` for the native block theme
- `blocks/` for public runtime blocks when core blocks are not enough
- `admin/` for optional admin view/form overrides

The compiler turns that into:

- a generated WordPress plugin/runtime
- a generated block theme mount
- generated admin schema for `/app`
- a local WordPress instance that can be seeded, watched, and pulled back into files

## What This Repo Contains

- [`packages/compiler`](./packages/compiler)  
  The `wp-light` CLI, compiler, generated runtime bridge, and custom `/app` admin.
- [`sites/portfolio`](./sites/portfolio)  
  A cleaner reference site focused on the core file contract, collection content, and sync-enabled page bodies.
- [`sites/kanso`](./sites/kanso)  
  A more editorial design-studio example that also exposes current compiler gaps around native WordPress theme data access.
- [`docs/architecture.md`](./docs/architecture.md)  
  The overall system model.
- [`docs/flat-site-contract.md`](./docs/flat-site-contract.md)  
  The native-WordPress contract: what belongs in a site, what belongs in the compiler, and what counts as legacy debt.
- [`docs/schema/`](./docs/schema)  
  The file-by-file source schema reference, including an AI-ready prompt for scaffolding new sites.
- [`docs/editor-and-sync.md`](./docs/editor-and-sync.md)  
  How the `/app` editor, Gutenberg, templates, and push/pull flow work today.

## Core Idea

This project is intentionally not “customize `wp-admin` a little.”

It treats WordPress as:

- auth
- storage
- REST
- block rendering
- theme rendering
- media

And it replaces the visible management layer with an opinionated app at `/app` that is generated from the file-based schema.

The key constraint is that the public frontend should still look like a normal WordPress block theme. When a site needs extra glue to expose modeled data to that theme, the preferred fix is to improve the compiler rather than to make the site source more bespoke.

## Repo Layout

```text
wplite/
  packages/
    compiler/
      admin-app/
      compile.mjs
      wp-light.mjs
  sites/
    kanso/
      app/
      content/
      theme/
      blocks/
      admin/
    portfolio/
      app/
      content/
      theme/
      blocks/
      admin/
```

## Quick Start

From the repo root:

```bash
npm install
```

Build and run an example site:

```bash
npm run apply:kanso
```

Or:

```bash
npm run apply:portfolio
```

That compiles the selected site, boots or reuses a local WordPress Playground instance, activates the generated plugin/theme, and seeds content.

## Local URLs

The compiler currently resolves a local Playground instance on `127.0.0.1` and reuses the canonical port for the selected site.

Typical URLs:

- public site: `http://127.0.0.1:9400/`
- app shell: `http://127.0.0.1:9400/app/`

## Common Commands

Run these from a site directory, for example `sites/kanso`:

```bash
npm run build
npm run apply
npm run dev
npm run pull
```

Or from the repo root:

```bash
npm run build:kanso
npm run apply:kanso
npm run dev:kanso
npm run pull:kanso
```

`wp-light` commands:

- `build`  
  Compile source files into generated WordPress outputs.
- `apply`  
  Build, boot the target WP instance, sync plugin/theme, and seed content.
- `dev`  
  Watch source and compiler changes, rebuild, reseed, and refresh the site/app.
- `pull`  
  Pull supported WordPress state back into markdown and singleton JSON.
- `eject`  
  Mark a site as graduating away from the light layer.

## Authoring Model

Each site follows the same structure:

- `app/site.json`  
  Site-level contract, mode, slugs, front page, posts page, and content sync flags.
- `app/models/*.json`  
  Collection models. These compile into post types, meta, taxonomies, and admin schemas.
- `app/singletons/*.json`  
  Settings-like entities backed by options.
- `app/routes/*.json`  
  Page structure: slug, title, template, and seeded route shells.
- `app/menus/*.json`  
  Declarative navigation.
- `content/**/*.md`  
  Markdown content that compiles into Gutenberg block markup.
- `content/singletons/*.json`  
  Singleton seed data.
- `theme/`  
  Block theme templates, template parts, patterns, `theme.json`, and CSS.
- `blocks/`  
  Public runtime blocks for data or interactions the native block set cannot express cleanly.
- `admin/*.json`  
  Optional DataViews/DataForm overrides.

The intended contract for that source tree is documented in [`docs/flat-site-contract.md`](./docs/flat-site-contract.md).

## `/app` Admin

The generated admin is a separate React app served by the WordPress runtime at `/app`.

It provides:

- DataViews-driven collection management
- DataForm-driven structured field editing
- a stripped-down Gutenberg-based content editor
- in-app settings, media, users, and workspace surfaces

Long-form content still uses Gutenberg primitives. Structured content still uses the generated forms.

## Current Boundary

The `/app` editor is intentionally not yet a full replacement for the Gutenberg Site Editor.

It handles:

- content editing for pages and editor-backed post types
- template-shell preview when the shell is safe to flatten into a standalone editor

It does not yet provide:

- true `wp_template` / `wp_template_part` entity editing
- full query-loop or template-context editing inside a dedicated site-editor route

That boundary is documented in [`docs/editor-and-sync.md`](./docs/editor-and-sync.md).

## Example Sites

- [`sites/kanso`](./sites/kanso)  
  MOMA-style interior design studio / portfolio.
- [`sites/portfolio`](./sites/portfolio)  
  A simpler portfolio/reference site for the flat authoring model.

## Status

This repo is a working prototype, not a stabilized public package release.

The important pieces are real and working:

- file-defined sites
- compiler-generated WordPress runtime/theme/admin schema
- local apply/dev/pull loop
- custom `/app` admin
- push/pull content flow between files and WordPress

The main unfinished areas are full Site Editor parity inside `/app` and a better compiler-owned bridge for exposing modeled site data to native WordPress theme files without site-local duplication.
