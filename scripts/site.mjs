#!/usr/bin/env node
/**
 * Generic site runner. Discovers sites from sites/* and runs any script
 * defined in that site's package.json.
 *
 *   npm run site                       → list sites + available scripts
 *   npm run site <name>                → list that site's scripts
 *   npm run site <name> <script> ...   → run one or more scripts in order
 *
 * Example:
 *   npm run site field-notes dev
 *   npm run site field-notes build apply
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sitesDir = join(root, "sites");

function discoverSites() {
	if (!existsSync(sitesDir)) return [];
	return readdirSync(sitesDir)
		.filter((name) => {
			const pkg = join(sitesDir, name, "package.json");
			return existsSync(pkg) && statSync(join(sitesDir, name)).isDirectory();
		})
		.map((name) => {
			const pkg = JSON.parse(readFileSync(join(sitesDir, name, "package.json"), "utf8"));
			return { name, pkgName: pkg.name, scripts: Object.keys(pkg.scripts || {}) };
		});
}

function printSites(sites) {
	if (!sites.length) {
		console.log("No sites found under sites/*.");
		return;
	}
	console.log("Available sites:\n");
	for (const s of sites) {
		console.log(`  ${s.name.padEnd(16)} ${s.pkgName}`);
		console.log(`  ${" ".repeat(16)} scripts: ${s.scripts.join(", ") || "(none)"}\n`);
	}
	console.log("Usage:");
	console.log("  npm run site <name> <script> [script ...]");
}

const sites = discoverSites();
const [siteName, ...scripts] = process.argv.slice(2);

if (!siteName) {
	printSites(sites);
	process.exit(0);
}

const site = sites.find((s) => s.name === siteName || s.pkgName === siteName);
if (!site) {
	console.error(`Unknown site: ${siteName}`);
	console.error(`Known: ${sites.map((s) => s.name).join(", ") || "(none)"}`);
	process.exit(1);
}

if (!scripts.length) {
	console.log(`${site.pkgName} scripts: ${site.scripts.join(", ") || "(none)"}`);
	process.exit(0);
}

for (const script of scripts) {
	if (!site.scripts.includes(script)) {
		console.error(`${site.pkgName} has no script "${script}". Available: ${site.scripts.join(", ")}`);
		process.exit(1);
	}
	const res = spawnSync(
		"npm",
		["run", script, "-w", site.pkgName],
		{ stdio: "inherit", cwd: root }
	);
	if (res.status !== 0) process.exit(res.status ?? 1);
}
