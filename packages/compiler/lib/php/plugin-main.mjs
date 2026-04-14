// Generates the `plugin-main.php` file included by the compiled plugin.
import { toTitleCase } from '../strings.mjs';

export function pluginMainFile(site = {}) {
  const pluginName = toTitleCase(site.plugin?.slug ?? 'wp-light-app');
  const siteTitle = site.title ?? 'WP Light';
  return `<?php
/**
 * Plugin Name: ${pluginName}
 * Description: Generated runtime for ${siteTitle}.
 */

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/inc/helpers.php';
require_once __DIR__ . '/inc/register-post-types.php';
require_once __DIR__ . '/inc/register-taxonomies.php';
require_once __DIR__ . '/inc/register-meta.php';
require_once __DIR__ . '/inc/register-singletons.php';
require_once __DIR__ . '/inc/register-head.php';
require_once __DIR__ . '/inc/register-rest.php';
require_once __DIR__ . '/inc/register-admin-app.php';
require_once __DIR__ . '/inc/register-login-style.php';
require_once __DIR__ . '/inc/seed.php';

add_action( 'init', function() {
\tforeach ( portfolio_light_get_block_dirs() as $block_dir ) {
\t\tif ( file_exists( $block_dir . '/block.json' ) ) {
\t\t\tregister_block_type( $block_dir );
\t\t}
\t}
} );

add_filter(
\t'block_categories_all',
\tfunction( $categories ) {
\t\tforeach ( $categories as $category ) {
\t\t\tif ( ( $category['slug'] ?? '' ) === 'dashboard' ) {
\t\t\t\treturn $categories;
\t\t\t}
\t\t}

\t\t$categories[] = [
\t\t\t'slug'  => 'dashboard',
\t\t\t'title' => __( 'Dashboard widgets', 'portfolio-light' ),
\t\t\t'icon'  => null,
\t\t];

\t\treturn $categories;
\t}
);

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

