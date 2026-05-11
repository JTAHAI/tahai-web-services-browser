#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];
const fail = (message) => errors.push(message);
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = (relative) => fs.existsSync(path.join(root, relative));

for (const file of [
  'scripts/write-windows-installer-handoff.mjs',
  'scripts/verify-windows-installer-handoff.mjs',
  'scripts/verify-pass-138-windows-installer-closeout.mjs',
  'docs/windows-installer-closeout-pass138.md',
  'PASS_138_WINDOWS_INSTALLER_CLOSEOUT_SUMMARY.md',
]) {
  if (!exists(file)) fail(`missing ${file}`);
}

const pkg = JSON.parse(read('package.json'));
const scripts = pkg.scripts || {};
for (const name of [
  'release:win:manifest',
  'verify:windows-installer-handoff',
  'verify:pass-138-windows-installer-closeout',
]) {
  if (!scripts[name]) fail(`missing package script ${name}`);
}

if (!scripts['package:win:release']?.includes('electron-builder --win nsis msi --x64')) {
  fail('package:win:release must build NSIS + MSI together');
}
if (!scripts['package:win:release']?.includes('release:win:manifest -- all')) {
  fail('package:win:release must write all-target Windows handoff manifest');
}
if (!scripts['package:win:installer']?.includes('release:win:manifest -- nsis')) {
  fail('package:win:installer must write target-specific NSIS handoff manifest');
}
if (!scripts['package:win:installer']?.includes('verify:windows-installer-handoff -- nsis')) {
  fail('package:win:installer must verify target-specific NSIS handoff manifest');
}
if (!scripts['package:win:nsis']?.includes('release:win:manifest -- nsis')) {
  fail('package:win:nsis must write target-specific NSIS handoff manifest');
}
if (!scripts['package:win:msi']?.includes('build-windows-msi.ps1')) {
  fail('package:win:msi must preserve the Windows MSI packaging lane');
}
if (!scripts['verify:package:msi']?.includes('verify-msi-package.mjs')) {
  fail('verify:package:msi must verify MSI package output');
}
if (!scripts['verify:release-blockers']?.includes('verify:pass-138-windows-installer-closeout')) {
  fail('verify:release-blockers must include PASS138 before PASS139+ release closeout gates');
}

const writer = read('scripts/write-windows-installer-handoff.mjs');
for (const token of [
  'TAHAI-Windows-installers-SHA256SUMS.txt',
  'TAHAI-Windows-installers-manifest.json',
  'TAHAI-Windows-installers-manifest.txt',
  'TAHAI-Web-Services-Browser-${pkg.version}-x64.exe',
  'TAHAI-Web-Services-Browser-${pkg.version}-x64.msi',
  "target === 'msi'",
  "target === 'nsis'",
  'TAHAI_WINDOWS_HANDOFF_WRITE=OK',
]) {
  if (!writer.includes(token)) fail(`Windows handoff writer missing token: ${token}`);
}

const verifier = read('scripts/verify-windows-installer-handoff.mjs');
for (const token of [
  'release/windows',
  'manifest.pass !== \'PASS138\'',
  'manifest.version !== pkg.version',
  'TAHAI-Web-Services-Browser-${pkg.version}-x64.${ext}',
  'Windows installer handoff verified',
]) {
  if (!verifier.includes(token)) fail(`Windows handoff verifier missing token: ${token}`);
}

const msiVerifier = read('scripts/verify-msi-package.mjs');
if (!msiVerifier.includes('TAHAI-Windows-installers-manifest.json')) {
  fail('MSI verifier must use PASS138 handoff output instead of stale filename-only assumptions');
}
if (!msiVerifier.includes('target === \'msi\'')) {
  fail('MSI verifier must locate the MSI through the PASS138 manifest target');
}

const msiBuilder = read('packaging/windows/build-windows-msi.ps1');
if (!msiBuilder.includes('npm run release:win:manifest -- msi')) {
  fail('MSI-only lane must write target-specific PASS138 Windows handoff');
}
if (!msiBuilder.includes('npm run verify:windows-installer-handoff -- msi')) {
  fail('MSI-only lane must verify target-specific PASS138 Windows handoff');
}

const friendZip = read('scripts/create-friend-feedback-release.ps1');
for (const token of [
  'TAHAI-Windows-installers-SHA256SUMS.txt',
  'TAHAI-Windows-installers-manifest.json',
  'TAHAI-Windows-installers-manifest.txt',
  'release\\windows',
]) {
  if (!friendZip.includes(token)) fail(`friend-feedback ZIP lane missing Windows handoff token: ${token}`);
}

const docs = read('docs/windows-installer-closeout-pass138.md') + read('PASS_138_WINDOWS_INSTALLER_CLOSEOUT_SUMMARY.md');
for (const token of [
  'PASS138',
  'release/windows',
  'TAHAI-Windows-installers-SHA256SUMS.txt',
  'TAHAI-Windows-installers-manifest.json',
  'TAHAI-Windows-installers-manifest.txt',
  'target-specific',
  'NSIS',
  'MSI',
]) {
  if (!docs.includes(token)) fail(`PASS138 docs missing token: ${token}`);
}

for (const generatedPath of ['release/windows']) {
  if (exists(generatedPath)) fail(`generated Windows handoff output must not be present in source verification: ${generatedPath}`);
}

if (errors.length) {
  for (const error of errors) console.error(`[PASS138][FAIL] ${error}`);
  process.exit(1);
}
console.log('[PASS138][OK] Windows installer closeout verified.');
