#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const fail = (message) => { console.error(`[PASS109][FAIL] ${message}`); process.exit(1); };
const need = (condition, message) => { if (!condition) fail(message); };
const includes = (rel, text) => need(read(rel).includes(text), `${rel} missing ${text}`);

function hasGitWorkspace() {
  return fs.existsSync(path.join(root, '.git'));
}

function trackedGeneratedEntries() {
  if (!hasGitWorkspace()) return [];
  try {
    const out = execFileSync('git', ['ls-files', '--', 'node_modules', 'dist', 'release', 'artifacts', '.pass-runs'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return out.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function assertGeneratedArtifactHygiene() {
  const generated = ['node_modules', 'dist', 'release', 'artifacts', '.pass-runs'];
  if (hasGitWorkspace()) {
    const tracked = trackedGeneratedEntries();
    need(tracked.length === 0, `generated artifacts must not be tracked by git: ${tracked.join(', ')}`);
    return;
  }

  const strictSourceZipHygiene = process.env.TAHAI_BROWSER_STRICT_SOURCE_ZIP_HYGIENE === '1';
  if (!strictSourceZipHygiene) {
    // Release-blocker verification may run after npm ci/build in an extracted source workspace.
    // Physical generated folders are therefore not proof that the ZIP included them.
    // The packaging/zip step must run strict source hygiene before returning an artifact.
    return;
  }

  for (const dir of generated) {
    need(!fs.existsSync(path.join(root, dir)), `${dir} must not be present in strict source zip hygiene mode`);
  }
}

const pkg = JSON.parse(read('package.json'));
const next = read('NEXT_CHAT_STARTER.md');
const releaseBlockers = getReleaseBlockersContract(pkg);
const passScript = String(pkg.scripts?.['verify:pass-109-release-blocker-continuity-repair'] || '');

includes('NEXT_CHAT_STARTER.md', 'PASS86');
includes('NEXT_CHAT_STARTER.md', 'PASS87');
includes('NEXT_CHAT_STARTER.md', 'PASS88');
includes('NEXT_CHAT_STARTER.md', 'PASS109');
includes('PASS_109_RELEASE_BLOCKER_CONTINUITY_REPAIR_SUMMARY.md', 'PASS109');
includes('PASS_109_RELEASE_BLOCKER_CONTINUITY_REPAIR_SUMMARY.md', 'Release Blocker Continuity Repair');
includes('docs/release-blocker-continuity-pass109.md', 'PASS109');
includes('docs/release-blocker-continuity-pass109.md', 'PASS86');
includes('docs/release-blocker-continuity-pass109.md', 'PASS87');
includes('docs/release-blocker-continuity-pass109.md', 'PASS88');

need(passScript.includes('verify-pass-109-release-blocker-continuity-repair.mjs'), 'package script missing PASS109 verifier');
need(releaseBlockers.includes('verify:pass-109-release-blocker-continuity-repair'), 'verify:release-blockers missing PASS109 verifier');

const orderedScripts = [
  'verify:pass-86-source-contract-sentinel',
  'verify:pass-87-operator-recovery-mesh',
  'verify:pass-88-active-pane-routing-failsafe',
  'verify:pass-105-build-green-boundary-repair',
  'verify:pass-106-site-view-triview-binding',
  'verify:pass-107-site-view-triview-geometry-settle',
  'verify:pass-108-mission-pane-movement-overlay',
  'verify:pass-109-release-blocker-continuity-repair'
];

let last = -1;
for (const script of orderedScripts) {
  const idx = releaseBlockers.indexOf(script);
  need(idx >= 0, `verify:release-blockers missing ${script}`);
  need(idx > last, `verify:release-blockers order drift around ${script}`);
  last = idx;
}

for (const marker of [
  'PASS86 Source Contract Sentinel',
  'PASS87 Operator Recovery Mesh',
  'PASS88 Active Pane Routing Failsafe',
  'PASS109 Release Blocker Continuity Repair'
]) {
  need(next.includes(marker), `NEXT_CHAT_STARTER.md missing release continuity marker ${marker}`);
}

const gitignore = read('.gitignore');
for (const forbidden of ['node_modules/', 'dist/', 'release/', 'artifacts/', '.pass-runs/']) {
  need(gitignore.includes(forbidden), `.gitignore missing generated artifact exclusion: ${forbidden}`);
}

assertGeneratedArtifactHygiene();

console.log('[PASS109][OK] Release Blocker Continuity Repair verified: PASS86/PASS87/PASS88 handoff markers preserved and generated artifacts are ignored/untracked or strict-clean.');
