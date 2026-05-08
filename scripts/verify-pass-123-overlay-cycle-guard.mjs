#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/^\uFEFF/, '');
const all = [read('package.json'), read('src/renderer/app.ts'), read('src/renderer/index.html'), read('src/renderer/responsive-toolbar.ts'), read('src/renderer/site-view-mission-rail.ts'), read('src/renderer/styles/responsive-toolbar.css'), read('PASS_123_OVERLAY_CYCLE_GUARD_SUMMARY.md')].join('\n');
const errors = [];
const need = (ok, msg) => { if (!ok) errors.push(msg); };
for (const token of [
  'data-pass123-overlay-cycle-guard="true"',
  "const PASS123_OVERLAY_CYCLE_AUDIT_EVENT = 'tahai:chrome-overlay-cycle-audit'",
  'pass123ScheduleOverlayCycleAudit',
  'pass123RunOverlayCycleAudit',
  'collapsed-multiple-overlays',
]) need(all.includes(token), `missing PASS123 token: ${token}`);
need(all.includes('verify:pass-123-overlay-cycle-guard'), 'package missing verifier token');
for (const forbidden of ['ipcRenderer','shell.openExternal','BrowserView','psa:direct-fetch']) need(!all.includes(forbidden), `PASS123 must not add ${forbidden}`);
if (errors.length) { for (const e of errors) console.error('[PASS123][FAIL] ' + e); process.exit(1); }
console.log('[PASS123][OK] Overlay cycle guard verified.');
