#!/usr/bin/env node
/* Verify PASS264 — Store Submission Dry-Run Evidence Gate */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredVersion = '2.0.18';
const remainingPassesAfterThisPass = 1;
const dryRunTemplatePath = path.join(root, 'docs', 'store', 'pass264-store-submission-dry-run-evidence.template.json');
const checklistTemplatePath = path.join(root, 'docs', 'store', 'pass264-store-submission-dry-run-checklist.template.json');
const requiredGatesPath = path.join(root, 'tests', 'runtime', 'pass264-store-submission-dry-run-required-gates.json');
const docsPath = path.join(root, 'docs', 'store', 'PASS264-store-submission-dry-run-evidence-gate.md');
const gatePath = path.join(root, 'scripts', 'gate-pass264-store-submission-dry-run-evidence.mjs');
const packagePath = path.join(root, 'package.json');
const requiredFiles = [dryRunTemplatePath, checklistTemplatePath, requiredGatesPath, docsPath, gatePath];
const blockers = [];
const requiredPriorPasses = ['PASS260','PASS261','PASS262','PASS263'];
const requiredDryRunBooleans = ['pass260InstalledSmokeGatePassed','pass261PacketGatePassed','pass262AssetEvidenceGatePassed','pass263ListingCopyGatePassed','packageIdentityReviewed','publicUrlsReviewed','screenshotAssetsReviewed','hashesAndProvenanceReviewed','knownIssuesReviewed','noSecretReviewPassed','noFalseStoreClaimReviewPassed','dryRunCompletedWithoutSubmission','operatorReviewedDryRunReport'];
const requiredCrossChecks = ['pass260Pass261Pass262Pass263AllPassed','packageVersionMatchesEvidence','sourceCommitMatchesEvidence','packageHashMatchesEvidence','publicUrlsAreHttpsAndLive','knownIssuesTruthMatchesListing','screenshotSlotCountMatchesAssets','noSecretsFoundInEvidence','noFalseClaimsFoundInEvidence'];
const prohibitedClaims = ['submitted to microsoft store','microsoft store approved','store approved','store certified','available in the microsoft store','signed msi','signed exe','public ga','general availability','direct psa api','psa connector included','stores psa tokens','stores provider secrets'];

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function readText(file) { return fs.readFileSync(file, 'utf8'); }
function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, out);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) collectStrings(item, out);
  return out;
}

for (const file of requiredFiles) if (!fs.existsSync(file)) blockers.push('Missing required file: ' + path.relative(root, file));

if (!blockers.length) {
  const dryRun = readJson(dryRunTemplatePath);
  const checklist = readJson(checklistTemplatePath);
  const gates = readJson(requiredGatesPath);
  for (const obj of [dryRun, checklist, gates]) {
    if (obj.schemaVersion !== 1) blockers.push('PASS264 JSON files must use schemaVersion 1.');
    if (obj.pass !== 'PASS264') blockers.push('PASS264 JSON files must declare pass PASS264.');
    if (obj.versionTarget !== requiredVersion) blockers.push('PASS264 JSON files must target ' + requiredVersion + '.');
    if (obj.remainingPassesAfterThisPass !== remainingPassesAfterThisPass) blockers.push('PASS264 JSON files must report remainingPassesAfterThisPass=' + remainingPassesAfterThisPass + '.');
  }

  const priorPasses = (dryRun.priorGateResults || []).map((row) => row.pass);
  for (const passName of requiredPriorPasses) {
    if (!priorPasses.includes(passName)) blockers.push('Dry-run template missing prior gate row for ' + passName + '.');
    if (!(gates.requiredPriorGates || []).some((row) => row.pass === passName)) blockers.push('Required gates fixture missing ' + passName + '.');
  }

  for (const key of requiredDryRunBooleans) {
    if (!Object.prototype.hasOwnProperty.call(dryRun.dryRunReview || {}, key)) blockers.push('Dry-run template missing dryRunReview boolean: ' + key + '.');
    if (!(gates.requiredDryRunBooleans || []).includes(key)) blockers.push('Required gates fixture missing dry-run boolean: ' + key + '.');
  }
  for (const key of requiredCrossChecks) {
    if (!Object.prototype.hasOwnProperty.call(dryRun.crossChecks || {}, key)) blockers.push('Dry-run template missing crossCheck: ' + key + '.');
    if (!(gates.requiredCrossChecks || []).includes(key)) blockers.push('Required gates fixture missing cross-check: ' + key + '.');
  }

  const truth = dryRun.storeTruth || {};
  if (truth.microsoftStoreSubmissionClaim !== 'not-submitted') blockers.push('Template must preserve not-submitted Store claim.');
  if (truth.microsoftStoreApprovalClaim !== 'not-approved') blockers.push('Template must preserve not-approved Store claim.');
  if (truth.dryRunOnly !== true) blockers.push('Template must mark dryRunOnly=true.');
  if (truth.noPartnerCenterUploadPerformed !== true) blockers.push('Template must mark noPartnerCenterUploadPerformed=true.');
  if ((dryRun.partnerCenterDryRun || {}).submissionButtonClicked !== false) blockers.push('Template must default submissionButtonClicked=false.');
  if ((dryRun.partnerCenterDryRun || {}).submissionId !== 'NONE_NOT_SUBMITTED') blockers.push('Template must keep submissionId NONE_NOT_SUBMITTED.');

  if (!Array.isArray(checklist.sections) || checklist.sections.length < 5) blockers.push('Checklist template must include at least five sections.');
  const allStrings = collectStrings({dryRun, checklist, gates}).join('\n').toLowerCase();
  for (const pattern of ['psa_api_key','client_secret','refresh_token','authorization:','cookie:','begin private key','bearer ']) {
    if (allStrings.includes(pattern)) blockers.push('Forbidden secret-like pattern appears in PASS264 templates: ' + pattern + '.');
  }
}

if (fs.existsSync(packagePath)) {
  const pkg = readJson(packagePath);
  if (!pkg.scripts || pkg.scripts['verify:pass-264-store-submission-dry-run-evidence'] !== 'node scripts/verify-pass264-store-submission-dry-run-evidence-gate.mjs') blockers.push('package.json missing verify:pass-264-store-submission-dry-run-evidence script.');
  if (!pkg.scripts || pkg.scripts['gate:pass-264-store-submission-dry-run-evidence'] !== 'node scripts/gate-pass264-store-submission-dry-run-evidence.mjs') blockers.push('package.json missing gate:pass-264-store-submission-dry-run-evidence script.');
}

const docs = fs.existsSync(docsPath) ? readText(docsPath) : '';
for (const phrase of ['does **not** submit to the Microsoft Store', 'Remaining passes after PASS264', 'No PSA connector code', 'No direct PSA API calls']) {
  if (!docs.includes(phrase)) blockers.push('PASS264 docs missing required phrase: ' + phrase);
}

if (blockers.length) {
  console.error('PASS264_STORE_SUBMISSION_DRY_RUN_EVIDENCE=FAIL');
  for (const blocker of blockers) console.error('- ' + blocker);
  process.exit(1);
}

console.log('PASS264_STORE_SUBMISSION_DRY_RUN_EVIDENCE=PASS');
console.log('PASS264_VERSION=' + requiredVersion);
console.log('PASS264_REMAINING_PASSES_AFTER_THIS=' + remainingPassesAfterThisPass);
console.log('PASS264_STORE_SUBMISSION_STATUS=DRY_RUN_ONLY_NOT_SUBMITTED_NOT_APPROVED');
console.log('PASS264_GATE=gate-pass264-store-submission-dry-run-evidence');
