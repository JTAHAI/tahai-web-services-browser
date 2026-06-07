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
const contract = includesAll('src/shared/evidence-capture-privacy-contract.ts', [
  'EVIDENCE_CAPTURE_PRIVACY_PASS',
  'PASS157',
  'EVIDENCE_CAPTURE_PRIVACY_CONTRACT_ID',
  'evidence-capture-privacy-hardening-v1',
  'EVIDENCE_CAPTURE_PRIVACY_SCHEMA_VERSION = 1',
  'EvidenceCapturePrivacyPolicy',
  'EvidenceCapturePrivacyReview',
  'requirePreviewBeforeShare: true',
  'blockHighRiskAutomaticSync: true',
  'minimizeSensitiveDomainPaths: true',
  'minimizeMetadataBeforeExport: true',
  'stripCookiesAndAuthHeaders: true',
  'storesSecrets: false',
  'directPsaApiAllowed: false',
  'EVIDENCE_CAPTURE_PRIVACY_SENSITIVE_HOSTS',
  'admin.microsoft.com',
  'entra.microsoft.com',
  'portal.azure.com',
  'console.aws.amazon.com',
  'admin.google.com',
  'dash.cloudflare.com',
  'github.com',
  'vercel.com',
  'docs.tahaiportal.com',
  'isSensitiveEvidenceCaptureUrl',
  'sanitizeSensitiveEvidencePath',
  'sanitizeEvidenceCaptureMetadata',
  'reviewEvidenceCapturePrivacy',
  'evidenceCapturePrivacySummary'
]);
const safety = includesAll('src/shared/evidence-safety.ts', [
  'evidence-capture-privacy-contract',
  'isSensitiveEvidenceCaptureUrl',
  'sanitizeSensitiveEvidencePath',
  'profileRedactsIdentifiers(profile)',
  'parsed.pathname = sanitizeSensitiveEvidencePath(parsed.pathname)',
  'sanitizeEvidenceUrl(match, profile)'
]);
const pack = includesAll('src/shared/evidence-pack.ts', [
  'evidenceCapturePrivacySummary',
  'reviewEvidenceCapturePrivacy',
  'PASS157 evidence capture privacy policy',
  'Evidence privacy review',
  'blockedForAutomaticSync',
  'psa-ticket-note'
]);
const validators = includesAll('src/shared/mission-validators.ts', [
  'sanitizeEvidenceCaptureMetadata',
  'sanitizeMissionEvidenceMetadata',
  'const metadata = sanitizeMissionEvidenceMetadata(input.metadata)'
]);
const app = includesAll('src/renderer/app.ts', [
  'evidence-capture-privacy-contract',
  'reviewEvidenceCapturePrivacy',
  'sanitizeEvidenceCaptureMetadata',
  "profile: 'sanitized-handoff'",
  'privacyReview.sensitiveDomain',
  'privacyReview.action'
]);

need(pkg.version === '1.8.30', `version must remain 1.8.30 for PASS157, found ${pkg.version}`);
need(pkg.scripts?.['verify:pass-157-evidence-capture-privacy-hardening'] === 'node scripts/verify-pass-157-evidence-capture-privacy-hardening.mjs', 'package missing PASS157 verifier script');
const pass156Idx = blockers.indexOf('verify:pass-156-mission-recipe-library');
const pass157Idx = blockers.indexOf('verify:pass-157-evidence-capture-privacy-hardening');
const finalBuildIdx = blockers.lastIndexOf('npm run build');
need(pass156Idx >= 0, 'release blockers missing PASS156');
need(pass157Idx > pass156Idx, 'PASS157 must run after PASS156');
need(finalBuildIdx > pass157Idx, 'PASS157 must run before final build');

for (const file of [
  'src/shared/evidence-capture-privacy-contract.ts',
  'scripts/verify-pass-157-evidence-capture-privacy-hardening.mjs',
  'docs/evidence-capture-privacy-hardening-pass157.md',
  'PASS_157_EVIDENCE_CAPTURE_PRIVACY_HARDENING_SUMMARY.md'
]) need(exists(file), `missing PASS157 file: ${file}`);

includesAll('docs/evidence-capture-privacy-hardening-pass157.md', [
  'PASS157',
  'Evidence Capture Privacy Hardening',
  'Sensitive admin-console domain detection',
  'metadata minimization',
  'High-risk secret-like findings block automatic IT Docs sync or PSA ticket-note generation',
  'No direct PSA API calls',
  'No generated release artifacts'
]);

includesAll('PASS_157_EVIDENCE_CAPTURE_PRIVACY_HARDENING_SUMMARY.md', [
  'PASS157',
  'Evidence Capture Privacy Hardening',
  'verify:pass-157-evidence-capture-privacy-hardening',
  'PASS157 runs after PASS156',
  'Remaining enterprise GA passes: 5'
]);

for (const unsafeKey of ['Authorization', 'Set-Cookie', 'client_secret', 'refresh_token', 'access_token', 'BEGIN PRIVATE KEY']) {
  need(contract.toLowerCase().includes(unsafeKey.toLowerCase()), `PASS157 contract should explicitly guard ${unsafeKey}-style metadata`);
}
need(/SENSITIVE_METADATA_KEY_RE\s*=\s*\/(?:.|\n)*authorization(?:.|\n)*cookie(?:.|\n)*token(?:.|\n)*secret/i.test(contract), 'metadata key regex must cover auth/cookie/token/secret families');
need(/IDENTIFIER_PATH_SEGMENT_RE/.test(contract), 'contract must define identifier path segment redaction');
need(!/fetch\([^)]*psa/i.test(app + contract + pack + safety), 'PASS157 must not add browser-side PSA fetches');
need(!/shell\.openExternal\([^)]*(?:evidence|capture|psa|ticket)/i.test(app + contract + pack + safety), 'PASS157 must not add unsafe direct shell.openExternal for evidence/ticket flows');
need(!/clipboard\.readText|localStorage|sessionStorage|document\.cookie/i.test(contract + safety + pack), 'PASS157 privacy contract must not read clipboard/storage/cookies');

for (const file of [
  'release/windows/TAHAI-Windows-installers-manifest.json',
  'release/linux/TAHAI-Linux-installers-manifest.json',
  'artifacts/enterprise-all-surfaces/PASS151-enterprise-all-surfaces-evidence.json',
  'artifacts/enterprise-evidence-binder/PASS152-enterprise-evidence-binder.json',
  'dist/main/main.js',
]) need(!exists(file), `generated output must not be committed: ${file}`);

if (errors.length) {
  for (const error of errors) console.error(`[PASS157][FAIL] ${error}`);
  process.exit(1);
}

console.log('[PASS157][OK] Evidence Capture Privacy Hardening verified.');
