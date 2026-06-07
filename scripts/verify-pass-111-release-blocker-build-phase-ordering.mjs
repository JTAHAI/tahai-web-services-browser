#!/usr/bin/env node
import fs from 'node:fs';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const read = (path) => fs.readFileSync(path, 'utf8');
const fail = (message) => { console.error(`[PASS111][FAIL] ${message}`); process.exit(1); };
const need = (condition, message) => { if (!condition) fail(message); };

const pkg = JSON.parse(read('package.json'));
const releaseBlockers = getReleaseBlockersContract(pkg);

need(pkg.scripts?.['verify:pass-111-release-blocker-build-phase-ordering'] === 'node scripts/verify-pass-111-release-blocker-build-phase-ordering.mjs', 'package script missing PASS111 verifier');
need(releaseBlockers.includes('verify:pass-111-release-blocker-build-phase-ordering'), 'verify:release-blockers missing PASS111 verifier');

const buildIdx = releaseBlockers.indexOf('npm run build');
need(buildIdx >= 0, 'verify:release-blockers must include npm run build');

const orderedLateSourceVerifiers = [
  'verify:pass-105-build-green-boundary-repair',
  'verify:pass-106-site-view-triview-binding',
  'verify:pass-107-site-view-triview-geometry-settle',
  'verify:pass-108-mission-pane-movement-overlay',
  'verify:pass-109-release-blocker-continuity-repair',
  'verify:pass-110-release-blocker-generated-artifact-git-aware',
  'verify:pass-111-release-blocker-build-phase-ordering'
];

let lastIdx = -1;
for (const script of orderedLateSourceVerifiers) {
  const idx = releaseBlockers.indexOf(script);
  need(idx >= 0, `verify:release-blockers missing ${script}`);
  need(idx > lastIdx, `late source verifier order drift at ${script}`);
  need(idx < buildIdx, `${script} must run before npm run build`);
  lastIdx = idx;
}

need(buildIdx > releaseBlockers.indexOf('verify:pass-111-release-blocker-build-phase-ordering'), 'build must run after PASS111');
need(!/npm run build && npm run verify:pass-105-build-green-boundary-repair/.test(releaseBlockers), 'legacy build-before-PASS105 ordering remains');
need(!/verify:pass-109-release-blocker-continuity-repair && npm run verify:pass-110-release-blocker-generated-artifact-git-aware && npm run build/.test(releaseBlockers), 'PASS111 must be inserted before build');

const pass109 = read('scripts/verify-pass-109-release-blocker-continuity-repair.mjs');
need(pass109.includes('TAHAI_BROWSER_STRICT_SOURCE_ZIP_HYGIENE'), 'PASS109 must retain strict source ZIP hygiene mode');
need(pass109.includes('generated artifacts are ignored/untracked or strict-clean'), 'PASS109 success message must describe context-aware generated artifact hygiene');

need(read('PASS_111_RELEASE_BLOCKER_BUILD_PHASE_ORDERING_SUMMARY.md').includes('PASS111'), 'PASS111 summary missing marker');
need(read('docs/release-blocker-build-phase-ordering-pass111.md').includes('build step creates `dist/`'), 'PASS111 docs missing build/dist rationale');
need(read('NEXT_CHAT_STARTER.md').includes('PASS111'), 'NEXT_CHAT_STARTER.md missing PASS111');

console.log('[PASS111][OK] Release-blocker build phase ordering verified: late source/hygiene verifiers run before build.');
