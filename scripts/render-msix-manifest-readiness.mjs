#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const configPath = path.join(root, 'config', 'msix-store-readiness.example.json');
const templatePath = path.join(root, 'config', 'msix-manifest.template.xml');
const pkgPath = path.join(root, 'package.json');
const outArg = process.argv.find((arg) => arg.startsWith('--output='));
const output = outArg ? outArg.slice('--output='.length) : null;

function fail(message) {
  console.error(`[PASS247][FAIL] ${message}`);
  process.exit(1);
}
for (const rel of [configPath, templatePath, pkgPath]) if (!fs.existsSync(rel)) fail(`Missing ${path.relative(root, rel)}`);
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
let manifest = fs.readFileSync(templatePath, 'utf8');
if (pkg.version !== config.version) fail(`package version ${pkg.version} does not match MSIX readiness version ${config.version}`);
if (!manifest.includes(`Version="${pkg.version}.0"`)) fail(`manifest template must use ${pkg.version}.0 four-part MSIX version`);
const requiredAssets = ['Square44x44Logo.png','Square71x71Logo.png','Square150x150Logo.png','Square310x310Logo.png','Wide310x150Logo.png','StoreLogo.png','SplashScreen.png'];
for (const asset of requiredAssets) {
  const rel = path.join('assets', 'store', 'windows', asset);
  if (!fs.existsSync(path.join(root, rel))) fail(`Missing Store/MSIX asset ${rel}`);
}
if (output) {
  const full = path.resolve(root, output);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, manifest, 'utf8');
  console.log(`[PASS247][OK] Rendered MSIX manifest readiness file: ${path.relative(root, full)}`);
} else {
  console.log('[PASS247][OK] MSIX manifest readiness template, version, and assets are coherent. Use --output=<path> to render a working manifest outside committed source.');
}
