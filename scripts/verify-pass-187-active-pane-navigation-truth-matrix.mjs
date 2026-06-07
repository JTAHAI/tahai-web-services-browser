#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');
const checks = [];
const ok = (condition, message) => checks.push({ ok: Boolean(condition), message });

const pkg = JSON.parse(read('package.json'));
const contract = read('src/shared/active-pane-navigation-truth-matrix-contract.ts');
const app = read('src/renderer/app.ts');
const doc = read('docs/pass-187-active-pane-navigation-truth-matrix.md');
const summary = read('PASS_187_ACTIVE_PANE_NAVIGATION_TRUTH_MATRIX_SUMMARY.md');

ok(pkg.version === '1.8.30', 'PASS187 must not increment version without explicit approval.');
ok(pkg.scripts?.['verify:pass-187-active-pane-navigation-truth-matrix'] === 'node scripts/verify-pass-187-active-pane-navigation-truth-matrix.mjs', 'package.json exposes PASS187 verifier.');
ok(getReleaseBlockersContract(pkg).includes('verify:pass-187-active-pane-navigation-truth-matrix'), 'release-blockers chain includes PASS187 verifier.');

for (const token of [
  'PASS187_ACTIVE_PANE_NAVIGATION_TRUTH_MATRIX_VERSION',
  'pass187-active-pane-navigation-truth-matrix-v1',
  'Pass187NavigationInputSource',
  'Pass187ResolvedNavigationTarget',
  'Pass187NavigationTruthReason',
  'PASS187_REQUIRED_NAVIGATION_TRUTH_FIELDS',
  'PASS187_NAVIGATION_TRUTH_MATRIX',
  'PASS187_NAVIGATION_TRUTH_HISTORY_LIMIT',
  'pass187NavigationTruthCaseIds',
  'pass187RequiredNavigationTruthFieldNames',
  'toolbar-back',
  'toolbar-forward',
  'toolbar-reload',
  'address-submit',
  'mouse-button-4',
  'mouse-button-5',
  'menu-back',
  'alt-left',
  'mission-active-pane',
  'active-tab',
  'safe-noop',
  'active-pane-empty-fallback-detected',
  'history-unavailable'
]) ok(contract.includes(token), `PASS187 contract missing token: ${token}`);

const matrixCases = (contract.match(/id: 'pass187-/g) || []).length;
ok(matrixCases >= 9, `PASS187 matrix must include at least 9 target cases; found ${matrixCases}.`);

for (const token of [
  "from '../shared/active-pane-navigation-truth-matrix-contract'",
  'Pass187NavigationTruthEvent',
  'pass187NavigationTruthHistory',
  'pass187NavigationInputSource',
  'pass187NavigationReason',
  'pass187RecordNavigationTruth',
  'pass187BuildNavigationTruthReport',
  'pass187RefreshNavigationTruthMatrix',
  'document.body.dataset.pass187ActivePaneNavigationTruthMatrix',
  'document.body.dataset.pass187LastNavigationTruth',
  'addressInput.dataset.pass187NavigationTargetKind',
  "pass187RecordNavigationTruth(intent, 'resolve-target'",
  "pass187RecordNavigationTruth(intent, 'address-navigate'",
  "pass187RecordNavigationTruth(intent, 'history-back'",
  "pass187RecordNavigationTruth(intent, 'history-forward'",
  "pass187RecordNavigationTruth(intent, 'reload-target'",
  'pass187RefreshNavigationTruthMatrix(reason)',
  "pass187RefreshNavigationTruthMatrix('mount')"
]) ok(app.includes(token), `PASS187 renderer missing token: ${token}`);

for (const token of [
  'PASS187',
  'Active Pane Navigation Truth Matrix',
  'mission-active-pane',
  'active-tab',
  'safe-noop',
  'Back, Forward, Reload, address-bar navigation',
  'Version remains `1.8.30`'
]) ok(doc.includes(token), `PASS187 doc missing token: ${token}`);

ok(summary.includes('Remaining enterprise hardening passes after PASS187: 38'), 'PASS187 summary must record remaining pass count.');
ok(!doc.includes('TODO') && !summary.includes('TODO'), 'PASS187 docs must not contain TODO markers.');

const failures = checks.filter((check) => !check.ok);
if (failures.length) {
  console.error('[PASS187][FAIL] Active pane navigation truth matrix verification failed.');
  for (const failure of failures) console.error(` - ${failure.message}`);
  process.exit(1);
}
console.log('[PASS187][OK] Active pane navigation truth matrix verified.');
