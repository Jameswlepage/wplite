import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import matter from 'gray-matter';
import { marked } from 'marked';

const ROOT = process.cwd();
const GENERATED_ROOT = path.join(ROOT, 'generated');
const WP_CONTENT_ROOT = path.join(GENERATED_ROOT, 'wp-content');
const GENERATED_PLUGIN_ROOT = path.join(
  WP_CONTENT_ROOT,
  'plugins',
  'portfolio-light-app'
);
const GENERATED_THEME_ROOT = path.join(
  WP_CONTENT_ROOT,
  'themes',
  'portfolio-light-theme'
);
const GENERATED_ADMIN_SCHEMA_ROOT = path.join(GENERATED_ROOT, 'admin-schema');

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

async function readJsonDirectory(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const data = {};

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    data[path.basename(entry.name, '.json')] = await readJson(fullPath);
  }

  return data;
}

async function readMarkdownContentDirectory(dirPath) {
  let entries = [];

  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const items = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) {
      continue;
    }

    const filePath = path.join(dirPath, entry.name);
    const source = await readFile(filePath, 'utf8');
    const parsed = matter(source);

    items.push({
      ...parsed.data,
      markdown: parsed.content.trim(),
      body: marked.parse(parsed.content),
      sourceFile: entry.name,
    });
  }

  return items;
}

async function readContentEntries(rootDir, collections) {
  const content = {};

  for (const collection of collections) {
    content[collection.id] = await readMarkdownContentDirectory(
      path.join(rootDir, collection.directory)
    );
  }

  return content;
}

function pluralize(word) {
  const irregular = {
    inquiry: 'inquiries',
    testimonial: 'testimonials',
    project: 'projects',
    experience: 'experiences',
    post: 'posts',
  };

  if (irregular[word]) {
    return irregular[word];
  }

  if (word.endsWith('y')) {
    return `${word.slice(0, -1)}ies`;
  }

  return `${word}s`;
}

function singularLabel(value) {
  if (!value) {
    return '';
  }

  if (value.endsWith('ies')) {
    return `${value.slice(0, -3)}y`;
  }

  if (value.endsWith('s')) {
    return value.slice(0, -1);
  }

  return value;
}

function toTitleCase(value) {
  return value
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function getBuiltinPostModel() {
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

function fieldTypeForAdmin(field) {
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

function normalizeFieldDescriptor(id, field) {
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

  return descriptor;
}

function buildModelAdminFields(model) {
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

function buildCollectionViewSchema(model, override) {
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

function buildCollectionFormSchema(model, override) {
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
  const defaultGroups = [];
  const remaining = fields.map((field) => field.id);

  while (remaining.length > 0) {
    defaultGroups.push({
      id: `section-${defaultGroups.length + 1}`,
      label: `Section ${defaultGroups.length + 1}`,
      children: remaining.splice(0, 4),
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

function buildSingletonFormSchema(singleton, override) {
  const fields = Object.entries(singleton.fields ?? {}).map(([fieldId, field]) =>
    normalizeFieldDescriptor(fieldId, field)
  );
  const groups = [];
  const remaining = fields.map((field) => field.id);

  while (remaining.length > 0) {
    groups.push({
      id: `section-${groups.length + 1}`,
      label: `Section ${groups.length + 1}`,
      children: remaining.splice(0, 4),
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

async function copyThemeSource(themeSourceRoot, themeTargetRoot, themeSlug) {
  await ensureDir(themeTargetRoot);
  await cp(themeSourceRoot, themeTargetRoot, { recursive: true });
  await writeFile(
    path.join(themeTargetRoot, 'style.css'),
    `/*\nTheme Name: ${toTitleCase(themeSlug)}\n*/\n`
  );
  await writeFile(
    path.join(themeTargetRoot, 'functions.php'),
    `<?php\nadd_action( 'init', function() {\n\tregister_block_pattern_category( '${themeSlug}', [\n\t\t'label' => __( '${toTitleCase(
      themeSlug
    )}', '${themeSlug}' ),\n\t] );\n} );\n`
  );

  const patternsDir = path.join(themeSourceRoot, 'patterns');
  const generatedPatternsDir = path.join(themeTargetRoot, 'patterns');
  const patternEntries = await readdir(patternsDir, { withFileTypes: true });

  for (const entry of patternEntries) {
    if (!entry.isFile() || !entry.name.endsWith('.html')) {
      continue;
    }

    const fileName = path.basename(entry.name, '.html');
    const source = await readFile(path.join(patternsDir, entry.name), 'utf8');
    const pattern = `<?php\n/**\n * Title: ${toTitleCase(fileName)}\n * Slug: ${themeSlug}/${fileName}\n * Categories: ${themeSlug}\n * Inserter: yes\n */\n?>\n${source}\n`;
    await writeFile(path.join(generatedPatternsDir, `${fileName}.php`), pattern);
    await rm(path.join(generatedPatternsDir, entry.name), { force: true });
  }
}

function pluginMainFile() {
  return `<?php
/**
 * Plugin Name: Portfolio Light App
 * Description: Generated runtime for the wp-light portfolio test site.
 */

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/inc/helpers.php';
require_once __DIR__ . '/inc/register-post-types.php';
require_once __DIR__ . '/inc/register-taxonomies.php';
require_once __DIR__ . '/inc/register-meta.php';
require_once __DIR__ . '/inc/register-singletons.php';
require_once __DIR__ . '/inc/register-rest.php';
require_once __DIR__ . '/inc/register-admin-app.php';
require_once __DIR__ . '/inc/seed.php';

add_action( 'init', function() {
\tforeach ( portfolio_light_get_block_dirs() as $block_dir ) {
\t\tif ( file_exists( $block_dir . '/block.json' ) ) {
\t\t\tregister_block_type( $block_dir );
\t\t}
\t}
} );

register_activation_hook(
\t__FILE__,
\tfunction() {
\t\tportfolio_light_seed_site();
\t\tflush_rewrite_rules();
\t}
);

register_deactivation_hook(
\t__FILE__,
\tfunction() {
\t\tflush_rewrite_rules();
\t}
);
`;
}

function phpHelpersFile() {
  return `<?php
defined( 'ABSPATH' ) || exit;

function portfolio_light_get_compiled_site() {
\tstatic $compiled = null;

\tif ( null !== $compiled ) {
\t\treturn $compiled;
\t}

\t$path = dirname( __DIR__ ) . '/compiled/site-schema.json';
\tif ( ! file_exists( $path ) ) {
\t\t$compiled = [];
\t\treturn $compiled;
\t}

\t$contents = file_get_contents( $path );
\t$compiled = json_decode( $contents, true ) ?: [];

\treturn $compiled;
}

function portfolio_light_get_site_config() {
\t$compiled = portfolio_light_get_compiled_site();
\treturn $compiled['site'] ?? [];
}

function portfolio_light_get_builtin_post_model() {
\treturn [
\t\t'id'            => 'post',
\t\t'label'         => 'Posts',
\t\t'singularLabel' => 'Post',
\t\t'type'          => 'collection',
\t\t'postType'      => 'post',
\t\t'public'        => true,
\t\t'supports'      => [ 'title', 'editor', 'excerpt', 'thumbnail', 'revisions' ],
\t\t'taxonomies'    => [ 'category', 'post_tag' ],
\t\t'adminPath'     => 'posts',
\t\t'fields'        => [],
\t];
}

function portfolio_light_get_models() {
\t$compiled = portfolio_light_get_compiled_site();
\treturn $compiled['models'] ?? [];
}

function portfolio_light_get_model( $id ) {
\tif ( 'post' === $id ) {
\t\treturn portfolio_light_get_builtin_post_model();
\t}

\tforeach ( portfolio_light_get_models() as $model ) {
\t\tif ( ( $model['id'] ?? '' ) === $id ) {
\t\t\treturn $model;
\t\t}
\t}

\treturn null;
}

function portfolio_light_get_admin_models() {
\t$models = portfolio_light_get_models();
\t$models[] = portfolio_light_get_builtin_post_model();
\treturn $models;
}

function portfolio_light_get_singletons() {
\t$compiled = portfolio_light_get_compiled_site();
\treturn $compiled['singletons'] ?? [];
}

function portfolio_light_get_singleton_schema( $id ) {
\tforeach ( portfolio_light_get_singletons() as $singleton ) {
\t\tif ( ( $singleton['id'] ?? '' ) === $id ) {
\t\t\treturn $singleton;
\t\t}
\t}

\treturn null;
}

function portfolio_light_get_routes() {
\t$compiled = portfolio_light_get_compiled_site();
\treturn $compiled['routes'] ?? [];
}

function portfolio_light_get_menus() {
\t$compiled = portfolio_light_get_compiled_site();
\treturn $compiled['menus'] ?? [];
}

function portfolio_light_get_content_collections() {
\t$compiled = portfolio_light_get_compiled_site();
\treturn $compiled['content']['collections'] ?? [];
}

function portfolio_light_get_content_singletons() {
\t$compiled = portfolio_light_get_compiled_site();
\treturn $compiled['content']['singletons'] ?? [];
}

function portfolio_light_get_admin_schema( $name, $suffix ) {
\t$path = dirname( __DIR__ ) . '/compiled/admin-schema/' . $name . '.' . $suffix . '.json';
\tif ( ! file_exists( $path ) ) {
\t\treturn null;
\t}

\treturn json_decode( file_get_contents( $path ), true );
}

function portfolio_light_get_admin_navigation() {
\t$navigation = [
\t\t[
\t\t\t'id'    => 'dashboard',
\t\t\t'label' => 'Dashboard',
\t\t\t'path'  => '/',
\t\t\t'kind'  => 'dashboard',
\t\t],
\t];

\tforeach ( portfolio_light_get_admin_models() as $model ) {
\t\t$navigation[] = [
\t\t\t'id'       => $model['id'],
\t\t\t'label'    => $model['label'],
\t\t\t'path'     => '/' . ( $model['adminPath'] ?? $model['id'] ),
\t\t\t'kind'     => 'collection',
\t\t\t'resource' => $model['id'],
\t\t];
\t}

\tforeach ( portfolio_light_get_singletons() as $singleton ) {
\t\t$navigation[] = [
\t\t\t'id'       => $singleton['id'],
\t\t\t'label'    => $singleton['label'],
\t\t\t'path'     => '/settings/' . $singleton['id'],
\t\t\t'kind'     => 'singleton',
\t\t\t'resource' => $singleton['id'],
\t\t];
\t}

\treturn $navigation;
}

function portfolio_light_get_block_dirs() {
\t$plugin_root = dirname( __DIR__ );
\t$entries     = glob( $plugin_root . '/blocks/*', GLOB_ONLYDIR ) ?: [];
\treturn array_values( $entries );
}

function portfolio_light_field_meta_type( $field ) {
\t$type = $field['type'] ?? 'text';

\tswitch ( $type ) {
\t\tcase 'integer':
\t\tcase 'relation':
\t\t\treturn 'integer';
\t\tcase 'boolean':
\t\t\treturn 'boolean';
\t\tcase 'repeater':
\t\t\treturn 'array';
\t\tdefault:
\t\t\treturn 'string';
\t}
}

function portfolio_light_cast_field_value( $field, $value ) {
\t$type = $field['type'] ?? 'text';

\tif ( null === $value ) {
\t\treturn null;
\t}

\tswitch ( $type ) {
\t\tcase 'integer':
\t\tcase 'image':
\t\t\treturn '' === $value ? '' : (int) $value;
\t\tcase 'relation':
\t\t\treturn portfolio_light_resolve_relation_value( $field, $value );
\t\tcase 'boolean':
\t\t\treturn ! empty( $value );
\t\tcase 'repeater':
\t\t\tif ( is_array( $value ) ) {
\t\t\t\treturn array_map(
\t\t\t\t\tfunction( $item ) {
\t\t\t\t\t\treturn [
\t\t\t\t\t\t\t'label' => sanitize_text_field( $item['label'] ?? '' ),
\t\t\t\t\t\t\t'value' => sanitize_text_field( $item['value'] ?? '' ),
\t\t\t\t\t\t];
\t\t\t\t\t},
\t\t\t\t\t$value
\t\t\t\t);
\t\t\t}
\t\t\treturn [];
\t\tcase 'richtext':
\t\t\treturn wp_kses_post( $value );
\t\tcase 'email':
\t\t\treturn sanitize_email( $value );
\t\tcase 'url':
\t\t\treturn esc_url_raw( $value );
\t\tcase 'select':
\t\t\treturn sanitize_text_field( $value );
\t\tdefault:
\t\t\treturn sanitize_text_field( is_string( $value ) ? $value : wp_json_encode( $value ) );
\t}
}

function portfolio_light_prepare_record( $post, $model ) {
\t$record = [
\t\t'id'         => (int) $post->ID,
\t\t'title'      => $post->post_title,
\t\t'slug'       => $post->post_name,
\t\t'postStatus' => $post->post_status,
\t\t'content'    => $post->post_content,
\t\t'excerpt'    => $post->post_excerpt,
\t\t'date'       => get_post_time( DATE_ATOM, true, $post ),
\t\t'modified'   => get_post_modified_time( DATE_ATOM, true, $post ),
\t\t'link'       => get_permalink( $post ),
\t];

\tforeach ( $model['fields'] ?? [] as $field_id => $field ) {
\t\t$value = get_post_meta( $post->ID, $field_id, true );
\t\tif ( 'boolean' === ( $field['type'] ?? '' ) ) {
\t\t\t$value = ! empty( $value );
\t\t}
\t\t$record[ $field_id ] = $value;
\t}

\tforeach ( $model['taxonomies'] ?? [] as $taxonomy ) {
\t\t$terms = wp_get_post_terms( $post->ID, $taxonomy, [ 'fields' => 'names' ] );
\t\t$record[ $taxonomy ] = is_wp_error( $terms ) ? [] : array_values( $terms );
\t}

\treturn $record;
}

function portfolio_light_resolve_relation_value( $field, $value ) {
\t$target_id = $field['target'] ?? '';
\tif ( ! $target_id ) {
\t\treturn is_numeric( $value ) ? (int) $value : 0;
\t}

\tif ( is_numeric( $value ) ) {
\t\treturn (int) $value;
\t}

\t$target_model = portfolio_light_get_model( $target_id );
\tif ( ! $target_model ) {
\t\treturn 0;
\t}

\tif ( is_string( $value ) && false !== strpos( $value, '.' ) ) {
\t\t$results = get_posts(
\t\t\t[
\t\t\t\t'post_type'      => $target_model['postType'],
\t\t\t\t'posts_per_page' => 1,
\t\t\t\t'post_status'    => 'any',
\t\t\t\t'meta_query'     => [
\t\t\t\t\t[
\t\t\t\t\t\t'key'   => '_portfolio_source_id',
\t\t\t\t\t\t'value' => $value,
\t\t\t\t\t],
\t\t\t\t],
\t\t\t]
\t\t);
\t\tif ( ! empty( $results ) ) {
\t\t\treturn (int) $results[0]->ID;
\t\t}
\t}

\t$existing = get_page_by_path( sanitize_title( $value ), OBJECT, $target_model['postType'] );
\treturn $existing ? (int) $existing->ID : 0;
}

function portfolio_light_upsert_record( $model, $payload, $existing_id = 0 ) {
\t$postarr = [
\t\t'post_type'    => $model['postType'],
\t\t'post_status'  => sanitize_key( $payload['postStatus'] ?? 'publish' ),
\t\t'post_title'   => sanitize_text_field( $payload['title'] ?? '' ),
\t\t'post_excerpt' => sanitize_textarea_field( $payload['excerpt'] ?? '' ),
\t\t'post_content' => wp_kses_post( $payload['content'] ?? '' ),
\t];

\tif ( ! empty( $payload['slug'] ) ) {
\t\t$postarr['post_name'] = sanitize_title( $payload['slug'] );
\t}

\tif ( $existing_id ) {
\t\t$postarr['ID'] = (int) $existing_id;
\t\t$post_id       = wp_update_post( wp_slash( $postarr ), true );
\t} else {
\t\t$post_id = wp_insert_post( wp_slash( $postarr ), true );
\t}

\tif ( is_wp_error( $post_id ) ) {
\t\treturn $post_id;
\t}

\tforeach ( $model['fields'] ?? [] as $field_id => $field ) {
\t\tif ( ! array_key_exists( $field_id, $payload ) ) {
\t\t\tcontinue;
\t\t}
\t\tupdate_post_meta( $post_id, $field_id, portfolio_light_cast_field_value( $field, $payload[ $field_id ] ) );
\t}

\tforeach ( $model['taxonomies'] ?? [] as $taxonomy ) {
\t\tif ( ! array_key_exists( $taxonomy, $payload ) ) {
\t\t\tcontinue;
\t\t}

\t\t$terms = array_values(
\t\t\tarray_filter(
\t\t\t\tarray_map(
\t\t\t\t\t'sanitize_text_field',
\t\t\t\t\t(array) $payload[ $taxonomy ]
\t\t\t\t)
\t\t\t)
\t\t);
\t\twp_set_object_terms( $post_id, $terms, $taxonomy, false );
\t}

\treturn get_post( $post_id );
}

function portfolio_light_profile_completeness() {
\t$schema = portfolio_light_get_singleton_schema( 'profile' );
\t$data   = get_option( 'portfolio_singleton_profile', [] );
\t$fields = array_keys( $schema['fields'] ?? [] );
\tif ( empty( $fields ) ) {
\t\treturn 0;
\t}

\t$completed = 0;
\tforeach ( $fields as $field ) {
\t\tif ( ! empty( $data[ $field ] ) || false === empty( $data[ $field ] ) ) {
\t\t\t$completed++;
\t\t}
\t}

\treturn (int) round( ( $completed / count( $fields ) ) * 100 );
}

function portfolio_light_get_dashboard_data() {
\t$projects_model = portfolio_light_get_model( 'project' );
\t$inquiry_model  = portfolio_light_get_model( 'inquiry' );
\t$featured_count = 0;
\t$recent         = [];

\tif ( $projects_model ) {
\t\t$featured_query = new WP_Query(
\t\t\t[
\t\t\t\t'post_type'      => $projects_model['postType'],
\t\t\t\t'post_status'    => 'any',
\t\t\t\t'posts_per_page' => 1,
\t\t\t\t'fields'         => 'ids',
\t\t\t\t'meta_query'     => [
\t\t\t\t\t[
\t\t\t\t\t\t'key'   => 'featured',
\t\t\t\t\t\t'value' => '1',
\t\t\t\t\t],
\t\t\t\t],
\t\t\t]
\t\t);
\t\t$featured_count = (int) $featured_query->found_posts;
\t}

\tif ( $inquiry_model ) {
\t\t$inquiries = get_posts(
\t\t\t[
\t\t\t\t'post_type'      => $inquiry_model['postType'],
\t\t\t\t'post_status'    => 'any',
\t\t\t\t'posts_per_page' => 5,
\t\t\t\t'orderby'        => 'modified',
\t\t\t\t'order'          => 'DESC',
\t\t\t]
\t\t);

\t\t$recent = array_map(
\t\t\tfunction( $post ) use ( $inquiry_model ) {
\t\t\t\t$record = portfolio_light_prepare_record( $post, $inquiry_model );
\t\t\t\treturn [
\t\t\t\t\t'id'       => $record['id'],
\t\t\t\t\t'title'    => $record['title'],
\t\t\t\t\t'email'    => $record['email'] ?? '',
\t\t\t\t\t'company'  => $record['company'] ?? '',
\t\t\t\t\t'status'   => $record['status'] ?? '',
\t\t\t\t\t'modified' => $record['modified'],
\t\t\t\t];
\t\t\t},
\t\t\t$inquiries
\t\t);
\t}

\treturn [
\t\t'featuredProjects'   => $featured_count,
\t\t'profileCompleteness'=> portfolio_light_profile_completeness(),
\t\t'recentInquiries'    => $recent,
\t];
}

function portfolio_light_export_pull_data() {
\t$payload = [
\t\t'collections' => [],
\t\t'singletons'  => [],
\t];

\tforeach ( portfolio_light_get_models() as $model ) {
\t\tif ( 'collection' !== ( $model['type'] ?? '' ) ) {
\t\t\tcontinue;
\t\t}

\t\t$posts = get_posts(
\t\t\t[
\t\t\t\t'post_type'      => $model['postType'],
\t\t\t\t'post_status'    => 'any',
\t\t\t\t'posts_per_page' => -1,
\t\t\t\t'orderby'        => 'modified',
\t\t\t\t'order'          => 'DESC',
\t\t\t]
\t\t);

\t\t$payload['collections'][ $model['id'] ] = array_map(
\t\t\tfunction( $post ) use ( $model ) {
\t\t\t\t$fields = [];
\t\t\t\t$terms  = [];

\t\t\t\tforeach ( $model['fields'] ?? [] as $field_id => $field ) {
\t\t\t\t\t$fields[ $field_id ] = get_post_meta( $post->ID, $field_id, true );
\t\t\t\t\tif ( 'relation' === ( $field['type'] ?? '' ) && ! empty( $fields[ $field_id ] ) ) {
\t\t\t\t\t\t$related_post = get_post( (int) $fields[ $field_id ] );
\t\t\t\t\t\tif ( $related_post ) {
\t\t\t\t\t\t\t$related_source = get_post_meta( $related_post->ID, '_portfolio_source_id', true );
\t\t\t\t\t\t\t$fields[ $field_id ] = $related_source ?: $related_post->post_name;
\t\t\t\t\t\t}
\t\t\t\t\t}
\t\t\t\t\tif ( 'boolean' === ( $field['type'] ?? '' ) ) {
\t\t\t\t\t\t$fields[ $field_id ] = ! empty( $fields[ $field_id ] );
\t\t\t\t\t}
\t\t\t\t}

\t\t\t\tforeach ( $model['taxonomies'] ?? [] as $taxonomy ) {
\t\t\t\t\t$taxonomy_terms   = wp_get_post_terms( $post->ID, $taxonomy, [ 'fields' => 'names' ] );
\t\t\t\t\t$terms[ $taxonomy ] = is_wp_error( $taxonomy_terms ) ? [] : array_values( $taxonomy_terms );
\t\t\t\t}

\t\t\t\treturn [
\t\t\t\t\t'id'       => (int) $post->ID,
\t\t\t\t\t'model'    => $model['id'],
\t\t\t\t\t'sourceId' => get_post_meta( $post->ID, '_portfolio_source_id', true ),
\t\t\t\t\t'slug'     => $post->post_name,
\t\t\t\t\t'title'    => $post->post_title,
\t\t\t\t\t'excerpt'  => $post->post_excerpt,
\t\t\t\t\t'status'   => $post->post_status,
\t\t\t\t\t'fields'   => $fields,
\t\t\t\t\t'terms'    => $terms,
\t\t\t\t\t'body'     => $post->post_content,
\t\t\t\t];
\t\t\t},
\t\t\t$posts
\t\t);
\t}

\t$posts = get_posts(
\t\t[
\t\t\t'post_type'      => 'post',
\t\t\t'post_status'    => 'any',
\t\t\t'posts_per_page' => -1,
\t\t\t'orderby'        => 'modified',
\t\t\t'order'          => 'DESC',
\t\t]
\t);

\t$payload['collections']['post'] = array_map(
\t\tfunction( $post ) {
\t\t\t$terms = [];
\t\t\tforeach ( [ 'category', 'post_tag' ] as $taxonomy ) {
\t\t\t\t$taxonomy_terms   = wp_get_post_terms( $post->ID, $taxonomy, [ 'fields' => 'names' ] );
\t\t\t\t$terms[ $taxonomy ] = is_wp_error( $taxonomy_terms ) ? [] : array_values( $taxonomy_terms );
\t\t\t}

\t\t\treturn [
\t\t\t\t'id'       => (int) $post->ID,
\t\t\t\t'model'    => 'post',
\t\t\t\t'sourceId' => get_post_meta( $post->ID, '_portfolio_source_id', true ),
\t\t\t\t'slug'     => $post->post_name,
\t\t\t\t'title'    => $post->post_title,
\t\t\t\t'excerpt'  => $post->post_excerpt,
\t\t\t\t'status'   => $post->post_status,
\t\t\t\t'fields'   => [],
\t\t\t\t'terms'    => $terms,
\t\t\t\t'body'     => $post->post_content,
\t\t\t];
\t\t},
\t\t$posts
\t);

\tforeach ( portfolio_light_get_singletons() as $singleton ) {
\t\t$payload['singletons'][ $singleton['id'] ] = get_option(
\t\t\t'portfolio_singleton_' . $singleton['id'],
\t\t\t[]
\t\t);
\t}

\treturn $payload;
}

function portfolio_light_is_app_request() {
\t$request_path = wp_parse_url( home_url( add_query_arg( [] ) ), PHP_URL_PATH );
\t$uri_path     = wp_parse_url( $_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH );
\t$app_base     = wp_parse_url( home_url( '/app' ), PHP_URL_PATH );

\treturn ! empty( $uri_path ) && 0 === strpos( trailingslashit( $uri_path ), trailingslashit( $app_base ) );
}
`;
}

function phpRegisterPostTypesFile() {
  return `<?php
defined( 'ABSPATH' ) || exit;

add_action( 'init', function() {
\tforeach ( portfolio_light_get_models() as $model ) {
\t\tif ( 'collection' !== ( $model['type'] ?? '' ) ) {
\t\t\tcontinue;
\t\t}

\t\t$labels = [
\t\t\t'name'          => $model['label'],
\t\t\t'singular_name' => $model['singularLabel'] ?? $model['label'],
\t\t];

\t\t$args = [
\t\t\t'label'          => $model['label'],
\t\t\t'labels'         => $labels,
\t\t\t'public'         => (bool) ( $model['public'] ?? true ),
\t\t\t'show_ui'        => (bool) ( $model['showUi'] ?? true ),
\t\t\t'show_in_rest'   => true,
\t\t\t'supports'       => $model['supports'] ?? [ 'title', 'editor', 'excerpt', 'thumbnail', 'revisions' ],
\t\t\t'has_archive'    => $model['archiveSlug'] ?? false,
\t\t\t'rewrite'        => ! empty( $model['archiveSlug'] ) ? [ 'slug' => $model['archiveSlug'] ] : true,
\t\t\t'menu_position'  => 20,
\t\t];

\t\tif ( ! empty( $model['editorTemplate'] ) ) {
\t\t\t$args['template'] = $model['editorTemplate'];
\t\t}

\t\tif ( ! empty( $model['templateLock'] ) ) {
\t\t\t$args['template_lock'] = $model['templateLock'];
\t\t}

\t\tregister_post_type( $model['postType'], $args );
\t}
} );
`;
}

function phpRegisterTaxonomiesFile() {
  return `<?php
defined( 'ABSPATH' ) || exit;

add_action( 'init', function() {
\t$taxonomies = [];

\tforeach ( portfolio_light_get_models() as $model ) {
\t\tforeach ( $model['taxonomies'] ?? [] as $taxonomy ) {
\t\t\t$taxonomies[ $taxonomy ][] = $model['postType'];
\t\t}
\t}

\tforeach ( $taxonomies as $taxonomy => $post_types ) {
\t\tregister_taxonomy(
\t\t\t$taxonomy,
\t\t\tarray_values( array_unique( $post_types ) ),
\t\t\t[
\t\t\t\t'label'        => ucwords( str_replace( '_', ' ', $taxonomy ) ),
\t\t\t\t'public'       => true,
\t\t\t\t'show_ui'      => true,
\t\t\t\t'show_in_rest' => true,
\t\t\t\t'rewrite'      => [ 'slug' => $taxonomy ],
\t\t\t]
\t\t);
\t}
} );
`;
}

function phpRegisterMetaFile() {
  return `<?php
defined( 'ABSPATH' ) || exit;

add_action( 'init', function() {
\tforeach ( portfolio_light_get_models() as $model ) {
\t\tforeach ( $model['fields'] ?? [] as $field_id => $field ) {
\t\t\tif ( 'repeater' === ( $field['type'] ?? '' ) ) {
\t\t\t\tcontinue;
\t\t\t}

\t\t\t$args = [
\t\t\t\t'object_subtype' => $model['postType'],
\t\t\t\t'type'           => portfolio_light_field_meta_type( $field ),
\t\t\t\t'single'         => true,
\t\t\t\t'show_in_rest'   => true,
\t\t\t];

\t\t\tregister_meta( 'post', $field_id, $args );
\t\t}
\t}
} );
`;
}

function phpRegisterSingletonsFile() {
  return `<?php
defined( 'ABSPATH' ) || exit;

function portfolio_get_singleton( $key ) {
\treturn get_option( "portfolio_singleton_{$key}", [] );
}

function portfolio_update_singleton( $key, $data ) {
\treturn update_option( "portfolio_singleton_{$key}", $data );
}
`;
}

function phpRegisterRestFile() {
  return `<?php
defined( 'ABSPATH' ) || exit;

function portfolio_light_rest_can_edit() {
\treturn current_user_can( 'edit_posts' );
}

add_action( 'rest_api_init', function() {
\tregister_rest_route(
\t\t'portfolio/v1',
\t\t'/bootstrap',
\t\t[
\t\t\t'methods'             => 'GET',
\t\t\t'permission_callback' => 'portfolio_light_rest_can_edit',
\t\t\t'callback'            => function() {
\t\t\t\t$models      = portfolio_light_get_admin_models();
\t\t\t\t$singletons  = portfolio_light_get_singletons();
\t\t\t\t$records     = [];
\t\t\t\t$singleton_data = [];
\t\t\t\t$admin_schema = [ 'views' => [], 'forms' => [] ];

\t\t\t\tforeach ( $models as $model ) {
\t\t\t\t\t$admin_schema['views'][ $model['id'] ] = portfolio_light_get_admin_schema( $model['id'], 'view' );
\t\t\t\t\t$admin_schema['forms'][ $model['id'] ] = portfolio_light_get_admin_schema( $model['id'], 'form' );
\t\t\t\t\t$posts = get_posts(
\t\t\t\t\t\t[
\t\t\t\t\t\t\t'post_type'      => $model['postType'],
\t\t\t\t\t\t\t'post_status'    => 'any',
\t\t\t\t\t\t\t'posts_per_page' => -1,
\t\t\t\t\t\t\t'orderby'        => 'modified',
\t\t\t\t\t\t\t'order'          => 'DESC',
\t\t\t\t\t\t]
\t\t\t\t\t);
\t\t\t\t\t$records[ $model['id'] ] = array_map(
\t\t\t\t\t\tfunction( $post ) use ( $model ) {
\t\t\t\t\t\t\treturn portfolio_light_prepare_record( $post, $model );
\t\t\t\t\t\t},
\t\t\t\t\t\t$posts
\t\t\t\t\t);
\t\t\t\t}

\t\t\t\tforeach ( $singletons as $singleton ) {
\t\t\t\t\t$admin_schema['forms'][ $singleton['id'] ] = portfolio_light_get_admin_schema( $singleton['id'], 'form' );
\t\t\t\t\t$singleton_data[ $singleton['id'] ] = get_option( 'portfolio_singleton_' . $singleton['id'], [] );
\t\t\t\t}

\t\t\t\treturn new WP_REST_Response(
\t\t\t\t\t[
\t\t\t\t\t\t'site'          => portfolio_light_get_site_config(),
\t\t\t\t\t\t'models'        => $models,
\t\t\t\t\t\t'singletons'    => $singletons,
\t\t\t\t\t\t'routes'        => portfolio_light_get_routes(),
\t\t\t\t\t\t'menus'         => portfolio_light_get_menus(),
\t\t\t\t\t\t'adminSchema'   => $admin_schema,
\t\t\t\t\t\t'navigation'    => portfolio_light_get_admin_navigation(),
\t\t\t\t\t\t'dashboard'     => portfolio_light_get_dashboard_data(),
\t\t\t\t\t\t'records'       => $records,
\t\t\t\t\t\t'singletonData' => $singleton_data,
\t\t\t\t\t],
\t\t\t\t\t200
\t\t\t\t);
\t\t\t},
\t\t]
\t);

\tregister_rest_route(
\t\t'portfolio/v1',
\t\t'/seed',
\t\t[
\t\t\t'methods'             => 'POST',
\t\t\t'permission_callback' => 'portfolio_light_rest_can_edit',
\t\t\t'callback'            => function() {
\t\t\t\tportfolio_light_seed_site();
\t\t\t\treturn new WP_REST_Response( [ 'ok' => true ], 200 );
\t\t\t},
\t\t]
\t);

\tregister_rest_route(
\t\t'portfolio/v1',
\t\t'/collection/(?P<model>[a-z0-9_-]+)',
\t\t[
\t\t\t[
\t\t\t\t'methods'             => 'GET',
\t\t\t\t'permission_callback' => 'portfolio_light_rest_can_edit',
\t\t\t\t'callback'            => function( WP_REST_Request $request ) {
\t\t\t\t\t$model = portfolio_light_get_model( $request['model'] );
\t\t\t\t\tif ( ! $model ) {
\t\t\t\t\t\treturn new WP_REST_Response( [ 'message' => 'Unknown model.' ], 404 );
\t\t\t\t\t}

\t\t\t\t\t$posts = get_posts(
\t\t\t\t\t\t[
\t\t\t\t\t\t\t'post_type'      => $model['postType'],
\t\t\t\t\t\t\t'post_status'    => 'any',
\t\t\t\t\t\t\t'posts_per_page' => -1,
\t\t\t\t\t\t\t'orderby'        => 'modified',
\t\t\t\t\t\t\t'order'          => 'DESC',
\t\t\t\t\t\t]
\t\t\t\t\t);

\t\t\t\t\t$records = array_map(
\t\t\t\t\t\tfunction( $post ) use ( $model ) {
\t\t\t\t\t\t\treturn portfolio_light_prepare_record( $post, $model );
\t\t\t\t\t\t},
\t\t\t\t\t\t$posts
\t\t\t\t\t);

\t\t\t\t\treturn new WP_REST_Response( [ 'items' => $records ], 200 );
\t\t\t\t},
\t\t\t],
\t\t\t[
\t\t\t\t'methods'             => 'POST',
\t\t\t\t'permission_callback' => 'portfolio_light_rest_can_edit',
\t\t\t\t'callback'            => function( WP_REST_Request $request ) {
\t\t\t\t\t$model = portfolio_light_get_model( $request['model'] );
\t\t\t\t\tif ( ! $model ) {
\t\t\t\t\t\treturn new WP_REST_Response( [ 'message' => 'Unknown model.' ], 404 );
\t\t\t\t\t}

\t\t\t\t\t$created = portfolio_light_upsert_record( $model, $request->get_json_params() ?: [] );
\t\t\t\t\tif ( is_wp_error( $created ) ) {
\t\t\t\t\t\treturn new WP_REST_Response( [ 'message' => $created->get_error_message() ], 500 );
\t\t\t\t\t}

\t\t\t\t\treturn new WP_REST_Response(
\t\t\t\t\t\t[
\t\t\t\t\t\t\t'item' => portfolio_light_prepare_record( $created, $model ),
\t\t\t\t\t\t],
\t\t\t\t\t\t200
\t\t\t\t\t);
\t\t\t\t},
\t\t\t],
\t\t]
\t);

\tregister_rest_route(
\t\t'portfolio/v1',
\t\t'/collection/(?P<model>[a-z0-9_-]+)/(?P<id>\\d+)',
\t\t[
\t\t\t[
\t\t\t\t'methods'             => 'GET',
\t\t\t\t'permission_callback' => 'portfolio_light_rest_can_edit',
\t\t\t\t'callback'            => function( WP_REST_Request $request ) {
\t\t\t\t\t$model = portfolio_light_get_model( $request['model'] );
\t\t\t\t\t$post  = get_post( (int) $request['id'] );

\t\t\t\t\tif ( ! $model || ! $post || $post->post_type !== $model['postType'] ) {
\t\t\t\t\t\treturn new WP_REST_Response( [ 'message' => 'Not found.' ], 404 );
\t\t\t\t\t}

\t\t\t\t\treturn new WP_REST_Response(
\t\t\t\t\t\t[
\t\t\t\t\t\t\t'item' => portfolio_light_prepare_record( $post, $model ),
\t\t\t\t\t\t],
\t\t\t\t\t\t200
\t\t\t\t\t);
\t\t\t\t},
\t\t\t],
\t\t\t[
\t\t\t\t'methods'             => 'POST',
\t\t\t\t'permission_callback' => 'portfolio_light_rest_can_edit',
\t\t\t\t'callback'            => function( WP_REST_Request $request ) {
\t\t\t\t\t$model = portfolio_light_get_model( $request['model'] );
\t\t\t\t\tif ( ! $model ) {
\t\t\t\t\t\treturn new WP_REST_Response( [ 'message' => 'Unknown model.' ], 404 );
\t\t\t\t\t}

\t\t\t\t\t$updated = portfolio_light_upsert_record(
\t\t\t\t\t\t$model,
\t\t\t\t\t\t$request->get_json_params() ?: [],
\t\t\t\t\t\t(int) $request['id']
\t\t\t\t\t);

\t\t\t\t\tif ( is_wp_error( $updated ) ) {
\t\t\t\t\t\treturn new WP_REST_Response( [ 'message' => $updated->get_error_message() ], 500 );
\t\t\t\t\t}

\t\t\t\t\treturn new WP_REST_Response(
\t\t\t\t\t\t[
\t\t\t\t\t\t\t'item' => portfolio_light_prepare_record( $updated, $model ),
\t\t\t\t\t\t],
\t\t\t\t\t\t200
\t\t\t\t\t);
\t\t\t\t},
\t\t\t],
\t\t\t[
\t\t\t\t'methods'             => 'DELETE',
\t\t\t\t'permission_callback' => 'portfolio_light_rest_can_edit',
\t\t\t\t'callback'            => function( WP_REST_Request $request ) {
\t\t\t\t\t$model = portfolio_light_get_model( $request['model'] );
\t\t\t\t\t$post  = get_post( (int) $request['id'] );
\t\t\t\t\tif ( ! $model || ! $post || $post->post_type !== $model['postType'] ) {
\t\t\t\t\t\treturn new WP_REST_Response( [ 'message' => 'Not found.' ], 404 );
\t\t\t\t\t}

\t\t\t\t\twp_delete_post( $post->ID, true );
\t\t\t\t\treturn new WP_REST_Response( [ 'ok' => true ], 200 );
\t\t\t\t},
\t\t\t],
\t\t]
\t);

\tregister_rest_route(
\t\t'portfolio/v1',
\t\t'/singleton/(?P<singleton>[a-z0-9_-]+)',
\t\t[
\t\t\t[
\t\t\t\t'methods'             => 'GET',
\t\t\t\t'permission_callback' => 'portfolio_light_rest_can_edit',
\t\t\t\t'callback'            => function( WP_REST_Request $request ) {
\t\t\t\t\t$schema = portfolio_light_get_singleton_schema( $request['singleton'] );
\t\t\t\t\tif ( ! $schema ) {
\t\t\t\t\t\treturn new WP_REST_Response( [ 'message' => 'Unknown singleton.' ], 404 );
\t\t\t\t\t}

\t\t\t\t\treturn new WP_REST_Response(
\t\t\t\t\t\t[
\t\t\t\t\t\t\t'item' => get_option( 'portfolio_singleton_' . $schema['id'], [] ),
\t\t\t\t\t\t],
\t\t\t\t\t\t200
\t\t\t\t\t);
\t\t\t\t},
\t\t\t],
\t\t\t[
\t\t\t\t'methods'             => 'POST',
\t\t\t\t'permission_callback' => 'portfolio_light_rest_can_edit',
\t\t\t\t'callback'            => function( WP_REST_Request $request ) {
\t\t\t\t\t$schema = portfolio_light_get_singleton_schema( $request['singleton'] );
\t\t\t\t\tif ( ! $schema ) {
\t\t\t\t\t\treturn new WP_REST_Response( [ 'message' => 'Unknown singleton.' ], 404 );
\t\t\t\t\t}

\t\t\t\t\t$payload = $request->get_json_params() ?: [];
\t\t\t\t\t$data    = [];
\t\t\t\t\tforeach ( $schema['fields'] ?? [] as $field_id => $field ) {
\t\t\t\t\t\tif ( array_key_exists( $field_id, $payload ) ) {
\t\t\t\t\t\t\t$data[ $field_id ] = portfolio_light_cast_field_value( $field, $payload[ $field_id ] );
\t\t\t\t\t\t}
\t\t\t\t\t}

\t\t\t\t\tupdate_option( 'portfolio_singleton_' . $schema['id'], $data );

\t\t\t\t\treturn new WP_REST_Response( [ 'item' => $data ], 200 );
\t\t\t\t},
\t\t\t],
\t\t]
\t);

\tregister_rest_route(
\t\t'portfolio/v1',
\t\t'/inquiry',
\t\t[
\t\t\t'methods'             => 'POST',
\t\t\t'permission_callback' => '__return_true',
\t\t\t'callback'            => function( WP_REST_Request $request ) {
\t\t\t\t$model = portfolio_light_get_model( 'inquiry' );
\t\t\t\tif ( ! $model ) {
\t\t\t\t\treturn new WP_REST_Response( [ 'ok' => false ], 500 );
\t\t\t\t}

\t\t\t\t$params = $request->get_json_params();
\t\t\t\t$payload = [
\t\t\t\t\t'title'      => sanitize_text_field( $params['name'] ?? 'Inquiry' ),
\t\t\t\t\t'postStatus' => 'publish',
\t\t\t\t\t'content'    => sanitize_textarea_field( $params['message'] ?? '' ),
\t\t\t\t\t'email'      => sanitize_email( $params['email'] ?? '' ),
\t\t\t\t\t'company'    => sanitize_text_field( $params['company'] ?? '' ),
\t\t\t\t\t'source'     => 'contact_form',
\t\t\t\t\t'status'     => 'new',
\t\t\t\t];

\t\t\t\t$created = portfolio_light_upsert_record( $model, $payload );
\t\t\t\tif ( is_wp_error( $created ) ) {
\t\t\t\t\treturn new WP_REST_Response( [ 'ok' => false ], 500 );
\t\t\t\t}

\t\t\t\treturn new WP_REST_Response( [ 'ok' => true ], 200 );
\t\t\t},
\t\t]
\t);
} );
`;
}

function phpRegisterAdminAppFile() {
  return `<?php
defined( 'ABSPATH' ) || exit;

add_action( 'init', function() {
\tadd_rewrite_rule( '^app/?$', 'index.php?portfolio_app=1', 'top' );
\tadd_rewrite_rule( '^app/(.*)?$', 'index.php?portfolio_app=1', 'top' );
} );

add_filter(
\t'query_vars',
\tfunction( $vars ) {
\t\t$vars[] = 'portfolio_app';
\t\treturn $vars;
\t}
);

add_filter( 'show_admin_bar', '__return_false' );

add_action(
\t'admin_init',
\tfunction() {
\t\tif ( wp_doing_ajax() || isset( $_GET['classic-admin'] ) ) {
\t\t\treturn;
\t\t}

\t\tif ( current_user_can( 'edit_posts' ) ) {
\t\t\twp_safe_redirect( home_url( '/app' ) );
\t\t\texit;
\t\t}
\t}
);

add_action(
\t'template_redirect',
\tfunction() {
\t\tif ( ! get_query_var( 'portfolio_app' ) && ! portfolio_light_is_app_request() ) {
\t\t\treturn;
\t\t}

\t\tif ( ! is_user_logged_in() ) {
\t\t\tauth_redirect();
\t\t}

\t\t$script_path = dirname( __DIR__ ) . '/build/admin-app.js';
\t\t$style_path  = dirname( __DIR__ ) . '/build/admin-app.css';
\t\t$script_url  = plugins_url( 'build/admin-app.js', dirname( __DIR__ ) . '/portfolio-light-app.php' );
\t\t$style_url   = plugins_url( 'build/admin-app.css', dirname( __DIR__ ) . '/portfolio-light-app.php' );
\t\t$config      = [
\t\t\t'restRoot' => esc_url_raw( rest_url( 'portfolio/v1/' ) ),
\t\t\t'nonce'    => wp_create_nonce( 'wp_rest' ),
\t\t\t'appBase'  => home_url( '/app' ),
\t\t];

\t\tstatus_header( 200 );
\t\tnocache_headers();
\t\t?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
\t<meta charset="<?php bloginfo( 'charset' ); ?>" />
\t<meta name="viewport" content="width=device-width, initial-scale=1" />
\t<title><?php echo esc_html( get_bloginfo( 'name' ) . ' App' ); ?></title>
\t<?php if ( file_exists( $style_path ) ) : ?>
\t\t<link rel="stylesheet" href="<?php echo esc_url( $style_url ); ?>" />
\t<?php endif; ?>
\t<script>window.PORTFOLIO_LIGHT = <?php echo wp_json_encode( $config ); ?>;</script>
\t<?php wp_head(); ?>
</head>
<body <?php body_class( 'portfolio-light-admin-app' ); ?>>
\t<div id="portfolio-admin-root"></div>
\t<?php if ( file_exists( $script_path ) ) : ?>
\t\t<script type="module" src="<?php echo esc_url( $script_url ); ?>"></script>
\t<?php else : ?>
\t\t<p>Admin app build not found. Run the build step.</p>
\t<?php endif; ?>
\t<?php wp_footer(); ?>
</body>
</html><?php
\t\texit;
\t}
);
`;
}

function phpSeedFile() {
  return `<?php
defined( 'ABSPATH' ) || exit;

function portfolio_light_seed_page_from_route( $route ) {
\tif ( 'page' !== ( $route['type'] ?? '' ) || empty( $route['seed']['createPageShell'] ) ) {
\t\treturn 0;
\t}

\t$slug     = (string) ( $route['slug'] ?? '' );
\t$existing = $slug ? get_page_by_path( $slug, OBJECT, 'page' ) : null;
\t$payload  = [
\t\t'post_type'    => 'page',
\t\t'post_status'  => $route['seed']['status'] ?? 'publish',
\t\t'post_title'   => $route['title'] ?? ucfirst( $route['id'] ?? 'Page' ),
\t\t'post_name'    => $slug,
\t\t'post_content' => '',
\t];

\tif ( $existing ) {
\t\t$payload['ID'] = $existing->ID;
\t\t$page_id       = wp_update_post( wp_slash( $payload ), true );
\t} else {
\t\t$page_id = wp_insert_post( wp_slash( $payload ), true );
\t}

\tif ( is_wp_error( $page_id ) ) {
\t\treturn 0;
\t}

\tif ( ! empty( $route['template'] ) && ! in_array( $route['template'], [ 'front-page', 'page' ], true ) ) {
\t\tupdate_post_meta( $page_id, '_wp_page_template', $route['template'] );
\t}

\treturn (int) $page_id;
}

function portfolio_light_seed_singletons() {
\t$site = portfolio_light_get_site_config();
\tif (
\t\tempty( $site['content']['push'] ) ||
\t\t'database' === ( $site['content']['mode'] ?? 'files' ) ||
\t\t! empty( $site['content']['databaseFirst'] )
\t) {
\t\treturn;
\t}

\tforeach ( portfolio_light_get_content_singletons() as $singleton_id => $entry ) {
\t\tupdate_option( 'portfolio_singleton_' . $singleton_id, $entry['data'] ?? [] );
\t}
}

function portfolio_light_cleanup_default_content() {
\t$hello_world = get_page_by_path( 'hello-world', OBJECT, 'post' );
\tif ( $hello_world && 'Hello world!' === $hello_world->post_title ) {
\t\twp_delete_post( $hello_world->ID, true );
\t}

\t$sample_page = get_page_by_path( 'sample-page', OBJECT, 'page' );
\tif ( $sample_page && 'Sample Page' === $sample_page->post_title ) {
\t\twp_delete_post( $sample_page->ID, true );
\t}
}

function portfolio_light_seed_collection_items() {
\t$site        = portfolio_light_get_site_config();
\tif (
\t\tempty( $site['content']['push'] ) ||
\t\t'database' === ( $site['content']['mode'] ?? 'files' ) ||
\t\t! empty( $site['content']['databaseFirst'] )
\t) {
\t\treturn;
\t}

\t$collections = portfolio_light_get_content_collections();
\tforeach ( $collections as $directory => $items ) {
\t\tforeach ( $items as $entry ) {
\t\t\tif ( 'post' === ( $entry['model'] ?? '' ) ) {
\t\t\t\t$existing = get_page_by_path( $entry['slug'], OBJECT, 'post' );
\t\t\t\t$payload  = [
\t\t\t\t\t'post_type'    => 'post',
\t\t\t\t\t'post_status'  => $entry['status'] ?? 'publish',
\t\t\t\t\t'post_title'   => $entry['title'],
\t\t\t\t\t'post_name'    => $entry['slug'],
\t\t\t\t\t'post_excerpt' => $entry['excerpt'] ?? '',
\t\t\t\t\t'post_content' => $entry['body'] ?? '',
\t\t\t\t];

\t\t\t\tif ( $existing ) {
\t\t\t\t\t$payload['ID'] = $existing->ID;
\t\t\t\t\t$post_id       = wp_update_post( wp_slash( $payload ), true );
\t\t\t\t} else {
\t\t\t\t\t$post_id = wp_insert_post( wp_slash( $payload ), true );
\t\t\t\t}

\t\t\t\tif ( ! is_wp_error( $post_id ) ) {
\t\t\t\t\tupdate_post_meta( $post_id, '_portfolio_source_id', $entry['sourceId'] ?? '' );
\t\t\t\t}
\t\t\t\tcontinue;
\t\t\t}

\t\t\t$model = portfolio_light_get_model( $entry['model'] ?? '' );
\t\t\tif ( ! $model ) {
\t\t\t\tcontinue;
\t\t\t}

\t\t\t$existing = null;
\t\t\tif ( ! empty( $entry['sourceId'] ) ) {
\t\t\t\t$results = get_posts(
\t\t\t\t\t[
\t\t\t\t\t\t'post_type'      => $model['postType'],
\t\t\t\t\t\t'post_status'    => 'any',
\t\t\t\t\t\t'posts_per_page' => 1,
\t\t\t\t\t\t'meta_query'     => [
\t\t\t\t\t\t\t[
\t\t\t\t\t\t\t\t'key'   => '_portfolio_source_id',
\t\t\t\t\t\t\t\t'value' => $entry['sourceId'],
\t\t\t\t\t\t\t],
\t\t\t\t\t\t],
\t\t\t\t\t]
\t\t\t\t);
\t\t\t\t$existing = ! empty( $results ) ? $results[0] : null;
\t\t\t}

\t\t\tif ( ! $existing && ! empty( $entry['slug'] ) ) {
\t\t\t\t$existing = get_page_by_path( $entry['slug'], OBJECT, $model['postType'] );
\t\t\t}

\t\t\tif ( ! empty( $site['content']['collections'][ $entry['model'] ] ) && empty( $site['content']['collections'][ $entry['model'] ]['sync'] ) ) {
\t\t\t\tcontinue;
\t\t\t}

\t\t\t$payload = [
\t\t\t\t'title'      => $entry['title'] ?? '',
\t\t\t\t'slug'       => $entry['slug'] ?? '',
\t\t\t\t'excerpt'    => $entry['excerpt'] ?? '',
\t\t\t\t'postStatus' => $entry['status'] ?? 'publish',
\t\t\t\t'content'    => $entry['body'] ?? '',
\t\t\t];

\t\t\tforeach ( $entry['fields'] ?? [] as $field_id => $value ) {
\t\t\t\t$payload[ $field_id ] = $value;
\t\t\t}

\t\t\tforeach ( $entry['terms'] ?? [] as $taxonomy => $terms ) {
\t\t\t\t$payload[ $taxonomy ] = $terms;
\t\t\t}

\t\t\t$saved = portfolio_light_upsert_record( $model, $payload, $existing ? $existing->ID : 0 );
\t\t\tif ( ! is_wp_error( $saved ) && ! empty( $entry['sourceId'] ) ) {
\t\t\t\tupdate_post_meta( $saved->ID, '_portfolio_source_id', $entry['sourceId'] );
\t\t\t}
\t\t}
\t}
}

function portfolio_light_seed_site() {
\t$page_ids = [];
\tforeach ( portfolio_light_get_routes() as $route ) {
\t\t$page_ids[ $route['id'] ] = portfolio_light_seed_page_from_route( $route );
\t}

\tportfolio_light_seed_singletons();
\tportfolio_light_cleanup_default_content();
\tportfolio_light_seed_collection_items();

\t$site = portfolio_light_get_site_config();
\t$front_page = $page_ids[ $site['frontPage'] ?? '' ] ?? 0;
\t$posts_page = $page_ids[ $site['postsPage'] ?? '' ] ?? 0;

\tif ( ! empty( $site['title'] ) ) {
\t\tupdate_option( 'blogname', $site['title'] );
\t}

\tif ( ! empty( $site['tagline'] ) ) {
\t\tupdate_option( 'blogdescription', $site['tagline'] );
\t}

\tif ( $front_page ) {
\t\tupdate_option( 'show_on_front', 'page' );
\t\tupdate_option( 'page_on_front', $front_page );
\t}

\tif ( $posts_page ) {
\t\tupdate_option( 'page_for_posts', $posts_page );
\t}

\tflush_rewrite_rules();
}
`;
}

async function writeGeneratedPlugin(siteSchema, adminSchemas, site) {
  const incDir = path.join(GENERATED_PLUGIN_ROOT, 'inc');
  const compiledDir = path.join(GENERATED_PLUGIN_ROOT, 'compiled');
  const compiledAdminDir = path.join(compiledDir, 'admin-schema');

  await ensureDir(incDir);
  await ensureDir(compiledAdminDir);
  await ensureDir(path.join(GENERATED_PLUGIN_ROOT, 'build'));

  await writeFile(path.join(GENERATED_PLUGIN_ROOT, 'portfolio-light-app.php'), pluginMainFile());
  await writeFile(path.join(incDir, 'helpers.php'), phpHelpersFile());
  await writeFile(path.join(incDir, 'register-post-types.php'), phpRegisterPostTypesFile());
  await writeFile(path.join(incDir, 'register-taxonomies.php'), phpRegisterTaxonomiesFile());
  await writeFile(path.join(incDir, 'register-meta.php'), phpRegisterMetaFile());
  await writeFile(path.join(incDir, 'register-singletons.php'), phpRegisterSingletonsFile());
  await writeFile(path.join(incDir, 'register-rest.php'), phpRegisterRestFile());
  await writeFile(path.join(incDir, 'register-admin-app.php'), phpRegisterAdminAppFile());
  await writeFile(path.join(incDir, 'seed.php'), phpSeedFile());
  await writeFile(
    path.join(compiledDir, 'site-schema.json'),
    JSON.stringify(siteSchema, null, 2)
  );

  for (const [fileName, schema] of Object.entries(adminSchemas)) {
    await writeFile(
      path.join(compiledAdminDir, fileName),
      JSON.stringify(schema, null, 2)
    );
  }

  await cp(path.join(ROOT, 'blocks'), path.join(GENERATED_PLUGIN_ROOT, 'blocks'), {
    recursive: true,
  });
  await writeFile(path.join(GENERATED_PLUGIN_ROOT, 'build', '.gitkeep'), '');
}

async function build() {
  const site = await readJson(path.join(ROOT, 'app', 'site.json'));
  const models = Object.values(await readJsonDirectory(path.join(ROOT, 'app', 'models'))).map(
    (model) => ({
      singularLabel: singularLabel(model.label),
      adminPath: pluralize(model.id),
      ...model,
    })
  );
  const singletons = Object.values(
    await readJsonDirectory(path.join(ROOT, 'app', 'singletons'))
  );
  const routes = Object.values(await readJsonDirectory(path.join(ROOT, 'app', 'routes')));
  const menus = await readJsonDirectory(path.join(ROOT, 'app', 'menus'));
  const contentSources = [
    ...models
      .filter((model) => model.type === 'collection')
      .map((model) => ({
        id: model.id,
        directory: pluralize(model.id),
      })),
    {
      id: 'post',
      directory: 'posts',
    },
  ];
  const contentCollections = await readContentEntries(
    path.join(ROOT, 'content'),
    contentSources
  );
  const contentSingletons = await readJsonDirectory(path.join(ROOT, 'content', 'singletons'));
  const adminOverrides = await readJsonDirectory(path.join(ROOT, 'admin'));

  const siteSchema = {
    site,
    models,
    singletons,
    routes,
    menus,
    content: {
      collections: Object.fromEntries(
        contentSources.map((source) => [source.id, contentCollections[source.id] ?? []])
      ),
      singletons: Object.fromEntries(
        Object.entries(contentSingletons).map(([key, value]) => [key, value])
      ),
    },
    admin: adminOverrides,
    generatedAt: new Date().toISOString(),
  };

  const adminSchemas = {};

  for (const model of models) {
    adminSchemas[`${model.id}.view.json`] = buildCollectionViewSchema(
      model,
      adminOverrides[`${model.id}.view`]
    );
    adminSchemas[`${model.id}.form.json`] = buildCollectionFormSchema(
      model,
      adminOverrides[`${model.id}.form`]
    );
  }

  for (const singleton of singletons) {
    adminSchemas[`${singleton.id}.form.json`] = buildSingletonFormSchema(
      singleton,
      adminOverrides[`settings-${singleton.id}.form`] ?? adminOverrides[`${singleton.id}.form`]
    );
  }

  const builtinPostModel = getBuiltinPostModel();
  adminSchemas['post.view.json'] = buildCollectionViewSchema(
    builtinPostModel,
    adminOverrides['post.view']
  );
  adminSchemas['post.form.json'] = buildCollectionFormSchema(
    builtinPostModel,
    adminOverrides['post.form']
  );

  await rm(GENERATED_ROOT, { recursive: true, force: true });
  await ensureDir(GENERATED_ADMIN_SCHEMA_ROOT);

  for (const [fileName, schema] of Object.entries(adminSchemas)) {
    await writeFile(
      path.join(GENERATED_ADMIN_SCHEMA_ROOT, fileName),
      JSON.stringify(schema, null, 2)
    );
  }

  await writeFile(
    path.join(GENERATED_ROOT, 'blueprint.json'),
    await readFile(path.join(ROOT, 'build', 'blueprint.json'), 'utf8')
  );
  await writeFile(
    path.join(GENERATED_ROOT, 'site-schema.json'),
    JSON.stringify(siteSchema, null, 2)
  );

  await copyThemeSource(path.join(ROOT, 'theme'), GENERATED_THEME_ROOT, site.theme.slug);
  await writeGeneratedPlugin(siteSchema, adminSchemas, site);

  return {
    generatedRoot: GENERATED_ROOT,
    pluginRoot: GENERATED_PLUGIN_ROOT,
    themeRoot: GENERATED_THEME_ROOT,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  build()
    .then((result) => {
      process.stdout.write(
        `Built wp-light artifacts.\nPlugin: ${result.pluginRoot}\nTheme: ${result.themeRoot}\n`
      );
    })
    .catch((error) => {
      process.stderr.write(`${error.stack || error.message}\n`);
      process.exitCode = 1;
    });
}

export { build };
