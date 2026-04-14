// Generates the `register-admin-app.php` file included by the compiled plugin.
export function phpRegisterAdminAppFile() {
  return `<?php
defined( 'ABSPATH' ) || exit;

add_action( 'init', function() {
\tadd_rewrite_rule( '^app/?$', 'index.php?portfolio_app=1', 'top' );
\tadd_rewrite_rule( '^app/(.*)?$', 'index.php?portfolio_app=1', 'top' );
} );

add_filter(
\t'query_vars',
\tfunction( $vars ) {
\t\t$vars[] = 'portfolio_app';
\t\treturn $vars;
\t}
);

add_filter(
\t'show_admin_bar',
\tfunction( $show ) {
\t\tif ( get_query_var( 'portfolio_app' ) || portfolio_light_is_app_request() ) {
\t\t\treturn false;
\t\t}

\t\treturn $show;
\t}
);

add_action(
\t'admin_init',
\tfunction() {
\t\tif ( wp_doing_ajax() || isset( $_GET['classic-admin'] ) ) {
\t\t\treturn;
\t\t}

\t\tif ( current_user_can( 'edit_posts' ) ) {
\t\t\twp_safe_redirect( home_url( '/app' ) );
\t\t\texit;
\t\t}
\t}
);

add_action(
\t'template_redirect',
\tfunction() {
\t\tif ( ! get_query_var( 'portfolio_app' ) && ! portfolio_light_is_app_request() ) {
\t\t\treturn;
\t\t}

\t\tif ( ! is_user_logged_in() ) {
\t\t\tauth_redirect();
\t\t}

\t\t$script_path = dirname( __DIR__ ) . '/build/admin-app.js';
\t\t$style_path  = dirname( __DIR__ ) . '/build/admin-app.css';
\t\t$plugin_file = glob( dirname( __DIR__ ) . '/*.php' )[0] ?? __FILE__;
\t\t$script_url  = plugins_url( 'build/admin-app.js', $plugin_file );
\t\t$style_url   = plugins_url( 'build/admin-app.css', $plugin_file );
\t\t$current_user = wp_get_current_user();
\t\t$config      = [
\t\t\t'restRoot'    => esc_url_raw( rest_url( 'portfolio/v1/' ) ),
\t\t\t'wpRestRoot'  => esc_url_raw( rest_url() ),
\t\t\t'nonce'       => wp_create_nonce( 'wp_rest' ),
\t\t\t'appBase'     => home_url( '/app' ),
\t\t\t'currentUser' => $current_user->user_login,
\t\t\t'currentUserId' => (int) $current_user->ID,
\t\t];

\t\tstatus_header( 200 );
\t\tnocache_headers();
\t\t?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
\t<meta charset="<?php bloginfo( 'charset' ); ?>" />
\t<meta name="viewport" content="width=device-width, initial-scale=1" />
\t<title><?php echo esc_html( get_bloginfo( 'name' ) . ' App' ); ?></title>
\t<?php if ( file_exists( $style_path ) ) : ?>
\t\t<link rel="stylesheet" href="<?php echo esc_url( $style_url ); ?>" />
\t<?php endif; ?>
\t<script>window.PORTFOLIO_LIGHT = <?php echo wp_json_encode( $config ); ?>;</script>
\t<script>
\t(function() {
\t\tconst endpoint = <?php echo wp_json_encode( rest_url( 'portfolio/v1/dev-state' ) ); ?>;
\t\tlet currentVersion = null;

\t\tasync function checkDevState() {
\t\t\ttry {
\t\t\t\tconst response = await fetch(endpoint, {
\t\t\t\t\tcache: 'no-store',
\t\t\t\t\tcredentials: 'same-origin',
\t\t\t\t});
\t\t\t\tif (!response.ok) {
\t\t\t\t\treturn;
\t\t\t\t}

\t\t\t\tconst payload = await response.json();
\t\t\t\tif (!payload?.enabled || !payload.version) {
\t\t\t\t\treturn;
\t\t\t\t}

\t\t\t\tif (currentVersion && currentVersion !== payload.version) {
\t\t\t\t\twindow.location.reload();
\t\t\t\t\treturn;
\t\t\t\t}

\t\t\t\tcurrentVersion = payload.version;
\t\t\t} catch (error) {
\t\t\t\t// Keep polling quietly during local development.
\t\t\t}
\t\t}

\t\tcheckDevState();
\t\twindow.setInterval(checkDevState, 1500);
\t})();
\t</script>
\t<?php wp_head(); ?>
</head>
<body <?php body_class( 'portfolio-light-admin-app' ); ?>>
\t<div id="portfolio-admin-root"></div>
\t<?php if ( file_exists( $script_path ) ) : ?>
\t\t<script type="module" src="<?php echo esc_url( $script_url ); ?>"></script>
\t<?php else : ?>
\t\t<p>Admin app build not found. Run the build step.</p>
\t<?php endif; ?>
\t<?php wp_footer(); ?>
</body>
</html><?php
\t\texit;
\t}
);
`;
}
