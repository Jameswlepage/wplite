// Orchestration helpers that turn generator functions into files on disk.
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

import { pluginMainFile } from './php/plugin-main.mjs';
import { phpHelpersFile } from './php/helpers.mjs';
import { phpRegisterPostTypesFile } from './php/register-post-types.mjs';
import { phpRegisterTaxonomiesFile } from './php/register-taxonomies.mjs';
import { phpRegisterMetaFile } from './php/register-meta.mjs';
import { phpRegisterSingletonsFile } from './php/register-singletons.mjs';
import { phpRegisterHeadFile } from './php/register-head.mjs';
import { phpRegisterRestFile } from './php/register-rest.mjs';
import { phpRegisterAdminAppFile } from './php/register-admin-app.mjs';
import { phpRegisterFrontendLauncherFile, frontendLauncherCss, frontendLauncherJs } from './php/register-frontend-launcher.mjs';
import { phpRegisterLoginStyleFile, loginStyleCss } from './php/register-login-style.mjs';
import { phpSeedFile } from './php/seed.mjs';

async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

export async function writeStaticAssets(pluginDir) {
  const assetsDir = path.join(pluginDir, 'assets');
  await ensureDir(assetsDir);
  await writeFile(path.join(assetsDir, 'login.css'), loginStyleCss());
  await writeFile(path.join(assetsDir, 'frontend-launcher.css'), frontendLauncherCss());
  await writeFile(path.join(assetsDir, 'frontend-launcher.js'), frontendLauncherJs());
}

export async function writeGeneratedPlugin(siteSchema, adminSchemas, site, paths) {
  const incDir = path.join(paths.pluginRoot, 'inc');
  const compiledDir = path.join(paths.pluginRoot, 'compiled');
  const compiledAdminDir = path.join(compiledDir, 'admin-schema');

  await ensureDir(incDir);
  await ensureDir(compiledAdminDir);
  await ensureDir(path.join(paths.pluginRoot, 'build'));

  const pluginSlug = site.plugin?.slug ?? 'wp-light-app';
  await writeFile(path.join(paths.pluginRoot, `${pluginSlug}.php`), pluginMainFile(site));
  await writeFile(path.join(incDir, 'helpers.php'), phpHelpersFile());
  await writeFile(path.join(incDir, 'register-post-types.php'), phpRegisterPostTypesFile());
  await writeFile(path.join(incDir, 'register-taxonomies.php'), phpRegisterTaxonomiesFile());
  await writeFile(path.join(incDir, 'register-meta.php'), phpRegisterMetaFile());
  await writeFile(path.join(incDir, 'register-singletons.php'), phpRegisterSingletonsFile());
  await writeFile(path.join(incDir, 'register-head.php'), phpRegisterHeadFile());
  await writeFile(path.join(incDir, 'register-rest.php'), phpRegisterRestFile());
  await writeFile(path.join(incDir, 'register-admin-app.php'), phpRegisterAdminAppFile());
  await writeFile(path.join(incDir, 'register-login-style.php'), phpRegisterLoginStyleFile());
  await writeFile(path.join(incDir, 'register-frontend-launcher.php'), phpRegisterFrontendLauncherFile());
  await writeFile(path.join(incDir, 'seed.php'), phpSeedFile());
  await writeStaticAssets(paths.pluginRoot);
  await writeFile(
    path.join(compiledDir, 'site-schema.json'),
    JSON.stringify(siteSchema, null, 2)
  );
  await writeFile(
    path.join(compiledDir, 'dev-state.json'),
    `${JSON.stringify({ enabled: false, version: null, heartbeatAt: null }, null, 2)}\n`
  );

  for (const [fileName, schema] of Object.entries(adminSchemas)) {
    await writeFile(
      path.join(compiledAdminDir, fileName),
      JSON.stringify(schema, null, 2)
    );
  }

  await cp(path.join(paths.root, 'blocks'), path.join(paths.pluginRoot, 'blocks'), {
    recursive: true,
  });
  await writeFile(path.join(paths.pluginRoot, 'build', '.gitkeep'), '');
}

export async function hashPath(target) {
  const hash = createHash('sha1');
  async function walk(p) {
    try {
      const entries = await readdir(p, { withFileTypes: true });
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
        const full = path.join(p, entry.name);
        hash.update(entry.name + (entry.isDirectory() ? '/' : ''));
        if (entry.isDirectory()) {
          await walk(full);
        } else if (entry.isFile()) {
          hash.update(await readFile(full));
        }
      }
      return;
    } catch (err) {
      if (err.code === 'ENOTDIR') {
        try {
          hash.update(await readFile(p));
        } catch {}
        return;
      }
      if (err.code !== 'ENOENT') throw err;
    }
  }
  await walk(target);
  return hash.digest('hex');
}
