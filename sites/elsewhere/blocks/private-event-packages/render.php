<?php
$data     = get_option( 'portfolio_singleton_private-events', [] );
$intro    = $data['intro'] ?? '';
$email    = $data['contact_email'] ?? '';
$packages = is_array( $data['packages'] ?? null ) ? $data['packages'] : [];
?>
<section class="e-singleton-private-events">
	<?php if ( $intro ) : ?>
		<p class="e-singleton-intro"><?php echo esc_html( $intro ); ?></p>
	<?php endif; ?>

	<?php if ( $packages ) : ?>
		<div class="e-tier-grid">
			<?php foreach ( $packages as $i => $pkg ) :
				$featured = ( $i === 1 );
				?>
				<div class="e-tier-card<?php echo $featured ? ' is-featured' : ''; ?>">
					<p class="e-pill<?php echo $featured ? ' is-coral' : ''; ?>"><?php echo esc_html( $pkg['capacity'] ?? '' ); ?></p>
					<h3><?php echo esc_html( $pkg['name'] ?? '' ); ?></h3>
					<p class="price"><?php echo esc_html( $pkg['starts_at'] ?? '' ); ?></p>
					<?php if ( ! empty( $pkg['description'] ) ) : ?>
						<p><?php echo esc_html( $pkg['description'] ); ?></p>
					<?php endif; ?>
				</div>
			<?php endforeach; ?>
		</div>
	<?php endif; ?>

	<?php if ( $email ) : ?>
		<p class="e-singleton-contact">Bookings: <a href="mailto:<?php echo esc_attr( $email ); ?>"><?php echo esc_html( $email ); ?></a></p>
	<?php endif; ?>
</section>
