<?php
$profile = get_option( 'portfolio_singleton_profile', [] );
if ( empty( $profile ) ) {
	return;
}

$name     = esc_html( $profile['founder_name'] ?? '' );
$role     = esc_html( $profile['founder_role'] ?? '' );
$bio      = wp_kses_post( $profile['short_bio'] ?? '' );
$location = esc_html( $profile['location'] ?? '' );
$year     = esc_html( $profile['founded_year'] ?? '' );
$avatar   = $profile['avatar'] ?? 0;
$img_url  = $avatar ? wp_get_attachment_image_url( $avatar, 'large' ) : '';
?>
<div class="kanso-profile">
	<?php if ( $img_url ) : ?>
	<img src="<?php echo esc_url( $img_url ); ?>" alt="<?php echo $name; ?>" />
	<?php else : ?>
	<div style="background:var(--wp--preset--color--linen);aspect-ratio:3/4"></div>
	<?php endif; ?>

	<div class="kanso-profile__text">
		<p class="kicker">Founder</p>
		<h2><?php echo $name; ?></h2>
		<?php if ( $role ) : ?>
		<p class="role"><?php echo $role; ?></p>
		<?php endif; ?>
		<div><?php echo $bio; ?></div>
		<?php if ( $location ) : ?>
		<p style="font-size:0.875rem;color:var(--wp--preset--color--muted)"><?php echo $location; ?><?php echo $year ? " — Est. {$year}" : ''; ?></p>
		<?php endif; ?>
	</div>
</div>
