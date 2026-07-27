#!/usr/bin/env node
/*
  PASS271-R2 — Verifier Windows Path Repair

  Purpose:
  - Repair PASS271-R1 verifier invocation on Windows where process.execPath can be
    C:\\Program Files\\nodejs\\node.exe and breaks when spawned through shell mode.
  - Keep the TypeScript/build blocker closeout intact; this pass only repairs the
    evidence gate so it can actually prove `npm run build` on Windows.
*/
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pass = 'PASS271_R2';
const r1VerifyPath = path.join(root, 'scripts', 'verify-pass271-r1-typescript-build-blocker-closeout.mjs');
const r2VerifyPath = path.join(root, 'scripts', 'verify-pass271-r2-verifier-windows-path-repair.mjs');
const packagePath = path.join(root, 'package.json');

function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

function writeText(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
}

function fail(message) {
  console.error(`${pass}=FAIL`);
  console.error(message);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function updatePackageScript() {
  assert(fs.existsSync(packagePath), 'Missing package.json');
  const pkg = JSON.parse(readText(packagePath));
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['verify:pass-271-r2-verifier-windows-path-repair'] = 'node scripts/verify-pass271-r2-verifier-windows-path-repair.mjs';
  writeText(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
}

assert(fs.existsSync(r1VerifyPath), 'Missing PASS271-R1 verifier; overlay the cumulative patch first.');
assert(fs.existsSync(r2VerifyPath), 'Missing PASS271-R2 verifier; overlay the patch ZIP at repo root first.');

const r1Verifier = readText(r1VerifyPath);
assert(r1Verifier.includes('function runProcess(command, args, options = {})'), 'PASS271-R1 verifier was not updated to use shell-free process spawning.');
assert(r1Verifier.includes("return runProcess('cmd.exe', ['/d', '/s', '/c', `npm run ${scriptName}`]);"), 'PASS271-R1 verifier was not updated to run npm through cmd.exe safely on Windows.');
assert(!r1Verifier.includes("shell: process.platform === 'win32'"), 'PASS271-R1 verifier still uses Windows shell mode for process.execPath.');
assert(!r1Verifier.includes("process.platform === 'win32' ? 'npm.cmd' : 'npm'"), 'PASS271-R1 verifier still uses the old npm.cmd spawn path.');

updatePackageScript();

console.log(`${pass}_APPLY=PASS`);
console.log(`${pass}_R1_VERIFIER_WINDOWS_PATH_REPAIR=PASS`);
console.log(`${pass}_PACKAGE_SCRIPT=updated`);
console.log(`${pass}_VERSION=2.0.18`);
