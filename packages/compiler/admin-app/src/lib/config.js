export const runtimeConfig = window.PORTFOLIO_LIGHT ?? {};
export const appBasePath = (() => {
  try {
    const url = new URL(runtimeConfig.appBase ?? '/app', window.location.origin);
    return url.pathname.replace(/\/$/, '') || '/app';
  } catch {
    return '/app';
  }
})();

export function buildAppUrl(path = '/') {
  const base = new URL(`${appBasePath.replace(/\/$/, '')}/`, window.location.origin);
  const next = new URL(String(path || '/').replace(/^\/+/, ''), base);

  if (!next.pathname.endsWith('/')) {
    next.pathname = `${next.pathname}/`;
  }

  return next.toString();
}

function buildWpAdminBaseUrl(path = '/wp-admin/') {
  const normalizedPath = String(path || '/wp-admin/').trim();
  const adminPath = normalizedPath.startsWith('/wp-admin')
    ? normalizedPath
    : `/wp-admin/${normalizedPath.replace(/^\/+/, '')}`;
  return new URL(adminPath, window.location.origin);
}

export function buildClassicAdminUrl(path = '/wp-admin/', { appPath = '/', searchParams = {} } = {}) {
  const url = buildWpAdminBaseUrl(path);
  url.searchParams.set('classic-admin', '1');

  const returnUrl = appPath ? buildAppUrl(appPath) : '';
  if (returnUrl) {
    url.searchParams.set('wplite-return', returnUrl);
  }

  Object.entries(searchParams ?? {}).forEach(([key, value]) => {
    if (value == null || value === '') return;
    url.searchParams.set(key, String(value));
  });

  return url.toString();
}

export function buildPostEditorUrl(postId, { appPath = '/' } = {}) {
  return buildClassicAdminUrl('/wp-admin/post.php', {
    appPath,
    searchParams: {
      post: postId,
      action: 'edit',
    },
  });
}

export function buildSiteEditorUrl({ postType = 'wp_template', postId, canvas = 'edit', appPath = '/' } = {}) {
  return buildClassicAdminUrl('/wp-admin/site-editor.php', {
    appPath,
    searchParams: {
      postType,
      ...(postId ? { postId } : {}),
      ...(canvas ? { canvas } : {}),
    },
  });
}

export function normalizeAppPath(path = '/') {
  const raw = String(path || '/').trim();
  if (!raw || raw === '/') {
    return '/';
  }

  try {
    const resolved = new URL(raw, window.location.origin);
    const base = appBasePath.replace(/\/$/, '');
    let pathname = resolved.pathname || '/';

    if (pathname === base) {
      pathname = '/';
    } else if (pathname.startsWith(`${base}/`)) {
      pathname = pathname.slice(base.length) || '/';
    }

    pathname = `/${pathname}`.replace(/\/+/g, '/');
    if (pathname.length > 1) {
      pathname = pathname.replace(/\/+$/, '');
    }

    return `${pathname}${resolved.search}${resolved.hash}`;
  } catch {
    const [pathnamePart, suffix = ''] = raw.split(/(?=[?#])/);
    let pathname = pathnamePart.startsWith('/') ? pathnamePart : `/${pathnamePart}`;
    if (pathname.length > 1) {
      pathname = pathname.replace(/\/+$/, '');
    }
    return `${pathname}${suffix}`;
  }
}

export const wpRestRoot = (() => {
  try {
    const fallbackRoot = String(runtimeConfig.restRoot ?? '').replace(/portfolio\/v1\/?$/, '');
    const url = new URL(runtimeConfig.wpRestRoot ?? (fallbackRoot || '/wp-json/'), window.location.origin);
    return url.toString();
  } catch {
    return `${window.location.origin}/wp-json/`;
  }
})();
