#!/usr/bin/env node
import fs from 'node:fs';
const bookmarks = fs.readFileSync('src/renderer/chromium-bookmarks.ts', 'utf8');
const pkg = fs.readFileSync('package.json', 'utf8');
const checks = [
  ['manifest has schema version', bookmarks.includes('schemaVersion: 1') && bookmarks.includes('type BookmarkMissionManifest')],
  ['manifest has sanitized handoff profile', bookmarks.includes("exportProfile: 'sanitized-handoff'")],
  ['manifest tracks evidence-only URL count', bookmarks.includes('evidenceOnlyUrlCount') && bookmarks.includes('Math.max(urls.length - 4, 0)')],
  ['manifest has pane/evidence export roles', bookmarks.includes("exportRole: 'pane' | 'evidence'") && bookmarks.includes("exportRole: paneOpened ? 'pane' : 'evidence'")],
  ['manifest markdown escapes dynamic titles', bookmarks.includes('function escapeManifestMarkdown') && bookmarks.includes('escapeManifestMarkdown(entry.title)')],
  ['manifest JSON copy/download actions exposed', bookmarks.includes('data-folder-action="copy-manifest-json"') && bookmarks.includes('data-folder-action="download-manifest-json"')],
  ['manifest JSON copy/download handlers wired', bookmarks.includes('copyFolderMissionManifestJson(folder)') && bookmarks.includes('downloadFolderMissionManifestJson(folder)')],
  ['pass 30 script wired', pkg.includes('verify:pass-30-bookmark-mission-manifest-export')]
];
let failed = false;
for (const [label, ok] of checks) {
  if (ok) console.log(`PASS30_OK ${label}`);
  else { console.error(`PASS30_FAIL ${label}`); failed = true; }
}
if (failed) process.exit(1);

process.exit(0);
