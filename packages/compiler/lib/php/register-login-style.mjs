// Generates the `register-login-style.php` file included by the compiled plugin.

export function phpRegisterLoginStyleFile() {
  return `<?php
defined( 'ABSPATH' ) || exit;

add_action(
\t'login_enqueue_scripts',
\tfunction() {
\t\t$plugin_file = glob( dirname( __DIR__ ) . '/*.php' )[0] ?? __FILE__;
\t\t$style_path  = dirname( $plugin_file ) . '/assets/login.css';
\t\t$style_url   = plugins_url( 'assets/login.css', $plugin_file );
\t\t$style_ver   = file_exists( $style_path ) ? (string) filemtime( $style_path ) : null;
\t\twp_enqueue_style( 'wplite-login', $style_url, [], $style_ver );
\t}
);

add_filter(
\t'login_headerurl',
\tfunction() {
\t\treturn 'https://wordpress.org/';
\t}
);

add_filter(
\t'login_headertext',
\tfunction() {
\t\treturn 'WordPress';
\t}
);

add_action(
\t'login_footer',
\tfunction() {
\t\t?>
\t\t<div class="wplite-login-footer">
\t\t\t<a class="wplite-login-footer__about" href="https://wplite.app/" target="_blank" rel="noopener noreferrer">About WP Lite</a>
\t\t\t<span class="wplite-login-footer__sep" aria-hidden="true">/</span>
\t\t\t<a class="wplite-login-footer__home" href="<?php echo esc_url( home_url( '/' ) ); ?>">Site home</a>
\t\t</div>
\t\t<?php
\t}
);
`;
}
