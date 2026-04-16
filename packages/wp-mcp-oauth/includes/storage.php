<?php
/**
 * Option-backed storage for three buckets:
 *
 *   wp_mcp_oauth_clients : [ client_id => { redirect_uris, client_name, software_id, created_at } ]
 *   wp_mcp_oauth_codes   : [ code       => { client_id, redirect_uri, user_id, resource, code_challenge, code_challenge_method, expires_at } ]
 *   wp_mcp_oauth_tokens  : [ token_hash => { client_id, user_id, resource, expires_at, issued_at } ]
 *
 * Buckets are autoload=no to keep wp_options light. Access tokens are hashed
 * with wp_hash() so a DB leak doesn't yield usable bearers.
 *
 * @package WP_MCP_OAuth
 */

namespace WPMCPOAuth;

defined( 'ABSPATH' ) || exit;

class Storage {
	public const OPT_CLIENTS = 'wp_mcp_oauth_clients';
	public const OPT_CODES   = 'wp_mcp_oauth_codes';
	public const OPT_TOKENS  = 'wp_mcp_oauth_tokens';

	public static function on_activate(): void {
		// Ensure options exist with autoload=no.
		foreach ( [ self::OPT_CLIENTS, self::OPT_CODES, self::OPT_TOKENS ] as $opt ) {
			if ( false === get_option( $opt, false ) ) {
				add_option( $opt, [], '', 'no' );
			}
		}
		if ( ! wp_next_scheduled( 'wp_mcp_oauth_cleanup' ) ) {
			wp_schedule_event( time() + HOUR_IN_SECONDS, 'daily', 'wp_mcp_oauth_cleanup' );
		}
	}

	public static function on_deactivate(): void {
		wp_clear_scheduled_hook( 'wp_mcp_oauth_cleanup' );
	}

	private static function load( string $option ): array {
		$data = get_option( $option, [] );
		return is_array( $data ) ? $data : [];
	}

	private static function save( string $option, array $data ): void {
		update_option( $option, $data, false );
	}

	// ── Clients ────────────────────────────────────────────────────────────

	public static function put_client( string $client_id, array $meta ): void {
		$clients = self::load( self::OPT_CLIENTS );
		$clients[ $client_id ] = $meta;
		self::save( self::OPT_CLIENTS, $clients );
	}

	public static function get_client( string $client_id ): ?array {
		$clients = self::load( self::OPT_CLIENTS );
		return $clients[ $client_id ] ?? null;
	}

	public static function delete_client( string $client_id ): void {
		$clients = self::load( self::OPT_CLIENTS );
		unset( $clients[ $client_id ] );
		self::save( self::OPT_CLIENTS, $clients );
	}

	// ── Authorization codes ────────────────────────────────────────────────

	public static function put_code( string $code, array $meta ): void {
		$codes          = self::load( self::OPT_CODES );
		$codes[ $code ] = $meta;
		self::save( self::OPT_CODES, $codes );
	}

	/**
	 * Consume (delete) an authorization code and return its payload if still
	 * valid. Codes are one-shot by spec.
	 */
	public static function consume_code( string $code ): ?array {
		$codes = self::load( self::OPT_CODES );
		if ( ! isset( $codes[ $code ] ) ) {
			return null;
		}
		$entry = $codes[ $code ];
		unset( $codes[ $code ] );
		self::save( self::OPT_CODES, $codes );
		if ( ( $entry['expires_at'] ?? 0 ) < time() ) {
			return null;
		}
		return $entry;
	}

	// ── Access tokens ──────────────────────────────────────────────────────

	public static function put_token( string $token, array $meta ): void {
		$tokens                        = self::load( self::OPT_TOKENS );
		$tokens[ self::hash( $token ) ] = $meta;
		self::save( self::OPT_TOKENS, $tokens );
	}

	public static function get_token( string $token ): ?array {
		$tokens = self::load( self::OPT_TOKENS );
		$hash   = self::hash( $token );
		if ( ! isset( $tokens[ $hash ] ) ) {
			return null;
		}
		$entry = $tokens[ $hash ];
		if ( ( $entry['expires_at'] ?? 0 ) < time() ) {
			unset( $tokens[ $hash ] );
			self::save( self::OPT_TOKENS, $tokens );
			return null;
		}
		return $entry;
	}

	public static function delete_token( string $token ): void {
		$tokens = self::load( self::OPT_TOKENS );
		unset( $tokens[ self::hash( $token ) ] );
		self::save( self::OPT_TOKENS, $tokens );
	}

	/**
	 * Hash a bearer for storage. wp_hash includes SECURE_AUTH_KEY as salt, so
	 * a DB leak without access to wp-config.php doesn't yield working tokens.
	 */
	public static function hash( string $token ): string {
		return wp_hash( $token, 'auth' );
	}

	// ── Cleanup ────────────────────────────────────────────────────────────

	public static function cleanup_expired(): void {
		$now    = time();
		$codes  = self::load( self::OPT_CODES );
		$before = count( $codes );
		foreach ( $codes as $code => $entry ) {
			if ( ( $entry['expires_at'] ?? 0 ) < $now ) {
				unset( $codes[ $code ] );
			}
		}
		if ( count( $codes ) !== $before ) {
			self::save( self::OPT_CODES, $codes );
		}

		$tokens = self::load( self::OPT_TOKENS );
		$before = count( $tokens );
		foreach ( $tokens as $hash => $entry ) {
			if ( ( $entry['expires_at'] ?? 0 ) < $now ) {
				unset( $tokens[ $hash ] );
			}
		}
		if ( count( $tokens ) !== $before ) {
			self::save( self::OPT_TOKENS, $tokens );
		}
	}
}
