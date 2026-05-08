#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/^\uFEFF/, '');
const all = [read('package.json'), read('src/renderer/app.ts'), read('src/renderer/index.html'), read('src/renderer/responsive-toolbar.ts'), read('src/renderer/site-view-mission-rail.ts'), read('src/renderer/styles/responsive-toolbar.css'), read('PASS_122_OVERLAY_VIEWPORT_REFLOW_SUMMARY.md')].join('\n');
const errors = [];
const need = (ok, msg) => { if (!ok) errors.push(msg); };
for (const token of [
  'data-pass122-overlay-viewport-reflow="true"',
  "const PASS122_CHROME_STACK_REFLOW_EVENT = 'tahai:chrome-stack-reflow'",
  'pass122ScheduleOverlayViewportReflow',
  'pass122RunOverlayViewportReflow',
  'viewport-reflow',
]) need(all.includes(token), `missing PASS122 token: ${token}`);
need(all.includes('verify:pass-122-overlay-viewport-reflow'), 'package missing verifier token');
for (const forbidden of ['ipcRenderer','shell.openExternal','BrowserView','psa:direct-fetch']) need(!all.includes(forbidden), `PASS122 must not add ${forbidden}`);
if (errors.length) { for (const e of errors) console.error('[PASS122][FAIL] ' + e); process.exit(1); }
console.log('[PASS122][OK] Overlay viewport reflow verified.');
