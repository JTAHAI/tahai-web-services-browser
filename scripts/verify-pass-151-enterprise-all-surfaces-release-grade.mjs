#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const errors = [];
const rel = (p) => path.join(root, p);
const exists = (p) => fs.existsSync(rel(p));
const read = (p) => fs.readFileSync(rel(p), 'utf8').replace(/^\uFEFF/, '');
const json = (p) => JSON.parse(read(p));
const need = (ok, message) => { if (!ok) errors.push(message); };
const includesAll = (file, tokens) => {
  const text = read(file);
  for (const token of tokens) need(text.includes(token), `${file} missing ${token}`);
  return text;
};

const pkg = json('package.json');
const blockers = getReleaseBlockersContract(pkg);
const releaseTruth = read('src/shared/release-truth.ts');
const aboutTruth = json('browser/about/release-truth.json');
const gaManifest = json('docs/ga-release-manifest-pass150.json');

need(pkg.version === '1.8.30', `version must remain 1.8.30 for PASS151, found ${pkg.version}`);
need(pkg.scripts?.['verify:pass-151-enterprise-all-surfaces-release-grade'] === 'node scripts/verify-pass-151-enterprise-all-surfaces-release-grade.mjs', 'package missing PASS151 verifier script');
need(pkg.scripts?.['evidence:enterprise-all-surfaces'] === 'node scripts/run-pass151-enterprise-all-surfaces-gate.mjs', 'package missing PASS151 operator evidence runner');

const pass150Idx = blockers.indexOf('verify:pass-150-final-ship-candidate');
const pass151Idx = blockers.indexOf('verify:pass-151-enterprise-all-surfaces-release-grade');
const finalBuildIdx = blockers.lastIndexOf('npm run build');
need(pass150Idx >= 0, 'release blockers must still include PASS150 verifier');
need(pass151Idx >= 0, 'release blockers must include PASS151 enterprise all-surfaces gate');
need(pass151Idx > pass150Idx, 'PASS151 gate must run after PASS150 final ship candidate');
need(finalBuildIdx > pass151Idx, 'PASS151 gate must run before final build');

for (const script of [
  'verify:pass-138-windows-installer-closeout',
  'verify:pass-139-linux-package-handoff-closeout',
  'verify:pass-140-download-install-checksum-ux',
  'verify:pass-141-version-about-update-channel-truth',
  'verify:pass-142-electron-security-final-audit',
  'verify:pass-143-mission-redaction-closeout',
  'verify:pass-144-public-repo-supply-chain',
  'verify:pass-145-privacy-support-known-issues',
  'verify:pass-146-windows-installed-smoke',
  'verify:pass-147-linux-installed-smoke',
  'verify:pass-148-cross-size-responsive-regression',
  'verify:pass-149-rc1-freeze',
  'verify:pass-150-final-ship-candidate',
  'verify:pass-151-enterprise-all-surfaces-release-grade',
]) {
  need(blockers.includes(script), `release blockers missing enterprise continuity script: ${script}`);
}

for (const script of [
  'evidence:windows-installed-smoke',
  'evidence:linux-installed-smoke',
  'evidence:cross-size-regression',
  'evidence:enterprise-all-surfaces',
]) {
  need(pkg.scripts?.[script], `package missing manual evidence runner: ${script}`);
}

for (const file of [
  'src/shared/enterprise-all-surfaces-release-grade-contract.ts',
  'scripts/run-pass151-enterprise-all-surfaces-gate.mjs',
  'scripts/verify-pass-151-enterprise-all-surfaces-release-grade.mjs',
  'docs/enterprise-all-surfaces-release-grade-pass151.md',
  'docs/enterprise-release-grade-checklist-pass151.md',
  'PASS_151_ENTERPRISE_ALL_SURFACES_RELEASE_GRADE_SUMMARY.md',
]) {
  need(exists(file), `missing PASS151 file: ${file}`);
}

includesAll('src/shared/enterprise-all-surfaces-release-grade-contract.ts', [
  'ENTERPRISE_ALL_SURFACES_GATE_PASS',
  'PASS151',
  'enterprise-all-surfaces-release-grade',
  'ENTERPRISE_ALL_SURFACES_BASE_RELEASE_PASS',
  'PASS150',
  'verify:pass-138-windows-installer-closeout',
  'verify:pass-150-final-ship-candidate',
  'verify:pass-151-enterprise-all-surfaces-release-grade',
  'evidence:windows-installed-smoke',
  'evidence:linux-installed-smoke',
  'evidence:cross-size-regression',
  'tabs-titlebar-chrome-and-full-empty-titlebar-drag-region',
  'generated-artifact-in-source',
  'silent-auto-update-or-telemetry-added',
  'direct-psa-api-or-itdocs-backend-scope-creep',
]);

includesAll('scripts/run-pass151-enterprise-all-surfaces-gate.mjs', [
  'PASS151-enterprise-all-surfaces-evidence.json',
  'PASS151-enterprise-all-surfaces-evidence.md',
  '--strict',
  'release/windows/TAHAI-Windows-installers-manifest.json',
  'release/linux/TAHAI-Linux-installers-manifest.json',
  'artifacts/windows-installed-smoke/PASS146-windows-installed-smoke-evidence.json',
  'artifacts/linux-installed-smoke/PASS147-linux-installed-smoke-evidence.json',
  'artifacts/cross-size-responsive-regression/PASS148-cross-size-responsive-regression-evidence.json',
  'Do not call this an enterprise release until the missing package handoffs and manual installed-app evidence are captured',
]);

includesAll('docs/enterprise-all-surfaces-release-grade-pass151.md', [
  'PASS151',
  'Enterprise All-Surfaces Release Grade Gate',
  'This is not a new feature pass',
  'source gates',
  'Windows installed-app smoke',
  'Linux installed-package smoke',
  'cross-size responsive regression',
  'titlebar drag',
  'Do not call the build enterprise release grade',
]);

includesAll('docs/enterprise-release-grade-checklist-pass151.md', [
  'PASS151 Enterprise Release Grade Checklist',
  'Source gate',
  'Windows packaging gate',
  'Linux packaging gate',
  'Installed-app gate',
  'Manual smoke gate',
  'Release decision',
]);

const finalManifestText = read('docs/ga-release-manifest-pass150.json');
need(finalManifestText.includes('enterpriseAllSurfacesGate'), 'GA manifest must carry PASS151 enterprise gate addendum');
need(gaManifest.enterpriseAllSurfacesGate?.pass === 'PASS151', 'GA manifest enterpriseAllSurfacesGate.pass must be PASS151');
need(Array.isArray(gaManifest.enterpriseAllSurfacesGate?.requiredBeforeEnterpriseRelease), 'GA manifest must list requiredBeforeEnterpriseRelease gates');
for (const required of ['Windows installed-app smoke evidence captured locally', 'Linux installed-package smoke evidence captured locally', 'Cross-size responsive regression evidence captured locally', 'PASS151 enterprise all-surfaces evidence report generated']) {
  need(gaManifest.enterpriseAllSurfacesGate.requiredBeforeEnterpriseRelease.includes(required), `GA manifest missing enterprise requirement: ${required}`);
}

need(releaseTruth.includes("TAHAI_RELEASE_PASS = 'PASS150'"), 'PASS151 must not silently rewrite release truth away from PASS150 final ship candidate');
need(aboutTruth.releasePass === 'PASS150', 'PASS151 must not silently rewrite About release truth away from PASS150');
need(aboutTruth.updateChannel === 'manual-release', 'update channel must remain manual-release');
need(/no silent auto-update/i.test(aboutTruth.updatePolicy || ''), 'About release truth must still say no silent auto-update');

includesAll('README.md', [
  'PASS151 enterprise all-surfaces gate',
  'enterprise release grade',
  'npm run evidence:enterprise-all-surfaces',
]);

const browserCss = includesAll('src/renderer/styles/browser.css', [
  'PASS150: keep the whole empty titlebar/tab-strip track draggable',
  '.topbar .tabs { -webkit-app-region:drag; user-select:none; }',
  '.topbar .tab, .topbar .tab *, .topbar .new-tab-control { -webkit-app-region:no-drag; user-select:auto; }',
]);
need(!/\.topbar\s+\.tabs\s*[^\{]*\{[^\}]*-webkit-app-region\s*:\s*no-drag/i.test(browserCss), 'titlebar tab strip track must remain draggable for PASS151');

for (const file of [
  'release/windows/TAHAI-Windows-installers-manifest.json',
  'release/linux/TAHAI-Linux-installers-manifest.json',
  'release/windows/TAHAI-Windows-installers-SHA256SUMS.txt',
  'release/linux/TAHAI-Linux-installers-SHA256SUMS.txt',
  'release/windows/TAHAI-Web-Services-Browser-1.8.30-x64.exe',
  'release/windows/TAHAI-Web-Services-Browser-1.8.30-x64.msi',
  'release/linux/TAHAI-Web-Services-Browser-1.8.30-x64.rpm',
  'release/linux/TAHAI-Web-Services-Browser-1.8.30-x64.deb',
  'release/linux/TAHAI-Web-Services-Browser-1.8.30-x64.AppImage',
  'artifacts/enterprise-all-surfaces/PASS151-enterprise-all-surfaces-evidence.json',
  'artifacts/enterprise-all-surfaces/PASS151-enterprise-all-surfaces-evidence.md',
  'artifacts/cross-size-responsive-regression/PASS148-cross-size-responsive-regression-evidence.json',
  'artifacts/windows-installed-smoke/PASS146-windows-installed-smoke-evidence.json',
  'artifacts/linux-installed-smoke/PASS147-linux-installed-smoke-evidence.json',
]) {
  need(!exists(file), `generated output must not be committed: ${file}`);
}

const packageText = read('package.json');
need(!/electron-updater|autoUpdater/.test(packageText), 'PASS151 must not add auto-update dependency/script');
need(!/telemetry|analytics/i.test(packageText), 'PASS151 must not add telemetry or analytics dependency/script');
need(!pkg.dependencies || Object.keys(pkg.dependencies).length === 0, 'PASS151 must not add runtime dependencies');
const devDependencies = Object.keys(pkg.devDependencies || {}).sort();
need(JSON.stringify(devDependencies) === JSON.stringify(['@types/node', 'electron', 'electron-builder', 'typescript']), `PASS151 must not add unreviewed dev dependencies, found ${devDependencies.join(', ')}`);

const docsBundle = [
  read('src/shared/enterprise-all-surfaces-release-grade-contract.ts'),
  read('docs/enterprise-all-surfaces-release-grade-pass151.md'),
  read('docs/enterprise-release-grade-checklist-pass151.md'),
  read('PASS_151_ENTERPRISE_ALL_SURFACES_RELEASE_GRADE_SUMMARY.md'),
].join('\n');
need(!/client[_-]?secret\s*[:=]/i.test(docsBundle), 'PASS151 must not include client secret assignments');
need(!/refresh[_-]?token\s*[:=]/i.test(docsBundle), 'PASS151 must not include refresh token assignments');
need(!/access[_-]?token\s*[:=]/i.test(docsBundle), 'PASS151 must not include access token assignments');
need(!/psa[_-]?api[_-]?key\s*[:=]/i.test(docsBundle), 'PASS151 must not include PSA credential assignments');
need(!/Cookie:\s+\S+/i.test(docsBundle), 'PASS151 must not include raw cookie header examples');
need(!/Authorization:\s+\S+/i.test(docsBundle), 'PASS151 must not include raw authorization header examples');

if (errors.length) {
  for (const error of errors) console.error(`[PASS151][FAIL] ${error}`);
  process.exit(1);
}

console.log('[PASS151][OK] Enterprise all-surfaces release-grade gate verified.');
