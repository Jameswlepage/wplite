<?php
$data     = get_option( 'portfolio_singleton_sponsorships', [] );
$intro    = $data['intro'] ?? '';
$email    = $data['contact_email'] ?? '';
$partners = is_array( $data['partners'] ?? null ) ? $data['partners'] : [];

$tiers_preset = [
	[ 'name' => 'Floor', 'price' => '$5K / year',   'desc' => 'Logo placement · Newsletter mention · 2 event comps / month.' ],
	[ 'name' => 'Booth', 'price' => '$20K / year',  'desc' => 'Series naming rights · Quarterly activation · Dedicated creative from our team.', 'featured' => true ],
	[ 'name' => 'Stage', 'price' => '$50K+ / year', 'desc' => 'Full season partnership · Private event included · Bespoke programming collaboration.' ],
];
?>
<section class="e-singleton-sponsorships">
	<?php if ( $intro ) : ?>
		<p class="e-singleton-intro"><?php echo esc_html( $intro ); ?></p>
	<?php endif; ?>

	<div class="e-tier-grid">
		<?php foreach ( $tiers_preset as $tier ) :
			$featured = ! empty( $tier['featured'] );
			?>
			<div class="e-tier-card<?php echo $featured ? ' is-featured' : ''; ?>">
				<h3><?php echo esc_html( $tier['name'] ); ?></h3>
				<p class="price"><?php echo esc_html( $tier['price'] ); ?></p>
				<p><?php echo esc_html( $tier['desc'] ); ?></p>
			</div>
		<?php endforeach; ?>
	</div>

	<?php if ( $partners ) : ?>
		<h3 class="e-singleton-subhead">Current partners</h3>
		<ul class="e-partners-grid">
			<?php foreach ( $partners as $p ) : ?>
				<li>
					<?php if ( ! empty( $p['url'] ) ) : ?>
						<a href="<?php echo esc_url( $p['url'] ); ?>" target="_blank" rel="noopener"><?php echo esc_html( $p['name'] ?? '' ); ?></a>
					<?php else : ?>
						<?php echo esc_html( $p['name'] ?? '' ); ?>
					<?php endif; ?>
					<?php if ( ! empty( $p['tier'] ) ) : ?>
						<span class="e-partners-grid__tier"><?php echo esc_html( $p['tier'] ); ?></span>
					<?php endif; ?>
				</li>
			<?php endforeach; ?>
		</ul>
	<?php endif; ?>

	<?php if ( $email ) : ?>
		<p class="e-singleton-contact">Partnerships: <a href="mailto:<?php echo esc_attr( $email ); ?>"><?php echo esc_html( $email ); ?></a></p>
	<?php endif; ?>
</section>
