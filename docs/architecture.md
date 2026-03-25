# Architecture

## System Shape

`wplite` has four layers:

1. Source layer  
   The flat site definition in `app/`, `content/`, `theme/`, `blocks/`, and `admin/`.
2. Compiler layer  
   The `wp-light` CLI and compiler in [`packages/compiler`](../packages/compiler).
3. WordPress runtime layer  
   The generated plugin and generated theme inside each site's `generated/` directory.
4. App/runtime UI layer  
   The custom `/app` admin that renders DataViews, DataForm, and Gutenberg-based editing.

## Source Of Truth

The source tree is the authored layer.

For a site like `sites/kanso` or `sites/portfolio`, the intended source of truth is:

- `app/` for schema and structure
- `content/` for synced content
- `theme/` for frontend presentation
- `blocks/` for dynamic blocks
- `admin/` for admin overrides

Generated files are outputs.

## Compiler Responsibilities

The compiler is responsible for:

- loading and validating the site tree
- generating a stable site schema
- generating admin view/form schema
- generating the WordPress plugin/runtime
- generating the block theme output
- bundling the `/app` admin
- seeding content into WordPress
- pulling supported data back out of WordPress

Key files:

- [`packages/compiler/compile.mjs`](../packages/compiler/compile.mjs)
- [`packages/compiler/wp-light.mjs`](../packages/compiler/wp-light.mjs)
- [`packages/compiler/admin-app/src/main.jsx`](../packages/compiler/admin-app/src/main.jsx)

## WordPress Responsibilities

WordPress is still doing the hard platform work:

- users and authentication
- storage in posts, meta, terms, and options
- REST API
- block rendering
- media
- theme rendering
- revisions and editing infrastructure

The project is not trying to remove WordPress. It is trying to flatten how a site is authored and managed.

## `/app` Responsibilities

The custom app at `/app` owns the visible management experience.

It handles:

- dashboard and workspace shell
- collections via DataViews
- settings via DataForm
- media selection/upload inside the app
- page and entry editing using Gutenberg primitives
- app-specific navigation and persistent surfaces

It does not rely on classic `wp-admin` for the primary workflow.

## Frontend Responsibilities

The public site is still a WordPress block theme.

That means:

- `theme.json` still matters
- templates and patterns are native block theme files
- custom CSS lives with the theme
- dynamic blocks still render in PHP when appropriate

This is important because the frontend should stay close to normal WordPress theming, even if the authoring and admin experience become flatter and more opinionated.

## Content Model

There are three main content shapes:

### Collections

Defined in `app/models/*.json`.

They compile into:

- post types
- meta registration
- taxonomy registration
- generated DataViews config
- generated DataForm config

Content usually lives in `content/<collection>/*.md`.

### Singletons

Defined in `app/singletons/*.json`.

A singleton is a named settings surface backed by a WordPress option.

They compile into:

- generated settings forms
- runtime option storage

Seed data lives in `content/singletons/*.json`.

### Routes

Defined in `app/routes/*.json`.

Routes own:

- page shell creation
- slug
- title
- assigned template
- route identity

Page body content can be synced separately in `content/pages/*.md`.

## Why The Model Is Split

The split is deliberate:

- schema and page structure belong in code/files
- body content can round-trip with WordPress editing
- the frontend remains a real block theme
- the admin remains generated

That separation is what makes the repo AI-friendly without giving up WordPress capabilities.

## Generated Outputs

Each site emits outputs under `generated/`.

Important outputs include:

- generated admin schema
- generated plugin files
- generated theme files
- compiled site schema
- Playground state metadata

These outputs are used by `apply`, `dev`, and `pull`.

## Example Flow

1. Edit `app/models/project.json`.
2. Run `wp-light build`.
3. The compiler regenerates post type, meta, and admin schema outputs.
4. Run `wp-light apply`.
5. WordPress reloads the plugin/theme outputs and reseeds content.
6. Open `/app` to manage structured fields and body content.
7. Optionally run `wp-light pull` to sync editable WordPress content back to files.

## Important Limitation

The `/app` editor is not yet a full WordPress Site Editor replacement.

It uses Gutenberg primitives, but it is still primarily a content editor with selective template-shell preview, not a full template/entity editor.

That limitation is documented in [`editor-and-sync.md`](./editor-and-sync.md).
