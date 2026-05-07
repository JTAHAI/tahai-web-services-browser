#!/usr/bin/env node
import fs from 'node:fs';

const bookmarks = fs.readFileSync('src/renderer/chromium-bookmarks.ts', 'utf8');
const app = fs.readFileSync('src/renderer/app.ts', 'utf8');
const pkg = fs.readFileSync('package.json', 'utf8');

const required = [
  ['bookmark mission manifest type exists', bookmarks.includes('type BookmarkMissionManifest')],
  ['manifest builder counts blocked duplicates panes', bookmarks.includes('buildBookmarkMissionManifest') && bookmarks.includes('blockedUrlCount') && bookmarks.includes('duplicateUrlCount') && bookmarks.includes('paneUrlCount')],
  ['manifest markdown exports pane/evidence labels', bookmarks.includes('missionManifestMarkdown') && bookmarks.includes("'[Pane]'") && bookmarks.includes("'[Evidence]'")],
  ['folder view exposes copy mission manifest action', bookmarks.includes('data-folder-action="copy-manifest"') && bookmarks.includes('copyFolderMissionManifest(folder)')],
  ['mission launch dispatch includes launch manifest', bookmarks.includes('launchManifest: missionManifestMarkdown(manifest)')],
  ['single bookmark launch includes manifest', bookmarks.includes('Source: bookmark') && bookmarks.includes('launchManifest: `# Bookmark Mission Manifest')],
  ['mission detail accepts launch manifest', app.includes('launchManifest?: string')],
  ['mission notes preserve launch manifest for export', app.includes('Launch manifest copied into Mission notes for handoff/export')],
  ['pass 29 script wired', pkg.includes('verify:pass-29-bookmark-mission-manifest')]
];

const failed = required.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error('PASS29_BOOKMARK_MISSION_MANIFEST_FAILED=' + failed.join(', '));
  process.exit(1);
}
console.log('PASS29_BOOKMARK_MISSION_MANIFEST_OK=1');
