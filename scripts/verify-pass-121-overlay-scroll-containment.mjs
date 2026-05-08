#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/^\uFEFF/, '');
const all = [read('package.json'), read('src/renderer/app.ts'), read('src/renderer/index.html'), read('src/renderer/responsive-toolbar.ts'), read('src/renderer/site-view-mission-rail.ts'), read('src/renderer/styles/responsive-toolbar.css'), read('PASS_121_OVERLAY_SCROLL_CONTAINMENT_SUMMARY.md')].join('\n');
const errors = [];
const need = (ok, msg) => { if (!ok) errors.push(msg); };
for (const token of [
  'data-pass121-overlay-scroll-containment="true"',
  'pass121ApplyOverlayScrollContainment',
  'pass121AuditOverlayScrollContainment',
  '100dvh',
  'overscroll-behavior: contain',
]) need(all.includes(token), `missing PASS121 token: ${token}`);
need(all.includes('verify:pass-121-overlay-scroll-containment'), 'package missing verifier token');
for (const forbidden of ['ipcRenderer','shell.openExternal','BrowserView','psa:direct-fetch']) need(!all.includes(forbidden), `PASS121 must not add ${forbidden}`);
if (errors.length) { for (const e of errors) console.error('[PASS121][FAIL] ' + e); process.exit(1); }
console.log('[PASS121][OK] Overlay scroll containment verified.');
