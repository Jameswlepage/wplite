document.addEventListener('submit', async (event) => {
  const form = event.target.closest('[data-portfolio-contact-form]');
  if (!form) return;

  event.preventDefault();

  const status = form.querySelector('[data-form-status]');
  const payload = Object.fromEntries(new FormData(form).entries());

  status.textContent = 'Sending...';

  const response = await fetch('/wp-json/portfolio/v1/inquiry', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (response.ok) {
    form.reset();
    status.textContent = 'Thanks, your message has been sent.';
  } else {
    status.textContent = 'Something went wrong.';
  }
});
