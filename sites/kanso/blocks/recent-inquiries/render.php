<?php
$model = portfolio_light_get_model( 'inquiry' );
if ( ! $model ) {
	// No inquiry model configured for this site; quietly render an empty state.
	echo '<div class="dash-card__header"><div class="dash-card__titles"><h2 class="dash-card__title">Recent inquiries</h2></div></div><div class="dash-card__body"><p class="dash-empty__text">No inquiry model defined for this site.</p></div>';
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
?>
<div class="dash-card__header">
	<div class="dash-card__titles">
		<h2 class="dash-card__title">Recent inquiries</h2>
	</div>
</div>
<div class="dash-card__body">
	<?php if ( empty( $posts ) ) : ?>
		<p class="dash-empty__text">No inquiries yet.</p>
	<?php else : ?>
	<ul class="record-list">
		<?php foreach ( $posts as $p ) :
			$email  = get_post_meta( $p->ID, 'email', true );
			$status = get_post_meta( $p->ID, 'status', true ) ?: 'new';
		?>
		<li class="record-list__item">
			<a class="record-list__link" href="/<?php echo esc_attr( $model['adminPath'] ?? 'inquiries' ); ?>/<?php echo (int) $p->ID; ?>" data-spa-nav>
				<div class="record-list__main">
					<span class="record-list__title"><?php echo esc_html( $p->post_title ?: '(Unnamed)' ); ?></span>
					<?php if ( $email ) : ?>
					<span class="record-list__slug"><?php echo esc_html( $email ); ?></span>
					<?php endif; ?>
				</div>
				<span class="status-pill status-pill--<?php echo esc_attr( $status ); ?>"><?php echo esc_html( $status ); ?></span>
			</a>
		</li>
		<?php endforeach; ?>
	</ul>
	<?php endif; ?>
</div>
