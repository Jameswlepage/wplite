const DEFAULT_CORE_CAPABILITIES = Object.freeze({
  pages: true,
  posts: true,
  media: true,
});

function normalizeBooleanFlag(value, fallback = true) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      return true;
    }

    if (['0', 'false', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

export function normalizeCoreCapabilities(rawCapabilities = {}) {
  const source =
    rawCapabilities && typeof rawCapabilities === 'object'
      ? rawCapabilities.core && typeof rawCapabilities.core === 'object'
        ? rawCapabilities.core
        : rawCapabilities
      : {};

  return Object.fromEntries(
    Object.entries(DEFAULT_CORE_CAPABILITIES).map(([key, fallback]) => [
      key,
      normalizeBooleanFlag(source[key], fallback),
    ])
  );
}

export function normalizeSiteConfig(site = {}) {
  return {
    ...site,
    capabilities: normalizeCoreCapabilities(site.capabilities),
  };
}

export function siteHasCapability(site = {}, capability) {
  return normalizeCoreCapabilities(site.capabilities)[capability] !== false;
}

export { DEFAULT_CORE_CAPABILITIES };
