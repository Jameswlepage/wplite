(() => {
	const sections = document.querySelectorAll('.e-mailing[data-mailing-endpoint]');

	sections.forEach((root) => {
		const form = root.querySelector('[data-mailing-form]');
		const status = root.querySelector('[data-mailing-status]');
		const endpoint = root.dataset.mailingEndpoint;
		const successMessage = root.dataset.mailingSuccess || "You're on the list.";
		if (!form || !endpoint) return;

		form.addEventListener('submit', async (event) => {
			event.preventDefault();
			const emailInput = form.querySelector('input[name="email"]');
			const submitButton = form.querySelector('button[type="submit"]');
			const email = (emailInput?.value || '').trim();

			if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
				status.textContent = 'Please enter a valid email.';
				status.dataset.state = 'error';
				emailInput?.focus();
				return;
			}

			submitButton.disabled = true;
			status.dataset.state = 'pending';
			status.textContent = 'Sending…';

			try {
				const response = await fetch(endpoint, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
					body: JSON.stringify({
						name: email,
						email: email,
						message: 'Mailing list signup',
						company: 'mailing_list',
					}),
				});

				const payload = await response.json().catch(() => ({}));
				if (!response.ok || payload.ok === false) {
					throw new Error('Request failed');
				}

				form.reset();
				status.textContent = successMessage;
				status.dataset.state = 'success';
				form.style.display = 'none';
			} catch (error) {
				status.textContent = 'Something went wrong. Try again in a moment.';
				status.dataset.state = 'error';
			} finally {
				submitButton.disabled = false;
			}
		});
	});
})();
