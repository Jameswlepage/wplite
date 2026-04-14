<?php
$site     = function_exists( 'portfolio_light_get_site_config' ) ? portfolio_light_get_site_config() : [];
$title    = $site['title'] ?? get_bloginfo( 'name' );
$tagline  = $site['tagline'] ?? get_bloginfo( 'description' );
$hour     = (int) wp_date( 'G' );
$greeting = $hour < 12 ? 'Good morning' : ( $hour < 18 ? 'Good afternoon' : 'Good evening' );
$site_url = home_url( '/' );

$total_entries = (int) wp_count_posts( 'note' )->publish;

$places = get_posts( [
	'post_type'      => 'note',
	'post_status'    => 'publish',
	'posts_per_page' => -1,
	'fields'         => 'ids',
] );
$place_set = [];
foreach ( $places as $pid ) {
	$p = get_post_meta( $pid, 'place', true );
	if ( $p ) { $place_set[ $p ] = true; }
}
$distinct_places = count( $place_set );

$latest = get_posts( [ 'post_type' => 'note', 'post_status' => 'publish', 'posts_per_page' => 1 ] );
$last_observed = '';
if ( $latest ) {
	$stamp = get_post_meta( $latest[0]->ID, 'observed_on', true );
	$ts = $stamp ? strtotime( $stamp ) : 0;
	$last_observed = $ts ? strtoupper( date( 'd M Y', $ts ) ) : strtoupper( $stamp );
}
?>
<div class="welcome-hero">
	<div class="welcome-hero__text">
		<span class="welcome-hero__eyebrow"><?php echo esc_html( $greeting ); ?></span>
		<h1 class="welcome-hero__title"><?php echo esc_html( $title ); ?></h1>
		<?php if ( $tagline ) : ?>
			<p class="welcome-hero__tagline"><?php echo esc_html( $tagline ); ?></p>
		<?php endif; ?>
		<p class="welcome-hero__stats">
			<strong><?php echo (int) $total_entries; ?></strong> entries
			<span aria-hidden="true"> · </span>
			<strong><?php echo (int) $distinct_places; ?></strong> places
			<?php if ( $last_observed ) : ?>
				<span aria-hidden="true"> · </span>
				last observed <?php echo esc_html( $last_observed ); ?>
			<?php endif; ?>
		</p>
	</div>
	<div class="welcome-hero__actions">
		<a class="components-button is-primary" href="<?php echo esc_url( $site_url ); ?>" target="_blank" rel="noopener">Open the journal</a>
	</div>
</div>
