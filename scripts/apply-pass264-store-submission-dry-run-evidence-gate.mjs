#!/usr/bin/env node
/* PASS264 — Store Submission Dry-Run Evidence Gate + 2.0.13 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pass = 'PASS264';
const targetVersion = '2.0.13';
const remainingPassesAfterThisPass = 1;
const dryRunTemplatePath = path.join(root, 'docs', 'store', 'pass264-store-submission-dry-run-evidence.template.json');
const checklistTemplatePath = path.join(root, 'docs', 'store', 'pass264-store-submission-dry-run-checklist.template.json');
const requiredGatesPath = path.join(root, 'tests', 'runtime', 'pass264-store-submission-dry-run-required-gates.json');
const docsPath = path.join(root, 'docs', 'store', 'PASS264-store-submission-dry-run-evidence-gate.md');
const readmePath = path.join(root, 'PASS264_README.md');

const requiredPriorGates = [
  { pass: 'PASS260', name: 'Installed Recipe + Quad Store Smoke Evidence Gate', command: 'npm run gate:pass-260-installed-recipe-quad-store-smoke', evidencePath: 'release-candidate/store-submission/pass260-installed-recipe-quad-smoke-evidence.json', required: true },
  { pass: 'PASS261', name: 'Store Submission Packet Finalizer', command: 'npm run gate:pass-261-store-submission-packet', evidencePath: 'release-candidate/store-submission/pass261-store-submission-packet.json', required: true },
  { pass: 'PASS262', name: 'Store Asset Evidence Pack', command: 'npm run gate:pass-262-store-asset-evidence-pack', evidencePath: 'release-candidate/store-submission/pass262-store-asset-evidence-pack.json', required: true },
  { pass: 'PASS263', name: 'Store Listing Copy Truth Pack', command: 'npm run gate:pass-263-store-listing-copy-truth-pack', evidencePath: 'release-candidate/store-submission/pass263-store-listing-copy-truth-pack.json', required: true }
];

const prohibitedClaims = [
  'submitted to microsoft store',
  'microsoft store approved',
  'store approved',
  'store certified',
  'available in the microsoft store',
  'signed msi',
  'signed exe',
  'public ga',
  'general availability',
  'direct psa api',
  'psa connector included',
  'stores psa tokens',
  'stores provider secrets'
];

const requiredDryRunBooleans = [
  'pass260InstalledSmokeGatePassed',
  'pass261PacketGatePassed',
  'pass262AssetEvidenceGatePassed',
  'pass263ListingCopyGatePassed',
  'packageIdentityReviewed',
  'publicUrlsReviewed',
  'screenshotAssetsReviewed',
  'hashesAndProvenanceReviewed',
  'knownIssuesReviewed',
  'noSecretReviewPassed',
  'noFalseStoreClaimReviewPassed',
  'dryRunCompletedWithoutSubmission',
  'operatorReviewedDryRunReport'
];

const dryRunTemplate = {
  schemaVersion: 1,
  pass,
  packName: 'TAHAI Web Services Browser Store Submission Dry-Run Evidence Gate',
  status: 'TEMPLATE_PENDING_REAL_DRY_RUN_EVIDENCE',
  versionTarget: targetVersion,
  remainingPassesAfterThisPass,
  generatedAt: 'REPLACE_WITH_ISO_TIMESTAMP',
  preparedBy: 'REPLACE_WITH_OPERATOR_NAME',
  sourceCommit: 'REPLACE_WITH_GIT_COMMIT_SHA',
  packageVersion: targetVersion,
  storeTruth: {
    microsoftStoreSubmissionClaim: 'not-submitted',
    microsoftStoreApprovalClaim: 'not-approved',
    dryRunOnly: true,
    noPartnerCenterUploadPerformed: true,
    noPublicGaClaim: true,
    directMsiExeSigningStatus: 'unsigned-preview'
  },
  priorGateResults: requiredPriorGates.map((gate) => ({
    pass: gate.pass,
    name: gate.name,
    command: gate.command,
    evidencePath: gate.evidencePath,
    evidenceSha256: 'REPLACE_WITH_64_HEX_SHA256_OF_EVIDENCE_FILE',
    gateOutputPath: 'REPLACE_WITH_PATH_TO_CAPTURED_GATE_OUTPUT_OR_LOG',
    gatePassed: false,
    reviewed: false,
    notes: 'PENDING_REAL_GATE_OUTPUT'
  })),
  dryRunReview: Object.fromEntries(requiredDryRunBooleans.map((key) => [key, false])),
  partnerCenterDryRun: {
    reachedPartnerCenterDraftScreen: false,
    packageUploadStarted: false,
    packageUploadCompleted: false,
    submissionButtonClicked: false,
    submissionId: 'NONE_NOT_SUBMITTED',
    reviewerNotesCopied: false,
    screenshotsMapped: false,
    listingCopyMapped: false,
    declarationsMapped: false,
    dryRunScreenshotsPath: 'REPLACE_WITH_LOCAL_OR_RELEASE_CANDIDATE_PATH_IF_CAPTURED',
    dryRunNotes: 'Document what was checked in Partner Center without clicking submit.'
  },
  crossChecks: {
    pass260Pass261Pass262Pass263AllPassed: false,
    packageVersionMatchesEvidence: false,
    sourceCommitMatchesEvidence: false,
    packageHashMatchesEvidence: false,
    publicUrlsAreHttpsAndLive: false,
    knownIssuesTruthMatchesListing: false,
    screenshotSlotCountMatchesAssets: false,
    noSecretsFoundInEvidence: false,
    noFalseClaimsFoundInEvidence: false
  },
  prohibitedClaims,
  goNoGo: {
    status: 'NO_GO',
    reason: 'Dry-run evidence is a template. Store submission remains blocked until all prior gates pass, the dry-run report is filled, no-submit truth is preserved, and operator approval exists.',
    readyForPartnerCenterSubmission: false,
    readyForPublicGA: false,
    readyForFinalHandoffFreeze: false,
    operatorApproved: false
  }
};

const checklistTemplate = {
  schemaVersion: 1,
  pass,
  versionTarget: targetVersion,
  remainingPassesAfterThisPass,
  checklistName: 'PASS264 Partner Center No-Submit Dry-Run Checklist',
  status: 'TEMPLATE_PENDING_REAL_DRY_RUN',
  sections: [
    { section: 'Prior gates', required: true, items: requiredPriorGates.map((gate) => ({ label: gate.command, result: 'PENDING', evidencePath: gate.evidencePath })) },
    { section: 'Package identity', required: true, items: ['App name', 'Publisher display name', 'Package family name', 'Version', 'Architecture', 'Capabilities', 'Protocol declarations', 'Unsigned preview truth'].map((label) => ({ label, result: 'PENDING' })) },
    { section: 'Listing assets', required: true, items: ['Square logo', 'App icon', 'Screenshot set', 'Hero/promotional image if used', 'Screenshot source/version/hash metadata'].map((label) => ({ label, result: 'PENDING' })) },
    { section: 'Listing copy', required: true, items: ['Short description', 'Long description', 'Feature bullets', 'What is new', 'Support URL', 'Privacy URL', 'Known issues URL', 'Reviewer notes'].map((label) => ({ label, result: 'PENDING' })) },
    { section: 'No-submit guard', required: true, items: ['Do not click final submit', 'Do not claim Store submitted', 'Do not claim Store approved', 'Do not claim signed MSI/EXE', 'Capture dry-run notes only'].map((label) => ({ label, result: 'PENDING' })) }
  ]
};

const requiredGates = {
  schemaVersion: 1,
  pass,
  versionTarget: targetVersion,
  remainingPassesAfterThisPass,
  requiredPriorGates,
  requiredDryRunBooleans,
  requiredCrossChecks: [
    'pass260Pass261Pass262Pass263AllPassed',
    'packageVersionMatchesEvidence',
    'sourceCommitMatchesEvidence',
    'packageHashMatchesEvidence',
    'publicUrlsAreHttpsAndLive',
    'knownIssuesTruthMatchesListing',
    'screenshotSlotCountMatchesAssets',
    'noSecretsFoundInEvidence',
    'noFalseClaimsFoundInEvidence'
  ],
  prohibitedClaims,
  finalGateCandidatePath: 'release-candidate/store-submission/pass264-store-submission-dry-run-evidence.json',
  nextPass: 'PASS265 — Store Handoff Freeze + Operator Approval Packet'
};

const docs = `# PASS264 — Store Submission Dry-Run Evidence Gate

Target version: \`${targetVersion}\`

Remaining passes after PASS264: **${remainingPassesAfterThisPass}**.

PASS264 adds the no-submit dry-run gate that cross-checks PASS260 installed smoke evidence, PASS261 submission packet truth, PASS262 asset evidence, and PASS263 listing copy truth before the final handoff/freeze pass.

## What this pass adds

- Store submission dry-run evidence template.
- Partner Center no-submit dry-run checklist template.
- Required prior-gate matrix fixture.
- Source verifier: \`npm run verify:pass-264-store-submission-dry-run-evidence\`.
- Final dry-run gate: \`npm run gate:pass-264-store-submission-dry-run-evidence\`.

## Store posture

This pass does **not** submit to the Microsoft Store. It does **not** claim Microsoft Store approval, Store certification, public GA, signed MSI/EXE status, IT Docs backend support, PSA connector support, direct PSA API support, or secret storage.

PASS264 is explicitly a no-submit dry run. The gate should remain blocked unless the report proves every prior Store/evidence gate passed and the Partner Center review was completed without clicking final submit.

## Required final evidence path

\`release-candidate/store-submission/pass264-store-submission-dry-run-evidence.json\`

## Commands

\`\`\`powershell
Set-Location C:\dev\browser\app
node scripts\apply-pass264-store-submission-dry-run-evidence-gate.mjs
npm run verify:pass-264-store-submission-dry-run-evidence
\`\`\`

Optional hard gate when real dry-run evidence exists:

\`\`\`powershell
npm run gate:pass-264-store-submission-dry-run-evidence
\`\`\`

## Hard boundaries

- Browser-side/store-evidence structure only.
- No IT Docs backend code.
- No PSA connector code.
- No direct PSA API calls.
- No PSA/API/provider secrets.
- No Microsoft Store submission, approval, signed-release, or GA claim without evidence.
`;

const readme = `# PASS264 — Store Submission Dry-Run Evidence Gate

Target version: \`${targetVersion}\`

Remaining passes after PASS264: **${remainingPassesAfterThisPass}**.

PASS264 adds the final no-submit dry-run gate across PASS260, PASS261, PASS262, and PASS263. It is evidence-only and keeps Store submission blocked.

## Apply

\`\`\`powershell
Set-Location C:\dev\browser\app
node scripts\apply-pass264-store-submission-dry-run-evidence-gate.mjs
npm run verify:pass-264-store-submission-dry-run-evidence
\`\`\`

## Gate when real dry-run evidence exists

\`\`\`powershell
npm run gate:pass-264-store-submission-dry-run-evidence
\`\`\`

The gate should remain blocked until PASS260-PASS263 gates pass, real evidence hashes exist, public URL/listing/asset/package truth is reviewed, and the dry run is completed without Store submission.
`;

function readText(file) { return fs.readFileSync(file, 'utf8'); }
function writeText(file, text) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }
function rel(file) { return path.relative(root, file).replace(/\\/g, '/'); }
function parseVersion(v) { const m = String(v || '0.0.0').match(/^(\d+)\.(\d+)\.(\d+)/); return m ? { major:+m[1], minor:+m[2], patch:+m[3] } : { major:0, minor:0, patch:0 }; }
function versionAtLeast(v, expected) { const a = parseVersion(v), e = parseVersion(expected); if (a.major !== e.major) return a.major > e.major; if (a.minor !== e.minor) return a.minor > e.minor; return a.patch >= e.patch; }

function ensurePackage() {
  const file = path.join(root, 'package.json');
  if (!fs.existsSync(file)) return { packageJsonFound: false, changes: [] };
  const pkg = JSON.parse(readText(file));
  const before = pkg.version;
  if (!versionAtLeast(pkg.version, targetVersion)) pkg.version = targetVersion;
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['verify:pass-264-store-submission-dry-run-evidence'] = 'node scripts/verify-pass264-store-submission-dry-run-evidence-gate.mjs';
  pkg.scripts['gate:pass-264-store-submission-dry-run-evidence'] = 'node scripts/gate-pass264-store-submission-dry-run-evidence.mjs';
  writeText(file, JSON.stringify(pkg, null, 2) + '\n');
  return { packageJsonFound: true, version: pkg.version, changes: [{ file: 'package.json', changed: before !== pkg.version, before, after: pkg.version }] };
}

const packageResult = ensurePackage();
writeText(dryRunTemplatePath, JSON.stringify(dryRunTemplate, null, 2) + '\n');
writeText(checklistTemplatePath, JSON.stringify(checklistTemplate, null, 2) + '\n');
writeText(requiredGatesPath, JSON.stringify(requiredGates, null, 2) + '\n');
writeText(docsPath, docs);
writeText(readmePath, readme);

const reportDir = path.join(root, 'release-candidate', 'generated');
fs.mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, 'pass264-store-submission-dry-run-evidence-gate-apply-report.json');
const report = {
  pass,
  appliedAt: new Date().toISOString(),
  packageResult,
  dryRunTemplate: rel(dryRunTemplatePath),
  checklistTemplate: rel(checklistTemplatePath),
  requiredGates: rel(requiredGatesPath),
  docs: rel(docsPath),
  remainingPassesAfterThisPass,
  storeSubmissionStatus: 'DRY_RUN_ONLY_NOT_SUBMITTED_NOT_APPROVED'
};
writeText(reportPath, JSON.stringify(report, null, 2) + '\n');

console.log(pass + '_APPLY=PASS');
console.log(pass + '_VERSION=' + (packageResult.version || targetVersion));
console.log(pass + '_DRY_RUN_TEMPLATE=' + rel(dryRunTemplatePath));
console.log(pass + '_CHECKLIST_TEMPLATE=' + rel(checklistTemplatePath));
console.log(pass + '_REQUIRED_GATES=' + rel(requiredGatesPath));
console.log(pass + '_REPORT=' + rel(reportPath));
console.log(pass + '_REMAINING_PASSES_AFTER_THIS=' + remainingPassesAfterThisPass);
console.log(pass + '_STORE_SUBMISSION_STATUS=DRY_RUN_ONLY_NOT_SUBMITTED_NOT_APPROVED');
