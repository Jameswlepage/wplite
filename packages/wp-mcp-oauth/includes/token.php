<?php
/**
 * Token endpoint.
 *
 * POST /wp-json/oauth/v1/token  (application/x-www-form-urlencoded)
 *   grant_type=authorization_code
 *   code=<one-shot auth code>
 *   redirect_uri=<must match the one used at /authorize>
 *   client_id=<must match>
 *   code_verifier=<PKCE verifier that hashes to the stored challenge>
 *   resource=<must match the authorize resource>
 *
 * Issues an opaque bearer bound to (user, client, resource). No refresh
 * tokens. Access tokens expire after WP_MCP_OAUTH_ACCESS_TOKEN_TTL.
 *
 * @package WP_MCP_OAuth
 */

namespace WPMCPOAuth;

defined( 'ABSPATH' ) || exit;

class Token {
	public static function register_routes(): void {
		register_rest_route(
			WP_MCP_OAUTH_REST_NAMESPACE,
			'/token',
			[
				'methods'             => 'POST',
				'permission_callback' => '__return_true',
				'callback'            => [ self::class, 'handle' ],
			]
		);
	}

	public static function handle( \WP_REST_Request $request ) {
		$grant_type    = (string) $request->get_param( 'grant_type' );
		$code          = (string) $request->get_param( 'code' );
		$redirect_uri  = (string) $request->get_param( 'redirect_uri' );
		$client_id     = (string) $request->get_param( 'client_id' );
		$code_verifier = (string) $request->get_param( 'code_verifier' );
		$resource      = untrailingslashit( (string) $request->get_param( 'resource' ) );

		if ( 'authorization_code' !== $grant_type ) {
			return self::err( 'unsupported_grant_type' );
		}
		if ( '' === $code || '' === $redirect_uri || '' === $client_id || '' === $code_verifier ) {
			return self::err( 'invalid_request', 'Missing required parameter.' );
		}

		$client = Storage::get_client( $client_id );
		if ( ! $client ) {
			return self::err( 'invalid_client' );
		}

		$entry = Storage::consume_code( $code );
		if ( ! $entry ) {
			return self::err( 'invalid_grant', 'Authorization code invalid or expired.' );
		}

		if ( $entry['client_id'] !== $client_id ) {
			return self::err( 'invalid_grant', 'Code was issued to a different client.' );
		}
		if ( $entry['redirect_uri'] !== $redirect_uri ) {
			return self::err( 'invalid_grant', 'redirect_uri mismatch.' );
		}
		if ( '' !== $resource && $entry['resource'] !== $resource ) {
			return self::err( 'invalid_target', 'resource mismatch.' );
		}

		if ( ! Helpers::verify_pkce_s256( $code_verifier, $entry['code_challenge'] ) ) {
			return self::err( 'invalid_grant', 'PKCE verification failed.' );
		}

		$token = 'at_' . Helpers::random_token( 32 );
		$meta  = [
			'client_id'  => $entry['client_id'],
			'user_id'    => (int) $entry['user_id'],
			'resource'   => $entry['resource'],
			'scope'      => $entry['scope'] ?? 'mcp',
			'issued_at'  => time(),
			'expires_at' => time() + WP_MCP_OAUTH_ACCESS_TOKEN_TTL,
		];
		Storage::put_token( $token, $meta );

		$response = new \WP_REST_Response(
			[
				'access_token' => $token,
				'token_type'   => 'Bearer',
				'expires_in'   => WP_MCP_OAUTH_ACCESS_TOKEN_TTL,
				'scope'        => $meta['scope'],
			],
			200
		);
		$response->header( 'Cache-Control', 'no-store' );
		$response->header( 'Pragma', 'no-cache' );
		return $response;
	}

	private static function err( string $error, string $description = '' ): \WP_REST_Response {
		$payload = [ 'error' => $error ];
		if ( '' !== $description ) {
			$payload['error_description'] = $description;
		}
		$response = new \WP_REST_Response( $payload, 400 );
		$response->header( 'Cache-Control', 'no-store' );
		$response->header( 'Pragma', 'no-cache' );
		return $response;
	}
}
