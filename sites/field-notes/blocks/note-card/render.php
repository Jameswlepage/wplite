<?php
$post_id = $block->context['postId'] ?? get_the_ID();
if ( ! $post_id ) { return; }

$title      = get_the_title( $post_id );
$excerpt    = get_the_excerpt( $post_id );
$link       = get_permalink( $post_id );
$observed   = get_post_meta( $post_id, 'observed_on', true );
$place      = get_post_meta( $post_id, 'place', true );
$weather    = get_post_meta( $post_id, 'weather', true );
$lat        = get_post_meta( $post_id, 'lat', true );
$lng        = get_post_meta( $post_id, 'lng', true );

$date_fmt = '';
if ( $observed ) {
	$ts = strtotime( $observed );
	if ( $ts ) {
		$date_fmt = strtoupper( date( 'd M Y', $ts ) );
	} else {
		$date_fmt = strtoupper( $observed );
	}
}

$coords = '';
if ( $lat && $lng ) {
	$lat_f = (float) $lat;
	$lng_f = (float) $lng;
	$coords = sprintf(
		'%s%.3f° %s · %s%.3f° %s',
		'',
		abs( $lat_f ),
		$lat_f >= 0 ? 'N' : 'S',
		'',
		abs( $lng_f ),
		$lng_f >= 0 ? 'E' : 'W'
	);
}
$hero = get_post_meta( $post_id, 'hero_url', true );
if ( ! $hero ) {
	$thumb = get_the_post_thumbnail_url( $post_id, 'large' );
	if ( $thumb ) { $hero = $thumb; }
}
?>
<article class="fn-note">
	<?php if ( $hero ) : ?>
		<a class="fn-note__hero" href="<?php echo esc_url( $link ); ?>" aria-hidden="true" tabindex="-1">
			<img src="<?php echo esc_url( $hero ); ?>" alt="" loading="lazy">
		</a>
	<?php endif; ?>
	<div class="fn-note__stamp">
		<span><?php echo esc_html( $date_fmt ); ?></span>
		<span><?php echo esc_html( $place ); ?></span>
	</div>
	<h3 class="fn-note__title"><a href="<?php echo esc_url( $link ); ?>"><?php echo esc_html( $title ); ?></a></h3>
	<?php if ( $excerpt ) : ?>
		<p class="fn-note__excerpt"><?php echo esc_html( wp_trim_words( $excerpt, 28 ) ); ?></p>
	<?php endif; ?>
	<div class="fn-note__meta">
		<?php if ( $coords ) : ?><span><?php echo esc_html( $coords ); ?></span><?php endif; ?>
		<?php if ( $weather ) : ?><span><?php echo esc_html( $weather ); ?></span><?php endif; ?>
	</div>
</article>
