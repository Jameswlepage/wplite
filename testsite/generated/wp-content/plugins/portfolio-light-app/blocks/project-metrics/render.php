<?php
$metrics = get_post_meta( get_the_ID(), 'metrics', true );

if ( empty( $metrics ) || ! is_array( $metrics ) ) {
	return;
}
?>

<section class="portfolio-project-metrics">
	<h3>Key Metrics</h3>
	<ul>
		<?php foreach ( $metrics as $metric ) : ?>
			<?php
			$label = esc_html( $metric['label'] ?? '' );
			$value = esc_html( $metric['value'] ?? '' );
			?>
			<li><strong><?php echo $label; ?>:</strong> <?php echo $value; ?></li>
		<?php endforeach; ?>
	</ul>
</section>
