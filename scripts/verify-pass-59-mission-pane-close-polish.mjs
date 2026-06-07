#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const fail = (message) => { console.error(`PASS59_MISSION_PANE_CLOSE_VERIFY_FAIL=${message}`); process.exit(1); };
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));

for (const rel of ['src/renderer/app.ts', 'src/renderer/styles/browser.css', 'package.json']) {
  if (!exists(rel)) fail(`missing ${rel}`);
}

const app = read('src/renderer/app.ts');
const css = read('src/renderer/styles/browser.css');
const pkg = JSON.parse(read('package.json'));

for (const token of [
  'PASS 59 Mission pane close polish',
  "type MissionPaneCloseBehavior = 'auto-refactor' | 'leave-blank'",
  'missionPaneCloseBehaviorStorageKey',
  'function closeActiveMissionPane',
  'function closeMissionPaneById',
  'function refactorMissionLayoutAfterPaneClose',
  'pass59LayoutForAssignedPaneCount',
  'data-mission-pane-close-behavior="auto-refactor"',
  'data-mission-pane-close-behavior="leave-blank"',
  'data-close-active-mission-pane',
  'refactorMissionLayoutAfterPaneClose(pass59ClosedPaneId);',
  'refreshMissionPaneCloseControls();'
]) {
  if (!app.includes(token)) fail(`app.ts missing token: ${token}`);
}

for (const token of [
  'PASS 59 Mission pane close polish',
  '.mission-pane-close-preferences',
  '.mission-pane-close-mode button.active',
  '.mission-pane-close-button',
  '[data-remove-mission-tab]'
]) {
  if (!css.includes(token)) fail(`browser.css missing token: ${token}`);
}

if (pkg.scripts?.['verify:pass-59-mission-pane-close-polish'] !== 'node scripts/verify-pass-59-mission-pane-close-polish.mjs') {
  fail('package.json missing verify:pass-59-mission-pane-close-polish script');
}
if (!getReleaseBlockersContract(pkg).includes('verify:pass-59-mission-pane-close-polish')) {
  fail('verify:release-blockers is not wired to pass 59 verifier');
}

console.log('PASS59_MISSION_PANE_CLOSE_VERIFY=OK');
