#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/^\uFEFF/, '');
const json = (rel) => JSON.parse(read(rel));
const fail = (message) => errors.push(message);

const pkg = json('package.json');
const buildScript = read('scripts/build-linux-installers.sh');
const envAssert = read('scripts/assert-linux-native-build-env.mjs');
const configVerifier = read('scripts/verify-linux-installers-config.mjs');

const linuxPackageScripts = Object.entries(pkg.scripts || {}).filter(([name]) => name.startsWith('package:linux'));
for (const [name, command] of linuxPackageScripts) {
  const commandText = String(command);
  if (!commandText.includes('bash scripts/build-linux-installers.sh')) {
    fail(`${name} must route through scripts/build-linux-installers.sh; found ${commandText}`);
  }
  if (name !== 'package:linux:wsl' && commandText.includes('electron-builder')) {
    fail(`${name} must not bypass the Linux-native mirror guard with a direct electron-builder call`);
  }
}

for (const token of [
  'PASS 60 Linux installer hardening',
  'export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"',
  'clean_path_force "$NATIVE_BUILD_DIR"',
  'sudo rm -rf "$target"',
  'rsync -a --delete',
  '--exclude node_modules',
  '--exclude dist',
  '--exclude release',
  'TAHAI_LINUX_SOURCE_ROOT',
  'TAHAI_LINUX_NATIVE_BUILD_ACTIVE=1',
  '/usr/bin/node',
  '/usr/bin/npm',
  'Node 22.12+ is required',
  'assert-linux-native-build-env.mjs',
  'require.resolve(\'yargs\')',
  'DIST_MAIN_MISSING',
  'electron-builder --linux',
  'TAHAI-Linux-installers-manifest.txt',
  'release/linux',
]) {
  if (!buildScript.includes(token)) fail(`build-linux-installers.sh missing guard token: ${token}`);
}

for (const token of [
  "process.platform !== 'linux'",
  'Linux installer packaging must run from a Linux-native folder',
  'node must be the Linux node binary',
  'npm must be the Linux npm CLI',
  'PATH contains a Windows/interop segment',
  'TAHAI_LINUX_NATIVE_BUILD_ENV=OK',
]) {
  if (!envAssert.includes(token)) fail(`assert-linux-native-build-env.mjs missing guard token: ${token}`);
}

for (const token of [
  'verify:linux-native-build-guard',
  'bash scripts/build-linux-installers.sh',
  'package:linux:release',
  'package:linux:appimage',
  'package:linux:deb',
  'package:linux:rpm',
]) {
  if (!configVerifier.includes(token) && !JSON.stringify(pkg.scripts || {}).includes(token)) {
    fail(`Linux config verifier/package scripts missing token: ${token}`);
  }
}

if (errors.length) {
  for (const error of errors) console.error(`TAHAI_LINUX_NATIVE_BUILD_GUARD_ERROR=${error}`);
  process.exit(1);
}

console.log(`TAHAI_LINUX_NATIVE_BUILD_GUARD=OK linuxPackageScripts=${linuxPackageScripts.length}`);
