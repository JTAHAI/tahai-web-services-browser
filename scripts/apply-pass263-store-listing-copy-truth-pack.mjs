#!/usr/bin/env node
/* PASS263 — Store Listing Copy Truth Pack + 2.0.12 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pass = 'PASS263';
const targetVersion = '2.0.12';
const remainingPassesAfterThisPass = 2;
const listingCopyTemplatePath = path.join(root, 'docs', 'store', 'pass263-store-listing-copy.template.json');
const partnerCenterFieldMapPath = path.join(root, 'docs', 'store', 'pass263-partner-center-field-map.template.json');
const copyClaimReviewPath = path.join(root, 'docs', 'store', 'pass263-copy-claim-review.template.json');
const claimRulesPath = path.join(root, 'tests', 'runtime', 'pass263-store-listing-claim-rules.json');
const docsPath = path.join(root, 'docs', 'store', 'PASS263-store-listing-copy-truth-pack.md');
const readmePath = path.join(root, 'PASS263_README.md');

const requiredCopyFields = [
  'appName',
  'shortDescription',
  'longDescription',
  'featureBullets',
  'whatsNew',
  'supportContact',
  'privacyPolicyUrl',
  'supportUrl',
  'securityPolicyUrl',
  'sourceRepoUrl',
  'knownIssuesUrl',
  'copyrightTrademarkNotice',
  'storeReviewerNotes'
];

const prohibitedClaims = [
  'microsoft store approved',
  'store approved',
  'store certified',
  'submitted to microsoft store',
  'available in the microsoft store',
  'signed msi',
  'signed exe',
  'public ga',
  'general availability',
  'direct psa integration',
  'direct psa api',
  'psa connector included',
  'stores psa tokens',
  'stores provider secrets',
  'credential vault',
  'automatic ticket writeback'
];

const requiredTruthStatements = [
  'Microsoft Store submission remains not-submitted until operator approval and Partner Center upload are complete.',
  'Microsoft Store approval remains not-approved until Microsoft approves the package.',
  'Direct MSI/EXE distribution remains unsigned-preview unless separate trusted signing evidence exists.',
  'IT Docs and PSA references are browser-side contracts only in this repo.',
  'The browser does not store PSA/API/provider secrets in mission files.'
];

const listingCopyTemplate = {
  schemaVersion: 1,
  pass,
  packName: 'TAHAI Web Services Browser Store Listing Copy Truth Pack',
  status: 'TEMPLATE_PENDING_FINAL_COPY_AND_REVIEW',
  versionTarget: targetVersion,
  remainingPassesAfterThisPass,
  generatedAt: 'REPLACE_WITH_ISO_TIMESTAMP',
  preparedBy: 'REPLACE_WITH_OPERATOR_NAME',
  sourceCommit: 'REPLACE_WITH_GIT_COMMIT_SHA',
  storeTruth: {
    microsoftStoreSubmissionClaim: 'not-submitted',
    microsoftStoreApprovalClaim: 'not-approved',
    directMsiExeSigningStatus: 'unsigned-preview',
    publicGaClaim: false,
    listingCopyDoesNotSubmitToStore: true
  },
  appIdentity: {
    appName: 'TAHAI Web Services Browser',
    publisherDisplayName: 'TAHAI Web Services',
    packageVersion: targetVersion,
    packageFamilyName: 'REPLACE_WITH_PARTNER_CENTER_PACKAGE_FAMILY_NAME',
    packageSha256: 'REPLACE_WITH_64_HEX_SHA256',
    sourceCommit: 'REPLACE_WITH_GIT_COMMIT_SHA'
  },
  listingCopy: {
    appName: 'TAHAI Web Services Browser',
    shortDescription: 'REPLACE_WITH_STORE_SHORT_DESCRIPTION_UNDER_PARTNER_CENTER_LIMIT',
    longDescription: 'REPLACE_WITH_STORE_LONG_DESCRIPTION',
    featureBullets: [
      'Mission Control workspaces for IT and DevOps operators.',
      'Split, Tri-view, Quad, and Focus Pane layouts for operational work.',
      'Runbook Rail, Evidence Pack, and Operator Command Center workflows.',
      'Local-first evidence preparation with redaction-aware export posture.',
      'Browser-side IT Docs and PSA reference contracts only; no PSA secrets stored.'
    ],
    searchTerms: ['DevOps browser', 'IT admin browser', 'Mission Control', 'runbook', 'evidence'],
    whatsNew: 'REPLACE_WITH_VERSION_SPECIFIC_RELEASE_NOTES_FOR_2_0_12',
    storeReviewerNotes: 'REPLACE_WITH_REVIEWER_NOTES_AND_STORE_BLOCKER_TRUTH',
    supportContact: 'REPLACE_WITH_SUPPORT_CONTACT_OR_PUBLIC_SUPPORT_URL',
    copyrightTrademarkNotice: 'REPLACE_WITH_COPYRIGHT_AND_TRADEMARK_NOTICE'
  },
  publicUrls: {
    browserLandingUrl: 'REPLACE_WITH_PUBLIC_BROWSER_LANDING_URL',
    privacyPolicyUrl: 'REPLACE_WITH_PUBLIC_PRIVACY_POLICY_URL',
    supportUrl: 'REPLACE_WITH_PUBLIC_SUPPORT_URL',
    securityPolicyUrl: 'REPLACE_WITH_PUBLIC_SECURITY_POLICY_URL',
    sourceRepoUrl: 'https://github.com/JTAHAI/tahai-web-services-browser',
    knownIssuesUrl: 'REPLACE_WITH_PUBLIC_KNOWN_ISSUES_OR_RELEASE_NOTES_URL'
  },
  copyReview: {
    requiredCopyFields,
    prohibitedClaims,
    requiredTruthStatements,
    noFalseStoreSubmissionClaim: false,
    noFalseStoreApprovalClaim: false,
    noFalseSigningClaim: false,
    noPublicGaClaimWithoutGate: false,
    noDirectPsaOrSecretStorageClaim: false,
    noCustomerDataOrSecrets: false,
    screenshotsAndCopyConsistent: false,
    knownIssuesTruthMatchesDocs: false,
    operatorApprovedForPartnerCenterPaste: false
  },
  goNoGo: {
    status: 'NO_GO',
    reason: 'Store listing copy is a template until final public URLs, known-issues truth, copy review, package identity truth, and operator approval are complete.',
    readyForPartnerCenterCopyPaste: false,
    readyForPartnerCenterSubmission: false,
    readyForPublicGA: false,
    operatorApproved: false
  }
};

const partnerCenterFieldMap = {
  schemaVersion: 1,
  pass,
  versionTarget: targetVersion,
  status: 'TEMPLATE_PENDING_PARTNER_CENTER_FIELD_CHECK',
  remainingPassesAfterThisPass,
  fields: [
    { partnerCenterField: 'Product name', source: 'listingCopy.appName', required: true, finalValue: 'TAHAI Web Services Browser', review: 'PENDING' },
    { partnerCenterField: 'Short description', source: 'listingCopy.shortDescription', required: true, finalValue: 'REPLACE_WITH_FINAL_VALUE', review: 'PENDING' },
    { partnerCenterField: 'Description', source: 'listingCopy.longDescription', required: true, finalValue: 'REPLACE_WITH_FINAL_VALUE', review: 'PENDING' },
    { partnerCenterField: 'Features', source: 'listingCopy.featureBullets', required: true, finalValue: 'REPLACE_WITH_FINAL_VALUE', review: 'PENDING' },
    { partnerCenterField: 'What is new', source: 'listingCopy.whatsNew', required: true, finalValue: 'REPLACE_WITH_FINAL_VALUE', review: 'PENDING' },
    { partnerCenterField: 'Privacy policy URL', source: 'publicUrls.privacyPolicyUrl', required: true, finalValue: 'REPLACE_WITH_FINAL_VALUE', review: 'PENDING' },
    { partnerCenterField: 'Support URL', source: 'publicUrls.supportUrl', required: true, finalValue: 'REPLACE_WITH_FINAL_VALUE', review: 'PENDING' },
    { partnerCenterField: 'Store reviewer notes', source: 'listingCopy.storeReviewerNotes', required: true, finalValue: 'REPLACE_WITH_FINAL_VALUE', review: 'PENDING' },
    { partnerCenterField: 'Age/content declarations', source: 'copyReview/no-dangerous-claims', required: true, finalValue: 'REPLACE_WITH_FINAL_DECLARATION', review: 'PENDING' }
  ],
  notes: 'Check live Partner Center field names, lengths, image requirements, and declarations during upload. This repo-side file prevents copy drift; it is not a Store submission.'
};

const copyClaimReview = {
  schemaVersion: 1,
  pass,
  versionTarget: targetVersion,
  status: 'TEMPLATE_PENDING_COPY_CLAIM_REVIEW',
  remainingPassesAfterThisPass,
  prohibitedClaims,
  requiredTruthStatements,
  reviewRows: prohibitedClaims.map((claim) => ({ claim, result: 'PENDING', notes: 'Confirm this claim does not appear in Store copy, screenshots, public URLs, or reviewer notes.' })),
  positiveClaimsAllowed: [
    'Chromium/Electron-based IT and DevOps command browser.',
    'Mission Control, split/tri/quad/focus layouts, Runbook Rail, Evidence Pack, and Operator Command Center are browser-side features.',
    'IT Docs and PSA integrations are browser-side references/contracts only in this repo.',
    'Store submission and approval are not claimed until real Partner Center evidence exists.'
  ]
};

const claimRules = {
  schemaVersion: 1,
  pass,
  versionTarget: targetVersion,
  remainingPassesAfterThisPass,
  requiredCopyFields,
  prohibitedClaims,
  requiredTruthStatements,
  requiredPublicUrls: [
    'browserLandingUrl',
    'privacyPolicyUrl',
    'supportUrl',
    'securityPolicyUrl',
    'sourceRepoUrl',
    'knownIssuesUrl'
  ],
  requiredReviewBooleans: [
    'noFalseStoreSubmissionClaim',
    'noFalseStoreApprovalClaim',
    'noFalseSigningClaim',
    'noPublicGaClaimWithoutGate',
    'noDirectPsaOrSecretStorageClaim',
    'noCustomerDataOrSecrets',
    'screenshotsAndCopyConsistent',
    'knownIssuesTruthMatchesDocs',
    'operatorApprovedForPartnerCenterPaste'
  ]
};

const docs = `# PASS263 — Store Listing Copy Truth Pack

Target version: \`${targetVersion}\`

Remaining passes after PASS263: **${remainingPassesAfterThisPass}**.

PASS263 adds a fail-closed Partner Center listing copy pack. It keeps Store copy, public URL truth, reviewer notes, feature claims, known-issues truth, and screenshot/copy consistency in one reviewable structure.

## What this pass adds

- Store listing copy template.
- Partner Center field-map template.
- Copy claim review template.
- Static claim-rule fixture.
- Source verifier: \`npm run verify:pass-263-store-listing-copy-truth-pack\`.
- Evidence gate: \`npm run gate:pass-263-store-listing-copy-truth-pack\`.

## Store posture

This pass does **not** submit to the Microsoft Store and does **not** claim Store approval, signed MSI/EXE status, public GA, IT Docs backend support, PSA connector support, direct PSA API support, or secret storage.

## Required final proof before copy paste into Partner Center

The hard gate stays blocked until the final listing copy pack records:

- real public HTTPS URLs;
- package version, package hash, and source commit truth;
- final short/long description and release notes;
- prohibited-claim review;
- screenshot/copy consistency review;
- known-issues truth review;
- operator approval for Partner Center copy/paste.

## Commands

\`\`\`powershell
Set-Location C:\\dev\\browser\\app
node scripts\\apply-pass263-store-listing-copy-truth-pack.mjs
npm run verify:pass-263-store-listing-copy-truth-pack
\`\`\`

Optional hard gate after final listing copy exists:

\`\`\`powershell
npm run gate:pass-263-store-listing-copy-truth-pack
\`\`\`

Expected final-pack path:

\`\`\`text
release-candidate/store-submission/pass263-store-listing-copy-truth-pack.json
\`\`\`

## Hard boundaries

- Browser-side/store-evidence structure only.
- No IT Docs backend code.
- No PSA connector code.
- No direct PSA API calls.
- No PSA/API/provider secrets.
- No Microsoft Store submission, approval, signed-release, or GA claim without evidence.
`;

const readme = `# PASS263 — Store Listing Copy Truth Pack

Target version: \`${targetVersion}\`

Remaining passes after PASS263: **${remainingPassesAfterThisPass}**.

PASS263 adds fail-closed Partner Center listing copy templates, public URL truth, claim review, reviewer-note mapping, and the final copy gate.

## Apply

\`\`\`powershell
Set-Location C:\\dev\\browser\\app
node scripts\\apply-pass263-store-listing-copy-truth-pack.mjs
npm run verify:pass-263-store-listing-copy-truth-pack
\`\`\`

## Gate when final copy exists

\`\`\`powershell
npm run gate:pass-263-store-listing-copy-truth-pack
\`\`\`

The gate should remain blocked until real public URLs, final copy, copy-claim review, known-issues truth, screenshot/copy consistency, and operator approval are complete.
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
  pkg.scripts['verify:pass-263-store-listing-copy-truth-pack'] = 'node scripts/verify-pass263-store-listing-copy-truth-pack.mjs';
  pkg.scripts['gate:pass-263-store-listing-copy-truth-pack'] = 'node scripts/gate-pass263-store-listing-copy-truth-pack.mjs';
  writeText(file, JSON.stringify(pkg, null, 2) + '\n');
  return { packageJsonFound: true, version: pkg.version, changes: [{ file: 'package.json', changed: before !== pkg.version, before, after: pkg.version }] };
}

const packageResult = ensurePackage();
writeText(listingCopyTemplatePath, JSON.stringify(listingCopyTemplate, null, 2) + '\n');
writeText(partnerCenterFieldMapPath, JSON.stringify(partnerCenterFieldMap, null, 2) + '\n');
writeText(copyClaimReviewPath, JSON.stringify(copyClaimReview, null, 2) + '\n');
writeText(claimRulesPath, JSON.stringify(claimRules, null, 2) + '\n');
writeText(docsPath, docs);
writeText(readmePath, readme);

const reportDir = path.join(root, 'release-candidate', 'generated');
fs.mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, 'pass263-store-listing-copy-truth-pack-apply-report.json');
const report = {
  pass,
  appliedAt: new Date().toISOString(),
  packageResult,
  listingCopyTemplate: rel(listingCopyTemplatePath),
  partnerCenterFieldMap: rel(partnerCenterFieldMapPath),
  copyClaimReview: rel(copyClaimReviewPath),
  claimRules: rel(claimRulesPath),
  docs: rel(docsPath),
  remainingPassesAfterThisPass,
  storeSubmissionStatus: 'NOT_SUBMITTED_NOT_APPROVED_COPY_TRUTH_ONLY'
};
writeText(reportPath, JSON.stringify(report, null, 2) + '\n');

console.log(pass + '_APPLY=PASS');
console.log(pass + '_VERSION=' + (packageResult.version || targetVersion));
console.log(pass + '_LISTING_COPY_TEMPLATE=' + rel(listingCopyTemplatePath));
console.log(pass + '_FIELD_MAP=' + rel(partnerCenterFieldMapPath));
console.log(pass + '_CLAIM_REVIEW=' + rel(copyClaimReviewPath));
console.log(pass + '_REPORT=' + rel(reportPath));
console.log(pass + '_REMAINING_PASSES_AFTER_THIS=' + remainingPassesAfterThisPass);
console.log(pass + '_STORE_SUBMISSION_STATUS=NOT_SUBMITTED_NOT_APPROVED');
