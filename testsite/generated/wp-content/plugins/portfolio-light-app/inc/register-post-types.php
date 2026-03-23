<?php
defined( 'ABSPATH' ) || exit;

add_action( 'init', function() {
	foreach ( portfolio_light_get_models() as $model ) {
		if ( 'collection' !== ( $model['type'] ?? '' ) ) {
			continue;
		}

		$labels = [
			'name'          => $model['label'],
			'singular_name' => $model['singularLabel'] ?? $model['label'],
		];

		$args = [
			'label'          => $model['label'],
			'labels'         => $labels,
			'public'         => (bool) ( $model['public'] ?? true ),
			'show_ui'        => (bool) ( $model['showUi'] ?? true ),
			'show_in_rest'   => true,
			'supports'       => $model['supports'] ?? [ 'title', 'editor', 'excerpt', 'thumbnail', 'revisions' ],
			'has_archive'    => $model['archiveSlug'] ?? false,
			'rewrite'        => ! empty( $model['archiveSlug'] ) ? [ 'slug' => $model['archiveSlug'] ] : true,
			'menu_position'  => 20,
		];

		if ( ! empty( $model['editorTemplate'] ) ) {
			$args['template'] = $model['editorTemplate'];
		}

		if ( ! empty( $model['templateLock'] ) ) {
			$args['template_lock'] = $model['templateLock'];
		}

		register_post_type( $model['postType'], $args );
	}
} );
