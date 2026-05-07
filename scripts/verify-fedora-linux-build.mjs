#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const fail = (message) => {
  console.error(`TAHAI_BROWSER_FEDORA_LINUX_BUILD_VERIFY_FAIL=${message}`);
  process.exit(1);
};
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/^\uFEFF/, '');
const exists = (rel) => fs.existsSync(path.join(root, rel));
if (!exists('package.json')) fail('package.json not found');
if (!exists('electron-builder.yml')) fail('electron-builder.yml not found');
const pkg = JSON.parse(read('package.json'));
for (const script of ['package:linux:appimage', 'package:linux:rpm', 'package:linux:fedora', 'verify:fedora-linux-build']) {
  if (!pkg.scripts || typeof pkg.scripts[script] !== 'string') fail(`missing npm script: ${script}`);
}
const builder = read('electron-builder.yml');
for (const token of ['linux:', 'target:', 'AppImage', 'rpm', 'category: Network']) {
  if (!builder.includes(token)) fail(`electron-builder.yml missing ${token}`);
}
for (const rel of ['src/renderer/app.ts', 'src/renderer/index.html', 'src/renderer/styles/browser.css']) {
  if (!exists(rel)) fail(`missing renderer file: ${rel}`);
}
const app = read('src/renderer/app.ts');
for (const token of ['quad', '4-Up Quad', 'Mission Control']) {
  if (!app.includes(token)) fail(`Quad View/Mission Control token missing from renderer: ${token}`);
}
if (exists('src/renderer/site-view-mission-rail.ts')) {
  const rail = read('src/renderer/site-view-mission-rail.ts');
  for (const token of ['Site View Mission Rail', 'Ctrl+Alt+V']) {
    if (!rail.includes(token)) fail(`Site View Mission Rail token missing: ${token}`);
  }
}
console.log('TAHAI_BROWSER_FEDORA_LINUX_BUILD_VERIFY=OK');
process.exit(0);
