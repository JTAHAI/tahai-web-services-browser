#!/usr/bin/env node
/* PASS271-R2 — fail-closed verifier Windows path repair gate */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const pass = 'PASS271_R2';
const staticOnly = process.argv.includes('--static-only');
const r1VerifyPath = path.join(root, 'scripts', 'verify-pass271-r1-typescript-build-blocker-closeout.mjs');
const r2ApplyPath = path.join(root, 'scripts', 'apply-pass271-r2-verifier-windows-path-repair.mjs');
const r2VerifyPath = path.join(root, 'scripts', 'verify-pass271-r2-verifier-windows-path-repair.mjs');
const packagePath = path.join(root, 'package.json');

function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

function fail(message) {
  console.error(`${pass}=FAIL`);
  console.error(message);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function runProcess(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: false, ...options });
  if (result.error) {
    console.error(result.error.message);
    return 1;
  }
  return typeof result.status === 'number' ? result.status : 1;
}

function checkScriptSyntax(file) {
  assert(fs.existsSync(file), `Missing script: ${path.relative(root, file)}`);
  const code = runProcess(process.execPath, ['--check', file]);
  assert(code === 0, `Syntax check failed: ${path.relative(root, file)}`);
}

assert(fs.existsSync(r1VerifyPath), 'Missing PASS271-R1 verifier');
assert(fs.existsSync(packagePath), 'Missing package.json');

const r1Verifier = readText(r1VerifyPath);
const pkg = JSON.parse(readText(packagePath));
const scripts = pkg.scripts || {};

const checks = [
  ['r1-uses-shell-free-runProcess', r1Verifier.includes('function runProcess(command, args, options = {})')],
  ['r1-syntax-check-uses-process-execpath-without-shell', r1Verifier.includes("runProcess(process.execPath, ['--check', file])")],
  ['r1-windows-npm-uses-cmd-wrapper', r1Verifier.includes("return runProcess('cmd.exe', ['/d', '/s', '/c', `npm run ${scriptName}`]);")],
  ['r1-no-shell-process-platform-win32', !r1Verifier.includes("shell: process.platform === 'win32'")],
  ['r1-no-npm-cmd-spawn-pattern', !r1Verifier.includes("process.platform === 'win32' ? 'npm.cmd' : 'npm'")],
  ['r2-package-script-present', scripts['verify:pass-271-r2-verifier-windows-path-repair'] === 'node scripts/verify-pass271-r2-verifier-windows-path-repair.mjs']
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
assert(!failed.length, `Static PASS271-R2 checks failed: ${failed.join(', ')}`);

checkScriptSyntax(r2ApplyPath);
checkScriptSyntax(r2VerifyPath);
checkScriptSyntax(r1VerifyPath);

if (!staticOnly) {
  const r1Code = runProcess(process.execPath, [r1VerifyPath]);
  assert(r1Code === 0, 'PASS271-R1 verifier/build gate failed after Windows path repair.');
}

console.log(`${pass}=PASS`);
console.log(`${pass}_STATIC_CHECKS=${checks.length}`);
console.log(`${pass}_R1_GATE=${staticOnly ? 'SKIPPED_STATIC_ONLY' : 'PASS'}`);
console.log(`${pass}_VERSION=2.0.18`);
