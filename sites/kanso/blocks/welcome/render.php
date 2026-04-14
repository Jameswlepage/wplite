<?php
$site      = portfolio_light_get_site_config();
$title     = $site['title'] ?? get_bloginfo( 'name' );
$tagline   = $site['tagline'] ?? get_bloginfo( 'description' );
$hour      = (int) wp_date( 'G' );
$greeting  = $hour < 12 ? 'Good morning' : ( $hour < 18 ? 'Good afternoon' : 'Good evening' );
$site_url  = home_url( '/' );
?>
<div class="welcome-hero">
	<div class="welcome-hero__text">
		<span class="welcome-hero__eyebrow"><?php echo esc_html( $greeting ); ?></span>
		<h1 class="welcome-hero__title"><?php echo esc_html( $title ); ?></h1>
		<?php if ( $tagline ) : ?>
		<p class="welcome-hero__tagline"><?php echo esc_html( $tagline ); ?></p>
		<?php endif; ?>
	</div>
	<div class="welcome-hero__actions">
		<a class="components-button is-primary" href="<?php echo esc_url( $site_url ); ?>" target="_blank" rel="noopener">View site</a>
	</div>
</div>
