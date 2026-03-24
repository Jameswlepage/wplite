<?php
$taxonomies = [ 'project_type', 'technology' ];
?>

<div class="portfolio-project-filter" data-portfolio-project-filter>
	<?php foreach ( $taxonomies as $taxonomy ) : ?>
		<?php
		$terms = get_terms(
			[
				'taxonomy'   => $taxonomy,
				'hide_empty' => true,
			]
		);
		?>
		<?php if ( ! is_wp_error( $terms ) && ! empty( $terms ) ) : ?>
			<div class="portfolio-project-filter__group">
				<strong><?php echo esc_html( ucwords( str_replace( '_', ' ', $taxonomy ) ) ); ?></strong>
				<div class="portfolio-project-filter__chips">
					<?php foreach ( $terms as $term ) : ?>
						<a href="<?php echo esc_url( get_term_link( $term ) ); ?>" data-filter-chip><?php echo esc_html( $term->name ); ?></a>
					<?php endforeach; ?>
				</div>
			</div>
		<?php endif; ?>
	<?php endforeach; ?>
</div>
