<?php
$top = portfolio_light_top_content( 6 );
$max = $top ? max( array_column( $top, 'views' ) ) : 1;
?>
<div class="dash-card__header">
	<div class="dash-card__titles">
		<span class="dash-card__eyebrow">Last 30 days</span>
		<h2 class="dash-card__title">Top content</h2>
	</div>
</div>
<div class="dash-card__body">
	<?php if ( empty( $top ) ) : ?>
		<p class="dash-empty__text">Publish a few records to see what's performing.</p>
	<?php else : ?>
	<ol class="leaderboard">
		<?php foreach ( $top as $i => $item ) : ?>
		<li class="leaderboard__row">
			<a class="leaderboard__link" href="<?php echo esc_url( $item['editPath'] ); ?>" data-spa-nav>
				<span class="leaderboard__rank"><?php echo (int) ( $i + 1 ); ?></span>
				<div class="leaderboard__body">
					<span class="leaderboard__title"><?php echo esc_html( $item['title'] ); ?></span>
					<span class="leaderboard__meta"><?php echo esc_html( $item['modelLabel'] ); ?></span>
				</div>
				<div class="leaderboard__bar-wrap" aria-hidden="true">
					<div class="leaderboard__bar" style="width: <?php echo (int) round( ( $item['views'] / $max ) * 100 ); ?>%"></div>
				</div>
				<div class="leaderboard__numbers">
					<strong><?php echo esc_html( portfolio_light_format_compact( $item['views'] ) ); ?></strong>
					<?php echo portfolio_light_trend_badge( $item['trend'] ); ?>
				</div>
			</a>
		</li>
		<?php endforeach; ?>
	</ol>
	<?php endif; ?>
</div>
