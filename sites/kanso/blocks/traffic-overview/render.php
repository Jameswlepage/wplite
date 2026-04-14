<?php
/**
 * Traffic overview — 30-day area chart with a metric tab switcher and
 * hover tooltip, implemented with the Interactivity API.
 */

$analytics = portfolio_light_mock_analytics();
$today     = time();

$dates = [];
for ( $i = 29; $i >= 0; $i-- ) {
	$dates[] = wp_date( 'Y-m-d', $today - ( $i * 86400 ) );
}

wp_interactivity_state(
	'kanso/traffic-overview',
	[
		'metric'        => 'visitors',
		'series'        => [
			'visitors' => $analytics['visitorsSeries'],
			'sessions' => $analytics['sessionsSeries'],
		],
		'totals'        => [
			'visitors' => $analytics['visitors'],
			'sessions' => $analytics['sessions'],
		],
		'trends'        => [
			'visitors' => $analytics['visitorsTrend'],
			'sessions' => $analytics['sessionsTrend'],
		],
		'avgSessionSec' => $analytics['avgSessionSec'],
		'bounceRate'    => $analytics['bounceRate'],
		'dates'         => $dates,
		'hoverIdx'      => -1,
	]
);

// Render an initial SVG for the default metric so the chart is visible before hydration.
function portfolio_light_render_chart_svg( $series, $color = '#3858e9' ) {
	$w = 800; $h = 220;
	$pad = [ 'top' => 16, 'right' => 16, 'bottom' => 24, 'left' => 36 ];
	$iw = $w - $pad['left'] - $pad['right'];
	$ih = $h - $pad['top']  - $pad['bottom'];
	$max = max( $series ); $min = min( $series );
	$nice_max = (int) ceil( $max * 1.1 );
	$nice_min = max( 0, (int) floor( $min * 0.8 ) );
	$range = ( $nice_max - $nice_min ) ?: 1;
	$step  = $iw / max( count( $series ) - 1, 1 );

	$points = [];
	foreach ( $series as $i => $v ) {
		$x = $pad['left'] + $i * $step;
		$y = $pad['top'] + $ih - ( ( $v - $nice_min ) / $range ) * $ih;
		$points[] = [ $x, $y ];
	}
	$line = 'M ' . implode( ' L ', array_map( function( $p ) { return sprintf( '%.1f,%.1f', $p[0], $p[1] ); }, $points ) );
	$area = 'M ' . $pad['left'] . ',' . ( $pad['top'] + $ih ) . ' L ' .
		implode( ' L ', array_map( function( $p ) { return sprintf( '%.1f,%.1f', $p[0], $p[1] ); }, $points ) ) .
		' L ' . ( $pad['left'] + $iw ) . ',' . ( $pad['top'] + $ih ) . ' Z';

	ob_start(); ?>
	<svg class="traffic-chart" width="100%" height="<?php echo $h; ?>" viewBox="0 0 <?php echo $w; ?> <?php echo $h; ?>" preserveAspectRatio="none" data-wp-on--mousemove="actions.chartMouseMove" data-wp-on--mouseleave="actions.chartMouseLeave">
		<defs>
			<linearGradient id="traffic-grad" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" stop-color="<?php echo esc_attr( $color ); ?>" stop-opacity="0.18"/>
				<stop offset="100%" stop-color="<?php echo esc_attr( $color ); ?>" stop-opacity="0"/>
			</linearGradient>
		</defs>
		<?php for ( $i = 0; $i <= 4; $i++ ) :
			$gy = $pad['top'] + ( $ih / 4 ) * $i;
			$val = (int) round( $nice_max - ( $range / 4 ) * $i ); ?>
			<line x1="<?php echo $pad['left']; ?>" x2="<?php echo $pad['left'] + $iw; ?>" y1="<?php echo $gy; ?>" y2="<?php echo $gy; ?>" stroke="var(--wp-admin-border)" stroke-dasharray="<?php echo $i === 4 ? '' : '2,4'; ?>" stroke-width="1"/>
			<text x="<?php echo $pad['left'] - 8; ?>" y="<?php echo $gy + 3; ?>" font-size="10" fill="var(--wp-admin-text-muted)" text-anchor="end"><?php echo esc_html( portfolio_light_format_compact( $val ) ); ?></text>
		<?php endfor; ?>
		<path d="<?php echo esc_attr( $area ); ?>" fill="url(#traffic-grad)" data-wp-class--is-visitors="state.isVisitors"/>
		<path class="traffic-chart__line" d="<?php echo esc_attr( $line ); ?>" fill="none" stroke="<?php echo esc_attr( $color ); ?>" stroke-width="1.25" stroke-linejoin="round" stroke-linecap="round"/>
		<g class="traffic-chart__hover" data-wp-bind--hidden="state.hoverHidden">
			<line class="traffic-chart__crosshair" x1="0" x2="0" y1="<?php echo $pad['top']; ?>" y2="<?php echo $pad['top'] + $ih; ?>" stroke="var(--wp-admin-text-muted)" stroke-width="1" stroke-dasharray="3,3" opacity="0.5" data-wp-bind--x1="state.hoverX" data-wp-bind--x2="state.hoverX"/>
			<circle r="3.5" fill="var(--wp-admin-canvas-bg)" stroke="<?php echo esc_attr( $color ); ?>" stroke-width="1.5" data-wp-bind--cx="state.hoverX" data-wp-bind--cy="state.hoverY"/>
		</g>
	</svg>
	<?php return ob_get_clean();
}
?>
<div
	class="traffic-widget"
	data-wp-interactive="kanso/traffic-overview"
>
	<div class="dash-card__header">
		<div class="dash-card__titles">
			<span class="dash-card__eyebrow">Analytics</span>
			<h2 class="dash-card__title">Traffic overview</h2>
		</div>
		<div class="metric-toggle" role="tablist">
			<button
				role="tab"
				type="button"
				class="metric-toggle__btn"
				data-wp-on--click="actions.setMetric"
				data-wp-class--is-active="state.isVisitors"
				data-metric="visitors"
			>Visitors</button>
			<button
				role="tab"
				type="button"
				class="metric-toggle__btn"
				data-wp-on--click="actions.setMetric"
				data-wp-class--is-active="state.isSessions"
				data-metric="sessions"
			>Sessions</button>
		</div>
	</div>
	<div class="dash-card__body">
		<div class="traffic-summary">
			<div class="traffic-summary__primary">
				<strong class="traffic-summary__value" data-wp-text="state.formattedTotal"><?php echo esc_html( portfolio_light_format_compact( $analytics['visitors'] ) ); ?></strong>
				<span class="trend" data-wp-class--trend--up="state.trendIsUp" data-wp-class--trend--down="state.trendIsDown" data-wp-class--trend--flat="state.trendIsFlat">
					<span class="trend__arrow" data-wp-text="state.trendArrow">↗</span><span data-wp-text="state.trendText"><?php echo abs( (int) $analytics['visitorsTrend'] ); ?>%</span>
				</span>
			</div>
			<div class="traffic-summary__secondary">
				<div>
					<span class="traffic-summary__label">Avg. session</span>
					<strong><?php echo (int) floor( $analytics['avgSessionSec'] / 60 ); ?>m <?php echo (int) ( $analytics['avgSessionSec'] % 60 ); ?>s</strong>
				</div>
				<div>
					<span class="traffic-summary__label">Bounce rate</span>
					<strong><?php echo (int) $analytics['bounceRate']; ?>%</strong>
				</div>
			</div>
		</div>
		<div class="traffic-chart-wrap">
			<?php echo portfolio_light_render_chart_svg( $analytics['visitorsSeries'], '#3858e9' ); ?>
			<div class="traffic-chart__tooltip" data-wp-bind--hidden="state.hoverHidden" data-wp-style--left="state.tooltipLeft" data-wp-style--top="state.tooltipTop">
				<div class="traffic-chart__tooltip-date" data-wp-text="state.hoverDate"></div>
				<div class="traffic-chart__tooltip-value">
					<span class="traffic-chart__tooltip-dot"></span>
					<strong data-wp-text="state.hoverValue"></strong>
					<span class="traffic-chart__tooltip-label" data-wp-text="state.metric"></span>
				</div>
			</div>
		</div>
		<p class="traffic-note">Preview analytics — connect a provider to replace with live data.</p>
	</div>
</div>
