import fs from 'node:fs';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

function fail(message) {
  console.error(`PASS21_BOOKMARK_FOLDER_VIEW_FAIL=${message}`);
  process.exit(1);
}

const renderer = fs.readFileSync('src/renderer/chromium-bookmarks.ts', 'utf8');
const css = fs.readFileSync('src/renderer/styles/chromium-bookmarks.css', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

for (const token of [
  'function createFolderView',
  'function renderFolderView',
  'function openFolderAsTabs',
  'chromium-bookmarks-folder-view',
  'data-folder-action="open-tabs"',
  "if (node.type === 'folder') openFolder(node)",
  'closeFolderView();'
]) {
  if (!renderer.includes(token)) fail(`missing-renderer-token:${token}`);
}

for (const token of [
  'PASS 21: bookmark folder cards',
  '.chromium-bookmarks-folder-view',
  '.chromium-bookmarks-folder-view-node',
  '.chromium-bookmarks-folder-view-actions'
]) {
  if (!css.includes(token)) fail(`missing-css-token:${token}`);
}

if (renderer.includes('function openFolder(folder: BookmarkNode): void {\n    const bookmarks = allNodes(folder)')) {
  fail('folder-click-still-opens-all-tabs-directly');
}

if (pkg.scripts?.['verify:pass-21-bookmark-folder-view'] !== 'node scripts/verify-pass-21-bookmark-folder-view.mjs') {
  fail('missing-package-script');
}

if (!getReleaseBlockersContract(pkg).includes('verify:pass-21-bookmark-folder-view')) {
  fail('release-blockers-not-wired');
}

console.log('PASS21_BOOKMARK_FOLDER_VIEW_OK=1');
