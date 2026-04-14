# Flat Site Contract

## Goal

`wplite` is trying to make a WordPress site fully representable in code without turning the site itself into a pile of custom runtime glue.

The intended result is:

- the authored source of truth lives in versioned files
- the public frontend remains a normal WordPress block theme
- the compiler owns the glue code needed to connect modeled data to that theme
- site source stays small, legible, and easy to diff

If a site only works because it duplicates modeled content in templates, ships site-local dashboard widgets, or adds one-off admin/runtime bridges, that is compiler debt rather than the desired site contract.

For the exact authored file shapes, use the reference in [`./schema/`](./schema).

## Source Of Truth

The source tree is the authored layer.

- `app/` defines site structure, models, routes, menus, and singleton schemas
- `content/` defines collection records, page bodies when page sync is enabled, and singleton seed data
- `theme/` defines the native block theme
- `blocks/` defines public runtime blocks only when native core blocks are not enough
- `admin/` reshapes generated forms and views without changing storage or schema

Generated output under `generated/` is build output, not authoring surface.

## Keep The Frontend Native

The public site should stay close to ordinary WordPress block theming.

That means preferring:

- `theme.json`
- templates, patterns, and template parts
- `wp:navigation` for menus
- core post blocks like `core/post-title`, `core/post-content`, `core/post-featured-image`, `core/post-terms`, and `core/post-meta`
- compiler-provided bridges that expose modeled data through native WordPress mechanisms

It does not mean re-encoding modeled content as hardcoded HTML just because the current compiler bridge is incomplete.

## What Belongs In The Compiler

The compiler and generated runtime should own:

- post type, taxonomy, meta, and singleton registration
- REST endpoints and bootstrap payloads
- `/app` admin screens and dashboard/workspace behavior
- native WordPress settings bridges so things like discussion defaults stay native instead of being remapped into site-local schema
- content push/pull and local dev workflow
- data bridges that let themes read modeled data without site-specific hacks
- compatibility shims for WordPress features that are not yet exposed cleanly in the flat source model

When a site needs a better bridge for native WordPress, the fix should land here.

## What Should Stay Out Of Sites

Avoid treating the following as normal site authoring:

- duplicated literals in templates when the same data already lives in `app/` or `content/`
- raw HTML navigation that bypasses `app/menus/*.json`
- site-local dashboard widgets, mock analytics, or admin-only blocks that exist only to fill `/app`
- site-specific runtime code that compensates for a missing compiler capability
- documentation that assumes every site uses the same sync mode

Those patterns increase surface area and make a "flat" site harder to reason about in version control.

## Page Sync Is Per Site

Page body sync is not universal.

- If `app/site.json` sets `content.collections.page.sync` to `true`, page body content can round-trip through `content/pages/*.md`.
- If it is `false`, routes still define page shells and template assignment, but the site should not pretend `content/pages/*.md` is part of the contract.

Documentation and examples need to state which mode a given site is using.

## Current Known Debt

The repo still contains some legacy artifacts from earlier iterations:

- runtime identifiers such as `portfolio_light_*`, `PORTFOLIO_LIGHT`, and `/wp-json/portfolio/v1/*`
- example-site dashboard blocks using `category: "dashboard"`
- Kanso templates and parts that hardcode content already modeled elsewhere in the site tree
- docs that historically described page-body sync as if it applied to every site

These are transitional artifacts, not the desired long-term contract.

## Audit Checklist

Use this when reviewing a site:

1. Is every piece of modeled content defined exactly once?
2. Does the theme consume menus through `app/menus/*.json` and native navigation blocks?
3. Does the theme use native post blocks and post-meta bindings before introducing custom site logic?
4. Is `blocks/` limited to genuinely public runtime behavior?
5. Are admin/dashboard features living in the compiler and `/app`, or drifting into the site?
6. Does the site documentation match its actual sync mode and data flow?
7. Are legacy artifacts documented as debt instead of presented as the preferred pattern?

## Example Sites

- `sites/portfolio` is the cleaner reference for the current file contract and a sync-enabled page model.
- `sites/kanso` is the better reference for an editorial block theme and for identifying where the compiler still needs a stronger native WordPress bridge.
