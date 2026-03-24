document.querySelectorAll('[data-filter-chip]').forEach((chip) => {
  if (chip.href === window.location.href) {
    chip.setAttribute('aria-current', 'page');
  }
});
