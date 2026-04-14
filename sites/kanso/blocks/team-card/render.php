<?php
$post_id = $block->context['postId'] ?? get_the_ID();
if ( ! $post_id ) { return; }
$title    = get_the_title( $post_id );
$excerpt  = get_the_excerpt( $post_id );
$hero     = get_post_meta( $post_id, 'hero_url', true );
$role     = get_post_meta( $post_id, 'role', true );
$location = get_post_meta( $post_id, 'location', true );
$pronouns = get_post_meta( $post_id, 'pronouns', true );
if ( ! $hero ) {
	$thumb = get_the_post_thumbnail_url( $post_id, 'large' );
	if ( $thumb ) { $hero = $thumb; }
}
?>
<div class="k-person">
	<div class="k-person__frame">
		<?php if ( $hero ) : ?>
			<img src="<?php echo esc_url( $hero ); ?>" alt="<?php echo esc_attr( $title ); ?>" loading="lazy">
		<?php endif; ?>
	</div>
	<p class="k-person__role"><?php echo esc_html( $role ?: '' ); ?><?php if ( $location ) : ?> · <?php echo esc_html( $location ); ?><?php endif; ?></p>
	<h3 class="k-person__name"><?php echo esc_html( $title ); ?><?php if ( $pronouns ) : ?><span style="font-size:0.7em;color:var(--k-stone);font-weight:400;font-style:italic;"> (<?php echo esc_html( $pronouns ); ?>)</span><?php endif; ?></h3>
	<?php if ( $excerpt ) : ?><p class="k-person__bio"><?php echo esc_html( $excerpt ); ?></p><?php endif; ?>
</div>
