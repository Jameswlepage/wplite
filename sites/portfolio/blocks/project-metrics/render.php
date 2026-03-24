<?php
$metrics = get_post_meta( get_the_ID(), 'metrics', true );

if ( empty( $metrics ) || ! is_array( $metrics ) ) {
	return;
}
?>

<section class="portfolio-project-metrics">
	<h3>Key Metrics</h3>
	<ul class="portfolio-project-metrics__grid">
		<?php foreach ( $metrics as $metric ) : ?>
			<?php
			$label = esc_html( $metric['label'] ?? '' );
			$value = esc_html( $metric['value'] ?? '' );
			?>
			<li>
				<span><?php echo $label; ?></span>
				<strong><?php echo $value; ?></strong>
			</li>
		<?php endforeach; ?>
	</ul>
</section>
