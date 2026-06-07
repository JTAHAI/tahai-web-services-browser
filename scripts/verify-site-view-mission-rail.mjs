#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const fail = (message) => { console.error(`TAHAI_BROWSER_SITE_VIEW_MISSION_RAIL_VERIFY_FAIL=${message}`); process.exit(1); };
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));

const required = [
  'src/renderer/site-view-mission-rail.ts',
  'src/renderer/styles/site-view-mission-rail.css',
  'docs/site-view-mission-rail.md'
];
for (const rel of required) if (!exists(rel)) fail(`missing ${rel}`);

const index = read('src/renderer/index.html');
if (!index.includes('site-view-mission-rail.js')) fail('index.html does not load site-view-mission-rail.js');
if (!index.includes('data-send-active-pane')) fail('index.html missing Mission pane quick-send controls');

const app = read('src/renderer/app.ts');
if (!app.includes("document.addEventListener('tahai-site-view-send-tab-to-pane'")) fail('app missing Site View pane send event bridge');
if (!app.includes('data-send-active-pane')) fail('app missing Mission pane quick-send handler');

const rail = read('src/renderer/site-view-mission-rail.ts');
for (const token of [
  'Site View Mission Rail',
  'Ctrl+Alt+V',
  'capturePage',
  'isPrivacySensitiveUrl',
  'sendToPane',
  'moveTab',
  'dragstart',
  'tahai-site-view-send-tab-to-pane',
  'RAIL_MODE_KEY',
  'RAIL_DENSITY_KEY',
  'RAIL_SIDE_KEY',
  'RAIL_PRIVACY_KEY',
  'RAIL_PAUSED_KEY',
  'togglePrivacyMode',
  'togglePaused',
  'copySnapshotUrl',
  'previewStatus',
  'Ctrl+Alt+Shift+V',
  'Ctrl+Alt+J',
  'RAIL_FAVORITES_KEY',
  'toggleFavorite',
  'favoriteKeyForSnapshot',
  'mouseenter'
]) {
  if (!rail.includes(token)) fail(`renderer missing ${token}`);
}

const css = read('src/renderer/styles/site-view-mission-rail.css');
for (const token of ['aspect-ratio', 'object-fit: contain', 'site-view-rail-right', 'data-site-view-rail-density', 'data-site-view-rail-privacy', 'site-view-rail-paused', 'drag-over', 'site-view-rail-status', 'site-view-rail-card.favorite']) {
  if (!css.includes(token)) fail(`stylesheet missing ${token}`);
}

for (const forbidden of [
  /ipcRenderer/i,
  /shell\.openExternal/i,
  /fetch\s*\(/i,
  /XMLHttpRequest/i,
  /Authorization/i,
  /Cookie header/i,
  /document\.write/i,
  /eval\s*\(/i,
  /localStorage\.setItem\([^,]+,\s*dataUrl/i,
  /indexedDB/i
]) {
  if (forbidden.test(rail)) fail(`forbidden pattern in rail renderer: ${forbidden}`);
}

const pkg = JSON.parse(read('package.json'));
if (pkg.scripts?.['verify:site-view-rail'] !== 'node scripts/verify-site-view-mission-rail.mjs') fail('package.json missing verify:site-view-rail script');
if (!getReleaseBlockersContract(pkg).includes('verify:site-view-rail')) fail('release blockers do not include verify:site-view-rail');

console.log('TAHAI_BROWSER_SITE_VIEW_MISSION_RAIL_VERIFY=OK');
process.exit(0);
