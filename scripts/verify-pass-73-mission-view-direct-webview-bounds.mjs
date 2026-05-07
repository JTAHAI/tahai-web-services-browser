#!/usr/bin/env node
import fs from 'node:fs';

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
const releaseChainToken = 'npm run verify:pass-73-mission-view-direct-webview-bounds && npm run build';
const missing = [];
for (const token of requiredAppTokens) if (!app.includes(token)) missing.push('app:' + token);
for (const token of requiredCssTokens) if (!css.includes(token)) missing.push('css:' + token);
if (!pkg.scripts?.['verify:pass-73-mission-view-direct-webview-bounds']) missing.push('script:verify:pass-73-mission-view-direct-webview-bounds');
if (!pkg.scripts?.['verify:release-blockers']?.includes(releaseChainToken)) missing.push('release-chain:' + releaseChainToken);
if (missing.length) {
  console.error('PASS73_MISSION_VIEW_DIRECT_WEBVIEW_BOUNDS_FAIL=' + missing.join('|'));
  process.exit(1);
}
console.log('PASS73_MISSION_VIEW_DIRECT_WEBVIEW_BOUNDS=OK');
