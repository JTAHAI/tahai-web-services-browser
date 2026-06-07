#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const fail = (message) => { console.error(`[PASS110][FAIL] ${message}`); process.exit(1); };
const need = (condition, message) => { if (!condition) fail(message); };

const pkg = JSON.parse(read('package.json'));
const pass109 = read('scripts/verify-pass-109-release-blocker-continuity-repair.mjs');
const releaseBlockers = getReleaseBlockersContract(pkg);
const gitignore = read('.gitignore');

need(pkg.scripts?.['verify:pass-110-release-blocker-generated-artifact-git-aware'] === 'node scripts/verify-pass-110-release-blocker-generated-artifact-git-aware.mjs', 'package script missing PASS110 verifier');
need(releaseBlockers.includes('verify:pass-110-release-blocker-generated-artifact-git-aware'), 'verify:release-blockers missing PASS110 verifier');
need(releaseBlockers.indexOf('verify:pass-110-release-blocker-generated-artifact-git-aware') > releaseBlockers.indexOf('verify:pass-109-release-blocker-continuity-repair'), 'PASS110 must run after PASS109');

for (const token of ['hasGitWorkspace()', 'trackedGeneratedEntries()', "git', ['ls-files'", 'TAHAI_BROWSER_STRICT_SOURCE_ZIP_HYGIENE', 'strict source zip hygiene mode']) {
  need(pass109.includes(token), `PASS109 verifier missing git-aware hygiene token: ${token}`);
}

for (const generated of ['node_modules/', 'dist/', 'release/', 'artifacts/', '.pass-runs/']) {
  need(gitignore.includes(generated), `.gitignore missing generated artifact exclusion: ${generated}`);
}

need(fs.existsSync(path.join(root, 'PASS_110_RELEASE_BLOCKER_GENERATED_ARTIFACT_GIT_AWARE_SUMMARY.md')), 'PASS110 summary missing');
need(read('PASS_110_RELEASE_BLOCKER_GENERATED_ARTIFACT_GIT_AWARE_SUMMARY.md').includes('PASS110'), 'PASS110 summary marker missing');
need(read('docs/release-blocker-generated-artifact-git-aware-pass110.md').includes('Local Git workspace verification'), 'PASS110 docs missing local workspace distinction');
need(read('NEXT_CHAT_STARTER.md').includes('PASS110'), 'NEXT_CHAT_STARTER.md missing PASS110');

console.log('[PASS110][OK] Generated artifact hygiene is Git-aware and strict source ZIP mode remains available.');
