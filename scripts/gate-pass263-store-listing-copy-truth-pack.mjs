#!/usr/bin/env node
/* Gate PASS263 final Store listing copy pack. Fails closed until real copy evidence exists. */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredVersion = '2.0.18';
const remainingPassesAfterThisPass = 2;
const packCandidates = [
  path.join(root, 'release-candidate', 'store-submission', 'pass263-store-listing-copy-truth-pack.json'),
  path.join(root, 'release-candidate', 'store-submission', 'PASS263-store-listing-copy-truth-pack.json')
];
const prohibitedClaims = ['microsoft store approved','store approved','store certified','submitted to microsoft store','available in the microsoft store','signed msi','signed exe','public ga','general availability','direct psa integration','direct psa api','psa connector included','stores psa tokens','stores provider secrets','credential vault','automatic ticket writeback'];
const requiredReviewBooleans = ['noFalseStoreSubmissionClaim','noFalseStoreApprovalClaim','noFalseSigningClaim','noPublicGaClaimWithoutGate','noDirectPsaOrSecretStorageClaim','noCustomerDataOrSecrets','screenshotsAndCopyConsistent','knownIssuesTruthMatchesDocs','operatorApprovedForPartnerCenterPaste'];
const requiredPublicUrls = ['browserLandingUrl','privacyPolicyUrl','supportUrl','securityPolicyUrl','sourceRepoUrl','knownIssuesUrl'];

function rel(file) { return path.relative(root, file).replace(/\\/g, '/'); }
function find(candidates) { for (const candidate of candidates) if (fs.existsSync(candidate)) return candidate; return null; }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function placeholder(value) { return typeof value !== 'string' || !value.trim() || /REPLACE_WITH|PLACEHOLDER|PENDING|TODO|TBD/i.test(value); }
function sha256(value) { return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value); }
function isHttps(value) { return typeof value === 'string' && /^https:\/\//i.test(value); }
function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, out);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) collectStrings(item, out);
  return out;
}
function fail(blockers, packFile = null) {
  console.error('PASS263_STORE_LISTING_COPY_TRUTH_GATE=BLOCKED');
  if (packFile) console.error('PASS263_PACK=' + rel(packFile));
  for (const blocker of blockers) console.error('- ' + blocker);
  process.exit(1);
}

const packFile = find(packCandidates);
if (!packFile) {
  fail([
    'Missing filled PASS263 Store listing copy truth pack.',
    'Create release-candidate/store-submission/pass263-store-listing-copy-truth-pack.json from docs/store/pass263-store-listing-copy.template.json.',
    'Do not paste listing copy into Partner Center from templates or source-only proof.'
  ]);
}

let pack;
try { pack = readJson(packFile); } catch (error) { fail(['PASS263 listing copy pack JSON could not be parsed: ' + error.message], packFile); }
const blockers = [];

if (pack.schemaVersion !== 1) blockers.push('schemaVersion must be 1.');
if (pack.pass !== 'PASS263') blockers.push('pass must be PASS263.');
if (pack.versionTarget !== requiredVersion) blockers.push('versionTarget must be ' + requiredVersion + '.');
if (pack.remainingPassesAfterThisPass !== remainingPassesAfterThisPass) blockers.push('remainingPassesAfterThisPass must be ' + remainingPassesAfterThisPass + '.');
if (!['READY_FOR_PARTNER_CENTER_COPY_PASTE','READY_LISTING_COPY_NOT_SUBMITTED'].includes(pack.status)) blockers.push('status must be READY_FOR_PARTNER_CENTER_COPY_PASTE or READY_LISTING_COPY_NOT_SUBMITTED.');
if (placeholder(pack.generatedAt)) blockers.push('generatedAt is missing or placeholder.');
if (placeholder(pack.preparedBy)) blockers.push('preparedBy is missing or placeholder.');
if (placeholder(pack.sourceCommit)) blockers.push('sourceCommit is missing or placeholder.');

const truth = pack.storeTruth || {};
if (!['not-submitted','ready-not-submitted','copy-ready-not-submitted'].includes(truth.microsoftStoreSubmissionClaim)) blockers.push('storeTruth.microsoftStoreSubmissionClaim must not claim submitted.');
if (truth.microsoftStoreApprovalClaim !== 'not-approved') blockers.push('storeTruth.microsoftStoreApprovalClaim must be not-approved.');
if (truth.directMsiExeSigningStatus !== 'unsigned-preview' && truth.directMsiExeSigningStatus !== 'separately-evidenced') blockers.push('storeTruth.directMsiExeSigningStatus must be unsigned-preview or separately-evidenced.');
if (truth.publicGaClaim === true) blockers.push('storeTruth.publicGaClaim must not be true from PASS263 alone.');
if (truth.listingCopyDoesNotSubmitToStore !== true) blockers.push('storeTruth.listingCopyDoesNotSubmitToStore must be true.');

const identity = pack.appIdentity || {};
if (identity.appName !== 'TAHAI Web Services Browser') blockers.push('appIdentity.appName must be TAHAI Web Services Browser.');
if (identity.packageVersion !== requiredVersion) blockers.push('appIdentity.packageVersion must be ' + requiredVersion + '.');
if (placeholder(identity.packageFamilyName)) blockers.push('appIdentity.packageFamilyName is missing or placeholder.');
if (!sha256(identity.packageSha256)) blockers.push('appIdentity.packageSha256 must be a 64-character SHA256.');
if (identity.sourceCommit !== pack.sourceCommit) blockers.push('appIdentity.sourceCommit must match pack sourceCommit.');

const copy = pack.listingCopy || {};
for (const field of ['appName','shortDescription','longDescription','whatsNew','storeReviewerNotes','supportContact','copyrightTrademarkNotice']) {
  if (placeholder(copy[field])) blockers.push('listingCopy.' + field + ' is missing or placeholder.');
}
if (String(copy.shortDescription || '').length > 500) blockers.push('listingCopy.shortDescription should stay concise; current length exceeds 500 characters.');
if (String(copy.longDescription || '').length < 300) blockers.push('listingCopy.longDescription must be substantive enough for Store review.');
if (!Array.isArray(copy.featureBullets) || copy.featureBullets.length < 5) blockers.push('listingCopy.featureBullets must include at least five bullets.');
if (!Array.isArray(copy.searchTerms) || copy.searchTerms.length < 3) blockers.push('listingCopy.searchTerms must include at least three search terms.');

const urls = pack.publicUrls || {};
for (const field of requiredPublicUrls) if (!isHttps(urls[field])) blockers.push('publicUrls.' + field + ' must be a real HTTPS URL.');

const review = pack.copyReview || {};
for (const field of requiredReviewBooleans) if (review[field] !== true) blockers.push('copyReview.' + field + ' must be true.');
if (!Array.isArray(review.prohibitedClaims) || review.prohibitedClaims.length < prohibitedClaims.length) blockers.push('copyReview.prohibitedClaims must include all prohibited claims.');

const allStrings = collectStrings({ copy, urls, reviewerNotes: copy.storeReviewerNotes }).join('\n').toLowerCase();
for (const claim of prohibitedClaims) {
  if (allStrings.includes(claim)) blockers.push('Prohibited claim appears in final copy or URLs: ' + claim + '.');
}
for (const secretPattern of ['psa_api_key','client_secret','refresh_token','authorization:','cookie:','begin private key','bearer ']) {
  if (allStrings.includes(secretPattern)) blockers.push('Secret-like pattern appears in final listing copy: ' + secretPattern + '.');
}

const go = pack.goNoGo || {};
if (!['READY_FOR_PARTNER_CENTER_COPY_PASTE','GO_FOR_PARTNER_CENTER_COPY_PASTE'].includes(go.status)) blockers.push('goNoGo.status must be READY_FOR_PARTNER_CENTER_COPY_PASTE or GO_FOR_PARTNER_CENTER_COPY_PASTE.');
if (go.readyForPartnerCenterCopyPaste !== true) blockers.push('goNoGo.readyForPartnerCenterCopyPaste must be true.');
if (go.readyForPartnerCenterSubmission === true) blockers.push('goNoGo.readyForPartnerCenterSubmission must not be true from PASS263 alone.');
if (go.readyForPublicGA === true) blockers.push('goNoGo.readyForPublicGA must not be true from PASS263 alone.');
if (go.operatorApproved !== true) blockers.push('goNoGo.operatorApproved must be true.');

if (blockers.length) fail(blockers, packFile);
console.log('PASS263_STORE_LISTING_COPY_TRUTH_GATE=PASS_READY_NOT_SUBMITTED');
console.log('PASS263_PACK=' + rel(packFile));
console.log('PASS263_VERSION=' + requiredVersion);
console.log('PASS263_REMAINING_PASSES_AFTER_THIS=' + remainingPassesAfterThisPass);
console.log('PASS263_STORE_SUBMISSION_CLAIM=' + truth.microsoftStoreSubmissionClaim);
console.log('PASS263_STORE_APPROVAL_CLAIM=not-approved');
