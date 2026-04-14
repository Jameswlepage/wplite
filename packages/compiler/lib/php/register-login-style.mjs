// Generates the `register-login-style.php` file included by the compiled plugin.
export function phpRegisterLoginStyleFile() {
  return `<?php
defined( 'ABSPATH' ) || exit;

add_action(
\t'login_enqueue_scripts',
\tfunction() {
\t\t$plugin_file = glob( dirname( __DIR__ ) . '/*.php' )[0] ?? __FILE__;
\t\t$style_url   = plugins_url( 'assets/login.css', $plugin_file );
\t\twp_enqueue_style( 'wplite-login', $style_url, [], null );
\t}
);

add_filter(
\t'login_headerurl',
\tfunction() {
\t\treturn home_url( '/' );
\t}
);

add_filter(
\t'login_headertext',
\tfunction() {
\t\treturn get_bloginfo( 'name' );
\t}
);

add_filter(
\t'login_body_class',
\tfunction( $classes ) {
\t\t$classes[] = 'wplite-login';
\t\treturn $classes;
\t}
);
`;
}

function loginStyleCss() {
  return `:root {
  --wplite-bg: #f5f5f5;
  --wplite-surface: #ffffff;
  --wplite-border: #e0e0e0;
  --wplite-text: #1e1e1e;
  --wplite-text-muted: #757575;
  --wplite-accent: #3858e9;
  --wplite-accent-hover: #1d35b4;
  --wplite-destructive: #cc1818;
  --wplite-radius: 8px;
  --wplite-radius-sm: 6px;
  --wplite-font: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif;
}

body.login {
  background: var(--wplite-bg);
  color: var(--wplite-text);
  font-family: var(--wplite-font);
  font-size: 13px;
  -webkit-font-smoothing: antialiased;
  margin: 0;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

body.login div#login {
  width: 360px;
  padding: 0;
  margin: 0;
}

body.login h1 {
  text-align: center;
  margin-bottom: 16px;
}

body.login h1 a {
  background-image: none !important;
  width: auto;
  height: auto;
  text-indent: 0;
  overflow: visible;
  display: inline-block;
  font-family: var(--wplite-font);
  font-size: 18px;
  font-weight: 600;
  color: var(--wplite-text);
  letter-spacing: -0.01em;
  line-height: 1.3;
  outline: none;
  box-shadow: none;
}

body.login h1 a:hover,
body.login h1 a:focus {
  color: var(--wplite-accent);
}

body.login form {
  background: var(--wplite-surface);
  border: 1px solid var(--wplite-border);
  border-radius: var(--wplite-radius);
  box-shadow: none;
  padding: 24px;
  margin: 0;
  font-weight: normal;
  overflow: visible;
}

body.login form p {
  margin-bottom: 12px;
}

body.login form label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--wplite-text);
  margin-bottom: 4px;
}

body.login form .input,
body.login input[type="text"],
body.login input[type="password"],
body.login input[type="email"] {
  width: 100%;
  height: 36px;
  padding: 6px 10px;
  font-size: 13px;
  font-family: var(--wplite-font);
  color: var(--wplite-text);
  background: var(--wplite-surface);
  border: 1px solid var(--wplite-border);
  border-radius: var(--wplite-radius-sm);
  box-shadow: none;
  transition: border-color 80ms ease, box-shadow 80ms ease;
  margin: 0 0 4px;
}

body.login form .input:focus,
body.login input[type="text"]:focus,
body.login input[type="password"]:focus,
body.login input[type="email"]:focus {
  border-color: var(--wplite-accent);
  box-shadow: none;
  outline: none;
}

body.login .wp-pwd {
  position: relative;
}

body.login .wp-pwd input[type="password"],
body.login .wp-pwd input[type="text"] {
  padding-right: 40px;
}

body.login .wp-pwd .button.wp-hide-pw {
  background: transparent;
  border: 0;
  box-shadow: none;
  color: var(--wplite-text-muted);
  height: 34px;
  top: 1px;
  right: 1px;
}

body.login .wp-pwd .button.wp-hide-pw:hover {
  color: var(--wplite-text);
}

body.login .forgetmenot {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--wplite-text-muted);
  margin-bottom: 16px;
  float: none;
}

body.login .forgetmenot input[type="checkbox"] {
  width: 16px;
  height: 16px;
  margin: 0;
  border: 1px solid var(--wplite-border);
  border-radius: 4px;
  background: var(--wplite-surface);
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
  position: relative;
  transition: border-color 80ms ease, background 80ms ease;
}

body.login .forgetmenot input[type="checkbox"]:checked {
  background: var(--wplite-accent);
  border-color: var(--wplite-accent);
}

body.login .forgetmenot input[type="checkbox"]:checked::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 1px;
  width: 5px;
  height: 9px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

body.login .forgetmenot input[type="checkbox"]:focus {
  border-color: var(--wplite-accent);
  box-shadow: none;
  outline: none;
}

body.login .forgetmenot label {
  margin: 0;
  font-size: 12px;
  color: var(--wplite-text-muted);
}

body.login .submit {
  margin: 0;
}

body.login .button-primary,
body.login #wp-submit {
  width: 100%;
  height: 36px;
  float: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--wplite-accent);
  border: 1px solid var(--wplite-accent);
  border-radius: var(--wplite-radius-sm);
  color: #fff;
  font-family: var(--wplite-font);
  font-size: 13px;
  font-weight: 500;
  padding: 0 14px;
  text-shadow: none;
  box-shadow: none;
  cursor: pointer;
  transition: background 80ms ease, border-color 80ms ease;
}

body.login .button-primary:hover,
body.login #wp-submit:hover,
body.login .button-primary:focus,
body.login #wp-submit:focus {
  background: var(--wplite-accent-hover);
  border-color: var(--wplite-accent-hover);
  color: #fff;
  box-shadow: none;
  outline: none;
}

body.login #nav,
body.login #backtoblog {
  text-align: center;
  margin: 12px 0 0;
  padding: 0 24px;
  font-size: 12px;
  color: var(--wplite-text-muted);
  text-shadow: none;
}

body.login #nav a,
body.login #backtoblog a {
  color: var(--wplite-text-muted);
  text-decoration: none;
  transition: color 80ms ease;
}

body.login #nav a:hover,
body.login #backtoblog a:hover,
body.login #nav a:focus,
body.login #backtoblog a:focus {
  color: var(--wplite-accent);
  box-shadow: none;
  outline: none;
}

body.login .message,
body.login .notice,
body.login #login_error {
  background: var(--wplite-surface);
  border: 1px solid var(--wplite-border);
  border-left: 3px solid var(--wplite-accent);
  border-radius: var(--wplite-radius-sm);
  box-shadow: none;
  padding: 10px 12px;
  margin: 0 0 16px;
  font-size: 12px;
  color: var(--wplite-text);
}

body.login #login_error {
  border-left-color: var(--wplite-destructive);
  color: var(--wplite-destructive);
}

body.login .privacy-policy-page-link {
  text-align: center;
  margin-top: 16px;
}

body.login .privacy-policy-page-link a {
  font-size: 12px;
  color: var(--wplite-text-muted);
}

body.login .language-switcher {
  margin-top: 16px;
}

body.login .language-switcher select {
  height: 32px;
  border: 1px solid var(--wplite-border);
  border-radius: var(--wplite-radius-sm);
  padding: 4px 8px;
  font-family: var(--wplite-font);
  font-size: 12px;
  background: var(--wplite-surface);
  color: var(--wplite-text);
}
`;
}

async function writeStaticAssets(pluginDir) {
  const assetsDir = path.join(pluginDir, 'assets');
  await ensureDir(assetsDir);
  await writeFile(path.join(assetsDir, 'login.css'), loginStyleCss());
}

