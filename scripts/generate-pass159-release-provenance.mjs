#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const getArg = (flag, fallback = undefined) => {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : fallback;
};
const read = (rel) => fs.readFileSync(path.join(root, rel));
const readText = (rel) => read(rel).toString('utf8').replace(/^﻿/, '');
const sha256File = (rel) => crypto.createHash('sha256').update(read(rel)).digest('hex');
const sha256Text = (text) => crypto.createHash('sha256').update(text).digest('hex');

const pkg = JSON.parse(readText('package.json'));
const lockHash = sha256File('package-lock.json');
const contractPath = 'src/shared/signing-provenance-sbom-contract.ts';
const contractText = readText(contractPath);

const artifacts = [
  { kind: 'windows-exe', path: `release/windows/TAHAI-Web-Services-Browser-${pkg.version}-x64.exe`, requiredSha256: true, requiredSignatureState: 'unsigned-preview' },
  { kind: 'windows-msi', path: `release/windows/TAHAI-Web-Services-Browser-${pkg.version}-x64.msi`, requiredSha256: true, requiredSignatureState: 'unsigned-preview' },
  { kind: 'linux-appimage', path: `release/linux/TAHAI-Web-Services-Browser-${pkg.version}-x64.AppImage`, requiredSha256: true, requiredSignatureState: 'not-applicable' },
  { kind: 'linux-deb', path: `release/linux/TAHAI-Web-Services-Browser-${pkg.version}-x64.deb`, requiredSha256: true, requiredSignatureState: 'not-applicable' },
  { kind: 'linux-rpm', path: `release/linux/TAHAI-Web-Services-Browser-${pkg.version}-x64.rpm`, requiredSha256: true, requiredSignatureState: 'not-applicable' },
  { kind: 'sbom', path: 'artifacts/sbom/tahai-browser-sbom.json', requiredSha256: true, requiredSignatureState: 'not-applicable' },
  { kind: 'provenance-manifest', path: 'artifacts/provenance/tahai-browser-release-provenance.json', requiredSha256: true, requiredSignatureState: 'not-applicable' }
];

const requiredCommands = [
  'npm ci',
  'npm run verify:release-blockers',
  'npm run generate:sbom',
  'npm run release:provenance:plan',
  'npm run package:win:release',
  'npm run package:linux',
  'npm run release:public:manifest'
];

const plan = {
  pass: 'PASS159',
  contractId: 'enterprise-signing-provenance-sbom-v1',
  schemaVersion: 1,
  productName: pkg.productName,
  packageName: pkg.name,
  version: pkg.version,
  releaseChannel: 'manual-release',
  provenanceState: 'source-only-plan',
  generatedAt: new Date().toISOString(),
  packageLockSha256: lockHash,
  contractSha256: sha256Text(contractText),
  signingTruth: {
    windows: 'unsigned-preview-until-approved-signing-lane-is-active',
    linux: 'checksum-and-package-manager-verification-required',
    macos: 'not-public-release-until-apple-signing-and-notarization-are-configured',
    noFalseSigningClaim: true
  },
  requiredCommands,
  requiredArtifacts: artifacts,
  publishTogether: [
    'installer/package artifacts',
    'SHA256SUMS files',
    'Windows and Linux handoff manifests',
    'SBOM JSON',
    'release provenance manifest',
    'manual installed smoke evidence summaries'
  ],
  enterpriseGaBlockedUntil: [
    'all release artifacts are generated from the public commit/tag',
    'all artifacts have SHA256 entries generated after packaging',
    'SBOM is generated from the exact package-lock.json used for packaging',
    'release provenance manifest ties version, commit/tag, package-lock hash, checksums, and signing status together',
    'Windows and Linux installed-app smoke evidence exists outside the source tree',
    'any public signing/notarization claim is backed by actual certificate/notarization evidence'
  ],
  forbiddenSourceOutputs: ['dist/', 'release/', 'artifacts/', 'node_modules/', 'generated installers', 'generated SBOMs', 'generated provenance manifests']
};

if (has('--plan-json')) {
  process.stdout.write(JSON.stringify(plan, null, 2) + '\n');
  process.exit(0);
}

const output = getArg('--output');
if (!output) {
  console.log(`[PASS159][PLAN] ${plan.productName} ${plan.version} provenance plan ready; use --plan-json or --output <path>.`);
  process.exit(0);
}

const outPath = path.join(root, output);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ ...plan, provenanceState: 'generated-after-packaging' }, null, 2) + '\n');
console.log(`[PASS159][OK] release provenance manifest written: ${output}`);
