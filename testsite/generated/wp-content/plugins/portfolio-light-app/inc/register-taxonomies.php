<?php
defined( 'ABSPATH' ) || exit;

add_action( 'init', function() {
	$taxonomies = [];

	foreach ( portfolio_light_get_models() as $model ) {
		foreach ( $model['taxonomies'] ?? [] as $taxonomy ) {
			$taxonomies[ $taxonomy ][] = $model['postType'];
		}
	}

	foreach ( $taxonomies as $taxonomy => $post_types ) {
		register_taxonomy(
			$taxonomy,
			array_values( array_unique( $post_types ) ),
			[
				'label'        => ucwords( str_replace( '_', ' ', $taxonomy ) ),
				'public'       => true,
				'show_ui'      => true,
				'show_in_rest' => true,
				'rewrite'      => [ 'slug' => $taxonomy ],
			]
		);
	}
} );
