#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repo = process.cwd();
const PASS = 'PASS230';
const configPath = process.env.TAHAI_GA_STORE_DECISION_JSON || path.join(repo, 'config', 'ga-store-deploy-decision-gate.example.json');
const outputDir = process.env.TAHAI_GA_STORE_DECISION_OUTPUT_DIR || '';
const shouldEmit = process.env.TAHAI_GA_STORE_DECISION_EMIT === '1';

function rel(filePath) { return path.relative(repo, filePath).replace(/\\/g, '/'); }
function fail(message) {
  console.error(`[${PASS}][BLOCKED] ${message}`);
  process.exit(1);
}
function assert(condition, message) { if (!condition) fail(message); }
function read(filePath) {
  if (!fs.existsSync(filePath)) fail(`missing ${rel(filePath)}`);
  return fs.readFileSync(filePath, 'utf8');
}
function parseJson(filePath) {
  try { return JSON.parse(read(filePath)); }
  catch (error) { fail(`${rel(filePath)} is invalid JSON: ${error.message}`); }
}
function requireBooleanFalse(object, key, label) {
  assert(object?.[key] === false, `${label}.${key} must be false in the default source-side gate`);
}
function requireBooleanTrue(object, key, label) {
  assert(object?.[key] === true, `${label}.${key} must be true`);
}

const gate = parseJson(configPath);
assert(gate.schemaVersion === 1, 'schemaVersion must be 1');
assert(gate.pass === 'PASS230', 'pass must be PASS230');
assert(gate.name === 'GA / Store Deploy Decision Gate', 'name must be GA / Store Deploy Decision Gate');
requireBooleanTrue(gate, 'sourceSideGateOnly', 'root');
requireBooleanTrue(gate, 'noNewFeatures', 'root');

for (const key of [
  'publicGaAllowed',
  'microsoftStoreSubmissionAllowed',
  'broadPublicInstallerPushAllowed',
  'directDownloadTrustedSigningClaimAllowed'
]) requireBooleanFalse(gate.defaultDecision, key, 'defaultDecision');

for (const key of [
  'thisPassDoesNotAddFeatures',
  'thisPassDoesNotSubmitToStore',
  'thisPassDoesNotCreateMsixUpload',
  'thisPassDoesNotLoadPartnerCenterCredentials',
  'thisPassDoesNotClaimStoreApproval',
  'thisPassDoesNotClaimDirectDownloadSigning',
  'thisPassDoesNotCommitGeneratedArtifacts',
  'thisPassDoesNotAddSecretsOrCertificates'
]) requireBooleanTrue(gate.hardBoundaries, key, 'hardBoundaries');

assert(Array.isArray(gate.requiredGateEvidence) && gate.requiredGateEvidence.length >= 4, 'requiredGateEvidence must include G1-G4 gate evidence');
const requiredGateIds = ['g1-full-ux-hardening', 'g2-enterprise-security-data', 'g3-release-evidence', 'g4-external-distribution'];
for (const id of requiredGateIds) {
  const gateItem = gate.requiredGateEvidence.find((item) => item.id === id);
  assert(Boolean(gateItem), `requiredGateEvidence missing ${id}`);
  assert(gateItem.required === true, `${id} must be required`);
  assert(Array.isArray(gateItem.sourcePasses) && gateItem.sourcePasses.length >= 4, `${id} must list source passes`);
  assert(Array.isArray(gateItem.mustProve) && gateItem.mustProve.length >= 4, `${id} must list proof requirements`);
  assert(String(gateItem.defaultStatus || '').startsWith('blocked-'), `${id} defaultStatus must be blocked-*`);
}

for (const command of [
  'npm run prepare:win:msix-manifest',
  'npm run prepare:store-submission-packet',
  'npm run prepare:ga-store-deploy-decision-gate',
  'npm run verify:pass-230-ga-store-deploy-decision-gate',
  'npm run verify:release-blockers',
  'npm run build'
]) {
  assert(gate.requiredCommands?.includes(command), `requiredCommands missing ${command}`);
}

assert(Array.isArray(gate.manualEvidenceChecklist) && gate.manualEvidenceChecklist.length >= 8, 'manualEvidenceChecklist must include at least 8 items');
requireBooleanFalse(gate.decisionOutputs?.defaultSourceSideOutcome, 'publicGaAllowed', 'decisionOutputs.defaultSourceSideOutcome');
requireBooleanFalse(gate.decisionOutputs?.defaultSourceSideOutcome, 'microsoftStoreSubmissionAllowed', 'decisionOutputs.defaultSourceSideOutcome');
requireBooleanFalse(gate.decisionOutputs?.defaultSourceSideOutcome, 'broadPublicInstallerPushAllowed', 'decisionOutputs.defaultSourceSideOutcome');
requireBooleanFalse(gate.decisionOutputs?.defaultSourceSideOutcome, 'directDownloadTrustedSigningClaimAllowed', 'decisionOutputs.defaultSourceSideOutcome');

const summary = {
  pass: 'PASS230',
  sourceSideGateOnly: true,
  noNewFeatures: true,
  publicGaAllowed: false,
  microsoftStoreSubmissionAllowed: false,
  broadPublicInstallerPushAllowed: false,
  directDownloadTrustedSigningClaimAllowed: false,
  gates: gate.requiredGateEvidence.map((item) => ({
    id: item.id,
    title: item.title,
    required: item.required,
    defaultStatus: item.defaultStatus,
    sourcePassCount: item.sourcePasses.length,
    proofCount: item.mustProve.length
  })),
  manualEvidenceItemCount: gate.manualEvidenceChecklist.length,
  reason: gate.defaultDecision.reason
};

if (shouldEmit) {
  assert(outputDir, 'TAHAI_GA_STORE_DECISION_OUTPUT_DIR is required when TAHAI_GA_STORE_DECISION_EMIT=1');
  const fullOutputDir = path.resolve(repo, outputDir);
  fs.mkdirSync(fullOutputDir, { recursive: true });
  fs.writeFileSync(path.join(fullOutputDir, 'ga-store-deploy-decision-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(`[${PASS}][OK] Wrote source-side GA / Store decision summary to ${rel(fullOutputDir)}`);
} else {
  console.log(`[${PASS}][OK] GA / Store Deploy Decision Gate validated. Default source-side decision remains blocked until manual evidence and external approvals exist.`);
}
