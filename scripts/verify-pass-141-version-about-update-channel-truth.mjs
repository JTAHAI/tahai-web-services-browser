#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import childProcess from 'node:child_process';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/^\uFEFF/, '');
const json = (rel) => JSON.parse(read(rel));
const exists = (rel) => fs.existsSync(path.join(root, rel));
const errors = [];
const need = (ok, msg) => { if (!ok) errors.push(msg); };
const includesAll = (rel, tokens) => {
  const text = read(rel);
  for (const token of tokens) need(text.includes(token), `${rel} missing ${token}`);
  return text;
};

const PASS141_MINIMUM_RELEASE_PASS = 'PASS141';
const releasePassOrder = (pass) => {
  const match = String(pass || '').match(/^PASS(\d+)$/);
  return match ? Number(match[1]) : -1;
};

const pkg = json('package.json');
const releaseTruth = read('src/shared/release-truth.ts');
const aboutTruth = json('browser/about/release-truth.json');
const releaseBlockers = getReleaseBlockersContract(pkg);
const releasePassMatch = releaseTruth.match(/TAHAI_RELEASE_PASS\s*=\s*'([^']+)'/);
const currentReleasePass = releasePassMatch?.[1] || '';
const releaseVersionMatch = releaseTruth.match(/TAHAI_RELEASE_VERSION\s*=\s*'([^']+)'/);
const currentReleaseVersion = releaseVersionMatch?.[1] || '';
const releaseChannelMatch = releaseTruth.match(/TAHAI_RELEASE_CHANNEL\s*=\s*'([^']+)'/);
const currentReleaseChannel = releaseChannelMatch?.[1] || '';
const releasePhaseMatch = releaseTruth.match(/TAHAI_RELEASE_PHASE\s*=\s*'([^']+)'/);
const currentReleasePhase = releasePhaseMatch?.[1] || '';
const updateChannelMatch = releaseTruth.match(/TAHAI_UPDATE_CHANNEL\s*=\s*'([^']+)'/);
const currentUpdateChannel = updateChannelMatch?.[1] || '';

const isTrackedByGit = (rel) => {
  try {
    childProcess.execFileSync('git', ['ls-files', '--error-unmatch', rel], {
      cwd: root,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
};

need(pkg.version === currentReleaseVersion, `package version ${pkg.version} must match shared release truth ${currentReleaseVersion || 'missing'}`);
need(Boolean(currentReleaseVersion), 'release truth source must declare a current version');
need(releasePassOrder(currentReleasePass) >= releasePassOrder(PASS141_MINIMUM_RELEASE_PASS), `release truth source must declare ${PASS141_MINIMUM_RELEASE_PASS} or later, found ${currentReleasePass || 'none'}`);
need(['PASS141', 'PASS149', 'PASS150'].includes(currentReleasePass) || releasePassOrder(currentReleasePass) >= 141, 'release truth source must declare a current PASS141-or-later release pass');
need(releaseTruth.includes("TAHAI_RELEASE_CHANNEL = 'public-rc'"), 'release truth source must declare public-rc');
need(releaseTruth.includes("TAHAI_UPDATE_CHANNEL = 'manual-release'"), 'release truth source must declare manual-release update channel');
need(releaseTruth.includes('no silent auto-update'), 'release truth source must document no silent auto-update posture');
need(releaseTruth.includes('releaseTruthForRenderer'), 'release truth source must expose renderer-safe metadata');

need(aboutTruth.version === pkg.version, `about release-truth.json version ${aboutTruth.version} must match package ${pkg.version}`);
need(aboutTruth.releasePass === currentReleasePass, `about release-truth.json releasePass ${aboutTruth.releasePass} must match source ${currentReleasePass}`);
need(aboutTruth.releasePhase === currentReleasePhase, `about release-truth.json releasePhase ${aboutTruth.releasePhase} must match source ${currentReleasePhase}`);
need(releasePassOrder(aboutTruth.releasePass) >= releasePassOrder(PASS141_MINIMUM_RELEASE_PASS), 'about release-truth.json must declare PASS141 or later');
need(aboutTruth.releaseChannel === currentReleaseChannel, `about release-truth.json must declare ${currentReleaseChannel}`);
need(aboutTruth.updateChannel === currentUpdateChannel, `about release-truth.json must declare ${currentUpdateChannel}`);
need(/no silent auto-update/i.test(aboutTruth.updatePolicy || ''), 'about release-truth.json must document no silent auto-update');

const main = includesAll('src/main/main.ts', [
  '../shared/release-truth',
  'TAHAI_RELEASE_VERSION',
  'TAHAI_RELEASE_PASS',
  'releaseTruthForRenderer',
  'releasePass: TAHAI_RELEASE_PASS',
  'updateChannel: releaseTruthForRenderer().updateChannel',
  'updatePolicy: releaseTruthForRenderer().updatePolicy',
  'signingStatus: releaseTruthForRenderer().signingStatus',
  'releaseTruth: releaseTruthForRenderer()',
  'OpsDiagnostics/${TAHAI_RELEASE_VERSION}',
]);
need(!main.includes('OpsDiagnostics/1.8.30'), 'main process must not hard-code OpsDiagnostics/1.8.30');
need(!/const PRODUCT_NAME = 'TAHAI Web Services Browser'/.test(main), 'main process should use shared product release truth');
need(!/const RELEASE_CHANNEL = 'public-rc'/.test(main), 'main process should use shared release channel truth');

includesAll('src/preload/preload.ts', [
  'TahaiReleaseTruth',
  'releasePass: string;',
  'updateChannel: string;',
  'updatePolicy: string;',
  'signingStatus: string;',
  'releaseTruth: TahaiReleaseTruth;',
]);

const rendererTruth = read('src/renderer/app.ts') + '\n' + read('src/renderer/renderer-shell-lifecycle.ts');
for (const token of [
  "releasePass: 'fallback'",
  "updateChannel: 'fallback'",
  'Runtime release truth unavailable until preload/config bridge responds',
  'releaseTruth:',
]) need(rendererTruth.includes(token), `renderer release truth fallback missing ${token}`);

const downloadUx = includesAll('src/shared/release-download-ux.ts', [
  "import { TAHAI_RELEASE_VERSION } from './release-truth';",
  'export const RELEASE_DOWNLOAD_VERSION = TAHAI_RELEASE_VERSION;',
  'TAHAI-Web-Services-Browser-${RELEASE_DOWNLOAD_VERSION}-x64.exe',
  'TAHAI-Web-Services-Browser-${RELEASE_DOWNLOAD_VERSION}-x64.rpm',
]);
need(!downloadUx.includes("RELEASE_DOWNLOAD_VERSION = '1.8.30'"), 'download UX should consume shared release truth instead of its own version string');

const about = includesAll('browser/about/index.html', [
  `v${pkg.version} public-rc`,
  '<span>Channel</span><span>public-rc</span>',
  'Manual release downloads only; no silent auto-update',
  'manual-release',
  'browser.tahai.net',
  'browser.tahaiportal.com',
  'GitHub Releases',
]);
need(about.includes(`v${pkg.version} / ${currentReleasePass}`), 'about page must show current release-pass lane');
need(!about.includes('1.8.28 / PASS54 polish'), 'about page must not show stale PASS54 release lane');
need(!about.includes('1.8.21 public RC'), 'about page must not show stale v1.8.21 public RC');

includesAll('docs/version-about-update-channel-pass141.md', [
  'PASS141',
  'Version/about/update-channel truth pass',
  `Current version | \`${pkg.version}\``,
  `Current release pass | \`${currentReleasePass}\``,
  'Release channel | `public-rc`',
  'Update channel | `manual-release`',
  'no silent updater is enabled',
  'verify:pass-141-version-about-update-channel-truth',
]);

includesAll('PASS_141_VERSION_ABOUT_UPDATE_CHANNEL_TRUTH_SUMMARY.md', [
  'PASS141',
  `Current release truth is \`${pkg.version} / ${currentReleasePass}\``,
  'src/shared/release-truth.ts',
  'No direct PSA API calls',
  'verify:pass-141-version-about-update-channel-truth',
]);

need(pkg.scripts?.['verify:pass-141-version-about-update-channel-truth'] === 'node scripts/verify-pass-141-version-about-update-channel-truth.mjs', 'package missing PASS141 verifier script');
const pass140Idx = releaseBlockers.indexOf('verify:pass-140-download-install-checksum-ux');
const pass141Idx = releaseBlockers.indexOf('verify:pass-141-version-about-update-channel-truth');
const finalBuildIdx = releaseBlockers.lastIndexOf('npm run build');
need(pass141Idx >= 0, 'release blockers must include PASS141 verifier');
need(pass140Idx < 0 || pass141Idx > pass140Idx, 'PASS141 verifier should run after PASS140');
need(finalBuildIdx > pass141Idx, 'PASS141 verifier must run before final build gate');

const packageText = read('package.json');
need(!/electron-updater|autoUpdater/.test(packageText), 'PASS141 must not add electron-updater or autoUpdater dependency/script');
for (const rel of [
  'release/windows/TAHAI-Windows-installers-manifest.json',
  'release/linux/TAHAI-Linux-installers-manifest.json',
  'release/windows/TAHAI-Windows-installers-SHA256SUMS.txt',
  'release/linux/TAHAI-Linux-installers-SHA256SUMS.txt',
]) {
  need(!isTrackedByGit(rel), `generated handoff output must not be committed in source: ${rel}`);
}

const riskySource = releaseTruth + '\n' + about + '\n' + read('docs/version-about-update-channel-pass141.md');
need(!/api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|Authorization:|Bearer\s+/i.test(riskySource), 'PASS141 release truth/docs must not introduce secret/token fields');

if (errors.length) {
  for (const error of errors) console.error(`[PASS141][FAIL] ${error}`);
  process.exit(1);
}

console.log('[PASS141][OK] Version/about/update-channel truth verified.');
