# Source Schema Reference

This directory is the canonical authoring reference for building a `wplite` site from files.

Use it when:

- creating a new site from scratch
- teaching an AI how to scaffold a site
- checking whether a site is pushing complexity into the wrong layer

Read this alongside [`../flat-site-contract.md`](../flat-site-contract.md), which explains the architectural boundary between site code and compiler/runtime code.

## Order Of Operations

When creating a new site, build it in this order:

1. Define `app/site.json`.
2. Define collection models in `app/models/`.
3. Define settings-like singletons in `app/singletons/`.
4. Define routes in `app/routes/` and menus in `app/menus/`.
5. Add collection content, page content where enabled, and singleton seed data under `content/`.
6. Build the public theme in `theme/`.
7. Add custom blocks in `blocks/` only if native WordPress blocks are not enough.
8. Add `admin/*.json` overrides only to reshape generated forms and views.

## Rules For Humans And AI

- Model content once. If a value exists in `app/` or `content/`, do not duplicate it in a template.
- Keep the theme native. Prefer templates, patterns, parts, `wp:navigation`, and core post blocks before inventing site-local runtime code.
- Treat `blocks/` as public runtime surface, not a place to hide admin or dashboard logic.
- Treat page-body sync as opt-in per site, not as a universal convention.
- Put missing glue into the compiler when possible instead of making site source more bespoke.

## Minimal Site Tree

```text
sites/<site-name>/
  app/
    site.json
    models/
    singletons/
    routes/
    menus/
  content/
    posts/
    <collection-plural>/
    singletons/
    pages/            # only when page sync is enabled
    media/            # optional static media registry
  theme/
    theme.json
    templates/
    patterns/
    parts/
    style.css
    fonts.json        # optional
  blocks/             # optional
  admin/              # optional
  generated/          # build output
```

## What To Read Next

- [`site.md`](./site.md) for `app/site.json`
- [`models.md`](./models.md) for collection schemas
- [`singletons.md`](./singletons.md) for option-backed site settings
- [`routes-and-menus.md`](./routes-and-menus.md) for page shells and navigation
- [`content.md`](./content.md) for markdown, singleton seeds, and media
- [`theme-and-blocks.md`](./theme-and-blocks.md) for the native WordPress frontend contract
- [`admin-overrides.md`](./admin-overrides.md) for DataViews/DataForm reshaping
- [`new-site-prompt.md`](./new-site-prompt.md) for an AI-ready site-generation prompt
