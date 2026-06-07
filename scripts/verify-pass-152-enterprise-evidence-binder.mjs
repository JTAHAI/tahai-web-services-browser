#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const errors = [];
const rel = (p) => path.join(root, p);
const exists = (p) => fs.existsSync(rel(p));
const read = (p) => fs.readFileSync(rel(p), 'utf8').replace(/^﻿/, '');
const json = (p) => JSON.parse(read(p));
const need = (ok, message) => { if (!ok) errors.push(message); };
const includesAll = (file, tokens) => {
  const text = read(file);
  for (const token of tokens) need(text.includes(token), `${file} missing ${token}`);
  return text;
};

const pkg = json('package.json');
const blockers = getReleaseBlockersContract(pkg);
const manifest = json('docs/ga-release-manifest-pass150.json');

need(pkg.version === '1.8.30', `version must remain 1.8.30 for PASS152, found ${pkg.version}`);
need(pkg.scripts?.['verify:pass-152-enterprise-evidence-binder'] === 'node scripts/verify-pass-152-enterprise-evidence-binder.mjs', 'package missing PASS152 verifier script');

const pass150Idx = blockers.indexOf('verify:pass-150-final-ship-candidate');
const pass151Idx = blockers.indexOf('verify:pass-151-enterprise-all-surfaces-release-grade');
const pass152Idx = blockers.indexOf('verify:pass-152-enterprise-evidence-binder');
const finalBuildIdx = blockers.lastIndexOf('npm run build');
need(pass150Idx >= 0, 'release blockers missing PASS150');
need(pass151Idx > pass150Idx, 'PASS151 must run after PASS150');
need(pass152Idx > pass151Idx, 'PASS152 must run after PASS151');
need(finalBuildIdx > pass152Idx, 'PASS152 must run before final build');

for (const file of [
  'src/shared/enterprise-evidence-binder-no-false-ga-contract.ts',
  'scripts/verify-pass-152-enterprise-evidence-binder.mjs',
  'docs/enterprise-evidence-binder-no-false-ga-pass152.md',
  'PASS_152_ENTERPRISE_EVIDENCE_BINDER_NO_FALSE_GA_SUMMARY.md'
]) need(exists(file), `missing PASS152 file: ${file}`);

includesAll('src/shared/enterprise-evidence-binder-no-false-ga-contract.ts', [
  'ENTERPRISE_EVIDENCE_BINDER_PASS',
  'PASS152',
  'enterprise-evidence-binder-no-false-ga',
  'verify:pass-150-final-ship-candidate',
  'verify:pass-151-enterprise-all-surfaces-release-grade',
  'verify:pass-152-enterprise-evidence-binder',
  'no enterprise GA claim without installed package and manual evidence'
]);

includesAll('docs/enterprise-evidence-binder-no-false-ga-pass152.md', [
  'PASS152',
  'Enterprise Evidence Binder',
  'No-False-GA',
  'Do not call TAHAI Web Services Browser enterprise GA',
  'Windows installed-app smoke evidence',
  'Linux installed-package smoke evidence',
  'generated evidence'
]);

includesAll('PASS_152_ENTERPRISE_EVIDENCE_BINDER_NO_FALSE_GA_SUMMARY.md', [
  'PASS152',
  'verify-pass-152-enterprise-evidence-binder.mjs',
  'verify:release-blockers',
  'no-false-GA'
]);

need(manifest.enterpriseAllSurfacesGate?.pass === 'PASS151', 'PASS151 manifest addendum must remain intact');
need(manifest.enterpriseEvidenceBinderNoFalseGaGate?.pass === 'PASS152', 'GA manifest missing PASS152 no-false-GA addendum');
need(manifest.enterpriseEvidenceBinderNoFalseGaGate?.status === 'blocked-until-installed-evidence-exists', 'PASS152 manifest status must block GA until evidence exists');
need(Array.isArray(manifest.enterpriseEvidenceBinderNoFalseGaGate?.requiredBeforeEnterpriseGA), 'PASS152 manifest must list requiredBeforeEnterpriseGA');

const manifestText = read('docs/ga-release-manifest-pass150.json').toLowerCase();
need(!/enterprisegadecision\s*['"]?\s*:\s*['"]?approved/i.test(manifestText), 'manifest must not carry an approved enterprise GA decision');
need(!/releasephase\s*['"]?\s*:\s*['"]?enterprise-ga/i.test(manifestText), 'manifest release phase must not drift to enterprise GA');

for (const file of [
  'release/windows/TAHAI-Windows-installers-manifest.json',
  'release/linux/TAHAI-Linux-installers-manifest.json',
  'artifacts/enterprise-all-surfaces/PASS151-enterprise-all-surfaces-evidence.json',
  'artifacts/enterprise-evidence-binder/PASS152-enterprise-evidence-binder.json',
  'dist/main/main.js'
]) need(!exists(file), `generated output must not be committed: ${file}`);

if (errors.length) {
  for (const error of errors) console.error(`[PASS152][FAIL] ${error}`);
  process.exit(1);
}

console.log('[PASS152][OK] Enterprise evidence binder/no-false-GA gate verified.');
