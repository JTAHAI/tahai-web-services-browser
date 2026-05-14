#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const tagName = 'v2.0.0';
const message = 'TAHAI Web Services Browser 2.0.0';
function fail(messageText, code = 1) { console.error(`[STORE-TAG][FAIL] ${messageText}`); process.exit(code); }
function run(args) { return spawnSync('git', args, { encoding: 'utf8' }); }
function trim(value) { return String(value || '').trim(); }
function must(args, label) {
  const result = run(args);
  if (result.status !== 0) fail(`${label} failed: ${trim(result.stderr) || trim(result.stdout) || args.join(' ')}`);
  return result;
}

if (!fs.existsSync('.git')) fail('No .git directory found. Run this from C:\\dev\\browser\\app after overlay.', 2);
const status = must(['status', '--porcelain'], 'git status');
if (trim(status.stdout)) fail('Working tree is not clean. Commit the current PASS first, then retag.');
const head = trim(must(['rev-parse', '--short', 'HEAD'], 'git rev-parse HEAD').stdout);
const current = run(['rev-parse', '--verify', '--short', `refs/tags/${tagName}`]);
if (current.status === 0 && trim(current.stdout) === head) {
  console.log(`[STORE-TAG][OK] ${tagName} already points at HEAD ${head}.`);
  process.exit(0);
}
if (current.status === 0) {
  console.log(`[STORE-TAG][INFO] Moving local ${tagName} from ${trim(current.stdout)} to HEAD ${head}.`);
  must(['tag', '-d', tagName], `delete old local ${tagName}`);
} else {
  console.log(`[STORE-TAG][INFO] Creating local ${tagName} at HEAD ${head}.`);
}
must(['tag', '-a', tagName, '-m', message], `create ${tagName}`);
console.log(`[STORE-TAG][OK] Local ${tagName} now points at HEAD ${head}.`);
console.log('[STORE-TAG][NOTE] This did not push tags. If an older remote tag exists, move it only deliberately.');
