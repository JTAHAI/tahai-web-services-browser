#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8').replace(/^﻿/, ''));
const expected = `v${pkg.version}`;
function run(args) { return spawnSync('git', args, { encoding: 'utf8' }); }
function trim(value) { return String(value || '').trim(); }

if (!fs.existsSync('.git')) {
  console.error('[STORE-GIT][BLOCKED] No .git directory in this artifact. Run this in C:\\dev\\browser\\app after overlay.');
  process.exit(2);
}

let failed = false;
const status = run(['status', '--porcelain']);
if (status.status !== 0) { console.error('[STORE-GIT][FAIL] git status failed'); process.exit(1); }
if (trim(status.stdout)) {
  console.error('[STORE-GIT][FAIL] Working tree is not clean:\n' + status.stdout);
  failed = true;
}

const tagAtHead = run(['tag', '--points-at', 'HEAD']);
if (tagAtHead.status !== 0) { console.error('[STORE-GIT][FAIL] git tag check failed'); process.exit(1); }
const headTags = tagAtHead.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
if (!headTags.includes(expected)) {
  const currentHead = trim(run(['rev-parse', '--short', 'HEAD']).stdout) || 'HEAD';
  const existingTag = run(['rev-parse', '--verify', '--short', `refs/tags/${expected}`]);
  const existingTarget = existingTag.status === 0 ? trim(existingTag.stdout) : '';
  if (existingTarget) {
    console.error(`[STORE-GIT][FAIL] ${expected} exists but points at ${existingTarget}, not current HEAD ${currentHead}.`);
    console.error(`[STORE-GIT][FIX] After committing the current pass, run: npm run repair:store-tag:${pkg.version}`);
    console.error(`[STORE-GIT][NOTE] This only repairs the local tag. Push/force-push the tag only if you intentionally want the public ${expected} tag moved.`);
  } else {
    console.error(`[STORE-GIT][FAIL] HEAD is not tagged ${expected}. Current HEAD tags: ${headTags.join(', ') || '(none)'}`);
    console.error(`[STORE-GIT][FIX] After committing the current pass, run: git tag -a ${expected} -m "${pkg.productName} ${pkg.version}"`);
  }
  failed = true;
}

if (failed) process.exit(1);
console.log(`[STORE-GIT][OK] Clean working tree and ${expected} tag points at HEAD.`);
