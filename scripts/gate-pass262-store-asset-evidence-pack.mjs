#!/usr/bin/env node
/* PASS262 hard gate: Store asset evidence pack must be filled before Partner Center asset upload */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredVersion = '2.0.18';
const requiredScreenshotSlots = ['normal-browser-mode','mission-control-overview','quad-view-recipe-started','tri-view-layout-routing','split-view-active-pane-routing','runbook-rail-and-evidence','operator-command-center','settings-about-unsigned-preview-truth'];
const requiredListingAssets = ['store-square-logo','store-app-icon','store-listing-hero-or-promotional-image','store-screenshot-set','public-landing-page-preview-image'];
const requiredPublicUrls = ['browserLandingUrl','privacyPolicyUrl','supportUrl','securityPolicyUrl','sourceRepoUrl','releaseNotesOrKnownIssuesUrl'];
const packCandidates = [
  process.env.PASS262_STORE_ASSET_EVIDENCE_PACK,
  'release-candidate/store-submission/pass262-store-asset-evidence-pack.json'
].filter(Boolean);

function rel(file) { return path.relative(root, file).replace(/\\/g, '/'); }
function find(candidates) {
  for (const candidate of candidates) {
    const full = path.isAbsolute(candidate) ? candidate : path.join(root, candidate);
    if (fs.existsSync(full)) return full;
  }
  return null;
}
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function placeholder(value) { return typeof value !== 'string' || !value.trim() || /REPLACE_WITH|PLACEHOLDER|PENDING|TODO|TBD/i.test(value); }
function sha256(value) { return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value); }
function isHttps(value) { return typeof value === 'string' && /^https:\/\//i.test(value); }
function passish(value) { return value === true || value === 'PASS' || (value && value.result === 'PASS'); }
function fail(blockers, packFile = null) {
  console.error('PASS262_STORE_ASSET_EVIDENCE_PACK_GATE=BLOCKED');
  if (packFile) console.error('PASS262_PACK=' + rel(packFile));
  for (const blocker of blockers) console.error('- ' + blocker);
  process.exit(1);
}

const packFile = find(packCandidates);
if (!packFile) {
  fail([
    'Missing filled PASS262 Store asset evidence pack.',
    'Create release-candidate/store-submission/pass262-store-asset-evidence-pack.json from docs/store/pass262-store-asset-evidence-pack.template.json.',
    'Do not upload Store assets from templates or source-only proof.'
  ]);
}

let pack;
try { pack = readJson(packFile); } catch (error) { fail(['PASS262 asset evidence pack JSON could not be parsed: ' + error.message], packFile); }
const blockers = [];

if (pack.schemaVersion !== 1) blockers.push('schemaVersion must be 1.');
if (pack.pass !== 'PASS262') blockers.push('pass must be PASS262.');
if (pack.versionTarget !== requiredVersion) blockers.push('versionTarget must be ' + requiredVersion + '.');
if (!['READY_ASSET_PACK_NOT_SUBMITTED','READY_FOR_PARTNER_CENTER_ASSET_UPLOAD'].includes(pack.status)) blockers.push('status must be READY_ASSET_PACK_NOT_SUBMITTED or READY_FOR_PARTNER_CENTER_ASSET_UPLOAD.');
if (placeholder(pack.generatedAt)) blockers.push('generatedAt is missing or placeholder.');
if (placeholder(pack.preparedBy)) blockers.push('preparedBy is missing or placeholder.');
if (placeholder(pack.sourceCommit)) blockers.push('sourceCommit is missing or placeholder.');

const identity = pack.packageIdentityTruth || {};
if (identity.partnerCenterReserved !== true) blockers.push('packageIdentityTruth.partnerCenterReserved must be true.');
if (placeholder(identity.packageFamilyName)) blockers.push('packageIdentityTruth.packageFamilyName is missing or placeholder.');
if (identity.packageVersion !== requiredVersion) blockers.push('packageIdentityTruth.packageVersion must be ' + requiredVersion + '.');
if (!sha256(identity.packageSha256)) blockers.push('packageIdentityTruth.packageSha256 must be a 64-character SHA256.');
if (placeholder(identity.packagePath)) blockers.push('packageIdentityTruth.packagePath is missing or placeholder.');
if (identity.packageBuiltFromCleanSource !== true) blockers.push('packageIdentityTruth.packageBuiltFromCleanSource must be true.');

const truth = pack.storeTruth || {};
if (!['not-submitted','ready-not-submitted','asset-ready-not-submitted'].includes(truth.microsoftStoreSubmissionClaim)) blockers.push('storeTruth.microsoftStoreSubmissionClaim must not claim submitted.');
if (truth.microsoftStoreApprovalClaim !== 'not-approved') blockers.push('storeTruth.microsoftStoreApprovalClaim must be not-approved.');
if (truth.assetPackDoesNotSubmitToStore !== true) blockers.push('storeTruth.assetPackDoesNotSubmitToStore must be true.');
if (truth.publicGaClaim === true) blockers.push('storeTruth.publicGaClaim must not be true from asset evidence alone.');

const manifest = pack.assetManifest || {};
if (manifest.assetsCapturedFromInstalledApp !== true) blockers.push('assetManifest.assetsCapturedFromInstalledApp must be true.');
if (manifest.assetsMatchVersion !== true) blockers.push('assetManifest.assetsMatchVersion must be true.');
if (manifest.allAssetsHaveSha256 !== true) blockers.push('assetManifest.allAssetsHaveSha256 must be true.');
if (manifest.allAssetsReviewedForSecrets !== true) blockers.push('assetManifest.allAssetsReviewedForSecrets must be true.');

const screenshots = manifest.screenshots || [];
for (const id of requiredScreenshotSlots) {
  const row = screenshots.find((entry) => entry.assetId === id && entry.required === true);
  if (!row) { blockers.push('Missing required screenshot asset: ' + id + '.'); continue; }
  if (placeholder(row.sourcePath)) blockers.push(id + ': sourcePath is missing or placeholder.');
  if (row.capturedFrom !== 'installed-windows-app') blockers.push(id + ': capturedFrom must be installed-windows-app.');
  if (row.packageVersion !== requiredVersion) blockers.push(id + ': packageVersion must be ' + requiredVersion + '.');
  if (row.sourceCommit !== pack.sourceCommit) blockers.push(id + ': sourceCommit must match pack sourceCommit.');
  if (!sha256(row.packageSha256)) blockers.push(id + ': packageSha256 must be a 64-character SHA256.');
  if (!sha256(row.assetSha256)) blockers.push(id + ': assetSha256 must be a 64-character SHA256.');
  if (!row.pixelDimensions || row.pixelDimensions.width <= 0 || row.pixelDimensions.height <= 0) blockers.push(id + ': pixelDimensions must be positive.');
  if (row.noSecretReview?.reviewed !== true) blockers.push(id + ': noSecretReview.reviewed must be true.');
  if (row.noSecretReview?.customerDataVisible !== false || row.noSecretReview?.tokensVisible !== false || row.noSecretReview?.privateTenantDataVisible !== false || row.noSecretReview?.issueOrTicketDataVisible !== false) blockers.push(id + ': no-secret review still shows sensitive data.');
  if (row.storeTruthReview?.noStoreApprovalClaimVisible !== true || row.storeTruthReview?.noSubmittedClaimVisible !== true || row.storeTruthReview?.versionConsistentWithPacket !== true) blockers.push(id + ': store truth review must be clean and version-consistent.');
}

const listingAssets = manifest.listingAssets || [];
for (const id of requiredListingAssets) {
  const row = listingAssets.find((entry) => entry.assetId === id && entry.required === true);
  if (!row) { blockers.push('Missing required listing asset: ' + id + '.'); continue; }
  if (placeholder(row.sourcePath)) blockers.push(id + ': sourcePath is missing or placeholder.');
  if (row.packageVersion !== requiredVersion) blockers.push(id + ': packageVersion must be ' + requiredVersion + '.');
  if (row.sourceCommit !== pack.sourceCommit) blockers.push(id + ': sourceCommit must match pack sourceCommit.');
  if (!sha256(row.assetSha256)) blockers.push(id + ': assetSha256 must be a 64-character SHA256.');
  if (!row.pixelDimensions || row.pixelDimensions.width <= 0 || row.pixelDimensions.height <= 0) blockers.push(id + ': pixelDimensions must be positive.');
  if (row.noSecretReview?.reviewed !== true) blockers.push(id + ': noSecretReview.reviewed must be true.');
  if (row.noSecretReview?.customerDataVisible !== false || row.noSecretReview?.tokensVisible !== false) blockers.push(id + ': no-secret review still shows sensitive data.');
  if (row.storeTruthReview?.noStoreApprovalClaimVisible !== true || row.storeTruthReview?.noSubmittedClaimVisible !== true || row.storeTruthReview?.versionConsistentWithPacket !== true) blockers.push(id + ': store truth review must be clean and version-consistent.');
}

const imageChecklist = pack.storeListingImageChecklist || {};
for (const field of ['finalPartnerCenterRequirementsCheckedAtUploadTime','screenshotsRepresentInstalledApp','noBlankOrBottomOnlyPanesShown','missionControlFlagshipShownClearly','normalModeStillLooksClean','noInternalDebugPassChatterVisible','noSecretsOrCustomerDataVisible','altTextOrCaptionsPrepared']) {
  if (imageChecklist[field] !== true) blockers.push('storeListingImageChecklist.' + field + ' must be true.');
}

const urlReview = pack.publicUrlReview || {};
for (const id of requiredPublicUrls) {
  if (!isHttps(urlReview[id])) blockers.push('publicUrlReview.' + id + ' must be a real HTTPS URL.');
}
for (const field of ['allUrlsHttps','urlsOpenWithoutAuthentication','urlsMatchStoreListingCopy','noBrokenLinks','noFalseSigningOrApprovalClaims']) {
  if (urlReview[field] !== true) blockers.push('publicUrlReview.' + field + ' must be true.');
}

const issues = pack.knownIssuesTruth || {};
if (issues.knownIssuesReviewed !== true) blockers.push('knownIssuesTruth.knownIssuesReviewed must be true.');
if (issues.blockersOpen !== false) blockers.push('knownIssuesTruth.blockersOpen must be false for asset upload readiness.');
if (Array.isArray(issues.blockers) && issues.blockers.length > 0) blockers.push('knownIssuesTruth.blockers must be empty for asset upload readiness.');

const go = pack.goNoGo || {};
if (!['READY_ASSET_PACK_NOT_SUBMITTED','GO_FOR_PARTNER_CENTER_ASSET_UPLOAD'].includes(go.status)) blockers.push('goNoGo.status must be READY_ASSET_PACK_NOT_SUBMITTED or GO_FOR_PARTNER_CENTER_ASSET_UPLOAD.');
if (go.readyForPartnerCenterAssetUpload !== true) blockers.push('goNoGo.readyForPartnerCenterAssetUpload must be true.');
if (go.readyForPartnerCenterSubmission === true) blockers.push('goNoGo.readyForPartnerCenterSubmission must not be true from PASS262 alone.');
if (go.readyForPublicGA === true) blockers.push('goNoGo.readyForPublicGA must not be true from PASS262 alone.');
if (go.operatorApproved !== true) blockers.push('goNoGo.operatorApproved must be true.');

if (blockers.length) fail(blockers, packFile);
console.log('PASS262_STORE_ASSET_EVIDENCE_PACK_GATE=PASS_READY_NOT_SUBMITTED');
console.log('PASS262_PACK=' + rel(packFile));
console.log('PASS262_VERSION=' + requiredVersion);
console.log('PASS262_SCREENSHOT_ASSETS=' + requiredScreenshotSlots.length);
console.log('PASS262_LISTING_ASSETS=' + requiredListingAssets.length);
console.log('PASS262_STORE_SUBMISSION_CLAIM=' + truth.microsoftStoreSubmissionClaim);
console.log('PASS262_STORE_APPROVAL_CLAIM=not-approved');
