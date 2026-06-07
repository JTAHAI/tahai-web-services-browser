#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const app = readFileSync('src/renderer/app.ts', 'utf8');
const css = readFileSync('src/renderer/styles/browser.css', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

const requiredAppTokens = [
  'PASS74 Mission View UX hardening',
  'pass74MissionPanePointerMoved',
  'Math.hypot(event.clientX - pass74MissionPanePointerStartX',
  'Let the native click handler arm click-to-swap',
  "pass68ArmOrSwapMissionPaneByClick(clickPaneId, pane)",
  'pass74HardenDirectWebviewSurface',
  "webview.setAttribute('width', String(width))",
  "webview.setAttribute('height', String(height))",
  'pass74ValidateMissionPaneSurfaces',
  'pass74ScheduleMissionPaneRelayoutRetries',
  'pass74MountMissionPaneSurfaceSelfHeal',
  "webview.addEventListener('dom-ready'",
  "document.dispatchEvent(new CustomEvent('mission-layout-change'))",
  'pass74MountMissionPaneSurfaceSelfHeal();'
];

const requiredCssTokens = [
  'PASS74 Mission View UX hardening',
  'Click Move, then another pane',
  'touch-action: none !important',
  'object-fit: fill !important',
  'pointer-events: auto !important',
  'pass68-mission-pane-click-swap-source .mission-pane-drag-handle',
  'pass63-mission-pane-drop-target'
];

const requiredPackageTokens = [
  'verify:pass-74-mission-view-ux-hardening',
  'verify-pass-74-mission-view-ux-hardening.mjs'
];

const failures = [];
for (const token of requiredAppTokens) if (!app.includes(token)) failures.push(`missing app token: ${token}`);
for (const token of requiredCssTokens) if (!css.includes(token)) failures.push(`missing css token: ${token}`);
for (const token of requiredPackageTokens) {
  if (!JSON.stringify(pkg.scripts).includes(token)) failures.push(`missing package script token: ${token}`);
}

if (!getReleaseBlockersContract(pkg).includes('verify:pass-74-mission-view-ux-hardening')) {
  failures.push('release blockers chain does not include PASS74 verifier');
}

if (app.includes('subsequent click immediately cancelled it') && !app.includes('if (!moved)')) {
  failures.push('pointer threshold guard is documented but not enforced');
}

if (failures.length) {
  console.error('PASS74_MISSION_VIEW_UX_HARDENING_FAIL=' + failures.join('; '));
  process.exit(1);
}
console.log('PASS74_MISSION_VIEW_UX_HARDENING=OK');
