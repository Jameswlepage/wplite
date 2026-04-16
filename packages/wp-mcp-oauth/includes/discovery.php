<?php
/**
 * OAuth discovery metadata.
 *
 * - RFC 9728 Protected Resource Metadata served at
 *     /.well-known/oauth-protected-resource
 *   (points clients at this server's AS, lists supported bearer methods).
 *
 * - RFC 8414 Authorization Server Metadata served at
 *     /.well-known/oauth-authorization-server
 *   (lists authorize/token/register endpoints, PKCE methods, grant types).
 *
 * Also exposes a REST-namespaced copy at /wp-json/oauth/v1/metadata for sanity
 * checks from within WP, but the spec-mandated locations are the .well-known
 * variants served at host root.
 *
 * @package WP_MCP_OAuth
 */

namespace WPMCPOAuth;

defined( 'ABSPATH' ) || exit;

class Discovery {
	public static function register_routes(): void {
		register_rest_route(
			WP_MCP_OAUTH_REST_NAMESPACE,
			'/metadata',
			[
				'methods'             => 'GET',
				'permission_callback' => '__return_true',
				'callback'            => static function () {
					return rest_ensure_response( self::as_metadata() );
				},
			]
		);
		register_rest_route(
			WP_MCP_OAUTH_REST_NAMESPACE,
			'/protected-resource',
			[
				'methods'             => 'GET',
				'permission_callback' => '__return_true',
				'callback'            => static function () {
					return rest_ensure_response( self::resource_metadata() );
				},
			]
		);
	}

	/**
	 * Intercept well-known requests before WP's main query runs. We can't use
	 * register_rest_route because the paths are host-root, not under /wp-json.
	 */
	public static function maybe_handle_well_known( \WP $wp ): void {
		$path = isset( $_SERVER['REQUEST_URI'] ) ? wp_parse_url( $_SERVER['REQUEST_URI'], PHP_URL_PATH ) : '';
		if ( ! is_string( $path ) ) {
			return;
		}
		$path = untrailingslashit( $path );

		if ( $path === '/.well-known/oauth-protected-resource' ) {
			Helpers::json_response( self::resource_metadata() );
		}
		if ( $path === '/.well-known/oauth-authorization-server' ) {
			Helpers::json_response( self::as_metadata() );
		}
	}

	/**
	 * RFC 9728 Protected Resource Metadata.
	 */
	public static function resource_metadata(): array {
		return [
			'resource'               => Helpers::default_resource_uri(),
			'authorization_servers'  => [ Helpers::issuer() ],
			'bearer_methods_supported' => [ 'header' ],
			'resource_documentation' => 'https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization',
		];
	}

	/**
	 * RFC 8414 Authorization Server Metadata.
	 */
	public static function as_metadata(): array {
		return [
			'issuer'                                         => Helpers::issuer(),
			'authorization_endpoint'                         => Helpers::authorize_url(),
			'token_endpoint'                                 => Helpers::token_url(),
			'registration_endpoint'                          => Helpers::registration_url(),
			'response_types_supported'                       => [ 'code' ],
			'grant_types_supported'                          => [ 'authorization_code' ],
			'code_challenge_methods_supported'               => [ 'S256' ],
			'token_endpoint_auth_methods_supported'          => [ 'none' ], // public clients only
			'scopes_supported'                               => [ 'mcp' ],
			'response_modes_supported'                       => [ 'query' ],
			'resource_parameter_supported'                   => true,
			'authorization_response_iss_parameter_supported' => true,
		];
	}
}
