// Root & generated-path resolution for the compiler.
import path from 'node:path';
import process from 'node:process';

export function resolveRoot() {
  const idx = process.argv.indexOf('--root');
  if (idx !== -1 && process.argv[idx + 1]) {
    return path.resolve(process.argv[idx + 1]);
  }
  return process.cwd();
}

export function resolvePaths(root, site = {}) {
  const generatedRoot = path.join(root, 'generated');
  const wpContentRoot = path.join(generatedRoot, 'wp-content');
  const pluginSlug = site.plugin?.slug ?? 'wp-lite-app';
  const themeSlug = site.theme?.slug ?? 'wp-lite-theme';
  return {
    root,
    generatedRoot,
    wpContentRoot,
    pluginRoot: path.join(wpContentRoot, 'plugins', pluginSlug),
    themeRoot: path.join(wpContentRoot, 'themes', themeSlug),
    adminSchemaRoot: path.join(generatedRoot, 'admin-schema'),
  };
}
