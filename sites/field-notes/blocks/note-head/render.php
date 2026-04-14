<?php
$post_id = $block->context['postId'] ?? get_the_ID();
if ( ! $post_id ) { return; }

$title     = get_the_title( $post_id );
$excerpt   = get_the_excerpt( $post_id );
$observed  = get_post_meta( $post_id, 'observed_on', true );
$place     = get_post_meta( $post_id, 'place', true );
$lat       = get_post_meta( $post_id, 'lat', true );
$lng       = get_post_meta( $post_id, 'lng', true );
$elevation = get_post_meta( $post_id, 'elevation_m', true );
$weather   = get_post_meta( $post_id, 'weather', true );
$species   = get_post_meta( $post_id, 'species', true );

$date_fmt = '';
if ( $observed ) {
	$ts = strtotime( $observed );
	$date_fmt = $ts ? strtoupper( date( 'd M Y', $ts ) ) : strtoupper( $observed );
}

$coords = '';
if ( $lat && $lng ) {
	$lat_f = (float) $lat;
	$lng_f = (float) $lng;
	$coords = sprintf(
		'%.4f° %s, %.4f° %s',
		abs( $lat_f ), $lat_f >= 0 ? 'N' : 'S',
		abs( $lng_f ), $lng_f >= 0 ? 'E' : 'W'
	);
}
?>
<header class="fn-single__head">
	<div class="fn-single__stamp">
		<span>Entry · <?php echo esc_html( $date_fmt ?: '—' ); ?></span>
		<span><?php echo esc_html( $place ?: 'Location withheld' ); ?></span>
	</div>

	<h1 class="fn-single__title"><?php echo esc_html( $title ); ?></h1>

	<?php if ( $excerpt ) : ?>
		<p class="fn-single__lede"><?php echo esc_html( $excerpt ); ?></p>
	<?php endif; ?>

	<div class="fn-single__facts">
		<?php if ( $coords ) : ?>
			<div class="fn-single__fact">
				<strong>Coordinates</strong>
				<span><?php echo esc_html( $coords ); ?></span>
			</div>
		<?php endif; ?>
		<?php if ( $elevation ) : ?>
			<div class="fn-single__fact">
				<strong>Elevation</strong>
				<span><?php echo esc_html( $elevation ); ?> m</span>
			</div>
		<?php endif; ?>
		<?php if ( $weather ) : ?>
			<div class="fn-single__fact">
				<strong>Weather</strong>
				<span><?php echo esc_html( $weather ); ?></span>
			</div>
		<?php endif; ?>
		<?php if ( $species ) : ?>
			<div class="fn-single__fact">
				<strong>Subject</strong>
				<span><?php echo esc_html( $species ); ?></span>
			</div>
		<?php endif; ?>
	</div>
</header>
