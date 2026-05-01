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
    return {
      name: entry.name,
      bytes: stat.size,
      sha256: hashFile(filePath)
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const manualWindowsGates = [
  'Install unsigned preview with expected Windows warning copy only.',
  'Launch from Start Menu, desktop shortcut, and installed executable path.',
  'Confirm taskbar and window icons use TAHAI spider branding.',
  'Verify normal browser navigation: address bar, back, forward, reload, home, DevTools F12.',
  'Verify Mission Control 1-Up, 2-Up, 3-Up, 4-Up, focus pane, and active-pane routing.',
  'Verify Ctrl+K, Ctrl+Alt+1..4, Ctrl+Alt+Q, Ctrl+Alt+S, Ctrl+Alt+F, Ctrl+Alt+E.',
  'Create, save, restore, export, and archive a local-only Mission without sign-in.',
  'Confirm IT Docs and PSA controls remain browser-side contracts with disabled/authorized states only.',
  'Run Evidence Pack redaction preview with bearer token, JWT-looking string, email, IP, and private-key fixture.',
  'Confirm no console errors, renderer promise rejections, missing packaged resources, or broken local pages.'
];

const manifest = {
  product: 'TAHAI Web Services Browser',
  version: pkg.version,
  appId: pkg.build?.appId,
  channel: 'enterprise-installer-release-candidate',
  signing: 'unsigned-preview',
  generatedAt: new Date().toISOString(),
  sourceTruth: [
    'package.json',
    'package-lock.json',
    'electron-builder.yml',
    'scripts/verify-release-blockers via npm run verify:release-blockers',
    'scripts/verify-mission-tabs-security.mjs',
    'docs/enterprise-qa-installer-rc.md'
  ],
  requiredCommands: [
    'npm ci',
    'npm run verify:public-repo',
    'npm run verify:release-blockers',
    'npm run verify:mission-tabs-security',
    'npm run package:win:release',
    'npm run release:friend:zip'
  ],
  manualWindowsGates,
  artifacts
};

const manifestPath = path.join(releaseDir, 'release-candidate-manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
const sums = artifacts.map((artifact) => `${artifact.sha256}  ${artifact.name}`).join('\n') + (artifacts.length ? '\n' : '');
fs.writeFileSync(path.join(releaseDir, 'SHA256SUMS.txt'), sums);
console.log(`TAHAI_BROWSER_RC_MANIFEST=OK path=${manifestPath} artifacts=${artifacts.length}`);
