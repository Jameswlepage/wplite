<?php
defined( 'ABSPATH' ) || exit;

function portfolio_light_rest_can_edit() {
	return current_user_can( 'edit_posts' );
}

add_action( 'rest_api_init', function() {
	register_rest_route(
		'portfolio/v1',
		'/bootstrap',
		[
			'methods'             => 'GET',
			'permission_callback' => 'portfolio_light_rest_can_edit',
			'callback'            => function() {
				$models      = portfolio_light_get_admin_models();
				$singletons  = portfolio_light_get_singletons();
				$records     = [];
				$singleton_data = [];
				$admin_schema = [ 'views' => [], 'forms' => [] ];

				foreach ( $models as $model ) {
					$admin_schema['views'][ $model['id'] ] = portfolio_light_get_admin_schema( $model['id'], 'view' );
					$admin_schema['forms'][ $model['id'] ] = portfolio_light_get_admin_schema( $model['id'], 'form' );
					$posts = get_posts(
						[
							'post_type'      => $model['postType'],
							'post_status'    => 'any',
							'posts_per_page' => -1,
							'orderby'        => 'modified',
							'order'          => 'DESC',
						]
					);
					$records[ $model['id'] ] = array_map(
						function( $post ) use ( $model ) {
							return portfolio_light_prepare_record( $post, $model );
						},
						$posts
					);
				}

				foreach ( $singletons as $singleton ) {
					$admin_schema['forms'][ $singleton['id'] ] = portfolio_light_get_admin_schema( $singleton['id'], 'form' );
					$singleton_data[ $singleton['id'] ] = get_option( 'portfolio_singleton_' . $singleton['id'], [] );
				}

				return new WP_REST_Response(
					[
						'site'          => portfolio_light_get_site_config(),
						'models'        => $models,
						'singletons'    => $singletons,
						'routes'        => portfolio_light_get_routes(),
						'menus'         => portfolio_light_get_menus(),
						'adminSchema'   => $admin_schema,
						'navigation'    => portfolio_light_get_admin_navigation(),
						'dashboard'     => portfolio_light_get_dashboard_data(),
						'records'       => $records,
						'singletonData' => $singleton_data,
					],
					200
				);
			},
		]
	);

	register_rest_route(
		'portfolio/v1',
		'/seed',
		[
			'methods'             => 'POST',
			'permission_callback' => 'portfolio_light_rest_can_edit',
			'callback'            => function() {
				portfolio_light_seed_site();
				return new WP_REST_Response( [ 'ok' => true ], 200 );
			},
		]
	);

	register_rest_route(
		'portfolio/v1',
		'/collection/(?P<model>[a-z0-9_-]+)',
		[
			[
				'methods'             => 'GET',
				'permission_callback' => 'portfolio_light_rest_can_edit',
				'callback'            => function( WP_REST_Request $request ) {
					$model = portfolio_light_get_model( $request['model'] );
					if ( ! $model ) {
						return new WP_REST_Response( [ 'message' => 'Unknown model.' ], 404 );
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

					$records = array_map(
						function( $post ) use ( $model ) {
							return portfolio_light_prepare_record( $post, $model );
						},
						$posts
					);

					return new WP_REST_Response( [ 'items' => $records ], 200 );
				},
			],
			[
				'methods'             => 'POST',
				'permission_callback' => 'portfolio_light_rest_can_edit',
				'callback'            => function( WP_REST_Request $request ) {
					$model = portfolio_light_get_model( $request['model'] );
					if ( ! $model ) {
						return new WP_REST_Response( [ 'message' => 'Unknown model.' ], 404 );
					}

					$created = portfolio_light_upsert_record( $model, $request->get_json_params() ?: [] );
					if ( is_wp_error( $created ) ) {
						return new WP_REST_Response( [ 'message' => $created->get_error_message() ], 500 );
					}

					return new WP_REST_Response(
						[
							'item' => portfolio_light_prepare_record( $created, $model ),
						],
						200
					);
				},
			],
		]
	);

	register_rest_route(
		'portfolio/v1',
		'/collection/(?P<model>[a-z0-9_-]+)/(?P<id>\d+)',
		[
			[
				'methods'             => 'GET',
				'permission_callback' => 'portfolio_light_rest_can_edit',
				'callback'            => function( WP_REST_Request $request ) {
					$model = portfolio_light_get_model( $request['model'] );
					$post  = get_post( (int) $request['id'] );

					if ( ! $model || ! $post || $post->post_type !== $model['postType'] ) {
						return new WP_REST_Response( [ 'message' => 'Not found.' ], 404 );
					}

					return new WP_REST_Response(
						[
							'item' => portfolio_light_prepare_record( $post, $model ),
						],
						200
					);
				},
			],
			[
				'methods'             => 'POST',
				'permission_callback' => 'portfolio_light_rest_can_edit',
				'callback'            => function( WP_REST_Request $request ) {
					$model = portfolio_light_get_model( $request['model'] );
					if ( ! $model ) {
						return new WP_REST_Response( [ 'message' => 'Unknown model.' ], 404 );
					}

					$updated = portfolio_light_upsert_record(
						$model,
						$request->get_json_params() ?: [],
						(int) $request['id']
					);

					if ( is_wp_error( $updated ) ) {
						return new WP_REST_Response( [ 'message' => $updated->get_error_message() ], 500 );
					}

					return new WP_REST_Response(
						[
							'item' => portfolio_light_prepare_record( $updated, $model ),
						],
						200
					);
				},
			],
			[
				'methods'             => 'DELETE',
				'permission_callback' => 'portfolio_light_rest_can_edit',
				'callback'            => function( WP_REST_Request $request ) {
					$model = portfolio_light_get_model( $request['model'] );
					$post  = get_post( (int) $request['id'] );
					if ( ! $model || ! $post || $post->post_type !== $model['postType'] ) {
						return new WP_REST_Response( [ 'message' => 'Not found.' ], 404 );
					}

					wp_delete_post( $post->ID, true );
					return new WP_REST_Response( [ 'ok' => true ], 200 );
				},
			],
		]
	);

	register_rest_route(
		'portfolio/v1',
		'/singleton/(?P<singleton>[a-z0-9_-]+)',
		[
			[
				'methods'             => 'GET',
				'permission_callback' => 'portfolio_light_rest_can_edit',
				'callback'            => function( WP_REST_Request $request ) {
					$schema = portfolio_light_get_singleton_schema( $request['singleton'] );
					if ( ! $schema ) {
						return new WP_REST_Response( [ 'message' => 'Unknown singleton.' ], 404 );
					}

					return new WP_REST_Response(
						[
							'item' => get_option( 'portfolio_singleton_' . $schema['id'], [] ),
						],
						200
					);
				},
			],
			[
				'methods'             => 'POST',
				'permission_callback' => 'portfolio_light_rest_can_edit',
				'callback'            => function( WP_REST_Request $request ) {
					$schema = portfolio_light_get_singleton_schema( $request['singleton'] );
					if ( ! $schema ) {
						return new WP_REST_Response( [ 'message' => 'Unknown singleton.' ], 404 );
					}

					$payload = $request->get_json_params() ?: [];
					$data    = [];
					foreach ( $schema['fields'] ?? [] as $field_id => $field ) {
						if ( array_key_exists( $field_id, $payload ) ) {
							$data[ $field_id ] = portfolio_light_cast_field_value( $field, $payload[ $field_id ] );
						}
					}

					update_option( 'portfolio_singleton_' . $schema['id'], $data );

					return new WP_REST_Response( [ 'item' => $data ], 200 );
				},
			],
		]
	);

	register_rest_route(
		'portfolio/v1',
		'/inquiry',
		[
			'methods'             => 'POST',
			'permission_callback' => '__return_true',
			'callback'            => function( WP_REST_Request $request ) {
				$model = portfolio_light_get_model( 'inquiry' );
				if ( ! $model ) {
					return new WP_REST_Response( [ 'ok' => false ], 500 );
				}

				$params = $request->get_json_params();
				$payload = [
					'title'      => sanitize_text_field( $params['name'] ?? 'Inquiry' ),
					'postStatus' => 'publish',
					'content'    => sanitize_textarea_field( $params['message'] ?? '' ),
					'email'      => sanitize_email( $params['email'] ?? '' ),
					'company'    => sanitize_text_field( $params['company'] ?? '' ),
					'source'     => 'contact_form',
					'status'     => 'new',
				];

				$created = portfolio_light_upsert_record( $model, $payload );
				if ( is_wp_error( $created ) ) {
					return new WP_REST_Response( [ 'ok' => false ], 500 );
				}

				return new WP_REST_Response( [ 'ok' => true ], 200 );
			},
		]
	);
} );
