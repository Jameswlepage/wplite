<?php
/**
 * Stateless helpers: base64url, PKCE verification, resource normalization,
 * random token minting.
 *
 * @package WP_MCP_OAuth
 */

namespace WPMCPOAuth;

defined( 'ABSPATH' ) || exit;

class Helpers {
	/**
	 * Base64url encode a binary string (RFC 4648 §5, no padding).
	 */
	public static function b64url_encode( string $data ): string {
		return rtrim( strtr( base64_encode( $data ), '+/', '-_' ), '=' );
	}

	public static function b64url_decode( string $data ): string {
		$pad = strlen( $data ) % 4;
		if ( $pad > 0 ) {
			$data .= str_repeat( '=', 4 - $pad );
		}
		$decoded = base64_decode( strtr( $data, '-_', '+/' ), true );
		return $decoded === false ? '' : $decoded;
	}

	/**
	 * Verify a PKCE code_verifier against a stored code_challenge using S256.
	 * Returns true iff SHA256(verifier) base64url-encoded equals the challenge.
	 */
	public static function verify_pkce_s256( string $verifier, string $challenge ): bool {
		// Verifier must be 43..128 chars of [A-Za-z0-9-._~] (RFC 7636 §4.1).
		if ( strlen( $verifier ) < 43 || strlen( $verifier ) > 128 ) {
			return false;
		}
		if ( preg_match( '/[^A-Za-z0-9\-._~]/', $verifier ) ) {
			return false;
		}
		$computed = self::b64url_encode( hash( 'sha256', $verifier, true ) );
		return hash_equals( $challenge, $computed );
	}

	/**
	 * Random opaque token (URL-safe).
	 */
	public static function random_token( int $bytes = 32 ): string {
		return self::b64url_encode( random_bytes( $bytes ) );
	}

	/**
	 * Canonical MCP server URI (RFC 8707 §2 / RFC 9728 §3.1).
	 * wplite exposes its MCP server at /wp-json/<namespace>/<route>. We prefer
	 * the form with no trailing slash for interoperability.
	 */
	public static function default_resource_uri(): string {
		$url = untrailingslashit( (string) apply_filters(
			'wp_mcp_oauth_default_resource',
			rest_url( 'wplite/mcp' )
		) );
		return $url;
	}

	/**
	 * All resource URIs this OAuth AS is willing to issue tokens for. Consumers
	 * register additional MCP endpoints via the filter below. Comparing against
	 * this list is how we enforce RFC 8707 audience binding.
	 */
	public static function protected_resources(): array {
		$resources = apply_filters(
			'wp_mcp_oauth_protected_resources',
			[ self::default_resource_uri() ]
		);
		return array_values( array_unique( array_map( 'untrailingslashit', (array) $resources ) ) );
	}

	public static function is_protected_resource( string $uri ): bool {
		return in_array( untrailingslashit( $uri ), self::protected_resources(), true );
	}

	/**
	 * URL of the AS (this host). Authorization code exchange requires redirect
	 * URIs under https:// or http://localhost (MCP spec §2.3).
	 */
	public static function authorize_url(): string {
		return home_url( '/oauth/authorize' );
	}

	public static function token_url(): string {
		return rest_url( WP_MCP_OAUTH_REST_NAMESPACE . '/token' );
	}

	public static function registration_url(): string {
		return rest_url( WP_MCP_OAUTH_REST_NAMESPACE . '/register' );
	}

	public static function issuer(): string {
		return untrailingslashit( home_url() );
	}

	/**
	 * A loopback or https redirect URI — the only kind OAuth 2.1 allows for
	 * public clients.
	 */
	public static function is_allowed_redirect_uri( string $uri ): bool {
		$parts = wp_parse_url( $uri );
		if ( empty( $parts['scheme'] ) || empty( $parts['host'] ) ) {
			return false;
		}
		if ( 'https' === $parts['scheme'] ) {
			return true;
		}
		if ( 'http' === $parts['scheme'] && in_array( $parts['host'], [ 'localhost', '127.0.0.1', '[::1]' ], true ) ) {
			return true;
		}
		return false;
	}

	public static function json_response( array $payload, int $status = 200 ): void {
		status_header( $status );
		nocache_headers();
		header( 'Content-Type: application/json; charset=utf-8' );
		echo wp_json_encode( $payload );
		exit;
	}

	public static function json_error( string $error, string $description = '', int $status = 400 ): void {
		$payload = [ 'error' => $error ];
		if ( '' !== $description ) {
			$payload['error_description'] = $description;
		}
		self::json_response( $payload, $status );
	}
}
