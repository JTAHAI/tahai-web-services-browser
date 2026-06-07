#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/^\uFEFF/, '');
const json = (rel) => JSON.parse(read(rel));
const pkg = json('package.json');
const build = read('scripts/build-linux-installers.sh');
const handoff = read('scripts/verify-linux-installer-handoff.mjs');
const writer = fs.existsSync(path.join(root, 'scripts/write-linux-installer-handoff.mjs'))
  ? read('scripts/write-linux-installer-handoff.mjs')
  : '';
const linuxConfig = read('scripts/verify-linux-installers-config.mjs');
const summary = read('PASS_126_LINUX_RPM_HANDOFF_MANIFEST_SUMMARY.md');
const errors = [];
const need = (ok, msg) => { if (!ok) errors.push(msg); };

for (const token of [
  'scripts/verify-linux-installers.mjs "${TARGETS[@]}"',
  'scripts/write-linux-installer-handoff.mjs "${TARGETS[@]}"',
  'release/linux',
]) need(build.includes(token), `builder missing ${token}`);

for (const token of [
  'TAHAI-Linux-installers-SHA256SUMS.txt',
  'TAHAI-Linux-installers-manifest.json',
  'crypto.createHash',
  "supersedesPass: 'PASS126'",
  'requestedTargets: targetList',
  'sha256Sums=TAHAI-Linux-installers-SHA256SUMS.txt',
  'jsonManifest=TAHAI-Linux-installers-manifest.json',
]) need(writer.includes(token), `handoff writer missing ${token}`);

for (const token of [
  'scripts/verify-linux-installers.mjs "${TARGETS[@]}"',
]) need(linuxConfig.includes(token), `Linux installer config verifier missing ${token}`);

for (const token of [
  'TAHAI_LINUX_HANDOFF_FOUND=',
  'TAHAI_LINUX_HANDOFF=OK',
  'TAHAI-Linux-installers-SHA256SUMS.txt',
  'TAHAI-Linux-installers-manifest.json',
  'JSON manifest supersedesPass marker must be PASS126',
  'SHA256 mismatch or missing entry',
  'expectedByTarget',
]) need(handoff.includes(token), `handoff verifier missing ${token}`);

need(pkg.scripts?.['verify:linux-installer-handoff'] === 'node scripts/verify-linux-installer-handoff.mjs', 'package missing verify:linux-installer-handoff script');
need(pkg.scripts?.['verify:pass-126-linux-rpm-handoff-manifest'] === 'node scripts/verify-pass-126-linux-rpm-handoff-manifest.mjs', 'package missing PASS126 verifier script');
const releaseBlockers = getReleaseBlockersContract(pkg);
const pass125Idx = releaseBlockers.indexOf('verify:pass-125-linux-package-target-verifier');
const pass126Idx = releaseBlockers.indexOf('verify:pass-126-linux-rpm-handoff-manifest');
const buildIdx = releaseBlockers.lastIndexOf('npm run build');
need(pass125Idx >= 0 && pass126Idx > pass125Idx && buildIdx > pass126Idx, 'release blockers must run PASS126 after PASS125 and before the final build gate');
need(summary.includes('PASS126') && summary.includes('Linux RPM Handoff Manifest') && summary.includes('Version remains `1.8.30`'), 'summary missing PASS126 markers');

if (errors.length) {
  for (const error of errors) console.error(`[PASS126][FAIL] ${error}`);
  process.exit(1);
}
console.log('[PASS126][OK] Linux RPM handoff manifest guard verified.');
