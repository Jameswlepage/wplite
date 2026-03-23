<?php
?>
<form class="portfolio-contact-form" data-portfolio-contact-form>
	<p>
		<label>Name</label>
		<input type="text" name="name" required />
	</p>

	<p>
		<label>Email</label>
		<input type="email" name="email" required />
	</p>

	<p>
		<label>Company</label>
		<input type="text" name="company" />
	</p>

	<p>
		<label>Message</label>
		<textarea name="message" rows="6" required></textarea>
	</p>

	<p>
		<button type="submit">Send</button>
	</p>

	<div data-form-status></div>
</form>
