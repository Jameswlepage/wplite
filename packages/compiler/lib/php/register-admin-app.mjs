// Generates the `register-admin-app.php` file included by the compiled plugin.
export function phpRegisterAdminAppFile() {
  return `<?php
defined( 'ABSPATH' ) || exit;

function portfolio_light_classic_admin_cookie_name() {
\treturn 'portfolio_light_classic_admin';
}

function portfolio_light_default_app_url() {
\treturn home_url( '/app' );
}

function portfolio_light_normalize_classic_admin_return_url( $raw_url = '' ) {
\t$fallback = portfolio_light_default_app_url();
\t$value    = is_string( $raw_url ) ? trim( wp_unslash( $raw_url ) ) : '';

\tif ( '' === $value ) {
\t\treturn $fallback;
\t}

\t$validated = wp_validate_redirect( $value, '' );
\tif ( '' === $validated ) {
\t\treturn $fallback;
\t}

\t$app_base_path = wp_parse_url( portfolio_light_default_app_url(), PHP_URL_PATH );
\t$target_path   = wp_parse_url( $validated, PHP_URL_PATH );
\t$app_base_path = untrailingslashit( $app_base_path ? $app_base_path : '/app' );
\t$target_path   = untrailingslashit( $target_path ? $target_path : '/' );

\tif ( $target_path !== $app_base_path && 0 !== strpos( $target_path, $app_base_path . '/' ) ) {
\t\treturn $fallback;
\t}

\treturn $validated;
}

function portfolio_light_get_classic_admin_return_url() {
\tif ( isset( $_GET['wplite-return'] ) ) {
\t\treturn portfolio_light_normalize_classic_admin_return_url( $_GET['wplite-return'] );
\t}

\t$cookie_name = portfolio_light_classic_admin_cookie_name();
\tif ( isset( $_COOKIE[ $cookie_name ] ) ) {
\t\treturn portfolio_light_normalize_classic_admin_return_url( rawurldecode( wp_unslash( $_COOKIE[ $cookie_name ] ) ) );
\t}

\treturn portfolio_light_default_app_url();
}

function portfolio_light_set_classic_admin_cookie( $return_url ) {
\t$cookie_name = portfolio_light_classic_admin_cookie_name();
\t$cookie_path = defined( 'COOKIEPATH' ) && COOKIEPATH ? COOKIEPATH : '/';
\t$cookie_value = rawurlencode( portfolio_light_normalize_classic_admin_return_url( $return_url ) );

\t$_COOKIE[ $cookie_name ] = $cookie_value;
\tsetcookie(
\t\t$cookie_name,
\t\t$cookie_value,
\t\t0,
\t\t$cookie_path,
\t\tCOOKIE_DOMAIN,
\t\tis_ssl(),
\t\ttrue
\t);
}

function portfolio_light_clear_classic_admin_cookie() {
\t$cookie_name = portfolio_light_classic_admin_cookie_name();
\t$cookie_path = defined( 'COOKIEPATH' ) && COOKIEPATH ? COOKIEPATH : '/';

\tunset( $_COOKIE[ $cookie_name ] );
\tsetcookie(
\t\t$cookie_name,
\t\t'',
\t\ttime() - HOUR_IN_SECONDS,
\t\t$cookie_path,
\t\tCOOKIE_DOMAIN,
\t\tis_ssl(),
\t\ttrue
\t);
}

function portfolio_light_is_classic_admin_request() {
\tif ( wp_doing_ajax() ) {
\t\treturn true;
\t}

\tif ( isset( $_GET['classic-admin'] ) ) {
\t\treturn '0' !== (string) wp_unslash( $_GET['classic-admin'] );
\t}

\t$cookie_name = portfolio_light_classic_admin_cookie_name();
\treturn isset( $_COOKIE[ $cookie_name ] ) && '' !== (string) wp_unslash( $_COOKIE[ $cookie_name ] );
}

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
\t\tif ( isset( $_GET['classic-admin'] ) ) {
\t\t\tif ( '0' === (string) wp_unslash( $_GET['classic-admin'] ) ) {
\t\t\t\tportfolio_light_clear_classic_admin_cookie();
\t\t\t} else {
\t\t\t\tportfolio_light_set_classic_admin_cookie( portfolio_light_get_classic_admin_return_url() );
\t\t\t}
\t\t}

\t\tif ( portfolio_light_is_classic_admin_request() ) {
\t\t\treturn;
\t\t}

\t\tif ( current_user_can( 'edit_posts' ) ) {
\t\t\twp_safe_redirect( home_url( '/app' ) );
\t\t\texit;
\t\t}
\t}
);

add_action(
\t'admin_bar_menu',
\tfunction( $admin_bar ) {
\t\tif ( ! is_admin() || ! current_user_can( 'edit_posts' ) ) {
\t\t\treturn;
\t\t}

\t\tif ( ! portfolio_light_is_classic_admin_request() ) {
\t\t\treturn;
\t\t}

\t\t$admin_bar->add_node(
\t\t\t[
\t\t\t\t'id'    => 'portfolio-light-open-app',
\t\t\t\t'title' => 'Open in WP Lite',
\t\t\t\t'href'  => portfolio_light_get_classic_admin_return_url(),
\t\t\t\t'meta'  => [
\t\t\t\t\t'class' => 'portfolio-light-open-app',
\t\t\t\t],
\t\t\t]
\t\t);
\t},
\t90
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
\t\t$dev_state   = function_exists( 'portfolio_light_get_dev_state' ) ? portfolio_light_get_dev_state() : [];
\t\t$vite_url    = ! empty( $dev_state['enabled'] ) && ! empty( $dev_state['viteUrl'] ) ? rtrim( $dev_state['viteUrl'], '/' ) : '';
\t\t$acp_bridge_url = ! empty( $dev_state['enabled'] ) && ! empty( $dev_state['acpBridgeUrl'] ) ? $dev_state['acpBridgeUrl'] : '';
\t\t$sync_url = ! empty( $dev_state['enabled'] ) && ! empty( $dev_state['syncUrl'] ) ? rtrim( $dev_state['syncUrl'], '/' ) : '';
\t\t$current_user = wp_get_current_user();
\t\t$config      = [
\t\t\t'restRoot'    => esc_url_raw( rest_url( 'portfolio/v1/' ) ),
\t\t\t'wpRestRoot'  => esc_url_raw( rest_url() ),
\t\t\t'nonce'       => wp_create_nonce( 'wp_rest' ),
\t\t\t'appBase'     => home_url( '/app' ),
\t\t\t'currentUser' => $current_user->user_login,
\t\t\t'currentUserId' => (int) $current_user->ID,
\t\t\t'acpBridgeUrl' => $acp_bridge_url,
\t\t\t'syncUrl'     => $sync_url,
\t\t];

\t\tstatus_header( 200 );
\t\tnocache_headers();
\t\t?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
\t<meta charset="<?php bloginfo( 'charset' ); ?>" />
\t<meta name="viewport" content="width=device-width, initial-scale=1" />
\t<title><?php echo esc_html( get_bloginfo( 'name' ) . ' App' ); ?></title>
\t<?php if ( '' === $vite_url && file_exists( $style_path ) ) : ?>
\t\t<link rel="stylesheet" href="<?php echo esc_url( $style_url ); ?>" />
\t<?php endif; ?>
\t<?php if ( '' !== $vite_url ) : ?>
\t\t<script type="module">
\t\t\timport RefreshRuntime from "<?php echo esc_url( $vite_url ); ?>/@react-refresh";
\t\t\tRefreshRuntime.injectIntoGlobalHook(window);
\t\t\twindow.$RefreshReg$ = () => {};
\t\t\twindow.$RefreshSig$ = () => (type) => type;
\t\t\twindow.__vite_plugin_react_preamble_installed__ = true;
\t\t</script>
\t\t<script type="module" src="<?php echo esc_url( $vite_url ); ?>/@vite/client"></script>
\t<?php endif; ?>
\t<script>window.PORTFOLIO_LIGHT = <?php echo wp_json_encode( $config ); ?>;</script>
\t<?php wp_head(); ?>
</head>
<body <?php body_class( 'portfolio-light-admin-app' ); ?>>
\t<div id="portfolio-admin-root"></div>
\t<?php if ( '' !== $vite_url ) : ?>
\t\t<script type="module" src="<?php echo esc_url( $vite_url ); ?>/src/main.jsx"></script>
\t<?php elseif ( file_exists( $script_path ) ) : ?>
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
