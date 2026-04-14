// Generates the `register-taxonomies.php` file included by the compiled plugin.
export function phpRegisterTaxonomiesFile() {
  return `<?php
defined( 'ABSPATH' ) || exit;

add_action( 'init', function() {
\t$taxonomies = [];

\tforeach ( portfolio_light_get_models() as $model ) {
\t\tforeach ( $model['taxonomies'] ?? [] as $taxonomy ) {
\t\t\t$taxonomies[ $taxonomy ][] = $model['postType'];
\t\t}
\t}

\tforeach ( $taxonomies as $taxonomy => $post_types ) {
\t\tregister_taxonomy(
\t\t\t$taxonomy,
\t\t\tarray_values( array_unique( $post_types ) ),
\t\t\t[
\t\t\t\t'label'        => ucwords( str_replace( '_', ' ', $taxonomy ) ),
\t\t\t\t'public'       => true,
\t\t\t\t'show_ui'      => true,
\t\t\t\t'show_in_rest' => true,
\t\t\t\t'rewrite'      => [ 'slug' => $taxonomy ],
\t\t\t]
\t\t);
\t}
} );
`;
}

