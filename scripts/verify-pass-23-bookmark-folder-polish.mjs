import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const fail = (message) => { console.error(`FAIL: ${message}`); process.exit(1); };

const pkg = JSON.parse(read('package.json'));
const bookmarks = read('src/renderer/chromium-bookmarks.ts');
const css = read('src/renderer/styles/chromium-bookmarks.css');

if (pkg.scripts?.['verify:pass-23-bookmark-folder-polish'] !== 'node scripts/verify-pass-23-bookmark-folder-polish.mjs') fail('package script missing');
if (!String(pkg.scripts?.['verify:release-blockers'] || '').includes('verify:pass-23-bookmark-folder-polish')) fail('release blockers do not include pass 23 verifier');
for (const marker of [
  'LAST_OPEN_FOLDER_KEY',
  'lastOpenFolder()',
  'reopenLastFolder()',
  'data-bm-action="reopen-last-folder"',
  'folderSearchTerm',
  'normalizedFolderSearch',
  'visibleChildren',
  'chromium-bookmarks-folder-search',
  "key === 'l'"
]) {
  if (!bookmarks.includes(marker)) fail(`bookmark source missing ${marker}`);
}
if (!css.includes('PASS 23: bookmark folder persistence and in-folder filtering')) fail('pass 23 CSS anchor missing');
if (!css.includes('.chromium-bookmarks-folder-search input')) fail('folder filter CSS missing');
console.log('PASS23_BOOKMARK_FOLDER_POLISH_OK=1');
