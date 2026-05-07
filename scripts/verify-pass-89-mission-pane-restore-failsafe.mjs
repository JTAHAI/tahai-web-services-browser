#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function need(condition, message) {
  if (!condition) {
    console.error(`FAIL PASS89: ${message}`);
    process.exit(1);
  }
}
function includes(rel, needle) {
  need(read(rel).includes(needle), `${rel} missing ${needle}`);
}

const app = read('src/renderer/app.ts');
const css = read('src/renderer/styles/browser.css');
const pkg = JSON.parse(read('package.json'));

for (const token of [
  'PASS89 Mission Pane Restore Failsafe',
  'type Pass89RestoreIssue',
  'pass89PromoteLayoutForPane',
  'pass89RepairActivePaneRestore',
  'pass89ClearPaneMoveOverlays',
  'pass89EnsureMoveControlContracts',
  'pass89RunMissionPaneRestoreFailsafe',
  'pass89CopyMissionPaneRestoreReport',
  'pass89ScheduleMissionPaneRestoreFailsafe',
  'pass89MountMissionPaneRestoreFailsafe',
  'document.body.dataset.pass89LastLayoutPromotion',
  'document.body.dataset.pass89HiddenPaneAssignmentCount',
  'Ctrl+Alt+Shift+G',
  'mission-pane-restore-failsafe',
  'copy-mission-pane-restore-report'
]) includes('src/renderer/app.ts', token);

for (const token of [
  'pass89PromoteLayoutForPane(paneId, options.activateLayout ? \'active-tab-pane-upsert\'',
  'pass89PromoteLayoutForPane(requestedPane, \'set-active-pane\')',
  'pass89PromoteLayoutForPane(targetPane, \'mission-tab-move\')',
  'pass89ScheduleMissionPaneRestoreFailsafe(\'set-layout\')',
  'pass89ScheduleMissionPaneRestoreFailsafe(\'mission-tab-move\')',
  'pass89MountMissionPaneRestoreFailsafe();'
]) includes('src/renderer/app.ts', token);

for (const command of [
  'active-pane-routing-failsafe',
  'copy-active-pane-routing-report',
  'mission-pane-restore-failsafe',
  'copy-mission-pane-restore-report'
]) {
  const count = (app.match(new RegExp(`id: '${command}'`, 'g')) || []).length;
  need(count === 1, `command ${command} must exist exactly once in Command Center, found ${count}`);
}

for (const shortcut of ['Ctrl+Alt+Shift+P', 'Ctrl+Alt+Shift+G']) {
  need(app.includes(`shortcut: '${shortcut}'`), `Command Center missing shortcut ${shortcut}`);
  need(app.includes(`[\'${shortcut}\'`) || app.includes(`["${shortcut}"`) || app.includes(`['${shortcut}'`), `shortcut dialog missing ${shortcut}`);
}

for (const token of [
  'PASS89 mission pane restore failsafe',
  'body.pass89-pane-restore-warning #statusbar',
  '[data-pass89-pane-restore="layout-promotes-hidden-target"]:focus-visible',
  '.mission-pane-shell[data-pass89-pane-restore="layout-promotes-hidden-target"].mission-active-pane'
]) need(css.includes(token), `CSS missing ${token}`);

const script = String(pkg.scripts?.['verify:pass-89-mission-pane-restore-failsafe'] || '');
need(script.includes('verify-pass-89-mission-pane-restore-failsafe.mjs'), 'package script missing PASS89 verifier');
need(String(pkg.scripts?.['verify:release-blockers'] || '').includes('verify:pass-89-mission-pane-restore-failsafe'), 'verify:release-blockers missing PASS89 verifier');

console.log('PASS89 mission pane restore failsafe verified');
