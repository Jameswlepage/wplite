<?php
/**
 * Bearer-token validation intended for use as the
 * mcp-adapter's transport_permission_callback.
 *
 * Usage from the wplite plugin (or any mcp-adapter consumer):
 *
 *   $adapter->create_server(
 *       'wplite', 'wplite', 'mcp', ...,
 *       $abilities, [], [],
 *       [ \WPMCPOAuth\Bearer::class, 'check_request' ]
 *   );
 *
 * Behavior:
 *   - Reads Authorization: Bearer <token> from the incoming WP_REST_Request.
 *   - Looks the token up, verifies it's not expired, and confirms its
 *     `resource` claim matches this route's canonical URL.
 *   - On success: wp_set_current_user($user_id), return true.
 *   - On failure: return false (adapter falls through to 401).
 *
 * The filter in Plugin.php tags 401 responses for the MCP route with the
 * WWW-Authenticate header required by RFC 9728 §5.1 so clients can discover
 * the authorization server from the resource URL alone.
 *
 * @package WP_MCP_OAuth
 */

namespace WPMCPOAuth;

defined( 'ABSPATH' ) || exit;

class Bearer {
	/**
	 * Cached (request, user_id) pair so we don't re-validate the Bearer for
	 * every callback that asks for current_user during a single request.
	 */
	private static $request_user_cache = null;

	/**
	 * `determine_current_user` filter — runs in WP's init before REST auth
	 * checks. Returning a user ID here gives that user context to the rest of
	 * the request (including the transport permission callback and every
	 * ability's permission check). This is the canonical hook for bearer-auth
	 * plugins (JWT, OAuth, etc.) and is what makes `current_user_can` behave
	 * consistently mid-request.
	 */
	public static function filter_determine_current_user( $user_id ) {
		if ( ! empty( $user_id ) ) {
			// Someone else (cookie, app-password) already authenticated. Leave
			// it alone so we don't override an explicit WP session.
			return $user_id;
		}
		$resolved = self::resolve_bearer_user();
		return $resolved > 0 ? $resolved : $user_id;
	}

	/**
	 * Transport permission callback passed to mcp-adapter's create_server.
	 * By the time this runs, `determine_current_user` has already set up the
	 * bearer's user if the token was valid — so we just confirm a user is
	 * logged in and the token audience matches this route.
	 */
	public static function check_request( \WP_REST_Request $request ): bool {
		if ( ! is_user_logged_in() ) {
			return false;
		}
		$token = self::extract_bearer_token( $request );
		if ( '' === $token ) {
			// Logged-in via cookie / app-password — honor that path.
			return true;
		}
		$entry = Storage::get_token( $token );
		if ( ! $entry ) {
			return false;
		}
		$expected_resource = self::canonical_request_url( $request );
		if ( untrailingslashit( $entry['resource'] ?? '' ) !== untrailingslashit( $expected_resource ) ) {
			return false;
		}
		return true;
	}

	/**
	 * Look up and validate the bearer token for the current HTTP request.
	 * Cached per request to avoid repeating the storage hit.
	 */
	private static function resolve_bearer_user(): int {
		if ( null !== self::$request_user_cache ) {
			return self::$request_user_cache;
		}
		$token = self::extract_bearer_token_from_server();
		if ( '' === $token ) {
			return self::$request_user_cache = 0;
		}
		$entry = Storage::get_token( $token );
		if ( ! $entry ) {
			return self::$request_user_cache = 0;
		}
		$user_id = (int) ( $entry['user_id'] ?? 0 );
		if ( $user_id <= 0 ) {
			return self::$request_user_cache = 0;
		}
		return self::$request_user_cache = $user_id;
	}

	/**
	 * Pull the bearer token from a REST request object. Supports the standard
	 * Authorization header and the HTTP_AUTHORIZATION CGI fallback (needed
	 * under some Apache setups).
	 */
	private static function extract_bearer_token( \WP_REST_Request $request ): string {
		$header = $request->get_header( 'authorization' );
		if ( ! $header ) {
			$header = self::raw_authorization_header();
		}
		return self::parse_bearer_header( (string) $header );
	}

	/**
	 * Pull the bearer from $_SERVER when we don't yet have a WP_REST_Request
	 * (i.e. inside the determine_current_user filter, which runs before REST
	 * dispatch).
	 */
	private static function extract_bearer_token_from_server(): string {
		return self::parse_bearer_header( self::raw_authorization_header() );
	}

	private static function raw_authorization_header(): string {
		if ( isset( $_SERVER['HTTP_AUTHORIZATION'] ) ) {
			return (string) $_SERVER['HTTP_AUTHORIZATION'];
		}
		if ( isset( $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ) ) {
			return (string) $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
		}
		if ( function_exists( 'getallheaders' ) ) {
			$all = getallheaders();
			foreach ( $all as $k => $v ) {
				if ( strtolower( (string) $k ) === 'authorization' ) {
					return (string) $v;
				}
			}
		}
		return '';
	}

	private static function parse_bearer_header( string $header ): string {
		if ( $header === '' || stripos( $header, 'Bearer ' ) !== 0 ) {
			return '';
		}
		return trim( substr( $header, 7 ) );
	}

	/**
	 * Rebuild the canonical REST URL for the current request so we can audit
	 * it against the token's `resource` claim. We want the MCP server base
	 * (e.g. https://site.test/wp-json/wplite/mcp), not the full request URI.
	 */
	private static function canonical_request_url( \WP_REST_Request $request ): string {
		$route = trim( (string) $request->get_route(), '/' );
		// Route looks like "wplite/mcp" or "wplite/mcp/sessions/...". Take the
		// first two segments (namespace + base route).
		$parts = explode( '/', $route );
		$base  = implode( '/', array_slice( $parts, 0, 2 ) );
		return untrailingslashit( rest_url( $base ) );
	}

	/**
	 * RFC 9728 §5.1: on 401 responses from a protected resource, emit a
	 * WWW-Authenticate header pointing the client at the resource-metadata
	 * URL. We key off the MCP route path to avoid tagging every WP 401.
	 */
	public static function tag_challenge_on_401( $response, $server, $request ) {
		if ( ! $response instanceof \WP_REST_Response && ! $response instanceof \WP_HTTP_Response ) {
			return $response;
		}
		$status = $response->get_status();
		if ( 401 !== $status ) {
			return $response;
		}
		$route = (string) $request->get_route();
		if ( ! self::is_protected_route( $route ) ) {
			return $response;
		}

		$metadata_url = rest_url( WP_MCP_OAUTH_REST_NAMESPACE . '/protected-resource' );
		$challenge    = sprintf(
			'Bearer realm="%s", resource_metadata="%s"',
			esc_url_raw( Helpers::issuer() ),
			esc_url_raw( $metadata_url )
		);
		$response->header( 'WWW-Authenticate', $challenge );
		return $response;
	}

	/**
	 * Does this REST route correspond to a registered protected-resource?
	 */
	private static function is_protected_route( string $route ): bool {
		$route = trim( $route, '/' );
		if ( '' === $route ) {
			return false;
		}
		$parts = explode( '/', $route );
		if ( count( $parts ) < 2 ) {
			return false;
		}
		$candidate = untrailingslashit( rest_url( $parts[0] . '/' . $parts[1] ) );
		return Helpers::is_protected_resource( $candidate );
	}
}
