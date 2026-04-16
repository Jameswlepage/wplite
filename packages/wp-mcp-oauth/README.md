# wp-mcp-oauth

A purpose-built **OAuth 2.1 authorization server for WordPress MCP endpoints**. Install it alongside [`wordpress/mcp-adapter`](https://github.com/WordPress/mcp-adapter) to let Claude Desktop, Cursor, and other MCP clients connect directly over Streamable HTTP — no stdio proxy, no Application Password copy-paste.

Spec target: [MCP Authorization 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization).

## What's in the box

- **Discovery metadata** at `/.well-known/oauth-protected-resource` (RFC 9728) and `/.well-known/oauth-authorization-server` (RFC 8414), so MCP clients can locate the AS from the resource URL alone.
- **Dynamic Client Registration** at `POST /wp-json/oauth/v1/register` (RFC 7591), public clients only.
- **PKCE-only authorization code flow** — S256 mandatory, no plaintext.
- **RFC 8707 resource indicators** — tokens are audience-bound to the MCP endpoint they were requested for.
- **Bearer validation** wired into `mcp-adapter`'s `transport_permission_callback` so the adapter's HttpTransport gates tools behind a valid bearer.
- **WWW-Authenticate** challenge header on 401s per RFC 9728 §5.1, carrying the resource-metadata URL.

## What's deliberately out

- **No refresh tokens.** Access tokens live an hour; clients re-run the authorize flow after expiry.
- **No confidential clients.** PKCE-only is enough for every MCP client that matters.
- **No custom scopes.** The authenticated WordPress user's own capabilities are the scope.
- **No token introspection or revocation endpoints.** Tokens expire; admins can invalidate by deleting the `wp_mcp_oauth_tokens` option row.
- **No JWTs.** Opaque tokens stored (hashed) in `wp_options`.

The full lift is ~500 lines of PHP. If you need a general-purpose OAuth 2.1 server for a plugin ecosystem, this is not it. If you need an MCP client to connect via Claude Desktop's native Connector UI, this is exactly enough.

## Install

1. Drop the plugin directory into `wp-content/plugins/` (or reference it via `.wp-env.json`'s `plugins` array).
2. Activate it alongside `wordpress/mcp-adapter`.
3. Tell the adapter to use the Bearer callback when creating your server:

```php
use WP\MCP\Core\McpAdapter;
use WPMCPOAuth\Bearer;

add_action( 'mcp_adapter_init', function ( McpAdapter $adapter ) {
    $adapter->create_server(
        'my-server',
        'my',
        'mcp',
        'My MCP Server',
        'Description',
        'v1.0.0',
        [ \WP\MCP\Transport\HttpTransport::class ],
        \WP\MCP\Infrastructure\ErrorHandling\ErrorLogMcpErrorHandler::class,
        \WP\MCP\Infrastructure\Observability\NullMcpObservabilityHandler::class,
        $ability_ids,
        [],
        [],
        [ Bearer::class, 'check_request' ]   // ← transport permission callback
    );
} );
```

4. Register your MCP endpoint as a protected resource so the OAuth plugin will issue tokens audience-bound to it:

```php
add_filter( 'wp_mcp_oauth_protected_resources', function ( $resources ) {
    $resources[] = rest_url( 'my/mcp' );
    return $resources;
} );
```

## Connect Claude Desktop

1. Open **Settings → Connectors → Add custom connector**.
2. Paste your MCP endpoint (e.g. `https://your-site.test/wp-json/my/mcp`).
3. Claude discovers the OAuth metadata, registers itself dynamically, opens a browser window to `/oauth/authorize`, you log in to WordPress (if you aren't already) and click **Authorize**, and you're connected.

No Application Password to generate, no proxy to run, no JSON config to paste.

## Flow diagram

```
Claude Desktop                           Your WordPress
      │                                         │
      │──GET /wp-json/my/mcp (no bearer)─────→  │
      │                                         │
      │←─401 + WWW-Authenticate:                │
      │    Bearer resource_metadata="…"         │
      │                                         │
      │──GET /.well-known/oauth-protected-     │
      │    resource ───────────────────────→    │
      │                                         │
      │←──{ authorization_servers: [site] }    │
      │                                         │
      │──GET /.well-known/oauth-authorization-  │
      │    server ─────────────────────────→    │
      │                                         │
      │←──{ endpoints, PKCE methods, … }       │
      │                                         │
      │──POST /oauth/v1/register ──────────→    │
      │←──{ client_id }                        │
      │                                         │
      │──redirect user to /oauth/authorize      │
      │     ?client_id&code_challenge=S256&…    │
      │                                         │
      │                           [WP login     │
      │                            + consent]   │
      │                                         │
      │←──302 redirect_uri?code=…&state=…      │
      │                                         │
      │──POST /oauth/v1/token ─────────────→    │
      │     code + code_verifier + resource     │
      │←──{ access_token, expires_in }         │
      │                                         │
      │──MCP requests with Bearer ─────────→    │
      │←──tools/resources/prompts              │
```

## Security notes

- **HTTPS required.** The plugin refuses to run `/oauth/authorize` over plain HTTP unless the host is `localhost` / `127.0.0.1` (matching OAuth 2.1 §1.5 and MCP spec requirements).
- **DCR is open** per the MCP spec — anyone on the internet can `POST /oauth/v1/register` and obtain a `client_id`. A simple per-IP rate limit (10/min) blunts floods. An authenticated admin user's consent is still required for any actual token issuance.
- **Tokens are hashed at rest.** `wp_options` stores `wp_hash( $token, 'auth' )`, not the raw string, so a DB leak without access to `wp-config.php` doesn't yield working bearers.
- **Audience binding enforced.** Tokens are issued for a specific `resource` URI and validated against the request path. A token minted for `/wp-json/a/mcp` won't authenticate `/wp-json/b/mcp`.

## Configuration

All filters are optional — the defaults work for the single-MCP-server case.

| Filter | Default | Purpose |
|---|---|---|
| `wp_mcp_oauth_default_resource` | `rest_url('wplite/mcp')` | Canonical MCP resource advertised in protected-resource metadata |
| `wp_mcp_oauth_protected_resources` | `[ default_resource ]` | Full list of resource URIs this AS will issue tokens for |

## Uninstall

Options created: `wp_mcp_oauth_clients`, `wp_mcp_oauth_codes`, `wp_mcp_oauth_tokens` (all `autoload=no`). Cron event: `wp_mcp_oauth_cleanup` (daily).

Deactivation unschedules the cron. To fully remove, delete those three options after deactivating.

## License

GPL-2.0-or-later.
