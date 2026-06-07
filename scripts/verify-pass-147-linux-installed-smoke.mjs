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
const releaseBlockers = getReleaseBlockersContract(pkg);

need(pkg.version === '1.8.30', `version must remain 1.8.30 for PASS147, found ${pkg.version}`);
need(pkg.scripts?.['evidence:linux-installed-smoke'] === 'bash scripts/run-pass147-linux-installed-smoke.sh', 'package missing evidence:linux-installed-smoke script');
need(pkg.scripts?.['verify:pass-147-linux-installed-smoke'] === 'node scripts/verify-pass-147-linux-installed-smoke.mjs', 'package missing PASS147 verifier script');

const pass146Idx = releaseBlockers.indexOf('verify:pass-146-windows-installed-smoke');
const pass147Idx = releaseBlockers.indexOf('verify:pass-147-linux-installed-smoke');
const finalBuildIdx = releaseBlockers.lastIndexOf('npm run build');
need(pass147Idx >= 0, 'release blockers must include PASS147 verifier');
need(pass146Idx < 0 || pass147Idx > pass146Idx, 'PASS147 verifier should run after PASS146');
need(finalBuildIdx > pass147Idx, 'PASS147 verifier must run before final build gate');

for (const file of [
  'src/shared/linux-installed-smoke-contract.ts',
  'scripts/run-pass147-linux-installed-smoke.sh',
  'scripts/verify-pass-147-linux-installed-smoke.mjs',
  'docs/linux-installed-smoke-pass147.md',
  'PASS_147_LINUX_INSTALLED_PACKAGE_SMOKE_CHECKLIST_SUMMARY.md',
]) {
  need(exists(file), `missing PASS147 file: ${file}`);
}

const contract = includesAll('src/shared/linux-installed-smoke-contract.ts', [
  'LINUX_INSTALLED_SMOKE_PASS',
  'PASS147',
  'LINUX_INSTALLED_SMOKE_VERSION = TAHAI_RELEASE_VERSION',
  'LINUX_INSTALLED_SMOKE_OUTPUT_DIR',
  'artifacts/linux-installed-smoke',
  'LINUX_INSTALLED_SMOKE_PACKAGE_TYPES',
  'rpm',
  'deb',
  'appimage',
  'LINUX_INSTALLED_SMOKE_CHECKLIST',
  'linux-package-checksum-verified',
  'linux-package-installs-cleanly',
  'installed-command-resolves',
  'package-manager-truth',
  'desktop-entry-and-icon-truth',
  'installed-app-launches',
  'about-version-truth',
  'guide-kb-opens',
  'mission-control-entry',
  'split-triview-quad-entry',
  'small-window-reflow',
  'active-pane-routing',
  'evidence-export-redaction',
  'devtools-available',
  'remove-clean-path-understood',
  'LINUX_INSTALLED_SMOKE_REQUIRED_DOC_TOKENS',
]);
need(!contract.includes('PASS148'), 'PASS147 contract must not drift into PASS148');

const runner = includesAll('scripts/run-pass147-linux-installed-smoke.sh', [
  'PASS147 Linux installed package smoke evidence runner',
  'PACKAGE_TYPE="unknown"',
  '--installed-bin',
  '--package-type',
  '--package-path',
  'EXPECTED_VERSION="1.8.30"',
  'OUTPUT_DIR="artifacts/linux-installed-smoke"',
  'rpm|deb|appimage|unknown',
  'uname -s',
  'sha256sum',
  'resolve_binary',
  'tahai-web-services-browser',
  'TAHAI Web Services Browser',
  'rpm -qi tahai-web-services-browser',
  'dpkg-query -s tahai-web-services-browser',
  'desktopEntries',
  'manual-pending',
  'versionLooksExpected',
  'Do not include secrets',
  'PASS147_LINUX_INSTALLED_SMOKE_EVIDENCE_JSON',
]);
need(!/sudo\s+(?:dnf|rpm|apt|dpkg|rm|install|erase|remove)/i.test(runner), 'PASS147 runner must not use sudo install/remove operations');
need(!/\b(dnf|apt|yum|zypper)\s+(?:install|remove|erase|upgrade)\b/i.test(runner), 'PASS147 runner must not run package-manager install/remove operations');
need(!/\brpm\s+-[UiFe]+/i.test(runner), 'PASS147 runner must not install/remove RPMs');
need(!/\bdpkg\s+-[iPr]/i.test(runner), 'PASS147 runner must not install/remove DEBs');
need(!/rm\s+-rf\s+\//i.test(runner), 'PASS147 runner must not recursively delete root paths');
need(!/Set-Content\s+.*release[\\/]/i.test(runner), 'PASS147 runner must not write into release outputs');

const docs = includesAll('docs/linux-installed-smoke-pass147.md', [
  'PASS147',
  'Linux installed package smoke checklist',
  'evidence runner',
  'installed Linux app',
  'Version remains `1.8.30`',
  'manual-release',
  'unsigned preview',
  'RPM',
  'DEB',
  'AppImage',
  'npm run package:linux:rpm',
  'npm run package:linux:deb',
  'npm run package:linux:appimage',
  'npm run verify:linux-installer-handoff',
  'SHA256',
  'npm run evidence:linux-installed-smoke',
  'artifacts/linux-installed-smoke/',
  'Guide/KB',
  'Mission Control',
  '2-Up',
  'Tri-view',
  'Quad',
  'Small-window reflow',
  'Active-pane routing',
  'Evidence export redaction',
  'DevTools',
  'No console/crash noise',
  'Remove/uninstall path',
  'Do not include secrets',
  'No direct PSA API calls',
  'No IT Docs backend changes',
  'No claim of manual installed-app success',
]);
need(!/manual installed-app success until/i.test(docs) || docs.includes('No claim of manual installed-app success'), 'PASS147 docs must not overclaim installed-app success');

includesAll('PASS_147_LINUX_INSTALLED_PACKAGE_SMOKE_CHECKLIST_SUMMARY.md', [
  'PASS147',
  'Linux Installed Package Smoke Checklist',
  'Version remains `1.8.30`',
  'src/shared/linux-installed-smoke-contract.ts',
  'scripts/run-pass147-linux-installed-smoke.sh',
  'scripts/verify-pass-147-linux-installed-smoke.mjs',
  'docs/linux-installed-smoke-pass147.md',
  'evidence:linux-installed-smoke',
  'verify:pass-147-linux-installed-smoke',
  'Generated evidence outputs remain excluded from source',
  'does not claim that Linux manual smoke was completed here',
]);

const gitignore = read('.gitignore');
for (const token of ['artifacts/', 'release/', 'dist/', 'node_modules/', '*.AppImage', '*.deb', '*.rpm']) {
  need(gitignore.includes(token), `.gitignore missing ${token}`);
}

const generatedForbidden = [
  'artifacts/linux-installed-smoke/PASS147-linux-installed-smoke-evidence.json',
  'artifacts/linux-installed-smoke/PASS147-linux-installed-smoke-evidence.md',
  'release/linux/TAHAI-Linux-installers-manifest.json',
  'release/linux/TAHAI-Linux-installers-SHA256SUMS.txt',
  `release/linux/TAHAI-Web-Services-Browser-${pkg.version}-x64.rpm`,
  `release/linux/TAHAI-Web-Services-Browser-${pkg.version}-x64.deb`,
  `release/linux/TAHAI-Web-Services-Browser-${pkg.version}-x64.AppImage`,
];
for (const file of generatedForbidden) need(!exists(file), `generated output must not be committed: ${file}`);

const allPass147Text = [contract, runner, docs, read('PASS_147_LINUX_INSTALLED_PACKAGE_SMOKE_CHECKLIST_SUMMARY.md')].join('\n');
need(!/psa[_-]?api[_-]?key\s*[:=]/i.test(allPass147Text), 'PASS147 must not include PSA credential assignment examples');
need(!/refresh[_-]?token\s*[:=]/i.test(allPass147Text), 'PASS147 must not include refresh token assignment examples');
need(!/access[_-]?token\s*[:=]/i.test(allPass147Text), 'PASS147 must not include access token assignment examples');
need(!/Cookie:\s+\S+/i.test(allPass147Text), 'PASS147 must not include raw cookie header examples');
need(!/Authorization:\s+\S+/i.test(allPass147Text), 'PASS147 must not include raw authorization header examples');

if (errors.length) {
  for (const error of errors) console.error(`[PASS147][FAIL] ${error}`);
  process.exit(1);
}

console.log('[PASS147][OK] Linux installed package smoke checklist and evidence runner verified.');
