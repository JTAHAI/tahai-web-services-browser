#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/^\uFEFF/, '');
const exists = (rel) => fs.existsSync(path.join(root, rel));
const errors = [];
const need = (ok, msg) => { if (!ok) errors.push(msg); };

const REQUIRED_PASS_SCRIPTS = [
  'verify:pass-112-tabs-titlebar-chrome',
  'verify:pass-113-adaptive-chrome-density',
  'verify:pass-114-chrome-stack-guard',
  'verify:pass-115-overflow-visibility-guard',
  'verify:pass-116-overlay-arbitration',
  'verify:pass-117-overlay-focus-recovery',
  'verify:pass-118-overlay-dismiss-recovery',
  'verify:pass-119-overlay-aria-contract',
  'verify:pass-120-overlay-pointer-boundary',
  'verify:pass-121-overlay-scroll-containment',
  'verify:pass-122-overlay-viewport-reflow',
  'verify:pass-123-overlay-cycle-guard',
  'verify:pass-124-linux-rpm-toolchain-recovery',
  'verify:pass-125-linux-package-target-verifier',
  'verify:pass-126-linux-rpm-handoff-manifest',
  'verify:pass-127-enterprise-release-readiness',
];

const REQUIRED_HYGIENE_PATTERNS = [
  'node_modules/', 'dist/', 'release/', 'artifacts/', '.pass-runs/',
  'profiles/', 'user-data/', '.local-data/', 'mission-data/', 'evidence-data/',
  '*.zip', '*.exe', '*.msi', '*.dmg', '*.AppImage', '*.deb', '*.rpm', '*.blockmap',
];

function hasGitWorkspace() {
  return exists('.git');
}

function gitLsFiles(args) {
  if (!hasGitWorkspace()) return [];
  try {
    const out = execFileSync('git', ['ls-files', '--', ...args], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return out.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function assertGeneratedOutputsAreNotSource() {
  const generatedRoots = ['node_modules', 'dist', 'release', 'out', 'build-output', 'artifacts', '.pass-runs', 'profiles', 'user-data', '.local-data', 'mission-data', 'evidence-data'];
  const generatedInstallerGlobs = ['*.zip', '*.exe', '*.msi', '*.dmg', '*.AppImage', '*.deb', '*.rpm', '*.blockmap'];
  const handoffOutputs = [
    'release/linux/TAHAI-Linux-installers-manifest.json',
    'release/linux/TAHAI-Linux-installers-SHA256SUMS.txt',
    'release/linux/TAHAI-Linux-installers-manifest.txt',
  ];

  if (hasGitWorkspace()) {
    const trackedGenerated = gitLsFiles([...generatedRoots, ...generatedInstallerGlobs, ...handoffOutputs]);
    need(trackedGenerated.length === 0, `generated artifacts must not be tracked by git: ${trackedGenerated.join(', ')}`);
    return;
  }

  if (process.env.TAHAI_BROWSER_STRICT_SOURCE_ZIP_HYGIENE !== '1') return;
  for (const rel of generatedRoots) need(!exists(rel), `${rel} must not be present in strict source ZIP hygiene mode`);
  for (const rel of handoffOutputs) need(!exists(rel), `${rel} must not be present in strict source ZIP hygiene mode`);
}

const pkg = JSON.parse(read('package.json'));
const releaseBlockers = String(pkg.scripts?.['verify:release-blockers'] || '');
const gitignore = read('.gitignore');
const publicRepoVerifier = read('scripts/verify-public-repo.mjs');
const generator = read('scripts/generate-release-evidence-report.mjs');
const summary = read('PASS_127_ENTERPRISE_RELEASE_READINESS_SUMMARY.md');
const docs = read('docs/enterprise-release-readiness-pass127.md');
const next = read('NEXT_CHAT_STARTER.md');

need(pkg.version === '1.8.30', `PASS127 must preserve version 1.8.30 unless explicitly incremented, found ${pkg.version}`);
need(pkg.scripts?.['generate:release-evidence'] === 'node scripts/generate-release-evidence-report.mjs', 'package missing source-only release evidence generator script');
need(pkg.scripts?.['verify:pass-127-enterprise-release-readiness'] === 'node scripts/verify-pass-127-enterprise-release-readiness.mjs', 'package missing PASS127 verifier script');
need(releaseBlockers.includes('verify:pass-127-enterprise-release-readiness'), 'verify:release-blockers missing PASS127 verifier');

let last = -1;
for (const script of REQUIRED_PASS_SCRIPTS) {
  const idx = releaseBlockers.indexOf(script);
  need(idx >= 0, `verify:release-blockers missing ${script}`);
  need(idx > last, `verify:release-blockers order drift at ${script}`);
  need(String(pkg.scripts?.[script] || '').startsWith('node scripts/'), `package script ${script} must resolve to a node verifier`);
  const file = `scripts/${script.replace('verify:', 'verify-')}.mjs`;
  need(exists(file), `verifier file missing for ${script}: ${file}`);
  last = idx;
}
const buildIndex = releaseBlockers.lastIndexOf('npm run build');
const pass127Index = releaseBlockers.indexOf('verify:pass-127-enterprise-release-readiness');
need(buildIndex >= 0, 'verify:release-blockers must retain final npm run build gate');
need(pass127Index >= 0 && buildIndex >= 0 && pass127Index < buildIndex, 'PASS127 source/evidence verifier must run before final build output is created');

for (const forbidden of ['verify:linux-installer-handoff', 'package:linux:release', 'package:linux:rpm', 'package:linux:appimage', 'package:linux:deb', 'package:win:release', 'release:friend:zip']) {
  need(!releaseBlockers.includes(forbidden), `verify:release-blockers must not require generated/package target ${forbidden}`);
}

for (const pattern of REQUIRED_HYGIENE_PATTERNS) {
  need(gitignore.includes(pattern), `.gitignore missing generated/runtime hygiene pattern: ${pattern}`);
  need(publicRepoVerifier.includes(pattern), `verify-public-repo must enforce generated/runtime hygiene pattern: ${pattern}`);
}

for (const token of [
  'REQUIRED_PASS_GUARDS',
  'PASS127',
  'sourceOnly: true',
  'artifacts/',
  '.pass-runs/',
  'release/linux/TAHAI-Linux-installers-manifest.json',
  'verify:linux-installer-handoff',
  'zipExclusionRule',
]) need(generator.includes(token), `release evidence generator missing token: ${token}`);

for (const token of [
  'PASS127',
  'Enterprise Release Readiness Evidence',
  'PASS112',
  'PASS126',
  'Version remains `1.8.30`',
  'source-only release evidence report generator',
]) need(summary.includes(token), `PASS127 summary missing ${token}`);

for (const token of [
  'PASS112', 'PASS113', 'PASS114', 'PASS115', 'PASS116', 'PASS117', 'PASS118', 'PASS119', 'PASS120', 'PASS121', 'PASS122', 'PASS123', 'PASS124', 'PASS125', 'PASS126', 'PASS127',
  'Mission Control', 'active-pane routing', 'Site View', 'titlebar chrome', 'RPM handoff manifest', 'not committed as source',
]) need(docs.includes(token), `PASS127 docs missing ${token}`);

for (const token of [
  'PASS86 Source Contract Sentinel',
  'PASS87 Operator Recovery Mesh',
  'PASS88 Active Pane Routing Failsafe',
  'PASS109 Release Blocker Continuity Repair',
  'PASS127 — Enterprise Release Readiness Evidence',
  'verify:pass-127-enterprise-release-readiness',
]) need(next.includes(token), `NEXT_CHAT_STARTER.md missing continuity token: ${token}`);

assertGeneratedOutputsAreNotSource();

try {
  const out = execFileSync(process.execPath, ['scripts/generate-release-evidence-report.mjs', '--json'], { cwd: root, encoding: 'utf8' });
  const report = JSON.parse(out);
  need(report.pass === 'PASS127', 'release evidence report pass marker mismatch');
  need(report.version === '1.8.30', 'release evidence report version mismatch');
  need(report.sourceOnly === true, 'release evidence report must be source-only');
  need(report.ok === true, `release evidence report must be OK: ${(report.errors || []).join('; ')}`);
  need(report.releaseReadiness?.requiredPasses?.length === REQUIRED_PASS_SCRIPTS.length, 'release evidence report must cover PASS112-PASS127');
} catch (error) {
  errors.push(`release evidence report generator failed: ${error instanceof Error ? error.message : String(error)}`);
}

if (errors.length) {
  for (const error of errors) console.error(`[PASS127][FAIL] ${error}`);
  process.exit(1);
}

console.log('[PASS127][OK] Enterprise release readiness evidence guard verified: PASS112-PASS127 consolidated, source ZIP hygiene enforced, and generated package handoff manifests remain build outputs.');
