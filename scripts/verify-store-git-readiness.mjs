#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const expected = 'v2.0.0';
function run(args) { return spawnSync('git', args, { encoding: 'utf8' }); }
if (!fs.existsSync('.git')) {
  console.error('[STORE-GIT][BLOCKED] No .git directory in this artifact. Run this in C:\\dev\\browser\\app after overlay.');
  process.exit(2);
}
let failed = false;
const status = run(['status', '--porcelain']);
if (status.status !== 0) { console.error('[STORE-GIT][FAIL] git status failed'); process.exit(1); }
if (status.stdout.trim()) {
  console.error('[STORE-GIT][FAIL] Working tree is not clean:\n' + status.stdout);
  failed = true;
}
const tag = run(['tag', '--points-at', 'HEAD']);
if (tag.status !== 0) { console.error('[STORE-GIT][FAIL] git tag check failed'); process.exit(1); }
if (!tag.stdout.split(/\r?\n/).includes(expected)) {
  console.error(`[STORE-GIT][FAIL] HEAD is not tagged ${expected}. Current HEAD tags: ${tag.stdout.trim() || '(none)'}`);
  failed = true;
}
if (failed) process.exit(1);
console.log(`[STORE-GIT][OK] Clean working tree and ${expected} tag points at HEAD.`);
