<?php
/**
 * Consent screen rendered by Authorize::render_consent.
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
?><!doctype html>
<html lang="<?php echo esc_attr( get_locale() ); ?>">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width,initial-scale=1">
	<title><?php echo esc_html( sprintf( 'Authorize %s — %s', $client['client_name'] ?? 'Client', $site ) ); ?></title>
	<style>
		:root {
			color-scheme: light dark;
			--bg: #f6f7f7;
			--surface: #ffffff;
			--text: #1e1e1e;
			--muted: #6b6b6b;
			--border: #dcdcde;
			--accent: #2271b1;
			--danger: #d63638;
		}
		@media (prefers-color-scheme: dark) {
			:root { --bg: #1d1d1d; --surface: #2a2a2a; --text: #f5f5f5; --muted: #a8a8a8; --border: #3a3a3a; --accent: #72aee6; }
		}
		html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
		.shell { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
		.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 32px; max-width: 480px; width: 100%; box-shadow: 0 4px 24px rgba(0,0,0,.05); }
		h1 { margin: 0 0 8px; font-size: 20px; font-weight: 600; }
		.lede { margin: 0 0 24px; color: var(--muted); font-size: 14px; line-height: 1.5; }
		.detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-top: 1px solid var(--border); font-size: 13px; }
		.detail-row:last-of-type { border-bottom: 1px solid var(--border); }
		.detail-row .label { color: var(--muted); }
		.detail-row .value { font-weight: 500; max-width: 60%; text-align: right; word-break: break-all; }
		.scope-list { margin: 16px 0 24px; padding: 14px 16px; background: rgba(0,0,0,.03); border-radius: 8px; font-size: 13px; color: var(--muted); }
		@media (prefers-color-scheme: dark) { .scope-list { background: rgba(255,255,255,.04); } }
		.scope-list strong { color: var(--text); }
		.actions { display: flex; gap: 12px; margin-top: 24px; }
		.actions button { flex: 1; padding: 12px 20px; border-radius: 6px; font-size: 14px; font-weight: 500; border: 1px solid var(--border); cursor: pointer; transition: background .12s, border-color .12s; }
		.actions button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
		.actions button.primary:hover { filter: brightness(1.08); }
		.actions button.secondary { background: transparent; color: var(--text); }
		.actions button.secondary:hover { border-color: var(--muted); }
	</style>
</head>
<body>
	<div class="shell">
		<form class="card" method="post" action="<?php echo esc_url( home_url( '/oauth/authorize' ) ); ?>">
			<h1><?php echo esc_html( sprintf( 'Authorize %s', $client['client_name'] ?? 'this client' ) ); ?></h1>
			<p class="lede">
				<?php echo esc_html( sprintf(
					'%s is requesting access to %s via the Model Context Protocol. You\'re signed in as %s.',
					$client['client_name'] ?? 'This application',
					$site,
					$user->display_name ?: $user->user_login
				) ); ?>
			</p>

			<div class="detail-row"><span class="label">Target</span><span class="value"><?php echo esc_html( $params['resource'] ); ?></span></div>
			<?php if ( ! empty( $client['redirect_uris'][0] ) ) : ?>
				<div class="detail-row"><span class="label">Redirect</span><span class="value"><?php echo esc_html( $params['redirect_uri'] ); ?></span></div>
			<?php endif; ?>
			<div class="detail-row"><span class="label">Scope</span><span class="value"><?php echo esc_html( $params['scope'] ); ?></span></div>

			<div class="scope-list">
				<strong>What this grants</strong><br>
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
	</div>
</body>
</html>
