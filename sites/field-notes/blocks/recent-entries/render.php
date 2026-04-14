<?php
$notes = get_posts( [
	'post_type'      => 'note',
	'post_status'    => 'publish',
	'posts_per_page' => 5,
	'orderby'        => 'date',
	'order'          => 'DESC',
] );
?>
<div class="fn-widget">
	<h3 class="fn-widget__title">Recent entries</h3>
	<?php if ( ! $notes ) : ?>
		<p class="fn-widget__empty">No entries yet. Add one from the Field Notes menu.</p>
	<?php else : ?>
		<ul class="fn-widget__list">
			<?php foreach ( $notes as $note ) :
				$observed = get_post_meta( $note->ID, 'observed_on', true );
				$ts = $observed ? strtotime( $observed ) : 0;
				$date_fmt = $ts ? strtoupper( date( 'd M Y', $ts ) ) : '';
				$place = get_post_meta( $note->ID, 'place', true );
				$edit  = get_edit_post_link( $note->ID );
			?>
				<li class="fn-widget__item">
					<a href="<?php echo esc_url( $edit ); ?>" class="fn-widget__link">
						<span class="fn-widget__meta">
							<?php if ( $date_fmt ) : ?><span><?php echo esc_html( $date_fmt ); ?></span><?php endif; ?>
							<?php if ( $place ) : ?><span><?php echo esc_html( $place ); ?></span><?php endif; ?>
						</span>
						<span class="fn-widget__name"><?php echo esc_html( get_the_title( $note ) ); ?></span>
					</a>
				</li>
			<?php endforeach; ?>
		</ul>
	<?php endif; ?>
</div>
