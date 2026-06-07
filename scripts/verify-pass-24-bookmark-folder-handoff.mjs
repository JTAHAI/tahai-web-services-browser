import fs from 'node:fs';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

function fail(message) {
  console.error(`PASS24_BOOKMARK_FOLDER_HANDOFF_FAIL=${message}`);
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const src = fs.readFileSync('src/renderer/chromium-bookmarks.ts', 'utf8');
const css = fs.readFileSync('src/renderer/styles/chromium-bookmarks.css', 'utf8');

for (const token of [
  'function folderMarkdown',
  'function copyTextToClipboard',
  'function copyFolderUrls',
  'function copyFolderMarkdown',
  'data-folder-action="copy-urls"',
  'data-folder-action="copy-markdown"',
  "key === 'c' && folderViewNode",
  'document.execCommand(\'copy\')'
]) {
  if (!src.includes(token)) fail(`missing-source-token:${token}`);
}

for (const token of [
  'PASS 24: bookmark folder handoff actions',
  'grid-template-columns: minmax(0,1fr) repeat(3, auto)',
  '@media (max-width: 720px)'
]) {
  if (!css.includes(token)) fail(`missing-css-token:${token}`);
}

if (pkg.scripts?.['verify:pass-24-bookmark-folder-handoff'] !== 'node scripts/verify-pass-24-bookmark-folder-handoff.mjs') fail('package-script-missing');
if (!getReleaseBlockersContract(pkg).includes('verify:pass-24-bookmark-folder-handoff')) fail('release-blockers-not-wired');

console.log('PASS24_BOOKMARK_FOLDER_HANDOFF_OK=1');
