#!/usr/bin/env node
/* PASS261 hard gate: Partner Center packet must be filled before upload/submission */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredVersion = '2.0.14';
const packetCandidates = [
  process.env.PASS261_STORE_SUBMISSION_PACKET,
  'release-candidate/store-submission/pass261-store-submission-packet.json'
].filter(Boolean);
const pass260EvidenceCandidates = [
  process.env.PASS260_INSTALLED_SMOKE_EVIDENCE,
  'release-candidate/store-submission/pass260-installed-recipe-quad-smoke-evidence.json'
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
function passValue(value) { return value === true || value === 'PASS' || value === 'PASS_READY_NOT_SUBMITTED' || (value && value.result === 'PASS'); }
function fail(blockers, packetFile = null) {
  console.error('PASS261_STORE_SUBMISSION_PACKET_GATE=BLOCKED');
  if (packetFile) console.error('PASS261_PACKET=' + rel(packetFile));
  for (const blocker of blockers) console.error('- ' + blocker);
  process.exit(1);
}

const packetFile = find(packetCandidates);
if (!packetFile) {
  fail([
    'Missing filled PASS261 Store submission packet.',
    'Create release-candidate/store-submission/pass261-store-submission-packet.json from docs/store/pass261-store-submission-packet.template.json.',
    'Do not upload to Partner Center from templates or source-only proof.'
  ]);
}

let packet;
try { packet = readJson(packetFile); } catch (error) { fail(['PASS261 packet JSON could not be parsed: ' + error.message], packetFile); }
const blockers = [];

if (packet.schemaVersion !== 1) blockers.push('schemaVersion must be 1.');
if (packet.pass !== 'PASS261') blockers.push('pass must be PASS261.');
if (packet.versionTarget !== requiredVersion) blockers.push('versionTarget must be ' + requiredVersion + '.');
if (!['READY_FOR_PARTNER_CENTER_UPLOAD','READY_NOT_SUBMITTED'].includes(packet.status)) blockers.push('status must be READY_FOR_PARTNER_CENTER_UPLOAD or READY_NOT_SUBMITTED only after real review.');
if (placeholder(packet.generatedAt)) blockers.push('generatedAt is missing or placeholder.');
if (placeholder(packet.preparedBy)) blockers.push('preparedBy is missing or placeholder.');
if (placeholder(packet.sourceCommit)) blockers.push('sourceCommit is missing or placeholder.');

const identity = packet.packageIdentityTruth || {};
if (identity.partnerCenterReserved !== true) blockers.push('packageIdentityTruth.partnerCenterReserved must be true.');
if (placeholder(identity.packageFamilyName)) blockers.push('packageIdentityTruth.packageFamilyName is missing or placeholder.');
if (placeholder(identity.publisherId)) blockers.push('packageIdentityTruth.publisherId is missing or placeholder.');
if (identity.identityPlaceholdersRemoved !== true) blockers.push('packageIdentityTruth.identityPlaceholdersRemoved must be true.');

const listing = packet.storeListingTruth || {};
if (placeholder(listing.appName) || placeholder(listing.shortDescription) || placeholder(listing.descriptionSource)) blockers.push('storeListingTruth has missing listing fields.');
if (!['not-submitted','ready-not-submitted','ready-for-partner-center-upload'].includes(listing.microsoftStoreSubmissionClaim)) blockers.push('storeListingTruth.microsoftStoreSubmissionClaim must not claim submitted.');
if (listing.microsoftStoreApprovalClaim !== 'not-approved') blockers.push('storeListingTruth.microsoftStoreApprovalClaim must be not-approved.');

const urls = packet.privacySupportTruth || {};
for (const field of ['privacyPolicyUrl','supportUrl','websiteUrl']) {
  if (placeholder(urls[field]) || !/^https:\/\//i.test(String(urls[field] || ''))) blockers.push('privacySupportTruth.' + field + ' must be a real HTTPS URL.');
}
for (const field of ['noPersonalDataCollectedByDefaultClaimReviewed','localDataInventoryReviewed','supportBoundariesReviewed']) {
  if (urls[field] !== true) blockers.push('privacySupportTruth.' + field + ' must be true.');
}

const shots = packet.screenshotManifest || {};
if (shots.screenshotsCapturedFromInstalledApp !== true) blockers.push('screenshotManifest.screenshotsCapturedFromInstalledApp must be true.');
if (shots.screenshotsContainNoSecrets !== true) blockers.push('screenshotManifest.screenshotsContainNoSecrets must be true.');
if (shots.screenshotsMatchVersion !== requiredVersion) blockers.push('screenshotManifest.screenshotsMatchVersion must be ' + requiredVersion + '.');

const smoke = packet.pass260InstalledSmokeEvidence || {};
if (smoke.required !== true) blockers.push('pass260InstalledSmokeEvidence.required must be true.');
if (!passValue(smoke.gateResult)) blockers.push('pass260InstalledSmokeEvidence.gateResult must be PASS/PASS_READY_NOT_SUBMITTED.');
for (const field of ['noBlankPanes','noBottomOnlyWebview','noOrphanedWebview','noHiddenActivePane','focusRestorePassed','activePaneRoutingPassed']) {
  if (smoke[field] !== true) blockers.push('pass260InstalledSmokeEvidence.' + field + ' must be true.');
}
const pass260EvidenceFile = find(pass260EvidenceCandidates);
if (!pass260EvidenceFile) blockers.push('PASS260 installed smoke evidence file is missing.');

const checksums = packet.checksumsAndProvenance || {};
if (!sha256(checksums.packageSha256)) blockers.push('checksumsAndProvenance.packageSha256 must be a 64-character SHA256.');
if (placeholder(checksums.releaseManifestPath)) blockers.push('checksumsAndProvenance.releaseManifestPath is missing or placeholder.');
if (checksums.provenanceReviewed !== true) blockers.push('checksumsAndProvenance.provenanceReviewed must be true.');

const issues = packet.knownIssuesTruth || {};
if (issues.blockersOpen !== false) blockers.push('knownIssuesTruth.blockersOpen must be false for upload readiness.');
if (Array.isArray(issues.blockers) && issues.blockers.length > 0) blockers.push('knownIssuesTruth.blockers must be empty for upload readiness.');
if (issues.falseClaimsRemoved !== true) blockers.push('knownIssuesTruth.falseClaimsRemoved must be true.');

const signing = packet.signingTruth || {};
if (signing.noPrivateCertificatesInRepo !== true) blockers.push('signingTruth.noPrivateCertificatesInRepo must be true.');
if (!String(signing.directMsiExeSigningStatus || '').match(/unsigned-preview|trusted-signed-with-evidence/i)) blockers.push('signingTruth.directMsiExeSigningStatus must be truthful.');

const go = packet.goNoGo || {};
if (!['READY_NOT_SUBMITTED','GO_FOR_PARTNER_CENTER_UPLOAD'].includes(go.status)) blockers.push('goNoGo.status must be READY_NOT_SUBMITTED or GO_FOR_PARTNER_CENTER_UPLOAD.');
if (go.readyForPartnerCenterUpload !== true) blockers.push('goNoGo.readyForPartnerCenterUpload must be true.');
if (go.readyForPublicGA === true) blockers.push('goNoGo.readyForPublicGA must not be true from Store packet alone.');
if (go.operatorApproved !== true) blockers.push('goNoGo.operatorApproved must be true.');

if (blockers.length) fail(blockers, packetFile);
console.log('PASS261_STORE_SUBMISSION_PACKET_GATE=PASS_READY_NOT_SUBMITTED');
console.log('PASS261_PACKET=' + rel(packetFile));
console.log('PASS261_VERSION=' + requiredVersion);
console.log('PASS261_STORE_SUBMISSION_CLAIM=' + listing.microsoftStoreSubmissionClaim);
console.log('PASS261_STORE_APPROVAL_CLAIM=not-approved');
