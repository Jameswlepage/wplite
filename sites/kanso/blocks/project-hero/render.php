<?php
$post_id = $block->context['postId'] ?? get_the_ID();
if ( ! $post_id ) { return; }
$title = get_the_title( $post_id );
$hero  = get_post_meta( $post_id, 'hero_url', true );
if ( ! $hero ) {
	$thumb = get_the_post_thumbnail_url( $post_id, 'full' );
	if ( $thumb ) { $hero = $thumb; }
}
if ( ! $hero ) { return; }
?>
<figure class="k-project-hero">
	<img src="<?php echo esc_url( $hero ); ?>" alt="<?php echo esc_attr( $title ); ?>" loading="eager">
</figure>
