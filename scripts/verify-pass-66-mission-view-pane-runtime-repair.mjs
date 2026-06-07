#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const errors = [];
const fail = (message) => errors.push(message);
const full = (relPath) => path.join(root, relPath);
const exists = (relPath) => fs.existsSync(full(relPath));
const read = (relPath) => fs.readFileSync(full(relPath), 'utf8').replace(/^\uFEFF/, '');

for (const rel of ['src/renderer/app.ts', 'src/renderer/styles/browser.css', 'package.json']) {
  if (!exists(rel)) fail(`missing ${rel}`);
}

if (exists('src/renderer/app.ts')) {
  const app = read('src/renderer/app.ts');
  for (const token of [
    'PASS 66 Mission View pane runtime repair',
    'pass66IsActualMissionViewPane',
    'pass66IsInsideMissionControlConfigSurface',
    'pass66MissionPanePointerDragSource',
    'pass66MissionPanePointerDragging',
    'pass66MountMissionPaneKeyboardShortcuts',
    'pass66FocusMissionPaneByNumber',
    'pointerdown',
    'pointermove',
    'pointerup',
    'elementFromPoint',
    'Ctrl+Alt+',
    'event.code.match(/^(?:Digit|Numpad)([1-4])$/)',
    'pass66-mission-view-pane-grid',
    'pass66-triview-upgrade-controls',
    'querySelector<HTMLButtonElement>',
    "handle.setAttribute('type', 'button')",
    "appendMissionTimelineEvent(mission, 'layout-set'",
  ]) {
    if (!app.includes(token)) fail(`src/renderer/app.ts missing PASS66 token: ${token}`);
  }
  if (/\bhandle\.type\s*=\s*['"]button['"]\s*;/.test(app)) {
    fail('src/renderer/app.ts still assigns handle.type directly');
  }
  if (app.includes("'layout-changed'") || app.includes('"layout-changed"')) {
    fail('src/renderer/app.ts still contains invalid layout-changed event literal');
  }
  if (app.includes('window.setInterval(pass64ScheduleMissionPaneRefresh, 2000)')) {
    fail('src/renderer/app.ts still has PASS64 polling interval; MutationObserver should drive refresh');
  }
  for (const unsafeSelector of ['.mission-recipes', '.mission-evidence', '.runbook-rail', '.mission-tabs-list']) {
    if (!app.includes(unsafeSelector)) fail(`src/renderer/app.ts missing config-surface exclusion ${unsafeSelector}`);
  }
}

if (exists('src/renderer/styles/browser.css')) {
  const css = read('src/renderer/styles/browser.css');
  for (const token of [
    'PASS 66 Mission View pane runtime repair',
    '.pass66-mission-view-pane-grid.pass63-mission-layout-grid',
    'body.pass66-mission-pane-pointer-dragging webview',
    '.pass66-triview-upgrade-controls.pass63-triview-upgrade-controls',
    '.mission-recipes .mission-pane-drag-handle',
  ]) {
    if (!css.includes(token)) fail(`src/renderer/styles/browser.css missing PASS66 token: ${token}`);
  }
  if (/^\.pass63-mission-layout-grid\[data-pass63-mission-layout=/m.test(css)) {
    fail('PASS64 grid CSS is still globally scoped instead of confined to pass66 Mission View grids');
  }
}

if (exists('package.json')) {
  const pkg = JSON.parse(read('package.json'));
  if (!pkg.scripts?.['pass66:apply']) fail('package.json missing pass66:apply script');
  if (!pkg.scripts?.['verify:pass-66-mission-view-pane-runtime-repair']) fail('package.json missing PASS66 verifier script');
  const blockers = getReleaseBlockersContract(pkg);
  if (blockers && !blockers.includes('verify:pass-66-mission-view-pane-runtime-repair')) {
    fail('verify:release-blockers does not include PASS66 verifier');
  }
}

if (errors.length) {
  for (const error of errors) console.error(`PASS66_MISSION_VIEW_PANE_RUNTIME_REPAIR_ERROR=${error}`);
  process.exit(1);
}

console.log('PASS66_MISSION_VIEW_PANE_RUNTIME_REPAIR=OK');
