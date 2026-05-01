#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];
const fail = (message) => errors.push(message);
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const json = (rel) => JSON.parse(read(rel));
const exists = (rel) => fs.existsSync(path.join(root, rel));

const pkg = json('package.json');
const lock = json('package-lock.json');
const yml = read('electron-builder.yml');
const bash = read('scripts/build-linux-installers.sh');
const envAssert = exists('scripts/assert-linux-native-build-env.mjs') ? read('scripts/assert-linux-native-build-env.mjs') : '';

if (pkg.version !== '1.8.30') fail(`package version must be 1.8.30 for PASS56/PASS57, found ${pkg.version}`);
if (lock.version !== pkg.version) fail(`package-lock top-level version mismatch: ${lock.version} != ${pkg.version}`);
if (lock.packages?.['']?.version !== pkg.version) fail(`package-lock package version mismatch: ${lock.packages?.['']?.version} != ${pkg.version}`);

if (/publisherName\s*:/.test(yml)) fail('electron-builder.yml must not contain win.publisherName; electron-builder 26 rejects it');
if (pkg.build?.win && Object.prototype.hasOwnProperty.call(pkg.build.win, 'publisherName')) {
  fail('package.json build.win.publisherName must be removed; electron-builder 26 rejects it');
}

for (const token of [
  'linux:',
  'maintainer: TAHAI Web Services',
  'category: Network',
  '- AppImage',
  '- deb',
  '- rpm',
]) {
  if (!yml.includes(token)) fail(`electron-builder.yml missing Linux packaging token: ${token}`);
}

for (const [name, command] of Object.entries(pkg.scripts || {})) {
  if (name.startsWith('package:linux') && !String(command).includes('electron-builder') && name !== 'package:linux:wsl') {
    fail(`Linux package script does not call electron-builder: ${name}`);
  }
}

for (const required of [
  'package:linux:appimage',
  'package:linux:deb',
  'package:linux:rpm',
  'package:linux:release',
  'package:linux:wsl',
  'verify:package:linux',
]) {
  if (!pkg.scripts?.[required]) fail(`missing package script: ${required}`);
}

for (const token of [
  'CSC_IDENTITY_AUTO_DISCOVERY=false',
  'electron-builder --linux',
  'AppImage',
  'deb',
  'rpm',
  'verify:package:linux',
  'TAHAI_LINUX_NATIVE_BUILD_DIR',
  'rsync -a --delete',
  '--exclude node_modules',
  '--exclude dist',
  '--exclude release',
  'TAHAI_LINUX_SOURCE_ROOT',
  'exec env',
  '/usr/bin/node',
  '/usr/bin/npm',
  'assert-linux-native-build-env.mjs',
  'LINUX_NODE_DEPS_OK',
  'DIST_MAIN_MISSING',
  'release/linux',
]) {
  if (!bash.includes(token)) fail(`Linux WSL build script missing token: ${token}`);
}

if (!envAssert) fail('missing scripts/assert-linux-native-build-env.mjs');
for (const token of [
  "process.platform !== 'linux'",
  'Linux installer packaging must run from a Linux-native folder',
  '/mnt/',
  '.exe',
  'npm_execpath',
  'PATH contains a Windows/interop segment',
  'TAHAI_LINUX_NATIVE_BUILD_ENV=OK',
]) {
  if (!envAssert.includes(token)) fail(`Linux native build env verifier missing token: ${token}`);
}

if (errors.length) {
  for (const error of errors) console.error(`TAHAI_LINUX_INSTALLERS_CONFIG_ERROR=${error}`);
  process.exit(1);
}

console.log(`TAHAI_LINUX_INSTALLERS_CONFIG=OK version=${pkg.version}`);
