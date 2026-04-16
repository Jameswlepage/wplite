// Generates the `register-abilities.php` file for the compiled plugin.
//
// This registers:
//  1. A "wplite" ability category (via wp_register_ability_category).
//  2. A baseline set of read abilities that expose wplite's content model to
//     any MCP client (Abilities API shows_in_rest + attached to the MCP server).
//  3. An MCP server through the official WordPress/mcp-adapter package, served
//     at /wp-json/wplite/mcp. Registration is guarded by class_exists so the
//     generated plugin stays functional even when the adapter is absent.

export function phpRegisterAbilitiesFile() {
  return `<?php
defined( 'ABSPATH' ) || exit;

/**
 * IDs of wplite abilities exposed through the MCP server.
 * Extend this list when you add new registrations below.
 */
function portfolio_light_mcp_ability_ids() {
\treturn [
\t\t'wplite/get-site-info',
\t\t'wplite/list-models',
\t\t'wplite/list-items',
\t\t'wplite/get-item',
\t\t'wplite/create-item',
\t\t'wplite/update-item',
\t\t'wplite/delete-item',
\t\t'wplite/list-pages',
\t\t'wplite/get-page',
\t\t'wplite/create-page',
\t\t'wplite/update-page',
\t\t'wplite/delete-page',
\t\t'wplite/list-singletons',
\t\t'wplite/get-singleton',
\t\t'wplite/update-singleton',
\t];
}

function portfolio_light_mcp_server_id() {
\treturn 'wplite';
}

function portfolio_light_mcp_server_namespace() {
\treturn 'wplite';
}

function portfolio_light_mcp_server_route() {
\treturn 'mcp';
}

/**
 * Public endpoint URL for the MCP server, used by the admin app to show
 * the "point an MCP client here" copyable string.
 */
function portfolio_light_mcp_server_url() {
\treturn rest_url(
\t\tportfolio_light_mcp_server_namespace() . '/' . portfolio_light_mcp_server_route()
\t);
}

/**
 * Summary payload exposed to the admin app via the bootstrap REST response.
 * Keeps the Connectors settings tab fully static — no extra fetch needed.
 */
function portfolio_light_get_mcp_info() {
\t$oauth_available = class_exists( '\\\\WPMCPOAuth\\\\Bearer' );
\treturn [
\t\t'available'       => class_exists( '\\\\WP\\\\MCP\\\\Core\\\\McpAdapter' ),
\t\t'serverId'        => portfolio_light_mcp_server_id(),
\t\t'namespace'       => portfolio_light_mcp_server_namespace(),
\t\t'route'           => portfolio_light_mcp_server_route(),
\t\t'endpoint'        => portfolio_light_mcp_server_url(),
\t\t'abilities'       => portfolio_light_mcp_ability_ids(),
\t\t'oauthAvailable'  => $oauth_available,
\t\t'oauthDiscoveryUrl' => $oauth_available ? home_url( '/.well-known/oauth-authorization-server' ) : null,
\t];
}

// ── Categories ────────────────────────────────────────────────────────────
add_action( 'wp_abilities_api_categories_init', function() {
\tif ( ! function_exists( 'wp_register_ability_category' ) ) {
\t\treturn;
\t}
\twp_register_ability_category( 'wplite', [
\t\t'label'       => __( 'WPLite', 'wplite' ),
\t\t'description' => __( 'Core abilities exposed by the wplite runtime.', 'wplite' ),
\t] );
} );

// ── Abilities ─────────────────────────────────────────────────────────────
add_action( 'wp_abilities_api_init', function() {
\tif ( ! function_exists( 'wp_register_ability' ) ) {
\t\treturn;
\t}

\t$can_read = function() {
\t\treturn current_user_can( 'read' );
\t};
\t$can_edit = function() {
\t\treturn current_user_can( 'edit_posts' );
\t};

\twp_register_ability( 'wplite/get-site-info', [
\t\t'label'               => __( 'Get site info', 'wplite' ),
\t\t'description'         => __( 'Returns the site title, tagline, URL, admin email, locale, and timezone.', 'wplite' ),
\t\t'category'            => 'wplite',
\t\t'input_schema'        => [ 'type' => 'object', 'properties' => (object) [] ],
\t\t'output_schema'       => [
\t\t\t'type' => 'object',
\t\t\t'properties' => [
\t\t\t\t'title'       => [ 'type' => 'string' ],
\t\t\t\t'description' => [ 'type' => 'string' ],
\t\t\t\t'url'         => [ 'type' => 'string' ],
\t\t\t\t'adminEmail'  => [ 'type' => 'string' ],
\t\t\t\t'locale'      => [ 'type' => 'string' ],
\t\t\t\t'timezone'    => [ 'type' => 'string' ],
\t\t\t],
\t\t],
\t\t'permission_callback' => $can_read,
\t\t'execute_callback'    => function() {
\t\t\treturn [
\t\t\t\t'title'       => (string) get_bloginfo( 'name' ),
\t\t\t\t'description' => (string) get_bloginfo( 'description' ),
\t\t\t\t'url'         => (string) home_url( '/' ),
\t\t\t\t'adminEmail'  => (string) get_option( 'admin_email' ),
\t\t\t\t'locale'      => (string) get_locale(),
\t\t\t\t'timezone'    => (string) wp_timezone_string(),
\t\t\t];
\t\t},
\t\t'meta' => [
\t\t\t'readonly'     => true,
\t\t\t'show_in_rest' => true,
\t\t],
\t] );

\twp_register_ability( 'wplite/list-models', [
\t\t'label'               => __( 'List content models', 'wplite' ),
\t\t'description'         => __( 'Returns the id, label, post type, and field summary for every content model registered on the site.', 'wplite' ),
\t\t'category'            => 'wplite',
\t\t'input_schema'        => [ 'type' => 'object', 'properties' => (object) [] ],
\t\t'output_schema'       => [
\t\t\t'type' => 'array',
\t\t\t'items' => [
\t\t\t\t'type' => 'object',
\t\t\t\t'properties' => [
\t\t\t\t\t'id'           => [ 'type' => 'string' ],
\t\t\t\t\t'label'        => [ 'type' => 'string' ],
\t\t\t\t\t'postType'     => [ 'type' => 'string' ],
\t\t\t\t\t'type'         => [ 'type' => 'string' ],
\t\t\t\t\t'fields'       => [ 'type' => 'array', 'items' => [ 'type' => 'string' ] ],
\t\t\t\t],
\t\t\t],
\t\t],
\t\t'permission_callback' => $can_read,
\t\t'execute_callback'    => function() {
\t\t\t$models = portfolio_light_get_admin_models();
\t\t\treturn array_map( function( $model ) {
\t\t\t\treturn [
\t\t\t\t\t'id'           => (string) ( $model['id'] ?? '' ),
\t\t\t\t\t'label'        => (string) ( $model['label'] ?? '' ),
\t\t\t\t\t'postType'     => (string) ( $model['postType'] ?? '' ),
\t\t\t\t\t'type'         => (string) ( $model['type'] ?? 'collection' ),
\t\t\t\t\t'fields'       => array_keys( (array) ( $model['fields'] ?? [] ) ),
\t\t\t\t];
\t\t\t}, $models );
\t\t},
\t\t'meta' => [
\t\t\t'readonly'     => true,
\t\t\t'show_in_rest' => true,
\t\t],
\t] );

\twp_register_ability( 'wplite/list-items', [
\t\t'label'               => __( 'List items', 'wplite' ),
\t\t'description'         => __( 'Returns all items of a given content model. Provide a model id (e.g. "project", "post"). Returns compiler-normalized records.', 'wplite' ),
\t\t'category'            => 'wplite',
\t\t'input_schema'        => [
\t\t\t'type' => 'object',
\t\t\t'required' => [ 'model' ],
\t\t\t'properties' => [
\t\t\t\t'model'  => [ 'type' => 'string', 'description' => 'Content model id.' ],
\t\t\t\t'status' => [
\t\t\t\t\t'type' => 'string',
\t\t\t\t\t'description' => 'Optional post status filter. Defaults to "any".',
\t\t\t\t\t'enum' => [ 'any', 'publish', 'draft', 'private', 'pending', 'future', 'trash' ],
\t\t\t\t],
\t\t\t\t'limit'  => [ 'type' => 'integer', 'minimum' => 1, 'maximum' => 500, 'default' => 50 ],
\t\t\t],
\t\t],
\t\t'output_schema'       => [
\t\t\t'type' => 'array',
\t\t\t'items' => [ 'type' => 'object' ],
\t\t],
\t\t'permission_callback' => $can_read,
\t\t'execute_callback'    => function( $input ) {
\t\t\t$model_id = isset( $input['model'] ) ? (string) $input['model'] : '';
\t\t\t$model    = portfolio_light_get_model( $model_id );
\t\t\tif ( ! $model ) {
\t\t\t\treturn new WP_Error( 'wplite_unknown_model', sprintf( 'Unknown model "%s".', $model_id ) );
\t\t\t}
\t\t\t$status = isset( $input['status'] ) ? (string) $input['status'] : 'any';
\t\t\t$limit  = isset( $input['limit'] ) ? max( 1, min( 500, (int) $input['limit'] ) ) : 50;
\t\t\t$posts = get_posts( [
\t\t\t\t'post_type'      => $model['postType'],
\t\t\t\t'post_status'    => $status,
\t\t\t\t'posts_per_page' => $limit,
\t\t\t\t'orderby'        => 'modified',
\t\t\t\t'order'          => 'DESC',
\t\t\t] );
\t\t\treturn array_map( function( $post ) use ( $model ) {
\t\t\t\treturn portfolio_light_prepare_record( $post, $model );
\t\t\t}, $posts );
\t\t},
\t\t'meta' => [
\t\t\t'readonly'     => true,
\t\t\t'show_in_rest' => true,
\t\t],
\t] );

\twp_register_ability( 'wplite/get-item', [
\t\t'label'               => __( 'Get item', 'wplite' ),
\t\t'description'         => __( 'Returns a single item by model and id (or slug).', 'wplite' ),
\t\t'category'            => 'wplite',
\t\t'input_schema'        => [
\t\t\t'type' => 'object',
\t\t\t'required' => [ 'model' ],
\t\t\t'properties' => [
\t\t\t\t'model' => [ 'type' => 'string' ],
\t\t\t\t'id'    => [ 'type' => 'integer', 'minimum' => 1 ],
\t\t\t\t'slug'  => [ 'type' => 'string' ],
\t\t\t],
\t\t],
\t\t'output_schema'       => [ 'type' => 'object' ],
\t\t'permission_callback' => $can_read,
\t\t'execute_callback'    => function( $input ) {
\t\t\t$model_id = isset( $input['model'] ) ? (string) $input['model'] : '';
\t\t\t$model    = portfolio_light_get_model( $model_id );
\t\t\tif ( ! $model ) {
\t\t\t\treturn new WP_Error( 'wplite_unknown_model', sprintf( 'Unknown model "%s".', $model_id ) );
\t\t\t}
\t\t\t$post = null;
\t\t\tif ( ! empty( $input['id'] ) ) {
\t\t\t\t$post = get_post( (int) $input['id'] );
\t\t\t} elseif ( ! empty( $input['slug'] ) ) {
\t\t\t\t$found = get_posts( [
\t\t\t\t\t'post_type'      => $model['postType'],
\t\t\t\t\t'name'           => sanitize_title( (string) $input['slug'] ),
\t\t\t\t\t'post_status'    => 'any',
\t\t\t\t\t'posts_per_page' => 1,
\t\t\t\t] );
\t\t\t\t$post = $found ? $found[0] : null;
\t\t\t}
\t\t\tif ( ! $post || $post->post_type !== $model['postType'] ) {
\t\t\t\treturn new WP_Error( 'wplite_item_not_found', 'Item not found.' );
\t\t\t}
\t\t\treturn portfolio_light_prepare_record( $post, $model );
\t\t},
\t\t'meta' => [
\t\t\t'readonly'     => true,
\t\t\t'show_in_rest' => true,
\t\t],
\t] );

\twp_register_ability( 'wplite/list-pages', [
\t\t'label'               => __( 'List pages', 'wplite' ),
\t\t'description'         => __( 'Returns every page on the site with its id, title, slug, status, and source-file path.', 'wplite' ),
\t\t'category'            => 'wplite',
\t\t'input_schema'        => [
\t\t\t'type' => 'object',
\t\t\t'properties' => [
\t\t\t\t'status' => [
\t\t\t\t\t'type' => 'string',
\t\t\t\t\t'enum' => [ 'any', 'publish', 'draft', 'private', 'pending' ],
\t\t\t\t],
\t\t\t\t'limit'  => [ 'type' => 'integer', 'minimum' => 1, 'maximum' => 500, 'default' => 100 ],
\t\t\t],
\t\t],
\t\t'output_schema'       => [ 'type' => 'array', 'items' => [ 'type' => 'object' ] ],
\t\t'permission_callback' => $can_read,
\t\t'execute_callback'    => function( $input ) {
\t\t\t$status = isset( $input['status'] ) ? (string) $input['status'] : 'any';
\t\t\t$limit  = isset( $input['limit'] ) ? max( 1, min( 500, (int) $input['limit'] ) ) : 100;
\t\t\t$posts = get_posts( [
\t\t\t\t'post_type'      => 'page',
\t\t\t\t'post_status'    => $status,
\t\t\t\t'posts_per_page' => $limit,
\t\t\t\t'orderby'        => 'modified',
\t\t\t\t'order'          => 'DESC',
\t\t\t] );
\t\t\treturn array_map( 'portfolio_light_prepare_page_record', $posts );
\t\t},
\t\t'meta' => [
\t\t\t'readonly'     => true,
\t\t\t'show_in_rest' => true,
\t\t],
\t] );

\twp_register_ability( 'wplite/get-page', [
\t\t'label'               => __( 'Get page', 'wplite' ),
\t\t'description'         => __( 'Returns a single page by id or slug, including its block content as rendered Gutenberg markup.', 'wplite' ),
\t\t'category'            => 'wplite',
\t\t'input_schema'        => [
\t\t\t'type' => 'object',
\t\t\t'properties' => [
\t\t\t\t'id'   => [ 'type' => 'integer', 'minimum' => 1 ],
\t\t\t\t'slug' => [ 'type' => 'string' ],
\t\t\t],
\t\t],
\t\t'output_schema'       => [ 'type' => 'object' ],
\t\t'permission_callback' => $can_read,
\t\t'execute_callback'    => function( $input ) {
\t\t\t$post = null;
\t\t\tif ( ! empty( $input['id'] ) ) {
\t\t\t\t$post = get_post( (int) $input['id'] );
\t\t\t} elseif ( ! empty( $input['slug'] ) ) {
\t\t\t\t$found = get_posts( [
\t\t\t\t\t'post_type'      => 'page',
\t\t\t\t\t'name'           => sanitize_title( (string) $input['slug'] ),
\t\t\t\t\t'post_status'    => 'any',
\t\t\t\t\t'posts_per_page' => 1,
\t\t\t\t] );
\t\t\t\t$post = $found ? $found[0] : null;
\t\t\t}
\t\t\tif ( ! $post || $post->post_type !== 'page' ) {
\t\t\t\treturn new WP_Error( 'wplite_page_not_found', 'Page not found.' );
\t\t\t}
\t\t\treturn portfolio_light_prepare_page_record( $post );
\t\t},
\t\t'meta' => [
\t\t\t'readonly'     => true,
\t\t\t'show_in_rest' => true,
\t\t],
\t] );

\twp_register_ability( 'wplite/list-singletons', [
\t\t'label'               => __( 'List singletons', 'wplite' ),
\t\t'description'         => __( 'Returns all site-wide singleton settings surfaces (e.g. "site", "seo").', 'wplite' ),
\t\t'category'            => 'wplite',
\t\t'input_schema'        => [ 'type' => 'object', 'properties' => (object) [] ],
\t\t'output_schema'       => [ 'type' => 'array', 'items' => [ 'type' => 'object' ] ],
\t\t'permission_callback' => $can_read,
\t\t'execute_callback'    => function() {
\t\t\t$singletons = portfolio_light_get_singletons();
\t\t\treturn array_map( function( $s ) {
\t\t\t\treturn [
\t\t\t\t\t'id'     => (string) ( $s['id'] ?? '' ),
\t\t\t\t\t'label'  => (string) ( $s['label'] ?? '' ),
\t\t\t\t\t'fields' => array_keys( (array) ( $s['fields'] ?? [] ) ),
\t\t\t\t];
\t\t\t}, $singletons );
\t\t},
\t\t'meta' => [
\t\t\t'readonly'     => true,
\t\t\t'show_in_rest' => true,
\t\t],
\t] );

\twp_register_ability( 'wplite/get-singleton', [
\t\t'label'               => __( 'Get singleton', 'wplite' ),
\t\t'description'         => __( 'Returns the current values for a singleton (with inheritance from core site values applied).', 'wplite' ),
\t\t'category'            => 'wplite',
\t\t'input_schema'        => [
\t\t\t'type' => 'object',
\t\t\t'required' => [ 'id' ],
\t\t\t'properties' => [
\t\t\t\t'id' => [ 'type' => 'string' ],
\t\t\t],
\t\t],
\t\t'output_schema'       => [ 'type' => 'object' ],
\t\t'permission_callback' => $can_edit,
\t\t'execute_callback'    => function( $input ) {
\t\t\t$id = isset( $input['id'] ) ? (string) $input['id'] : '';
\t\t\t$schema = portfolio_light_get_singleton_schema( $id );
\t\t\tif ( ! $schema ) {
\t\t\t\treturn new WP_Error( 'wplite_unknown_singleton', sprintf( 'Unknown singleton "%s".', $id ) );
\t\t\t}
\t\t\treturn (object) portfolio_light_singleton_with_inheritance( $id );
\t\t},
\t\t'meta' => [
\t\t\t'readonly'     => true,
\t\t\t'show_in_rest' => true,
\t\t],
\t] );

\t// ── Write abilities ─────────────────────────────────────────────────
\t// All writes hit WordPress directly. Source-of-truth sync back to
\t// flat files is the job of \`wp-lite pull\`.

\t$page_to_payload = function( $input, $existing_id = 0 ) {
\t\t$payload = [];
\t\tif ( array_key_exists( 'title', $input ) )      $payload['post_title']   = wp_strip_all_tags( (string) $input['title'] );
\t\tif ( array_key_exists( 'slug', $input ) )       $payload['post_name']    = sanitize_title( (string) $input['slug'] );
\t\tif ( array_key_exists( 'status', $input ) )     $payload['post_status']  = sanitize_key( (string) $input['status'] );
\t\tif ( array_key_exists( 'content', $input ) )    $payload['post_content'] = (string) $input['content'];
\t\tif ( array_key_exists( 'parent', $input ) )     $payload['post_parent']  = (int) $input['parent'];
\t\tif ( array_key_exists( 'menuOrder', $input ) )  $payload['menu_order']   = (int) $input['menuOrder'];
\t\tif ( $existing_id > 0 )                          $payload['ID']           = $existing_id;
\t\treturn $payload;
\t};

\twp_register_ability( 'wplite/create-item', [
\t\t'label'               => __( 'Create item', 'wplite' ),
\t\t'description'         => __( 'Creates a new item in a content model. Accepts title, optional slug/status/content, and model-defined fields.', 'wplite' ),
\t\t'category'            => 'wplite',
\t\t'input_schema'        => [
\t\t\t'type' => 'object',
\t\t\t'required' => [ 'model' ],
\t\t\t'properties' => [
\t\t\t\t'model'   => [ 'type' => 'string', 'description' => 'Content model id.' ],
\t\t\t\t'title'   => [ 'type' => 'string' ],
\t\t\t\t'slug'    => [ 'type' => 'string' ],
\t\t\t\t'status'  => [ 'type' => 'string', 'enum' => [ 'publish', 'draft', 'private', 'pending' ] ],
\t\t\t\t'content' => [ 'type' => 'string', 'description' => 'Gutenberg block markup for the body.' ],
\t\t\t\t'fields'  => [ 'type' => 'object', 'description' => 'Custom model fields keyed by field id.', 'additionalProperties' => true ],
\t\t\t],
\t\t],
\t\t'output_schema'       => [ 'type' => 'object' ],
\t\t'permission_callback' => $can_edit,
\t\t'execute_callback'    => function( $input ) {
\t\t\t$model = portfolio_light_get_model( (string) ( $input['model'] ?? '' ) );
\t\t\tif ( ! $model ) return new WP_Error( 'wplite_unknown_model', 'Unknown model.' );
\t\t\t$payload = array_merge(
\t\t\t\t[
\t\t\t\t\t'title'      => (string) ( $input['title'] ?? '' ),
\t\t\t\t\t'slug'       => (string) ( $input['slug'] ?? '' ),
\t\t\t\t\t'postStatus' => (string) ( $input['status'] ?? 'draft' ),
\t\t\t\t\t'content'    => (string) ( $input['content'] ?? '' ),
\t\t\t\t],
\t\t\t\tis_array( $input['fields'] ?? null ) ? $input['fields'] : []
\t\t\t);
\t\t\t$post = portfolio_light_upsert_record( $model, $payload );
\t\t\tif ( is_wp_error( $post ) ) return $post;
\t\t\treturn portfolio_light_prepare_record( $post, $model );
\t\t},
\t\t'meta' => [ 'show_in_rest' => true ],
\t] );

\twp_register_ability( 'wplite/update-item', [
\t\t'label'               => __( 'Update item', 'wplite' ),
\t\t'description'         => __( 'Updates an existing item. Only provided fields change; omitted fields are left alone.', 'wplite' ),
\t\t'category'            => 'wplite',
\t\t'input_schema'        => [
\t\t\t'type' => 'object',
\t\t\t'required' => [ 'model', 'id' ],
\t\t\t'properties' => [
\t\t\t\t'model'   => [ 'type' => 'string' ],
\t\t\t\t'id'      => [ 'type' => 'integer', 'minimum' => 1 ],
\t\t\t\t'title'   => [ 'type' => 'string' ],
\t\t\t\t'slug'    => [ 'type' => 'string' ],
\t\t\t\t'status'  => [ 'type' => 'string', 'enum' => [ 'publish', 'draft', 'private', 'pending' ] ],
\t\t\t\t'content' => [ 'type' => 'string' ],
\t\t\t\t'fields'  => [ 'type' => 'object', 'additionalProperties' => true ],
\t\t\t],
\t\t],
\t\t'output_schema'       => [ 'type' => 'object' ],
\t\t'permission_callback' => $can_edit,
\t\t'execute_callback'    => function( $input ) {
\t\t\t$model = portfolio_light_get_model( (string) ( $input['model'] ?? '' ) );
\t\t\tif ( ! $model ) return new WP_Error( 'wplite_unknown_model', 'Unknown model.' );
\t\t\t$id = (int) ( $input['id'] ?? 0 );
\t\t\tif ( $id <= 0 ) return new WP_Error( 'wplite_invalid_id', 'id is required.' );
\t\t\t$existing = get_post( $id );
\t\t\tif ( ! $existing || $existing->post_type !== $model['postType'] ) {
\t\t\t\treturn new WP_Error( 'wplite_item_not_found', 'Item not found for model.' );
\t\t\t}
\t\t\t$payload = [];
\t\t\tif ( array_key_exists( 'title', $input ) )   $payload['title']      = (string) $input['title'];
\t\t\tif ( array_key_exists( 'slug', $input ) )    $payload['slug']       = (string) $input['slug'];
\t\t\tif ( array_key_exists( 'status', $input ) )  $payload['postStatus'] = (string) $input['status'];
\t\t\tif ( array_key_exists( 'content', $input ) ) $payload['content']    = (string) $input['content'];
\t\t\tif ( is_array( $input['fields'] ?? null ) ) {
\t\t\t\t$payload = array_merge( $payload, $input['fields'] );
\t\t\t}
\t\t\t$post = portfolio_light_upsert_record( $model, $payload, $id );
\t\t\tif ( is_wp_error( $post ) ) return $post;
\t\t\treturn portfolio_light_prepare_record( $post, $model );
\t\t},
\t\t'meta' => [ 'show_in_rest' => true ],
\t] );

\twp_register_ability( 'wplite/delete-item', [
\t\t'label'               => __( 'Delete item', 'wplite' ),
\t\t'description'         => __( 'Deletes an item. By default trashes; pass force=true to bypass trash.', 'wplite' ),
\t\t'category'            => 'wplite',
\t\t'input_schema'        => [
\t\t\t'type' => 'object',
\t\t\t'required' => [ 'model', 'id' ],
\t\t\t'properties' => [
\t\t\t\t'model' => [ 'type' => 'string' ],
\t\t\t\t'id'    => [ 'type' => 'integer', 'minimum' => 1 ],
\t\t\t\t'force' => [ 'type' => 'boolean', 'default' => false ],
\t\t\t],
\t\t],
\t\t'output_schema'       => [ 'type' => 'object' ],
\t\t'permission_callback' => $can_edit,
\t\t'execute_callback'    => function( $input ) {
\t\t\t$model = portfolio_light_get_model( (string) ( $input['model'] ?? '' ) );
\t\t\tif ( ! $model ) return new WP_Error( 'wplite_unknown_model', 'Unknown model.' );
\t\t\t$id = (int) ( $input['id'] ?? 0 );
\t\t\t$existing = get_post( $id );
\t\t\tif ( ! $existing || $existing->post_type !== $model['postType'] ) {
\t\t\t\treturn new WP_Error( 'wplite_item_not_found', 'Item not found for model.' );
\t\t\t}
\t\t\t$force = ! empty( $input['force'] );
\t\t\t$result = wp_delete_post( $id, $force );
\t\t\treturn [ 'ok' => (bool) $result, 'id' => $id, 'trashed' => ! $force ];
\t\t},
\t\t'meta' => [ 'show_in_rest' => true ],
\t] );

\twp_register_ability( 'wplite/create-page', [
\t\t'label'               => __( 'Create page', 'wplite' ),
\t\t'description'         => __( 'Creates a new WordPress page. Use Gutenberg block markup for content.', 'wplite' ),
\t\t'category'            => 'wplite',
\t\t'input_schema'        => [
\t\t\t'type' => 'object',
\t\t\t'required' => [ 'title' ],
\t\t\t'properties' => [
\t\t\t\t'title'     => [ 'type' => 'string' ],
\t\t\t\t'slug'      => [ 'type' => 'string' ],
\t\t\t\t'status'    => [ 'type' => 'string', 'enum' => [ 'publish', 'draft', 'private', 'pending' ], 'default' => 'draft' ],
\t\t\t\t'content'   => [ 'type' => 'string', 'description' => 'Gutenberg block markup.' ],
\t\t\t\t'template'  => [ 'type' => 'string' ],
\t\t\t\t'parent'    => [ 'type' => 'integer', 'minimum' => 0 ],
\t\t\t\t'menuOrder' => [ 'type' => 'integer' ],
\t\t\t],
\t\t],
\t\t'output_schema'       => [ 'type' => 'object' ],
\t\t'permission_callback' => $can_edit,
\t\t'execute_callback'    => function( $input ) use ( $page_to_payload ) {
\t\t\t$payload = $page_to_payload( $input );
\t\t\t$payload['post_type']   = 'page';
\t\t\t$payload['post_status'] = $payload['post_status'] ?? 'draft';
\t\t\t$id = wp_insert_post( $payload, true );
\t\t\tif ( is_wp_error( $id ) ) return $id;
\t\t\tif ( ! empty( $input['template'] ) ) {
\t\t\t\tupdate_post_meta( $id, '_wp_page_template', sanitize_text_field( (string) $input['template'] ) );
\t\t\t}
\t\t\treturn portfolio_light_prepare_page_record( get_post( $id ) );
\t\t},
\t\t'meta' => [ 'show_in_rest' => true ],
\t] );

\twp_register_ability( 'wplite/update-page', [
\t\t'label'               => __( 'Update page', 'wplite' ),
\t\t'description'         => __( 'Updates an existing page. Only provided fields change; omitted fields are left alone.', 'wplite' ),
\t\t'category'            => 'wplite',
\t\t'input_schema'        => [
\t\t\t'type' => 'object',
\t\t\t'required' => [ 'id' ],
\t\t\t'properties' => [
\t\t\t\t'id'        => [ 'type' => 'integer', 'minimum' => 1 ],
\t\t\t\t'title'     => [ 'type' => 'string' ],
\t\t\t\t'slug'      => [ 'type' => 'string' ],
\t\t\t\t'status'    => [ 'type' => 'string', 'enum' => [ 'publish', 'draft', 'private', 'pending' ] ],
\t\t\t\t'content'   => [ 'type' => 'string' ],
\t\t\t\t'template'  => [ 'type' => 'string' ],
\t\t\t\t'parent'    => [ 'type' => 'integer', 'minimum' => 0 ],
\t\t\t\t'menuOrder' => [ 'type' => 'integer' ],
\t\t\t],
\t\t],
\t\t'output_schema'       => [ 'type' => 'object' ],
\t\t'permission_callback' => $can_edit,
\t\t'execute_callback'    => function( $input ) use ( $page_to_payload ) {
\t\t\t$id = (int) ( $input['id'] ?? 0 );
\t\t\t$existing = get_post( $id );
\t\t\tif ( ! $existing || $existing->post_type !== 'page' ) {
\t\t\t\treturn new WP_Error( 'wplite_page_not_found', 'Page not found.' );
\t\t\t}
\t\t\t$payload = $page_to_payload( $input, $id );
\t\t\tif ( count( $payload ) > 1 ) { // more than just ID
\t\t\t\t$result = wp_update_post( $payload, true );
\t\t\t\tif ( is_wp_error( $result ) ) return $result;
\t\t\t}
\t\t\tif ( array_key_exists( 'template', $input ) ) {
\t\t\t\tupdate_post_meta( $id, '_wp_page_template', sanitize_text_field( (string) $input['template'] ) );
\t\t\t}
\t\t\treturn portfolio_light_prepare_page_record( get_post( $id ) );
\t\t},
\t\t'meta' => [ 'show_in_rest' => true ],
\t] );

\twp_register_ability( 'wplite/delete-page', [
\t\t'label'               => __( 'Delete page', 'wplite' ),
\t\t'description'         => __( 'Deletes a page. By default trashes; pass force=true to bypass trash.', 'wplite' ),
\t\t'category'            => 'wplite',
\t\t'input_schema'        => [
\t\t\t'type' => 'object',
\t\t\t'required' => [ 'id' ],
\t\t\t'properties' => [
\t\t\t\t'id'    => [ 'type' => 'integer', 'minimum' => 1 ],
\t\t\t\t'force' => [ 'type' => 'boolean', 'default' => false ],
\t\t\t],
\t\t],
\t\t'output_schema'       => [ 'type' => 'object' ],
\t\t'permission_callback' => $can_edit,
\t\t'execute_callback'    => function( $input ) {
\t\t\t$id = (int) ( $input['id'] ?? 0 );
\t\t\t$existing = get_post( $id );
\t\t\tif ( ! $existing || $existing->post_type !== 'page' ) {
\t\t\t\treturn new WP_Error( 'wplite_page_not_found', 'Page not found.' );
\t\t\t}
\t\t\t$force = ! empty( $input['force'] );
\t\t\t$result = wp_delete_post( $id, $force );
\t\t\treturn [ 'ok' => (bool) $result, 'id' => $id, 'trashed' => ! $force ];
\t\t},
\t\t'meta' => [ 'show_in_rest' => true ],
\t] );

\twp_register_ability( 'wplite/update-singleton', [
\t\t'label'               => __( 'Update singleton', 'wplite' ),
\t\t'description'         => __( 'Writes new values into a singleton. Merges with existing data — only keys you pass get overwritten.', 'wplite' ),
\t\t'category'            => 'wplite',
\t\t'input_schema'        => [
\t\t\t'type' => 'object',
\t\t\t'required' => [ 'id', 'data' ],
\t\t\t'properties' => [
\t\t\t\t'id'   => [ 'type' => 'string' ],
\t\t\t\t'data' => [ 'type' => 'object', 'additionalProperties' => true ],
\t\t\t],
\t\t],
\t\t'output_schema'       => [ 'type' => 'object' ],
\t\t'permission_callback' => $can_edit,
\t\t'execute_callback'    => function( $input ) {
\t\t\t$id = (string) ( $input['id'] ?? '' );
\t\t\t$schema = portfolio_light_get_singleton_schema( $id );
\t\t\tif ( ! $schema ) return new WP_Error( 'wplite_unknown_singleton', 'Unknown singleton.' );
\t\t\t$data = is_array( $input['data'] ?? null ) ? $input['data'] : [];
\t\t\t$current = get_option( 'portfolio_singleton_' . $id, [] );
\t\t\tif ( ! is_array( $current ) ) $current = [];
\t\t\t$merged = $current;
\t\t\tforeach ( $schema['fields'] ?? [] as $field_id => $field ) {
\t\t\t\tif ( array_key_exists( $field_id, $data ) ) {
\t\t\t\t\t$merged[ $field_id ] = portfolio_light_cast_field_value( $field, $data[ $field_id ] );
\t\t\t\t}
\t\t\t}
\t\t\tupdate_option( 'portfolio_singleton_' . $id, $merged );
\t\t\treturn (object) portfolio_light_singleton_with_inheritance( $id );
\t\t},
\t\t'meta' => [ 'show_in_rest' => true ],
\t] );
} );

// ── MCP server (via WordPress/mcp-adapter) ────────────────────────────────
add_action( 'plugins_loaded', function() {
\tif ( ! class_exists( '\\\\WP\\\\MCP\\\\Core\\\\McpAdapter' ) ) {
\t\treturn;
\t}
\t// Boot the adapter singleton; idempotent.
\t\\WP\\MCP\\Core\\McpAdapter::instance();
}, 20 );

add_action( 'mcp_adapter_init', function( $adapter ) {
\tif ( ! is_object( $adapter ) || ! method_exists( $adapter, 'create_server' ) ) {
\t\treturn;
\t}
\t// If the wp-mcp-oauth plugin is active, delegate transport auth to its
\t// Bearer validator so Claude Desktop's OAuth connector flow works. Otherwise
\t// fall through to the adapter's default is_user_logged_in() check, which is
\t// fine for same-origin admin-app traffic.
\t$permission_callback = class_exists( '\\\\WPMCPOAuth\\\\Bearer' )
\t\t? [ '\\\\WPMCPOAuth\\\\Bearer', 'check_request' ]
\t\t: null;

\t$adapter->create_server(
\t\tportfolio_light_mcp_server_id(),
\t\tportfolio_light_mcp_server_namespace(),
\t\tportfolio_light_mcp_server_route(),
\t\t__( 'WPLite', 'wplite' ),
\t\t__( 'Expose this wplite site (site info, content models, pages, singletons) to any MCP client.', 'wplite' ),
\t\t'v1.0.0',
\t\t[ '\\\\WP\\\\MCP\\\\Transport\\\\HttpTransport' ],
\t\t'\\\\WP\\\\MCP\\\\Infrastructure\\\\ErrorHandling\\\\ErrorLogMcpErrorHandler',
\t\t'\\\\WP\\\\MCP\\\\Infrastructure\\\\Observability\\\\NullMcpObservabilityHandler',
\t\tportfolio_light_mcp_ability_ids(),
\t\t[],
\t\t[],
\t\t$permission_callback
\t);
} );

// Tell wp-mcp-oauth that our MCP route is a protected resource so it will
// emit the RFC 9728 WWW-Authenticate challenge on 401 responses and refuse to
// validate tokens bound to any other resource URI.
add_filter( 'wp_mcp_oauth_protected_resources', function( $resources ) {
\t$resources   = is_array( $resources ) ? $resources : [];
\t$resources[] = portfolio_light_mcp_server_url();
\treturn $resources;
} );

add_filter( 'wp_mcp_oauth_default_resource', function() {
\treturn portfolio_light_mcp_server_url();
} );
`;
}
