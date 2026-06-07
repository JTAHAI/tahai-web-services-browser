#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const failures = [];
const rel = (p) => path.join(root, p);
const exists = (p) => fs.existsSync(rel(p));
const read = (p) => fs.readFileSync(rel(p), 'utf8');
const need = (condition, message) => { if (!condition) failures.push(message); };

const required = [
  'src/renderer/index.html',
  'src/renderer/responsive-toolbar.ts',
  'src/renderer/styles/responsive-toolbar.css',
  'docs/pass-179-more-tools-overflow-clarity.md',
  'PASS_179_MORE_TOOLS_OVERFLOW_CLARITY_SUMMARY.md',
  'scripts/verify-pass-179-more-tools-overflow-clarity.mjs',
  'package.json'
];
for (const file of required) need(exists(file), `missing ${file}`);

if (!failures.length) {
  const html = read('src/renderer/index.html');
  const responsiveTs = read('src/renderer/responsive-toolbar.ts');
  const responsiveCss = read('src/renderer/styles/responsive-toolbar.css');
  const doc = read('docs/pass-179-more-tools-overflow-clarity.md');
  const summary = read('PASS_179_MORE_TOOLS_OVERFLOW_CLARITY_SUMMARY.md');
  const pkg = JSON.parse(read('package.json'));
  const releaseBlockers = getReleaseBlockersContract(pkg);

  need(pkg.version === '1.8.30', 'PASS179 must not increment version without explicit approval.');
  need(pkg.scripts?.['verify:pass-179-more-tools-overflow-clarity'] === 'node scripts/verify-pass-179-more-tools-overflow-clarity.mjs', 'package.json must expose PASS179 verifier.');
  need(releaseBlockers.includes('npm run verify:pass-179-more-tools-overflow-clarity'), 'release blocker chain must include PASS179 verifier.');
  need(releaseBlockers.indexOf('verify:pass-179-more-tools-overflow-clarity') > releaseBlockers.indexOf('verify:pass-178-live-viewport-budget-enterprise-button-geometry'), 'PASS179 verifier must run after PASS178 verifier.');
  need(releaseBlockers.indexOf('verify:pass-179-more-tools-overflow-clarity') < releaseBlockers.lastIndexOf('npm run build'), 'PASS179 verifier must run before final build.');

  need(html.includes('data-pass179-more-tools-overflow-clarity="true"'), 'renderer shell must expose PASS179 More Tools overflow clarity marker.');

  for (const token of [
    'PASS179 More Tools overflow clarity',
    "const PASS179_OVERFLOW_COUNT_BADGE_ID = 'toolbar-overflow-count'",
    "document.body.dataset.pass179MoreToolsOverflowClarity = 'true'",
    "buttonEl.dataset.pass179OverflowClarity = 'true'",
    'toolbar-overflow-count-badge',
    'function pass179UpdateMoreToolsOverflowClarity',
    'buttonEl.setAttribute(\'aria-label\', label)',
    'buttonEl.dataset.pass179OverflowCount = String(count)',
    'document.body.dataset.pass179MoreToolsOverflowMode',
    "pass179UpdateMoreToolsOverflowClarity(target, document.body.dataset.pass177ForcedOverflowReason || 'not-needed')"
  ]) need(responsiveTs.includes(token), `responsive toolbar missing PASS179 token: ${token}`);

  for (const token of [
    'PASS179 More Tools Overflow Clarity',
    'body[data-pass179-more-tools-overflow-clarity="true"] .toolbar-overflow-toggle',
    'body[data-pass179-more-tools-overflow-clarity="true"] .toolbar-overflow-count-badge',
    'body[data-pass179-more-tools-overflow-mode="viewport-forced"] .toolbar-overflow-toggle',
    'body[data-pass179-more-tools-overflow-mode="viewport-forced"] .toolbar-overflow-count-badge',
    'Controls may move here automatically to preserve website pane height',
    'border-radius: 7px',
    'pointer-events: none'
  ]) need(responsiveCss.includes(token), `responsive CSS missing PASS179 token: ${token}`);

  need(!responsiveTs.includes('ipcRenderer'), 'PASS179 must not add raw IPC.');
  need(!responsiveTs.includes('shell.openExternal'), 'PASS179 must not add external-open behavior.');
  need(!html.includes('onclick='), 'PASS179 must not add inline click handlers.');
  need(doc.includes('PASS179') && doc.includes('overflow count') && doc.includes('forced-overflow') && doc.includes('website pane'), 'PASS179 doc must describe count, forced-overflow, and website pane clarity.');
  need(summary.includes('PASS179') && summary.includes('Version remains `1.8.30`') && summary.includes('mystery icon'), 'PASS179 summary missing closeout markers.');
}

if (failures.length) {
  console.error('[PASS179][FAIL] More Tools overflow clarity verification failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('[PASS179][OK] More Tools overflow clarity verified.');
