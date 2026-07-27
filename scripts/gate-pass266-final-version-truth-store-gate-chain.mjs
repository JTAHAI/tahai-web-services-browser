#!/usr/bin/env node
/* PASS266 fail-closed gate: real final version truth review required */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pass = 'PASS266';
const finalVersion = '2.0.18';
const remainingPassesAfterThisPass = 5;
const candidates = [
  process.env.PASS266_FINAL_VERSION_TRUTH,
  'release-candidate/store-submission/pass266-final-version-truth-gate-chain-repair.json'
].filter(Boolean);
const requiredPasses = ['PASS260','PASS261','PASS262','PASS263','PASS264','PASS265'];
function rel(file) { return path.relative(root, file).replace(/\\/g, '/'); }
function find() {
  for (const candidate of candidates) {
    const full = path.isAbsolute(candidate) ? candidate : path.join(root, candidate);
    if (fs.existsSync(full)) return full;
  }
  return null;
}
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function placeholder(value) { return typeof value !== 'string' || !value.trim() || /REPLACE_WITH|PLACEHOLDER|PENDING|TODO|TBD/i.test(value); }
function fail(blockers, evidenceFile = null) {
  console.error('PASS266_FINAL_VERSION_TRUTH_STORE_GATE_CHAIN=BLOCKED');
  if (evidenceFile) console.error('PASS266_EVIDENCE=' + rel(evidenceFile));
  for (const blocker of blockers) console.error('- ' + blocker);
  process.exit(1);
}
const file = find();
if (!file) fail([
  'Missing filled PASS266 final version truth evidence file.',
  'Create release-candidate/store-submission/pass266-final-version-truth-gate-chain-repair.json from docs/store/pass266-final-version-truth-gate-chain-repair.template.json.',
  'Do not rely on PASS260-PASS265 as one final package evidence chain until this is filled with real review output.'
]);
let evidence;
try { evidence = readJson(file); } catch (error) { fail(['PASS266 evidence JSON could not be parsed: ' + error.message], file); }
const blockers = [];
if (evidence.schemaVersion !== 1) blockers.push('schemaVersion must be 1.');
if (evidence.pass !== pass) blockers.push('pass must be PASS266.');
if (!['PASS','READY_FOR_PASS267_RUNTIME_HARNESS'].includes(evidence.status)) blockers.push('status must be PASS or READY_FOR_PASS267_RUNTIME_HARNESS after real repair review.');
if (evidence.versionTarget !== finalVersion) blockers.push('versionTarget must be ' + finalVersion + '.');
if (evidence.packageVersion !== finalVersion) blockers.push('packageVersion must be ' + finalVersion + '.');
if (evidence.remainingPassesAfterThisPass !== remainingPassesAfterThisPass) blockers.push('remainingPassesAfterThisPass must be ' + remainingPassesAfterThisPass + '.');
for (const field of ['generatedAt','preparedBy','sourceCommit']) if (placeholder(evidence[field])) blockers.push(field + ' is missing or placeholder.');
const scope = evidence.repairScope || {};
for (const key of ['pass260ThroughPass265UseOneFinalPackageVersion','historicalPassProvenancePreserved','noStoreSubmissionPerformedByThisPass']) if (scope[key] !== true) blockers.push('repairScope.' + key + ' must be true.');
if (scope.finalEvidencePackageVersion !== finalVersion) blockers.push('repairScope.finalEvidencePackageVersion must be ' + finalVersion + '.');
if (scope.storeSubmissionStatus !== 'not-submitted') blockers.push('repairScope.storeSubmissionStatus must be not-submitted.');
if (scope.storeApprovalStatus !== 'not-approved') blockers.push('repairScope.storeApprovalStatus must be not-approved.');
for (const [section, keys] of Object.entries({
  scriptTruth: ['pass260GateRequiresFinalVersion','pass261GateRequiresFinalVersion','pass262GateRequiresFinalVersion','pass263GateRequiresFinalVersion','pass264GateRequiresFinalVersion','pass265GateRequiresFinalVersion','pass260VerifierRequiresFinalVersion','pass261VerifierRequiresFinalVersion','pass262VerifierRequiresFinalVersion','pass263VerifierRequiresFinalVersion','pass264VerifierRequiresFinalVersion','pass265VerifierRequiresFinalVersion'],
  templateTruth: ['pass260TemplateFinalVersion','pass261TemplateFinalVersion','pass262TemplateFinalVersion','pass263TemplateFinalVersion','pass264TemplateFinalVersion','pass265TemplateFinalVersion','runtimeFixturesFinalVersion']
})) {
  for (const key of keys) if (evidence[section]?.[key] !== true) blockers.push(section + '.' + key + ' must be true.');
}
const rows = Array.isArray(evidence.priorEvidenceVersionMatrix) ? evidence.priorEvidenceVersionMatrix : [];
for (const passName of requiredPasses) {
  const row = rows.find((item) => item && item.pass === passName);
  if (!row) { blockers.push('Missing priorEvidenceVersionMatrix row for ' + passName + '.'); continue; }
  if (row.packageVersion !== finalVersion) blockers.push(passName + ' packageVersion must be ' + finalVersion + '.');
  if (row.versionMatchesFinalPackage !== true) blockers.push(passName + ' versionMatchesFinalPackage must be true.');
  if (row.gateOutputCaptured !== true) blockers.push(passName + ' gateOutputCaptured must be true.');
  if (placeholder(row.evidencePath)) blockers.push(passName + ' evidencePath is missing or placeholder.');
}
const truth = evidence.releaseTruth || {};
if (truth.microsoftStoreSubmissionClaim !== 'not-submitted') blockers.push('releaseTruth.microsoftStoreSubmissionClaim must be not-submitted.');
if (truth.microsoftStoreApprovalClaim !== 'not-approved') blockers.push('releaseTruth.microsoftStoreApprovalClaim must be not-approved.');
if (truth.publicGaClaim !== false) blockers.push('releaseTruth.publicGaClaim must be false.');
for (const key of ['noSignedInstallerClaimUnlessSeparatelyEvidenced','noITDocsBackendOrPSAConnectorClaim','noDirectPSAApiOrSecretStorageClaim']) if (truth[key] !== true) blockers.push('releaseTruth.' + key + ' must be true.');
const approval = evidence.operatorApproval || {};
if (approval.approvedVersionRepair !== true) blockers.push('operatorApproval.approvedVersionRepair must be true.');
if (approval.approvedToProceedToPass267RuntimeHarness !== true) blockers.push('operatorApproval.approvedToProceedToPass267RuntimeHarness must be true.');
if (approval.approvedForPartnerCenterManualSubmission === true) blockers.push('PASS266 must not approve Partner Center submission.');
if (approval.approvedForPublicGA === true) blockers.push('PASS266 must not approve public GA.');
const go = evidence.goNoGo || {};
if (!['READY_FOR_PASS267_RUNTIME_HARNESS','PASS'].includes(go.status)) blockers.push('goNoGo.status must be READY_FOR_PASS267_RUNTIME_HARNESS or PASS.');
if (go.readyForPass267 !== true) blockers.push('goNoGo.readyForPass267 must be true.');
if (go.readyForPartnerCenterSubmission === true) blockers.push('goNoGo.readyForPartnerCenterSubmission must not be true.');
if (go.readyForPublicGA === true) blockers.push('goNoGo.readyForPublicGA must not be true.');

if (blockers.length) fail(blockers, file);
console.log('PASS266_FINAL_VERSION_TRUTH_STORE_GATE_CHAIN=PASS_READY_FOR_PASS267_RUNTIME_HARNESS');
console.log('PASS266_EVIDENCE=' + rel(file));
console.log('PASS266_VERSION_TARGET=' + finalVersion);
console.log('PASS266_REMAINING_PASSES_AFTER_THIS=' + remainingPassesAfterThisPass);
console.log('PASS266_STORE_SUBMISSION=not-submitted');
console.log('PASS266_STORE_APPROVAL=not-approved');
