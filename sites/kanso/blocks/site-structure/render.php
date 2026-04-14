<?php
$routes = portfolio_light_get_routes();
?>
<div class="dash-card__header">
	<div class="dash-card__titles">
		<span class="dash-card__eyebrow">Pages</span>
		<h2 class="dash-card__title">Site structure</h2>
	</div>
</div>
<div class="dash-card__body">
	<?php if ( empty( $routes ) ) : ?>
		<p class="dash-empty__text">No pages defined.</p>
	<?php else : ?>
	<ul class="structure-list">
		<?php foreach ( $routes as $route ) :
			$path = ! empty( $route['slug'] ) ? '/' . $route['slug'] : '/';
		?>
		<li class="structure-list__item">
			<div class="structure-list__main">
				<span class="structure-list__title"><?php echo esc_html( $route['title'] ); ?></span>
				<span class="structure-list__path"><?php echo esc_html( $path ); ?></span>
			</div>
			<?php if ( ! empty( $route['template'] ) ) : ?>
			<span class="structure-list__tpl"><?php echo esc_html( $route['template'] ); ?></span>
			<?php endif; ?>
		</li>
		<?php endforeach; ?>
	</ul>
	<?php endif; ?>
</div>
