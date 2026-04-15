// Generates the `register-user-avatar.php` file included by the compiled plugin.
// Lets a user upload their own profile picture; overrides Gravatar when set.
export function phpRegisterUserAvatarFile() {
  return `<?php
defined( 'ABSPATH' ) || exit;

/** Register custom-avatar user meta so it round-trips through wp/v2/users. */
add_action( 'init', function() {
	register_meta( 'user', 'wplite_avatar_id', [
		'type'         => 'integer',
		'single'       => true,
		'show_in_rest' => true,
		'default'      => 0,
		'auth_callback' => function() {
			return current_user_can( 'edit_user', get_current_user_id() );
		},
	] );

	register_meta( 'user', 'wplite_avatar_url', [
		'type'         => 'string',
		'single'       => true,
		'show_in_rest' => true,
		'default'      => '',
		'auth_callback' => function() {
			return current_user_can( 'edit_user', get_current_user_id() );
		},
	] );
} );

/** Replace get_avatar_url output with the custom upload when one is set. */
add_filter( 'pre_get_avatar_data', function( $args, $id_or_email ) {
	$user_id = 0;
	if ( is_numeric( $id_or_email ) ) {
		$user_id = (int) $id_or_email;
	} elseif ( is_object( $id_or_email ) && ! empty( $id_or_email->user_id ) ) {
		$user_id = (int) $id_or_email->user_id;
	} elseif ( $id_or_email instanceof WP_User ) {
		$user_id = (int) $id_or_email->ID;
	} elseif ( is_string( $id_or_email ) && is_email( $id_or_email ) ) {
		$user = get_user_by( 'email', $id_or_email );
		if ( $user ) {
			$user_id = (int) $user->ID;
		}
	}

	if ( ! $user_id ) {
		return $args;
	}

	$avatar_id = (int) get_user_meta( $user_id, 'wplite_avatar_id', true );
	if ( ! $avatar_id ) {
		return $args;
	}

	$size = isset( $args['size'] ) ? (int) $args['size'] : 96;
	$image_size = $size <= 64 ? 'thumbnail' : ( $size <= 300 ? 'medium' : 'large' );
	$url = wp_get_attachment_image_url( $avatar_id, $image_size );
	if ( ! $url ) {
		$url = wp_get_attachment_url( $avatar_id );
	}

	if ( $url ) {
		$args['url'] = $url;
		$args['found_avatar'] = true;
	}

	return $args;
}, 10, 2 );
`;
}
