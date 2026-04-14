// Generates the `register-singletons.php` file included by the compiled plugin.
export function phpRegisterSingletonsFile() {
  return `<?php
defined( 'ABSPATH' ) || exit;

function portfolio_light_canonical_value( $source ) {
\tswitch ( $source ) {
\t\tcase 'site.title':       return get_bloginfo( 'name' );
\t\tcase 'site.description': return get_bloginfo( 'description' );
\t\tcase 'site.url':         return home_url( '/' );
\t\tcase 'site.language':    return get_bloginfo( 'language' );
\t\tcase 'site.icon':        return (int) get_option( 'site_icon', 0 );
\t\tcase 'site.icon_url':    return function_exists( 'get_site_icon_url' ) ? get_site_icon_url( 512 ) : '';
\t\tcase 'site.admin_email': return get_option( 'admin_email' );
\t\tcase 'site.locale':      return get_locale();
\t\tcase 'site.timezone':    return wp_timezone_string();
\t}
\treturn null;
}

function portfolio_light_field_is_empty( $value ) {
\tif ( $value === null ) return true;
\tif ( $value === '' ) return true;
\tif ( is_array( $value ) && count( $value ) === 0 ) return true;
\tif ( is_numeric( $value ) && (int) $value === 0 ) return true;
\treturn false;
}

function portfolio_light_singleton_with_inheritance( $singleton_id ) {
\t$schema = portfolio_light_get_singleton_schema( $singleton_id );
\tif ( ! $schema ) return [];
\t$stored = get_option( 'portfolio_singleton_' . $singleton_id, [] );
\tif ( ! is_array( $stored ) ) $stored = [];
\t$merged = $stored;
\tforeach ( $schema['fields'] ?? [] as $field_id => $field ) {
\t\t$source = $field['inheritsFrom'] ?? null;
\t\tif ( ! $source ) continue;
\t\t$value = $stored[ $field_id ] ?? null;
\t\tif ( portfolio_light_field_is_empty( $value ) ) {
\t\t\t$merged[ $field_id ] = portfolio_light_canonical_value( $source );
\t\t}
\t}
\treturn $merged;
}

function portfolio_get_singleton( $key ) {
\treturn portfolio_light_singleton_with_inheritance( $key );
}

function portfolio_get_singleton_raw( $key ) {
\treturn get_option( "portfolio_singleton_{$key}", [] );
}

function portfolio_update_singleton( $key, $data ) {
\treturn update_option( "portfolio_singleton_{$key}", $data );
}
`;
}
