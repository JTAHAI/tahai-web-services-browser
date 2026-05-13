#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');
const pkg = JSON.parse(read('package.json'));
const contract = read('src/shared/mission-layout-determinism-contract.ts');
const app = read('src/renderer/app.ts');
const doc = read('docs/pass-197-mission-layout-determinism.md');
const summary = read('PASS_197_MISSION_LAYOUT_DETERMINISM_SUMMARY.md');
const checks = [];
const ok = (condition, message) => checks.push({ ok: Boolean(condition), message });

ok(pkg.version === '1.8.30', 'PASS197 must not increment version without explicit approval.');
ok(pkg.scripts?.['verify:pass-197-mission-layout-determinism'] === 'node scripts/verify-pass-197-mission-layout-determinism.mjs', 'package.json exposes PASS197 verifier.');
ok(pkg.scripts?.['verify:release-blockers']?.includes('verify:pass-197-mission-layout-determinism'), 'release-blockers chain includes PASS197 verifier.');
ok(pkg.scripts?.['verify:release-blockers']?.indexOf('verify:pass-197-mission-layout-determinism') > pkg.scripts?.['verify:release-blockers']?.indexOf('verify:pass-196-mission-control-ia-rebuild'), 'PASS197 must run after PASS196.');

for (const token of [
  'PASS197_MISSION_LAYOUT_DETERMINISM_PASS',
  'PASS197_MISSION_LAYOUT_DETERMINISM_VERSION',
  'pass197-mission-layout-determinism-v1',
  'PASS197_MISSION_LAYOUT_DETERMINISM_MATRIX',
  'PASS197_REQUIRED_MISSION_LAYOUT_FIELDS',
  'PASS197_MISSION_LAYOUT_RESTORE_RULES',
  'pass197MissionLayoutDeterminismCaseIds',
  'pass197MissionLayoutDeterminismFieldNames',
  'pass197MissionLayoutDeterminismSummary',
  'single',
  'split-horizontal',
  'split-vertical',
  'triple-top',
  'triple-bottom',
  'triple-left',
  'triple-right',
  'quad',
  'focus',
  'activePaneId',
  'visiblePaneIds',
  'restoreLayoutType',
  'runtimeTabId',
  'canGoBack',
  'canGoForward'
]) ok(contract.includes(token), `PASS197 contract missing token: ${token}`);

ok((contract.match(/id: 'pass197-/g) || []).length >= 10, 'PASS197 matrix must cover at least 10 layout/restore cases.');

for (const token of [
  "from '../shared/mission-layout-determinism-contract'",
  'Pass197MissionPaneSnapshot',
  'Pass197MissionLayoutSnapshot',
  'pass197LastMissionLayoutSnapshot',
  'pass197WebviewHistoryState',
  'pass197DeterministicRestoreLayoutCandidate',
  'pass197BuildMissionLayoutSnapshot',
  'pass197RecordMissionLayoutDeterminism',
  'document.body.dataset.pass197MissionLayoutDeterminism',
  'document.body.dataset.pass197LastLayoutDeterminism',
  'document.body.dataset.pass197VisiblePanes',
  'document.body.dataset.pass197ActivePane',
  'document.body.dataset.pass197RestoreLayout',
  'stageEl.dataset.pass197MissionLayoutDeterminism',
  "pass197RecordMissionLayoutDeterminism('render-start', 'before')",
  "pass197RecordMissionLayoutDeterminism('render-single-root', 'after')",
  "pass197RecordMissionLayoutDeterminism('render-mission-layout', 'after')",
  "pass197RecordMissionLayoutDeterminism('focus-toggle', 'before')",
  "pass197RecordMissionLayoutDeterminism('focus-restore', 'restore')",
  "pass197RecordMissionLayoutDeterminism('focus-enter', 'after')",
  "pass197RecordMissionLayoutDeterminism('set-layout:' + layout, 'before')",
  "pass197RecordMissionLayoutDeterminism('set-layout:' + mission.layout.type, 'after')",
  "pass197RecordMissionLayoutDeterminism('set-active-pane:' + paneId, 'before')",
  "pass197RecordMissionLayoutDeterminism('set-active-pane:' + nextPane, 'after')",
  'lastMissionLayoutBeforeFocus = mission.layout.type === \'single\' || mission.layout.type === \'command\' ? \'quad\' : mission.layout.type',
  'const restoreLayout = pass197DeterministicRestoreLayoutCandidate()'
]) ok(app.includes(token), `PASS197 renderer missing token: ${token}`);

for (const token of [
  'PASS197',
  'Mission Layout Determinism',
  '1-Up',
  '2-Up Split/Stack',
  '3-Up variants',
  '4-Up Quad Ops',
  'Focus Pane',
  'pane role, URL, title, runtime tab mapping, active pane, and history truth',
  'Version remains `1.8.30`'
]) ok(doc.includes(token), `PASS197 doc missing token: ${token}`);

ok(summary.includes('Remaining enterprise hardening passes after PASS197: 28'), 'PASS197 summary must record remaining pass count.');
ok(!doc.includes('TODO') && !summary.includes('TODO'), 'PASS197 docs must not contain TODO markers.');

const failures = checks.filter((check) => !check.ok);
if (failures.length) {
  console.error('[PASS197][FAIL] Mission layout determinism verification failed.');
  for (const failure of failures) console.error(` - ${failure.message}`);
  process.exit(1);
}
console.log('[PASS197][OK] Mission layout determinism verified.');
