<?php
/**
 * Mailing list block. Submits to /wp-json/portfolio/v1/inquiry
 * with source=mailing_list so entries land in the Inquiries list.
 */
$heading    = isset( $attributes['heading'] ) ? $attributes['heading'] : "Join the list.\nHear it first.";
$subheading = isset( $attributes['subheading'] ) ? $attributes['subheading'] : '';
$cta        = isset( $attributes['cta'] ) ? $attributes['cta'] : 'Sign me up →';
$success    = isset( $attributes['success'] ) ? $attributes['success'] : "You're on the list.";
$endpoint   = esc_url_raw( rest_url( 'portfolio/v1/inquiry' ) );
$wrapper    = get_block_wrapper_attributes( [ 'class' => 'e-mailing' ] );
?>
<section <?php echo $wrapper; ?>
	data-mailing-endpoint="<?php echo esc_attr( $endpoint ); ?>"
	data-mailing-success="<?php echo esc_attr( $success ); ?>"
	id="join"
>
	<div class="e-mailing__inner">
		<h2 class="e-mailing__heading"><?php echo nl2br( esc_html( $heading ) ); ?></h2>
		<?php if ( $subheading ) : ?>
			<p class="e-mailing__sub"><?php echo esc_html( $subheading ); ?></p>
		<?php endif; ?>

		<form class="e-mailing__form" data-mailing-form novalidate>
			<label class="screen-reader-text" for="e-mailing-email">Email</label>
			<input
				id="e-mailing-email"
				type="email"
				name="email"
				required
				autocomplete="email"
				placeholder="you@somewhere.fm"
			/>
			<button type="submit" class="e-mailing__button"><?php echo esc_html( $cta ); ?></button>
		</form>

		<p class="e-mailing__status" data-mailing-status aria-live="polite"></p>
	</div>
</section>
