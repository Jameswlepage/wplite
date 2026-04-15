// Generates inc/register-hero-image.php
//
// Makes `core/post-featured-image` work for posts that don't have a real
// WP attachment thumbnail but DO have a `hero_url` meta field. The editor
// previews + the front-end both render the meta URL via the standard
// post-thumbnail pipeline — giving us WYSIWYG in the block editor.

export function phpRegisterHeroImageFile() {
  return `<?php
defined( 'ABSPATH' ) || exit;

/**
 * If a post carries a hero_url meta value but no real featured image,
 * synthesize a post-thumbnail-style <img> so core/post-featured-image
 * (used in the editor + front-end) renders it natively.
 */
add_filter(
	'post_thumbnail_html',
	function ( $html, $post_id, $post_thumbnail_id, $size, $attr ) {
		if ( ! empty( $html ) ) {
			return $html;
		}

		$hero = (string) get_post_meta( $post_id, 'hero_url', true );
		if ( '' === $hero ) {
			return $html;
		}

		$title = get_the_title( $post_id );
		$class = isset( $attr['class'] ) ? (string) $attr['class'] : 'wp-post-image';
		return sprintf(
			'<img src="%s" alt="%s" class="%s" loading="lazy" decoding="async">',
			esc_url( $hero ),
			esc_attr( $title ),
			esc_attr( $class )
		);
	},
	10,
	5
);

/**
 * Report has_post_thumbnail() = true when a hero_url meta is present,
 * so blocks like core/post-featured-image don't render their empty
 * placeholder state.
 */
add_filter(
	'has_post_thumbnail',
	function ( $has_thumbnail, $post, $thumbnail_id ) {
		if ( $has_thumbnail ) {
			return $has_thumbnail;
		}
		$post_id = $post instanceof WP_Post ? $post->ID : (int) $post;
		if ( ! $post_id ) {
			return $has_thumbnail;
		}
		$hero = (string) get_post_meta( $post_id, 'hero_url', true );
		return '' !== $hero;
	},
	10,
	3
);

/**
 * Expose hero_url as the "featured_media" src in the REST post response,
 * via a virtual _embedded.wp:featuredmedia entry. Keeps the block
 * editor's query-loop preview happy without needing real attachments.
 */
add_action(
	'rest_api_init',
	function () {
		$post_types = array_values(
			array_filter(
				array_map(
					static function ( $model ) {
						return $model['postType'] ?? '';
					},
					portfolio_light_get_models()
				),
				'strlen'
			)
		);
		foreach ( $post_types as $pt ) {
			register_rest_field(
				$pt,
				'wplite_hero_url',
				[
					'get_callback'    => static function ( $data ) {
						return (string) get_post_meta( $data['id'], 'hero_url', true );
					},
					'schema'          => [ 'type' => 'string' ],
				]
			);
		}
	}
);
`;
}
