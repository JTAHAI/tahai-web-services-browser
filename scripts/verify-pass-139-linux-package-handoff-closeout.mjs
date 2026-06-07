#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/^\uFEFF/, '');
const json = (rel) => JSON.parse(read(rel));
const exists = (rel) => fs.existsSync(path.join(root, rel));
const pkg = json('package.json');
const build = read('scripts/build-linux-installers.sh');
const writer = read('scripts/write-linux-installer-handoff.mjs');
const handoff = read('scripts/verify-linux-installer-handoff.mjs');
const linuxConfig = read('scripts/verify-linux-installers-config.mjs');
const gitignore = read('.gitignore');
const summary = exists('PASS_139_LINUX_PACKAGE_HANDOFF_CLOSEOUT_SUMMARY.md') ? read('PASS_139_LINUX_PACKAGE_HANDOFF_CLOSEOUT_SUMMARY.md') : '';
const doc = exists('docs/linux-package-handoff-pass139.md') ? read('docs/linux-package-handoff-pass139.md') : '';
const errors = [];
const need = (ok, msg) => { if (!ok) errors.push(msg); };

need(pkg.version === '1.8.30', `version must remain 1.8.30 for PASS139, found ${pkg.version}`);
for (const [script, expected] of Object.entries({
  'package:linux': 'bash scripts/build-linux-installers.sh all',
  'package:linux:rpm': 'bash scripts/build-linux-installers.sh rpm',
  'package:linux:deb': 'bash scripts/build-linux-installers.sh deb',
  'package:linux:appimage': 'bash scripts/build-linux-installers.sh AppImage',
  'package:linux:release': 'bash scripts/build-linux-installers.sh AppImage deb rpm',
  'release:linux:manifest': 'node scripts/write-linux-installer-handoff.mjs',
  'verify:linux-installer-handoff': 'node scripts/verify-linux-installer-handoff.mjs',
  'verify:pass-139-linux-package-handoff-closeout': 'node scripts/verify-pass-139-linux-package-handoff-closeout.mjs',
})) {
  need(pkg.scripts?.[script] === expected, `package script ${script} must be ${expected}`);
}

const releaseBlockers = getReleaseBlockersContract(pkg);
const pass137Idx = releaseBlockers.indexOf('verify:pass-137-first-run-walkthrough');
const pass139Idx = releaseBlockers.indexOf('verify:pass-139-linux-package-handoff-closeout');
const buildIdx = releaseBlockers.lastIndexOf('npm run build');
need(pass139Idx >= 0, 'release blockers must include PASS139 verifier');
need(pass137Idx < 0 || pass139Idx > pass137Idx, 'PASS139 verifier should run after PASS137 in the release-blocker tail for this source lane');
need(buildIdx > pass139Idx, 'PASS139 verifier must run before the final build gate');

for (const token of [
  'PASS139 target-mode normalization',
  'REQUESTED_TARGETS=("$@")',
  'REQUESTED_TARGETS=(all)',
  'all|release|linux)',
  'TAHAI_LINUX_BUILD_ALLOWED_TARGETS=all AppImage deb rpm',
  'electron-builder --linux "${TARGETS[@]}"',
  'scripts/verify-linux-installers.mjs "${TARGETS[@]}"',
  'scripts/write-linux-installer-handoff.mjs "${TARGETS[@]}"',
  'TAHAI_LINUX_SOURCE_ROOT="$SOURCE_ROOT"',
  '--exclude release',
]) need(build.includes(token), `Linux builder missing ${token}`);

for (const token of [
  "pass: 'PASS139'",
  "supersedesPass: 'PASS126'",
  'schemaVersion: 2',
  'targetMode',
  'requestedTargets: targetList',
  "downstreamConsumers: ['TAHAI OS/SENTINEL RPM handoff']",
  "fs.rmSync(handoffRoot, { recursive: true, force: true })",
  'TAHAI-Linux-installers-SHA256SUMS.txt',
  'TAHAI-Linux-installers-manifest.json',
  'TAHAI-Linux-installers-manifest.txt',
  'TAHAI_LINUX_HANDOFF_WRITE=OK',
]) need(writer.includes(token), `Linux handoff writer missing ${token}`);

for (const token of [
  "token === 'all' || token === 'release' || token === 'linux'",
  'JSON manifest schemaVersion must be 2',
  'JSON manifest pass marker must be PASS139',
  'JSON manifest supersedesPass marker must be PASS126',
  'handoff contains stale or unrelated artifact for selected target set',
  'JSON manifest artifact count should match selected targets',
  'pass=PASS139',
  'TAHAI_LINUX_HANDOFF=OK',
]) need(handoff.includes(token), `Linux handoff verifier missing ${token}`);

for (const token of [
  'package:linux',
  'release:linux:manifest',
  'write-linux-installer-handoff.mjs',
  'TAHAI-Linux-installers-manifest.json',
  'PASS139',
]) need(linuxConfig.includes(token), `Linux installer config verifier missing ${token}`);

for (const token of ['release/', '*.AppImage', '*.deb', '*.rpm', '*.zip', 'artifacts/', '.pass-runs/']) {
  need(gitignore.includes(token), `.gitignore missing generated-artifact exclusion: ${token}`);
}

for (const rel of [
  'scripts/write-linux-installer-handoff.mjs',
  'scripts/verify-linux-installer-handoff.mjs',
  'scripts/verify-pass-139-linux-package-handoff-closeout.mjs',
  'docs/linux-package-handoff-pass139.md',
  'PASS_139_LINUX_PACKAGE_HANDOFF_CLOSEOUT_SUMMARY.md',
]) need(exists(rel), `missing PASS139 file: ${rel}`);

need(summary.includes('PASS139') && summary.includes('Linux RPM/AppImage/DEB Handoff Closeout') && summary.includes('Version remains `1.8.30`'), 'PASS139 summary missing closeout markers');
need(doc.includes('PASS139') && doc.includes('rpm') && doc.includes('AppImage') && doc.includes('deb') && doc.includes('TAHAI OS/SENTINEL'), 'PASS139 docs missing target/consumer markers');

if (errors.length) {
  for (const error of errors) console.error(`[PASS139][FAIL] ${error}`);
  process.exit(1);
}
console.log('[PASS139][OK] Linux RPM/AppImage/DEB package handoff closeout verified.');
