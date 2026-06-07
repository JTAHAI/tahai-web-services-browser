import fs from 'node:fs';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

function fail(message) {
  console.error(`PASS22_BOOKMARK_FOLDER_NAV_HARDENING_FAIL=${message}`);
  process.exit(1);
}

const renderer = fs.readFileSync('src/renderer/chromium-bookmarks.ts', 'utf8');
const css = fs.readFileSync('src/renderer/styles/chromium-bookmarks.css', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

for (const token of [
  'let folderViewReturnFocus',
  'function getFolderPath',
  'function getParentFolder',
  'function openFolderById',
  'function openParentFolder',
  'data-folder-action="up"',
  'data-folder-target',
  'chromium-bookmarks-breadcrumbs',
  "event.key === 'Backspace'",
  "event.key === 'Enter' && folderViewNode",
  'folderViewReturnFocus = null',
  'openFolder(node, button)',
  "className = 'mini danger'"
]) {
  if (!renderer.includes(token)) fail(`missing-renderer-token:${token}`);
}

for (const token of [
  'PASS 22: bookmark folder navigation hardening',
  '.chromium-bookmarks-breadcrumbs',
  '.chromium-bookmarks-crumb',
  '.chromium-bookmarks-folder-view-node .mini.danger',
  'grid-template-columns: minmax(0,1fr) auto auto auto'
]) {
  if (!css.includes(token)) fail(`missing-css-token:${token}`);
}

if (pkg.scripts?.['verify:pass-22-bookmark-folder-nav-hardening'] !== 'node scripts/verify-pass-22-bookmark-folder-nav-hardening.mjs') {
  fail('missing-package-script');
}

if (!getReleaseBlockersContract(pkg).includes('verify:pass-22-bookmark-folder-nav-hardening')) {
  fail('release-blockers-not-wired');
}

console.log('PASS22_BOOKMARK_FOLDER_NAV_HARDENING_OK=1');
