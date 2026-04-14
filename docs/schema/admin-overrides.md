# Admin Overrides

`admin/*.json` files reshape generated DataViews and DataForm layouts without changing the underlying storage model.

Use them to improve the `/app` editing experience after the schema is already correct.

## Collection View Override

Path:

- `admin/<model-id>.view.json`

### Example

```json
{
  "columns": ["title", "year", "featured", "status", "modified"],
  "filters": ["featured", "status", "year", "project_type"],
  "defaultSort": {
    "field": "modified",
    "direction": "desc"
  },
  "defaultLayout": "table"
}
```

### Supported Keys

- `columns`
  Ordered field ids shown in the default view.
- `filters`
  Filterable field ids.
- `defaultSort.field`
  Field id used for initial sort.
- `defaultSort.direction`
  Usually `asc` or `desc`.
- `defaultLayout`
  Current examples use `table` or `grid`.

## Form Override

Paths:

- `admin/<model-id>.form.json`
- `admin/settings-<singleton-id>.form.json`
- `admin/<singleton-id>.form.json`

### Example

```json
{
  "layout": {
    "type": "card",
    "children": [
      {
        "id": "basics",
        "label": "Basics",
        "children": ["title", "excerpt", "year", "status"]
      },
      {
        "id": "links",
        "label": "Links",
        "children": ["client_name", "client_url"]
      }
    ]
  }
}
```

### Supported Shape

- `layout.type`
  Current examples use `card`.
- `layout.children`
  Array of sections.
- `section.id`
  Stable section id.
- `section.label`
  Section label shown in the editor.
- `section.children`
  Array of field ids to render in that section.

## Guidance

- Fix the schema before you reach for overrides.
- Use overrides to improve grouping, ordering, filters, and default layout.
- Do not use overrides to paper over a bad content model.
