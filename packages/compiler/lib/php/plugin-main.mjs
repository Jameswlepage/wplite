// Generates the `plugin-main.php` file included by the compiled plugin.
import { toTitleCase } from '../strings.mjs';

export function pluginMainFile(site = {}) {
  const pluginName = toTitleCase(site.plugin?.slug ?? 'wp-lite-app');
  const siteTitle = site.title ?? 'WP Lite';
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
require_once __DIR__ . '/inc/register-user-avatar.php';
require_once __DIR__ . '/inc/register-singletons.php';
require_once __DIR__ . '/inc/register-head.php';
require_once __DIR__ . '/inc/register-rest.php';
require_once __DIR__ . '/inc/register-admin-app.php';
require_once __DIR__ . '/inc/register-login-style.php';
require_once __DIR__ . '/inc/register-frontend-launcher.php';
require_once __DIR__ . '/inc/register-hero-image.php';
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
