<?php
/**
 * RFC 7591 Dynamic Client Registration — public clients only.
 *
 * An MCP client (e.g. Claude Desktop) POSTs its metadata; we mint a client_id
 * and echo the stored metadata back. No client_secret is issued — DCR for
 * public clients is always paired with PKCE at authorize/token time.
 *
 * Security posture:
 *   - open endpoint (spec requires this to enable "discover → connect" flows)
 *   - redirect_uris validated as https:// or http://localhost* (OAuth 2.1 §1.5)
 *   - rate-limit per IP (basic, transient-backed) to blunt registration floods
 *
 * @package WP_MCP_OAuth
 */

namespace WPMCPOAuth;

defined( 'ABSPATH' ) || exit;

class Registration {
	public static function register_routes(): void {
		register_rest_route(
			WP_MCP_OAUTH_REST_NAMESPACE,
			'/register',
			[
				'methods'             => 'POST',
				'permission_callback' => '__return_true',
				'callback'            => [ self::class, 'handle' ],
			]
		);
	}

	public static function handle( \WP_REST_Request $request ) {
		if ( ! self::rate_limit_ok() ) {
			return new \WP_REST_Response(
				[ 'error' => 'too_many_requests' ],
				429
			);
		}

		$body = $request->get_json_params();
		if ( ! is_array( $body ) ) {
			return new \WP_REST_Response(
				[ 'error' => 'invalid_client_metadata', 'error_description' => 'Request body must be JSON.' ],
				400
			);
		}

		$redirect_uris = $body['redirect_uris'] ?? null;
		if ( ! is_array( $redirect_uris ) || count( $redirect_uris ) === 0 ) {
			return new \WP_REST_Response(
				[ 'error' => 'invalid_redirect_uri', 'error_description' => 'redirect_uris is required.' ],
				400
			);
		}

		foreach ( $redirect_uris as $uri ) {
			if ( ! is_string( $uri ) || ! Helpers::is_allowed_redirect_uri( $uri ) ) {
				return new \WP_REST_Response(
					[ 'error' => 'invalid_redirect_uri', 'error_description' => "redirect_uri $uri must be https or http://localhost." ],
					400
				);
			}
		}

		// token_endpoint_auth_method — we only support 'none' (public client).
		$auth_method = $body['token_endpoint_auth_method'] ?? 'none';
		if ( 'none' !== $auth_method ) {
			return new \WP_REST_Response(
				[ 'error' => 'invalid_client_metadata', 'error_description' => 'Only token_endpoint_auth_method=none (public client) is supported.' ],
				400
			);
		}

		$grant_types = $body['grant_types'] ?? [ 'authorization_code' ];
		if ( ! is_array( $grant_types ) || ! in_array( 'authorization_code', $grant_types, true ) ) {
			return new \WP_REST_Response(
				[ 'error' => 'invalid_client_metadata', 'error_description' => 'grant_types must include authorization_code.' ],
				400
			);
		}

		$client_id = 'mcp_' . Helpers::random_token( 12 );
		$meta      = [
			'client_id'                  => $client_id,
			'client_name'                => (string) ( $body['client_name'] ?? 'MCP Client' ),
			'redirect_uris'              => array_values( $redirect_uris ),
			'grant_types'                => [ 'authorization_code' ],
			'response_types'             => [ 'code' ],
			'token_endpoint_auth_method' => 'none',
			'software_id'                => (string) ( $body['software_id'] ?? '' ),
			'software_version'           => (string) ( $body['software_version'] ?? '' ),
			'created_at'                 => time(),
		];

		Storage::put_client( $client_id, $meta );

		$response = new \WP_REST_Response( $meta, 201 );
		$response->header( 'Cache-Control', 'no-store' );
		$response->header( 'Pragma', 'no-cache' );
		return $response;
	}

	private static function rate_limit_ok(): bool {
		$ip  = isset( $_SERVER['REMOTE_ADDR'] ) ? preg_replace( '/[^0-9a-fA-F:.]/', '', (string) $_SERVER['REMOTE_ADDR'] ) : 'unknown';
		$key = 'wp_mcp_oauth_reg_' . md5( $ip );
		$hits = (int) get_transient( $key );
		if ( $hits >= 10 ) {
			return false;
		}
		set_transient( $key, $hits + 1, MINUTE_IN_SECONDS );
		return true;
	}
}
