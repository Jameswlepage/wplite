<?php
$models     = portfolio_light_get_models();
$collections = array_values( array_filter( $models, function( $m ) {
	return ( $m['type'] ?? '' ) === 'collection';
} ) );
?>
<div class="dash-card__header">
	<div class="dash-card__titles">
		<h2 class="dash-card__title">Collections</h2>
	</div>
</div>
<div class="dash-card__body">
	<?php if ( empty( $collections ) ) : ?>
		<p class="dash-empty__text">No collections defined.</p>
	<?php else : ?>
	<div class="collections-overview">
		<?php foreach ( $collections as $model ) :
			$posts = get_posts(
				[
					'post_type'      => $model['postType'],
					'post_status'    => 'any',
					'posts_per_page' => 5,
					'orderby'        => 'modified',
					'order'          => 'DESC',
				]
			);
			$admin_path = '/' . ( $model['adminPath'] ?? $model['id'] . 's' );
			$total      = wp_count_posts( $model['postType'] );
			$count      = (int) ( $total->publish ?? 0 ) + (int) ( $total->draft ?? 0 );
		?>
		<section class="collections-overview__block">
			<header class="collections-overview__header">
				<h3 class="collections-overview__title">
					<?php echo esc_html( $model['label'] ); ?>
					<span class="dash-count-pill"><?php echo (int) $count; ?></span>
				</h3>
				<a class="components-button is-tertiary is-small" href="<?php echo esc_url( $admin_path ); ?>" data-spa-nav>View all</a>
			</header>
			<?php if ( empty( $posts ) ) : ?>
				<div class="dash-empty">
					<p class="dash-empty__text">No <?php echo esc_html( strtolower( $model['label'] ) ); ?> yet.</p>
					<a class="components-button is-primary is-small" href="<?php echo esc_url( $admin_path . '/new' ); ?>" data-spa-nav>+ Create <?php echo esc_html( $model['singularLabel'] ?? $model['label'] ); ?></a>
				</div>
			<?php else : ?>
			<ul class="record-list">
				<?php foreach ( $posts as $post ) : ?>
				<li class="record-list__item">
					<a class="record-list__link" href="<?php echo esc_url( $admin_path . '/' . $post->ID ); ?>" data-spa-nav>
						<div class="record-list__main">
							<span class="record-list__title"><?php echo esc_html( $post->post_title ?: '(Untitled)' ); ?></span>
							<?php if ( $post->post_name ) : ?>
							<span class="record-list__slug">/<?php echo esc_html( $post->post_name ); ?></span>
							<?php endif; ?>
						</div>
						<span class="record-list__time"><?php echo esc_html( portfolio_light_format_relative( get_post_modified_time( 'c', true, $post ) ) ); ?></span>
					</a>
				</li>
				<?php endforeach; ?>
			</ul>
			<?php endif; ?>
		</section>
		<?php endforeach; ?>
	</div>
	<?php endif; ?>
</div>
