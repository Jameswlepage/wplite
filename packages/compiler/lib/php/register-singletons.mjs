// Generates the `register-singletons.php` file included by the compiled plugin.
export function phpRegisterSingletonsFile() {
  return `<?php
defined( 'ABSPATH' ) || exit;

function portfolio_get_singleton( $key ) {
\treturn get_option( "portfolio_singleton_{$key}", [] );
}

function portfolio_update_singleton( $key, $data ) {
\treturn update_option( "portfolio_singleton_{$key}", $data );
}
`;
}

