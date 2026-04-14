// Generates the `seed.php` file included by the compiled plugin.
export function phpSeedFile() {
  return `<?php
defined( 'ABSPATH' ) || exit;

function portfolio_light_build_post_index( $post_type ) {
\t$index = [
\t\t'by_source_id' => [],
\t\t'by_route_id'  => [],
\t\t'by_slug'      => [],
\t\t'by_title'     => [],
\t\t'posts'        => [],
\t];

\t$posts = get_posts(
\t\t[
\t\t\t'post_type'      => $post_type,
\t\t\t'post_status'    => 'any',
\t\t\t'posts_per_page' => -1,
\t\t\t'orderby'        => 'date',
\t\t\t'order'          => 'ASC',
\t\t]
\t);

\tforeach ( $posts as $post ) {
\t\t$index['posts'][ (int) $post->ID ] = $post;
\t\t$source_id = (string) get_post_meta( $post->ID, '_portfolio_source_id', true );
\t\t$route_id  = (string) get_post_meta( $post->ID, '_portfolio_route_id', true );
\t\tif ( $source_id && ! isset( $index['by_source_id'][ $source_id ] ) ) {
\t\t\t$index['by_source_id'][ $source_id ] = $post;
\t\t}
\t\tif ( $route_id && ! isset( $index['by_route_id'][ $route_id ] ) ) {
\t\t\t$index['by_route_id'][ $route_id ] = $post;
\t\t}
\t\tif ( $post->post_name && ! isset( $index['by_slug'][ $post->post_name ] ) ) {
\t\t\t$index['by_slug'][ $post->post_name ] = $post;
\t\t}
\t\tif ( $post->post_title && ! isset( $index['by_title'][ $post->post_title ] ) ) {
\t\t\t$index['by_title'][ $post->post_title ] = $post;
\t\t}
\t}

\treturn $index;
}

function portfolio_light_find_route_page_in_index( $route, $index ) {
\t$route_id = (string) ( $route['id'] ?? '' );
\t$slug     = (string) ( $route['slug'] ?? '' );
\t$title    = (string) ( $route['title'] ?? ucfirst( $route_id ?: 'Page' ) );

\tif ( $route_id && isset( $index['by_route_id'][ $route_id ] ) ) {
\t\treturn $index['by_route_id'][ $route_id ];
\t}

\tif ( $slug && isset( $index['by_slug'][ $slug ] ) ) {
\t\treturn $index['by_slug'][ $slug ];
\t}

\tif ( ! $slug ) {
\t\t$current_front = (int) get_option( 'page_on_front' );
\t\tif ( $current_front && isset( $index['posts'][ $current_front ] ) ) {
\t\t\t$front = $index['posts'][ $current_front ];
\t\t\tif ( $front instanceof WP_Post && 'page' === $front->post_type ) {
\t\t\t\treturn $front;
\t\t\t}
\t\t}

\t\tif ( $title && isset( $index['by_title'][ $title ] ) ) {
\t\t\treturn $index['by_title'][ $title ];
\t\t}
\t}

\treturn null;
}

function portfolio_light_find_route_page( $route ) {
\t$route_id = (string) ( $route['id'] ?? '' );
\t$slug     = (string) ( $route['slug'] ?? '' );
\t$title    = (string) ( $route['title'] ?? ucfirst( $route_id ?: 'Page' ) );

\tif ( $route_id ) {
\t\t$existing = get_posts(
\t\t\t[
\t\t\t\t'post_type'      => 'page',
\t\t\t\t'post_status'    => 'any',
\t\t\t\t'posts_per_page' => 1,
\t\t\t\t'meta_query'     => [
\t\t\t\t\t[
\t\t\t\t\t\t'key'   => '_portfolio_route_id',
\t\t\t\t\t\t'value' => $route_id,
\t\t\t\t\t],
\t\t\t\t],
\t\t\t]
\t\t);
\t\tif ( ! empty( $existing ) ) {
\t\t\treturn $existing[0];
\t\t}
\t}

\tif ( $slug ) {
\t\t$existing = get_page_by_path( $slug, OBJECT, 'page' );
\t\tif ( $existing ) {
\t\t\treturn $existing;
\t\t}
\t}

\tif ( ! $slug ) {
\t\t$current_front = (int) get_option( 'page_on_front' );
\t\tif ( $current_front ) {
\t\t\t$front = get_post( $current_front );
\t\t\tif ( $front instanceof WP_Post && 'page' === $front->post_type ) {
\t\t\t\treturn $front;
\t\t\t}
\t\t}

\t\t$matches = get_posts(
\t\t\t[
\t\t\t\t'post_type'      => 'page',
\t\t\t\t'post_status'    => 'any',
\t\t\t\t'posts_per_page' => 1,
\t\t\t\t'title'          => $title,
\t\t\t\t'orderby'        => 'date',
\t\t\t\t'order'          => 'ASC',
\t\t\t]
\t\t);
\t\tif ( ! empty( $matches ) ) {
\t\t\treturn $matches[0];
\t\t}
\t}

\treturn null;
}

function portfolio_light_find_page_content_entry( $route ) {
\t$route_id = (string) ( $route['id'] ?? '' );
\t$slug     = (string) ( $route['slug'] ?? '' );

\tforeach ( portfolio_light_get_content_collections()['page'] ?? [] as $entry ) {
\t\tif ( $route_id && (string) ( $entry['routeId'] ?? '' ) === $route_id ) {
\t\t\treturn $entry;
\t\t}

\t\tif ( $slug && (string) ( $entry['slug'] ?? '' ) === $slug ) {
\t\t\treturn $entry;
\t\t}
\t}

\treturn null;
}

function portfolio_light_seed_page_from_route( $route, $page_index = null ) {
\tif ( 'page' !== ( $route['type'] ?? '' ) || empty( $route['seed']['createPageShell'] ) ) {
\t\treturn 0;
\t}

\t$slug     = (string) ( $route['slug'] ?? '' );
\t$existing = $page_index
\t\t? portfolio_light_find_route_page_in_index( $route, $page_index )
\t\t: portfolio_light_find_route_page( $route );
\t$content_entry = portfolio_light_find_page_content_entry( $route );
\t$payload  = [
\t\t'post_type'    => 'page',
\t\t'post_status'  => $route['seed']['status'] ?? ( $content_entry['status'] ?? 'publish' ),
\t\t'post_title'   => $route['title'] ?? ( $content_entry['title'] ?? ucfirst( $route['id'] ?? 'Page' ) ),
\t\t'post_name'    => $slug,
\t\t'post_excerpt' => $content_entry['excerpt'] ?? '',
\t\t'post_content' => $content_entry['body'] ?? ( $route['seed']['content'] ?? '' ),
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

\tupdate_post_meta( $page_id, '_portfolio_route_id', (string) ( $route['id'] ?? '' ) );
\tupdate_post_meta(
\t\t$page_id,
\t\t'_portfolio_source_id',
\t\t(string) ( $content_entry['sourceId'] ?? ( ! empty( $route['id'] ) ? 'page.' . $route['id'] : 'page.' . $slug ) )
\t);

\tif ( ! empty( $route['template'] ) && ! in_array( $route['template'], [ 'front-page', 'page' ], true ) ) {
\t\tupdate_post_meta( $page_id, '_wp_page_template', $route['template'] );
\t} else {
\t\tdelete_post_meta( $page_id, '_wp_page_template' );
\t}

\treturn (int) $page_id;
}

function portfolio_light_cleanup_route_duplicates( $page_ids ) {
\t$managed_ids = array_values( array_filter( array_map( 'intval', $page_ids ) ) );

\tif ( empty( $managed_ids ) ) {
\t\treturn;
\t}

\t$duplicates = get_posts(
\t\t[
\t\t\t'post_type'      => 'page',
\t\t\t'post_status'    => 'any',
\t\t\t'posts_per_page' => -1,
\t\t\t'meta_query'     => [
\t\t\t\t[
\t\t\t\t\t'key'     => '_portfolio_route_id',
\t\t\t\t\t'compare' => 'EXISTS',
\t\t\t\t],
\t\t\t],
\t\t]
\t);

\t$seen = [];
\tforeach ( $duplicates as $post ) {
\t\t$route_id = (string) get_post_meta( $post->ID, '_portfolio_route_id', true );
\t\tif ( ! isset( $seen[ $route_id ] ) ) {
\t\t\t$seen[ $route_id ] = (int) $post->ID;
\t\t\tcontinue;
\t\t}
\t\twp_delete_post( $post->ID, true );
\t}

\t$legacy_pages = get_posts(
\t\t[
\t\t\t'post_type'      => 'page',
\t\t\t'post_status'    => 'any',
\t\t\t'posts_per_page' => -1,
\t\t]
\t);
\tforeach ( $legacy_pages as $post ) {
\t\tif ( in_array( (int) $post->ID, $managed_ids, true ) ) {
\t\t\tcontinue;
\t\t}
\t\tif ( preg_match( '/^home(?:-[0-9]+)?$/', $post->post_name ) ) {
\t\t\twp_delete_post( $post->ID, true );
\t\t}
\t}
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

\t$privacy_page = get_page_by_path( 'privacy-policy', OBJECT, 'page' );
\tif ( $privacy_page && 'Privacy Policy' === $privacy_page->post_title ) {
\t\twp_delete_post( $privacy_page->ID, true );
\t}
}

function portfolio_light_seed_collection_items( $indexes = null ) {
\t$site        = portfolio_light_get_site_config();
\tif (
\t\tempty( $site['content']['push'] ) ||
\t\t'database' === ( $site['content']['mode'] ?? 'files' ) ||
\t\t! empty( $site['content']['databaseFirst'] )
\t) {
\t\treturn;
\t}

\tif ( null === $indexes ) {
\t\t$indexes = [];
\t}

\t$collections = portfolio_light_get_content_collections();
\tforeach ( $collections as $directory => $items ) {
\t\tforeach ( $items as $entry ) {
\t\t\tif ( 'page' === ( $entry['model'] ?? '' ) ) {
\t\t\t\tif ( ! empty( $site['content']['collections']['page'] ) && empty( $site['content']['collections']['page']['sync'] ) ) {
\t\t\t\t\tcontinue;
\t\t\t\t}

\t\t\t\t$route = null;
\t\t\t\tif ( ! empty( $entry['routeId'] ) ) {
\t\t\t\t\t$route = portfolio_light_get_route( (string) $entry['routeId'] );
\t\t\t\t}

\t\t\t\t$page_index = $indexes['page'] ?? null;
\t\t\t\tif ( $route ) {
\t\t\t\t\t$existing = $page_index
\t\t\t\t\t\t? portfolio_light_find_route_page_in_index( $route, $page_index )
\t\t\t\t\t\t: portfolio_light_find_route_page( $route );
\t\t\t\t} else {
\t\t\t\t\t$existing = null;
\t\t\t\t\tif ( ! empty( $entry['sourceId'] ) && $page_index && isset( $page_index['by_source_id'][ $entry['sourceId'] ] ) ) {
\t\t\t\t\t\t$existing = $page_index['by_source_id'][ $entry['sourceId'] ];
\t\t\t\t\t}

\t\t\t\t\tif ( ! $existing && ! empty( $entry['slug'] ) ) {
\t\t\t\t\t\tif ( $page_index && isset( $page_index['by_slug'][ $entry['slug'] ] ) ) {
\t\t\t\t\t\t\t$existing = $page_index['by_slug'][ $entry['slug'] ];
\t\t\t\t\t\t} else {
\t\t\t\t\t\t\t$existing = get_page_by_path( $entry['slug'], OBJECT, 'page' );
\t\t\t\t\t\t}
\t\t\t\t\t}
\t\t\t\t}

\t\t\t\t$payload = [
\t\t\t\t\t'post_type'    => 'page',
\t\t\t\t\t'post_status'  => $route['seed']['status'] ?? ( $entry['status'] ?? 'publish' ),
\t\t\t\t\t'post_title'   => $route['title'] ?? ( $entry['title'] ?? 'Page' ),
\t\t\t\t\t'post_name'    => $route['slug'] ?? ( $entry['slug'] ?? '' ),
\t\t\t\t\t'post_excerpt' => $entry['excerpt'] ?? '',
\t\t\t\t\t'post_content' => $entry['body'] ?? '',
\t\t\t\t];

\t\t\t\tif ( $existing ) {
\t\t\t\t\t$payload['ID'] = $existing->ID;
\t\t\t\t\t$page_id       = wp_update_post( wp_slash( $payload ), true );
\t\t\t\t} else {
\t\t\t\t\t$page_id = wp_insert_post( wp_slash( $payload ), true );
\t\t\t\t}

\t\t\t\tif ( ! is_wp_error( $page_id ) ) {
\t\t\t\t\tupdate_post_meta( $page_id, '_portfolio_source_id', $entry['sourceId'] ?? '' );
\t\t\t\t\tif ( $route ) {
\t\t\t\t\t\tupdate_post_meta( $page_id, '_portfolio_route_id', (string) ( $route['id'] ?? '' ) );
\t\t\t\t\t\tif ( ! empty( $route['template'] ) && ! in_array( $route['template'], [ 'front-page', 'page' ], true ) ) {
\t\t\t\t\t\t\tupdate_post_meta( $page_id, '_wp_page_template', $route['template'] );
\t\t\t\t\t\t} else {
\t\t\t\t\t\t\tdelete_post_meta( $page_id, '_wp_page_template' );
\t\t\t\t\t\t}
\t\t\t\t\t} elseif ( array_key_exists( 'template', $entry ) ) {
\t\t\t\t\t\tif ( ! empty( $entry['template'] ) && ! in_array( $entry['template'], [ 'default', 'page', 'front-page' ], true ) ) {
\t\t\t\t\t\t\tupdate_post_meta( $page_id, '_wp_page_template', $entry['template'] );
\t\t\t\t\t\t} else {
\t\t\t\t\t\t\tdelete_post_meta( $page_id, '_wp_page_template' );
\t\t\t\t\t\t}
\t\t\t\t\t}
\t\t\t\t}
\t\t\t\tcontinue;
\t\t\t}

\t\t\tif ( 'post' === ( $entry['model'] ?? '' ) ) {
\t\t\t\t$post_index = $indexes['post'] ?? null;
\t\t\t\t$existing   = null;
\t\t\t\tif ( ! empty( $entry['sourceId'] ) && $post_index && isset( $post_index['by_source_id'][ $entry['sourceId'] ] ) ) {
\t\t\t\t\t$existing = $post_index['by_source_id'][ $entry['sourceId'] ];
\t\t\t\t} elseif ( ! empty( $entry['slug'] ) ) {
\t\t\t\t\t$existing = $post_index && isset( $post_index['by_slug'][ $entry['slug'] ] )
\t\t\t\t\t\t? $post_index['by_slug'][ $entry['slug'] ]
\t\t\t\t\t\t: get_page_by_path( $entry['slug'], OBJECT, 'post' );
\t\t\t\t}
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

\t\t\t$model_index = $indexes[ $model['postType'] ] ?? null;
\t\t\t$existing    = null;
\t\t\tif ( ! empty( $entry['sourceId'] ) && $model_index && isset( $model_index['by_source_id'][ $entry['sourceId'] ] ) ) {
\t\t\t\t$existing = $model_index['by_source_id'][ $entry['sourceId'] ];
\t\t\t}

\t\t\tif ( ! $existing && ! empty( $entry['slug'] ) ) {
\t\t\t\t$existing = $model_index && isset( $model_index['by_slug'][ $entry['slug'] ] )
\t\t\t\t\t? $model_index['by_slug'][ $entry['slug'] ]
\t\t\t\t\t: get_page_by_path( $entry['slug'], OBJECT, $model['postType'] );
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
\t$indexes = [
\t\t'page' => portfolio_light_build_post_index( 'page' ),
\t\t'post' => portfolio_light_build_post_index( 'post' ),
\t];
\tforeach ( portfolio_light_get_models() as $model ) {
\t\tif ( 'collection' !== ( $model['type'] ?? '' ) ) {
\t\t\tcontinue;
\t\t}
\t\t$pt = $model['postType'] ?? '';
\t\tif ( $pt && ! isset( $indexes[ $pt ] ) ) {
\t\t\t$indexes[ $pt ] = portfolio_light_build_post_index( $pt );
\t\t}
\t}

\t$page_ids = [];
\tforeach ( portfolio_light_get_routes() as $route ) {
\t\t$page_ids[ $route['id'] ] = portfolio_light_seed_page_from_route( $route, $indexes['page'] );
\t}

\tportfolio_light_cleanup_route_duplicates( $page_ids );

\tportfolio_light_seed_singletons();
\tportfolio_light_cleanup_default_content();
\tportfolio_light_seed_collection_items( $indexes );

\t$site = portfolio_light_get_site_config();
\tif ( ! empty( $site['theme']['slug'] ) ) {
\t\tswitch_theme( $site['theme']['slug'] );
\t}
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

\tupdate_option( 'permalink_structure', '/%postname%/' );

\tflush_rewrite_rules();
}
`;
}

