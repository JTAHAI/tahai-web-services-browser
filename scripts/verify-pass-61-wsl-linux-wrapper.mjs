#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];
const fail = (message) => errors.push(message);
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/^\uFEFF/, '');
const exists = (rel) => fs.existsSync(path.join(root, rel));

for (const rel of [
  'packaging/windows/build-linux-installers-wsl.ps1',
  'scripts/build-linux-installers.sh',
  'scripts/verify-linux-native-build-guard.mjs',
  'scripts/verify-linux-installers-config.mjs',
  'package.json'
]) {
  if (!exists(rel)) fail(`missing ${rel}`);
}

const wrapper = exists('packaging/windows/build-linux-installers-wsl.ps1') ? read('packaging/windows/build-linux-installers-wsl.ps1') : '';
const pkg = exists('package.json') ? JSON.parse(read('package.json')) : { scripts: {} };
const buildScript = exists('scripts/build-linux-installers.sh') ? read('scripts/build-linux-installers.sh') : '';

for (const token of [
  'PASS 61',
  'Ubuntu-24.04',
  'C:\\dev\\browser\\app',
  'wsl.exe -d $Distro',
  '--cd $wslPath',
  'bash scripts/build-linux-installers.sh',
  'TAHAI_WSL_LINUX_BUILD_PREFLIGHT',
  'TAHAI_WSL_LINUX_BUILD_ARTIFACT',
  'TAHAI-Web-Services-Browser-1.8.30-x64.AppImage',
  'TAHAI-Web-Services-Browser-1.8.30-x64.deb',
  'TAHAI-Web-Services-Browser-1.8.30-x64.rpm',
  'TAHAI-Linux-installers-manifest.txt',
]) {
  if (!wrapper.includes(token)) fail(`Windows WSL wrapper missing token: ${token}`);
}

if (!pkg.scripts?.['wsl:linux:release']) fail('package.json missing script wsl:linux:release');
if (!pkg.scripts?.['verify:pass-61-wsl-linux-wrapper']) fail('package.json missing script verify:pass-61-wsl-linux-wrapper');
if (!String(pkg.scripts?.['verify:release-blockers'] || '').includes('verify:pass-61-wsl-linux-wrapper')) {
  fail('verify:release-blockers must include verify:pass-61-wsl-linux-wrapper');
}

for (const [name, command] of Object.entries(pkg.scripts || {})) {
  if (name.startsWith('package:linux') && !String(command).includes('bash scripts/build-linux-installers.sh')) {
    fail(`${name} must still route through Linux-native bash script, found: ${command}`);
  }
}

for (const token of [
  'clean_path_force "$NATIVE_BUILD_DIR"',
  'TAHAI_LINUX_NATIVE_BUILD_ACTIVE=1',
  'DIST_MAIN_MISSING',
  'TAHAI-Linux-installers-manifest.txt',
]) {
  if (!buildScript.includes(token)) fail(`build-linux-installers.sh missing pass60 guard token: ${token}`);
}

if (errors.length) {
  for (const error of errors) console.error(`PASS61_WSL_LINUX_WRAPPER_VERIFY_FAIL=${error}`);
  process.exit(1);
}

console.log('PASS61_WSL_LINUX_WRAPPER_VERIFY=OK');
