<?php
defined( 'ABSPATH' ) || exit;

function portfolio_light_seed_page_from_route( $route ) {
	if ( 'page' !== ( $route['type'] ?? '' ) || empty( $route['seed']['createPageShell'] ) ) {
		return 0;
	}

	$slug     = (string) ( $route['slug'] ?? '' );
	$existing = $slug ? get_page_by_path( $slug, OBJECT, 'page' ) : null;
	$payload  = [
		'post_type'    => 'page',
		'post_status'  => $route['seed']['status'] ?? 'publish',
		'post_title'   => $route['title'] ?? ucfirst( $route['id'] ?? 'Page' ),
		'post_name'    => $slug,
		'post_content' => '',
	];

	if ( $existing ) {
		$payload['ID'] = $existing->ID;
		$page_id       = wp_update_post( wp_slash( $payload ), true );
	} else {
		$page_id = wp_insert_post( wp_slash( $payload ), true );
	}

	if ( is_wp_error( $page_id ) ) {
		return 0;
	}

	if ( ! empty( $route['template'] ) && ! in_array( $route['template'], [ 'front-page', 'page' ], true ) ) {
		update_post_meta( $page_id, '_wp_page_template', $route['template'] );
	}

	return (int) $page_id;
}

function portfolio_light_seed_singletons() {
	$site = portfolio_light_get_site_config();
	if (
		empty( $site['content']['push'] ) ||
		'database' === ( $site['content']['mode'] ?? 'files' ) ||
		! empty( $site['content']['databaseFirst'] )
	) {
		return;
	}

	foreach ( portfolio_light_get_content_singletons() as $singleton_id => $entry ) {
		update_option( 'portfolio_singleton_' . $singleton_id, $entry['data'] ?? [] );
	}
}

function portfolio_light_cleanup_default_content() {
	$hello_world = get_page_by_path( 'hello-world', OBJECT, 'post' );
	if ( $hello_world && 'Hello world!' === $hello_world->post_title ) {
		wp_delete_post( $hello_world->ID, true );
	}

	$sample_page = get_page_by_path( 'sample-page', OBJECT, 'page' );
	if ( $sample_page && 'Sample Page' === $sample_page->post_title ) {
		wp_delete_post( $sample_page->ID, true );
	}
}

function portfolio_light_seed_collection_items() {
	$site        = portfolio_light_get_site_config();
	if (
		empty( $site['content']['push'] ) ||
		'database' === ( $site['content']['mode'] ?? 'files' ) ||
		! empty( $site['content']['databaseFirst'] )
	) {
		return;
	}

	$collections = portfolio_light_get_content_collections();
	foreach ( $collections as $directory => $items ) {
		foreach ( $items as $entry ) {
			if ( 'post' === ( $entry['model'] ?? '' ) ) {
				$existing = get_page_by_path( $entry['slug'], OBJECT, 'post' );
				$payload  = [
					'post_type'    => 'post',
					'post_status'  => $entry['status'] ?? 'publish',
					'post_title'   => $entry['title'],
					'post_name'    => $entry['slug'],
					'post_excerpt' => $entry['excerpt'] ?? '',
					'post_content' => $entry['body'] ?? '',
				];

				if ( $existing ) {
					$payload['ID'] = $existing->ID;
					$post_id       = wp_update_post( wp_slash( $payload ), true );
				} else {
					$post_id = wp_insert_post( wp_slash( $payload ), true );
				}

				if ( ! is_wp_error( $post_id ) ) {
					update_post_meta( $post_id, '_portfolio_source_id', $entry['sourceId'] ?? '' );
				}
				continue;
			}

			$model = portfolio_light_get_model( $entry['model'] ?? '' );
			if ( ! $model ) {
				continue;
			}

			$existing = null;
			if ( ! empty( $entry['sourceId'] ) ) {
				$results = get_posts(
					[
						'post_type'      => $model['postType'],
						'post_status'    => 'any',
						'posts_per_page' => 1,
						'meta_query'     => [
							[
								'key'   => '_portfolio_source_id',
								'value' => $entry['sourceId'],
							],
						],
					]
				);
				$existing = ! empty( $results ) ? $results[0] : null;
			}

			if ( ! $existing && ! empty( $entry['slug'] ) ) {
				$existing = get_page_by_path( $entry['slug'], OBJECT, $model['postType'] );
			}

			if ( ! empty( $site['content']['collections'][ $entry['model'] ] ) && empty( $site['content']['collections'][ $entry['model'] ]['sync'] ) ) {
				continue;
			}

			$payload = [
				'title'      => $entry['title'] ?? '',
				'slug'       => $entry['slug'] ?? '',
				'excerpt'    => $entry['excerpt'] ?? '',
				'postStatus' => $entry['status'] ?? 'publish',
				'content'    => $entry['body'] ?? '',
			];

			foreach ( $entry['fields'] ?? [] as $field_id => $value ) {
				$payload[ $field_id ] = $value;
			}

			foreach ( $entry['terms'] ?? [] as $taxonomy => $terms ) {
				$payload[ $taxonomy ] = $terms;
			}

			$saved = portfolio_light_upsert_record( $model, $payload, $existing ? $existing->ID : 0 );
			if ( ! is_wp_error( $saved ) && ! empty( $entry['sourceId'] ) ) {
				update_post_meta( $saved->ID, '_portfolio_source_id', $entry['sourceId'] );
			}
		}
	}
}

function portfolio_light_seed_site() {
	$page_ids = [];
	foreach ( portfolio_light_get_routes() as $route ) {
		$page_ids[ $route['id'] ] = portfolio_light_seed_page_from_route( $route );
	}

	portfolio_light_seed_singletons();
	portfolio_light_cleanup_default_content();
	portfolio_light_seed_collection_items();

	$site = portfolio_light_get_site_config();
	$front_page = $page_ids[ $site['frontPage'] ?? '' ] ?? 0;
	$posts_page = $page_ids[ $site['postsPage'] ?? '' ] ?? 0;

	if ( ! empty( $site['title'] ) ) {
		update_option( 'blogname', $site['title'] );
	}

	if ( ! empty( $site['tagline'] ) ) {
		update_option( 'blogdescription', $site['tagline'] );
	}

	if ( $front_page ) {
		update_option( 'show_on_front', 'page' );
		update_option( 'page_on_front', $front_page );
	}

	if ( $posts_page ) {
		update_option( 'page_for_posts', $posts_page );
	}

	flush_rewrite_rules();
}
