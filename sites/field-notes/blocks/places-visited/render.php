<?php
$ids = get_posts( [
	'post_type'      => 'note',
	'post_status'    => 'publish',
	'posts_per_page' => -1,
	'fields'         => 'ids',
] );

$rows = [];
foreach ( $ids as $id ) {
	$place = get_post_meta( $id, 'place', true );
	if ( ! $place ) { continue; }
	$stamp = get_post_meta( $id, 'observed_on', true );
	$ts = $stamp ? strtotime( $stamp ) : 0;
	if ( ! isset( $rows[ $place ] ) || $ts > $rows[ $place ]['ts'] ) {
		$rows[ $place ] = [ 'ts' => $ts, 'stamp' => $stamp, 'count' => 0 ];
	}
	$rows[ $place ]['count'] = ( $rows[ $place ]['count'] ?? 0 ) + 1;
}
uasort( $rows, fn( $a, $b ) => $b['ts'] <=> $a['ts'] );
$rows = array_slice( $rows, 0, 6, true );
?>
<div class="fn-widget">
	<h3 class="fn-widget__title">Places visited</h3>
	<?php if ( ! $rows ) : ?>
		<p class="fn-widget__empty">No places logged yet.</p>
	<?php else : ?>
		<ul class="fn-widget__list">
			<?php foreach ( $rows as $place => $info ) :
				$ts = $info['ts'];
				$date_fmt = $ts ? strtoupper( date( 'd M Y', $ts ) ) : '';
			?>
				<li class="fn-widget__item">
					<span class="fn-widget__meta">
						<span><?php echo esc_html( $date_fmt ); ?></span>
						<span><?php echo (int) $info['count']; ?> × entries</span>
					</span>
					<span class="fn-widget__name"><?php echo esc_html( $place ); ?></span>
				</li>
			<?php endforeach; ?>
		</ul>
	<?php endif; ?>
</div>
