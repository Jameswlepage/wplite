<?php
/**
 * Consent screen rendered by Authorize::render_consent.
 *
 * Visual language intentionally mirrors the wplite login screen
 * (packages/compiler/lib/assets/login.css): dark page, 348px panel,
 * 2px radius, accent blue, fixed WP mark top-center, footer bottom-fixed.
 *
 * Variables in scope:
 *   $params — validated authorize params
 *   $client — client record
 *   $user   — WP_User
 *   $site   — site name
 *
 * @package WP_MCP_OAuth
 */

defined( 'ABSPATH' ) || exit;

$client_name = $client['client_name'] ?? 'This client';
$user_label  = $user->display_name ?: $user->user_login;
$home        = home_url( '/' );
?><!doctype html>
<html lang="<?php echo esc_attr( get_locale() ); ?>">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width,initial-scale=1">
	<title><?php echo esc_html( sprintf( 'Authorize %s — %s', $client_name, $site ) ); ?></title>
	<style>
		:root {
			--wplite-page-bg: #1f1f1f;
			--wplite-panel-bg: #2a2a2a;
			--wplite-text: #f3f3f3;
			--wplite-text-muted: #7b7b7f;
			--wplite-link: #4a5ce4;
			--wplite-link-hover: #5b6bf0;
			--wplite-accent: #4557dc;
			--wplite-accent-hover: #5061e4;
			--wplite-border-subtle: rgba(255, 255, 255, 0.08);
			--wplite-row-bg: rgba(255, 255, 255, 0.04);
			--wplite-radius: 2px;
			--wplite-font: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif;
		}
		*, *::before, *::after { box-sizing: border-box; }
		html, body {
			margin: 0;
			min-height: 100vh;
			background: var(--wplite-page-bg);
			color: var(--wplite-text);
			font-family: var(--wplite-font);
			font-size: 13px;
			line-height: 1.5;
			-webkit-font-smoothing: antialiased;
		}
		body {
			padding: 84px 24px 120px;
			display: flex;
			align-items: center;
			justify-content: center;
		}
		.wplite-mark {
			position: fixed;
			top: 20px;
			left: 50%;
			transform: translateX(-50%);
			display: block;
			width: 38px;
			height: 38px;
			background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 122.52 122.523'%3E%3Cpath fill='%23ffffff' d='M8.708 61.26c0 20.802 12.089 38.779 29.619 47.298L13.258 39.872a52.32 52.32 0 0 0-4.55 21.388zm90.061-2.713c0-6.495-2.333-10.993-4.334-14.494-2.664-4.329-5.161-7.995-5.161-12.324 0-4.831 3.664-9.328 8.825-9.328.233 0 .454.029.681.042-9.35-8.566-21.807-13.796-35.489-13.796-18.36 0-34.513 9.42-43.91 23.688 1.233.037 2.395.063 3.382.063 5.497 0 14.006-.667 14.006-.667 2.833-.167 3.167 3.994.337 4.329 0 0-2.847.335-6.015.501l19.138 56.925 11.501-34.493-8.188-22.434c-2.83-.166-5.511-.5-5.511-.5-2.832-.166-2.5-4.496.332-4.329 0 0 8.679.667 13.843.667 5.496 0 14.006-.667 14.006-.667 2.835-.167 3.168 3.994.337 4.329 0 0-2.853.335-6.015.501l18.992 56.494 5.242-17.517c2.272-7.269 4.001-12.49 4.001-16.988zM64.087 65.796l-15.768 45.819c4.708 1.384 9.687 2.141 14.851 2.141 6.125 0 11.999-1.058 17.465-2.979-.141-.225-.269-.464-.374-.724l-16.174-44.257zm45.304-29.877c.226 1.674.354 3.471.354 5.404 0 5.333-.996 11.328-3.996 18.824l-16.053 46.413c15.624-9.111 26.133-26.038 26.133-45.426.002-9.137-2.333-17.729-6.438-25.215zM61.262 0C27.484 0 0 27.482 0 61.26c0 33.783 27.484 61.263 61.262 61.263 33.778 0 61.265-27.48 61.265-61.263C122.526 27.482 95.039 0 61.262 0zm0 119.715c-32.23 0-58.453-26.223-58.453-58.455 0-32.23 26.222-58.451 58.453-58.451 32.229 0 58.45 26.221 58.45 58.451 0 32.232-26.221 58.455-58.45 58.455z'/%3E%3C/svg%3E");
			background-position: center;
			background-repeat: no-repeat;
			background-size: contain;
			text-indent: -9999px;
			overflow: hidden;
		}
		.wplite-mark:hover, .wplite-mark:focus { opacity: 0.8; outline: none; }
		.panel {
			width: 348px;
			max-width: 100%;
			padding: 24px;
			background: var(--wplite-panel-bg);
			border-radius: var(--wplite-radius);
			display: flex;
			flex-direction: column;
			gap: 16px;
		}
		.panel h1 {
			margin: 0;
			color: var(--wplite-text);
			font-size: 15px;
			font-weight: 600;
			letter-spacing: -0.005em;
		}
		.panel .lede {
			margin: 0;
			color: var(--wplite-text-muted);
			font-size: 12px;
			line-height: 1.55;
		}
		.panel .lede strong { color: var(--wplite-text); font-weight: 600; }
		.detail {
			margin: 0;
			padding: 0;
			list-style: none;
			border-top: 1px solid var(--wplite-border-subtle);
		}
		.detail li {
			display: flex;
			justify-content: space-between;
			align-items: baseline;
			gap: 12px;
			padding: 10px 0;
			border-bottom: 1px solid var(--wplite-border-subtle);
			font-size: 12px;
		}
		.detail .label {
			flex: 0 0 auto;
			color: var(--wplite-text-muted);
			font-weight: 500;
		}
		.detail .value {
			flex: 1 1 auto;
			min-width: 0;
			color: var(--wplite-text);
			font-weight: 500;
			text-align: right;
			overflow-wrap: anywhere;
			word-break: break-word;
		}
		.detail code.value {
			font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
			font-size: 11px;
		}
		.grant {
			margin: 0;
			padding: 12px 14px;
			background: var(--wplite-row-bg);
			border-radius: var(--wplite-radius);
			color: var(--wplite-text-muted);
			font-size: 12px;
			line-height: 1.55;
		}
		.grant strong {
			display: block;
			margin-bottom: 4px;
			color: var(--wplite-text);
			font-weight: 600;
		}
		.actions {
			display: flex;
			gap: 8px;
			margin: 0;
		}
		.actions button {
			flex: 1;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			height: 40px;
			padding: 0 16px;
			border-radius: var(--wplite-radius);
			font-family: var(--wplite-font);
			font-size: 14px;
			font-weight: 600;
			cursor: pointer;
			transition: background-color 80ms ease, border-color 80ms ease, color 80ms ease;
			-webkit-appearance: none;
			appearance: none;
		}
		.actions button.primary {
			border: 1px solid var(--wplite-accent);
			background: var(--wplite-accent);
			color: #ffffff;
		}
		.actions button.primary:hover,
		.actions button.primary:focus {
			background: var(--wplite-accent-hover);
			border-color: var(--wplite-accent-hover);
			outline: none;
		}
		.actions button.secondary {
			border: 1px solid var(--wplite-border-subtle);
			background: transparent;
			color: var(--wplite-text-muted);
		}
		.actions button.secondary:hover,
		.actions button.secondary:focus {
			color: var(--wplite-text);
			border-color: rgba(255, 255, 255, 0.24);
			outline: none;
		}
		.footer {
			position: fixed;
			right: 24px;
			bottom: 32px;
			left: 24px;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 10px;
			color: var(--wplite-text-muted);
			font-size: 12px;
		}
		.footer a {
			color: var(--wplite-text-muted);
			text-decoration: none;
		}
		.footer a:hover,
		.footer a:focus {
			color: #ffffff;
			outline: none;
		}
		.footer .sep { color: #6d6d72; }
	</style>
</head>
<body>
	<a class="wplite-mark" href="<?php echo esc_url( $home ); ?>" aria-label="<?php echo esc_attr( $site ); ?>">
		<?php echo esc_html( $site ); ?>
	</a>

	<form class="panel" method="post" action="<?php echo esc_url( home_url( '/oauth/authorize' ) ); ?>">
		<h1><?php echo esc_html( sprintf( 'Authorize %s', $client_name ) ); ?></h1>
		<p class="lede">
			<strong><?php echo esc_html( $client_name ); ?></strong>
			is requesting access to <strong><?php echo esc_html( $site ); ?></strong> via the Model Context Protocol.
			You&rsquo;re signed in as <strong><?php echo esc_html( $user_label ); ?></strong>.
		</p>

		<ul class="detail">
			<li>
				<span class="label">Target</span>
				<code class="value"><?php echo esc_html( $params['resource'] ); ?></code>
			</li>
			<li>
				<span class="label">Redirect</span>
				<code class="value"><?php echo esc_html( $params['redirect_uri'] ); ?></code>
			</li>
			<li>
				<span class="label">Scope</span>
				<span class="value"><?php echo esc_html( $params['scope'] ); ?></span>
			</li>
		</ul>

		<div class="grant">
			<strong>What this grants</strong>
			Access to MCP tools on this site, acting with your WordPress capabilities.
			Tokens expire after one hour.
		</div>

		<?php
		foreach ( [ 'client_id', 'redirect_uri', 'response_type', 'state', 'code_challenge', 'code_challenge_method', 'resource', 'scope' ] as $field ) {
			$value = $params[ $field ] ?? ( $_GET[ $field ] ?? '' );
			printf( '<input type="hidden" name="%s" value="%s">', esc_attr( $field ), esc_attr( $value ) );
		}
		wp_nonce_field( 'wp_mcp_oauth_consent' );
		?>

		<div class="actions">
			<button type="submit" name="deny" value="1" class="secondary">Deny</button>
			<button type="submit" name="allow" value="1" class="primary">Authorize</button>
		</div>
	</form>

	<footer class="footer">
		<a href="<?php echo esc_url( $home ); ?>"><?php echo esc_html( $site ); ?></a>
		<span class="sep">&middot;</span>
		<span>Model Context Protocol</span>
	</footer>
</body>
</html>
