<?php
$model_id  = $attributes['modelId'] ?? '';
$models    = portfolio_light_get_models();
$model     = null;
foreach ( $models as $m ) {
	if ( ( $m['type'] ?? '' ) === 'collection' && $m['id'] === $model_id ) {
		$model = $m;
		break;
	}
}

if ( ! $model ) {
	echo '<div class="dash-card__header"><div class="dash-card__titles"><h2 class="dash-card__title">Collection</h2></div></div>';
	echo '<div class="dash-card__body"><p class="dash-empty__text">No collection selected.</p></div>';
	return;
}

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
<div class="dash-card__header">
	<div class="dash-card__titles">
		<span class="dash-card__eyebrow">Collection</span>
		<h2 class="dash-card__title">
			<?php echo esc_html( $model['label'] ); ?>
			<span class="dash-count-pill"><?php echo (int) $count; ?></span>
		</h2>
	</div>
	<div class="dash-card__action">
		<a class="components-button is-tertiary is-small" href="<?php echo esc_url( $admin_path ); ?>" data-spa-nav>View all</a>
	</div>
</div>
<div class="dash-card__body">
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
</div>
