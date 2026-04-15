// Generates the `register-rest.php` file included by the compiled plugin.
export function phpRegisterRestFile() {
  return `<?php
defined( 'ABSPATH' ) || exit;

function portfolio_light_rest_can_edit() {
\treturn current_user_can( 'edit_posts' );
}

function portfolio_light_normalize_comment_default_status( $value ) {
\t$value = sanitize_key( (string) $value );
\treturn 'open' === $value ? 'open' : 'closed';
}

add_action( 'init', function() {
\tregister_setting(
\t\t'discussion',
\t\t'default_comment_status',
\t\t[
\t\t\t'type'              => 'string',
\t\t\t'description'       => 'Default comment state for new posts and pages.',
\t\t\t'sanitize_callback' => 'portfolio_light_normalize_comment_default_status',
\t\t\t'default'           => 'closed',
\t\t\t'show_in_rest'      => [
\t\t\t\t'schema' => [
\t\t\t\t\t'type' => 'string',
\t\t\t\t\t'enum' => [ 'open', 'closed' ],
\t\t\t\t],
\t\t\t],
\t\t]
\t);
} );

add_action( 'rest_api_init', function() {
\tregister_rest_field(
\t\t'page',
\t\t'portfolioRouteId',
\t\t[
\t\t\t'get_callback' => function( $page ) {
\t\t\t\treturn (string) get_post_meta( (int) ( $page['id'] ?? 0 ), '_portfolio_route_id', true );
\t\t\t},
\t\t\t'schema'       => [
\t\t\t\t'description' => 'Compiler-managed route identifier for seeded pages.',
\t\t\t\t'type'        => 'string',
\t\t\t\t'context'     => [ 'view', 'edit' ],
\t\t\t],
\t\t]
\t);

\t$wplite_post_types = array_unique( array_merge(
\t\t[ 'page', 'post' ],
\t\tarray_map(
\t\t\tfunction( $model ) { return $model['postType']; },
\t\t\tportfolio_light_get_admin_models()
\t\t)
\t) );
\tforeach ( $wplite_post_types as $post_type ) {
\t\tregister_rest_field(
\t\t\t$post_type,
\t\t\t'wpliteSourcePath',
\t\t\t[
\t\t\t\t'get_callback' => function( $obj ) {
\t\t\t\t\treturn (string) get_post_meta( (int) ( $obj['id'] ?? 0 ), '_wplite_source_path', true );
\t\t\t\t},
\t\t\t\t'schema'       => [
\t\t\t\t\t'description' => 'Source file path (relative to the site root) for entities managed by the wplite compiler.',
\t\t\t\t\t'type'        => 'string',
\t\t\t\t\t'context'     => [ 'view', 'edit' ],
\t\t\t\t],
\t\t\t]
\t\t);
\t}

\tregister_rest_field(
\t\t'user',
\t\t'wplitePreferences',
\t\t[
\t\t\t'get_callback'    => function( $user ) {
\t\t\t\treturn portfolio_light_get_user_preferences( (int) ( $user['id'] ?? 0 ) );
\t\t\t},
\t\t\t'update_callback' => function( $value, $user ) {
\t\t\t\t$user_id = 0;

\t\t\t\tif ( is_array( $user ) ) {
\t\t\t\t\t$user_id = (int) ( $user['id'] ?? 0 );
\t\t\t\t} elseif ( is_object( $user ) && isset( $user->ID ) ) {
\t\t\t\t\t$user_id = (int) $user->ID;
\t\t\t\t} elseif ( is_numeric( $user ) ) {
\t\t\t\t\t$user_id = (int) $user;
\t\t\t\t}

\t\t\t\treturn portfolio_light_update_user_preferences( $user_id, $value );
\t\t\t},
\t\t\t'schema'          => [
\t\t\t\t'description' => 'WPLite user preferences used by the admin app.',
\t\t\t\t'type'        => 'object',
\t\t\t\t'context'     => [ 'edit' ],
\t\t\t],
\t\t]
\t);

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
\t\t\t\t$pages       = [];
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
\t\t\t\t\t$singleton_data[ $singleton['id'] ] = portfolio_light_singleton_with_inheritance( $singleton['id'] );
\t\t\t\t}

\t\t\t\t$page_posts = get_posts(
\t\t\t\t\t[
\t\t\t\t\t\t'post_type'      => 'page',
\t\t\t\t\t\t'post_status'    => 'any',
\t\t\t\t\t\t'posts_per_page' => -1,
\t\t\t\t\t\t'orderby'        => 'modified',
\t\t\t\t\t\t'order'          => 'DESC',
\t\t\t\t\t]
\t\t\t\t);
\t\t\t\t$pages = array_map( 'portfolio_light_prepare_page_record', $page_posts );
\t\t\t\t$route_manifest = portfolio_light_get_route_manifest( $pages );

\t\t\t\treturn new WP_REST_Response(
\t\t\t\t\t[
\t\t\t\t\t\t'site'          => portfolio_light_get_site_config(),
\t\t\t\t\t\t'currentUser'   => portfolio_light_prepare_user( wp_get_current_user() ),
\t\t\t\t\t\t'generatedAt'   => portfolio_light_get_compiled_generated_at(),
\t\t\t\t\t\t'blocks'        => portfolio_light_get_blocks(),
\t\t\t\t\t\t'models'        => $models,
\t\t\t\t\t\t'singletons'    => $singletons,
\t\t\t\t\t\t'routes'        => portfolio_light_get_routes(),
\t\t\t\t\t\t'routeManifest' => $route_manifest,
\t\t\t\t\t\t'menus'         => portfolio_light_get_menus(),
\t\t\t\t\t\t'editorTemplates' => portfolio_light_get_editor_templates(),
\t\t\t\t\t\t'adminSchema'   => $admin_schema,
\t\t\t\t\t\t'navigation'    => portfolio_light_get_admin_navigation(),
\t\t\t\t\t\t'records'       => $records,
\t\t\t\t\t\t'pages'         => $pages,
\t\t\t\t\t\t'singletonData' => $singleton_data,
\t\t\t\t\t\t'themeJson'     => portfolio_light_get_theme_json(),
\t\t\t\t\t\t'themeCss'      => portfolio_light_get_theme_css(),
\t\t\t\t\t],
\t\t\t\t\t200
\t\t\t\t);
\t\t\t},
\t\t]
\t);

\tregister_rest_route(
\t\t'portfolio/v1',
\t\t'/template/(?P<slug>[a-z0-9_-]+)',
\t\t[
\t\t\t[
\t\t\t\t'methods'             => 'GET',
\t\t\t\t'permission_callback' => 'portfolio_light_rest_can_edit',
\t\t\t\t'callback'            => function( WP_REST_Request $request ) {
\t\t\t\t\t$core_request = new WP_REST_Request( 'GET', '/wp/v2/templates/lookup' );
\t\t\t\t\t$core_request->set_query_params(
\t\t\t\t\t\t[
\t\t\t\t\t\t\t'slug'    => (string) $request['slug'],
\t\t\t\t\t\t\t'context' => 'edit',
\t\t\t\t\t\t]
\t\t\t\t\t);

\t\t\t\t\t$response = rest_do_request( $core_request );
\t\t\t\t\treturn new WP_REST_Response( $response->get_data(), $response->get_status() );
\t\t\t\t},
\t\t\t],
\t\t\t[
\t\t\t\t'methods'             => 'POST',
\t\t\t\t'permission_callback' => 'portfolio_light_rest_can_edit',
\t\t\t\t'callback'            => function( WP_REST_Request $request ) {
\t\t\t\t\t$lookup_request = new WP_REST_Request( 'GET', '/wp/v2/templates/lookup' );
\t\t\t\t\t$lookup_request->set_query_params(
\t\t\t\t\t\t[
\t\t\t\t\t\t\t'slug'    => (string) $request['slug'],
\t\t\t\t\t\t\t'context' => 'edit',
\t\t\t\t\t\t]
\t\t\t\t\t);

\t\t\t\t\t$lookup_response = rest_do_request( $lookup_request );
\t\t\t\t\tif ( $lookup_response->get_status() >= 400 ) {
\t\t\t\t\t\treturn new WP_REST_Response( $lookup_response->get_data(), $lookup_response->get_status() );
\t\t\t\t\t}

\t\t\t\t\t$template = $lookup_response->get_data();
\t\t\t\t\t$template_id = (string) ( $template['id'] ?? '' );
\t\t\t\t\tif ( '' === $template_id ) {
\t\t\t\t\t\t$template_id = get_stylesheet() . '//' . (string) $request['slug'];
\t\t\t\t\t}

\t\t\t\t\t$update_request = new WP_REST_Request( 'POST', '/wp/v2/templates/' . $template_id );
\t\t\t\t\t$update_request->set_query_params( [ 'context' => 'edit' ] );
\t\t\t\t\t$update_request->set_body_params(
\t\t\t\t\t\t[
\t\t\t\t\t\t\t'content' => (string) ( $request->get_param( 'content' ) ?? '' ),
\t\t\t\t\t\t]
\t\t\t\t\t);

\t\t\t\t\t$response = rest_do_request( $update_request );
\t\t\t\t\treturn new WP_REST_Response( $response->get_data(), $response->get_status() );
\t\t\t\t},
\t\t\t],
\t\t]
\t);

\tregister_rest_route(
\t\t'portfolio/v1',
\t\t'/editor-bundle',
\t\t[
\t\t\t'methods'             => 'GET',
\t\t\t'permission_callback' => 'portfolio_light_rest_can_edit',
\t\t\t'callback'            => function() {
\t\t\t\treturn new WP_REST_Response( portfolio_light_get_editor_bundle(), 200 );
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
\t\t'/seed-partial',
\t\t[
\t\t\t'methods'             => 'POST',
\t\t\t'permission_callback' => 'portfolio_light_rest_can_edit',
\t\t\t'callback'            => function( WP_REST_Request $request ) {
\t\t\t\t$payload = $request->get_json_params();
\t\t\t\tif ( ! is_array( $payload ) ) {
\t\t\t\t\t$payload = [];
\t\t\t\t}
\t\t\t\t$result = portfolio_light_seed_partial( $payload );
\t\t\t\treturn new WP_REST_Response( [ 'ok' => true, 'targets' => $result ], 200 );
\t\t\t},
\t\t]
\t);

\tregister_rest_route(
\t\t'portfolio/v1',
\t\t'/dev-state',
\t\t[
\t\t\t'methods'             => 'GET',
\t\t\t'permission_callback' => '__return_true',
\t\t\t'callback'            => function() {
\t\t\t\treturn new WP_REST_Response( portfolio_light_get_dev_state(), 200 );
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
\t\t\t\t\t\t\t'item' => portfolio_light_singleton_with_inheritance( $schema['id'] ),
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
	register_rest_route(
		'portfolio/v1',
		'/logs',
		[
			[
				'methods'             => 'GET',
				'permission_callback' => function() {
					return current_user_can( 'manage_options' );
				},
				'callback'            => function() {
					$log_file = WP_CONTENT_DIR . '/debug.log';
					if ( ! file_exists( $log_file ) ) {
						return new WP_REST_Response( [ 'lines' => [] ], 200 );
					}

					$contents = file_get_contents( $log_file );
					$lines    = $contents ? explode( "\\n", $contents ) : [];
					$lines = array_slice( $lines, -500 );
					if ( end( $lines ) === '' ) {
						array_pop( $lines );
					}

					return new WP_REST_Response( [ 'lines' => array_values( $lines ) ], 200 );
				},
			],
			[
				'methods'             => 'DELETE',
				'permission_callback' => function() {
					return current_user_can( 'manage_options' );
				},
				'callback'            => function() {
					$log_file = WP_CONTENT_DIR . '/debug.log';
					if ( file_exists( $log_file ) ) {
						file_put_contents( $log_file, '' );
					}
					return new WP_REST_Response( [ 'ok' => true ], 200 );
				},
			],
		]
	);

	register_rest_route(
		'portfolio/v1',
		'/app-password',
		[
			[
				'methods'             => 'GET',
				'permission_callback' => function() {
					return current_user_can( 'edit_posts' );
				},
				'callback'            => function() {
					$user = wp_get_current_user();
					$passwords = WP_Application_Passwords::get_user_application_passwords( $user->ID );

					foreach ( $passwords as $item ) {
						if ( $item['name'] === 'WPLite App' ) {
							return new WP_REST_Response( [ 'exists' => true, 'password' => null, 'uuid' => $item['uuid'] ], 200 );
						}
					}

					return new WP_REST_Response( [ 'exists' => false, 'password' => null ], 200 );
				},
			],
			[
				'methods'             => 'POST',
				'permission_callback' => function() {
					return current_user_can( 'edit_posts' );
				},
				'callback'            => function() {
					$user = wp_get_current_user();

					$passwords = WP_Application_Passwords::get_user_application_passwords( $user->ID );
					foreach ( $passwords as $item ) {
						if ( $item['name'] === 'WPLite App' ) {
							WP_Application_Passwords::delete_application_password( $user->ID, $item['uuid'] );
						}
					}

					$result = WP_Application_Passwords::create_new_application_password(
						$user->ID,
						[ 'name' => 'WPLite App' ]
					);

					if ( is_wp_error( $result ) ) {
						return new WP_REST_Response( [ 'message' => $result->get_error_message() ], 500 );
					}

					return new WP_REST_Response( [ 'password' => $result[0] ], 200 );
				},
			],
		]
	);
} );
`;
}
