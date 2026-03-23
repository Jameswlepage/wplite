<?php
defined( 'ABSPATH' ) || exit;

function portfolio_get_singleton( $key ) {
	return get_option( "portfolio_singleton_{$key}", [] );
}

function portfolio_update_singleton( $key, $data ) {
	return update_option( "portfolio_singleton_{$key}", $data );
}
