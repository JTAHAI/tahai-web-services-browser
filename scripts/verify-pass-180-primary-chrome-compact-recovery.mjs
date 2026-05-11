#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const failures = [];
const need = (ok, msg) => { if (!ok) failures.push(msg); };

const pkg = JSON.parse(read('package.json'));
const html = read('src/renderer/index.html');
const responsiveTs = read('src/renderer/responsive-toolbar.ts');
const responsiveCss = read('src/renderer/styles/responsive-toolbar.css');
const doc = read('docs/pass-180-primary-chrome-compact-recovery.md');
const summary = read('PASS_180_PRIMARY_CHROME_COMPACT_RECOVERY_SUMMARY.md');
const releaseBlockers = pkg.scripts?.['verify:release-blockers'] || '';

need(pkg.version === '1.8.30', 'PASS180 must not increment version without explicit approval.');
need(pkg.scripts?.['verify:pass-180-primary-chrome-compact-recovery'] === 'node scripts/verify-pass-180-primary-chrome-compact-recovery.mjs', 'package.json must expose PASS180 verifier.');
need(releaseBlockers.includes('npm run verify:pass-180-primary-chrome-compact-recovery'), 'release blocker chain must include PASS180 verifier.');
need(releaseBlockers.indexOf('verify:pass-180-primary-chrome-compact-recovery') > releaseBlockers.indexOf('verify:pass-179-more-tools-overflow-clarity'), 'PASS180 verifier must run after PASS179 verifier.');
need(releaseBlockers.indexOf('verify:pass-180-primary-chrome-compact-recovery') < releaseBlockers.lastIndexOf('npm run build'), 'PASS180 verifier must run before final build.');

for (const token of [
  'data-pass180-primary-chrome-compact-recovery="true"',
  'class="home-button pass180-primary-control"',
  'class="home-button secondary mission-control-button pass180-primary-control"',
  'pass180-primary-icon',
  'pass180-primary-label'
]) need(html.includes(token), `renderer shell missing PASS180 token: ${token}`);

for (const token of [
  'PASS180 primary chrome compact recovery',
  'const PASS180_PRIMARY_COMPACT_WIDTH_PX = 980',
  "document.body.dataset.pass180PrimaryChromeCompactRecovery = 'true'",
  "document.body.dataset.pass180PrimaryChromeCompactMode = pass180PrimaryCompact ? 'condensed' : 'full'",
  'addressWidth() < PASS113_MIN_ADDRESS_WIDTH'
]) need(responsiveTs.includes(token), `responsive toolbar missing PASS180 token: ${token}`);

for (const token of [
  'PASS180 Primary Chrome Compact Recovery',
  'body[data-pass180-primary-chrome-compact-recovery="true"] .pass180-primary-icon',
  'body[data-pass180-primary-chrome-compact-mode="condensed"] .toolbar .tool-menu-button',
  'body[data-pass180-primary-chrome-compact-mode="condensed"] .toolbar .mission-control-button',
  'body[data-pass180-primary-chrome-compact-mode="condensed"] .toolbar #home',
  'body[data-pass180-primary-chrome-compact-mode="condensed"] .toolbar .tool-menu-button span:not([aria-hidden="true"])'
]) need(responsiveCss.includes(token), `responsive CSS missing PASS180 token: ${token}`);

need(!responsiveTs.includes('ipcRenderer'), 'PASS180 must not add raw IPC.');
need(!responsiveTs.includes('shell.openExternal'), 'PASS180 must not add external-open behavior.');
need(!html.includes('onclick='), 'PASS180 must not add inline click handlers.');
need(doc.includes('PASS180') && doc.includes('always-visible primary controls') && doc.includes('address bar') && doc.includes('website pane'), 'PASS180 doc must describe primary controls, address bar, and website pane guardrail.');
need(summary.includes('PASS180') && summary.includes('Version remains `1.8.30`') && summary.includes('primary toolbar controls'), 'PASS180 summary missing closeout markers.');

if (failures.length) {
  console.error('[PASS180][FAIL] Primary chrome compact recovery verification failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('[PASS180][OK] Primary chrome compact recovery verified.');
