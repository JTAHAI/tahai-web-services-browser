#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const fail = (message) => {
  console.error(`TAHAI_BROWSER_CHEVRON_OVERFLOW_VERIFY_FAIL=${message}`);
  process.exit(1);
};
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));

for (const rel of [
  'src/renderer/responsive-toolbar.ts',
  'src/renderer/styles/responsive-toolbar.css',
  'src/renderer/chromium-bookmarks.ts',
  'src/renderer/styles/chromium-bookmarks.css',
  'docs/chevron-overflow-shell-pass-03.md'
]) {
  if (!exists(rel)) fail(`missing ${rel}`);
}

const toolbarTs = read('src/renderer/responsive-toolbar.ts');
for (const token of [
  '&gt;',
  'toolbar-no-native-scrollbars',
  'toolbar.scrollWidth > toolbar.clientWidth',
  'targetCountForWidth',
  'moveToMenu',
  'restoreToToolbar'
]) {
  if (!toolbarTs.includes(token)) fail(`responsive toolbar missing token: ${token}`);
}

const toolbarCss = read('src/renderer/styles/responsive-toolbar.css');
for (const token of [
  'PASS 03 chevron-overflow shell cleanup',
  'display: flex !important',
  'overflow: hidden !important',
  'scrollbar-width: none',
  '.toolbar::-webkit-scrollbar',
  '.toolbar-overflow-toggle > span[aria-hidden="true"]'
]) {
  if (!toolbarCss.includes(token)) fail(`responsive toolbar css missing token: ${token}`);
}

const bookmarksTs = read('src/renderer/chromium-bookmarks.ts');
for (const token of [
  'chromium-bookmarks-chevron-rail',
  'chromium-bookmarks-strip',
  'chromium-bookmarks-rail-arrow',
  'scrollBookmarkRail',
  'updateBookmarkRailArrows',
  'strip.addEventListener(\'wheel\''
]) {
  if (!bookmarksTs.includes(token)) fail(`bookmarks chevron rail missing token: ${token}`);
}

const bookmarksCss = read('src/renderer/styles/chromium-bookmarks.css');
for (const token of [
  'PASS 03 chevron rail cleanup',
  '.chromium-bookmarks-chevron-rail',
  'grid-template-columns: auto minmax(0,1fr) auto',
  '.chromium-bookmarks-strip::-webkit-scrollbar',
  '.chromium-bookmarks-rail-arrow'
]) {
  if (!bookmarksCss.includes(token)) fail(`bookmarks chevron css missing token: ${token}`);
}

const pkg = JSON.parse(read('package.json').replace(/^\uFEFF/, ''));
if (pkg.scripts?.['verify:chevron-overflow'] !== 'node scripts/verify-chevron-overflow-shell.mjs') fail('package.json missing verify:chevron-overflow script');
if (!String(pkg.scripts?.['verify:release-blockers'] || '').includes('verify:chevron-overflow')) fail('verify:release-blockers does not include verify:chevron-overflow');

console.log('TAHAI_BROWSER_CHEVRON_OVERFLOW_VERIFY=OK');
process.exit(0);
