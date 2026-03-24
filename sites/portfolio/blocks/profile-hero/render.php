<?php
$profile = get_option( 'portfolio_singleton_profile', [] );

$name         = esc_html( $profile['full_name'] ?? '' );
$role         = esc_html( $profile['role_line'] ?? '' );
$bio          = wp_kses_post( $profile['short_bio'] ?? '' );
$resume       = esc_url( $profile['resume_url'] ?? '' );
$location     = esc_html( $profile['location'] ?? '' );
$availability = ucfirst( sanitize_text_field( $profile['availability'] ?? '' ) );
$avatar_id    = (int) ( $profile['avatar'] ?? 0 );
$avatar_html  = $avatar_id ? wp_get_attachment_image( $avatar_id, 'large', false, [ 'class' => 'portfolio-profile-hero__avatar-image' ] ) : '';
?>

<section class="portfolio-profile-hero">
	<div class="portfolio-profile-hero__intro">
		<p class="portfolio-profile-hero__eyebrow">Independent Practice</p>
		<h1><?php echo $name; ?></h1>
		<p class="portfolio-profile-hero__role"><?php echo $role; ?></p>
	</div>
	<div class="portfolio-profile-hero__layout">
		<div class="portfolio-profile-hero__copy">
			<div class="portfolio-profile-hero__bio"><?php echo $bio; ?></div>
			<div class="portfolio-profile-hero__actions">
				<?php if ( $resume ) : ?>
					<a class="portfolio-profile-hero__action" href="<?php echo $resume; ?>">View Resume</a>
				<?php endif; ?>
				<a class="portfolio-profile-hero__action is-secondary" href="/work/">Selected Work</a>
			</div>
		</div>
		<aside class="portfolio-profile-hero__aside">
			<?php if ( $avatar_html ) : ?>
				<div class="portfolio-profile-hero__avatar"><?php echo $avatar_html; ?></div>
			<?php endif; ?>
			<dl class="portfolio-profile-hero__meta">
				<?php if ( $location ) : ?>
					<div>
						<dt>Location</dt>
						<dd><?php echo $location; ?></dd>
					</div>
				<?php endif; ?>
				<?php if ( $availability ) : ?>
					<div>
						<dt>Availability</dt>
						<dd><?php echo esc_html( $availability ); ?></dd>
					</div>
				<?php endif; ?>
			</dl>
		</aside>
	</div>
</section>
