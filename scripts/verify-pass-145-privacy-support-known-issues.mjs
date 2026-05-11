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

need(pkg.version === '1.8.30', `version must remain 1.8.30 for PASS145, found ${pkg.version}`);
need(pkg.scripts?.['verify:pass-145-privacy-support-known-issues'] === 'node scripts/verify-pass-145-privacy-support-known-issues.mjs', 'package missing PASS145 verifier script');
const pass144Idx = releaseBlockers.indexOf('verify:pass-144-public-repo-supply-chain');
const pass145Idx = releaseBlockers.indexOf('verify:pass-145-privacy-support-known-issues');
const finalBuildIdx = releaseBlockers.lastIndexOf('npm run build');
need(pass145Idx >= 0, 'release blockers must include PASS145 verifier');
need(pass144Idx < 0 || pass145Idx > pass144Idx, 'PASS145 verifier should run after PASS144');
need(finalBuildIdx > pass145Idx, 'PASS145 verifier must run before final build gate');

for (const rel of [
  'src/shared/privacy-support-known-issues-contract.ts',
  'scripts/verify-pass-145-privacy-support-known-issues.mjs',
  'docs/privacy-support-known-issues-pass145.md',
  'PASS_145_PRIVACY_SUPPORT_KNOWN_ISSUES_CLOSEOUT_SUMMARY.md',
  'docs/privacy-policy.md',
  'SUPPORT.md',
  'docs/known-issues.md',
]) {
  need(exists(rel), `missing PASS145 file: ${rel}`);
}

const contract = includesAll('src/shared/privacy-support-known-issues-contract.ts', [
  'PRIVACY_SUPPORT_KNOWN_ISSUES_PASS',
  'PASS145',
  'PRIVACY_POSTURE',
  'SUPPORT_POSTURE',
  'KNOWN_ISSUES_POSTURE',
  'REQUIRED_PRIVACY_DOC_TOKENS',
  'REQUIRED_SUPPORT_DOC_TOKENS',
  'REQUIRED_KNOWN_ISSUES_TOKENS',
]);
need(contract.includes("PRIVACY_SUPPORT_KNOWN_ISSUES_VERSION = TAHAI_RELEASE_VERSION"), 'PASS145 contract must consume shared release version truth');

const privacy = includesAll('docs/privacy-policy.md', [
  '1.8.30 public-rc',
  'PASS145',
  'does not intentionally collect',
  'does not intentionally collect, sell',
  'local-first browser workbench',
  'local Mission Control state',
  'Evidence Pack metadata',
  'redaction-aware handling',
  'Third-party websites and services opened by the user are governed by their own privacy policies',
  'manual release downloads only',
  'no silent auto-update',
  'GitHub Releases',
  'official TAHAI download pages',
  'SHA256',
  'SUPPORT.md',
  'SECURITY.md',
]);
need(!/telemetry\s*[:=]\s*true/i.test(privacy), 'privacy policy must not claim telemetry is enabled');

const support = includesAll('SUPPORT.md', [
  'early public preview',
  'best-effort open-source support',
  '1.8.30 public-rc',
  'PASS145',
  'GitHub issue',
  'SECURITY.md',
  'Browser version',
  'installer type',
  'SHA256',
  'Mission Control',
  'Do not post secrets',
  'direct PSA API calls',
  'PASS150 GA manifest',
]);
need(!/guaranteed support|24\/7 support|includes enterprise GA support commitments/i.test(support), 'support doc must not overpromise preview support');

const known = includesAll('docs/known-issues.md', [
  '1.8.30 PASS145 documentation closeout',
  'not enterprise GA',
  'PASS150',
  'Unsigned Windows preview',
  'manual installed-app smoke',
  'Linux AppImage',
  'Linux deb',
  'Linux rpm',
  'TAHAI OS/SENTINEL RPM consumption',
  'macOS packages must be built on macOS',
  'IT Docs and PSA integration surfaces are browser-side contracts only',
  'direct PSA API calls',
  'Privacy Policy',
  'Support',
  '## 1.8.21 public release candidate',
]);

includesAll('docs/privacy-support-known-issues-pass145.md', [
  'PASS145',
  'Privacy/support/known-issues documentation closeout',
  '1.8.30 public-rc',
  'does not intentionally collect or sell',
  'manual release downloads only',
  'no silent auto-update',
  'best-effort open-source/public preview support',
  'PASS150 final ship candidate / GA manifest',
  'verify:pass-145-privacy-support-known-issues',
]);

includesAll('PASS_145_PRIVACY_SUPPORT_KNOWN_ISSUES_CLOSEOUT_SUMMARY.md', [
  'PASS145',
  'Version remains `1.8.30`',
  'docs/privacy-policy.md',
  'SUPPORT.md',
  'docs/known-issues.md',
  'src/shared/privacy-support-known-issues-contract.ts',
  'verify:pass-145-privacy-support-known-issues',
  'No direct PSA API calls',
]);

const readme = includesAll('README.md', [
  'Review privacy posture',
  'Get support / report bugs',
  'Privacy, support, and known issues',
  'docs/privacy-policy.md',
  'SUPPORT.md',
  'SECURITY.md',
  'docs/known-issues.md',
  'docs/downloads-and-checksums.md',
  'PASS145',
  'no silent auto-update',
]);
need(readme.includes('Version: `1.8.30`'), 'README must keep current 1.8.30 version truth');

const publicRepoVerifier = read('scripts/verify-public-repo.mjs');
for (const rel of ['docs/privacy-support-known-issues-pass145.md', 'src/shared/privacy-support-known-issues-contract.ts']) {
  need(publicRepoVerifier.includes(rel), `public repo verifier should require ${rel}`);
}

const docsBundle = [privacy, support, known, read('docs/privacy-support-known-issues-pass145.md'), read('PASS_145_PRIVACY_SUPPORT_KNOWN_ISSUES_CLOSEOUT_SUMMARY.md')].join('\n');
need(!/client[_-]?secret\s*[:=]/i.test(docsBundle), 'PASS145 docs must not include client secret assignments');
need(!/refresh[_-]?token\s*[:=]/i.test(docsBundle), 'PASS145 docs must not include refresh token assignments');
need(!/access[_-]?token\s*[:=]/i.test(docsBundle), 'PASS145 docs must not include access token assignments');
need(!/psa[_-]?api[_-]?key\s*[:=]/i.test(docsBundle), 'PASS145 docs must not include PSA credential assignments');

for (const rel of [
  'release/windows/TAHAI-Windows-installers-manifest.json',
  'release/linux/TAHAI-Linux-installers-manifest.json',
  'release/windows/TAHAI-Windows-installers-SHA256SUMS.txt',
  'release/linux/TAHAI-Linux-installers-SHA256SUMS.txt',
  'artifacts/sbom/tahai-browser-sbom.json',
]) {
  need(!exists(rel), `generated output must not be committed in source: ${rel}`);
}

const packageText = read('package.json');
need(!/electron-updater|autoUpdater/.test(packageText), 'PASS145 must not add auto-update dependency/script');
need(!/telemetry|analytics/i.test(packageText), 'PASS145 must not add telemetry or analytics dependency/script');

if (errors.length) {
  for (const error of errors) console.error(`[PASS145][FAIL] ${error}`);
  process.exit(1);
}

console.log('[PASS145][OK] Privacy/support/known-issues documentation closeout verified.');
