#!/usr/bin/env node
/* PASS262 — Store Asset Evidence Pack + 2.0.11 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pass = 'PASS262';
const targetVersion = '2.0.11';
const assetPackTemplatePath = path.join(root, 'docs', 'store', 'pass262-store-asset-evidence-pack.template.json');
const listingImageChecklistPath = path.join(root, 'docs', 'store', 'pass262-store-listing-image-checklist.template.json');
const publicUrlReviewPath = path.join(root, 'docs', 'store', 'pass262-public-url-review.template.json');
const requiredSlotsPath = path.join(root, 'tests', 'runtime', 'pass262-store-asset-required-slots.json');
const docsPath = path.join(root, 'docs', 'store', 'PASS262-store-asset-evidence-pack.md');
const readmePath = path.join(root, 'PASS262_README.md');

const requiredScreenshotSlots = [
  'normal-browser-mode',
  'mission-control-overview',
  'quad-view-recipe-started',
  'tri-view-layout-routing',
  'split-view-active-pane-routing',
  'runbook-rail-and-evidence',
  'operator-command-center',
  'settings-about-unsigned-preview-truth'
];

const requiredListingAssets = [
  'store-square-logo',
  'store-app-icon',
  'store-listing-hero-or-promotional-image',
  'store-screenshot-set',
  'public-landing-page-preview-image'
];

const requiredMetadataFields = [
  'assetId',
  'slot',
  'sourcePath',
  'sourceKind',
  'capturedFrom',
  'packageVersion',
  'sourceCommit',
  'packageSha256',
  'assetSha256',
  'pixelDimensions',
  'noSecretReview',
  'storeTruthReview'
];

const requiredPublicUrls = [
  'browserLandingUrl',
  'privacyPolicyUrl',
  'supportUrl',
  'securityPolicyUrl',
  'sourceRepoUrl',
  'releaseNotesOrKnownIssuesUrl'
];

const requiredSlots = {
  schemaVersion: 1,
  pass,
  versionTarget: targetVersion,
  storePosture: 'NOT_SUBMITTED_NOT_APPROVED_ASSET_EVIDENCE_ONLY',
  requiredScreenshotSlots,
  requiredListingAssets,
  requiredMetadataFields,
  requiredPublicUrls,
  requiredReviews: [
    'installed-app-source-review',
    'version-match-review',
    'sha256-hash-review',
    'no-secret-review',
    'store-listing-image-checklist-review',
    'public-url-review',
    'known-issues-truth-review',
    'operator-approval-before-upload'
  ],
  forbiddenClaims: [
    'Microsoft Store submitted',
    'Microsoft Store approved',
    'direct MSI/EXE signed unless trusted signing evidence exists',
    'public GA unless GA release gate exists'
  ]
};

const assetPackTemplate = {
  schemaVersion: 1,
  pass,
  packName: 'TAHAI Web Services Browser Store Asset Evidence Pack',
  status: 'TEMPLATE_PENDING_INSTALLED_APP_ASSETS',
  versionTarget: targetVersion,
  generatedAt: 'REPLACE_WITH_ISO_TIMESTAMP',
  preparedBy: 'REPLACE_WITH_OPERATOR_NAME',
  sourceCommit: 'REPLACE_WITH_GIT_COMMIT_SHA',
  packageIdentityTruth: {
    partnerCenterReserved: false,
    packageFamilyName: 'REPLACE_WITH_PARTNER_CENTER_PACKAGE_FAMILY_NAME',
    publisherDisplayName: 'TAHAI Web Services',
    packageVersion: targetVersion,
    packageSha256: 'REPLACE_WITH_64_HEX_SHA256',
    packagePath: 'REPLACE_WITH_LOCAL_PACKAGE_PATH_OR_RELEASE_MANIFEST_REFERENCE',
    packageBuiltFromCleanSource: false
  },
  storeTruth: {
    microsoftStoreSubmissionClaim: 'not-submitted',
    microsoftStoreApprovalClaim: 'not-approved',
    directMsiExeSigningStatus: 'unsigned-preview',
    assetPackDoesNotSubmitToStore: true,
    publicGaClaim: false
  },
  assetManifest: {
    manifestPath: 'release-candidate/store-submission/pass262-store-asset-evidence-pack.json',
    artifactRoot: 'release-candidate/store-submission/assets',
    assetsCapturedFromInstalledApp: false,
    assetsMatchVersion: false,
    allAssetsHaveSha256: false,
    allAssetsReviewedForSecrets: false,
    screenshots: requiredScreenshotSlots.map((slot) => ({
      assetId: slot,
      slot,
      required: true,
      sourcePath: 'REPLACE_WITH_ASSET_PATH',
      sourceKind: 'screenshot',
      capturedFrom: 'installed-windows-app',
      packageVersion: targetVersion,
      sourceCommit: 'REPLACE_WITH_GIT_COMMIT_SHA',
      packageSha256: 'REPLACE_WITH_64_HEX_SHA256',
      assetSha256: 'REPLACE_WITH_64_HEX_SHA256',
      pixelDimensions: { width: 0, height: 0 },
      noSecretReview: {
        reviewed: false,
        reviewer: 'REPLACE_WITH_REVIEWER_NAME',
        customerDataVisible: false,
        tokensVisible: false,
        privateTenantDataVisible: false,
        issueOrTicketDataVisible: false,
        notes: ''
      },
      storeTruthReview: {
        noStoreApprovalClaimVisible: true,
        noSubmittedClaimVisible: true,
        unsignedPreviewTruthIfVisible: true,
        versionConsistentWithPacket: false
      }
    })),
    listingAssets: requiredListingAssets.map((slot) => ({
      assetId: slot,
      slot,
      required: true,
      sourcePath: 'REPLACE_WITH_ASSET_PATH',
      sourceKind: 'store-listing-image-or-icon',
      packageVersion: targetVersion,
      sourceCommit: 'REPLACE_WITH_GIT_COMMIT_SHA',
      assetSha256: 'REPLACE_WITH_64_HEX_SHA256',
      pixelDimensions: { width: 0, height: 0 },
      transparentBackgroundReviewed: false,
      noSecretReview: { reviewed: false, reviewer: 'REPLACE_WITH_REVIEWER_NAME', customerDataVisible: false, tokensVisible: false, notes: '' },
      storeTruthReview: { noStoreApprovalClaimVisible: true, noSubmittedClaimVisible: true, versionConsistentWithPacket: false }
    }))
  },
  storeListingImageChecklist: {
    checklistPath: 'docs/store/pass262-store-listing-image-checklist.template.json',
    finalPartnerCenterRequirementsCheckedAtUploadTime: false,
    screenshotsRepresentInstalledApp: false,
    noBlankOrBottomOnlyPanesShown: false,
    missionControlFlagshipShownClearly: false,
    normalModeStillLooksClean: false,
    noInternalDebugPassChatterVisible: false,
    noSecretsOrCustomerDataVisible: false,
    altTextOrCaptionsPrepared: false,
    notes: 'Partner Center field names and size acceptance should be rechecked during upload; this pack records source, hashes, dimensions, and review truth.'
  },
  publicUrlReview: {
    reviewPath: 'docs/store/pass262-public-url-review.template.json',
    browserLandingUrl: 'REPLACE_WITH_PUBLIC_BROWSER_LANDING_URL',
    privacyPolicyUrl: 'REPLACE_WITH_PUBLIC_PRIVACY_POLICY_URL',
    supportUrl: 'REPLACE_WITH_PUBLIC_SUPPORT_URL',
    securityPolicyUrl: 'REPLACE_WITH_PUBLIC_SECURITY_POLICY_URL',
    sourceRepoUrl: 'https://github.com/JTAHAI/tahai-web-services-browser',
    releaseNotesOrKnownIssuesUrl: 'REPLACE_WITH_PUBLIC_RELEASE_NOTES_OR_KNOWN_ISSUES_URL',
    allUrlsHttps: false,
    urlsOpenWithoutAuthentication: false,
    urlsMatchStoreListingCopy: false,
    noBrokenLinks: false,
    noFalseSigningOrApprovalClaims: false
  },
  knownIssuesTruth: {
    knownIssuesReviewed: false,
    knownIssuesSource: 'docs/known-issues.md or docs/store/KNOWN_ISSUES_TRUTH_TEMPLATE.md',
    blockersOpen: true,
    blockers: [
      'Fill this asset pack only after real installed-app screenshots and asset hashes exist.'
    ]
  },
  goNoGo: {
    status: 'NO_GO',
    reason: 'Asset evidence pack is a template until installed-app screenshots, asset hashes, URL review, no-secret review, and operator approval are complete.',
    readyForPartnerCenterAssetUpload: false,
    readyForPartnerCenterSubmission: false,
    readyForPublicGA: false,
    operatorApproved: false
  }
};

const listingImageChecklist = {
  schemaVersion: 1,
  pass,
  versionTarget: targetVersion,
  status: 'TEMPLATE_PENDING_STORE_LISTING_IMAGE_REVIEW',
  checklist: [
    { id: 'partner-center-current-requirements-checked', required: true, result: 'PENDING', notes: 'Check Partner Center upload UI at submission time for accepted dimensions, aspect ratios, and file formats.' },
    { id: 'screenshots-from-installed-app', required: true, result: 'PENDING', notes: 'No dev server or mock screenshots for final Store evidence.' },
    { id: 'normal-mode-clean', required: true, result: 'PENDING', notes: 'Normal browser mode must look clean and not overrun chrome.' },
    { id: 'mission-control-flagship', required: true, result: 'PENDING', notes: 'Mission Control / Quad view must show the differentiator clearly.' },
    { id: 'no-blank-pane-or-bottom-only-webview', required: true, result: 'PENDING', notes: 'Screenshots must not show layout failures.' },
    { id: 'no-secrets-customer-data-or-tickets', required: true, result: 'PENDING', notes: 'No private customer, tenant, email, ticket, token, key, cookie, or account data.' },
    { id: 'no-false-store-signing-or-ga-claims', required: true, result: 'PENDING', notes: 'No submitted/approved/signed/GA claim unless separately evidenced.' },
    { id: 'version-and-source-recorded', required: true, result: 'PENDING', notes: 'Package version, source commit, package hash, and asset hash are recorded.' }
  ],
  requiredAssetSlots: requiredListingAssets,
  requiredScreenshotSlots
};

const publicUrlReview = {
  schemaVersion: 1,
  pass,
  versionTarget: targetVersion,
  status: 'TEMPLATE_PENDING_PUBLIC_URL_REVIEW',
  urls: requiredPublicUrls.map((id) => ({
    id,
    required: true,
    url: id === 'sourceRepoUrl' ? 'https://github.com/JTAHAI/tahai-web-services-browser' : 'REPLACE_WITH_PUBLIC_HTTPS_URL',
    https: id === 'sourceRepoUrl',
    opensWithoutAuthentication: false,
    matchesStoreListingCopy: false,
    noFalseStoreApprovalOrSigningClaim: false,
    checkedAt: 'REPLACE_WITH_ISO_TIMESTAMP',
    result: 'PENDING'
  })),
  reviewRules: [
    'Every Store listing URL must be HTTPS.',
    'Privacy, support, website, security, repo, and known-issues/release-note URLs must open without authentication.',
    'URLs must not contain private tenant/customer data or secrets.',
    'URLs must not claim Store approval, submission, direct signing, or GA before evidence exists.'
  ]
};

const docs = `# PASS262 — Store Asset Evidence Pack

## Goal

Create the installed-app screenshot/evidence asset pack structure for Partner Center review: required screenshot slots, Store listing image checklist, public URL review, source/version/hash metadata, no-secret review, and an artifact manifest.

## Important truth

PASS262 is an evidence-pack structure pass only. It does **not** submit the app to Microsoft, claim Microsoft Store approval, claim direct MSI/EXE signing, or declare public GA.

The Store posture remains **not-submitted** and **not-approved** until real Partner Center evidence exists.

## Files added

- \`docs/store/pass262-store-asset-evidence-pack.template.json\`
- \`docs/store/pass262-store-listing-image-checklist.template.json\`
- \`docs/store/pass262-public-url-review.template.json\`
- \`tests/runtime/pass262-store-asset-required-slots.json\`
- \`scripts/gate-pass262-store-asset-evidence-pack.mjs\`
- \`scripts/verify-pass262-store-asset-evidence-pack.mjs\`

## Required screenshot slots

- Normal browser mode
- Mission Control overview
- Quad View recipe started
- Tri-view layout routing
- Split View active-pane routing
- Runbook Rail and Evidence
- Operator Command Center
- Settings/About unsigned-preview truth

## Required review truth

Every final asset row must record:

- asset ID and slot
- source path
- installed-app capture source where applicable
- package version
- source commit
- package SHA256
- asset SHA256
- pixel dimensions
- no-secret review
- no false Store/signing/GA claim review

## Commands

\`\`\`powershell
Set-Location C:\\dev\\browser\\app
node scripts\\apply-pass262-store-asset-evidence-pack.mjs
npm run verify:pass-262-store-asset-evidence-pack
\`\`\`

Optional hard gate after real assets exist:

\`\`\`powershell
npm run gate:pass-262-store-asset-evidence-pack
\`\`\`

That gate is expected to block until \`release-candidate/store-submission/pass262-store-asset-evidence-pack.json\` is filled with real installed-app asset evidence.

## Hard boundaries

- Browser-side/store-evidence structure only.
- No IT Docs backend code.
- No PSA connector code.
- No direct PSA API calls.
- No PSA/API/provider secrets.
- No Microsoft Store submission, approval, signed-release, or GA claim without evidence.
`;

const readme = `# PASS262 — Store Asset Evidence Pack

Target version: \`2.0.11\`

PASS262 adds a fail-closed Store asset evidence pack for Partner Center preparation.

It creates templates for installed-app screenshots, listing images/icons, public URL review, SHA256/source/version metadata, and no-secret review. It does not claim Store submission, Store approval, direct MSI/EXE signing, or GA readiness.

## Apply

\`\`\`powershell
Set-Location C:\\dev\\browser\\app
node scripts\\apply-pass262-store-asset-evidence-pack.mjs
npm run verify:pass-262-store-asset-evidence-pack
\`\`\`

## Gate when real evidence exists

\`\`\`powershell
npm run gate:pass-262-store-asset-evidence-pack
\`\`\`

The gate should remain blocked until real installed-app screenshots/assets, URLs, hashes, and operator approval are attached.
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
  pkg.scripts['verify:pass-262-store-asset-evidence-pack'] = 'node scripts/verify-pass262-store-asset-evidence-pack.mjs';
  pkg.scripts['gate:pass-262-store-asset-evidence-pack'] = 'node scripts/gate-pass262-store-asset-evidence-pack.mjs';
  writeText(file, JSON.stringify(pkg, null, 2) + '\n');
  return { packageJsonFound: true, version: pkg.version, changes: [{ file: 'package.json', changed: before !== pkg.version, before, after: pkg.version }] };
}

const packageResult = ensurePackage();
writeText(requiredSlotsPath, JSON.stringify(requiredSlots, null, 2) + '\n');
writeText(assetPackTemplatePath, JSON.stringify(assetPackTemplate, null, 2) + '\n');
writeText(listingImageChecklistPath, JSON.stringify(listingImageChecklist, null, 2) + '\n');
writeText(publicUrlReviewPath, JSON.stringify(publicUrlReview, null, 2) + '\n');
writeText(docsPath, docs);
writeText(readmePath, readme);

const reportDir = path.join(root, 'release-candidate', 'generated');
fs.mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, 'pass262-store-asset-evidence-pack-apply-report.json');
const report = {
  pass,
  appliedAt: new Date().toISOString(),
  packageResult,
  requiredSlots: rel(requiredSlotsPath),
  assetPackTemplate: rel(assetPackTemplatePath),
  listingImageChecklist: rel(listingImageChecklistPath),
  publicUrlReview: rel(publicUrlReviewPath),
  docs: rel(docsPath),
  storeSubmissionStatus: 'NOT_SUBMITTED_NOT_APPROVED_ASSET_EVIDENCE_ONLY'
};
writeText(reportPath, JSON.stringify(report, null, 2) + '\n');

console.log(pass + '_APPLY=PASS');
console.log(pass + '_VERSION=' + (packageResult.version || targetVersion));
console.log(pass + '_ASSET_TEMPLATE=' + rel(assetPackTemplatePath));
console.log(pass + '_LISTING_IMAGE_CHECKLIST=' + rel(listingImageChecklistPath));
console.log(pass + '_PUBLIC_URL_REVIEW=' + rel(publicUrlReviewPath));
console.log(pass + '_REPORT=' + rel(reportPath));
console.log(pass + '_STORE_SUBMISSION_STATUS=NOT_SUBMITTED_NOT_APPROVED');
