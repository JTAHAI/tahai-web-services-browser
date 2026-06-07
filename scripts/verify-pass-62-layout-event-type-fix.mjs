#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const errors = [];
const fail = (message) => errors.push(message);
const exists = (relPath) => fs.existsSync(path.join(root, relPath));
const read = (relPath) => fs.readFileSync(path.join(root, relPath), 'utf8').replace(/^\uFEFF/, '');

if (!exists('src/renderer/app.ts')) fail('missing src/renderer/app.ts');
if (!exists('scripts/apply-pass62-layout-event-type-fix.mjs')) fail('missing PASS 62 apply script');

if (exists('src/renderer/app.ts')) {
  const app = read('src/renderer/app.ts');
  if (app.includes("'layout-changed'") || app.includes('"layout-changed"')) {
    fail('src/renderer/app.ts contains invalid mission timeline event kind layout-changed; use layout-set');
  }
  if (app.includes('PASS 59 Mission pane close polish') && !app.includes("'layout-set'")) {
    fail('PASS 59 Mission pane close polish is present but does not use the valid layout-set timeline event kind');
  }
}

if (exists('scripts/apply-pass59-mission-pane-close-polish.mjs')) {
  const pass59 = read('scripts/apply-pass59-mission-pane-close-polish.mjs');
  if (pass59.includes("'layout-changed'") || pass59.includes('"layout-changed"')) {
    fail('PASS 59 apply script would reintroduce invalid layout-changed event kind');
  }
}

if (exists('package.json')) {
  const pkg = JSON.parse(read('package.json'));
  if (!pkg.scripts?.['pass62:apply']) fail('package.json missing pass62:apply script');
  if (!pkg.scripts?.['verify:pass-62-layout-event-type-fix']) fail('package.json missing verify:pass-62-layout-event-type-fix script');
  const blockers = getReleaseBlockersContract(pkg);
  if (blockers && !blockers.includes('verify:pass-62-layout-event-type-fix')) {
    fail('verify:release-blockers does not include PASS 62 verifier');
  }
}

if (errors.length) {
  for (const error of errors) console.error(`PASS62_LAYOUT_EVENT_TYPE_FIX_ERROR=${error}`);
  process.exit(1);
}

console.log('PASS62_LAYOUT_EVENT_TYPE_FIX=OK');
