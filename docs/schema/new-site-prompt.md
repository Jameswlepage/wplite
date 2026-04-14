# AI Prompt Template For New Sites

Use this prompt when you want an AI to scaffold a new `wplite` site without inheriting the wrong patterns from older examples.

## Prompt

```text
Create a new wplite site in sites/<site-name>/.

Follow docs/flat-site-contract.md and everything in docs/schema/.

Requirements:
- Keep the public frontend a native WordPress block theme.
- Model content once in app/ and content/.
- Do not duplicate modeled content in templates.
- Use app/menus/*.json plus real wp:navigation blocks for navigation.
- Use custom blocks only for public runtime behavior that core blocks cannot express cleanly.
- Do not create site-local dashboard/admin widgets.
- Only create content/pages/*.md if app/site.json enables content.collections.page.sync.

Deliver:
- app/site.json
- app/models/*.json
- app/singletons/*.json
- app/routes/*.json
- app/menus/*.json
- content/ seeds for collections and singletons
- theme/theme.json
- theme/templates/*.html
- theme/patterns/*.html
- theme/parts/*.html
- theme/style.css
- blocks/ only when necessary
- admin/*.json only when needed for editor layout refinement

Site brief:
- Site title:
- Tagline:
- Visual direction:
- Collections to model:
- Singletons needed:
- Routes needed:
- Menus needed:
- Whether page body sync should be on or off:
- Whether blog posts are enabled:
- Any public interactive blocks needed:

Implementation rules:
- Prefer core/post-* blocks and post-meta bindings for collection templates.
- Prefer patterns and template parts over hardcoded repeated markup.
- Keep theme copy and contact data in content/singletons when it is editable content.
- If the compiler does not expose a clean native bridge for some site data, flag that gap instead of inventing extra site-local complexity.
```

## Checklist For Reviewing AI Output

1. Does `app/site.json` make page sync explicit?
2. Are `frontPage` and `postsPage` valid route ids?
3. Are collection fields structured, minimal, and actually used by the theme?
4. Are menus defined in `app/menus/` and rendered through `wp:navigation`?
5. Does the theme rely on native WordPress blocks before custom blocks?
6. Is `blocks/` limited to real public runtime needs?
7. Is editable site copy modeled in singletons instead of duplicated in templates?
8. Did the AI avoid site-local dashboard/admin runtime code?
