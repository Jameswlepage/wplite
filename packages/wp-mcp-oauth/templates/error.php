<?php
/**
 * Fatal-error page for /oauth/authorize when we can't safely redirect back
 * to the client (e.g. unknown client_id or redirect_uri mismatch).
 *
 * Variables in scope:
 *   $title   — page title
 *   $content — already-escaped message body
 *
 * @package WP_MCP_OAuth
 */

defined( 'ABSPATH' ) || exit;
?><!doctype html>
<html lang="<?php echo esc_attr( get_locale() ); ?>">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width,initial-scale=1">
	<title><?php echo esc_html( $title ); ?></title>
	<style>
		html,body { margin:0; padding:0; background:#f6f7f7; color:#1e1e1e; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
		@media (prefers-color-scheme: dark) { html,body { background:#1d1d1d; color:#f5f5f5; } }
		.shell { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
		.card { max-width:420px; padding:28px; background:#fff; border-radius:12px; border:1px solid #dcdcde; }
		@media (prefers-color-scheme: dark) { .card { background:#2a2a2a; border-color:#3a3a3a; } }
		h1 { margin:0 0 10px; font-size:18px; font-weight:600; }
		p { margin:0; color:#6b6b6b; font-size:14px; }
	</style>
</head>
<body>
	<div class="shell">
		<div class="card">
			<h1><?php echo esc_html( $title ); ?></h1>
			<p><?php echo $content; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- caller escapes ?></p>
		</div>
	</div>
</body>
</html>
