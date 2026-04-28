#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const fail = (message) => {
  console.error(`TAHAI_BROWSER_CHROMIUM_BOOKMARKS_VERIFY_FAIL=${message}`);
  process.exit(1);
};
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));

for (const rel of [
  'src/renderer/chromium-bookmarks.ts',
  'src/renderer/styles/chromium-bookmarks.css',
  'docs/chromium-bookmarks-menu.md'
]) {
  if (!exists(rel)) fail(`missing ${rel}`);
}

const pkg = JSON.parse(read('package.json').replace(/^\uFEFF/, ''));
if (pkg.scripts?.['verify:chromium-bookmarks'] !== 'node scripts/verify-chromium-bookmarks.mjs') {
  fail('package.json missing verify:chromium-bookmarks script');
}
if (!String(pkg.scripts?.['verify:release-blockers'] || '').includes('verify:chromium-bookmarks')) {
  fail('verify:release-blockers does not include verify:chromium-bookmarks');
}

const html = read('src/renderer/index.html');
if (!html.includes('chromium-bookmarks.js')) fail('index.html missing chromium-bookmarks.js script tag');

const ts = read('src/renderer/chromium-bookmarks.ts');
for (const token of [
  'Chromium Bookmarks',
  'chromium-bookmarks-bar',
  'Ctrl+Shift+B',
  'Ctrl+Shift+O',
  'Ctrl+D',
  'Bookmark Manager',
  'Import',
  'Export',
  'localStorage',
  'migrateLegacyStore',
  'bookmarks bar'
]) {
  if (!ts.includes(token)) fail(`chromium bookmarks renderer missing token: ${token}`);
}
for (const forbidden of ['Authorization', 'Bearer ', 'cookie:get-all', 'auth:get-token', 'secret:get']) {
  if (ts.includes(forbidden)) fail(`bookmarks renderer contains forbidden token: ${forbidden}`);
}

const css = read('src/renderer/styles/chromium-bookmarks.css');
for (const token of [
  '.chromium-bookmarks-bar',
  '.chromium-bookmarks-menu',
  '.chromium-bookmarks-manager',
  'grid-template-rows',
  'chromium-bookmarks-bar-visible'
]) {
  if (!css.includes(token)) fail(`chromium bookmarks css missing token: ${token}`);
}

console.log('TAHAI_BROWSER_CHROMIUM_BOOKMARKS_VERIFY=OK');
process.exit(0);
