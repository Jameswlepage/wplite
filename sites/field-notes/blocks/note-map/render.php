<?php
$per_page = isset( $attributes['perPage'] ) ? (int) $attributes['perPage'] : 40;

$notes = get_posts( [
	'post_type'      => 'note',
	'post_status'    => 'publish',
	'posts_per_page' => max( 1, $per_page ),
	'orderby'        => 'date',
	'order'          => 'DESC',
] );

/**
 * Equirectangular projection: lat/lng -> percentage of canvas.
 * Full world: lng ∈ [-180, 180], lat ∈ [-90, 90].
 * We clip the poles because the top/bottom of an equirectangular map wastes space.
 */
$project = function ( $lat, $lng ) {
	$lat = max( -70, min( 75, (float) $lat ) );
	$lng = (float) $lng;
	$x = ( $lng + 180 ) / 360;                       // 0..1
	$y = 1 - ( ( $lat + 70 ) / ( 75 + 70 ) );         // 0 top, 1 bottom (clipped)
	return [ $x * 100, $y * 100 ];
};

$legend = [
	'ink'    => 'Ink',
	'iron'   => 'Iron',
	'moss'   => 'Moss',
	'rust'   => 'Rust',
	'indigo' => 'Indigo',
];
$seen_colors = [];

?>
<section class="fn-map" aria-label="Map of field notes">

	<div class="fn-map__head">
		<h2 class="fn-map__title">The Known World</h2>
		<p class="fn-map__scale">Equirectangular · 1:very-approximate</p>
	</div>

	<div class="fn-map__canvas">

		<svg class="fn-map__coast" viewBox="0 0 1000 562" preserveAspectRatio="none" aria-hidden="true">
			<!-- hand-drawn coasts as loose wobbly paths -->
			<g fill="none" stroke="#3b2a1e" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
				<!-- Americas -->
				<path d="M 180 80 Q 200 120 220 160 T 260 260 Q 240 320 280 380 T 320 480 Q 300 520 330 540" />
				<path d="M 260 260 Q 230 270 210 290" />
				<!-- Europe -->
				<path d="M 470 100 Q 500 120 520 150 T 560 200 Q 540 220 560 240" />
				<path d="M 460 130 Q 440 150 450 180" />
				<!-- Africa -->
				<path d="M 500 220 Q 530 260 550 320 T 560 420 Q 540 460 520 470" />
				<!-- Asia -->
				<path d="M 560 120 Q 620 140 680 150 T 780 170 Q 820 200 800 240 T 760 300" />
				<!-- Australia -->
				<path d="M 770 400 Q 820 400 850 420 T 820 460 Q 790 460 770 440 Z" />
				<!-- small islands -->
				<circle cx="820" cy="330" r="3" />
				<circle cx="750" cy="340" r="4" />
				<circle cx="295" cy="330" r="2" />
			</g>
		</svg>

		<svg class="fn-map__compass" viewBox="0 0 64 64" aria-hidden="true">
			<g fill="none" stroke="#3b2a1e" stroke-width="1.2">
				<circle cx="32" cy="32" r="26" />
				<circle cx="32" cy="32" r="20" stroke-dasharray="2 3" />
				<path d="M 32 8 L 35 32 L 32 56 L 29 32 Z" fill="#1a1612" stroke="none" />
				<path d="M 8 32 L 32 29 L 56 32 L 32 35 Z" fill="#a83e1d" stroke="none" opacity="0.85" />
			</g>
			<text x="32" y="6" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="5" fill="#3b2a1e">N</text>
		</svg>

		<?php foreach ( $notes as $note ) :
			$lat = get_post_meta( $note->ID, 'lat', true );
			$lng = get_post_meta( $note->ID, 'lng', true );
			if ( ! is_numeric( $lat ) || ! is_numeric( $lng ) ) { continue; }

			[ $px, $py ] = $project( $lat, $lng );

			$color    = get_post_meta( $note->ID, 'ink_color', true ) ?: 'ink';
			$observed = get_post_meta( $note->ID, 'observed_on', true );
			$place    = get_post_meta( $note->ID, 'place', true );
			$link     = get_permalink( $note->ID );
			$title    = get_the_title( $note->ID );
			$seen_colors[ $color ] = true;

			$date_fmt = '';
			if ( $observed ) {
				$ts = strtotime( $observed );
				$date_fmt = $ts ? strtoupper( date( 'd M Y', $ts ) ) : strtoupper( $observed );
			}

			$lat_f = (float) $lat;
			$lng_f = (float) $lng;
			$coords = sprintf(
				'%.3f° %s · %.3f° %s',
				abs( $lat_f ), $lat_f >= 0 ? 'N' : 'S',
				abs( $lng_f ), $lng_f >= 0 ? 'E' : 'W'
			);
		?>
			<a class="fn-pin fn-pin--<?php echo esc_attr( $color ); ?>"
			   href="<?php echo esc_url( $link ); ?>"
			   style="left:<?php echo esc_attr( $px ); ?>%; top:<?php echo esc_attr( $py ); ?>%;"
			   aria-label="<?php echo esc_attr( $title . ' — ' . $place ); ?>">
				<span class="fn-pin__dot" aria-hidden="true"></span>
				<span class="fn-pin__card">
					<?php if ( $date_fmt ) : ?>
						<span class="fn-pin__date"><?php echo esc_html( $date_fmt ); ?></span>
					<?php endif; ?>
					<span class="fn-pin__title"><?php echo esc_html( $title ); ?></span>
					<?php if ( $place ) : ?>
						<span class="fn-pin__place"><?php echo esc_html( $place ); ?></span>
					<?php endif; ?>
					<span class="fn-pin__coords"><?php echo esc_html( $coords ); ?></span>
				</span>
			</a>
		<?php endforeach; ?>

	</div>

	<div class="fn-map__legend">
		<span><?php echo count( $notes ); ?> Entries Plotted</span>
		<?php foreach ( $legend as $slug => $name ) :
			if ( empty( $seen_colors[ $slug ] ) ) { continue; }
		?>
			<span class="fn-pin--<?php echo esc_attr( $slug ); ?>">
				<span class="fn-map__legend-dot"></span><?php echo esc_html( $name ); ?>
			</span>
		<?php endforeach; ?>
	</div>

</section>
