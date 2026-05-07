#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';

const root = process.cwd();
const releaseDir = path.join(root, 'release');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
fs.mkdirSync(releaseDir, { recursive: true });
const hashFile = (filePath) => crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
const releasableExtensions = new Set(['.exe', '.msi', '.zip', '.blockmap']);
const artifacts = fs.readdirSync(releaseDir, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .filter((entry) => releasableExtensions.has(path.extname(entry.name).toLowerCase()))
  .map((entry) => {
    const filePath = path.join(releaseDir, entry.name);
    const stat = fs.statSync(filePath);
    return { name: entry.name, bytes: stat.size, sha256: hashFile(filePath) };
  })
  .sort((a, b) => a.name.localeCompare(b.name));
const requiredVerificationCommands = ['npm ci', 'npm run verify:public-repo', 'npm run verify:release-blockers', 'npm run verify:mission-tabs-security', 'npm run release:public:verify', 'npm run release:public:win'];
const manualWindowsGates = [
  'Install unsigned public RC with the expected Windows warning only.',
  'Launch from Start Menu, desktop shortcut, and installed executable path.',
  'Confirm taskbar, Start Menu, installer, and window icons use TAHAI spider branding.',
  'Verify normal browser navigation: address bar, back, forward, reload, home, DevTools F12, Alt+Left, Alt+Right, and mouse Button 4/5.',
  'Verify Mission Control 1-Up, 2-Up, 3-Up, 4-Up, focus pane, active-pane routing, and pane return controls.',
  'Verify Ctrl+K, Ctrl+Alt+1..4, Ctrl+Alt+Q, Ctrl+Alt+S, Ctrl+Alt+F, Ctrl+Alt+E.',
  'Create, save, restore, export, duplicate, and archive a local-only Mission without sign-in.',
  'Confirm IT Docs and PSA controls remain browser-side contracts with disabled/authorized states only and no direct PSA API behavior.',
  'Run Evidence Pack redaction preview with bearer token, JWT-looking string, email, IP, cookie/header text, and private-key fixture.',
  'Confirm no console errors, renderer promise rejections, missing packaged resources, broken local pages, or mystery disabled buttons.'
];
const stopConditions = [
  'Do not publish if any verification command fails.',
  'Do not publish if Windows installed-app smoke testing finds console errors, missing packaged resources, or broken Mission Views.',
  'Do not publish if release output contains secrets, tokens, cookies, Authorization headers, PSA/API/provider credentials, customer data, runtime profiles, or caches.',
  'Do not publish if IT Docs or PSA behavior attempts browser-side writeback outside the reference contract.',
  'Do not publish if SHA256SUMS.txt or this manifest cannot be generated from the actual release artifacts.'
];
const manifest = {
  product: 'TAHAI Web Services Browser',
  version: pkg.version,
  appId: pkg.build?.appId,
  channel: 'public-release-candidate',
  signing: 'unsigned-preview-until-approved-code-signing',
  generatedAt: new Date().toISOString(),
  publicReleaseNotes: 'docs/github-release-notes-1.8.21.md',
  browserDownloadCopy: 'docs/browser-download-page-copy.md',
  privacyPolicy: 'docs/privacy-policy.md',
  codeSigningPolicy: 'docs/code-signing-policy.md',
  sourceTruth: ['package.json','package-lock.json','electron-builder.yml','docs/public-release-candidate.md','docs/github-release-notes-1.8.21.md','docs/browser-download-page-copy.md','scripts/verify-public-repo.mjs','scripts/verify-enterprise-release.mjs','scripts/verify-mission-tabs-security.mjs','scripts/verify-pass-45-public-release-candidate.mjs'],
  requiredVerificationCommands,
  manualWindowsGates,
  stopConditions,
  artifacts
};
const manifestPath = path.join(releaseDir, 'public-release-candidate-manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
const sums = artifacts.map((artifact) => `${artifact.sha256}  ${artifact.name}`).join('\n') + (artifacts.length ? '\n' : '');
fs.writeFileSync(path.join(releaseDir, 'SHA256SUMS.txt'), sums);
console.log(`TAHAI_BROWSER_PUBLIC_RC_MANIFEST=OK path=${manifestPath} artifacts=${artifacts.length}`);
