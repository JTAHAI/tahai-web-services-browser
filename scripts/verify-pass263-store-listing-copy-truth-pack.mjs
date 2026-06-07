#!/usr/bin/env node
/* Verify PASS263 — Store Listing Copy Truth Pack */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredVersion = '2.0.14';
const remainingPassesAfterThisPass = 2;
const listingCopyTemplatePath = path.join(root, 'docs', 'store', 'pass263-store-listing-copy.template.json');
const partnerCenterFieldMapPath = path.join(root, 'docs', 'store', 'pass263-partner-center-field-map.template.json');
const copyClaimReviewPath = path.join(root, 'docs', 'store', 'pass263-copy-claim-review.template.json');
const claimRulesPath = path.join(root, 'tests', 'runtime', 'pass263-store-listing-claim-rules.json');
const docsPath = path.join(root, 'docs', 'store', 'PASS263-store-listing-copy-truth-pack.md');
const gatePath = path.join(root, 'scripts', 'gate-pass263-store-listing-copy-truth-pack.mjs');
const packagePath = path.join(root, 'package.json');

const requiredFiles = [listingCopyTemplatePath, partnerCenterFieldMapPath, copyClaimReviewPath, claimRulesPath, docsPath, gatePath];
const requiredCopyFields = ['appName','shortDescription','longDescription','featureBullets','whatsNew','supportContact','privacyPolicyUrl','supportUrl','securityPolicyUrl','sourceRepoUrl','knownIssuesUrl','copyrightTrademarkNotice','storeReviewerNotes'];
const requiredReviewBooleans = ['noFalseStoreSubmissionClaim','noFalseStoreApprovalClaim','noFalseSigningClaim','noPublicGaClaimWithoutGate','noDirectPsaOrSecretStorageClaim','noCustomerDataOrSecrets','screenshotsAndCopyConsistent','knownIssuesTruthMatchesDocs','operatorApprovedForPartnerCenterPaste'];
const prohibitedClaims = ['microsoft store approved','store approved','store certified','submitted to microsoft store','available in the microsoft store','signed msi','signed exe','public ga','general availability','direct psa integration','direct psa api','psa connector included','stores psa tokens','stores provider secrets','credential vault','automatic ticket writeback'];
const blockers = [];

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function readText(file) { return fs.readFileSync(file, 'utf8'); }
function has(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }
function placeholder(value) { return typeof value !== 'string' || !value.trim() || /REPLACE_WITH|PLACEHOLDER|TODO|TBD/i.test(value); }
function findClaim(text, claim) { return String(text || '').toLowerCase().includes(claim); }
function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, out);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) collectStrings(item, out);
  return out;
}

for (const file of requiredFiles) if (!fs.existsSync(file)) blockers.push('Missing required file: ' + path.relative(root, file));

if (!blockers.length) {
  const listing = readJson(listingCopyTemplatePath);
  const fieldMap = readJson(partnerCenterFieldMapPath);
  const claimReview = readJson(copyClaimReviewPath);
  const rules = readJson(claimRulesPath);

  if (listing.schemaVersion !== 1 || fieldMap.schemaVersion !== 1 || claimReview.schemaVersion !== 1 || rules.schemaVersion !== 1) blockers.push('All PASS263 JSON files must use schemaVersion 1.');
  for (const obj of [listing, fieldMap, claimReview, rules]) {
    if (obj.pass !== 'PASS263') blockers.push('All PASS263 JSON files must declare pass PASS263.');
    if (obj.versionTarget !== requiredVersion) blockers.push('All PASS263 JSON files must target ' + requiredVersion + '.');
    if (obj.remainingPassesAfterThisPass !== remainingPassesAfterThisPass) blockers.push('All PASS263 JSON files must report remainingPassesAfterThisPass=' + remainingPassesAfterThisPass + '.');
  }

  for (const field of requiredCopyFields) {
    if (!rules.requiredCopyFields.includes(field)) blockers.push('Claim rules missing required copy field: ' + field + '.');
  }
  for (const field of requiredReviewBooleans) {
    if (!rules.requiredReviewBooleans.includes(field)) blockers.push('Claim rules missing required review boolean: ' + field + '.');
    if (!has(listing.copyReview || {}, field)) blockers.push('Listing template copyReview missing boolean: ' + field + '.');
  }
  for (const claim of prohibitedClaims) {
    if (!rules.prohibitedClaims.includes(claim)) blockers.push('Claim rules missing prohibited claim: ' + claim + '.');
    if (!claimReview.prohibitedClaims.includes(claim)) blockers.push('Claim review missing prohibited claim: ' + claim + '.');
  }

  const truth = listing.storeTruth || {};
  if (truth.microsoftStoreSubmissionClaim !== 'not-submitted') blockers.push('Template must preserve not-submitted Store claim.');
  if (truth.microsoftStoreApprovalClaim !== 'not-approved') blockers.push('Template must preserve not-approved Store claim.');
  if (truth.directMsiExeSigningStatus !== 'unsigned-preview') blockers.push('Template must preserve unsigned-preview direct MSI/EXE truth.');
  if (truth.publicGaClaim !== false) blockers.push('Template must not claim public GA.');
  if (truth.listingCopyDoesNotSubmitToStore !== true) blockers.push('Template must state listing copy does not submit to Store.');

  if (!placeholder(listing.listingCopy.shortDescription)) blockers.push('Template shortDescription should remain a placeholder until final copy is filled.');
  if (!placeholder(listing.listingCopy.longDescription)) blockers.push('Template longDescription should remain a placeholder until final copy is filled.');
  if (!Array.isArray(listing.listingCopy.featureBullets) || listing.listingCopy.featureBullets.length < 5) blockers.push('Template must include at least five feature bullets.');
  if (!Array.isArray(fieldMap.fields) || fieldMap.fields.length < 8) blockers.push('Partner Center field map must include at least eight fields.');
  if (!Array.isArray(claimReview.reviewRows) || claimReview.reviewRows.length !== prohibitedClaims.length) blockers.push('Copy claim review must include one row per prohibited claim.');

  const allStrings = collectStrings(listing).concat(collectStrings(fieldMap), collectStrings(claimReview), collectStrings(rules)).join('\n').toLowerCase();
  for (const forbiddenSourcePattern of ['psa_api_key', 'client_secret', 'refresh_token', 'authorization:', 'cookie:', 'begin private key']) {
    if (allStrings.includes(forbiddenSourcePattern)) blockers.push('Forbidden secret-like pattern appears in PASS263 templates: ' + forbiddenSourcePattern + '.');
  }
}

if (fs.existsSync(packagePath)) {
  const pkg = readJson(packagePath);
  if (!pkg.scripts || pkg.scripts['verify:pass-263-store-listing-copy-truth-pack'] !== 'node scripts/verify-pass263-store-listing-copy-truth-pack.mjs') blockers.push('package.json missing verify:pass-263-store-listing-copy-truth-pack script.');
  if (!pkg.scripts || pkg.scripts['gate:pass-263-store-listing-copy-truth-pack'] !== 'node scripts/gate-pass263-store-listing-copy-truth-pack.mjs') blockers.push('package.json missing gate:pass-263-store-listing-copy-truth-pack script.');
}

const docs = fs.existsSync(docsPath) ? readText(docsPath) : '';
for (const phrase of ['not** submit to the Microsoft Store', 'Remaining passes after PASS263', 'No PSA connector code', 'No direct PSA API calls']) {
  if (!docs.includes(phrase)) blockers.push('PASS263 docs missing required phrase: ' + phrase);
}

if (blockers.length) {
  console.error('PASS263_STORE_LISTING_COPY_TRUTH_PACK=FAIL');
  for (const blocker of blockers) console.error('- ' + blocker);
  process.exit(1);
}

console.log('PASS263_STORE_LISTING_COPY_TRUTH_PACK=PASS');
console.log('PASS263_VERSION=' + requiredVersion);
console.log('PASS263_REMAINING_PASSES_AFTER_THIS=' + remainingPassesAfterThisPass);
console.log('PASS263_STORE_SUBMISSION_STATUS=NOT_SUBMITTED_NOT_APPROVED');
console.log('PASS263_GATE=gate-pass263-store-listing-copy-truth-pack');
