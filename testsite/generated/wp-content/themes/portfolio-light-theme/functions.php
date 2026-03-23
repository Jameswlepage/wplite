<?php
add_action( 'init', function() {
	register_block_pattern_category( 'portfolio-light-theme', [
		'label' => __( 'Portfolio Light Theme', 'portfolio-light-theme' ),
	] );
} );
