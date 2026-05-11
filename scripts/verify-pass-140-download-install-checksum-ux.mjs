#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

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

const pkg = json('package.json');
const releaseBlockers = String(pkg.scripts?.['verify:release-blockers'] || '');
const downloadUxSource = includesAll('src/shared/release-download-ux.ts', [
  'TAHAI-Windows-installers-SHA256SUMS.txt',
  'TAHAI-Linux-installers-SHA256SUMS.txt',
  'TAHAI-Linux-installers-manifest.json',
  'TAHAI-Web-Services-Browser-${RELEASE_DOWNLOAD_VERSION}-x64.exe',
  'TAHAI-Web-Services-Browser-${RELEASE_DOWNLOAD_VERSION}-x64.msi',
  'TAHAI-Web-Services-Browser-${RELEASE_DOWNLOAD_VERSION}-x64.AppImage',
  'TAHAI-Web-Services-Browser-${RELEASE_DOWNLOAD_VERSION}-x64.deb',
  'TAHAI-Web-Services-Browser-${RELEASE_DOWNLOAD_VERSION}-x64.rpm',
  'Unsigned preview: Windows SmartScreen may warn',
  'TAHAI OS/SENTINEL RPM handoff',
]);

need(pkg.version === '1.8.30', `version must remain 1.8.30 for PASS140, found ${pkg.version}`);
need(downloadUxSource.includes("RELEASE_DOWNLOAD_VERSION = '1.8.30'") || downloadUxSource.includes('RELEASE_DOWNLOAD_VERSION = TAHAI_RELEASE_VERSION'), 'download UX source must define the 1.8.30 release download version or consume shared release truth');
need(pkg.scripts?.['verify:pass-140-download-install-checksum-ux'] === 'node scripts/verify-pass-140-download-install-checksum-ux.mjs', 'package missing PASS140 verifier script');
const pass139Idx = releaseBlockers.indexOf('verify:pass-139-linux-package-handoff-closeout');
const pass140Idx = releaseBlockers.indexOf('verify:pass-140-download-install-checksum-ux');
const finalBuildIdx = releaseBlockers.lastIndexOf('npm run build');
need(pass140Idx >= 0, 'release blockers must include PASS140 verifier');
need(pass139Idx < 0 || pass140Idx > pass139Idx, 'PASS140 verifier should run after PASS139');
need(finalBuildIdx > pass140Idx, 'PASS140 verifier must run before final build gate');

includesAll('docs/download-install-checksum-ux-pass140.md', [
  'PASS140',
  'Download/install docs and checksum UX',
  'TAHAI-Web-Services-Browser-1.8.30-x64.exe',
  'TAHAI-Web-Services-Browser-1.8.30-x64.msi',
  'TAHAI-Web-Services-Browser-1.8.30-x64.AppImage',
  'TAHAI-Web-Services-Browser-1.8.30-x64.deb',
  'TAHAI-Web-Services-Browser-1.8.30-x64.rpm',
  'TAHAI-Windows-installers-SHA256SUMS.txt',
  'TAHAI-Linux-installers-SHA256SUMS.txt',
  'TAHAI-Linux-installers-manifest.json',
  'TAHAI OS/SENTINEL',
  'Unsigned preview',
  'generated `release/` outputs are not source files',
]);

includesAll('docs/downloads-and-checksums.md', [
  'Version: `1.8.30`',
  'Current public package matrix',
  'TAHAI-Windows-installers-SHA256SUMS.txt',
  'TAHAI-Linux-installers-SHA256SUMS.txt',
  'TAHAI-Linux-installers-manifest.json',
  'TAHAI-Linux-installers-manifest.txt',
  'PASS139 manifest',
  'Windows SmartScreen may warn',
  'Verify SHA256 before running the EXE or MSI',
  'Do not publish if any generated handoff file was copied from an older build',
]);

const downloadCopy = includesAll('docs/browser-download-page-copy.md', [
  'v1.8.30 preview',
  'TAHAI Web Services Browser v1.8.30 Preview',
  'SHA256-first download UX',
  'browser.tahai.net',
  'browser.tahaiportal.com',
  'GitHub Releases',
  'TAHAI-Web-Services-Browser-1.8.30-x64.exe',
  'TAHAI-Web-Services-Browser-1.8.30-x64.msi',
  'TAHAI-Web-Services-Browser-1.8.30-x64.AppImage',
  'TAHAI-Web-Services-Browser-1.8.30-x64.deb',
  'TAHAI-Web-Services-Browser-1.8.30-x64.rpm',
  'Copy checksum verification',
  'Unsigned preview',
  'generated handoff manifests',
  'TAHAI OS/SENTINEL',
]);
need(!downloadCopy.includes('v1.8.21 public RC'), 'download page copy must not present stale v1.8.21 public RC as current');

includesAll('docs/kb/articles/downloads-installers.md', [
  'Downloads and installers',
  'Verify SHA256 before installing',
  'TAHAI-Windows-installers-SHA256SUMS.txt',
  'TAHAI-Linux-installers-SHA256SUMS.txt',
  'TAHAI-Linux-installers-manifest.json',
  'Generated installers and generated manifests are build outputs, not source files',
  'TAHAI OS/SENTINEL',
]);

includesAll('PASS_140_DOWNLOAD_INSTALL_CHECKSUM_UX_SUMMARY.md', [
  'PASS140',
  'Download/install docs and checksum UX',
  'Version remains `1.8.30`',
  'No direct PSA API calls',
  'verify:pass-140-download-install-checksum-ux',
]);

for (const rel of [
  'release/windows/TAHAI-Windows-installers-SHA256SUMS.txt',
  'release/windows/TAHAI-Windows-installers-manifest.json',
  'release/linux/TAHAI-Linux-installers-SHA256SUMS.txt',
  'release/linux/TAHAI-Linux-installers-manifest.json',
  'release/linux/TAHAI-Linux-installers-manifest.txt',
]) {
  need(!exists(rel), `generated handoff output must not be committed in source: ${rel}`);
}

need(!/api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret/i.test(downloadUxSource), 'download UX source must not introduce secret/token fields');

if (errors.length) {
  for (const error of errors) console.error(`[PASS140][FAIL] ${error}`);
  process.exit(1);
}

console.log('[PASS140][OK] Download/install docs and checksum UX verified.');
