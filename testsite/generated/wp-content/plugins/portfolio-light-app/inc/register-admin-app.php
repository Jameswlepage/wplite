<?php
defined( 'ABSPATH' ) || exit;

add_action( 'init', function() {
	add_rewrite_rule( '^app/?$', 'index.php?portfolio_app=1', 'top' );
	add_rewrite_rule( '^app/(.*)?$', 'index.php?portfolio_app=1', 'top' );
} );

add_filter(
	'query_vars',
	function( $vars ) {
		$vars[] = 'portfolio_app';
		return $vars;
	}
);

add_filter( 'show_admin_bar', '__return_false' );

add_action(
	'admin_init',
	function() {
		if ( wp_doing_ajax() || isset( $_GET['classic-admin'] ) ) {
			return;
		}

		if ( current_user_can( 'edit_posts' ) ) {
			wp_safe_redirect( home_url( '/app' ) );
			exit;
		}
	}
);

add_action(
	'template_redirect',
	function() {
		if ( ! get_query_var( 'portfolio_app' ) && ! portfolio_light_is_app_request() ) {
			return;
		}

		if ( ! is_user_logged_in() ) {
			auth_redirect();
		}

		$script_path = dirname( __DIR__ ) . '/build/admin-app.js';
		$style_path  = dirname( __DIR__ ) . '/build/admin-app.css';
		$script_url  = plugins_url( 'build/admin-app.js', dirname( __DIR__ ) . '/portfolio-light-app.php' );
		$style_url   = plugins_url( 'build/admin-app.css', dirname( __DIR__ ) . '/portfolio-light-app.php' );
		$config      = [
			'restRoot' => esc_url_raw( rest_url( 'portfolio/v1/' ) ),
			'nonce'    => wp_create_nonce( 'wp_rest' ),
			'appBase'  => home_url( '/app' ),
		];

		status_header( 200 );
		nocache_headers();
		?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title><?php echo esc_html( get_bloginfo( 'name' ) . ' App' ); ?></title>
	<?php if ( file_exists( $style_path ) ) : ?>
		<link rel="stylesheet" href="<?php echo esc_url( $style_url ); ?>" />
	<?php endif; ?>
	<script>window.PORTFOLIO_LIGHT = <?php echo wp_json_encode( $config ); ?>;</script>
	<?php wp_head(); ?>
</head>
<body <?php body_class( 'portfolio-light-admin-app' ); ?>>
	<div id="portfolio-admin-root"></div>
	<?php if ( file_exists( $script_path ) ) : ?>
		<script type="module" src="<?php echo esc_url( $script_url ); ?>"></script>
	<?php else : ?>
		<p>Admin app build not found. Run the build step.</p>
	<?php endif; ?>
	<?php wp_footer(); ?>
</body>
</html><?php
		exit;
	}
);
