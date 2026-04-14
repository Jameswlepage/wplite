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
\t$base = $compiled['site'] ?? [];
\t$canonical = [
\t\t'title'       => get_bloginfo( 'name' ),
\t\t'tagline'     => get_bloginfo( 'description' ),
\t\t'url'         => home_url( '/' ),
\t\t'language'    => get_bloginfo( 'language' ),
\t\t'locale'      => get_locale(),
\t\t'iconId'      => (int) get_option( 'site_icon', 0 ),
\t\t'iconUrl'     => function_exists( 'get_site_icon_url' ) ? get_site_icon_url( 512 ) : '',
\t\t'adminEmail'  => get_option( 'admin_email' ),
\t\t'timezone'    => wp_timezone_string(),
\t];
\treturn array_merge( $base, array_filter( $canonical, fn( $v ) => $v !== null && $v !== '' ) );
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

function portfolio_light_get_editor_bundle() {
\t// Swallow any stray PHP notices/warnings from WP core during this call.
\t// get_block_editor_settings() can emit notices when called outside of the
\t// usual admin request lifecycle (e.g. deprecated-argument warnings, or
\t// missing globals). Without output-buffering, those bytes land in front of
\t// our JSON response and break JSON.parse on the client.
\tob_start();
\t$previous_error_level = error_reporting();
\terror_reporting( $previous_error_level & ~E_WARNING & ~E_NOTICE & ~E_DEPRECATED & ~E_USER_WARNING & ~E_USER_NOTICE & ~E_USER_DEPRECATED );

\ttry {
\t\t$global_stylesheet = '';
\t\tif ( function_exists( 'wp_get_global_stylesheet' ) ) {
\t\t\ttry {
\t\t\t\t$global_stylesheet = (string) wp_get_global_stylesheet( [ 'variables', 'presets', 'styles', 'base-layout-styles' ] );
\t\t\t} catch ( \\Throwable $e ) {
\t\t\t\t$global_stylesheet = '';
\t\t\t}
\t\t}

\t\t$theme = wp_get_theme();
\t\t$theme_stylesheet_uri = get_stylesheet_uri();
\t\t$theme_stylesheet_version = '';
\t\t$stylesheet_path = get_stylesheet_directory() . '/style.css';
\t\tif ( file_exists( $stylesheet_path ) ) {
\t\t\t$theme_stylesheet_version = (string) filemtime( $stylesheet_path );
\t\t}

\t\t// Enumerate every registered block so the admin-app can stub any that
\t\t// aren't on the client yet — prevents "classic/freeform" recovery UI
\t\t// for site/plugin blocks the editor hasn't registered client-side.
\t\t$block_types = [];
\t\tif ( class_exists( 'WP_Block_Type_Registry' ) ) {
\t\t\t$block_registry = WP_Block_Type_Registry::get_instance();
\t\t\tforeach ( $block_registry->get_all_registered() as $name => $block_type ) {
\t\t\t\t$block_types[] = [
\t\t\t\t\t'name'            => $name,
\t\t\t\t\t'title'           => $block_type->title ?? $name,
\t\t\t\t\t'category'        => $block_type->category ?? 'widgets',
\t\t\t\t\t'icon'            => $block_type->icon ?? null,
\t\t\t\t\t'description'     => $block_type->description ?? '',
\t\t\t\t\t'keywords'        => (array) ( $block_type->keywords ?? [] ),
\t\t\t\t\t'apiVersion'      => (int) ( $block_type->api_version ?? 2 ),
\t\t\t\t\t'attributes'      => (object) ( $block_type->attributes ?? [] ),
\t\t\t\t\t'supports'        => (object) ( $block_type->supports ?? [] ),
\t\t\t\t\t'usesContext'     => (array) ( $block_type->uses_context ?? [] ),
\t\t\t\t\t'providesContext' => (object) ( $block_type->provides_context ?? [] ),
\t\t\t\t\t'parent'          => $block_type->parent ?? null,
\t\t\t\t\t'ancestor'        => $block_type->ancestor ?? null,
\t\t\t\t\t'example'         => $block_type->example ?? null,
\t\t\t\t\t'isDynamic'       => is_callable( $block_type->render_callback ?? null ),
\t\t\t\t];
\t\t\t}
\t\t}

\t\t// Fetch the full editor-settings array WP would use for a post editor.
\t\t// This gives us __unstableResolvedAssets (iframe <link>/<style> HTML),
\t\t// colors, gradients, fontSizes, and the complete styles[] array the
\t\t// default block editor would render with.
\t\t$editor_settings = [];
\t\tif ( class_exists( 'WP_Block_Editor_Context' ) && function_exists( 'get_block_editor_settings' ) ) {
\t\t\ttry {
\t\t\t\t$context = new WP_Block_Editor_Context( [ 'name' => 'core/edit-post' ] );
\t\t\t\t$editor_settings = get_block_editor_settings( [], $context );
\t\t\t} catch ( \\Throwable $e ) {
\t\t\t\t$editor_settings = [];
\t\t\t}
\t\t}

\t\treturn [
\t\t\t'globalStylesheet'       => $global_stylesheet,
\t\t\t'themeStylesheetUrl'     => $theme_stylesheet_uri,
\t\t\t'themeStylesheetVersion' => $theme_stylesheet_version,
\t\t\t'themeName'              => $theme->get( 'Name' ),
\t\t\t'blockTypes'             => $block_types,
\t\t\t'editorSettings'         => $editor_settings,
\t\t];
\t} finally {
\t\terror_reporting( $previous_error_level );
\t\t// Discard whatever stray output WP core wrote into our buffer.
\t\tif ( ob_get_level() > 0 ) {
\t\t\tob_end_clean();
\t\t}
\t}
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

/* ── Deterministic mock analytics (shared across dashboard widgets) ── */

function portfolio_light_mock_hash( $str ) {
\t$h = 2166136261;
\t$len = strlen( (string) $str );
\tfor ( $i = 0; $i < $len; $i++ ) {
\t\t$h ^= ord( $str[ $i ] );
\t\t$h = ( $h * 16777619 ) & 0xFFFFFFFF;
\t}
\treturn $h;
}

function portfolio_light_mock_series( $seed, $days = 30, $base = 120, $variance = 0.6 ) {
\t$state = portfolio_light_mock_hash( $seed ) ?: 1;
\t$series = [];
\t$momentum = 0.0;
\t$dow = (int) wp_date( 'w' );
\tfor ( $i = 0; $i < $days; $i++ ) {
\t\t$state = ( $state * 1664525 + 1013904223 ) & 0xFFFFFFFF;
\t\t$r = $state / 4294967296;
\t\t$momentum = $momentum * 0.7 + ( $r - 0.5 ) * $variance;
\t\t$day = ( $dow + $i ) % 7;
\t\t$weekend = in_array( $day, [ 0, 6 ], true ) ? 0.75 : 1.0;
\t\t$value = max( 5, (int) round( $base * $weekend * ( 1 + $momentum ) ) );
\t\t$series[] = $value;
\t}
\treturn $series;
}

function portfolio_light_trend_pct( $series ) {
\t$count = count( $series );
\tif ( $count < 4 ) {
\t\treturn 0;
\t}
\t$mid  = (int) floor( $count / 2 );
\t$prev = array_sum( array_slice( $series, 0, $mid ) ) ?: 1;
\t$curr = array_sum( array_slice( $series, $mid ) );
\treturn (int) round( ( ( $curr - $prev ) / $prev ) * 100 );
}

function portfolio_light_format_compact( $n ) {
\t$n = (int) $n;
\tif ( $n >= 1000000 ) {
\t\treturn round( $n / 1000000, 1 ) . 'M';
\t}
\tif ( $n >= 1000 ) {
\t\treturn round( $n / 1000, 1 ) . 'K';
\t}
\treturn (string) $n;
}

function portfolio_light_format_relative( $iso ) {
\tif ( ! $iso ) {
\t\treturn 'just now';
\t}
\t$then = strtotime( $iso );
\tif ( ! $then ) {
\t\treturn 'recently';
\t}
\t$diff  = max( 1, time() - $then );
\t$units = [
\t\t[ 'year', 31536000 ],
\t\t[ 'month', 2592000 ],
\t\t[ 'day', 86400 ],
\t\t[ 'hour', 3600 ],
\t\t[ 'minute', 60 ],
\t];
\tforeach ( $units as $unit ) {
\t\tif ( $diff >= $unit[1] ) {
\t\t\t$value = (int) round( $diff / $unit[1] );
\t\t\treturn $value . ' ' . $unit[0] . ( 1 === $value ? '' : 's' ) . ' ago';
\t\t}
\t}
\treturn 'just now';
}

function portfolio_light_site_seed() {
\t$site = portfolio_light_get_site_config();
\treturn $site['title'] ?? get_bloginfo( 'name' );
}

function portfolio_light_mock_analytics() {
\t$seed            = portfolio_light_site_seed();
\t$visitors_series = portfolio_light_mock_series( $seed . '::visitors', 30, 140 );
\t$sessions_series = portfolio_light_mock_series( $seed . '::sessions', 30, 210 );

\t$referrers_raw = [
\t\t[ 'source' => 'Direct',    'share' => 38 + ( portfolio_light_mock_hash( $seed . '::r0' ) % 12 ) ],
\t\t[ 'source' => 'Google',    'share' => 24 + ( portfolio_light_mock_hash( $seed . '::r1' ) % 10 ) ],
\t\t[ 'source' => 'Instagram', 'share' => 12 + ( portfolio_light_mock_hash( $seed . '::r2' ) %  8 ) ],
\t\t[ 'source' => 'LinkedIn',  'share' =>  8 + ( portfolio_light_mock_hash( $seed . '::r3' ) %  6 ) ],
\t\t[ 'source' => 'Other',     'share' =>  4 + ( portfolio_light_mock_hash( $seed . '::r4' ) %  6 ) ],
\t];
\t$total     = array_sum( array_column( $referrers_raw, 'share' ) ) ?: 1;
\t$referrers = array_map(
\t\tfunction( $r ) use ( $total ) {
\t\t\t$r['share'] = (int) round( ( $r['share'] / $total ) * 100 );
\t\t\treturn $r;
\t\t},
\t\t$referrers_raw
\t);

\treturn [
\t\t'visitors'       => (int) array_sum( $visitors_series ),
\t\t'visitorsSeries' => $visitors_series,
\t\t'visitorsTrend'  => portfolio_light_trend_pct( $visitors_series ),
\t\t'sessions'       => (int) array_sum( $sessions_series ),
\t\t'sessionsSeries' => $sessions_series,
\t\t'sessionsTrend'  => portfolio_light_trend_pct( $sessions_series ),
\t\t'avgSessionSec'  => 90 + ( portfolio_light_mock_hash( $seed ) % 240 ),
\t\t'bounceRate'     => 32 + ( portfolio_light_mock_hash( $seed . '::bounce' ) % 30 ),
\t\t'referrers'      => $referrers,
\t];
}

function portfolio_light_top_content( $limit = 6 ) {
\t$seed   = portfolio_light_site_seed();
\t$models = portfolio_light_get_models();
\t$items  = [];
\tforeach ( $models as $model ) {
\t\tif ( ( $model['type'] ?? '' ) !== 'collection' ) {
\t\t\tcontinue;
\t\t}
\t\t$posts = get_posts(
\t\t\t[
\t\t\t\t'post_type'      => $model['postType'],
\t\t\t\t'post_status'    => 'publish',
\t\t\t\t'posts_per_page' => 30,
\t\t\t\t'fields'         => 'ids',
\t\t\t]
\t\t);
\t\tforeach ( $posts as $post_id ) {
\t\t\t$series  = portfolio_light_mock_series( $seed . '::' . $model['id'] . '::' . $post_id, 30, 18, 0.9 );
\t\t\t$items[] = [
\t\t\t\t'id'         => $model['id'] . '-' . $post_id,
\t\t\t\t'recordId'   => $post_id,
\t\t\t\t'modelId'    => $model['id'],
\t\t\t\t'modelLabel' => $model['label'],
\t\t\t\t'title'      => get_the_title( $post_id ) ?: '(Untitled)',
\t\t\t\t'views'      => (int) array_sum( $series ),
\t\t\t\t'trend'      => portfolio_light_trend_pct( $series ),
\t\t\t\t'editPath'   => '/' . ( $model['adminPath'] ?? $model['id'] . 's' ) . '/' . $post_id,
\t\t\t];
\t\t}
\t}
\tusort( $items, function( $a, $b ) { return $b['views'] - $a['views']; } );
\treturn array_slice( $items, 0, $limit );
}

function portfolio_light_recent_activity_items( $limit = 12 ) {
\t$models = portfolio_light_get_models();
\t$items  = [];
\tforeach ( $models as $model ) {
\t\t$posts = get_posts(
\t\t\t[
\t\t\t\t'post_type'      => $model['postType'],
\t\t\t\t'post_status'    => 'any',
\t\t\t\t'posts_per_page' => $limit,
\t\t\t\t'orderby'        => 'modified',
\t\t\t\t'order'          => 'DESC',
\t\t\t]
\t\t);
\t\tforeach ( $posts as $post ) {
\t\t\t$modified = get_post_modified_time( 'c', true, $post );
\t\t\t$created  = get_post_time( 'c', true, $post );
\t\t\t$action   = abs( strtotime( $modified ) - strtotime( $created ) ) < 60 ? 'Created' : 'Updated';
\t\t\t$items[]  = [
\t\t\t\t'id'         => $model['id'] . '-' . $post->ID,
\t\t\t\t'recordId'   => $post->ID,
\t\t\t\t'modelId'    => $model['id'],
\t\t\t\t'modelLabel' => $model['label'],
\t\t\t\t'title'      => $post->post_title ?: '(Untitled)',
\t\t\t\t'modified'   => $modified,
\t\t\t\t'action'     => $action,
\t\t\t\t'editPath'   => '/' . ( $model['adminPath'] ?? $model['id'] . 's' ) . '/' . $post->ID,
\t\t\t];
\t\t}
\t}
\tusort( $items, function( $a, $b ) { return strcmp( $b['modified'], $a['modified'] ); } );
\treturn array_slice( $items, 0, $limit );
}

function portfolio_light_collection_breakdown() {
\t$models            = portfolio_light_get_models();
\t$collection_models = array_values( array_filter( $models, function( $m ) {
\t\treturn ( $m['type'] ?? '' ) === 'collection';
\t} ) );
\t$total  = max( count( $collection_models ), 1 );
\t$result = [];
\tforeach ( $collection_models as $i => $model ) {
\t\t$tally    = wp_count_posts( $model['postType'] );
\t\t$count    = (int) ( $tally->publish ?? 0 ) + (int) ( $tally->draft ?? 0 );
\t\t$result[] = [
\t\t\t'id'    => $model['id'],
\t\t\t'label' => $model['label'],
\t\t\t'count' => $count,
\t\t\t'hue'   => (int) round( ( $i * 360 ) / $total ),
\t\t];
\t}
\treturn $result;
}
`;
}

