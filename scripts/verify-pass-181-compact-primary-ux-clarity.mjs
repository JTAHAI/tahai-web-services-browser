#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const failures = [];
const need = (ok, msg) => { if (!ok) failures.push(msg); };

const pkg = JSON.parse(read('package.json'));
const html = read('src/renderer/index.html');
const responsiveTs = read('src/renderer/responsive-toolbar.ts');
const responsiveCss = read('src/renderer/styles/responsive-toolbar.css');
const doc = read('docs/pass-181-compact-primary-ux-clarity.md');
const summary = read('PASS_181_COMPACT_PRIMARY_UX_CLARITY_SUMMARY.md');
const releaseBlockers = getReleaseBlockersContract(pkg);

need(pkg.version === '1.8.30', 'PASS181 must not increment version without explicit approval.');
need(pkg.scripts?.['verify:pass-181-compact-primary-ux-clarity'] === 'node scripts/verify-pass-181-compact-primary-ux-clarity.mjs', 'package.json must expose PASS181 verifier.');
need(releaseBlockers.includes('npm run verify:pass-181-compact-primary-ux-clarity'), 'release blocker chain must include PASS181 verifier.');
need(releaseBlockers.indexOf('verify:pass-181-compact-primary-ux-clarity') > releaseBlockers.indexOf('verify:pass-180-primary-chrome-compact-recovery'), 'PASS181 verifier must run after PASS180 verifier.');
need(releaseBlockers.indexOf('verify:pass-181-compact-primary-ux-clarity') < releaseBlockers.lastIndexOf('npm run build'), 'PASS181 verifier must run before final build.');

for (const token of [
  'data-pass181-compact-primary-ux-clarity="true"',
  'data-pass180-primary-chrome-compact-recovery="true"'
]) need(html.includes(token), `renderer shell missing PASS181/PASS180 token: ${token}`);

for (const token of [
  'PASS181 compact primary UX clarity',
  'PASS181_COMPACT_UX_SUMMARY_ID',
  'PASS181_PRIMARY_COMPACT_CONTROLS',
  'pass181PreparePrimaryCompactControls',
  'pass181UpdateCompactUxHints',
  'toolbar-compact-ux-summary',
  "document.body.dataset.pass181CompactPrimaryGlyphs = compact ? 'active' : 'ready'",
  "{ id: 'devops-tools', compactGlyph: 'D'",
  "{ id: 'it-tools', compactGlyph: 'IT'"
]) need(responsiveTs.includes(token), `responsive toolbar missing PASS181 token: ${token}`);

for (const token of [
  'PASS181 Compact Primary UX Clarity',
  'body[data-pass181-compact-primary-glyphs="active"] .toolbar #devops-tools > span[aria-hidden="true"]::before',
  "content: 'D';",
  'body[data-pass181-compact-primary-glyphs="active"] .toolbar #it-tools > span[aria-hidden="true"]::before',
  "content: 'IT';",
  '#toolbar-compact-ux-summary',
  'body[data-pass181-compact-overflow-explanation="visible"] .toolbar-overflow-menu .toolbar-overflow-header'
]) need(responsiveCss.includes(token), `responsive CSS missing PASS181 token: ${token}`);

need(!responsiveTs.includes('ipcRenderer'), 'PASS181 must not add raw IPC.');
need(!responsiveTs.includes('shell.openExternal'), 'PASS181 must not add external-open behavior.');
need(!html.includes('onclick='), 'PASS181 must not add inline click handlers.');
need(doc.includes('PASS181') && doc.includes('DevOps') && doc.includes('IT Tools') && doc.includes('More Tools') && doc.includes('Version remains `1.8.30`'), 'PASS181 doc must describe compact glyph and More Tools UX.');
need(summary.includes('PASS181') && summary.includes('Version remains `1.8.30`') && summary.includes('compact primary chrome'), 'PASS181 summary missing closeout markers.');

if (failures.length) {
  console.error('[PASS181][FAIL] Compact primary UX clarity verification failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('[PASS181][OK] Compact primary UX clarity verified.');
