#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/^\uFEFF/, '');
const json = (rel) => JSON.parse(read(rel));
const pkg = json('package.json');
const build = read('scripts/build-linux-installers.sh');
const verify = read('scripts/verify-linux-installers.mjs');
const diag = read('scripts/diagnose-linux-rpm-toolchain.sh');
const pass124 = read('scripts/verify-pass-124-linux-rpm-toolchain-recovery.mjs');
const summary = read('PASS_125_LINUX_PACKAGE_TARGET_VERIFIER_SUMMARY.md');
const errors = [];
const need = (ok, msg) => { if (!ok) errors.push(msg); };

need(build.includes('scripts/verify-linux-installers.mjs "${TARGETS[@]}"'), 'builder must pass selected Linux package targets to verifier');
need(!build.includes('"$NPM_BIN" run verify:package:linux'), 'builder must not call all-target npm verifier after single-target builds');
for (const token of [
  'PASS125 target-aware verifier',
  'const normalizeTarget',
  "targetSet = new Set(requestedTargets.length ? requestedTargets : ['AppImage', 'deb', 'rpm'])",
  ".filter((target) => targetSet.has(target.label))",
  'targets=${[...targetSet].join(\',\')}',
]) need(verify.includes(token), `Linux verifier missing ${token}`);
for (const token of [
  'libxcrypt-compat',
  'tar gzip python3 make gcc gcc-c++',
]) {
  need(build.includes(token), `build repair guidance missing ${token}`);
  need(diag.includes(token), `diagnostic repair guidance missing ${token}`);
  need(pass124.includes(token), `PASS124 verifier not reconciled for ${token}`);
}
need(pkg.scripts?.['verify:package:linux'] === 'node scripts/verify-linux-installers.mjs', 'package verify:package:linux script should remain full-target default');
need(pkg.scripts?.['verify:pass-125-linux-package-target-verifier'] === 'node scripts/verify-pass-125-linux-package-target-verifier.mjs', 'package missing PASS125 verifier');
const releaseBlockers = String(pkg.scripts?.['verify:release-blockers'] || '');
const pass124Idx = releaseBlockers.indexOf('verify:pass-124-linux-rpm-toolchain-recovery');
const pass125Idx = releaseBlockers.indexOf('verify:pass-125-linux-package-target-verifier');
const buildIdx = releaseBlockers.lastIndexOf('npm run build');
need(pass124Idx >= 0 && pass125Idx > pass124Idx && buildIdx > pass125Idx, 'release blockers must run PASS125 after PASS124 and before the final build gate');
need(summary.includes('PASS125') && summary.includes('Linux Package Target Verifier') && summary.includes('Version remains `1.8.30`'), 'summary missing PASS125 markers');

if (errors.length) {
  for (const error of errors) console.error(`[PASS125][FAIL] ${error}`);
  process.exit(1);
}
console.log('[PASS125][OK] Linux package target verifier guard verified.');
