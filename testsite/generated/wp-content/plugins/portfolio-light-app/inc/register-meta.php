<?php
defined( 'ABSPATH' ) || exit;

add_action( 'init', function() {
	foreach ( portfolio_light_get_models() as $model ) {
		foreach ( $model['fields'] ?? [] as $field_id => $field ) {
			if ( 'repeater' === ( $field['type'] ?? '' ) ) {
				continue;
			}

			$args = [
				'object_subtype' => $model['postType'],
				'type'           => portfolio_light_field_meta_type( $field ),
				'single'         => true,
				'show_in_rest'   => true,
			];

			register_meta( 'post', $field_id, $args );
		}
	}
} );
