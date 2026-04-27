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

\t// Convention fallback: bind content/pages/<id>.md to the route whose id
\t// matches the filename stem. Lets the flat file represent the page
\t// without requiring explicit routeId / slug wiring in frontmatter.
\tif ( $route_id ) {
\t\tforeach ( portfolio_light_get_content_collections()['page'] ?? [] as $entry ) {
\t\t\t$source_file = (string) ( $entry['sourceFile'] ?? '' );
\t\t\tif ( $source_file === '' ) {
\t\t\t\tcontinue;
\t\t\t}
\t\t\t$stem = preg_replace( '/\\.(md|html)$/', '', basename( $source_file ) );
\t\t\tif ( $stem === $route_id ) {
\t\t\t\treturn $entry;
\t\t\t}
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
\tif ( ! empty( $content_entry['sourcePath'] ) ) {
\t\tupdate_post_meta( $page_id, '_wplite_source_path', (string) $content_entry['sourcePath'] );
\t} else {
\t\tdelete_post_meta( $page_id, '_wplite_source_path' );
\t}

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

function portfolio_light_find_theme_template_post( $slug, $stylesheet ) {
\t$templates = get_posts(
\t\t[
\t\t\t'post_type'      => 'wp_template',
\t\t\t'post_status'    => 'any',
\t\t\t'posts_per_page' => 1,
\t\t\t'name'           => $slug,
\t\t\t'tax_query'      => [
\t\t\t\t[
\t\t\t\t\t'taxonomy' => 'wp_theme',
\t\t\t\t\t'field'    => 'slug',
\t\t\t\t\t'terms'    => [ $stylesheet ],
\t\t\t\t],
\t\t\t],
\t\t]
\t);

\treturn ! empty( $templates ) ? $templates[0] : null;
}

function portfolio_light_sync_managed_templates() {
\t$templates = [];
\t$stylesheet = (string) get_stylesheet();
\tif ( '' === $stylesheet ) {
\t\treturn $templates;
\t}

\t$template_dir = trailingslashit( get_stylesheet_directory() ) . 'templates/';
\tif ( ! is_dir( $template_dir ) ) {
\t\treturn $templates;
\t}

\t$slugs = [];
\tforeach ( portfolio_light_get_routes() as $route ) {
\t\tif ( 'page' !== ( $route['type'] ?? '' ) ) {
\t\t\tcontinue;
\t\t}

\t\t$template_slug = (string) ( $route['template'] ?? '' );
\t\tif ( '' !== $template_slug ) {
\t\t\t$slugs[] = $template_slug;
\t\t}
\t}

\t$slugs = array_values( array_unique( $slugs ) );
\tif ( empty( $slugs ) ) {
\t\treturn $templates;
\t}

\t$theme_term = term_exists( $stylesheet, 'wp_theme' );
\tif ( ! $theme_term ) {
\t\t$theme_term = wp_insert_term( $stylesheet, 'wp_theme', [ 'slug' => $stylesheet ] );
\t}

\tif ( is_wp_error( $theme_term ) || empty( $theme_term['term_id'] ) ) {
\t\treturn $templates;
\t}

\t$theme_term_id = (int) $theme_term['term_id'];

\tforeach ( $slugs as $slug ) {
\t\t$file_path = $template_dir . $slug . '.html';
\t\tif ( ! file_exists( $file_path ) ) {
\t\t\tcontinue;
\t\t}

\t\t$content  = (string) file_get_contents( $file_path );
\t\t$existing = portfolio_light_find_theme_template_post( $slug, $stylesheet );
\t\t$payload  = [
\t\t\t'post_type'    => 'wp_template',
\t\t\t'post_status'  => 'publish',
\t\t\t'post_title'   => ucwords( str_replace( [ '-', '_' ], ' ', $slug ) ),
\t\t\t'post_name'    => $slug,
\t\t\t'post_content' => $content,
\t\t];

\t\tif ( $existing ) {
\t\t\t$payload['ID'] = $existing->ID;
\t\t\t$template_id   = wp_update_post( wp_slash( $payload ), true );
\t\t} else {
\t\t\t$template_id = wp_insert_post( wp_slash( $payload ), true );
\t\t}

\t\tif ( is_wp_error( $template_id ) ) {
\t\t\tcontinue;
\t\t}

\t\twp_set_post_terms( (int) $template_id, [ $theme_term_id ], 'wp_theme', false );
\t\t$templates[] = [
\t\t\t'postType' => 'wp_template',
\t\t\t'id'       => (int) $template_id,
\t\t\t'slug'     => $slug,
\t\t];
\t}

\treturn $templates;
}

function portfolio_light_apply_site_settings() {
\t$site = portfolio_light_get_site_config();

\tif ( ! empty( $site['title'] ) ) {
\t\tupdate_option( 'blogname', $site['title'] );
\t}

\tif ( ! empty( $site['tagline'] ) ) {
\t\tupdate_option( 'blogdescription', $site['tagline'] );
\t}

\t$page_index = portfolio_light_build_post_index( 'page' );
\t$front_id   = 0;
\t$posts_id   = 0;

\tforeach ( portfolio_light_get_routes() as $route ) {
\t\t$route_id = (string) ( $route['id'] ?? '' );
\t\tif ( '' === $route_id ) {
\t\t\tcontinue;
\t\t}
\t\t$post = portfolio_light_find_route_page_in_index( $route, $page_index );
\t\tif ( ! $post ) {
\t\t\tcontinue;
\t\t}
\t\tif ( $route_id === ( $site['frontPage'] ?? '' ) ) {
\t\t\t$front_id = (int) $post->ID;
\t\t}
\t\tif ( $route_id === ( $site['postsPage'] ?? '' ) ) {
\t\t\t$posts_id = (int) $post->ID;
\t\t}
\t}

\tif ( $front_id ) {
\t\tupdate_option( 'show_on_front', 'page' );
\t\tupdate_option( 'page_on_front', $front_id );
\t}

\tif ( $posts_id ) {
\t\tupdate_option( 'page_for_posts', $posts_id );
\t}

\tupdate_option( 'permalink_structure', '/%postname%/' );
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

function portfolio_light_seed_content_entry( $entry, $indexes, $site ) {
\t$model_id = (string) ( $entry['model'] ?? '' );

\tif ( 'page' === $model_id ) {
\t\tif ( ! empty( $site['content']['collections']['page'] ) && empty( $site['content']['collections']['page']['sync'] ) ) {
\t\t\treturn null;
\t\t}

\t\t$route = null;
\t\tif ( ! empty( $entry['routeId'] ) ) {
\t\t\t$route = portfolio_light_get_route( (string) $entry['routeId'] );
\t\t}

\t\t$page_index = $indexes['page'] ?? null;
\t\tif ( $route ) {
\t\t\t$existing = $page_index
\t\t\t\t? portfolio_light_find_route_page_in_index( $route, $page_index )
\t\t\t\t: portfolio_light_find_route_page( $route );
\t\t} else {
\t\t\t$existing = null;
\t\t\tif ( ! empty( $entry['sourceId'] ) && $page_index && isset( $page_index['by_source_id'][ $entry['sourceId'] ] ) ) {
\t\t\t\t$existing = $page_index['by_source_id'][ $entry['sourceId'] ];
\t\t\t}

\t\t\tif ( ! $existing && ! empty( $entry['slug'] ) ) {
\t\t\t\tif ( $page_index && isset( $page_index['by_slug'][ $entry['slug'] ] ) ) {
\t\t\t\t\t$existing = $page_index['by_slug'][ $entry['slug'] ];
\t\t\t\t} else {
\t\t\t\t\t$existing = get_page_by_path( $entry['slug'], OBJECT, 'page' );
\t\t\t\t}
\t\t\t}
\t\t}

\t\t$payload = [
\t\t\t'post_type'    => 'page',
\t\t\t'post_status'  => $route['seed']['status'] ?? ( $entry['status'] ?? 'publish' ),
\t\t\t'post_title'   => $route['title'] ?? ( $entry['title'] ?? 'Page' ),
\t\t\t'post_name'    => $route['slug'] ?? ( $entry['slug'] ?? '' ),
\t\t\t'post_excerpt' => $entry['excerpt'] ?? '',
\t\t\t'post_content' => $entry['body'] ?? '',
\t\t];

\t\tif ( $existing ) {
\t\t\t$payload['ID'] = $existing->ID;
\t\t\t$page_id       = wp_update_post( wp_slash( $payload ), true );
\t\t} else {
\t\t\t$page_id = wp_insert_post( wp_slash( $payload ), true );
\t\t}

\t\tif ( is_wp_error( $page_id ) ) {
\t\t\treturn null;
\t\t}

\t\tupdate_post_meta( $page_id, '_portfolio_source_id', $entry['sourceId'] ?? '' );
\t\tif ( ! empty( $entry['sourcePath'] ) ) {
\t\t\tupdate_post_meta( $page_id, '_wplite_source_path', (string) $entry['sourcePath'] );
\t\t} else {
\t\t\tdelete_post_meta( $page_id, '_wplite_source_path' );
\t\t}
\t\tif ( $route ) {
\t\t\tupdate_post_meta( $page_id, '_portfolio_route_id', (string) ( $route['id'] ?? '' ) );
\t\t\tif ( ! empty( $route['template'] ) && ! in_array( $route['template'], [ 'front-page', 'page' ], true ) ) {
\t\t\t\tupdate_post_meta( $page_id, '_wp_page_template', $route['template'] );
\t\t\t} else {
\t\t\t\tdelete_post_meta( $page_id, '_wp_page_template' );
\t\t\t}
\t\t} elseif ( array_key_exists( 'template', $entry ) ) {
\t\t\tif ( ! empty( $entry['template'] ) && ! in_array( $entry['template'], [ 'default', 'page', 'front-page' ], true ) ) {
\t\t\t\tupdate_post_meta( $page_id, '_wp_page_template', $entry['template'] );
\t\t\t} else {
\t\t\t\tdelete_post_meta( $page_id, '_wp_page_template' );
\t\t\t}
\t\t}

\t\treturn [
\t\t\t'postType' => 'page',
\t\t\t'id'       => (int) $page_id,
\t\t\t'model'    => 'page',
\t\t\t'slug'     => (string) ( $route['slug'] ?? $entry['slug'] ?? '' ),
\t\t];
\t}

\tif ( 'post' === $model_id ) {
\t\t$post_index = $indexes['post'] ?? null;
\t\t$existing   = null;
\t\tif ( ! empty( $entry['sourceId'] ) && $post_index && isset( $post_index['by_source_id'][ $entry['sourceId'] ] ) ) {
\t\t\t$existing = $post_index['by_source_id'][ $entry['sourceId'] ];
\t\t} elseif ( ! empty( $entry['slug'] ) ) {
\t\t\t$existing = $post_index && isset( $post_index['by_slug'][ $entry['slug'] ] )
\t\t\t\t? $post_index['by_slug'][ $entry['slug'] ]
\t\t\t\t: get_page_by_path( $entry['slug'], OBJECT, 'post' );
\t\t}
\t\t$payload = [
\t\t\t'post_type'    => 'post',
\t\t\t'post_status'  => $entry['status'] ?? 'publish',
\t\t\t'post_title'   => $entry['title'],
\t\t\t'post_name'    => $entry['slug'],
\t\t\t'post_excerpt' => $entry['excerpt'] ?? '',
\t\t\t'post_content' => $entry['body'] ?? '',
\t\t];

\t\tif ( $existing ) {
\t\t\t$payload['ID'] = $existing->ID;
\t\t\t$post_id       = wp_update_post( wp_slash( $payload ), true );
\t\t} else {
\t\t\t$post_id = wp_insert_post( wp_slash( $payload ), true );
\t\t}

\t\tif ( is_wp_error( $post_id ) ) {
\t\t\treturn null;
\t\t}

\t\tupdate_post_meta( $post_id, '_portfolio_source_id', $entry['sourceId'] ?? '' );
\t\tif ( ! empty( $entry['sourcePath'] ) ) {
\t\t\tupdate_post_meta( $post_id, '_wplite_source_path', (string) $entry['sourcePath'] );
\t\t} else {
\t\t\tdelete_post_meta( $post_id, '_wplite_source_path' );
\t\t}

\t\treturn [
\t\t\t'postType' => 'post',
\t\t\t'id'       => (int) $post_id,
\t\t\t'model'    => 'post',
\t\t\t'slug'     => (string) ( $entry['slug'] ?? '' ),
\t\t];
\t}

\t$model = portfolio_light_get_model( $model_id );
\tif ( ! $model ) {
\t\treturn null;
\t}

\tif ( ! empty( $site['content']['collections'][ $model_id ] ) && empty( $site['content']['collections'][ $model_id ]['sync'] ) ) {
\t\treturn null;
\t}

\t$model_index = $indexes[ $model['postType'] ] ?? null;
\t$existing    = null;
\tif ( ! empty( $entry['sourceId'] ) && $model_index && isset( $model_index['by_source_id'][ $entry['sourceId'] ] ) ) {
\t\t$existing = $model_index['by_source_id'][ $entry['sourceId'] ];
\t}

\tif ( ! $existing && ! empty( $entry['slug'] ) ) {
\t\t$existing = $model_index && isset( $model_index['by_slug'][ $entry['slug'] ] )
\t\t\t? $model_index['by_slug'][ $entry['slug'] ]
\t\t\t: get_page_by_path( $entry['slug'], OBJECT, $model['postType'] );
\t}

\t$payload = [
\t\t'title'      => $entry['title'] ?? '',
\t\t'slug'       => $entry['slug'] ?? '',
\t\t'excerpt'    => $entry['excerpt'] ?? '',
\t\t'postStatus' => $entry['status'] ?? 'publish',
\t\t'content'    => $entry['body'] ?? '',
\t];

\tforeach ( $entry['fields'] ?? [] as $field_id => $value ) {
\t\t$payload[ $field_id ] = $value;
\t}

\tforeach ( $entry['terms'] ?? [] as $taxonomy => $terms ) {
\t\t$payload[ $taxonomy ] = $terms;
\t}

\t$saved = portfolio_light_upsert_record( $model, $payload, $existing ? $existing->ID : 0 );
\tif ( is_wp_error( $saved ) ) {
\t\treturn null;
\t}

\tif ( ! empty( $entry['sourceId'] ) ) {
\t\tupdate_post_meta( $saved->ID, '_portfolio_source_id', $entry['sourceId'] );
\t}
\tif ( ! empty( $entry['sourcePath'] ) ) {
\t\tupdate_post_meta( $saved->ID, '_wplite_source_path', (string) $entry['sourcePath'] );
\t} else {
\t\tdelete_post_meta( $saved->ID, '_wplite_source_path' );
\t}

\treturn [
\t\t'postType' => (string) ( $model['postType'] ?? '' ),
\t\t'id'       => (int) $saved->ID,
\t\t'model'    => $model_id,
\t\t'slug'     => (string) ( $entry['slug'] ?? '' ),
\t];
}

function portfolio_light_seed_collection_items( $indexes = null ) {
\t$site = portfolio_light_get_site_config();
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
\tforeach ( $collections as $items ) {
\t\tforeach ( $items as $entry ) {
\t\t\tportfolio_light_seed_content_entry( $entry, $indexes, $site );
\t\t}
\t}
}

function portfolio_light_seed_single_singleton( $singleton_id ) {
\t$site = portfolio_light_get_site_config();
\tif (
\t\tempty( $site['content']['push'] ) ||
\t\t'database' === ( $site['content']['mode'] ?? 'files' ) ||
\t\t! empty( $site['content']['databaseFirst'] )
\t) {
\t\treturn false;
\t}

\t$entries = portfolio_light_get_content_singletons();
\tif ( ! isset( $entries[ $singleton_id ] ) ) {
\t\treturn false;
\t}

\tupdate_option( 'portfolio_singleton_' . $singleton_id, $entries[ $singleton_id ]['data'] ?? [] );
\treturn true;
}

function portfolio_light_seed_partial( $payload ) {
\t$result = [
\t\t'posts'      => [],
\t\t'singletons' => [],
\t\t'templates'  => [],
\t\t'routes'     => [],
\t];

\t$site = portfolio_light_get_site_config();

\tif ( ! empty( $payload['defaults'] ) ) {
\t\tportfolio_light_apply_site_defaults();
\t}

\t$route_ids = isset( $payload['routes'] ) && is_array( $payload['routes'] )
\t\t? $payload['routes']
\t\t: [];

\tif ( ! empty( $route_ids ) ) {
\t\t$page_index = portfolio_light_build_post_index( 'page' );
\t\tforeach ( $route_ids as $route_id ) {
\t\t\t$route_id = (string) $route_id;
\t\t\tif ( '' === $route_id ) {
\t\t\t\tcontinue;
\t\t\t}
\t\t\t$route = portfolio_light_get_route( $route_id );
\t\t\tif ( ! $route ) {
\t\t\t\tcontinue;
\t\t\t}
\t\t\t$page_id = portfolio_light_seed_page_from_route( $route, $page_index );
\t\t\tif ( $page_id ) {
\t\t\t\t$result['posts'][] = [
\t\t\t\t\t'postType' => 'page',
\t\t\t\t\t'id'       => (int) $page_id,
\t\t\t\t\t'routeId'  => $route_id,
\t\t\t\t\t'slug'     => (string) ( $route['slug'] ?? '' ),
\t\t\t\t];
\t\t\t\t$result['routes'][] = $route_id;
\t\t\t}
\t\t}
\t}

\t$collection_items = isset( $payload['collectionItems'] ) && is_array( $payload['collectionItems'] )
\t\t? $payload['collectionItems']
\t\t: [];

\tif ( ! empty( $collection_items ) ) {
\t\t$indexes = [];
\t\t$collections = portfolio_light_get_content_collections();
\t\t$wanted = [];
\t\tforeach ( $collection_items as $target ) {
\t\t\t$model = (string) ( $target['model'] ?? '' );
\t\t\t$slug  = (string) ( $target['slug'] ?? '' );
\t\t\tif ( '' === $model || '' === $slug ) {
\t\t\t\tcontinue;
\t\t\t}
\t\t\t$wanted[ $model . '::' . $slug ] = true;
\t\t}

\t\tforeach ( $collections as $model_key => $items ) {
\t\t\tforeach ( $items as $entry ) {
\t\t\t\t// Compiled entries carry their body + frontmatter but no model
\t\t\t\t// field — the collection key IS the model id. Inject it so the
\t\t\t\t// match below and seed_content_entry can route the entry to the
\t\t\t\t// right post-type path.
\t\t\t\t$entry['model'] = $model_key;
\t\t\t\t$slug  = (string) ( $entry['slug'] ?? '' );
\t\t\t\tif ( empty( $wanted[ $model_key . '::' . $slug ] ) ) {
\t\t\t\t\tcontinue;
\t\t\t\t}

\t\t\t\t$post_type = $model_key;
\t\t\t\tif ( ! in_array( $post_type, [ 'page', 'post' ], true ) ) {
\t\t\t\t\t$model_def = portfolio_light_get_model( $model_key );
\t\t\t\t\tif ( $model_def ) {
\t\t\t\t\t\t$post_type = (string) ( $model_def['postType'] ?? $post_type );
\t\t\t\t\t}
\t\t\t\t}
\t\t\t\tif ( $post_type && ! isset( $indexes[ $post_type ] ) ) {
\t\t\t\t\t$indexes[ $post_type ] = portfolio_light_build_post_index( $post_type );
\t\t\t\t}

\t\t\t\t$row = portfolio_light_seed_content_entry( $entry, $indexes, $site );
\t\t\t\tif ( is_array( $row ) ) {
\t\t\t\t\t$result['posts'][] = $row;
\t\t\t\t}
\t\t\t}
\t\t}
\t}

\tif ( isset( $payload['singletons'] ) && is_array( $payload['singletons'] ) ) {
\t\tforeach ( $payload['singletons'] as $singleton_id ) {
\t\t\t$singleton_id = (string) $singleton_id;
\t\t\tif ( '' === $singleton_id ) {
\t\t\t\tcontinue;
\t\t\t}
\t\t\tif ( portfolio_light_seed_single_singleton( $singleton_id ) ) {
\t\t\t\t$result['singletons'][] = $singleton_id;
\t\t\t}
\t\t}
\t}

\tif ( ! empty( $payload['templates'] ) ) {
\t\t$template_targets = portfolio_light_sync_managed_templates();
\t\tif ( is_array( $template_targets ) ) {
\t\t\t$result['templates'] = $template_targets;
\t\t}
\t}

\tif ( ! empty( $payload['siteSettings'] ) ) {
\t\tportfolio_light_apply_site_settings();
\t}

\tif ( ! empty( $payload['flushRewrites'] ) ) {
\t\tflush_rewrite_rules( false );
\t}

\treturn $result;
}

function portfolio_light_apply_site_defaults() {
\t$defaults_version = (int) get_option( 'portfolio_light_site_defaults_version', 0 );

\tif ( $defaults_version >= 1 ) {
\t\treturn;
\t}

\tupdate_option( 'default_comment_status', 'closed' );
\tupdate_option( 'portfolio_light_site_defaults_version', 1 );
}

function portfolio_light_seed_site() {
\tportfolio_light_apply_site_defaults();

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
\tportfolio_light_sync_managed_templates();
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
