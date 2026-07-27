#!/usr/bin/env node
/* PASS265 — Store Handoff Freeze + Operator Approval Packet + 2.0.18 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pass = 'PASS265';
const targetVersion = '2.0.18';
const remainingPassesAfterThisPass = 0;
const handoffTemplatePath = path.join(root, 'docs', 'store', 'pass265-store-handoff-freeze-operator-approval.template.json');
const closeoutManifestTemplatePath = path.join(root, 'docs', 'store', 'pass265-store-closeout-manifest.template.json');
const approvalChecklistTemplatePath = path.join(root, 'docs', 'store', 'pass265-operator-approval-checklist.template.json');
const requiredGatesPath = path.join(root, 'tests', 'runtime', 'pass265-store-handoff-freeze-required-gates.json');
const docsPath = path.join(root, 'docs', 'store', 'PASS265-store-handoff-freeze-operator-approval-packet.md');
const readmePath = path.join(root, 'PASS265_README.md');

const requiredPriorGates = [
  { pass: 'PASS260', name: 'Installed Recipe + Quad Store Smoke Evidence Gate', command: 'npm run gate:pass-260-installed-recipe-quad-store-smoke', evidencePath: 'release-candidate/store-submission/pass260-installed-recipe-quad-smoke-evidence.json', required: true },
  { pass: 'PASS261', name: 'Store Submission Packet Finalizer', command: 'npm run gate:pass-261-store-submission-packet', evidencePath: 'release-candidate/store-submission/pass261-store-submission-packet.json', required: true },
  { pass: 'PASS262', name: 'Store Asset Evidence Pack', command: 'npm run gate:pass-262-store-asset-evidence-pack', evidencePath: 'release-candidate/store-submission/pass262-store-asset-evidence-pack.json', required: true },
  { pass: 'PASS263', name: 'Store Listing Copy Truth Pack', command: 'npm run gate:pass-263-store-listing-copy-truth-pack', evidencePath: 'release-candidate/store-submission/pass263-store-listing-copy-truth-pack.json', required: true },
  { pass: 'PASS264', name: 'Store Submission Dry-Run Evidence Gate', command: 'npm run gate:pass-264-store-submission-dry-run-evidence', evidencePath: 'release-candidate/store-submission/pass264-store-submission-dry-run-evidence.json', required: true }
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

const requiredFreezeBooleans = [
  'pass260InstalledSmokeGatePassed',
  'pass261SubmissionPacketGatePassed',
  'pass262AssetEvidenceGatePassed',
  'pass263ListingCopyGatePassed',
  'pass264DryRunGatePassed',
  'allEvidenceHashesRecorded',
  'sourceCommitRecorded',
  'packageVersionRecorded',
  'publicUrlsRecordedAndReviewed',
  'screenshotsRecordedAndReviewed',
  'knownIssuesRecordedAndReviewed',
  'privacySupportSecurityUrlsReviewed',
  'noSecretReviewPassed',
  'noFalseStoreClaimReviewPassed',
  'operatorReadKnownIssues',
  'operatorReviewedSubmissionRisks',
  'operatorApprovedFreeze'
];

const requiredFinalAttestations = [
  'notSubmittedToMicrosoftStore',
  'notApprovedByMicrosoftStore',
  'noSignedMsiExeClaimUnlessSeparatelyEvidenced',
  'noPublicGaClaimUnlessSeparatelyEvidenced',
  'noITDocsBackendOrPSAConnectorClaim',
  'noDirectPSAApiOrSecretStorageClaim',
  'handoffPacketReadyForHumanDecision'
];

const handoffTemplate = {
  schemaVersion: 1,
  pass,
  packName: 'TAHAI Web Services Browser Store Handoff Freeze + Operator Approval Packet',
  status: 'TEMPLATE_PENDING_REAL_OPERATOR_APPROVAL',
  versionTarget: targetVersion,
  remainingPassesAfterThisPass,
  generatedAt: 'REPLACE_WITH_ISO_TIMESTAMP',
  preparedBy: 'REPLACE_WITH_OPERATOR_NAME',
  sourceCommit: 'REPLACE_WITH_GIT_COMMIT_SHA',
  packageVersion: targetVersion,
  storeTruth: {
    microsoftStoreSubmissionClaim: 'not-submitted',
    microsoftStoreApprovalClaim: 'not-approved',
    handoffFreezeOnly: true,
    noPartnerCenterSubmitPerformedByThisPass: true,
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
  freezeReview: Object.fromEntries(requiredFreezeBooleans.map((key) => [key, false])),
  finalAttestations: Object.fromEntries(requiredFinalAttestations.map((key) => [key, false])),
  releaseCandidateInventory: {
    packageFiles: [
      { kind: 'msix', path: 'REPLACE_WITH_MSIX_OR_MSIXUPLOAD_PATH_IF_AVAILABLE', sha256: 'REPLACE_WITH_64_HEX_SHA256_OR_NOT_APPLICABLE', reviewed: false },
      { kind: 'msi', path: 'REPLACE_WITH_MSI_PATH_IF_AVAILABLE', sha256: 'REPLACE_WITH_64_HEX_SHA256_OR_NOT_APPLICABLE', reviewed: false }
    ],
    sourceZip: { path: 'REPLACE_WITH_SOURCE_ZIP_PATH_IF_CREATED', sha256: 'REPLACE_WITH_64_HEX_SHA256_OR_NOT_APPLICABLE', reviewed: false },
    screenshotsFolder: 'REPLACE_WITH_SCREENSHOTS_FOLDER_PATH',
    partnerCenterDraftNotesPath: 'REPLACE_WITH_DRAFT_NOTES_OR_SCREENSHOTS_PATH',
    knownIssuesPath: 'REPLACE_WITH_KNOWN_ISSUES_PATH',
    publicUrlsReviewPath: 'REPLACE_WITH_PUBLIC_URL_REVIEW_PATH'
  },
  operatorApproval: {
    decision: 'NO_GO',
    approvedForPartnerCenterManualSubmission: false,
    approvedForPublicAnnouncement: false,
    approvedForGAClaim: false,
    approvedBy: 'REPLACE_WITH_OPERATOR_NAME',
    approvedAt: 'REPLACE_WITH_ISO_TIMESTAMP',
    approvalNotes: 'PENDING_REAL_OPERATOR_DECISION'
  },
  prohibitedClaims,
  goNoGo: {
    status: 'NO_GO',
    reason: 'Template only. PASS265 freezes the handoff structure but cannot approve Store submission until all real prior gates and operator approval are recorded.',
    readyForPartnerCenterManualSubmission: false,
    readyForPublicGA: false,
    storeSubmissionPerformed: false,
    storeApprovalReceived: false,
    operatorApprovedFreeze: false
  }
};

const closeoutManifestTemplate = {
  schemaVersion: 1,
  pass,
  versionTarget: targetVersion,
  remainingPassesAfterThisPass,
  manifestName: 'PASS265 Store Closeout Manifest',
  status: 'TEMPLATE_PENDING_REAL_CLOSEOUT',
  requiredEvidence: requiredPriorGates.map((gate) => ({ pass: gate.pass, name: gate.name, command: gate.command, evidencePath: gate.evidencePath, required: gate.required, sha256: 'REPLACE_WITH_64_HEX_SHA256', gateOutputPath: 'REPLACE_WITH_GATE_OUTPUT_PATH', reviewed: false })),
  requiredFinalPacket: 'release-candidate/store-submission/pass265-store-handoff-freeze-operator-approval.json',
  finalGateCommand: 'npm run gate:pass-265-store-handoff-freeze-operator-approval',
  storeSubmissionStatus: 'not-submitted',
  storeApprovalStatus: 'not-approved',
  closeoutNotes: 'Fill this manifest only after real evidence exists. This source pass does not submit to Partner Center.'
};

const approvalChecklistTemplate = {
  schemaVersion: 1,
  pass,
  versionTarget: targetVersion,
  remainingPassesAfterThisPass,
  checklistName: 'PASS265 Operator Approval Checklist',
  status: 'TEMPLATE_PENDING_OPERATOR_REVIEW',
  sections: [
    { section: 'Evidence gates', required: true, items: requiredPriorGates.map((gate) => ({ label: gate.command, result: 'PENDING', evidencePath: gate.evidencePath })) },
    { section: 'Truth posture', required: true, items: ['Microsoft Store not submitted', 'Microsoft Store not approved', 'No public GA claim', 'No signed MSI/EXE claim unless separately evidenced', 'No IT Docs backend/PSA connector claim', 'No direct PSA API/secret storage claim'].map((label) => ({ label, result: 'PENDING' })) },
    { section: 'Operator decision', required: true, items: ['Known issues reviewed', 'Public URLs reviewed', 'Screenshots reviewed', 'Package hashes reviewed', 'Privacy/support/security URLs reviewed', 'Partner Center manual submission decision recorded'].map((label) => ({ label, result: 'PENDING' })) }
  ]
};

const requiredGates = {
  schemaVersion: 1,
  pass,
  versionTarget: targetVersion,
  remainingPassesAfterThisPass,
  requiredPriorGates,
  requiredFreezeBooleans,
  requiredFinalAttestations,
  prohibitedClaims,
  finalGateCandidatePath: 'release-candidate/store-submission/pass265-store-handoff-freeze-operator-approval.json',
  nextPass: 'NONE — Store closeout lane complete. Manual Partner Center submission remains a human/operator action outside this source pass.'
};

const docs = `# PASS265 — Store Handoff Freeze + Operator Approval Packet

Target version: \`${targetVersion}\`

Remaining passes after PASS265: **${remainingPassesAfterThisPass}**.

PASS265 is the final source-side Store closeout pass in this lane. It creates the handoff/freeze packet that collects PASS260-PASS264 gate outputs into one operator approval record.

## What this pass adds

- Store handoff/freeze operator approval template.
- Store closeout manifest template.
- Operator approval checklist template.
- Required gate/attestation fixture.
- Source verifier: \`npm run verify:pass-265-store-handoff-freeze-operator-approval\`.
- Final freeze gate: \`npm run gate:pass-265-store-handoff-freeze-operator-approval\`.

## Store posture

This pass does **not** submit to the Microsoft Store. It does **not** claim Microsoft Store approval, Store certification, public GA, signed MSI/EXE status, IT Docs backend support, PSA connector support, direct PSA API support, or secret storage.

PASS265 only freezes the human handoff packet. If the operator later submits in Partner Center, that action must be recorded separately with real Partner Center evidence before any public submitted/approved claim is made.

## Required final evidence path

\`release-candidate/store-submission/pass265-store-handoff-freeze-operator-approval.json\`

## Commands

\`\`\`powershell
Set-Location C:\\dev\\browser\\app
node scripts\\apply-pass265-store-handoff-freeze-operator-approval.mjs
npm run verify:pass-265-store-handoff-freeze-operator-approval
\`\`\`

Optional final freeze gate when real evidence exists:

\`\`\`powershell
npm run gate:pass-265-store-handoff-freeze-operator-approval
\`\`\`

## Final closeout rule

A passing PASS265 gate means the source-side Store submission handoff packet is frozen and ready for a human/operator decision. It does **not** mean the app was submitted, approved, signed, or generally available.

## Hard boundaries

- Browser-side/store-evidence structure only.
- No IT Docs backend code.
- No PSA connector code.
- No direct PSA API calls.
- No PSA/API/provider secrets.
- No Microsoft Store submission, approval, signed-release, or GA claim without separate real evidence.
`;

const readme = `# PASS265 — Store Handoff Freeze + Operator Approval Packet

Target version: \`${targetVersion}\`

Remaining passes after PASS265: **${remainingPassesAfterThisPass}**.

PASS265 is the final source-side Store closeout pass. It freezes the handoff packet and creates a fail-closed operator approval gate across PASS260-PASS264.

## Apply

\`\`\`powershell
Set-Location C:\\dev\\browser\\app
node scripts\\apply-pass265-store-handoff-freeze-operator-approval.mjs
npm run verify:pass-265-store-handoff-freeze-operator-approval
\`\`\`

## Gate when real final evidence exists

\`\`\`powershell
npm run gate:pass-265-store-handoff-freeze-operator-approval
\`\`\`

The gate should remain blocked until PASS260-PASS264 gates pass, real evidence hashes exist, final operator approval is recorded, and not-submitted/not-approved truth is preserved.
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
  pkg.scripts['verify:pass-265-store-handoff-freeze-operator-approval'] = 'node scripts/verify-pass265-store-handoff-freeze-operator-approval.mjs';
  pkg.scripts['gate:pass-265-store-handoff-freeze-operator-approval'] = 'node scripts/gate-pass265-store-handoff-freeze-operator-approval.mjs';
  writeText(file, JSON.stringify(pkg, null, 2) + '\n');
  return { packageJsonFound: true, version: pkg.version, changes: [{ file: 'package.json', changed: before !== pkg.version, before, after: pkg.version }] };
}

const packageResult = ensurePackage();
writeText(handoffTemplatePath, JSON.stringify(handoffTemplate, null, 2) + '\n');
writeText(closeoutManifestTemplatePath, JSON.stringify(closeoutManifestTemplate, null, 2) + '\n');
writeText(approvalChecklistTemplatePath, JSON.stringify(approvalChecklistTemplate, null, 2) + '\n');
writeText(requiredGatesPath, JSON.stringify(requiredGates, null, 2) + '\n');
writeText(docsPath, docs);
writeText(readmePath, readme);

const reportDir = path.join(root, 'release-candidate', 'generated');
fs.mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, 'pass265-store-handoff-freeze-operator-approval-apply-report.json');
const report = {
  pass,
  appliedAt: new Date().toISOString(),
  packageResult,
  handoffTemplate: rel(handoffTemplatePath),
  closeoutManifestTemplate: rel(closeoutManifestTemplatePath),
  approvalChecklistTemplate: rel(approvalChecklistTemplatePath),
  requiredGates: rel(requiredGatesPath),
  docs: rel(docsPath),
  remainingPassesAfterThisPass,
  closeoutLaneStatus: 'SOURCE_SIDE_STORE_CLOSEOUT_COMPLETE_AFTER_PASS265',
  storeSubmissionStatus: 'NOT_SUBMITTED_NOT_APPROVED'
};
writeText(reportPath, JSON.stringify(report, null, 2) + '\n');

console.log(pass + '_APPLY=PASS');
console.log(pass + '_VERSION=' + (packageResult.version || targetVersion));
console.log(pass + '_HANDOFF_TEMPLATE=' + rel(handoffTemplatePath));
console.log(pass + '_CLOSEOUT_MANIFEST_TEMPLATE=' + rel(closeoutManifestTemplatePath));
console.log(pass + '_APPROVAL_CHECKLIST_TEMPLATE=' + rel(approvalChecklistTemplatePath));
console.log(pass + '_REQUIRED_GATES=' + rel(requiredGatesPath));
console.log(pass + '_REPORT=' + rel(reportPath));
console.log(pass + '_REMAINING_PASSES_AFTER_THIS=' + remainingPassesAfterThisPass);
console.log(pass + '_STORE_SUBMISSION_STATUS=NOT_SUBMITTED_NOT_APPROVED');
