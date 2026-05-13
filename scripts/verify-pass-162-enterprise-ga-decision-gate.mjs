#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

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
const blockers = String(pkg.scripts?.['verify:release-blockers'] || '');
const contractPath = 'src/shared/enterprise-ga-decision-gate-contract.ts';
const contract = read(contractPath);
const evidenceBinder = read('src/shared/enterprise-evidence-binder-no-false-ga-contract.ts');
const signing = read('src/shared/signing-provenance-sbom-contract.ts');
const support = read('src/shared/enterprise-support-bundle-contract.ts');
const policy = read('src/shared/enterprise-admin-policy-contract.ts');
const webview = read('src/shared/webview-attach-security-contract.ts');
const evidencePrivacy = read('src/shared/evidence-capture-privacy-contract.ts');
const runtime = read('src/shared/runtime-e2e-harness-contract.ts');

need(pkg.version === '1.8.30', `version must remain 1.8.30 for PASS162, found ${pkg.version}`);
need(pkg.scripts?.['verify:pass-162-enterprise-ga-decision-gate'] === 'node scripts/verify-pass-162-enterprise-ga-decision-gate.mjs', 'package missing PASS162 verifier script');

const pass161Idx = blockers.indexOf('verify:pass-161-renderer-modularization');
const pass162Idx = blockers.indexOf('verify:pass-162-enterprise-ga-decision-gate');
const finalBuildIdx = blockers.lastIndexOf('npm run build');
need(pass161Idx >= 0, 'release blockers missing PASS161');
need(pass162Idx > pass161Idx, 'PASS162 must run after PASS161');
need(finalBuildIdx > pass162Idx, 'PASS162 must run before final build');
need(blockers.includes('verify:pass-152-enterprise-evidence-binder'), 'release blockers must preserve PASS152 no-false-GA gate');

for (const script of [
  'verify:pass-150-final-ship-candidate',
  'verify:pass-151-enterprise-all-surfaces-release-grade',
  'verify:pass-152-enterprise-evidence-binder',
  'verify:pass-153-webview-popup-attach-hardening',
  'verify:pass-154-enterprise-admin-policy-framework',
  'verify:pass-155-admin-console-profiles',
  'verify:pass-156-mission-recipe-library',
  'verify:pass-157-evidence-capture-privacy-hardening',
  'verify:pass-158-runtime-e2e-harness',
  'verify:pass-159-enterprise-signing-provenance-sbom',
  'verify:pass-160-enterprise-support-bundle',
  'verify:pass-161-renderer-modularization',
  'verify:pass-162-enterprise-ga-decision-gate',
]) need(blockers.includes(script), `verify:release-blockers missing ${script}`);

for (const file of [
  contractPath,
  'scripts/verify-pass-162-enterprise-ga-decision-gate.mjs',
  'docs/enterprise-ga-decision-gate-pass162.md',
  'PASS_162_ENTERPRISE_GA_DECISION_GATE_SUMMARY.md'
]) need(exists(file), `missing PASS162 file: ${file}`);

includesAll(contractPath, [
  'ENTERPRISE_GA_DECISION_GATE_PASS',
  'PASS162',
  'ENTERPRISE_GA_DECISION_GATE_CONTRACT_ID',
  'enterprise-ga-decision-gate-v1',
  'ENTERPRISE_GA_DECISION_GATE_SCHEMA_VERSION = 1',
  'ENTERPRISE_GA_DECISION_GATE_STATUS',
  'blocked-pending-external-evidence',
  'ENTERPRISE_GA_REQUIRED_SOURCE_GATES',
  'ENTERPRISE_GA_REQUIRED_DECISION_DOMAINS',
  'ENTERPRISE_GA_REQUIRED_EXTERNAL_EVIDENCE',
  'ENTERPRISE_GA_BLOCKED_CLAIMS',
  'EnterpriseGaDecisionGate',
  'enterpriseGaDecisionGate',
  'enterpriseGaDecisionSummary',
  'source-and-build-gates',
  'windows-package-install-smoke',
  'linux-package-install-smoke',
  'manual-cross-size-qa-attestation',
  'enterprise-policy-management',
  'electron-webview-ipc-security',
  'mission-evidence-redaction',
  'runtime-e2e-harness',
  'signing-provenance-sbom',
  'support-bundle-redaction',
  'manual GA decision signoff record',
  'no enterprise GA claim without package, install, security, policy, provenance, evidence, support-bundle, and manual attestation proof',
]);

includesAll('docs/enterprise-ga-decision-gate-pass162.md', [
  'PASS162',
  'Enterprise GA Decision Gate',
  'blocked-pending-external-evidence',
  'Windows package/install smoke',
  'Linux package/install smoke',
  'Enterprise policy management',
  'Electron webview/IPC security',
  'Mission evidence redaction',
  'Runtime E2E harness',
  'Signing/provenance/SBOM',
  'Support-bundle redaction',
  'Manual GA decision signoff record',
  'No-false-GA rule',
  'npm run verify:pass-162-enterprise-ga-decision-gate',
]);

includesAll('PASS_162_ENTERPRISE_GA_DECISION_GATE_SUMMARY.md', [
  'PASS162',
  'Enterprise GA Decision Gate',
  'verify:pass-162-enterprise-ga-decision-gate',
  'PASS162 runs after `verify:pass-161-renderer-modularization`',
  'PASS152 no-false-GA evidence binder remains preserved',
  'Current status: `blocked-pending-external-evidence`',
  'Remaining enterprise GA passes: 0',
]);

// Prior enterprise-lane contracts must still expose the domains PASS162 depends on.
includesAll('src/shared/enterprise-evidence-binder-no-false-ga-contract.ts', [
  'ENTERPRISE_EVIDENCE_BINDER_REQUIRED_INSTALLED_EVIDENCE',
  'Windows installed-app smoke evidence',
  'Linux installed-package smoke evidence',
  'enterprise GA approved',
]);
includesAll('src/shared/signing-provenance-sbom-contract.ts', [
  'SIGNING_PROVENANCE_SBOM_PASS',
  'PASS159',
  'SBOM',
  'provenance',
]);
includesAll('src/shared/enterprise-support-bundle-contract.ts', [
  'ENTERPRISE_SUPPORT_BUNDLE_PASS',
  'PASS160',
  'rawCookiesIncluded: false',
  'rawTokensIncluded: false',
  'rawBrowserProfilesIncluded: false',
  'rawMissionFilesIncluded: false',
]);
includesAll('src/shared/enterprise-admin-policy-contract.ts', [
  'ENTERPRISE_ADMIN_POLICY_PASS',
  'PASS154',
  'lockedSettings',
  'disabledTools',
  'allowedProtocols',
]);
includesAll('src/shared/webview-attach-security-contract.ts', [
  'WEBVIEW_ATTACH_SECURITY_PASS',
  'PASS153',
  'allowpopups',
  'nodeintegration',
  'disablewebsecurity',
]);
includesAll('src/shared/evidence-capture-privacy-contract.ts', [
  'EVIDENCE_CAPTURE_PRIVACY_PASS',
  'PASS157',
  'redaction',
]);
includesAll('src/shared/runtime-e2e-harness-contract.ts', [
  'RUNTIME_E2E_HARNESS_PASS',
  'PASS158',
  'runtime',
]);

need(/blocked-pending-external-evidence/.test(contract), 'PASS162 must default to blocked pending external evidence');
need(!/ENTERPRISE_GA_DECISION_GATE_STATUS\s*=\s*['"]approved-after-manual-attestation['"]/.test(contract), 'PASS162 source must not approve GA by default');
need(!/status:\s*['"]approved-after-manual-attestation['"]/.test(contract), 'PASS162 source must not hard-code approved GA status');
need(!/signed enterprise package available[^'"`]*true/i.test(contract), 'PASS162 must not claim signed enterprise package availability');

const combined = [contract, read('docs/enterprise-ga-decision-gate-pass162.md'), read('PASS_162_ENTERPRISE_GA_DECISION_GATE_SUMMARY.md')].join('\n');
for (const forbidden of [
  /enterprise GA approved(?!['",\n\- ])/i,
  /production GA approved(?!['",\n\- ])/i,
  /ready for unrestricted enterprise deployment(?!['",\n\- ])/i,
  /all installed-app evidence complete(?!['",\n\- ])/i,
  /signed enterprise package available(?!['",\n\- ])/i,
]) {
  need(!forbidden.test(combined.replace(/ENTERPRISE_GA_BLOCKED_CLAIMS[\s\S]*?\]\s+as const\);/, '')), `PASS162 appears to make a false GA claim matching ${forbidden}`);
}

need(!/fetch\([^)]*psa/i.test(contract), 'PASS162 must not add browser-side PSA fetches');
need(!/client_secret\s*=\s*[^\s'"`]+|refresh_token\s*=\s*[^\s'"`]+|access_token\s*=\s*[^\s'"`]+|Authorization:\s*Bearer\s+[A-Za-z0-9._-]+|-----BEGIN\s+PRIVATE\s+KEY-----/i.test(contract + evidenceBinder + signing + support + policy + webview + evidencePrivacy + runtime), 'PASS162 must not introduce secret-bearing material');

for (const generated of [
  'dist/main/main.js',
  'dist/renderer/app.js',
  'release/windows/TAHAI-Windows-installers-manifest.json',
  'release/linux/TAHAI-Linux-installers-manifest.json',
  'artifacts/sbom/tahai-browser-sbom.json',
  'artifacts/provenance/tahai-browser-release-provenance.json',
  'artifacts/support/TAHAI-enterprise-support-bundle.md',
]) need(!exists(generated), `generated output must not be committed: ${generated}`);

if (errors.length) {
  for (const error of errors) console.error(`[PASS162][FAIL] ${error}`);
  process.exit(1);
}

console.log('[PASS162][OK] Enterprise GA Decision Gate verified.');
