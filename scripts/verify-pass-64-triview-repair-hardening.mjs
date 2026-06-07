#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const errors = [];
const fail = (message) => errors.push(message);
const exists = (relPath) => fs.existsSync(path.join(root, relPath));
const read = (relPath) => fs.readFileSync(path.join(root, relPath), 'utf8').replace(/^\uFEFF/, '');

for (const rel of ['src/renderer/app.ts', 'src/renderer/styles/browser.css', 'package.json']) {
  if (!exists(rel)) fail(`missing ${rel}`);
}
if (!exists('scripts/apply-pass64-triview-repair-hardening.mjs')) fail('missing PASS64 apply script');
if (!exists('scripts/verify-pass-64-triview-repair-hardening.mjs')) fail('missing PASS64 verifier');

if (exists('src/renderer/app.ts')) {
  const app = read('src/renderer/app.ts');
  if (app.includes("'layout-changed'") || app.includes('"layout-changed"')) {
    fail('src/renderer/app.ts still contains invalid layout-changed timeline event literal');
  }
  for (const token of [
    'PASS 64 Tri-view repair and pane drag hardening',
    'PASS 63 Tri-view asymmetry and pane drag reorder',
    'pass63SwapMissionPanes',
    'pass63SetMissionLayout',
    'pass63MountMissionPaneDragReorder',
    'pass64ClosestDragHandle',
    'pass64ScheduleMissionPaneRefresh',
    'application/x-tahai-mission-pane',
    'data-pass63-mission-pane-id',
    'data-pass63-drag-handle',
    'pass63ReorderableLayoutTypes',
    'MutationObserver',
    'layout-set',
  ]) {
    if (!app.includes(token)) fail(`src/renderer/app.ts missing PASS64 token: ${token}`);
  }
  for (const layout of ['triple-top', 'triple-bottom', 'triple-left', 'triple-right']) {
    if (!app.includes(`'${layout}'`) && !app.includes(`"${layout}"`)) {
      fail(`src/renderer/app.ts missing asymmetric Tri View layout: ${layout}`);
    }
  }
  if (/if \(count === 3\) return ['"]triple['"];/.test(app)) {
    fail('3-pane auto-refactor still returns legacy equal-size triple instead of asymmetric triple-bottom');
  }
  if (/element\.toggleAttribute\(['"]draggable['"]/.test(app)) {
    fail('pane containers are still directly draggable; drag must start from the handle only');
  }
  if (/window\.setInterval\(\(\) => \{[\s\S]{0,500}pass63RefreshMissionPaneDragTargets\(\)[\s\S]{0,100}\},\s*800\)/.test(app)) {
    fail('old PASS63 800ms full refresh loop is still present');
  }
}

if (exists('src/renderer/styles/browser.css')) {
  const css = read('src/renderer/styles/browser.css');
  for (const token of [
    'PASS 64 Tri-view repair and pane drag hardening',
    'PASS 63 Tri-view asymmetry and pane drag reorder',
    'data-pass63-mission-layout="triple-top"',
    'data-pass63-mission-layout="triple-bottom"',
    'data-pass63-mission-layout="triple-left"',
    'data-pass63-mission-layout="triple-right"',
    '.mission-pane-drag-handle',
    '.pass63-mission-pane-drop-target',
    '.pass63-triview-upgrade-controls',
  ]) {
    if (!css.includes(token)) fail(`src/renderer/styles/browser.css missing PASS64 CSS token: ${token}`);
  }
}

if (exists('package.json')) {
  const pkg = JSON.parse(read('package.json'));
  for (const scriptName of ['pass64:apply', 'verify:pass-64-triview-repair-hardening', 'pass63:apply', 'verify:pass-63-triview-pane-reorder']) {
    if (!pkg.scripts?.[scriptName]) fail(`package.json missing ${scriptName} script`);
  }
  const blockers = getReleaseBlockersContract(pkg);
  if (blockers && !blockers.includes('verify:pass-64-triview-repair-hardening')) {
    fail('verify:release-blockers does not include PASS64 verifier');
  }
}

for (const rel of ['scripts/apply-pass59-mission-pane-close-polish.mjs', 'scripts/apply-pass62-layout-event-type-fix.mjs']) {
  if (!exists(rel)) continue;
  const text = read(rel);
  if (text.includes("'layout-changed'") || text.includes('"layout-changed"')) {
    fail(`${rel} can reintroduce invalid layout-changed event literal`);
  }
  if (/if \(count === 3\) return ['"]triple['"];/.test(text)) {
    fail(`${rel} can reintroduce equal-size legacy triple on pane close`);
  }
}

if (errors.length) {
  for (const error of errors) console.error(`PASS64_TRIVIEW_REPAIR_HARDENING_ERROR=${error}`);
  process.exit(1);
}

console.log('PASS64_TRIVIEW_REPAIR_HARDENING=OK');
