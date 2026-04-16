<?php
/**
 * Plugin Name: WP MCP OAuth
 * Description: OAuth 2.1 (DCR + PKCE) authorization for WordPress/mcp-adapter endpoints. Lets Claude Desktop and other MCP clients authorize against a WordPress site via the browser, without the stdio proxy.
 * Version:     0.1.0
 * Requires PHP: 7.4
 * License:     GPL-2.0-or-later
 *
 * Spec target: MCP Authorization 2025-06-18
 *   - RFC 9728 Protected Resource Metadata
 *   - RFC 8414 Authorization Server Metadata
 *   - RFC 7591 Dynamic Client Registration (public clients only)
 *   - RFC 7636 PKCE (S256)
 *   - RFC 8707 Resource Indicators
 *
 * Out of scope for v1: refresh tokens, confidential clients, scopes beyond the
 * authenticated WP user's native capabilities, token introspection, RFC 7009
 * revocation endpoint.
 *
 * @package WP_MCP_OAuth
 */

defined( 'ABSPATH' ) || exit;

define( 'WP_MCP_OAUTH_VERSION', '0.1.0' );
define( 'WP_MCP_OAUTH_DIR', plugin_dir_path( __FILE__ ) );
define( 'WP_MCP_OAUTH_REST_NAMESPACE', 'oauth/v1' );
define( 'WP_MCP_OAUTH_ACCESS_TOKEN_TTL', HOUR_IN_SECONDS );
define( 'WP_MCP_OAUTH_AUTH_CODE_TTL', 60 );

require_once WP_MCP_OAUTH_DIR . 'includes/helpers.php';
require_once WP_MCP_OAUTH_DIR . 'includes/storage.php';
require_once WP_MCP_OAUTH_DIR . 'includes/discovery.php';
require_once WP_MCP_OAUTH_DIR . 'includes/registration.php';
require_once WP_MCP_OAUTH_DIR . 'includes/authorize.php';
require_once WP_MCP_OAUTH_DIR . 'includes/token.php';
require_once WP_MCP_OAUTH_DIR . 'includes/bearer.php';

add_action( 'rest_api_init', [ '\\WPMCPOAuth\\Discovery', 'register_routes' ] );
add_action( 'rest_api_init', [ '\\WPMCPOAuth\\Registration', 'register_routes' ] );
add_action( 'rest_api_init', [ '\\WPMCPOAuth\\Token', 'register_routes' ] );

// Well-known endpoints must be served at the host root, not under /wp-json.
add_action( 'parse_request', [ '\\WPMCPOAuth\\Discovery', 'maybe_handle_well_known' ], 1 );

// Authorize endpoint intercepts a virtual URL so WP's cookie-auth redirect
// through wp-login happens naturally for unauthenticated users.
add_action( 'parse_request', [ '\\WPMCPOAuth\\Authorize', 'maybe_handle' ], 1 );

// Daily cleanup of expired codes and tokens.
register_activation_hook( __FILE__, [ '\\WPMCPOAuth\\Storage', 'on_activate' ] );
register_deactivation_hook( __FILE__, [ '\\WPMCPOAuth\\Storage', 'on_deactivate' ] );
add_action( 'wp_mcp_oauth_cleanup', [ '\\WPMCPOAuth\\Storage', 'cleanup_expired' ] );

// Early-authenticate Bearer-carrying requests via determine_current_user so
// the user context is set before any REST permission check runs.
add_filter( 'determine_current_user', [ '\\WPMCPOAuth\\Bearer', 'filter_determine_current_user' ], 20 );

// Tag 401 responses from protected MCP routes with WWW-Authenticate so the
// client knows where to find protected-resource metadata (RFC 9728 §5.1).
add_filter( 'rest_post_dispatch', [ '\\WPMCPOAuth\\Bearer', 'tag_challenge_on_401' ], 10, 3 );
