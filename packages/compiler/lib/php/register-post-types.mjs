// Generates the `register-post-types.php` file included by the compiled plugin.
export function phpRegisterPostTypesFile() {
  return `<?php
defined( 'ABSPATH' ) || exit;

add_action( 'init', function() {
\tforeach ( portfolio_light_get_models() as $model ) {
\t\tif ( 'collection' !== ( $model['type'] ?? '' ) ) {
\t\t\tcontinue;
\t\t}

\t\t$labels = [
\t\t\t'name'          => $model['label'],
\t\t\t'singular_name' => $model['singularLabel'] ?? $model['label'],
\t\t];

\t\t$args = [
\t\t\t'label'          => $model['label'],
\t\t\t'labels'         => $labels,
\t\t\t'public'         => (bool) ( $model['public'] ?? true ),
\t\t\t'show_ui'        => (bool) ( $model['showUi'] ?? true ),
\t\t\t'show_in_rest'   => true,
\t\t\t'supports'       => $model['supports'] ?? [ 'title', 'editor', 'excerpt', 'thumbnail', 'revisions' ],
\t\t\t'has_archive'    => $model['archiveSlug'] ?? false,
\t\t\t'rewrite'        => ! empty( $model['archiveSlug'] ) ? [ 'slug' => $model['archiveSlug'] ] : true,
\t\t\t'menu_position'  => 20,
\t\t];

\t\tif ( ! empty( $model['editorTemplate'] ) ) {
\t\t\t$args['template'] = $model['editorTemplate'];
\t\t}

\t\tif ( ! empty( $model['templateLock'] ) ) {
\t\t\t$args['template_lock'] = $model['templateLock'];
\t\t}

\t\tregister_post_type( $model['postType'], $args );
\t}
} );
`;
}

