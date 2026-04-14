// Generates the `register-meta.php` file included by the compiled plugin.
export function phpRegisterMetaFile() {
  return `<?php
defined( 'ABSPATH' ) || exit;

add_action( 'init', function() {
\tforeach ( portfolio_light_get_models() as $model ) {
\t\tforeach ( $model['fields'] ?? [] as $field_id => $field ) {
\t\t\tif ( 'repeater' === ( $field['type'] ?? '' ) ) {
\t\t\t\tcontinue;
\t\t\t}

\t\t\t$args = [
\t\t\t\t'object_subtype' => $model['postType'],
\t\t\t\t'type'           => portfolio_light_field_meta_type( $field ),
\t\t\t\t'single'         => true,
\t\t\t\t'show_in_rest'   => true,
\t\t\t];

\t\t\tregister_meta( 'post', $field_id, $args );
\t\t}
\t}
} );
`;
}

