#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/^\uFEFF/, '');
const all = [read('package.json'), read('src/renderer/app.ts'), read('src/renderer/index.html'), read('src/renderer/responsive-toolbar.ts'), read('src/renderer/site-view-mission-rail.ts'), read('src/renderer/styles/responsive-toolbar.css'), read('PASS_119_OVERLAY_ARIA_CONTRACT_SUMMARY.md')].join('\n');
const errors = [];
const need = (ok, msg) => { if (!ok) errors.push(msg); };
for (const token of [
  'data-pass119-overlay-aria-contract="true"',
  'pass119ApplyOverlayAriaContract',
  'pass119AuditOverlayAriaContract',
  'data-pass119-aria-contract',
]) need(all.includes(token), `missing PASS119 token: ${token}`);
need(all.includes('verify:pass-119-overlay-aria-contract'), 'package missing verifier token');
for (const forbidden of ['ipcRenderer','shell.openExternal','BrowserView','psa:direct-fetch']) need(!all.includes(forbidden), `PASS119 must not add ${forbidden}`);
if (errors.length) { for (const e of errors) console.error('[PASS119][FAIL] ' + e); process.exit(1); }
console.log('[PASS119][OK] Overlay ARIA contract verified.');
