<?php
/**
 * Authorize endpoint + consent UI.
 *
 * Path: /oauth/authorize (host root, intercepted via parse_request so WP's
 * cookie-auth redirect through wp-login works for unauthenticated users).
 *
 * Flow:
 *   1. Client sends user-agent to /oauth/authorize with:
 *        response_type=code
 *        client_id
 *        redirect_uri
 *        code_challenge, code_challenge_method=S256
 *        state
 *        resource                  (RFC 8707 target MCP URI)
 *        scope=mcp                 (optional, informational)
 *   2. If not logged in → wp_redirect to wp-login with redirect_to back here.
 *   3. Show a simple consent page with Allow / Deny.
 *   4. On Allow: mint authorization code, store { user_id, client_id,
 *      redirect_uri, resource, code_challenge } with 60s TTL, redirect to
 *      redirect_uri?code=...&state=...&iss=...
 *   5. On Deny: redirect to redirect_uri with error=access_denied.
 *
 * Security:
 *   - redirect_uri must exactly match one registered for the client.
 *   - resource must match a protected-resource registered on this host.
 *   - CSRF-guarded via the WP user's nonce on the consent form submit.
 *
 * @package WP_MCP_OAuth
 */

namespace WPMCPOAuth;

defined( 'ABSPATH' ) || exit;

class Authorize {
	private const NONCE_ACTION = 'wp_mcp_oauth_consent';

	public static function maybe_handle( \WP $wp ): void {
		$path = isset( $_SERVER['REQUEST_URI'] ) ? wp_parse_url( $_SERVER['REQUEST_URI'], PHP_URL_PATH ) : '';
		if ( ! is_string( $path ) || untrailingslashit( $path ) !== '/oauth/authorize' ) {
			return;
		}

		if ( ! is_ssl() && ! self::is_local_host() ) {
			// OAuth 2.1 requires HTTPS except for localhost.
			self::render_error( 'HTTPS required' );
			exit;
		}

		$method = isset( $_SERVER['REQUEST_METHOD'] ) ? strtoupper( (string) $_SERVER['REQUEST_METHOD'] ) : 'GET';
		if ( 'POST' === $method ) {
			self::handle_post();
			exit;
		}
		self::handle_get();
		exit;
	}

	// ── GET: validate + render consent ────────────────────────────────────

	private static function handle_get(): void {
		$params = self::parse_authorize_params( $_GET ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- OAuth public endpoint

		// Fatal param errors: render error page, do not redirect (spec §4.1.2.1).
		if ( isset( $params['_fatal'] ) ) {
			self::render_error( $params['_fatal'] );
			return;
		}

		// Redirectable errors beyond this point go back to the client with
		// error=... in the query.
		if ( isset( $params['_client_error'] ) ) {
			self::redirect_with_error( $params['redirect_uri'], $params['state'] ?? '', $params['_client_error'] );
			return;
		}

		if ( ! is_user_logged_in() ) {
			// Send the user through wp-login and bring them back here.
			$return = add_query_arg(
				$_GET, // phpcs:ignore WordPress.Security.NonceVerification.Recommended
				home_url( '/oauth/authorize' )
			);
			wp_safe_redirect( wp_login_url( $return ) );
			exit;
		}

		self::render_consent( $params );
	}

	// ── POST: process Allow/Deny from the consent form ────────────────────

	private static function handle_post(): void {
		if ( ! is_user_logged_in() ) {
			self::render_error( 'Session expired.' );
			return;
		}

		$nonce = $_POST['_wpnonce'] ?? '';
		if ( ! wp_verify_nonce( $nonce, self::NONCE_ACTION ) ) {
			self::render_error( 'Invalid request.' );
			return;
		}

		$params = self::parse_authorize_params( $_POST );
		if ( isset( $params['_fatal'] ) ) {
			self::render_error( $params['_fatal'] );
			return;
		}
		if ( isset( $params['_client_error'] ) ) {
			self::redirect_with_error( $params['redirect_uri'], $params['state'] ?? '', $params['_client_error'] );
			return;
		}

		$decision = isset( $_POST['allow'] ) ? 'allow' : 'deny';
		if ( 'deny' === $decision ) {
			self::redirect_with_error( $params['redirect_uri'], $params['state'] ?? '', 'access_denied' );
			return;
		}

		$code = 'ac_' . Helpers::random_token( 24 );
		Storage::put_code(
			$code,
			[
				'client_id'             => $params['client_id'],
				'redirect_uri'          => $params['redirect_uri'],
				'user_id'               => get_current_user_id(),
				'resource'              => $params['resource'],
				'code_challenge'        => $params['code_challenge'],
				'code_challenge_method' => 'S256',
				'scope'                 => $params['scope'] ?? 'mcp',
				'expires_at'            => time() + WP_MCP_OAUTH_AUTH_CODE_TTL,
				'issued_at'             => time(),
			]
		);

		$redirect = add_query_arg(
			[
				'code'  => $code,
				'state' => $params['state'] ?? '',
				'iss'   => rawurlencode( Helpers::issuer() ),
			],
			$params['redirect_uri']
		);
		wp_redirect( $redirect );
		exit;
	}

	// ── Param parsing with fatal/client-error partitioning ────────────────

	private static function parse_authorize_params( array $source ): array {
		$client_id     = isset( $source['client_id'] ) ? sanitize_text_field( wp_unslash( (string) $source['client_id'] ) ) : '';
		$redirect_uri  = isset( $source['redirect_uri'] ) ? esc_url_raw( wp_unslash( (string) $source['redirect_uri'] ) ) : '';
		$response_type = isset( $source['response_type'] ) ? sanitize_text_field( wp_unslash( (string) $source['response_type'] ) ) : '';
		$state         = isset( $source['state'] ) ? sanitize_text_field( wp_unslash( (string) $source['state'] ) ) : '';
		$challenge     = isset( $source['code_challenge'] ) ? sanitize_text_field( wp_unslash( (string) $source['code_challenge'] ) ) : '';
		$method        = isset( $source['code_challenge_method'] ) ? sanitize_text_field( wp_unslash( (string) $source['code_challenge_method'] ) ) : '';
		$resource      = isset( $source['resource'] ) ? esc_url_raw( wp_unslash( (string) $source['resource'] ) ) : '';
		$scope         = isset( $source['scope'] ) ? sanitize_text_field( wp_unslash( (string) $source['scope'] ) ) : 'mcp';

		if ( '' === $client_id ) {
			return [ '_fatal' => 'Missing client_id.' ];
		}
		$client = Storage::get_client( $client_id );
		if ( ! $client ) {
			return [ '_fatal' => 'Unknown client_id.' ];
		}

		if ( '' === $redirect_uri || ! in_array( $redirect_uri, $client['redirect_uris'] ?? [], true ) ) {
			// Per spec we MUST NOT redirect when redirect_uri is invalid.
			return [ '_fatal' => 'Invalid redirect_uri.' ];
		}

		$parsed = [
			'client_id'    => $client_id,
			'redirect_uri' => $redirect_uri,
			'state'        => $state,
			'scope'        => $scope,
		];

		if ( 'code' !== $response_type ) {
			return $parsed + [ '_client_error' => 'unsupported_response_type' ];
		}
		if ( '' === $challenge ) {
			return $parsed + [ '_client_error' => 'invalid_request' ];
		}
		if ( 'S256' !== $method ) {
			return $parsed + [ '_client_error' => 'invalid_request' ];
		}
		if ( '' === $resource ) {
			return $parsed + [ '_client_error' => 'invalid_target' ];
		}
		if ( ! Helpers::is_protected_resource( $resource ) ) {
			return $parsed + [ '_client_error' => 'invalid_target' ];
		}

		return $parsed + [
			'code_challenge' => $challenge,
			'resource'       => untrailingslashit( $resource ),
		];
	}

	// ── Render helpers ────────────────────────────────────────────────────

	private static function render_consent( array $params ): void {
		$client = Storage::get_client( $params['client_id'] );
		$user   = wp_get_current_user();
		$site   = get_bloginfo( 'name' );

		nocache_headers();
		header( 'Content-Type: text/html; charset=utf-8' );
		include WP_MCP_OAUTH_DIR . 'templates/consent.php';
	}

	private static function render_error( string $message ): void {
		nocache_headers();
		status_header( 400 );
		header( 'Content-Type: text/html; charset=utf-8' );
		$title   = 'Authorization error';
		$content = esc_html( $message );
		include WP_MCP_OAUTH_DIR . 'templates/error.php';
	}

	private static function redirect_with_error( string $redirect_uri, string $state, string $error ): void {
		$url = add_query_arg(
			[
				'error' => $error,
				'state' => $state,
				'iss'   => rawurlencode( Helpers::issuer() ),
			],
			$redirect_uri
		);
		wp_redirect( $url );
		exit;
	}

	private static function is_local_host(): bool {
		$host = isset( $_SERVER['HTTP_HOST'] ) ? strtolower( (string) $_SERVER['HTTP_HOST'] ) : '';
		if ( preg_match( '/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/', $host ) ) {
			return true;
		}
		return false;
	}
}
