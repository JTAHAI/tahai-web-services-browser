#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];
const fail = (message) => errors.push(message);
const full = (relPath) => path.join(root, relPath);
const exists = (relPath) => fs.existsSync(full(relPath));
const read = (relPath) => fs.readFileSync(full(relPath), 'utf8').replace(/^\uFEFF/, '');

for (const rel of ['src/renderer/app.ts', 'scripts/apply-pass65-triview-tsdom-repair.mjs', 'scripts/verify-pass-65-triview-tsdom-repair.mjs', 'package.json']) {
  if (!exists(rel)) fail(`missing ${rel}`);
}

if (exists('src/renderer/app.ts')) {
  const app = read('src/renderer/app.ts');
  if (!app.includes('PASS 65 Tri-view DOM typing repair')) {
    fail('src/renderer/app.ts missing PASS65 marker');
  }
  if (/\bhandle\.type\s*=\s*['"]button['"]\s*;/.test(app)) {
    fail('src/renderer/app.ts still assigns handle.type directly; use setAttribute for strict DOM typings');
  }
  if (!app.includes("handle.setAttribute('type', 'button')")) {
    fail('src/renderer/app.ts missing strict-DOM-safe button type assignment');
  }
  if (!app.includes('querySelector<HTMLButtonElement>')) {
    fail('src/renderer/app.ts missing HTMLButtonElement narrowing for pane drag handle query');
  }
  for (const token of [
    'pass63MountMissionPaneDragReorder',
    'pass64ClosestDragHandle',
    'application/x-tahai-mission-pane',
    'data-pass63-drag-handle',
    'PASS 64 Tri-view repair and pane drag hardening',
  ]) {
    if (!app.includes(token)) fail(`src/renderer/app.ts missing retained Tri View reorder token: ${token}`);
  }
}

if (exists('scripts/apply-pass64-triview-repair-hardening.mjs')) {
  const pass64 = read('scripts/apply-pass64-triview-repair-hardening.mjs');
  if (/\bhandle\.type\s*=\s*['"]button['"]\s*;/.test(pass64)) {
    fail('PASS64 apply script can still reintroduce direct handle.type assignment');
  }
  if (!pass64.includes("handle.setAttribute('type', 'button')")) {
    fail('PASS64 apply script missing strict-DOM-safe button type assignment');
  }
}

if (exists('package.json')) {
  const pkg = JSON.parse(read('package.json'));
  if (!pkg.scripts?.['pass65:apply']) fail('package.json missing pass65:apply script');
  if (!pkg.scripts?.['verify:pass-65-triview-tsdom-repair']) fail('package.json missing verify:pass-65-triview-tsdom-repair script');
  const blockers = String(pkg.scripts?.['verify:release-blockers'] || '');
  if (blockers && !blockers.includes('verify:pass-65-triview-tsdom-repair')) {
    fail('verify:release-blockers does not include PASS65 verifier');
  }
}

if (errors.length) {
  for (const error of errors) console.error(`PASS65_TRIVIEW_TSDOM_REPAIR_ERROR=${error}`);
  process.exit(1);
}

console.log('PASS65_TRIVIEW_TSDOM_REPAIR=OK');
