export function wordpressIconSvg({ width = 16, height = 16, className = '' } = {}) {
  const classAttr = className ? ` class="${className}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 122.52 122.523" width="${width}" height="${height}" aria-hidden="true" focusable="false"${classAttr}><path fill="currentColor" d="M8.708 61.26c0 20.802 12.089 38.779 29.619 47.298L13.258 39.872a52.32 52.32 0 0 0-4.55 21.388zm90.061-2.713c0-6.495-2.333-10.993-4.334-14.494-2.664-4.329-5.161-7.995-5.161-12.324 0-4.831 3.664-9.328 8.825-9.328.233 0 .454.029.681.042-9.35-8.566-21.807-13.796-35.489-13.796-18.36 0-34.513 9.42-43.91 23.688 1.233.037 2.395.063 3.382.063 5.497 0 14.006-.667 14.006-.667 2.833-.167 3.167 3.994.337 4.329 0 0-2.847.335-6.015.501l19.138 56.925 11.501-34.493-8.188-22.434c-2.83-.166-5.511-.5-5.511-.5-2.832-.166-2.5-4.496.332-4.329 0 0 8.679.667 13.843.667 5.496 0 14.006-.667 14.006-.667 2.835-.167 3.168 3.994.337 4.329 0 0-2.853.335-6.015.501l18.992 56.494 5.242-17.517c2.272-7.269 4.001-12.49 4.001-16.988zM64.087 65.796l-15.768 45.819c4.708 1.384 9.687 2.141 14.851 2.141 6.125 0 11.999-1.058 17.465-2.979-.141-.225-.269-.464-.374-.724l-16.174-44.257zm45.304-29.877c.226 1.674.354 3.471.354 5.404 0 5.333-.996 11.328-3.996 18.824l-16.053 46.413c15.624-9.111 26.133-26.038 26.133-45.426.002-9.137-2.333-17.729-6.438-25.215zM61.262 0C27.484 0 0 27.482 0 61.26c0 33.783 27.484 61.263 61.262 61.263 33.778 0 61.265-27.48 61.265-61.263C122.526 27.482 95.039 0 61.262 0zm0 119.715c-32.23 0-58.453-26.223-58.453-58.455 0-32.23 26.222-58.451 58.453-58.451 32.229 0 58.45 26.221 58.45 58.451 0 32.232-26.221 58.455-58.45 58.455z"/></svg>`;
}

export function launcherIconSvg(kind, { size = 16, className = '' } = {}) {
  const classAttr = className ? ` class="${className}"` : '';

  if (kind === 'edit') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false"${classAttr}><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75zm2.92 2.33H5v-.92l8.06-8.06.92.92zM20.71 7.04a1.003 1.003 0 0 0 0-1.42L18.37 3.29a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75z"/></svg>`;
  }

  if (kind === 'admin') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false"${classAttr}><path fill="currentColor" d="M3 3h8v8H3zm10 0h8v5h-8zM3 13h5v8H3zm7 0h11v8H10zM5 5v4h4V5zm10 0v1h4V5zm-10 10v4h1v-4zm7 0v4h7v-4z"/></svg>`;
  }

  if (kind === 'account') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false"${classAttr}><path fill="currentColor" d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4m0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5m0-8a2 2 0 1 1-2 2 2 2 0 0 1 2-2m-6 12c.55-1.57 3.03-3 6-3s5.45 1.43 6 3z"/></svg>`;
  }

  if (kind === 'search') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false"${classAttr}><path fill="currentColor" d="M10 2a8 8 0 1 0 4.9 14.33l4.38 4.38a1 1 0 0 0 1.41-1.41l-4.38-4.38A8 8 0 0 0 10 2m0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12"/></svg>`;
  }

  return '';
}
