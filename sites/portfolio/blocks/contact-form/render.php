<?php
?>
<form class="portfolio-contact-form" data-portfolio-contact-form>
	<div class="portfolio-contact-form__row">
		<p>
			<label>Name</label>
			<input type="text" name="name" required />
		</p>

		<p>
			<label>Email</label>
			<input type="email" name="email" required />
		</p>
	</div>

	<p>
		<label>Company</label>
		<input type="text" name="company" />
	</p>

	<p>
		<label>Message</label>
		<textarea name="message" rows="7" required></textarea>
	</p>

	<div class="portfolio-contact-form__footer">
		<button type="submit">Send Inquiry</button>
		<div data-form-status></div>
	</div>
</form>
