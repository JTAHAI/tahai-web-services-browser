#!/usr/bin/env node
/* Gate PASS264 final Store submission dry-run evidence. Fails closed until real no-submit dry-run proof exists. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const requiredVersion = '2.0.14';
const remainingPassesAfterThisPass = 1;
const dryRunCandidates = [
  path.join(root, 'release-candidate', 'store-submission', 'pass264-store-submission-dry-run-evidence.json'),
  path.join(root, 'release-candidate', 'store-submission', 'PASS264-store-submission-dry-run-evidence.json')
];
const priorEvidence = {
  PASS260: path.join(root, 'release-candidate', 'store-submission', 'pass260-installed-recipe-quad-smoke-evidence.json'),
  PASS261: path.join(root, 'release-candidate', 'store-submission', 'pass261-store-submission-packet.json'),
  PASS262: path.join(root, 'release-candidate', 'store-submission', 'pass262-store-asset-evidence-pack.json'),
  PASS263: path.join(root, 'release-candidate', 'store-submission', 'pass263-store-listing-copy-truth-pack.json')
};
const requiredPriorPasses = Object.keys(priorEvidence);
const requiredDryRunBooleans = ['pass260InstalledSmokeGatePassed','pass261PacketGatePassed','pass262AssetEvidenceGatePassed','pass263ListingCopyGatePassed','packageIdentityReviewed','publicUrlsReviewed','screenshotAssetsReviewed','hashesAndProvenanceReviewed','knownIssuesReviewed','noSecretReviewPassed','noFalseStoreClaimReviewPassed','dryRunCompletedWithoutSubmission','operatorReviewedDryRunReport'];
const requiredCrossChecks = ['pass260Pass261Pass262Pass263AllPassed','packageVersionMatchesEvidence','sourceCommitMatchesEvidence','packageHashMatchesEvidence','publicUrlsAreHttpsAndLive','knownIssuesTruthMatchesListing','screenshotSlotCountMatchesAssets','noSecretsFoundInEvidence','noFalseClaimsFoundInEvidence'];
const prohibitedClaims = ['submitted to microsoft store','microsoft store approved','store approved','store certified','available in the microsoft store','signed msi','signed exe','public ga','general availability','direct psa api','psa connector included','stores psa tokens','stores provider secrets'];

function rel(file) { return path.relative(root, file).replace(/\\/g, '/'); }
function find(candidates) { for (const candidate of candidates) if (fs.existsSync(candidate)) return candidate; return null; }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function shaFile(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function sha64(value) { return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value); }
function placeholder(value) { return typeof value !== 'string' || !value.trim() || /REPLACE_WITH|PLACEHOLDER|PENDING|TODO|TBD/i.test(value); }
function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, out);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) collectStrings(item, out);
  return out;
}
function fail(blockers, dryRunFile = null) {
  console.error('PASS264_STORE_SUBMISSION_DRY_RUN_GATE=BLOCKED');
  if (dryRunFile) console.error('PASS264_DRY_RUN_EVIDENCE=' + rel(dryRunFile));
  for (const blocker of blockers) console.error('- ' + blocker);
  process.exit(1);
}

const dryRunFile = find(dryRunCandidates);
if (!dryRunFile) {
  fail([
    'Missing filled PASS264 Store submission dry-run evidence file.',
    'Create release-candidate/store-submission/pass264-store-submission-dry-run-evidence.json from docs/store/pass264-store-submission-dry-run-evidence.template.json.',
    'This gate intentionally cannot pass from source templates alone.'
  ]);
}

let dryRun;
try { dryRun = readJson(dryRunFile); } catch (error) { fail(['PASS264 dry-run evidence JSON could not be parsed: ' + error.message], dryRunFile); }
const blockers = [];

if (dryRun.schemaVersion !== 1) blockers.push('schemaVersion must be 1.');
if (dryRun.pass !== 'PASS264') blockers.push('pass must be PASS264.');
if (dryRun.versionTarget !== requiredVersion) blockers.push('versionTarget must be ' + requiredVersion + '.');
if (dryRun.remainingPassesAfterThisPass !== remainingPassesAfterThisPass) blockers.push('remainingPassesAfterThisPass must be ' + remainingPassesAfterThisPass + '.');
if (!['READY_FOR_FINAL_HANDOFF_FREEZE','DRY_RUN_PASSED_NOT_SUBMITTED'].includes(dryRun.status)) blockers.push('status must be READY_FOR_FINAL_HANDOFF_FREEZE or DRY_RUN_PASSED_NOT_SUBMITTED.');
for (const field of ['generatedAt','preparedBy','sourceCommit','packageVersion']) if (placeholder(dryRun[field])) blockers.push(field + ' is missing or placeholder.');
if (dryRun.packageVersion !== requiredVersion) blockers.push('packageVersion must be ' + requiredVersion + '.');

const truth = dryRun.storeTruth || {};
if (truth.microsoftStoreSubmissionClaim !== 'not-submitted') blockers.push('storeTruth.microsoftStoreSubmissionClaim must remain not-submitted.');
if (truth.microsoftStoreApprovalClaim !== 'not-approved') blockers.push('storeTruth.microsoftStoreApprovalClaim must remain not-approved.');
if (truth.dryRunOnly !== true) blockers.push('storeTruth.dryRunOnly must be true.');
if (truth.noPartnerCenterUploadPerformed !== true) blockers.push('storeTruth.noPartnerCenterUploadPerformed must be true.');
if (truth.noPublicGaClaim !== true) blockers.push('storeTruth.noPublicGaClaim must be true.');
if (!['unsigned-preview','separately-evidenced'].includes(truth.directMsiExeSigningStatus)) blockers.push('storeTruth.directMsiExeSigningStatus must be unsigned-preview or separately-evidenced.');

const priorRows = Array.isArray(dryRun.priorGateResults) ? dryRun.priorGateResults : [];
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

const review = dryRun.dryRunReview || {};
for (const key of requiredDryRunBooleans) if (review[key] !== true) blockers.push('dryRunReview.' + key + ' must be true.');
const cross = dryRun.crossChecks || {};
for (const key of requiredCrossChecks) if (cross[key] !== true) blockers.push('crossChecks.' + key + ' must be true.');

const pc = dryRun.partnerCenterDryRun || {};
if (pc.submissionButtonClicked !== false) blockers.push('partnerCenterDryRun.submissionButtonClicked must be false.');
if (pc.packageUploadStarted === true || pc.packageUploadCompleted === true) blockers.push('partnerCenterDryRun must not indicate package upload started/completed in this no-submit gate.');
if (pc.submissionId !== 'NONE_NOT_SUBMITTED') blockers.push('partnerCenterDryRun.submissionId must be NONE_NOT_SUBMITTED.');
for (const field of ['reachedPartnerCenterDraftScreen','reviewerNotesCopied','screenshotsMapped','listingCopyMapped','declarationsMapped']) {
  if (pc[field] !== true) blockers.push('partnerCenterDryRun.' + field + ' must be true for the no-submit dry run.');
}
if (placeholder(pc.dryRunNotes)) blockers.push('partnerCenterDryRun.dryRunNotes must describe the dry run.');

const searchableDryRun = { storeTruth: dryRun.storeTruth, priorGateResults: dryRun.priorGateResults, dryRunReview: dryRun.dryRunReview, partnerCenterDryRun: dryRun.partnerCenterDryRun, crossChecks: dryRun.crossChecks, goNoGo: dryRun.goNoGo };
const allStrings = collectStrings(searchableDryRun).join('\n').toLowerCase();
for (const claim of prohibitedClaims) if (allStrings.includes(claim)) blockers.push('Prohibited claim appears in dry-run evidence: ' + claim + '.');
for (const secretPattern of ['psa_api_key','client_secret','refresh_token','authorization:','cookie:','begin private key','bearer ']) {
  if (allStrings.includes(secretPattern)) blockers.push('Secret-like pattern appears in dry-run evidence: ' + secretPattern + '.');
}

const go = dryRun.goNoGo || {};
if (!['READY_FOR_FINAL_HANDOFF_FREEZE','GO_FOR_FINAL_HANDOFF_FREEZE'].includes(go.status)) blockers.push('goNoGo.status must be READY_FOR_FINAL_HANDOFF_FREEZE or GO_FOR_FINAL_HANDOFF_FREEZE.');
if (go.readyForFinalHandoffFreeze !== true) blockers.push('goNoGo.readyForFinalHandoffFreeze must be true.');
if (go.readyForPartnerCenterSubmission === true) blockers.push('goNoGo.readyForPartnerCenterSubmission must not be true from PASS264 alone.');
if (go.readyForPublicGA === true) blockers.push('goNoGo.readyForPublicGA must not be true from PASS264 alone.');
if (go.operatorApproved !== true) blockers.push('goNoGo.operatorApproved must be true for the dry-run report.');

if (blockers.length) fail(blockers, dryRunFile);
console.log('PASS264_STORE_SUBMISSION_DRY_RUN_GATE=PASS_READY_FOR_FINAL_HANDOFF_FREEZE_NOT_SUBMITTED');
console.log('PASS264_DRY_RUN_EVIDENCE=' + rel(dryRunFile));
console.log('PASS264_VERSION=' + requiredVersion);
console.log('PASS264_REMAINING_PASSES_AFTER_THIS=' + remainingPassesAfterThisPass);
console.log('PASS264_STORE_SUBMISSION_CLAIM=not-submitted');
console.log('PASS264_STORE_APPROVAL_CLAIM=not-approved');
