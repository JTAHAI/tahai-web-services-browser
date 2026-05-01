#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const errors = [];
const add = (message) => errors.push(message);
const exists = (rel) => fs.existsSync(path.join(root, rel));
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const json = (rel) => JSON.parse(read(rel));

const pkg = json('package.json');
const lock = json('package-lock.json');
const yml = read('electron-builder.yml');
const friendRelease = read('scripts/create-friend-feedback-release.ps1');

if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(pkg.version)) add(`package version is not semver-ish: ${pkg.version}`);
if (lock.version !== pkg.version) add(`package-lock top-level version mismatch: ${lock.version} != ${pkg.version}`);
if (lock.packages?.['']?.version !== pkg.version) add(`package-lock package version mismatch: ${lock.packages?.['']?.version} != ${pkg.version}`);
if (lock.packages?.['']?.name !== pkg.name) add('package-lock root package name mismatch');
if (lock.packages?.['']?.license !== 'Apache-2.0') add('package-lock root license must be Apache-2.0');

const packageBuild = pkg.build || {};
const expected = {
  appId: 'com.tahai.webservices.browser',
  productName: 'TAHAI Web Services Browser',
  executableName: 'TAHAI Web Services Browser',
  homepage: 'https://browser.tahai.net'
};
if (packageBuild.appId !== expected.appId) add(`package build appId mismatch: ${packageBuild.appId}`);
if (packageBuild.productName !== expected.productName) add(`package build productName mismatch: ${packageBuild.productName}`);
if (pkg.productName !== expected.productName) add(`package productName mismatch: ${pkg.productName}`);
if (pkg.homepage !== expected.homepage) add(`package homepage mismatch: ${pkg.homepage}`);
if (packageBuild.executableName !== expected.executableName) add(`package executableName mismatch: ${packageBuild.executableName}`);
if (packageBuild.directories?.output !== 'release') add('package build output directory must be release');
if (packageBuild.win?.icon !== 'build/icon.ico') add('package build Windows icon must be build/icon.ico');
if (packageBuild.nsis?.shortcutName !== expected.productName) add('package NSIS shortcutName mismatch');
if (packageBuild.asar !== true) add('package build asar must be true');
if (packageBuild.compression !== 'maximum') add('package build compression must be maximum');
if (packageBuild.publish !== null) add('package build publish must be null for public-source release truth');
if (packageBuild.removePackageScripts !== true) add('package build removePackageScripts must be true');
if (packageBuild.nodeGypRebuild !== false) add('package build nodeGypRebuild must be false');

for (const token of [
  'appId: com.tahai.webservices.browser',
  'productName: TAHAI Web Services Browser',
  'artifactName: TAHAI-Web-Services-Browser-${version}-${arch}.${ext}',
  'from: browser',
  'to: browser',
  'icon: build/icon.ico',
  'publish: null',
  'asar: true',
  'compression: maximum'
]) {
  if (!yml.includes(token)) add(`electron-builder.yml missing truth token: ${token}`);
}
if (/appId:\s*net\.tahai\.browser/.test(yml)) add('electron-builder.yml still contains stale net.tahai.browser appId');
if (/buildVersion:\s*1\.1\.0/.test(yml)) add('electron-builder.yml still contains stale hard-coded buildVersion');
if (/from:\s*\.\.\//.test(yml) || /from:\s*\.\.\\/.test(yml)) add('electron-builder.yml must not package from parent directories');

const scriptFilePattern = /(?:node|python)\s+([^&|\n]+?\.(?:mjs|js|py))|(?:-File)\s+([^&|\n]+?\.ps1)/gi;
for (const [name, commandValue] of Object.entries(pkg.scripts || {})) {
  const command = String(commandValue);
  if (/\.\.\\packaging|\.\.\/packaging|\.\.\\scripts|\.\.\/scripts/.test(command)) add(`package script ${name} reaches outside app root: ${command}`);
  for (const match of command.matchAll(scriptFilePattern)) {
    let scriptPath = (match[1] || match[2]).trim().replace(/^['\"]|['\"]$/g, '');
    scriptPath = scriptPath.replace(/^\.\\/, '').replace(/^\.\//, '').replace(/\\/g, '/');
    if (scriptPath.startsWith('..')) {
      add(`package script ${name} references parent path: ${scriptPath}`);
      continue;
    }
    if (!exists(scriptPath)) add(`package script ${name} references missing file: ${scriptPath}`);
  }
}

for (const rel of [
  'packaging/windows/clean-release-windows.ps1',
  'packaging/windows/build-windows-unpacked-zip.ps1',
  'packaging/windows/build-windows-msi.ps1',
  'scripts/clean-local-generated.ps1',
  'scripts/create-friend-feedback-release.ps1',
  'scripts/verify-builder-truth.mjs'
]) {
  if (!exists(rel)) add(`missing release/builder file: ${rel}`);
}

for (const token of ['release-build-truth.json', 'SHA256SUMS.txt', 'README-FIRST.txt', '$Version', 'Get-ChildItem']) {
  if (!friendRelease.includes(token)) add(`friend feedback release script missing token: ${token}`);
}
if (/1\.8\.[0-9]+/.test(friendRelease)) add('friend feedback release script must not hard-code an app version');
if (!friendRelease.includes('Resolve-ReleaseArtifact')) add('friend feedback release script must resolve artifacts from current build truth');

if (errors.length) {
  for (const error of errors) console.error(`TAHAI_BUILDER_TRUTH_ERROR=${error}`);
  process.exit(1);
}
console.log(`TAHAI_BUILDER_TRUTH=OK version=${pkg.version}`);
