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
const passOrder = (pass) => {
  const match = String(pass || '').match(/^PASS(\d+)$/);
  return match ? Number(match[1]) : -1;
};

const pkg = json('package.json');
const releaseTruth = read('src/shared/release-truth.ts');
const aboutTruth = json('browser/about/release-truth.json');
const gaManifest = json('docs/ga-release-manifest-pass150.json');
const releaseBlockers = getReleaseBlockersContract(pkg);

need(pkg.version === '1.8.30', `version must remain 1.8.30 for PASS150, found ${pkg.version}`);
need(pkg.scripts?.['verify:pass-150-final-ship-candidate'] === 'node scripts/verify-pass-150-final-ship-candidate.mjs', 'package missing PASS150 verifier script');

const pass149Idx = releaseBlockers.indexOf('verify:pass-149-rc1-freeze');
const pass150Idx = releaseBlockers.indexOf('verify:pass-150-final-ship-candidate');
const finalBuildIdx = releaseBlockers.lastIndexOf('npm run build');
need(pass150Idx >= 0, 'release blockers must include PASS150 verifier');
need(pass149Idx >= 0, 'release blockers must still include PASS149 verifier');
need(pass150Idx > pass149Idx, 'PASS150 verifier should run after PASS149 freeze gate');
need(finalBuildIdx > pass150Idx, 'PASS150 verifier must run before final build gate');

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
]) {
  need(releaseBlockers.includes(script), `release blockers missing continuity script: ${script}`);
}

for (const file of [
  'src/shared/final-ship-candidate-contract.ts',
  'scripts/verify-pass-150-final-ship-candidate.mjs',
  'docs/final-ship-candidate-ga-manifest-pass150.md',
  'docs/ga-release-manifest-pass150.json',
  'PASS_150_RC2_FINAL_SHIP_CANDIDATE_GA_MANIFEST_SUMMARY.md',
]) {
  need(exists(file), `missing PASS150 file: ${file}`);
}

includesAll('src/shared/release-truth.ts', [
  "TAHAI_RELEASE_VERSION = '1.8.30'",
  "TAHAI_RELEASE_PASS = 'PASS150'",
  "TAHAI_RELEASE_CHANNEL = 'public-rc'",
  "TAHAI_RELEASE_PHASE = 'rc2-final-ship-candidate-ga-manifest'",
  "TAHAI_UPDATE_CHANNEL = 'manual-release'",
  'no silent auto-update',
]);
need(aboutTruth.version === '1.8.30', 'about release-truth.json must stay at v1.8.30');
need(aboutTruth.releasePass === 'PASS150', 'about release-truth.json must declare PASS150');
need(aboutTruth.releaseChannel === 'public-rc', 'about release-truth.json must declare public-rc');
need(aboutTruth.releasePhase === 'rc2-final-ship-candidate-ga-manifest', 'about release-truth.json must declare RC2 final ship candidate phase');
need(aboutTruth.updateChannel === 'manual-release', 'about release-truth.json must keep manual-release update channel');
need(/no silent auto-update/i.test(aboutTruth.updatePolicy || ''), 'about release-truth.json must document no silent auto-update');

includesAll('browser/about/index.html', [
  'v1.8.30 public-rc',
  'v1.8.30 / PASS150 RC2 final ship candidate',
  '<span>Channel</span><span>public-rc</span>',
  'Manual release downloads only; no silent auto-update',
  'manual-release',
]);

const browserCss = includesAll('src/renderer/styles/browser.css', [
  'PASS150: keep the whole empty titlebar/tab-strip track draggable',
  '.topbar .tabs { -webkit-app-region:drag; user-select:none; }',
  '.topbar .tab, .topbar .tab *, .topbar .new-tab-control { -webkit-app-region:no-drag; user-select:auto; }',
]);
need(!browserCss.includes('.topbar .tabs, .topbar .tab'), 'tabs container must not be grouped with no-drag tab controls');
need(!/\.topbar\s+\.tabs\s*[^\{]*\{[^\}]*-webkit-app-region\s*:\s*no-drag/i.test(browserCss), 'tabs container must not be no-drag; empty tab-strip must remain draggable');
includesAll('src/renderer/index.html', [
  'data-pass150-titlebar-drag-recovery="true"',
  'data-pass112-tabs-titlebar="true"',
]);

const contract = includesAll('src/shared/final-ship-candidate-contract.ts', [
  'FINAL_SHIP_CANDIDATE_PASS',
  'PASS150',
  'FINAL_SHIP_CANDIDATE_VERSION = TAHAI_RELEASE_VERSION',
  'FINAL_SHIP_CANDIDATE_RELEASE_PASS = TAHAI_RELEASE_PASS',
  'FINAL_SHIP_CANDIDATE_STATUS',
  'rc2-final-ship-candidate-ga-manifest',
  'verify:pass-138-windows-installer-closeout',
  'verify:pass-149-rc1-freeze',
  'verify:pass-150-final-ship-candidate',
  'titlebar-drag-region-fix',
  'tabs-titlebar-chrome-and-window-drag-region',
  'new-user-facing-feature',
  'direct-psa-api-call',
  'secret-or-token-storage',
  'silent-auto-update',
  'telemetry-or-analytics',
  'generated-artifact-in-source',
]);
need(!contract.includes('PASS151'), 'PASS150 contract must not drift to a future pass');

includesAll('docs/final-ship-candidate-ga-manifest-pass150.md', [
  'PASS150',
  'RC2 final ship-candidate manifest pass',
  'Version remains `1.8.30`',
  'rc2-final-ship-candidate-ga-manifest',
  'manual-release',
  'No silent auto-update lane is enabled',
  'empty topbar/tab-strip track draggable',
  'tabs and buttons `no-drag`',
  'npm run verify:pass-150-final-ship-candidate',
  'Titlebar drag-region manual smoke completed on Windows',
]);

includesAll('PASS_150_RC2_FINAL_SHIP_CANDIDATE_GA_MANIFEST_SUMMARY.md', [
  'PASS150',
  'RC2 Final Ship Candidate / GA Manifest',
  'Version remains `1.8.30`',
  'src/shared/final-ship-candidate-contract.ts',
  'scripts/verify-pass-150-final-ship-candidate.mjs',
  'docs/ga-release-manifest-pass150.json',
  'titlebar drag-region regression',
  'No direct PSA API calls',
  'No IT Docs backend work',
  'No silent auto-update lane',
]);

need(gaManifest.version === '1.8.30', 'GA manifest version must be 1.8.30');
need(gaManifest.releasePass === 'PASS150', 'GA manifest releasePass must be PASS150');
need(gaManifest.releasePhase === 'rc2-final-ship-candidate-ga-manifest', 'GA manifest releasePhase must be RC2 final ship candidate');
need(gaManifest.silentAutoUpdate === false, 'GA manifest must state silentAutoUpdate false');
for (const pass of ['PASS138','PASS139','PASS140','PASS141','PASS142','PASS143','PASS144','PASS145','PASS146','PASS147','PASS148','PASS149','PASS150']) {
  need(Array.isArray(gaManifest.requiredContinuityPasses) && gaManifest.requiredContinuityPasses.includes(pass), `GA manifest missing continuity pass ${pass}`);
}
need(Array.isArray(gaManifest.manualReleaseRequirements) && gaManifest.manualReleaseRequirements.some((item) => /Titlebar drag-region/i.test(item)), 'GA manifest must require titlebar drag-region manual smoke');

const pass141Verifier = read('scripts/verify-pass-141-version-about-update-channel-truth.mjs');
need(pass141Verifier.includes('PASS150'), 'PASS141 compatibility verifier must recognize PASS150 current release truth');
const pass149Verifier = read('scripts/verify-pass-149-rc1-freeze.mjs');
need(pass149Verifier.includes('PASS149_MINIMUM_RELEASE_PASS'), 'PASS149 verifier must allow PASS149 or later release truth');
need(pass149Verifier.includes('PASS150'), 'PASS149 verifier must recognize PASS150 final release truth');
const pass54Verifier = read('scripts/verify-pass-54-about-ops-polish.mjs');
need(pass54Verifier.includes('PASS150 RC2 final ship candidate'), 'PASS54 compatibility verifier must accept current PASS150 about lane');

const packageText = read('package.json');
need(!/electron-updater|autoUpdater/.test(packageText), 'PASS150 must not add auto-update dependency/script');
need(!/telemetry|analytics/i.test(packageText), 'PASS150 must not add telemetry or analytics dependency/script');
need(!pkg.dependencies || Object.keys(pkg.dependencies).length === 0, 'PASS150 must not add runtime dependencies');
const devDependencies = Object.keys(pkg.devDependencies || {}).sort();
need(JSON.stringify(devDependencies) === JSON.stringify(['@types/node', 'electron', 'electron-builder', 'typescript']), `PASS150 must not add unreviewed dev dependencies, found ${devDependencies.join(', ')}`);

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
  'artifacts/cross-size-responsive-regression/PASS148-cross-size-responsive-regression-evidence.json',
  'artifacts/windows-installed-smoke/PASS146-windows-installed-smoke-evidence.json',
  'artifacts/linux-installed-smoke/PASS147-linux-installed-smoke-evidence.json',
]) {
  need(!exists(file), `generated output must not be committed: ${file}`);
}

const docsBundle = [releaseTruth, contract, read('docs/final-ship-candidate-ga-manifest-pass150.md'), read('PASS_150_RC2_FINAL_SHIP_CANDIDATE_GA_MANIFEST_SUMMARY.md')].join('\n');
need(!/client[_-]?secret\s*[:=]/i.test(docsBundle), 'PASS150 must not include client secret assignments');
need(!/refresh[_-]?token\s*[:=]/i.test(docsBundle), 'PASS150 must not include refresh token assignments');
need(!/access[_-]?token\s*[:=]/i.test(docsBundle), 'PASS150 must not include access token assignments');
need(!/psa[_-]?api[_-]?key\s*[:=]/i.test(docsBundle), 'PASS150 must not include PSA credential assignments');
need(!/Cookie:\s+\S+/i.test(docsBundle), 'PASS150 must not include raw cookie header examples');
need(!/Authorization:\s+\S+/i.test(docsBundle), 'PASS150 must not include raw authorization header examples');

if (errors.length) {
  for (const error of errors) console.error(`[PASS150][FAIL] ${error}`);
  process.exit(1);
}

console.log('[PASS150][OK] RC2 final ship candidate / GA manifest verified.');
