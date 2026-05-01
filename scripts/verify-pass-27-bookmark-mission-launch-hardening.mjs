#!/usr/bin/env node
import fs from 'node:fs';

const app = fs.readFileSync('src/renderer/app.ts', 'utf8');
const bookmarks = fs.readFileSync('src/renderer/chromium-bookmarks.ts', 'utf8');
const pkg = fs.readFileSync('package.json', 'utf8');

const required = [
  ['bookmark mission detail carries titles', app.includes('titles?: string[]') && (bookmarks.includes('titles: safeNodes.map((node) => node.title)') || bookmarks.includes('titles: manifest.urls.map((entry) => entry.title)'))],
  ['bookmark mission detail carries source metadata', app.includes('sourceFolderId?: string') && bookmarks.includes('sourceFolderId: folder.id') && bookmarks.includes("sourceKind: 'bookmark'")],
  ['bookmark mission role heuristic added', app.includes('function bookmarkMissionRole') && app.includes("return 'ticket'") && app.includes("return 'logs'")],
  ['bookmark mission layout helper added', app.includes('function bookmarkMissionLayoutForCount') && app.includes('bookmarkMissionLayoutForCount(paneEntries.length)')],
  ['all safe bookmark urls preserved as evidence', app.includes('evidence: safeEntries.map') && app.includes('Included as supporting bookmark evidence')],
  ['first four bookmark urls remain pane cap', app.includes('const paneEntries = safeEntries.slice(0, 4)') && app.includes('paneOpened: String(index < 4)')],
  ['bookmark mission status shows evidence count', app.includes('evidence URL(s)')],
  ['pass 27 wired in release blockers', pkg.includes('verify:pass-27-bookmark-mission-launch-hardening')]
];

const failed = required.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error('PASS27_BOOKMARK_MISSION_LAUNCH_HARDENING_FAILED=' + failed.join(', '));
  process.exit(1);
}
console.log('PASS27_BOOKMARK_MISSION_LAUNCH_HARDENING_OK=1');
