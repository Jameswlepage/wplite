# Content Files

Content files are the authored data layer under `content/`.

## Collection Content

Collection entries live in `content/<plural-model-id>/*.md`.

### Example

```md
---
model: project
sourceId: project.acme-rebrand
slug: acme-rebrand
title: Acme Rebrand Platform
excerpt: A modular marketing platform and design system for a global rebrand launch.
status: publish
fields:
  client_name: Acme
  year: 2026
  featured: true
terms:
  project_type:
    - Identity
    - Product
---
Acme needed a modern publishing and campaign system that could support a global rebrand across multiple teams.

## Challenge

Describe the problem.
```

### Frontmatter Keys

- `model`
  Model id from `app/models/*.json`.
- `sourceId`
  Stable source identifier used for push/pull matching.
- `slug`
  Public slug.
- `title`
  Entry title.
- `excerpt`
  Optional excerpt.
- `status`
  Post status.
- `fields`
  Structured field payload matching the model schema.
- `terms`
  Taxonomy terms keyed by taxonomy slug.

The markdown body is converted to native Gutenberg block markup during build and seed.

## Page Content

Page entries live in `content/pages/*.md`, but only when `content.collections.page.sync` is enabled.

### Example

```md
---
model: page
routeId: about
sourceId: page.about
---

We design stillness into built space.
```

### Page Frontmatter Keys

- `model`
  Use `page`.
- `routeId`
  Preferred when the page corresponds to a route.
- `sourceId`
  Stable source identifier.
- `slug`
  Optional for loose pages not tied to routes.
- `title`
  Optional for loose pages not tied to routes.
- `excerpt`
  Optional excerpt.
- `status`
  Optional page status.
- `template`
  Optional page template override.

## Singleton Seed Files

Singleton seed files live in `content/singletons/*.json`.

Use the shape:

```json
{
  "singleton": "profile",
  "data": {
    "full_name": "Jane Doe"
  }
}
```

## Static Media Registry

Optional static media can live in `content/media/`.

Current examples use:

- binary files such as `hero.jpg`
- sidecar metadata files such as `hero.json`
- a `manifest.json` documenting the folder

### Sidecar Example

```json
{
  "id": "hero",
  "file": "hero.jpg",
  "alt": "Minimal architectural interior — homepage hero",
  "credit": { "source": "Unsplash" },
  "focalPoint": { "x": 0.5, "y": 0.5 },
  "tags": ["architecture", "hero", "minimal"]
}
```

The compiler copies this media into the generated theme asset directory.

## Guidance

- Keep structured facts in frontmatter and model fields.
- Keep long-form editorial copy in the markdown body.
- Keep `sourceId` stable once published so pull can match entries cleanly.
- Do not create `content/pages/*.md` unless the site actually enables page sync.
