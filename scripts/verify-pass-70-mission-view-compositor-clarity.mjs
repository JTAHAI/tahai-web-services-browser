#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';
const root = process.cwd();
const errors = [];
const read = (rel) => fs.existsSync(path.join(root, rel)) ? fs.readFileSync(path.join(root, rel), 'utf8').replace(/^\uFEFF/, '') : '';
const app = read('src/renderer/app.ts');
const css = read('src/renderer/styles/browser.css');
const pkg = JSON.parse(read('package.json') || '{}');
for (const token of ['PASS70 Mission View compositor clarity','pass70ClearTransientMissionPaneUiState','pass70MountMissionPaneTransientCleanup',"document.body.classList.remove('pass66-mission-pane-pointer-dragging')",'pass70MountMissionPaneTransientCleanup();']) {
  if (!app.includes(token)) errors.push(`app missing ${token}`);
}
for (const token of ['PASS70 Mission View compositor clarity','.webview-stage.mission-layout webview.browser-view','display: block !important','border-radius: 0 !important','overflow: visible !important','box-shadow: none !important','filter: none !important','transform: none !important','opacity: 1 !important','contain: initial !important','backface-visibility: visible !important','will-change: auto !important']) {
  if (!css.includes(token)) errors.push(`css missing ${token}`);
}
if (!pkg.scripts?.['verify:pass-70-mission-view-compositor-clarity']) errors.push('package missing PASS70 verifier script');
if (!getReleaseBlockersContract(pkg).includes('verify:pass-70-mission-view-compositor-clarity')) errors.push('release blockers missing PASS70 verifier');
if (/\.webview-stage\.mission-layout webview\.browser-view[\s\S]{0,260}opacity:\s*\.72/i.test(css)) errors.push('webview compositor CSS still dims pane surface');
if (errors.length) { for (const error of errors) console.error(`PASS70_MISSION_VIEW_COMPOSITOR_CLARITY_ERROR=${error}`); process.exit(1); }
console.log('PASS70_MISSION_VIEW_COMPOSITOR_CLARITY=OK');
