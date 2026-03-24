export const runtimeConfig = window.PORTFOLIO_LIGHT ?? {};
export const appBasePath = (() => {
  try {
    const url = new URL(runtimeConfig.appBase ?? '/app', window.location.origin);
    return url.pathname.replace(/\/$/, '') || '/app';
  } catch {
    return '/app';
  }
})();
export const wpRestRoot = (() => {
  try {
    const fallbackRoot = String(runtimeConfig.restRoot ?? '').replace(/portfolio\/v1\/?$/, '');
    const url = new URL(runtimeConfig.wpRestRoot ?? (fallbackRoot || '/wp-json/'), window.location.origin);
    return url.toString();
  } catch {
    return `${window.location.origin}/wp-json/`;
  }
})();
