<?php
$post_id = $block->context['postId'] ?? get_the_ID();
if ( ! $post_id ) { return; }

$title    = get_the_title( $post_id );
$excerpt  = get_the_excerpt( $post_id );
$link     = get_permalink( $post_id );
$hero     = get_post_meta( $post_id, 'hero_url', true );
$location = get_post_meta( $post_id, 'location', true );
$year     = get_post_meta( $post_id, 'year', true );
$service  = get_post_meta( $post_id, 'service_type', true );

$service_label = [
	'residential' => 'Residential',
	'workspace'   => 'Workspace',
	'sourcing'    => 'Sourcing',
];
$service_display = $service_label[ $service ] ?? ucfirst( (string) $service );

if ( ! $hero ) {
	$thumb = get_the_post_thumbnail_url( $post_id, 'large' );
	if ( $thumb ) { $hero = $thumb; }
}
?>
<div class="k-project">
	<a class="k-project__frame" href="<?php echo esc_url( $link ); ?>" aria-label="<?php echo esc_attr( $title ); ?>">
		<?php if ( $hero ) : ?>
			<img src="<?php echo esc_url( $hero ); ?>" alt="<?php echo esc_attr( $title ); ?>" loading="lazy">
		<?php endif; ?>
	</a>
	<div class="k-project__meta">
		<?php if ( $year ) : ?><span>— <?php echo esc_html( $year ); ?></span><?php endif; ?>
		<?php if ( $service_display ) : ?><span><?php echo esc_html( $service_display ); ?></span><?php endif; ?>
		<?php if ( $location ) : ?><span><?php echo esc_html( $location ); ?></span><?php endif; ?>
	</div>
	<h3 class="k-project__title"><a href="<?php echo esc_url( $link ); ?>"><?php echo esc_html( $title ); ?></a></h3>
	<?php if ( $excerpt ) : ?>
		<p class="k-project__excerpt"><?php echo esc_html( wp_trim_words( $excerpt, 20 ) ); ?></p>
	<?php endif; ?>
</div>
