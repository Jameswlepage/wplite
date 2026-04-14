<?php
$analytics = portfolio_light_mock_analytics();
$referrers = $analytics['referrers'];
?>
<div class="dash-card__header">
	<div class="dash-card__titles">
		<span class="dash-card__eyebrow">Traffic sources</span>
		<h2 class="dash-card__title">Top referrers</h2>
	</div>
</div>
<div class="dash-card__body">
	<ul class="referrers">
		<?php foreach ( $referrers as $r ) : ?>
		<li class="referrers__row">
			<span class="referrers__name"><?php echo esc_html( $r['source'] ); ?></span>
			<div class="referrers__bar-wrap" aria-hidden="true">
				<div class="referrers__bar" style="width: <?php echo (int) $r['share']; ?>%"></div>
			</div>
			<span class="referrers__pct"><?php echo (int) $r['share']; ?>%</span>
		</li>
		<?php endforeach; ?>
	</ul>
</div>
