<?php
?>
<form class="kanso-form" data-kanso-contact-form>
	<p>
		<label>Name</label>
		<input type="text" name="name" required />
	</p>

	<p>
		<label>Email</label>
		<input type="email" name="email" required />
	</p>

	<p>
		<label>Project type</label>
		<input type="text" name="project_type" placeholder="Residential, workspace, or sourcing" />
	</p>

	<p>
		<label>Message</label>
		<textarea name="message" rows="5" required></textarea>
	</p>

	<p>
		<button type="submit">Send inquiry</button>
	</p>

	<div data-form-status></div>
</form>
