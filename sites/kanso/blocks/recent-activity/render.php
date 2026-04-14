<?php
$items = portfolio_light_recent_activity_items( 12 );

function portfolio_light_activity_group_label( $iso ) {
	if ( ! $iso ) return 'Earlier';
	$today = wp_date( 'Y-m-d' );
	$yest  = wp_date( 'Y-m-d', time() - 86400 );
	$date  = wp_date( 'Y-m-d', strtotime( $iso ) );
	if ( $date === $today ) return 'Today';
	if ( $date === $yest )  return 'Yesterday';
	return wp_date( 'D, M j', strtotime( $iso ) );
}

$groups = [];
foreach ( $items as $it ) {
	$label = portfolio_light_activity_group_label( $it['modified'] );
	if ( ! isset( $groups[ $label ] ) ) $groups[ $label ] = [];
	$groups[ $label ][] = $it;
}
?>
<div class="dash-card__header">
	<div class="dash-card__titles">
		<span class="dash-card__eyebrow">Timeline</span>
		<h2 class="dash-card__title">Recent activity</h2>
	</div>
</div>
<div class="dash-card__body">
	<?php if ( empty( $items ) ) : ?>
		<p class="dash-empty__text">No activity yet.</p>
	<?php else : ?>
	<div class="timeline">
		<?php foreach ( $groups as $day_label => $day_items ) : ?>
		<div class="timeline__group">
			<div class="timeline__day"><?php echo esc_html( $day_label ); ?></div>
			<ul class="timeline__list">
				<?php foreach ( $day_items as $it ) :
					$hue = ( ord( substr( $it['modelId'], 0, 1 ) ) * 47 ) % 360;
				?>
				<li class="timeline__item">
					<a class="timeline__link" href="<?php echo esc_url( $it['editPath'] ); ?>" data-spa-nav>
						<span class="timeline__dot" style="--dot-color: hsl(<?php echo $hue; ?>, 60%, 50%)">
							<?php echo $it['action'] === 'Created' ? '+' : '·'; ?>
						</span>
						<div class="timeline__body">
							<div class="timeline__line">
								<span class="timeline__action"><?php echo esc_html( $it['action'] ); ?></span>
								<span class="timeline__title"><?php echo esc_html( $it['title'] ); ?></span>
							</div>
							<div class="timeline__meta">
								<span class="timeline__tag"><?php echo esc_html( $it['modelLabel'] ); ?></span>
								<span><?php echo esc_html( portfolio_light_format_relative( $it['modified'] ) ); ?></span>
							</div>
						</div>
					</a>
				</li>
				<?php endforeach; ?>
			</ul>
		</div>
		<?php endforeach; ?>
	</div>
	<?php endif; ?>
</div>
