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
if (!html.includes('./styles/chromium-bookmarks.css')) fail('index.html missing chromium-bookmarks.css stylesheet link');
if (!html.includes('./styles/chromium-bookmarks.css')) fail('index.html missing chromium-bookmarks.css stylesheet');

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
  'bookmarks bar',
  'parseSafeBookmarkUrl',
  'BLOCKED_PROTOCOL_PATTERN',
  'MAX_IMPORT_BYTES',
  'MAX_BOOKMARK_NODES',
  'Blocked unsafe bookmark URL',
  'DEFAULT_BOOKMARK_FOLDERS',
  'ensureDefaultBookmarkFolders',
  'IT Admin',
  'Microsoft 365 Admin',
  'Microsoft Entra Admin',
  'Google Admin Console',
  'CISA Known Exploited Vulnerabilities'
]) {
  if (!ts.includes(token)) fail(`chromium bookmarks renderer missing token: ${token}`);
}
for (const token of [
  'bookmarkMatchesDefault',
  'ensureDefaultFolderBookmarks',
  'normalizeUrl(bookmark.url)'
]) {
  if (!ts.includes(token)) fail(`chromium bookmarks default repair missing token: ${token}`);
}

for (const forbidden of ['Authorization', 'Bearer ', 'cookie:get-all', 'auth:get-token', 'secret:get']) {
  if (ts.includes(forbidden)) fail(`bookmarks renderer contains forbidden token: ${forbidden}`);
}
for (const blockedProtocol of ['javascript', 'data', 'vbscript', 'file', 'chrome', 'devtools']) {
  if (!ts.includes(blockedProtocol)) fail(`bookmarks renderer does not explicitly block ${blockedProtocol} URLs`);
}

const css = read('src/renderer/styles/chromium-bookmarks.css');
for (const token of [
  '.chromium-bookmarks-bar',
  '.chromium-bookmarks-menu',
  '.chromium-bookmarks-manager',
  'grid-template-rows',
  'chromium-bookmarks-bar-visible',
  'overflow-x: auto',
  'Pass 1.8.8A'
]) {
  if (!css.includes(token)) fail(`chromium bookmarks css missing token: ${token}`);
}


const seedBookmarks = JSON.parse(read('browser/bookmarks/bookmarks.json').replace(/^\uFEFF/, ''));
const bookmarkBar = seedBookmarks?.roots?.bookmark_bar?.children || [];
const itAdmin = bookmarkBar.find((node) => node?.type === 'folder' && node?.name === 'IT Admin');
if (!itAdmin) fail('default Chromium seed bookmarks missing IT Admin folder');
for (const required of ['Microsoft 365 Admin', 'Microsoft Entra Admin', 'Google Admin Console', 'Cloudflare Dashboard', 'CISA KEV Catalog', 'MXToolbox', 'ICANN Lookup']) {
  if (!String(JSON.stringify(itAdmin)).includes(required)) fail('IT Admin seed folder missing ' + required);
}
for (const requiredUrl of ['https://admin.microsoft.com', 'https://entra.microsoft.com', 'https://admin.google.com', 'https://dash.cloudflare.com', 'https://mxtoolbox.com', 'https://lookup.icann.org']) {
  if (!String(JSON.stringify(itAdmin)).includes(requiredUrl)) fail('IT Admin seed folder missing ' + requiredUrl);
}

console.log('TAHAI_BROWSER_CHROMIUM_BOOKMARKS_VERIFY=OK');
process.exit(0);