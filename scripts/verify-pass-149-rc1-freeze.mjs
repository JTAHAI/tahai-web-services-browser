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
const PASS149_MINIMUM_RELEASE_PASS = 'PASS149';
const releasePassOrder = (pass) => {
  const match = String(pass || '').match(/^PASS(\d+)$/);
  return match ? Number(match[1]) : -1;
};
const includesAll = (file, tokens) => {
  const text = read(file);
  for (const token of tokens) need(text.includes(token), `${file} missing ${token}`);
  return text;
};

const pkg = json('package.json');
const releaseBlockers = getReleaseBlockersContract(pkg);
const releaseTruthSource = read('src/shared/release-truth.ts');
const releasePassMatch = releaseTruthSource.match(/TAHAI_RELEASE_PASS\s*=\s*'([^']+)'/);
const currentReleasePass = releasePassMatch?.[1] || '';

need(pkg.version === '1.8.30', `version must remain 1.8.30 for PASS149, found ${pkg.version}`);
need(pkg.scripts?.['verify:pass-149-rc1-freeze'] === 'node scripts/verify-pass-149-rc1-freeze.mjs', 'package missing PASS149 verifier script');

const pass148Idx = releaseBlockers.indexOf('verify:pass-148-cross-size-responsive-regression');
const pass149Idx = releaseBlockers.indexOf('verify:pass-149-rc1-freeze');
const finalBuildIdx = releaseBlockers.lastIndexOf('npm run build');
need(pass149Idx >= 0, 'release blockers must include PASS149 verifier');
need(pass148Idx < 0 || pass149Idx > pass148Idx, 'PASS149 verifier should run after PASS148');
need(finalBuildIdx > pass149Idx, 'PASS149 verifier must run before final build gate');

for (const file of [
  'src/shared/rc1-freeze-contract.ts',
  'scripts/verify-pass-149-rc1-freeze.mjs',
  'docs/rc1-freeze-pass149.md',
  'PASS_149_RC1_FREEZE_NO_NEW_FEATURES_SUMMARY.md',
]) {
  need(exists(file), `missing PASS149 file: ${file}`);
}

const releaseTruth = includesAll('src/shared/release-truth.ts', [
  "TAHAI_RELEASE_VERSION = '1.8.30'",
  "TAHAI_RELEASE_CHANNEL = 'public-rc'",
  "TAHAI_UPDATE_CHANNEL = 'manual-release'",
  'no silent auto-update',
]);
need(releasePassOrder(currentReleasePass) >= releasePassOrder(PASS149_MINIMUM_RELEASE_PASS), `release truth source must declare PASS149 or later, found ${currentReleasePass || 'none'}`);
need(['rc1-freeze-no-new-features', 'rc2-final-ship-candidate-ga-manifest'].some((phase) => releaseTruth.includes(`TAHAI_RELEASE_PHASE = '${phase}'`)), 'release truth source must declare RC1 freeze or later final ship candidate phase');

const aboutTruth = json('browser/about/release-truth.json');
need(aboutTruth.version === '1.8.30', 'about release-truth.json must stay at v1.8.30');
need(releasePassOrder(aboutTruth.releasePass) >= releasePassOrder(PASS149_MINIMUM_RELEASE_PASS), 'about release-truth.json must declare PASS149 or later');
need(aboutTruth.releaseChannel === 'public-rc', 'about release-truth.json must declare public-rc');
need(['rc1-freeze-no-new-features', 'rc2-final-ship-candidate-ga-manifest'].includes(aboutTruth.releasePhase), 'about release-truth.json must declare RC1 freeze or later final ship candidate phase');
need(aboutTruth.updateChannel === 'manual-release', 'about release-truth.json must keep manual-release update channel');
need(/no silent auto-update/i.test(aboutTruth.updatePolicy || ''), 'about release-truth.json must document no silent auto-update');

const aboutHtml = includesAll('browser/about/index.html', [
  'v1.8.30 public-rc',
  '<span>Channel</span><span>public-rc</span>',
  'Manual release downloads only; no silent auto-update',
  'manual-release',
]);
need(aboutHtml.includes('v1.8.30 / PASS149 RC1 freeze') || aboutHtml.includes('v1.8.30 / PASS150 RC2 final ship candidate'), 'about page must show PASS149 freeze or PASS150 final ship candidate lane');

const contract = includesAll('src/shared/rc1-freeze-contract.ts', [
  'RC1_FREEZE_PASS',
  'PASS149',
  'RC1_FREEZE_VERSION = TAHAI_RELEASE_VERSION',
  'RC1_FREEZE_RELEASE_PASS = TAHAI_RELEASE_PASS',
  'RC1_FREEZE_STATUS',
  'rc1-freeze-no-new-features',
  'RC1_FREEZE_ALLOWED_CHANGES',
  'release-blocker-fix',
  'security-blocker-fix',
  'build-or-packaging-fix',
  'installer-handoff-truth-fix',
  'documentation-truth-fix',
  'manual-qa-evidence-fix',
  'critical-regression-fix',
  'checksum-or-manifest-fix',
  'RC1_FREEZE_BLOCKED_CHANGES',
  'new-user-facing-feature',
  'new-integration-or-provider',
  'direct-psa-api-call',
  'itdocs-backend-code',
  'secret-or-token-storage',
  'silent-auto-update',
  'telemetry-or-analytics',
  'unreviewed-dependency-addition',
  'generated-artifact-in-source',
  'version-bump-without-explicit-release-decision',
  'RC1_FROZEN_SURFACES',
  'normal-browser-shell',
  'mission-control-one-up-two-up-triview-quad-focus',
  'active-pane-routing',
  'evidence-pack-redaction-export',
  'windows-installer-handoff',
  'linux-rpm-appimage-deb-handoff',
  'version-about-update-channel-truth',
  'electron-security-boundary',
  'public-repo-supply-chain-boundary',
  'windows-linux-cross-size-manual-qa-runners',
  'RC1_FREEZE_REQUIRED_DOC_TOKENS',
]);
need(!contract.includes('PASS151'), 'PASS149 contract must not drift past PASS150');

const docs = includesAll('docs/rc1-freeze-pass149.md', [
  'PASS149',
  'RC1 freeze and no-new-features pass',
  'Version remains `1.8.30`',
  'public-rc',
  'manual-release',
  'rc1-freeze-no-new-features',
  'What is frozen',
  'Allowed after freeze',
  'Blocked after freeze',
  'New user-facing features',
  'No direct PSA API calls',
  'No IT Docs backend work',
  'No secret, token, cookie, OAuth, cloud credential, or PSA credential storage',
  'No silent auto-update lane',
  'No telemetry or analytics additions',
  'No unreviewed dependency additions',
  'No generated artifacts in source',
  'npm run verify:pass-149-rc1-freeze',
  'PASS150 final ship candidate / GA manifest',
]);

includesAll('PASS_149_RC1_FREEZE_NO_NEW_FEATURES_SUMMARY.md', [
  'PASS149',
  'RC1 Freeze and No-New-Features Pass',
  'Version remains `1.8.30`',
  'src/shared/rc1-freeze-contract.ts',
  'scripts/verify-pass-149-rc1-freeze.mjs',
  'docs/rc1-freeze-pass149.md',
  'verify:pass-149-rc1-freeze',
  'No direct PSA API calls',
  'IT Docs backend work',
  'Generated evidence outputs, installers, manifests',
  'PASS150 should be final ship candidate / GA manifest truth only',
]);

const readme = includesAll('README.md', [
  'RC1 freeze',
  'PASS149',
  'no-new-features',
  'docs/rc1-freeze-pass149.md',
  'PASS150 final ship candidate / GA manifest',
]);
need(readme.includes('Version: `1.8.30`'), 'README must keep current 1.8.30 version truth');

const pass141Verifier = read('scripts/verify-pass-141-version-about-update-channel-truth.mjs');
need(pass141Verifier.includes('PASS141_MINIMUM_RELEASE_PASS'), 'PASS141 verifier must allow later release-truth passes');
need(pass141Verifier.includes('releasePassOrder'), 'PASS141 verifier must compare release pass order instead of freezing PASS141 forever');
need(pass141Verifier.includes('PASS149') && pass141Verifier.includes('PASS150'), 'PASS141 verifier must recognize PASS149/PASS150 current release truth');

const pass54Verifier = read('scripts/verify-pass-54-about-ops-polish.mjs');
need(pass54Verifier.includes('PASS149 RC1 freeze') && pass54Verifier.includes('PASS150 RC2 final ship candidate'), 'PASS54 compatibility verifier must accept current PASS149/PASS150 about lane');

const packageText = read('package.json');
need(!/electron-updater|autoUpdater/.test(packageText), 'PASS149 must not add auto-update dependency/script');
need(!/telemetry|analytics/i.test(packageText), 'PASS149 must not add telemetry or analytics dependency/script');

const devDependencies = Object.keys(pkg.devDependencies || {}).sort();
need(JSON.stringify(devDependencies) === JSON.stringify(['@types/node', 'electron', 'electron-builder', 'typescript']), `PASS149 must not add unreviewed dev dependencies, found ${devDependencies.join(', ')}`);
need(!pkg.dependencies || Object.keys(pkg.dependencies).length === 0, 'PASS149 must not add runtime dependencies');

for (const file of [
  'release/windows/TAHAI-Windows-installers-manifest.json',
  'release/linux/TAHAI-Linux-installers-manifest.json',
  'release/windows/TAHAI-Windows-installers-SHA256SUMS.txt',
  'release/linux/TAHAI-Linux-installers-SHA256SUMS.txt',
  'artifacts/cross-size-responsive-regression/PASS148-cross-size-responsive-regression-evidence.json',
  'artifacts/windows-installed-smoke/PASS146-windows-installed-smoke-evidence.json',
  'artifacts/linux-installed-smoke/PASS147-linux-installed-smoke-evidence.json',
]) {
  need(!exists(file), `generated output must not be committed: ${file}`);
}

const docsBundle = [releaseTruth, contract, docs, read('PASS_149_RC1_FREEZE_NO_NEW_FEATURES_SUMMARY.md')].join('\n');
need(!/client[_-]?secret\s*[:=]/i.test(docsBundle), 'PASS149 must not include client secret assignments');
need(!/refresh[_-]?token\s*[:=]/i.test(docsBundle), 'PASS149 must not include refresh token assignments');
need(!/access[_-]?token\s*[:=]/i.test(docsBundle), 'PASS149 must not include access token assignments');
need(!/psa[_-]?api[_-]?key\s*[:=]/i.test(docsBundle), 'PASS149 must not include PSA credential assignments');
need(!/Cookie:\s+\S+/i.test(docsBundle), 'PASS149 must not include raw cookie header examples');
need(!/Authorization:\s+\S+/i.test(docsBundle), 'PASS149 must not include raw authorization header examples');

if (errors.length) {
  for (const error of errors) console.error(`[PASS149][FAIL] ${error}`);
  process.exit(1);
}

console.log('[PASS149][OK] RC1 freeze and no-new-features gate verified.');
