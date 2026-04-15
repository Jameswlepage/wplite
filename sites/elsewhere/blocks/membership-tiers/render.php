<?php
$data  = get_option( 'portfolio_singleton_memberships', [] );
$intro = $data['intro'] ?? '';
$tiers = is_array( $data['tiers'] ?? null ) ? $data['tiers'] : [];
?>
<section class="e-singleton-memberships">
	<?php if ( $intro ) : ?>
		<p class="e-singleton-intro"><?php echo esc_html( $intro ); ?></p>
	<?php endif; ?>

	<?php if ( $tiers ) : ?>
		<div class="e-tier-grid">
			<?php foreach ( $tiers as $tier ) :
				$featured = ! empty( $tier['featured'] );
				$perks    = array_filter( array_map( 'trim', preg_split( "/\r?\n/", (string) ( $tier['perks'] ?? '' ) ) ) );
				?>
				<div class="e-tier-card<?php echo $featured ? ' is-featured' : ''; ?>">
					<?php if ( ! empty( $tier['tagline'] ) ) : ?>
						<p class="e-pill<?php echo $featured ? ' is-coral' : ''; ?>"><?php echo esc_html( $tier['tagline'] ); ?></p>
					<?php endif; ?>
					<h3><?php echo esc_html( $tier['name'] ?? '' ); ?></h3>
					<p class="price"><?php echo esc_html( $tier['price'] ?? '' ); ?></p>
					<?php if ( $perks ) : ?>
						<ul class="e-tier-card__perks">
							<?php foreach ( $perks as $perk ) : ?>
								<li><?php echo esc_html( $perk ); ?></li>
							<?php endforeach; ?>
						</ul>
					<?php endif; ?>
					<?php if ( ! empty( $tier['signup_url'] ) ) : ?>
						<div class="wp-block-buttons">
							<div class="wp-block-button<?php echo $featured ? '' : ' is-style-outline'; ?>">
								<a class="wp-block-button__link wp-element-button" href="<?php echo esc_url( $tier['signup_url'] ); ?>">Join <?php echo esc_html( $tier['name'] ?? '' ); ?></a>
							</div>
						</div>
					<?php endif; ?>
				</div>
			<?php endforeach; ?>
		</div>
	<?php endif; ?>
</section>
