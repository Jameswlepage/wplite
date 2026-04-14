// Generates the `helpers.php` file included by the compiled plugin.
export function phpHelpersFile() {
  return `<?php
defined( 'ABSPATH' ) || exit;

function portfolio_light_get_compiled_site_path() {
\treturn dirname( __DIR__ ) . '/compiled/site-schema.json';
}

function portfolio_light_get_compiled_site() {
\tstatic $compiled = null;

\tif ( null !== $compiled ) {
\t\treturn $compiled;
\t}

\t$path = portfolio_light_get_compiled_site_path();
\tif ( ! file_exists( $path ) ) {
\t\t$compiled = [];
\t\treturn $compiled;
\t}

\t$contents = file_get_contents( $path );
\t$compiled = json_decode( $contents, true ) ?: [];

\treturn $compiled;
}

function portfolio_light_get_compiled_generated_at() {
\t$path = portfolio_light_get_compiled_site_path();
\tif ( ! file_exists( $path ) ) {
\t\treturn null;
\t}

\t$timestamp = filemtime( $path );
\tif ( false === $timestamp ) {
\t\treturn null;
\t}

\treturn gmdate( DATE_ATOM, $timestamp );
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

function portfolio_light_get_builtin_page_model() {
\treturn [
\t\t'id'            => 'page',
\t\t'label'         => 'Pages',
\t\t'singularLabel' => 'Page',
\t\t'type'          => 'collection',
\t\t'postType'      => 'page',
\t\t'public'        => true,
\t\t'supports'      => [ 'title', 'editor', 'excerpt', 'thumbnail', 'revisions', 'page-attributes' ],
\t\t'taxonomies'    => [],
\t\t'adminPath'     => 'pages',
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
\tif ( 'page' === $id ) {
\t\treturn portfolio_light_get_builtin_page_model();
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

function portfolio_light_get_route( $id ) {
\tforeach ( portfolio_light_get_routes() as $route ) {
\t\tif ( ( $route['id'] ?? '' ) === $id ) {
\t\t\treturn $route;
\t\t}
\t}

\treturn null;
}

function portfolio_light_get_blocks() {
\t$compiled = portfolio_light_get_compiled_site();
\treturn $compiled['blocks'] ?? [];
}

function portfolio_light_get_dashboard_widgets() {
\t$blocks   = portfolio_light_get_blocks();
\t$widgets  = [];

\tforeach ( $blocks as $block ) {
\t\tif ( ( $block['category'] ?? '' ) !== 'dashboard' ) {
\t\t\tcontinue;
\t\t}

\t\t$supports = $block['supports'] ?? [];
\t\t$align    = $supports['align'] ?? [];
\t\tif ( ! is_array( $align ) ) {
\t\t\t$align = [ $align ];
\t\t}

\t\t$widgets[] = [
\t\t\t'id'          => sanitize_key( str_replace( '/', '-', $block['name'] ) ),
\t\t\t'name'        => $block['name'],
\t\t\t'title'       => $block['title'] ?? $block['name'],
\t\t\t'description' => $block['description'] ?? '',
\t\t\t'icon'        => $block['icon'] ?? null,
\t\t\t'span'        => in_array( 'full', $align, true ) ? 'full' : 'half',
\t\t];
\t}

\treturn $widgets;
}

function portfolio_light_get_menus() {
\t$compiled = portfolio_light_get_compiled_site();
\treturn $compiled['menus'] ?? [];
}

function portfolio_light_get_editor_templates() {
\t$compiled = portfolio_light_get_compiled_site();
\treturn $compiled['editorTemplates'] ?? [];
}

function portfolio_light_get_content_collections() {
\t$compiled = portfolio_light_get_compiled_site();
\treturn $compiled['content']['collections'] ?? [];
}

function portfolio_light_get_content_singletons() {
\t$compiled = portfolio_light_get_compiled_site();
\treturn $compiled['content']['singletons'] ?? [];
}

function portfolio_light_get_theme_json() {
\t$path = get_stylesheet_directory() . '/theme.json';
\tif ( ! file_exists( $path ) ) {
\t\treturn null;
\t}
\treturn json_decode( file_get_contents( $path ), true );
}

function portfolio_light_get_theme_css() {
\t$path = get_stylesheet_directory() . '/style.css';
\tif ( ! file_exists( $path ) ) {
\t\treturn '';
\t}
\treturn (string) file_get_contents( $path );
}

function portfolio_light_get_admin_schema( $name, $suffix ) {
\t$path = dirname( __DIR__ ) . '/compiled/admin-schema/' . $name . '.' . $suffix . '.json';
\tif ( ! file_exists( $path ) ) {
\t\treturn null;
\t}

\treturn json_decode( file_get_contents( $path ), true );
}

function portfolio_light_get_dev_state() {
\tstatic $state = null;

\tif ( null !== $state ) {
\t\treturn $state;
\t}

\t$path = dirname( __DIR__ ) . '/compiled/dev-state.json';
\tif ( ! file_exists( $path ) ) {
\t\t$state = [
\t\t\t'enabled' => false,
\t\t\t'version' => null,
\t\t\t'heartbeatAt' => null,
\t\t];
\t\treturn $state;
\t}

\t$decoded = json_decode( file_get_contents( $path ), true );
\tif ( ! is_array( $decoded ) ) {
\t\t$decoded = [];
\t}

\t$state = array_merge(
\t\t[
\t\t\t'enabled' => false,
\t\t\t'version' => null,
\t\t\t'heartbeatAt' => null,
\t\t],
\t\t$decoded
\t);

\t$heartbeat = ! empty( $state['heartbeatAt'] ) ? strtotime( $state['heartbeatAt'] ) : false;
\tif ( ! $heartbeat || ( time() - $heartbeat ) > 6 ) {
\t\t$state['enabled'] = false;
\t}

\treturn $state;
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
\t\t$nav_item = [
\t\t\t'id'       => $model['id'],
\t\t\t'label'    => $model['label'],
\t\t\t'path'     => '/' . ( $model['adminPath'] ?? $model['id'] ),
\t\t\t'kind'     => 'collection',
\t\t\t'resource' => $model['id'],
\t\t];
\t\tif ( ! empty( $model['icon'] ) ) {
\t\t\t$nav_item['icon'] = $model['icon'];
\t\t}
\t\t$navigation[] = $nav_item;
\t}

\tforeach ( portfolio_light_get_singletons() as $singleton ) {
\t\t$nav_item = [
\t\t\t'id'       => $singleton['id'],
\t\t\t'label'    => $singleton['label'],
\t\t\t'path'     => '/settings/' . $singleton['id'],
\t\t\t'kind'     => 'singleton',
\t\t\t'resource' => $singleton['id'],
\t\t];
\t\tif ( ! empty( $singleton['icon'] ) ) {
\t\t\t$nav_item['icon'] = $singleton['icon'];
\t\t}
\t\t$navigation[] = $nav_item;
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

function portfolio_light_prepare_page_record( $post ) {
\treturn [
\t\t'id'         => (int) $post->ID,
\t\t'routeId'    => (string) get_post_meta( $post->ID, '_portfolio_route_id', true ),
\t\t'sourceId'   => (string) get_post_meta( $post->ID, '_portfolio_source_id', true ),
\t\t'title'      => $post->post_title,
\t\t'slug'       => $post->post_name,
\t\t'postStatus' => $post->post_status,
\t\t'content'    => $post->post_content,
\t\t'excerpt'    => $post->post_excerpt,
\t\t'parent'     => (int) $post->post_parent,
\t\t'template'   => (string) get_post_meta( $post->ID, '_wp_page_template', true ),
\t\t'menuOrder'  => (int) $post->menu_order,
\t\t'link'       => get_permalink( $post ),
\t\t'date'       => get_post_time( DATE_ATOM, true, $post ),
\t\t'modified'   => get_post_modified_time( DATE_ATOM, true, $post ),
\t];
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
\t\t'pages'       => [],
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

\t$pages = get_posts(
\t\t[
\t\t\t'post_type'      => 'page',
\t\t\t'post_status'    => 'any',
\t\t\t'posts_per_page' => -1,
\t\t\t'orderby'        => 'modified',
\t\t\t'order'          => 'DESC',
\t\t]
\t);
\t$payload['pages'] = array_map( 'portfolio_light_prepare_page_record', $pages );

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

