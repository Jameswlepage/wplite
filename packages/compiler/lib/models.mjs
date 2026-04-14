// Built-in + user-defined content model helpers.
import { pluralize, toTitleCase } from './strings.mjs';

export function getBuiltinPostModel() {
  return {
    id: 'post',
    label: 'Posts',
    singularLabel: 'Post',
    type: 'collection',
    postType: 'post',
    public: true,
    supports: ['title', 'editor', 'excerpt', 'thumbnail', 'revisions'],
    taxonomies: ['category', 'post_tag'],
    adminPath: 'posts',
    fields: {},
  };
}

export function getBuiltinPageModel() {
  return {
    id: 'page',
    label: 'Pages',
    singularLabel: 'Page',
    type: 'collection',
    postType: 'page',
    public: true,
    supports: ['title', 'editor', 'excerpt', 'thumbnail', 'revisions', 'page-attributes'],
    taxonomies: [],
    adminPath: 'pages',
    fields: {},
  };
}

export function fieldTypeForAdmin(field) {
  switch (field?.type) {
    case 'integer':
      return 'integer';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'email':
      return 'email';
    case 'url':
      return 'url';
    case 'image':
      return 'image';
    case 'richtext':
      return 'richtext';
    case 'relation':
      return 'relation';
    case 'repeater':
      return 'repeater';
    case 'select':
      return 'select';
    default:
      return 'text';
  }
}

export function normalizeFieldDescriptor(id, field) {
  const descriptor = {
    id,
    label: field?.label ?? toTitleCase(id),
    type: fieldTypeForAdmin(field),
  };

  if (Array.isArray(field?.options)) {
    descriptor.options = field.options;
  }

  if (field?.target) {
    descriptor.target = field.target;
  }

  if (field?.item) {
    descriptor.item = field.item;
  }

  if (field?.inheritsFrom) {
    descriptor.inheritsFrom = field.inheritsFrom;
  }

  if (field?.help) {
    descriptor.help = field.help;
  }

  if (field?.placeholder) {
    descriptor.placeholder = field.placeholder;
  }

  if (field?.hidden) {
    descriptor.hidden = true;
  }

  return descriptor;
}

export function buildModelAdminFields(model) {
  const fields = [
    { id: 'title', label: 'Title', type: 'text' },
    { id: 'excerpt', label: 'Excerpt', type: 'text' },
    { id: 'modified', label: 'Updated', type: 'datetime' },
  ];

  for (const [fieldId, field] of Object.entries(model.fields ?? {})) {
    fields.push(normalizeFieldDescriptor(fieldId, field));
  }

  for (const taxonomy of model.taxonomies ?? []) {
    fields.push({
      id: taxonomy,
      label: toTitleCase(taxonomy),
      type: 'array',
    });
  }

  return fields;
}

export function buildCollectionViewSchema(model, override) {
  const fields = buildModelAdminFields(model);
  const columns =
    override?.columns ??
    ['title', ...fields.map((field) => field.id).filter((id) => id !== 'title').slice(0, 4)];
  const filters =
    override?.filters ??
    fields
      .filter((field) => ['boolean', 'select', 'integer', 'array'].includes(field.type))
      .map((field) => field.id);

  return {
    entity: {
      kind: 'postType',
      name: model.postType,
    },
    fields,
    view: {
      type: override?.defaultLayout ?? 'table',
      columns,
      filters,
      sort: override?.defaultSort ?? {
        field: 'modified',
        direction: 'desc',
      },
    },
  };
}

export function buildCollectionFormSchema(model, override) {
  const systemFields = [
    { id: 'title', label: 'Title', type: 'text' },
    { id: 'excerpt', label: 'Excerpt', type: 'text' },
    { id: 'content', label: 'Content', type: 'richtext' },
  ];
  const fields = [
    ...systemFields,
    ...buildModelAdminFields(model).filter(
      (field) => !['title', 'excerpt', 'modified'].includes(field.id)
    ),
  ];
  const fieldMap = Object.fromEntries(fields.map((f) => [f.id, f]));
  const defaultGroups = [];
  const remaining = fields.map((field) => field.id);

  while (remaining.length > 0) {
    const chunk = remaining.splice(0, 4);
    const groupLabel = remaining.length === 0 && defaultGroups.length === 0
      ? toTitleCase(model.id)
      : chunk.map((id) => fieldMap[id]?.label ?? toTitleCase(id)).slice(0, 2).join(' & ');
    defaultGroups.push({
      id: `section-${defaultGroups.length + 1}`,
      label: groupLabel,
      children: chunk,
    });
  }

  return {
    entity: {
      kind: 'postType',
      name: model.postType,
    },
    fields,
    form: override?.layout ?? {
      type: 'card',
      children: defaultGroups,
    },
  };
}

export function buildSingletonFormSchema(singleton, override) {
  const fields = Object.entries(singleton.fields ?? {}).map(([fieldId, field]) =>
    normalizeFieldDescriptor(fieldId, field)
  );
  const fieldMap = Object.fromEntries(fields.map((f) => [f.id, f]));
  const groups = [];
  const remaining = fields.map((field) => field.id);

  while (remaining.length > 0) {
    const chunk = remaining.splice(0, 4);
    const groupLabel = remaining.length === 0 && groups.length === 0
      ? (singleton.label ?? toTitleCase(singleton.id))
      : chunk.map((id) => fieldMap[id]?.label ?? toTitleCase(id)).slice(0, 2).join(' & ');
    groups.push({
      id: `section-${groups.length + 1}`,
      label: groupLabel,
      children: chunk,
    });
  }

  return {
    entity: {
      kind: 'singleton',
      name: singleton.id,
    },
    fields,
    form: override?.layout ?? {
      type: 'card',
      children: groups,
    },
  };
}

