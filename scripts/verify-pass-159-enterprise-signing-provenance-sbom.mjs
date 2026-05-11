#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

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
const manifest = json('docs/ga-release-manifest-pass150.json');

need(pkg.version === '1.8.30', `version must remain 1.8.30 for PASS159, found ${pkg.version}`);
need(pkg.scripts?.['verify:pass-159-enterprise-signing-provenance-sbom'] === 'node scripts/verify-pass-159-enterprise-signing-provenance-sbom.mjs', 'package missing PASS159 verifier script');
need(pkg.scripts?.['generate:sbom'] === 'node scripts/generate-source-sbom.mjs --output artifacts/sbom/tahai-browser-sbom.json', 'package generate:sbom script drifted');
need(pkg.scripts?.['release:provenance:plan'] === 'node scripts/generate-pass159-release-provenance.mjs --plan-json', 'package missing PASS159 provenance plan script');
need(pkg.scripts?.['release:provenance'] === 'node scripts/generate-pass159-release-provenance.mjs --output artifacts/provenance/tahai-browser-release-provenance.json', 'package missing PASS159 provenance output script');

const pass158Idx = blockers.indexOf('verify:pass-158-runtime-e2e-harness');
const pass159Idx = blockers.indexOf('verify:pass-159-enterprise-signing-provenance-sbom');
const finalBuildIdx = blockers.lastIndexOf('npm run build');
need(pass158Idx >= 0, 'release blockers missing PASS158');
need(pass159Idx > pass158Idx, 'PASS159 must run after PASS158');
need(finalBuildIdx > pass159Idx, 'PASS159 must run before final build');
need(blockers.includes('verify:pass-152-enterprise-evidence-binder'), 'release blockers must preserve PASS152 no-false-GA gate');

for (const file of [
  'src/shared/signing-provenance-sbom-contract.ts',
  'scripts/generate-pass159-release-provenance.mjs',
  'scripts/generate-source-sbom.mjs',
  'scripts/verify-pass-159-enterprise-signing-provenance-sbom.mjs',
  'docs/enterprise-signing-provenance-sbom-pass159.md',
  'docs/enterprise-release-provenance-pass159.template.json',
  'PASS_159_ENTERPRISE_SIGNING_PROVENANCE_SBOM_SUMMARY.md'
]) need(exists(file), `missing PASS159 file: ${file}`);

const contract = includesAll('src/shared/signing-provenance-sbom-contract.ts', [
  'SIGNING_PROVENANCE_SBOM_PASS',
  'PASS159',
  'SIGNING_PROVENANCE_SBOM_CONTRACT_ID',
  'enterprise-signing-provenance-sbom-v1',
  'SIGNING_PROVENANCE_SBOM_SCHEMA_VERSION = 1',
  'SigningProvenanceSbomContract',
  'sourceOnlyVerifier: true',
  'storesSecrets: false',
  'commitsGeneratedArtifacts: false',
  'directPsaApiAllowed: false',
  'noFalseSigningClaim: true',
  'requiresPublicCommitOrTag: true',
  'requiresLockfileHash: true',
  'requiresSbom: true',
  'requiresSha256Sums: true',
  'requiresArtifactManifests: true',
  'requiresProvenanceManifest: true',
  'requiresInstallerSmokeEvidenceBeforeEnterpriseGA: true',
  'TAHAI-Web-Services-Browser-1.8.30-x64.exe',
  'TAHAI-Web-Services-Browser-1.8.30-x64.msi',
  'TAHAI-Web-Services-Browser-1.8.30-x64.AppImage',
  'TAHAI-Web-Services-Browser-1.8.30-x64.deb',
  'TAHAI-Web-Services-Browser-1.8.30-x64.rpm',
  'signingProvenanceSbomSummary'
]);

const sbomScript = includesAll('scripts/generate-source-sbom.mjs', [
  'PASS159',
  'enterprise-signing-provenance-sbom-v1',
  'schemaVersion: 2',
  'packageLockSha256',
  'packageJsonSha256',
  'npmIntegrity',
  'mustMatchPublicCommitOrTag',
  'mustBePublishedBesideArtifacts',
  'noFalseSigningClaim',
  'commitGeneratedArtifacts: false'
]);

const provenanceScript = includesAll('scripts/generate-pass159-release-provenance.mjs', [
  'PASS159',
  'enterprise-signing-provenance-sbom-v1',
  '--plan-json',
  '--output',
  'packageLockSha256',
  'requiredArtifacts',
  'unsigned-preview-until-approved-signing-lane-is-active',
  'release/windows/TAHAI-Web-Services-Browser-${pkg.version}-x64.exe',
  'artifacts/sbom/tahai-browser-sbom.json',
  'artifacts/provenance/tahai-browser-release-provenance.json',
  'enterpriseGaBlockedUntil',
  'generated installers',
  'generated SBOMs',
  'generated provenance manifests'
]);

const docs = includesAll('docs/enterprise-signing-provenance-sbom-pass159.md', [
  'PASS159',
  'Enterprise Signing/Provenance/SBOM Gate',
  'no false signing claim',
  'SBOM',
  'package-lock SHA-256',
  'release provenance manifest',
  'Windows installer handoff manifest',
  'Linux package handoff manifest',
  'npm run generate:sbom',
  'npm run release:provenance:plan',
  'No generated artifacts',
  'No PSA connector'
]);

includesAll('docs/code-signing-policy.md', [
  'PASS159',
  'No false signing claim',
  'release provenance manifest',
  'SBOM',
  'package-lock SHA-256'
]);

includesAll('docs/downloads-and-checksums.md', [
  'PASS159',
  'release provenance manifest',
  'SBOM',
  'package-lock SHA-256',
  'Publish these together'
]);

const template = json('docs/enterprise-release-provenance-pass159.template.json');
need(template.pass === 'PASS159', 'PASS159 provenance template must identify PASS159');
need(template.contractId === 'enterprise-signing-provenance-sbom-v1', 'PASS159 template contract mismatch');
need(template.noFalseSigningClaim === true, 'PASS159 template must block false signing claims');
need(Array.isArray(template.requiredArtifacts) && template.requiredArtifacts.length >= 7, 'PASS159 template must list release artifacts, SBOM, and provenance manifest');
need(template.requiredBeforeEnterpriseGA?.includes('signed-artifact-or-unsigned-preview-truth'), 'PASS159 template missing signing truth GA blocker');

need(manifest.enterpriseSigningProvenanceSbomGate?.pass === 'PASS159', 'GA manifest missing PASS159 addendum');
need(manifest.enterpriseSigningProvenanceSbomGate?.status === 'blocked-until-signing-provenance-sbom-evidence-exists', 'PASS159 manifest status must block until signing/provenance/SBOM evidence exists');
need(Array.isArray(manifest.enterpriseSigningProvenanceSbomGate?.requiredBeforeEnterpriseGA), 'PASS159 manifest must list GA blockers');

const plan = JSON.parse(execFileSync(process.execPath, ['scripts/generate-pass159-release-provenance.mjs', '--plan-json'], { cwd: root, encoding: 'utf8' }));
need(plan.pass === 'PASS159', 'PASS159 provenance plan must identify PASS159');
need(plan.contractId === 'enterprise-signing-provenance-sbom-v1', 'PASS159 provenance plan contract mismatch');
need(plan.version === '1.8.30', 'PASS159 provenance plan version mismatch');
need(typeof plan.packageLockSha256 === 'string' && /^[a-f0-9]{64}$/.test(plan.packageLockSha256), 'PASS159 provenance plan package-lock SHA256 invalid');
need(plan.requiredArtifacts?.length >= 7, 'PASS159 provenance plan must include required artifacts');
need(plan.enterpriseGaBlockedUntil?.some((x) => x.includes('signing')), 'PASS159 provenance plan must block GA on signing truth');

need(!/client_secret|refresh_token|access_token|BEGIN PRIVATE KEY|Authorization:\s*Bearer\s+[A-Za-z0-9._-]+/i.test(contract + sbomScript + provenanceScript + docs), 'PASS159 must not introduce secret-bearing material');
need(!/fetch\([^)]*psa/i.test(contract + sbomScript + provenanceScript), 'PASS159 must not add browser-side PSA fetches');
need(!/enterpriseGADecision\s*['"]?\s*:\s*['"]?approved/i.test(read('docs/ga-release-manifest-pass150.json')), 'manifest must not approve enterprise GA');

for (const generated of [
  'dist/main/main.js',
  'dist/renderer/app.js',
  'release/windows/TAHAI-Windows-installers-manifest.json',
  'release/linux/TAHAI-Linux-installers-manifest.json',
  'artifacts/sbom/tahai-browser-sbom.json',
  'artifacts/provenance/tahai-browser-release-provenance.json'
]) need(!exists(generated), `generated output must not be committed: ${generated}`);

if (errors.length) {
  for (const error of errors) console.error(`[PASS159][FAIL] ${error}`);
  process.exit(1);
}

console.log('[PASS159][OK] Enterprise Signing/Provenance/SBOM Gate verified.');
