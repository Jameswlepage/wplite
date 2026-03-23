<?php
defined( 'ABSPATH' ) || exit;

function portfolio_light_get_compiled_site() {
	static $compiled = null;

	if ( null !== $compiled ) {
		return $compiled;
	}

	$path = dirname( __DIR__ ) . '/compiled/site-schema.json';
	if ( ! file_exists( $path ) ) {
		$compiled = [];
		return $compiled;
	}

	$contents = file_get_contents( $path );
	$compiled = json_decode( $contents, true ) ?: [];

	return $compiled;
}

function portfolio_light_get_site_config() {
	$compiled = portfolio_light_get_compiled_site();
	return $compiled['site'] ?? [];
}

function portfolio_light_get_builtin_post_model() {
	return [
		'id'            => 'post',
		'label'         => 'Posts',
		'singularLabel' => 'Post',
		'type'          => 'collection',
		'postType'      => 'post',
		'public'        => true,
		'supports'      => [ 'title', 'editor', 'excerpt', 'thumbnail', 'revisions' ],
		'taxonomies'    => [ 'category', 'post_tag' ],
		'adminPath'     => 'posts',
		'fields'        => [],
	];
}

function portfolio_light_get_models() {
	$compiled = portfolio_light_get_compiled_site();
	return $compiled['models'] ?? [];
}

function portfolio_light_get_model( $id ) {
	if ( 'post' === $id ) {
		return portfolio_light_get_builtin_post_model();
	}

	foreach ( portfolio_light_get_models() as $model ) {
		if ( ( $model['id'] ?? '' ) === $id ) {
			return $model;
		}
	}

	return null;
}

function portfolio_light_get_admin_models() {
	$models = portfolio_light_get_models();
	$models[] = portfolio_light_get_builtin_post_model();
	return $models;
}

function portfolio_light_get_singletons() {
	$compiled = portfolio_light_get_compiled_site();
	return $compiled['singletons'] ?? [];
}

function portfolio_light_get_singleton_schema( $id ) {
	foreach ( portfolio_light_get_singletons() as $singleton ) {
		if ( ( $singleton['id'] ?? '' ) === $id ) {
			return $singleton;
		}
	}

	return null;
}

function portfolio_light_get_routes() {
	$compiled = portfolio_light_get_compiled_site();
	return $compiled['routes'] ?? [];
}

function portfolio_light_get_menus() {
	$compiled = portfolio_light_get_compiled_site();
	return $compiled['menus'] ?? [];
}

function portfolio_light_get_content_collections() {
	$compiled = portfolio_light_get_compiled_site();
	return $compiled['content']['collections'] ?? [];
}

function portfolio_light_get_content_singletons() {
	$compiled = portfolio_light_get_compiled_site();
	return $compiled['content']['singletons'] ?? [];
}

function portfolio_light_get_admin_schema( $name, $suffix ) {
	$path = dirname( __DIR__ ) . '/compiled/admin-schema/' . $name . '.' . $suffix . '.json';
	if ( ! file_exists( $path ) ) {
		return null;
	}

	return json_decode( file_get_contents( $path ), true );
}

function portfolio_light_get_admin_navigation() {
	$navigation = [
		[
			'id'    => 'dashboard',
			'label' => 'Dashboard',
			'path'  => '/',
			'kind'  => 'dashboard',
		],
	];

	foreach ( portfolio_light_get_admin_models() as $model ) {
		$navigation[] = [
			'id'       => $model['id'],
			'label'    => $model['label'],
			'path'     => '/' . ( $model['adminPath'] ?? $model['id'] ),
			'kind'     => 'collection',
			'resource' => $model['id'],
		];
	}

	foreach ( portfolio_light_get_singletons() as $singleton ) {
		$navigation[] = [
			'id'       => $singleton['id'],
			'label'    => $singleton['label'],
			'path'     => '/settings/' . $singleton['id'],
			'kind'     => 'singleton',
			'resource' => $singleton['id'],
		];
	}

	return $navigation;
}

function portfolio_light_get_block_dirs() {
	$plugin_root = dirname( __DIR__ );
	$entries     = glob( $plugin_root . '/blocks/*', GLOB_ONLYDIR ) ?: [];
	return array_values( $entries );
}

function portfolio_light_field_meta_type( $field ) {
	$type = $field['type'] ?? 'text';

	switch ( $type ) {
		case 'integer':
		case 'relation':
			return 'integer';
		case 'boolean':
			return 'boolean';
		case 'repeater':
			return 'array';
		default:
			return 'string';
	}
}

function portfolio_light_cast_field_value( $field, $value ) {
	$type = $field['type'] ?? 'text';

	if ( null === $value ) {
		return null;
	}

	switch ( $type ) {
		case 'integer':
		case 'image':
			return '' === $value ? '' : (int) $value;
		case 'relation':
			return portfolio_light_resolve_relation_value( $field, $value );
		case 'boolean':
			return ! empty( $value );
		case 'repeater':
			if ( is_array( $value ) ) {
				return array_map(
					function( $item ) {
						return [
							'label' => sanitize_text_field( $item['label'] ?? '' ),
							'value' => sanitize_text_field( $item['value'] ?? '' ),
						];
					},
					$value
				);
			}
			return [];
		case 'richtext':
			return wp_kses_post( $value );
		case 'email':
			return sanitize_email( $value );
		case 'url':
			return esc_url_raw( $value );
		case 'select':
			return sanitize_text_field( $value );
		default:
			return sanitize_text_field( is_string( $value ) ? $value : wp_json_encode( $value ) );
	}
}

function portfolio_light_prepare_record( $post, $model ) {
	$record = [
		'id'         => (int) $post->ID,
		'title'      => $post->post_title,
		'slug'       => $post->post_name,
		'postStatus' => $post->post_status,
		'content'    => $post->post_content,
		'excerpt'    => $post->post_excerpt,
		'date'       => get_post_time( DATE_ATOM, true, $post ),
		'modified'   => get_post_modified_time( DATE_ATOM, true, $post ),
		'link'       => get_permalink( $post ),
	];

	foreach ( $model['fields'] ?? [] as $field_id => $field ) {
		$value = get_post_meta( $post->ID, $field_id, true );
		if ( 'boolean' === ( $field['type'] ?? '' ) ) {
			$value = ! empty( $value );
		}
		$record[ $field_id ] = $value;
	}

	foreach ( $model['taxonomies'] ?? [] as $taxonomy ) {
		$terms = wp_get_post_terms( $post->ID, $taxonomy, [ 'fields' => 'names' ] );
		$record[ $taxonomy ] = is_wp_error( $terms ) ? [] : array_values( $terms );
	}

	return $record;
}

function portfolio_light_resolve_relation_value( $field, $value ) {
	$target_id = $field['target'] ?? '';
	if ( ! $target_id ) {
		return is_numeric( $value ) ? (int) $value : 0;
	}

	if ( is_numeric( $value ) ) {
		return (int) $value;
	}

	$target_model = portfolio_light_get_model( $target_id );
	if ( ! $target_model ) {
		return 0;
	}

	if ( is_string( $value ) && false !== strpos( $value, '.' ) ) {
		$results = get_posts(
			[
				'post_type'      => $target_model['postType'],
				'posts_per_page' => 1,
				'post_status'    => 'any',
				'meta_query'     => [
					[
						'key'   => '_portfolio_source_id',
						'value' => $value,
					],
				],
			]
		);
		if ( ! empty( $results ) ) {
			return (int) $results[0]->ID;
		}
	}

	$existing = get_page_by_path( sanitize_title( $value ), OBJECT, $target_model['postType'] );
	return $existing ? (int) $existing->ID : 0;
}

function portfolio_light_upsert_record( $model, $payload, $existing_id = 0 ) {
	$postarr = [
		'post_type'    => $model['postType'],
		'post_status'  => sanitize_key( $payload['postStatus'] ?? 'publish' ),
		'post_title'   => sanitize_text_field( $payload['title'] ?? '' ),
		'post_excerpt' => sanitize_textarea_field( $payload['excerpt'] ?? '' ),
		'post_content' => wp_kses_post( $payload['content'] ?? '' ),
	];

	if ( ! empty( $payload['slug'] ) ) {
		$postarr['post_name'] = sanitize_title( $payload['slug'] );
	}

	if ( $existing_id ) {
		$postarr['ID'] = (int) $existing_id;
		$post_id       = wp_update_post( wp_slash( $postarr ), true );
	} else {
		$post_id = wp_insert_post( wp_slash( $postarr ), true );
	}

	if ( is_wp_error( $post_id ) ) {
		return $post_id;
	}

	foreach ( $model['fields'] ?? [] as $field_id => $field ) {
		if ( ! array_key_exists( $field_id, $payload ) ) {
			continue;
		}
		update_post_meta( $post_id, $field_id, portfolio_light_cast_field_value( $field, $payload[ $field_id ] ) );
	}

	foreach ( $model['taxonomies'] ?? [] as $taxonomy ) {
		if ( ! array_key_exists( $taxonomy, $payload ) ) {
			continue;
		}

		$terms = array_values(
			array_filter(
				array_map(
					'sanitize_text_field',
					(array) $payload[ $taxonomy ]
				)
			)
		);
		wp_set_object_terms( $post_id, $terms, $taxonomy, false );
	}

	return get_post( $post_id );
}

function portfolio_light_profile_completeness() {
	$schema = portfolio_light_get_singleton_schema( 'profile' );
	$data   = get_option( 'portfolio_singleton_profile', [] );
	$fields = array_keys( $schema['fields'] ?? [] );
	if ( empty( $fields ) ) {
		return 0;
	}

	$completed = 0;
	foreach ( $fields as $field ) {
		if ( ! empty( $data[ $field ] ) || false === empty( $data[ $field ] ) ) {
			$completed++;
		}
	}

	return (int) round( ( $completed / count( $fields ) ) * 100 );
}

function portfolio_light_get_dashboard_data() {
	$projects_model = portfolio_light_get_model( 'project' );
	$inquiry_model  = portfolio_light_get_model( 'inquiry' );
	$featured_count = 0;
	$recent         = [];

	if ( $projects_model ) {
		$featured_query = new WP_Query(
			[
				'post_type'      => $projects_model['postType'],
				'post_status'    => 'any',
				'posts_per_page' => 1,
				'fields'         => 'ids',
				'meta_query'     => [
					[
						'key'   => 'featured',
						'value' => '1',
					],
				],
			]
		);
		$featured_count = (int) $featured_query->found_posts;
	}

	if ( $inquiry_model ) {
		$inquiries = get_posts(
			[
				'post_type'      => $inquiry_model['postType'],
				'post_status'    => 'any',
				'posts_per_page' => 5,
				'orderby'        => 'modified',
				'order'          => 'DESC',
			]
		);

		$recent = array_map(
			function( $post ) use ( $inquiry_model ) {
				$record = portfolio_light_prepare_record( $post, $inquiry_model );
				return [
					'id'       => $record['id'],
					'title'    => $record['title'],
					'email'    => $record['email'] ?? '',
					'company'  => $record['company'] ?? '',
					'status'   => $record['status'] ?? '',
					'modified' => $record['modified'],
				];
			},
			$inquiries
		);
	}

	return [
		'featuredProjects'   => $featured_count,
		'profileCompleteness'=> portfolio_light_profile_completeness(),
		'recentInquiries'    => $recent,
	];
}

function portfolio_light_export_pull_data() {
	$payload = [
		'collections' => [],
		'singletons'  => [],
	];

	foreach ( portfolio_light_get_models() as $model ) {
		if ( 'collection' !== ( $model['type'] ?? '' ) ) {
			continue;
		}

		$posts = get_posts(
			[
				'post_type'      => $model['postType'],
				'post_status'    => 'any',
				'posts_per_page' => -1,
				'orderby'        => 'modified',
				'order'          => 'DESC',
			]
		);

		$payload['collections'][ $model['id'] ] = array_map(
			function( $post ) use ( $model ) {
				$fields = [];
				$terms  = [];

				foreach ( $model['fields'] ?? [] as $field_id => $field ) {
					$fields[ $field_id ] = get_post_meta( $post->ID, $field_id, true );
					if ( 'relation' === ( $field['type'] ?? '' ) && ! empty( $fields[ $field_id ] ) ) {
						$related_post = get_post( (int) $fields[ $field_id ] );
						if ( $related_post ) {
							$related_source = get_post_meta( $related_post->ID, '_portfolio_source_id', true );
							$fields[ $field_id ] = $related_source ?: $related_post->post_name;
						}
					}
					if ( 'boolean' === ( $field['type'] ?? '' ) ) {
						$fields[ $field_id ] = ! empty( $fields[ $field_id ] );
					}
				}

				foreach ( $model['taxonomies'] ?? [] as $taxonomy ) {
					$taxonomy_terms   = wp_get_post_terms( $post->ID, $taxonomy, [ 'fields' => 'names' ] );
					$terms[ $taxonomy ] = is_wp_error( $taxonomy_terms ) ? [] : array_values( $taxonomy_terms );
				}

				return [
					'id'       => (int) $post->ID,
					'model'    => $model['id'],
					'sourceId' => get_post_meta( $post->ID, '_portfolio_source_id', true ),
					'slug'     => $post->post_name,
					'title'    => $post->post_title,
					'excerpt'  => $post->post_excerpt,
					'status'   => $post->post_status,
					'fields'   => $fields,
					'terms'    => $terms,
					'body'     => $post->post_content,
				];
			},
			$posts
		);
	}

	$posts = get_posts(
		[
			'post_type'      => 'post',
			'post_status'    => 'any',
			'posts_per_page' => -1,
			'orderby'        => 'modified',
			'order'          => 'DESC',
		]
	);

	$payload['collections']['post'] = array_map(
		function( $post ) {
			$terms = [];
			foreach ( [ 'category', 'post_tag' ] as $taxonomy ) {
				$taxonomy_terms   = wp_get_post_terms( $post->ID, $taxonomy, [ 'fields' => 'names' ] );
				$terms[ $taxonomy ] = is_wp_error( $taxonomy_terms ) ? [] : array_values( $taxonomy_terms );
			}

			return [
				'id'       => (int) $post->ID,
				'model'    => 'post',
				'sourceId' => get_post_meta( $post->ID, '_portfolio_source_id', true ),
				'slug'     => $post->post_name,
				'title'    => $post->post_title,
				'excerpt'  => $post->post_excerpt,
				'status'   => $post->post_status,
				'fields'   => [],
				'terms'    => $terms,
				'body'     => $post->post_content,
			];
		},
		$posts
	);

	foreach ( portfolio_light_get_singletons() as $singleton ) {
		$payload['singletons'][ $singleton['id'] ] = get_option(
			'portfolio_singleton_' . $singleton['id'],
			[]
		);
	}

	return $payload;
}

function portfolio_light_is_app_request() {
	$request_path = wp_parse_url( home_url( add_query_arg( [] ) ), PHP_URL_PATH );
	$uri_path     = wp_parse_url( $_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH );
	$app_base     = wp_parse_url( home_url( '/app' ), PHP_URL_PATH );

	return ! empty( $uri_path ) && 0 === strpos( trailingslashit( $uri_path ), trailingslashit( $app_base ) );
}
