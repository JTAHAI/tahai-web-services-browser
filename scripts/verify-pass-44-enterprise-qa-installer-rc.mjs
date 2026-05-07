#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const fail = (message) => {
  console.error(`PASS44_ENTERPRISE_QA_INSTALLER_RC_FAIL=${message}`);
  process.exit(1);
};
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));
const pkg = JSON.parse(read('package.json'));
const versionAtLeast = (actual, minimum) => {
  const parse = (v) => String(v).split(/[.-]/).slice(0, 3).map((x) => Number.parseInt(x, 10) || 0);
  const a = parse(actual), b = parse(minimum);
  for (let i = 0; i < 3; i += 1) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return true;
};
const lock = JSON.parse(read('package-lock.json'));
const passSummary = read('PASS_44_ENTERPRISE_QA_INSTALLER_RC_SUMMARY.md');
const rcDoc = read('docs/enterprise-qa-installer-rc.md');
const rcBuilder = read('packaging/windows/build-release-candidate.ps1');
const rcManifest = read('scripts/write-release-candidate-manifest.mjs');
const builderTruth = read('scripts/verify-builder-truth.mjs');
const enterpriseRelease = read('scripts/verify-enterprise-release.mjs');

const requiredFiles = [
  'docs/enterprise-qa-installer-rc.md',
  'packaging/windows/build-release-candidate.ps1',
  'scripts/write-release-candidate-manifest.mjs',
  'scripts/verify-pass-44-enterprise-qa-installer-rc.mjs',
  'PASS_44_ENTERPRISE_QA_INSTALLER_RC_SUMMARY.md',
  'electron-builder.yml',
  'build/icon.ico',
  'build/icon.png',
  'scripts/verify-public-repo.mjs',
  'scripts/verify-enterprise-release.mjs',
  'scripts/verify-builder-truth.mjs',
  'scripts/verify-mission-tabs-security.mjs'
];
for (const rel of requiredFiles) if (!exists(rel)) fail(`missing-required-file:${rel}`);

if (!versionAtLeast(pkg.version, '1.8.20')) fail(`expected-version-at-least-1.8.20-got-${pkg.version}`);
if (lock.version !== pkg.version || lock.packages?.['']?.version !== pkg.version) fail('package-lock-version-mismatch');
if (pkg.build?.compression !== 'maximum') fail('package-build-compression-must-be-maximum');
if (pkg.build?.publish !== null) fail('package-build-publish-must-be-null');
if (pkg.build?.removePackageScripts !== true) fail('package-build-removePackageScripts-must-be-true');
if (pkg.build?.nodeGypRebuild !== false) fail('package-build-nodeGypRebuild-must-be-false');

const requiredScripts = [
  'verify:public-repo',
  'verify:release-blockers',
  'verify:mission-tabs-security',
  'verify:builder-truth',
  'verify:pass-44-enterprise-qa-installer-rc',
  'release:rc:verify',
  'release:rc:win',
  'release:rc:manifest',
  'package:win:release',
  'release:friend:zip'
];
for (const scriptName of requiredScripts) if (!pkg.scripts?.[scriptName]) fail(`missing-package-script:${scriptName}`);
if (!pkg.scripts['verify:release-blockers'].includes('verify:pass-44-enterprise-qa-installer-rc')) fail('release-blockers-not-wired-to-pass44');
if (!pkg.scripts['release:rc:verify'].includes('verify:release-blockers')) fail('release-rc-verify-must-run-release-blockers');
if (!pkg.scripts['release:rc:verify'].includes('audit:runtime')) fail('release-rc-verify-must-run-runtime-audit');
if (!pkg.scripts['release:rc:verify'].includes('audit:buildchain')) fail('release-rc-verify-must-run-buildchain-audit');
if (!pkg.scripts['release:rc:win'].includes('packaging\\windows\\build-release-candidate.ps1')) fail('release-rc-win-must-call-rc-builder');
if (!pkg.scripts['release:rc:manifest'].includes('write-release-candidate-manifest.mjs')) fail('release-rc-manifest-script-missing');

const builderMustInclude = [
  'clean:release:windows',
  'verify:release-blockers',
  'package:win:release',
  'release:friend:zip',
  'release:rc:manifest',
  'SHA256SUMS.txt',
  'release-candidate-manifest.json',
  'CSC_IDENTITY_AUTO_DISCOVERY',
  'Stop-Process',
  'Get-FileHash'
];
for (const token of builderMustInclude) if (!rcBuilder.includes(token)) fail(`rc-builder-missing:${token}`);

const manifestMustInclude = [
  'release-candidate-manifest.json',
  'TAHAI Web Services Browser',
  'unsigned-preview',
  'manualWindowsGates',
  'verify:release-blockers',
  'verify:mission-tabs-security',
  'package:win:release',
  'electron-builder.yml',
  'SHA256SUMS.txt',
  'sha256'
];
for (const token of manifestMustInclude) if (!rcManifest.includes(token)) fail(`rc-manifest-missing:${token}`);

const docMustInclude = [
  'Enterprise QA and installer RC',
  'Windows installed-app gates',
  'unsigned preview',
  'No generated artifacts',
  'No PSA/API/provider secrets',
  'release:rc:verify',
  'release:rc:win',
  'release-candidate-manifest.json',
  'SHA256SUMS.txt'
];
for (const token of docMustInclude) if (!rcDoc.includes(token)) fail(`rc-doc-missing:${token}`);

for (const token of ['Enterprise QA and installer RC', '1.8.20', 'release:rc:win', 'release-candidate-manifest.json']) {
  if (!passSummary.includes(token)) fail(`summary-missing:${token}`);
}

if (!builderTruth.includes('removePackageScripts')) fail('builder-truth-must-check-removePackageScripts');
if (!enterpriseRelease.includes('removePackageScripts')) fail('enterprise-release-must-check-removePackageScripts');

const yml = read('electron-builder.yml');
for (const token of ['publish: null', 'asar: true', 'compression: maximum', 'removePackageScripts: true', 'nodeGypRebuild: false']) {
  if (!yml.includes(token)) fail(`electron-builder-missing:${token}`);
}

const generatedForbidden = [
  'release/release-candidate-manifest.json',
  'release/SHA256SUMS.txt',
  'release/release-build-truth.json',
  'artifacts/sbom/tahai-browser-sbom.json',
];
for (const rel of generatedForbidden) if (exists(rel)) fail(`generated-artifact-should-not-be-in-source:${rel}`);

console.log('PASS44_ENTERPRISE_QA_INSTALLER_RC_OK=1');
