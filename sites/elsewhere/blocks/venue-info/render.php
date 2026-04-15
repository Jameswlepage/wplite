<?php
$data = get_option( 'portfolio_singleton_contact', [] );
$address_parts = array_filter( [
	$data['address_street']   ?? '',
	trim( ( $data['address_locality'] ?? '' ) . ( ! empty( $data['address_region'] ) ? ', ' . $data['address_region'] : '' ) . ( ! empty( $data['address_postal'] ) ? ' ' . $data['address_postal'] : '' ) ),
] );
$hours = is_array( $data['hours'] ?? null ) ? $data['hours'] : [];
$map   = $data['map_url'] ?? '';
?>
<section class="e-venue-info">
	<div class="e-venue-info__grid">
		<div>
			<h3>Venue</h3>
			<?php if ( $address_parts ) : ?>
				<p>
					<?php foreach ( $address_parts as $i => $line ) : ?>
						<?php echo esc_html( $line ); ?><?php echo $i < count( $address_parts ) - 1 ? '<br>' : ''; ?>
					<?php endforeach; ?>
				</p>
			<?php endif; ?>
			<?php if ( $map ) : ?>
				<p><a href="<?php echo esc_url( $map ); ?>" target="_blank" rel="noopener">Directions →</a></p>
			<?php endif; ?>
		</div>
		<?php if ( $hours ) : ?>
			<div>
				<h3>Hours</h3>
				<ul class="e-venue-info__hours">
					<?php foreach ( $hours as $h ) : ?>
						<li>
							<strong><?php echo esc_html( $h['label'] ?? '' ); ?></strong>
							<span><?php echo esc_html( $h['hours'] ?? '' ); ?></span>
						</li>
					<?php endforeach; ?>
				</ul>
			</div>
		<?php endif; ?>
		<div>
			<h3>Departments</h3>
			<?php if ( ! empty( $data['email'] ) ) : ?><p><strong>General:</strong> <a href="mailto:<?php echo esc_attr( $data['email'] ); ?>"><?php echo esc_html( $data['email'] ); ?></a></p><?php endif; ?>
			<?php if ( ! empty( $data['booking_email'] ) ) : ?><p><strong>Bookings:</strong> <a href="mailto:<?php echo esc_attr( $data['booking_email'] ); ?>"><?php echo esc_html( $data['booking_email'] ); ?></a></p><?php endif; ?>
			<?php if ( ! empty( $data['press_email'] ) ) : ?><p><strong>Press:</strong> <a href="mailto:<?php echo esc_attr( $data['press_email'] ); ?>"><?php echo esc_html( $data['press_email'] ); ?></a></p><?php endif; ?>
			<?php if ( ! empty( $data['phone'] ) ) : ?><p><strong>Phone:</strong> <?php echo esc_html( $data['phone'] ); ?></p><?php endif; ?>
		</div>
	</div>
</section>
