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

need(pkg.version === '1.8.30', `version must remain 1.8.30 for PASS148, found ${pkg.version}`);
need(pkg.scripts?.['evidence:cross-size-regression'] === 'node scripts/run-pass148-cross-size-responsive-regression.mjs', 'package missing evidence:cross-size-regression script');
need(pkg.scripts?.['verify:pass-148-cross-size-responsive-regression'] === 'node scripts/verify-pass-148-cross-size-responsive-regression.mjs', 'package missing PASS148 verifier script');

const pass147Idx = releaseBlockers.indexOf('verify:pass-147-linux-installed-smoke');
const pass148Idx = releaseBlockers.indexOf('verify:pass-148-cross-size-responsive-regression');
const finalBuildIdx = releaseBlockers.lastIndexOf('npm run build');
need(pass148Idx >= 0, 'release blockers must include PASS148 verifier');
need(pass147Idx < 0 || pass148Idx > pass147Idx, 'PASS148 verifier should run after PASS147');
need(finalBuildIdx > pass148Idx, 'PASS148 verifier must run before final build gate');

for (const file of [
  'src/shared/cross-size-responsive-regression-contract.ts',
  'scripts/run-pass148-cross-size-responsive-regression.mjs',
  'scripts/verify-pass-148-cross-size-responsive-regression.mjs',
  'docs/cross-size-responsive-regression-pass148.md',
  'PASS_148_CROSS_SIZE_RESPONSIVE_MANUAL_REGRESSION_SUMMARY.md',
]) {
  need(exists(file), `missing PASS148 file: ${file}`);
}

const contract = includesAll('src/shared/cross-size-responsive-regression-contract.ts', [
  'CROSS_SIZE_RESPONSIVE_REGRESSION_PASS',
  'PASS148',
  'CROSS_SIZE_RESPONSIVE_REGRESSION_VERSION = TAHAI_RELEASE_VERSION',
  'CROSS_SIZE_RESPONSIVE_REGRESSION_OUTPUT_DIR',
  'artifacts/cross-size-responsive-regression',
  'CROSS_SIZE_RESPONSIVE_VIEWPORTS',
  'compact-960x640',
  'small-1024x768',
  'laptop-1366x768',
  'desktop-1920x1080',
  'wide-2560x1440',
  '960',
  '640',
  '1024',
  '768',
  '1366',
  '1920',
  '1080',
  '2560',
  '1440',
  'CROSS_SIZE_RESPONSIVE_CHECKLIST',
  'normal-browser-first-paint',
  'titlebar-tabs-chrome-stack',
  'guide-kb-discoverable',
  'more-tools-overflow-reachable',
  'mission-control-opens-at-size',
  'mission-control-overlay-no-collision',
  'two-up-entry-recovery',
  'triview-entry-recovery',
  'quad-entry-recovery',
  'focus-pane-restore',
  'pane-move-and-drop-targets',
  'active-pane-visible-and-routed',
  'address-bar-reload-back-forward-target-active-pane',
  'command-center-available',
  'runbook-rail-usable',
  'evidence-export-redaction-accessible',
  'devtools-still-available',
  'no-critical-scroll-trap-or-cutoff',
  'no-unhandled-renderer-errors',
  'CROSS_SIZE_RESPONSIVE_REQUIRED_DOC_TOKENS',
]);
need(!contract.includes('PASS149'), 'PASS148 contract must not drift into PASS149');

const runner = includesAll('scripts/run-pass148-cross-size-responsive-regression.mjs', [
  'PASS148 cross-size responsive regression evidence runner',
  'artifacts',
  'cross-size-responsive-regression',
  'PASS148-cross-size-responsive-regression-evidence.json',
  'PASS148-cross-size-responsive-regression-evidence.md',
  '--platform',
  '--operator',
  '--notes',
  'manual-pending',
  '960',
  '640',
  '1024',
  '768',
  '1366',
  '1920',
  '1080',
  '2560',
  '1440',
  'Guide/KB',
  'Mission Control',
  'Do not include secrets',
  'No claim of manual responsive success',
  'PASS148_CROSS_SIZE_RESPONSIVE_EVIDENCE_JSON',
]);
need(!/playwright|puppeteer|selenium/i.test(runner), 'PASS148 runner must not pretend to automate installed-app UI smoke');
need(!/sudo\s+(?:dnf|rpm|apt|dpkg|rm|install|erase|remove)/i.test(runner), 'PASS148 runner must not use sudo install/remove operations');
need(!/Set-Content\s+.*release[\\/]/i.test(runner), 'PASS148 runner must not write into release outputs');
need(!/writeFileSync\([^)]*release[\\/]/i.test(runner), 'PASS148 runner must not write into release outputs');

const docs = includesAll('docs/cross-size-responsive-regression-pass148.md', [
  'PASS148',
  'Cross-size/responsive/manual regression checklist',
  'responsive regression evidence runner',
  'Version remains `1.8.30`',
  'manual-release',
  'unsigned preview',
  '960x640',
  '1024x768',
  '1366x768',
  '1920x1080',
  '2560x1440',
  'Guide/KB',
  'More Tools',
  'Mission Control',
  '2-Up',
  'Tri-view',
  'Quad',
  'Focus Pane',
  'active-pane routing',
  'Runbook Rail',
  'Evidence export redaction',
  'DevTools',
  'No critical scroll trap',
  'No obvious renderer crash loops',
  'npm run evidence:cross-size-regression',
  'artifacts/cross-size-responsive-regression/',
  'Do not include secrets',
  'No IT Docs backend changes',
  'no direct PSA API calls',
  'No claim of manual responsive success',
]);
need(docs.includes('No claim of manual responsive success'), 'PASS148 docs must not overclaim manual responsive success');

includesAll('PASS_148_CROSS_SIZE_RESPONSIVE_MANUAL_REGRESSION_SUMMARY.md', [
  'PASS148',
  'Cross-size Responsive Manual Regression Checklist',
  'Version remains `1.8.30`',
  'src/shared/cross-size-responsive-regression-contract.ts',
  'scripts/run-pass148-cross-size-responsive-regression.mjs',
  'scripts/verify-pass-148-cross-size-responsive-regression.mjs',
  'docs/cross-size-responsive-regression-pass148.md',
  'evidence:cross-size-regression',
  'verify:pass-148-cross-size-responsive-regression',
  '960x640',
  '1024x768',
  '1366x768',
  '1920x1080',
  '2560x1440',
  'Generated evidence outputs remain excluded from source',
  'does not claim that manual responsive testing was completed here',
]);

const gitignore = read('.gitignore');
for (const token of ['artifacts/', 'release/', 'dist/', 'node_modules/', '*.AppImage', '*.deb', '*.rpm']) {
  need(gitignore.includes(token), `.gitignore missing ${token}`);
}

const generatedForbidden = [
  'artifacts/cross-size-responsive-regression/PASS148-cross-size-responsive-regression-evidence.json',
  'artifacts/cross-size-responsive-regression/PASS148-cross-size-responsive-regression-evidence.md',
  'release/linux/TAHAI-Linux-installers-manifest.json',
  'release/windows/TAHAI-Windows-installers-manifest.json',
];
for (const file of generatedForbidden) need(!exists(file), `generated output must not be committed: ${file}`);

const allPass148Text = [contract, runner, docs, read('PASS_148_CROSS_SIZE_RESPONSIVE_MANUAL_REGRESSION_SUMMARY.md')].join('\n');
need(!/psa[_-]?api[_-]?key\s*[:=]/i.test(allPass148Text), 'PASS148 must not include PSA credential assignment examples');
need(!/refresh[_-]?token\s*[:=]/i.test(allPass148Text), 'PASS148 must not include refresh token assignment examples');
need(!/access[_-]?token\s*[:=]/i.test(allPass148Text), 'PASS148 must not include access token assignment examples');
need(!/Cookie:\s+\S+/i.test(allPass148Text), 'PASS148 must not include raw cookie header examples');
need(!/Authorization:\s+\S+/i.test(allPass148Text), 'PASS148 must not include raw authorization header examples');

if (errors.length) {
  for (const error of errors) console.error(`[PASS148][FAIL] ${error}`);
  process.exit(1);
}

console.log('[PASS148][OK] Cross-size responsive manual regression checklist and evidence runner verified.');
