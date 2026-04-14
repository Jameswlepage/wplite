# Collection Models

Collection models live in `app/models/*.json`.

They compile into:

- WordPress post types
- meta registration
- taxonomy registration
- generated collection list schemas
- generated collection form schemas
- editor templates for editor-backed content

## Example

```json
{
  "id": "project",
  "label": "Projects",
  "icon": "Portfolio",
  "type": "collection",
  "postType": "project",
  "archiveSlug": "work",
  "public": true,
  "supports": ["title", "editor", "excerpt", "thumbnail", "revisions"],
  "taxonomies": ["project_type"],
  "fields": {
    "location": { "type": "text", "label": "Location" },
    "year": { "type": "integer", "label": "Year" },
    "featured": { "type": "boolean", "label": "Featured" },
    "status": {
      "type": "select",
      "label": "Status",
      "options": ["completed", "in-progress", "concept"]
    }
  },
  "editorTemplate": [
    ["core/paragraph", { "placeholder": "Project summary" }],
    ["core/image", {}],
    ["core/heading", { "content": "Approach", "level": 2 }],
    ["core/paragraph", { "placeholder": "How the work was done." }]
  ],
  "templateLock": "insert"
}
```

## Core Keys

- `id`
  Stable model id used across source files and menus.
- `label`
  Plural label for the admin UI.
- `icon`
  WordPress-style icon token used by the app UI.
- `type`
  Use `"collection"`.
- `postType`
  WordPress post type slug.
- `archiveSlug`
  Public archive path used for archive menu items and theme routing.
- `public`
  Whether the post type is publicly queryable.
- `supports`
  WordPress supports flags such as `title`, `editor`, `excerpt`, `thumbnail`, `revisions`, and `page-attributes`.
- `taxonomies`
  Array of taxonomy slugs to register on the model.
- `fields`
  Object of structured fields keyed by field id.
- `editorTemplate`
  Optional Gutenberg block template for new entries.
- `templateLock`
  Optional Gutenberg template lock value.
- `adminPath`
  Optional custom collection path in `/app`. Usually only needed for built-in entities.

## Supported Field Types

The current compiler/admin layer recognizes these field types:

- `text`
- `integer`
- `boolean`
- `email`
- `url`
- `image`
- `richtext`
- `select`
- `relation`
- `repeater`

### Field-Specific Options

- `label`
  Human-friendly field label.
- `help`
  Helper text shown in the generated editor.
- `placeholder`
  Placeholder text for compatible controls.
- `hidden`
  Hide the field from generated admin schemas.
- `options`
  Required for `select`.
- `target`
  Required for `relation`; points to another model id.
- `item`
  Required for `repeater`; defines a flat object shape for each row.

## How Fields Map To WordPress

- non-repeater fields register as post meta with `show_in_rest: true`
- taxonomies become term arrays in the generated admin schema
- relation fields store references to another collection and resolve through that model's ids or source ids
- repeater fields store structured arrays

## Guidance

- Use fields for structured data the theme or filters need.
- Keep long-form narrative content in the markdown body, not in richtext fields, unless it is truly short settings-like copy.
- Prefer simple flat field sets over deeply nested structures.
- If the theme needs the value, model it here instead of hardcoding it in `theme/`.
