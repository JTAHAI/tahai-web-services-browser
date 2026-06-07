#!/usr/bin/env node
/* Gate PASS265 final Store handoff freeze + operator approval packet. Fails closed until real proof exists. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const requiredVersion = '2.0.14';
const remainingPassesAfterThisPass = 0;
const handoffCandidates = [
  path.join(root, 'release-candidate', 'store-submission', 'pass265-store-handoff-freeze-operator-approval.json'),
  path.join(root, 'release-candidate', 'store-submission', 'PASS265-store-handoff-freeze-operator-approval.json')
];
const priorEvidence = {
  PASS260: path.join(root, 'release-candidate', 'store-submission', 'pass260-installed-recipe-quad-smoke-evidence.json'),
  PASS261: path.join(root, 'release-candidate', 'store-submission', 'pass261-store-submission-packet.json'),
  PASS262: path.join(root, 'release-candidate', 'store-submission', 'pass262-store-asset-evidence-pack.json'),
  PASS263: path.join(root, 'release-candidate', 'store-submission', 'pass263-store-listing-copy-truth-pack.json'),
  PASS264: path.join(root, 'release-candidate', 'store-submission', 'pass264-store-submission-dry-run-evidence.json')
};
const requiredPriorPasses = Object.keys(priorEvidence);
const requiredFreezeBooleans = ['pass260InstalledSmokeGatePassed','pass261SubmissionPacketGatePassed','pass262AssetEvidenceGatePassed','pass263ListingCopyGatePassed','pass264DryRunGatePassed','allEvidenceHashesRecorded','sourceCommitRecorded','packageVersionRecorded','publicUrlsRecordedAndReviewed','screenshotsRecordedAndReviewed','knownIssuesRecordedAndReviewed','privacySupportSecurityUrlsReviewed','noSecretReviewPassed','noFalseStoreClaimReviewPassed','operatorReadKnownIssues','operatorReviewedSubmissionRisks','operatorApprovedFreeze'];
const requiredFinalAttestations = ['notSubmittedToMicrosoftStore','notApprovedByMicrosoftStore','noSignedMsiExeClaimUnlessSeparatelyEvidenced','noPublicGaClaimUnlessSeparatelyEvidenced','noITDocsBackendOrPSAConnectorClaim','noDirectPSAApiOrSecretStorageClaim','handoffPacketReadyForHumanDecision'];
const prohibitedClaims = ['submitted to microsoft store','microsoft store approved','store approved','store certified','available in the microsoft store','signed msi','signed exe','public ga','general availability','direct psa api','psa connector included','stores psa tokens','stores provider secrets'];

function rel(file) { return path.relative(root, file).replace(/\\/g, '/'); }
function find(candidates) { for (const candidate of candidates) if (fs.existsSync(candidate)) return candidate; return null; }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function shaFile(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function sha64(value) { return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value); }
function placeholder(value) { return typeof value !== 'string' || !value.trim() || /REPLACE_WITH|PLACEHOLDER|PENDING|TODO|TBD|NOT_APPLICABLE/i.test(value); }
function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, out);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) collectStrings(item, out);
  return out;
}
function fail(blockers, handoffFile = null) {
  console.error('PASS265_STORE_HANDOFF_FREEZE_GATE=BLOCKED');
  if (handoffFile) console.error('PASS265_HANDOFF_PACKET=' + rel(handoffFile));
  for (const blocker of blockers) console.error('- ' + blocker);
  process.exit(1);
}

const handoffFile = find(handoffCandidates);
if (!handoffFile) {
  fail([
    'Missing filled PASS265 Store handoff freeze/operator approval file.',
    'Create release-candidate/store-submission/pass265-store-handoff-freeze-operator-approval.json from docs/store/pass265-store-handoff-freeze-operator-approval.template.json.',
    'This gate intentionally cannot pass from source templates alone.'
  ]);
}

let handoff;
try { handoff = readJson(handoffFile); } catch (error) { fail(['PASS265 handoff packet JSON could not be parsed: ' + error.message], handoffFile); }
const blockers = [];

if (handoff.schemaVersion !== 1) blockers.push('schemaVersion must be 1.');
if (handoff.pass !== 'PASS265') blockers.push('pass must be PASS265.');
if (handoff.versionTarget !== requiredVersion) blockers.push('versionTarget must be ' + requiredVersion + '.');
if (handoff.remainingPassesAfterThisPass !== remainingPassesAfterThisPass) blockers.push('remainingPassesAfterThisPass must be 0.');
if (!['HANDOFF_FREEZE_APPROVED_NOT_SUBMITTED','FROZEN_READY_FOR_OPERATOR_DECISION'].includes(handoff.status)) blockers.push('status must be HANDOFF_FREEZE_APPROVED_NOT_SUBMITTED or FROZEN_READY_FOR_OPERATOR_DECISION.');
for (const field of ['generatedAt','preparedBy','sourceCommit','packageVersion']) if (placeholder(handoff[field])) blockers.push(field + ' is missing or placeholder.');
if (handoff.packageVersion !== requiredVersion) blockers.push('packageVersion must be ' + requiredVersion + '.');

const truth = handoff.storeTruth || {};
if (truth.microsoftStoreSubmissionClaim !== 'not-submitted') blockers.push('storeTruth.microsoftStoreSubmissionClaim must remain not-submitted.');
if (truth.microsoftStoreApprovalClaim !== 'not-approved') blockers.push('storeTruth.microsoftStoreApprovalClaim must remain not-approved.');
if (truth.handoffFreezeOnly !== true) blockers.push('storeTruth.handoffFreezeOnly must be true.');
if (truth.noPartnerCenterSubmitPerformedByThisPass !== true) blockers.push('storeTruth.noPartnerCenterSubmitPerformedByThisPass must be true.');
if (truth.noPublicGaClaim !== true) blockers.push('storeTruth.noPublicGaClaim must be true.');
if (!['unsigned-preview','separately-evidenced'].includes(truth.directMsiExeSigningStatus)) blockers.push('storeTruth.directMsiExeSigningStatus must be unsigned-preview or separately-evidenced.');

const priorRows = Array.isArray(handoff.priorGateResults) ? handoff.priorGateResults : [];
for (const passName of requiredPriorPasses) {
  const evidencePath = priorEvidence[passName];
  if (!fs.existsSync(evidencePath)) blockers.push('Missing prior evidence file for ' + passName + ': ' + rel(evidencePath));
  const row = priorRows.find((item) => item.pass === passName);
  if (!row) { blockers.push('Missing priorGateResults row for ' + passName + '.'); continue; }
  if (row.gatePassed !== true) blockers.push(passName + ' prior gate row must have gatePassed=true.');
  if (row.reviewed !== true) blockers.push(passName + ' prior gate row must have reviewed=true.');
  if (!sha64(row.evidenceSha256)) blockers.push(passName + ' evidenceSha256 must be a 64-character SHA256.');
  if (fs.existsSync(evidencePath) && sha64(row.evidenceSha256) && row.evidenceSha256.toLowerCase() !== shaFile(evidencePath)) blockers.push(passName + ' evidenceSha256 does not match ' + rel(evidencePath) + '.');
  if (placeholder(row.gateOutputPath)) blockers.push(passName + ' gateOutputPath is missing or placeholder.');
}

const review = handoff.freezeReview || {};
for (const key of requiredFreezeBooleans) if (review[key] !== true) blockers.push('freezeReview.' + key + ' must be true.');
const attest = handoff.finalAttestations || {};
for (const key of requiredFinalAttestations) if (attest[key] !== true) blockers.push('finalAttestations.' + key + ' must be true.');

const inv = handoff.releaseCandidateInventory || {};
for (const field of ['screenshotsFolder','partnerCenterDraftNotesPath','knownIssuesPath','publicUrlsReviewPath']) if (placeholder(inv[field])) blockers.push('releaseCandidateInventory.' + field + ' is missing or placeholder.');
const sourceZip = inv.sourceZip || {};
if (placeholder(sourceZip.path)) blockers.push('releaseCandidateInventory.sourceZip.path is missing or placeholder.');
if (!sha64(sourceZip.sha256)) blockers.push('releaseCandidateInventory.sourceZip.sha256 must be a 64-character SHA256.');
if (sourceZip.reviewed !== true) blockers.push('releaseCandidateInventory.sourceZip.reviewed must be true.');
const packages = Array.isArray(inv.packageFiles) ? inv.packageFiles : [];
if (!packages.length) blockers.push('releaseCandidateInventory.packageFiles must list at least one package artifact.');
for (const pkg of packages) {
  if (placeholder(pkg.path)) blockers.push('Package artifact path for ' + (pkg.kind || 'unknown') + ' is missing or placeholder.');
  if (!sha64(pkg.sha256)) blockers.push('Package artifact sha256 for ' + (pkg.kind || 'unknown') + ' must be a 64-character SHA256.');
  if (pkg.reviewed !== true) blockers.push('Package artifact reviewed must be true for ' + (pkg.kind || 'unknown') + '.');
}

const approval = handoff.operatorApproval || {};
if (!['HANDOFF_FREEZE_APPROVED','READY_FOR_HUMAN_PARTNER_CENTER_DECISION'].includes(approval.decision)) blockers.push('operatorApproval.decision must be HANDOFF_FREEZE_APPROVED or READY_FOR_HUMAN_PARTNER_CENTER_DECISION.');
if (approval.approvedForPartnerCenterManualSubmission !== true) blockers.push('operatorApproval.approvedForPartnerCenterManualSubmission must be true for the final handoff freeze.');
if (approval.approvedForPublicAnnouncement === true) blockers.push('operatorApproval.approvedForPublicAnnouncement must not be true from this source-side Store handoff freeze alone.');
if (approval.approvedForGAClaim === true) blockers.push('operatorApproval.approvedForGAClaim must not be true from this source-side Store handoff freeze alone.');
if (placeholder(approval.approvedBy) || placeholder(approval.approvedAt) || placeholder(approval.approvalNotes)) blockers.push('operatorApproval approvedBy/approvedAt/approvalNotes must be filled.');

const go = handoff.goNoGo || {};
if (!['GO_FOR_HUMAN_PARTNER_CENTER_SUBMISSION_DECISION','HANDOFF_FREEZE_APPROVED_NOT_SUBMITTED'].includes(go.status)) blockers.push('goNoGo.status must be GO_FOR_HUMAN_PARTNER_CENTER_SUBMISSION_DECISION or HANDOFF_FREEZE_APPROVED_NOT_SUBMITTED.');
if (go.readyForPartnerCenterManualSubmission !== true) blockers.push('goNoGo.readyForPartnerCenterManualSubmission must be true for final handoff freeze.');
if (go.readyForPublicGA === true) blockers.push('goNoGo.readyForPublicGA must not be true from PASS265 alone.');
if (go.storeSubmissionPerformed === true) blockers.push('goNoGo.storeSubmissionPerformed must not be true in this source-side gate.');
if (go.storeApprovalReceived === true) blockers.push('goNoGo.storeApprovalReceived must not be true in this source-side gate.');
if (go.operatorApprovedFreeze !== true) blockers.push('goNoGo.operatorApprovedFreeze must be true.');

const searchable = { storeTruth: handoff.storeTruth, priorGateResults: handoff.priorGateResults, freezeReview: handoff.freezeReview, finalAttestations: handoff.finalAttestations, releaseCandidateInventory: handoff.releaseCandidateInventory, operatorApproval: handoff.operatorApproval, goNoGo: handoff.goNoGo };
const allStrings = collectStrings(searchable).join('\n').toLowerCase();
for (const claim of prohibitedClaims) if (allStrings.includes(claim)) blockers.push('Prohibited claim appears in handoff packet: ' + claim + '.');
for (const secretPattern of ['psa_api_key','client_secret','refresh_token','authorization:','cookie:','begin private key','bearer ']) {
  if (allStrings.includes(secretPattern)) blockers.push('Secret-like pattern appears in handoff packet: ' + secretPattern + '.');
}

if (blockers.length) fail(blockers, handoffFile);
console.log('PASS265_STORE_HANDOFF_FREEZE_GATE=PASS_READY_FOR_HUMAN_PARTNER_CENTER_DECISION_NOT_SUBMITTED');
console.log('PASS265_HANDOFF_PACKET=' + rel(handoffFile));
console.log('PASS265_VERSION=' + requiredVersion);
console.log('PASS265_REMAINING_PASSES_AFTER_THIS=' + remainingPassesAfterThisPass);
console.log('PASS265_STORE_SUBMISSION_CLAIM=not-submitted');
console.log('PASS265_STORE_APPROVAL_CLAIM=not-approved');
console.log('PASS265_SOURCE_SIDE_STORE_CLOSEOUT=COMPLETE');
