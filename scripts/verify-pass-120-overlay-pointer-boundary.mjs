#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/^\uFEFF/, '');
const all = [read('package.json'), read('src/renderer/app.ts'), read('src/renderer/index.html'), read('src/renderer/responsive-toolbar.ts'), read('src/renderer/site-view-mission-rail.ts'), read('src/renderer/styles/responsive-toolbar.css'), read('PASS_120_OVERLAY_POINTER_BOUNDARY_SUMMARY.md')].join('\n');
const errors = [];
const need = (ok, msg) => { if (!ok) errors.push(msg); };
for (const token of [
  'data-pass120-overlay-pointer-boundary="true"',
  'pass120ApplyOverlayPointerBoundary',
  'pass120AuditOverlayPointerBoundary',
  'data-pass120-pointer-boundary="hidden"',
]) need(all.includes(token), `missing PASS120 token: ${token}`);
need(all.includes('verify:pass-120-overlay-pointer-boundary'), 'package missing verifier token');
for (const forbidden of ['ipcRenderer','shell.openExternal','BrowserView','psa:direct-fetch']) need(!all.includes(forbidden), `PASS120 must not add ${forbidden}`);
if (errors.length) { for (const e of errors) console.error('[PASS120][FAIL] ' + e); process.exit(1); }
console.log('[PASS120][OK] Overlay pointer boundary verified.');
