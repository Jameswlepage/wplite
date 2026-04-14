<?php
$rows  = portfolio_light_collection_breakdown();
$total = array_sum( array_column( $rows, 'count' ) );
?>
<div class="dash-card__header">
	<div class="dash-card__titles">
		<h2 class="dash-card__title">Content distribution</h2>
	</div>
</div>
<div class="dash-card__body">
	<?php if ( $total === 0 ) : ?>
		<p class="dash-empty__text">No content yet.</p>
	<?php else : ?>
	<div class="content-bar">
		<?php foreach ( $rows as $c ) : ?>
		<div class="content-bar__segment" style="flex-grow: <?php echo max( (int) $c['count'], 1 ); ?>; background: hsl(<?php echo (int) $c['hue']; ?>, 55%, 55%)" title="<?php echo esc_attr( $c['label'] . ': ' . $c['count'] ); ?>"></div>
		<?php endforeach; ?>
	</div>
	<div class="content-bar__legend">
		<?php foreach ( $rows as $c ) : ?>
		<span class="content-bar__legend-item">
			<span class="content-bar__legend-dot" style="background: hsl(<?php echo (int) $c['hue']; ?>, 55%, 55%)"></span>
			<?php echo esc_html( $c['label'] ); ?> <strong><?php echo (int) $c['count']; ?></strong>
		</span>
		<?php endforeach; ?>
	</div>
	<?php endif; ?>
</div>
