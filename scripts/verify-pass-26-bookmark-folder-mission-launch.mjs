#!/usr/bin/env node
import fs from 'node:fs';

const app = fs.readFileSync('src/renderer/app.ts', 'utf8');
const bookmarks = fs.readFileSync('src/renderer/chromium-bookmarks.ts', 'utf8');
const pkg = fs.readFileSync('package.json', 'utf8');

const required = [
  ['bookmark custom event dispatched', bookmarks.includes("tahai-browser:start-mission-from-bookmark-folder")],
  ['folder view Start Mission action', bookmarks.includes('data-folder-action="start-mission"') && bookmarks.includes('Start Mission')],
  ['folder row Mission button', bookmarks.includes("mission.textContent = node.type === 'folder' ? 'Mission' : 'Pin URL'")],
  ['app event listener installed', app.includes("window.addEventListener('tahai-browser:start-mission-from-bookmark-folder'")],
  ['bookmark mission creator', app.includes('async function startMissionFromBookmarkFolder')],
  ['bookmark mission stays local-only', app.includes("missionType: 'documentation'") && app.includes("mode: 'local-only'")],
  ['bookmark mission layout maps URL count', app.includes('bookmarkMissionLayoutForCount(paneEntries.length)') || (app.includes("safeUrls.length >= 4 ? 'quad'") && app.includes("safeUrls.length === 3 ? 'triple'"))],
  ['bookmark mission evidence source', app.includes("source: 'bookmark-folder'")],
  ['pass 26 wired in release blockers', pkg.includes('verify:pass-26-bookmark-folder-mission-launch')]
];

const failed = required.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error('PASS26_BOOKMARK_FOLDER_MISSION_LAUNCH_FAILED=' + failed.join(', '));
  process.exit(1);
}
console.log('PASS26_BOOKMARK_FOLDER_MISSION_LAUNCH_OK=1');
