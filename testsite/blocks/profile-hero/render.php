<?php
$profile = get_option( 'portfolio_singleton_profile', [] );

$name   = esc_html( $profile['full_name'] ?? '' );
$role   = esc_html( $profile['role_line'] ?? '' );
$bio    = wp_kses_post( $profile['short_bio'] ?? '' );
$resume = esc_url( $profile['resume_url'] ?? '' );
?>

<section class="portfolio-profile-hero">
	<h1><?php echo $name; ?></h1>
	<p><?php echo $role; ?></p>
	<div><?php echo $bio; ?></div>

	<?php if ( $resume ) : ?>
		<p><a href="<?php echo $resume; ?>">View Resume</a></p>
	<?php endif; ?>
</section>
