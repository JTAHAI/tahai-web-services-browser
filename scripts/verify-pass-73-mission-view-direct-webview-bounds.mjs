#!/usr/bin/env node
import fs from 'node:fs';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const app = fs.readFileSync('src/renderer/app.ts', 'utf8');
const css = fs.readFileSync('src/renderer/styles/browser.css', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const requiredAppTokens = [
  'pass73-mission-direct-webviews',
  'keep Electron webviews as direct stage children',
  'runtimeTab.webview.parentElement !== stageEl',
  "runtimeTab.webview.style.left = left + 'px'",
  "runtimeTab.webview.style.top = top + 'px'",
  "runtimeTab.webview.style.maxHeight = height + 'px'",
  'delete tab.webview.dataset.pass63MissionPaneId',
  'Do not inject controls into the webview custom element',
  'pass68ArmOrSwapMissionPaneByClick(targetPaneId, targetPane)',
  'pass73ClickSwapMounted'
];
const requiredCssTokens = [
  'PASS73 Mission View direct-webview bounds',
  '.webview-stage.mission-layout.pass73-mission-direct-webviews > webview.browser-view',
  '.webview-stage.mission-layout.pass73-mission-direct-webviews .mission-pane-shell',
  'pointer-events: none !important',
  '.webview-stage.mission-layout.pass73-mission-direct-webviews .mission-pane-drag-handle',
  'opacity: 1 !important',
  'cursor: grab !important'
];
const releaseBlockers = getReleaseBlockersContract(pkg);
const pass73Token = 'npm run verify:pass-73-mission-view-direct-webview-bounds';
const finalBuildToken = 'npm run build';
const missing = [];
for (const token of requiredAppTokens) if (!app.includes(token)) missing.push('app:' + token);
for (const token of requiredCssTokens) if (!css.includes(token)) missing.push('css:' + token);
if (!pkg.scripts?.['verify:pass-73-mission-view-direct-webview-bounds']) missing.push('script:verify:pass-73-mission-view-direct-webview-bounds');
const pass73Index = releaseBlockers.indexOf(pass73Token);
const buildIndex = releaseBlockers.lastIndexOf(finalBuildToken);
if (pass73Index < 0) missing.push('release-chain:' + pass73Token);
if (buildIndex < 0) missing.push('release-chain:' + finalBuildToken);
if (pass73Index >= 0 && buildIndex >= 0 && pass73Index > buildIndex) missing.push('release-chain:PASS73 must run before final build');
if (missing.length) {
  console.error('PASS73_MISSION_VIEW_DIRECT_WEBVIEW_BOUNDS_FAIL=' + missing.join('|'));
  process.exit(1);
}
console.log('PASS73_MISSION_VIEW_DIRECT_WEBVIEW_BOUNDS=OK');
