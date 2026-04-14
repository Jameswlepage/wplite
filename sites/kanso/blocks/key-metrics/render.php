<?php
/**
 * Key metrics — four stat cards (visitors, sessions, total content, profile
 * completeness) with deltas and inline SVG sparklines.
 */

$analytics = portfolio_light_mock_analytics();
$models    = portfolio_light_get_models();

$total_records = 0;
foreach ( $models as $model ) {
	if ( ( $model['type'] ?? '' ) !== 'collection' ) continue;
	$tally          = wp_count_posts( $model['postType'] );
	$total_records += (int) ( $tally->publish ?? 0 ) + (int) ( $tally->draft ?? 0 );
}

$profile         = portfolio_light_get_singletons()['profile'] ?? null;
$profile_data    = $profile ? ( get_option( 'portfolio_singleton_profile', [] ) ?: [] ) : [];
$profile_fields  = [ 'founder_name', 'founder_role', 'short_bio', 'location', 'founded_year' ];
$profile_filled  = 0;
foreach ( $profile_fields as $f ) {
	if ( ! empty( $profile_data[ $f ] ) ) $profile_filled++;
}
$profile_pct = (int) round( ( $profile_filled / max( count( $profile_fields ), 1 ) ) * 100 );

$cards = [
	[
		'label'  => 'Visitors',
		'value'  => portfolio_light_format_compact( $analytics['visitors'] ),
		'trend'  => $analytics['visitorsTrend'],
		'sub'    => 'last 30 days',
		'color'  => '#3858e9',
		'series' => $analytics['visitorsSeries'],
	],
	[
		'label'  => 'Sessions',
		'value'  => portfolio_light_format_compact( $analytics['sessions'] ),
		'trend'  => $analytics['sessionsTrend'],
		'sub'    => 'last 30 days',
		'color'  => '#00a3a1',
		'series' => $analytics['sessionsSeries'],
	],
	[
		'label'  => 'Total content',
		'value'  => (string) $total_records,
		'trend'  => null,
		'sub'    => count( array_filter( $models, function( $m ) { return ( $m['type'] ?? '' ) === 'collection'; } ) ) . ' collections',
		'color'  => '#8a3ffc',
		'series' => null,
	],
	[
		'label'  => 'Profile',
		'value'  => $profile_pct . '%',
		'trend'  => null,
		'sub'    => 'completeness',
		'color'  => '#ee5396',
		'series' => null,
		'href'   => '/settings/profile',
	],
];
?>
<div class="stat-cards">
	<?php foreach ( $cards as $c ) : ?>
	<?php $tag = isset( $c['href'] ) ? 'a' : 'div'; ?>
	<<?php echo $tag; ?> class="stat-card" <?php if ( isset( $c['href'] ) ) echo 'data-spa-nav href="' . esc_url( $c['href'] ) . '"'; ?>>
		<div class="stat-card__head">
			<span class="stat-card__label"><?php echo esc_html( $c['label'] ); ?></span>
			<?php if ( $c['trend'] !== null ) echo portfolio_light_trend_badge( $c['trend'] ); ?>
		</div>
		<div class="stat-card__value"><?php echo esc_html( $c['value'] ); ?></div>
		<div class="stat-card__foot">
			<span class="stat-card__sub"><?php echo esc_html( $c['sub'] ); ?></span>
			<?php if ( ! empty( $c['series'] ) ) : ?>
			<div class="stat-card__spark"><?php echo portfolio_light_sparkline_svg( $c['series'], $c['color'] ); ?></div>
			<?php endif; ?>
		</div>
	</<?php echo $tag; ?>>
	<?php endforeach; ?>
</div>
