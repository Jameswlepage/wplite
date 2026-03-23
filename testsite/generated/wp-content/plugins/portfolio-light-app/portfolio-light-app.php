<?php
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
	foreach ( portfolio_light_get_block_dirs() as $block_dir ) {
		if ( file_exists( $block_dir . '/block.json' ) ) {
			register_block_type( $block_dir );
		}
	}
} );

register_activation_hook(
	__FILE__,
	function() {
		portfolio_light_seed_site();
		flush_rewrite_rules();
	}
);

register_deactivation_hook(
	__FILE__,
	function() {
		flush_rewrite_rules();
	}
);
