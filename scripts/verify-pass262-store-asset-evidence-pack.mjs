#!/usr/bin/env node
/* Verify PASS262 — Store Asset Evidence Pack */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredVersion = '2.0.14';
const assetPackTemplatePath = path.join(root, 'docs', 'store', 'pass262-store-asset-evidence-pack.template.json');
const listingImageChecklistPath = path.join(root, 'docs', 'store', 'pass262-store-listing-image-checklist.template.json');
const publicUrlReviewPath = path.join(root, 'docs', 'store', 'pass262-public-url-review.template.json');
const requiredSlotsPath = path.join(root, 'tests', 'runtime', 'pass262-store-asset-required-slots.json');
const docsPath = path.join(root, 'docs', 'store', 'PASS262-store-asset-evidence-pack.md');
const gateScriptPath = path.join(root, 'scripts', 'gate-pass262-store-asset-evidence-pack.mjs');
const packagePath = path.join(root, 'package.json');

const requiredScreenshotSlots = ['normal-browser-mode','mission-control-overview','quad-view-recipe-started','tri-view-layout-routing','split-view-active-pane-routing','runbook-rail-and-evidence','operator-command-center','settings-about-unsigned-preview-truth'];
const requiredListingAssets = ['store-square-logo','store-app-icon','store-listing-hero-or-promotional-image','store-screenshot-set','public-landing-page-preview-image'];
const requiredMetadataFields = ['assetId','slot','sourcePath','sourceKind','capturedFrom','packageVersion','sourceCommit','packageSha256','assetSha256','pixelDimensions','noSecretReview','storeTruthReview'];
const requiredPublicUrls = ['browserLandingUrl','privacyPolicyUrl','supportUrl','securityPolicyUrl','sourceRepoUrl','releaseNotesOrKnownIssuesUrl'];
const skipDirs = new Set(['.git','node_modules','dist','release','release-msix','out','coverage','.vite','.next','build','release-candidate']);

function rel(file) { return path.relative(root, file).replace(/\\/g, '/'); }
function readText(file) { return fs.readFileSync(file, 'utf8'); }
function readJson(file) { return JSON.parse(readText(file)); }
function fail(message, details = []) {
  console.error('PASS262_STORE_ASSET_EVIDENCE_PACK=FAIL');
  console.error(message);
  for (const detail of details) console.error('- ' + detail);
  process.exit(1);
}
function exists(file) { if (!fs.existsSync(file)) fail('Missing required PASS262 file.', [rel(file)]); }
function walk(dir, predicate, hits = []) {
  if (!fs.existsSync(dir)) return hits;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, predicate, hits);
    else if (predicate(full)) hits.push(full);
  }
  return hits;
}
function parseVersion(v) { const m = String(v || '0.0.0').match(/^(\d+)\.(\d+)\.(\d+)/); return m ? { major:+m[1], minor:+m[2], patch:+m[3] } : { major:0, minor:0, patch:0 }; }
function versionAtLeast(v, expected) { const a = parseVersion(v), e = parseVersion(expected); if (a.major !== e.major) return a.major > e.major; if (a.minor !== e.minor) return a.minor > e.minor; return a.patch >= e.patch; }

for (const file of [assetPackTemplatePath, listingImageChecklistPath, publicUrlReviewPath, requiredSlotsPath, docsPath, gateScriptPath]) exists(file);

if (fs.existsSync(packagePath)) {
  const pkg = readJson(packagePath);
  if (!versionAtLeast(pkg.version, requiredVersion)) fail('package.json version must be at least PASS262 target.', [pkg.version || '(missing)']);
  if (pkg.scripts?.['verify:pass-262-store-asset-evidence-pack'] !== 'node scripts/verify-pass262-store-asset-evidence-pack.mjs') fail('package.json missing PASS262 verifier script.');
  if (pkg.scripts?.['gate:pass-262-store-asset-evidence-pack'] !== 'node scripts/gate-pass262-store-asset-evidence-pack.mjs') fail('package.json missing PASS262 gate script.');
}

const required = readJson(requiredSlotsPath);
if (required.schemaVersion !== 1 || required.pass !== 'PASS262') fail('PASS262 required slots metadata invalid.');
if (required.versionTarget !== requiredVersion) fail('PASS262 required slots version mismatch.', [required.versionTarget]);
if (required.storePosture !== 'NOT_SUBMITTED_NOT_APPROVED_ASSET_EVIDENCE_ONLY') fail('PASS262 required slots must preserve no-submit/no-approval posture.');
for (const id of requiredScreenshotSlots) if (!required.requiredScreenshotSlots?.includes(id)) fail('PASS262 required screenshot slot missing.', [id]);
for (const id of requiredListingAssets) if (!required.requiredListingAssets?.includes(id)) fail('PASS262 required listing asset slot missing.', [id]);
for (const id of requiredMetadataFields) if (!required.requiredMetadataFields?.includes(id)) fail('PASS262 metadata field missing.', [id]);
for (const id of requiredPublicUrls) if (!required.requiredPublicUrls?.includes(id)) fail('PASS262 required public URL missing.', [id]);

const pack = readJson(assetPackTemplatePath);
if (pack.schemaVersion !== 1 || pack.pass !== 'PASS262') fail('PASS262 asset pack template metadata invalid.');
if (pack.versionTarget !== requiredVersion) fail('PASS262 asset pack version mismatch.', [pack.versionTarget]);
if (pack.status !== 'TEMPLATE_PENDING_INSTALLED_APP_ASSETS') fail('PASS262 asset pack must be a pending template by default.');
if (pack.storeTruth?.microsoftStoreSubmissionClaim !== 'not-submitted') fail('PASS262 asset pack must not claim Store submission.');
if (pack.storeTruth?.microsoftStoreApprovalClaim !== 'not-approved') fail('PASS262 asset pack must not claim Store approval.');
if (pack.storeTruth?.assetPackDoesNotSubmitToStore !== true) fail('PASS262 asset pack must explicitly state it does not submit to Store.');
if (pack.goNoGo?.status !== 'NO_GO' || pack.goNoGo?.readyForPartnerCenterAssetUpload !== false || pack.goNoGo?.operatorApproved !== false) fail('PASS262 go/no-go must be fail-closed by default.');
if (pack.assetManifest?.assetsCapturedFromInstalledApp !== false) fail('PASS262 template must not preclaim installed-app asset capture.');
if (pack.assetManifest?.allAssetsHaveSha256 !== false) fail('PASS262 template must not preclaim hashes.');
if (pack.assetManifest?.allAssetsReviewedForSecrets !== false) fail('PASS262 template must not preclaim no-secret review.');
for (const id of requiredScreenshotSlots) if (!pack.assetManifest?.screenshots?.some((entry) => entry.assetId === id && entry.required === true)) fail('PASS262 asset pack missing screenshot slot.', [id]);
for (const id of requiredListingAssets) if (!pack.assetManifest?.listingAssets?.some((entry) => entry.assetId === id && entry.required === true)) fail('PASS262 asset pack missing listing asset slot.', [id]);
for (const entry of [...(pack.assetManifest?.screenshots || []), ...(pack.assetManifest?.listingAssets || [])]) {
  for (const key of ['assetId','slot','sourcePath','sourceKind','packageVersion','sourceCommit','assetSha256','pixelDimensions','noSecretReview','storeTruthReview']) {
    if (!(key in entry)) fail('PASS262 asset row missing required metadata.', [`${entry.assetId || '(unknown)'}:${key}`]);
  }
  if (entry.packageVersion !== requiredVersion) fail('PASS262 asset row packageVersion mismatch.', [entry.assetId]);
  if (entry.noSecretReview?.reviewed !== false) fail('PASS262 template must require real no-secret review.', [entry.assetId]);
  if (entry.storeTruthReview?.noStoreApprovalClaimVisible !== true || entry.storeTruthReview?.noSubmittedClaimVisible !== true) fail('PASS262 store truth review fields must block false claim visibility.', [entry.assetId]);
}

const listing = readJson(listingImageChecklistPath);
if (listing.schemaVersion !== 1 || listing.pass !== 'PASS262') fail('PASS262 listing image checklist metadata invalid.');
if (listing.versionTarget !== requiredVersion) fail('PASS262 listing image checklist version mismatch.', [listing.versionTarget]);
for (const id of ['partner-center-current-requirements-checked','screenshots-from-installed-app','normal-mode-clean','mission-control-flagship','no-blank-pane-or-bottom-only-webview','no-secrets-customer-data-or-tickets','no-false-store-signing-or-ga-claims','version-and-source-recorded']) {
  if (!listing.checklist?.some((entry) => entry.id === id && entry.required === true && entry.result === 'PENDING')) fail('PASS262 checklist missing required pending item.', [id]);
}

const urls = readJson(publicUrlReviewPath);
if (urls.schemaVersion !== 1 || urls.pass !== 'PASS262') fail('PASS262 public URL review metadata invalid.');
if (urls.versionTarget !== requiredVersion) fail('PASS262 public URL review version mismatch.', [urls.versionTarget]);
for (const id of requiredPublicUrls) if (!urls.urls?.some((entry) => entry.id === id && entry.required === true)) fail('PASS262 public URL review missing required URL.', [id]);
if (!urls.reviewRules?.some((rule) => /HTTPS/.test(rule))) fail('PASS262 public URL review must require HTTPS.');
if (!urls.reviewRules?.some((rule) => /Store approval/.test(rule))) fail('PASS262 public URL review must block false Store approval claims.');

const docsText = readText(docsPath);
for (const phrase of ['does **not** submit', 'not-submitted', 'not-approved', 'required screenshot slots', 'No direct PSA API calls']) {
  if (!docsText.includes(phrase)) fail('PASS262 docs missing truth language.', [phrase]);
}
const gateText = readText(gateScriptPath);
for (const token of ['PASS262_STORE_ASSET_EVIDENCE_PACK_GATE=BLOCKED','readyForPartnerCenterAssetUpload','allAssetsHaveSha256','allAssetsReviewedForSecrets','not-submitted','not-approved']) {
  if (!gateText.includes(token)) fail('PASS262 gate script missing fail-closed token.', [token]);
}

const forbiddenHits = [];
const sourceFiles = walk(root, (file) => /\.(mjs|js|ts|tsx|json|md)$/i.test(file));
const forbiddenPatterns = [
  { re: /fetch\s*\(\s*['\"]https?:\/\/[^'\"]*(connectwise|autotask|halo|syncro|zendesk|freshservice|psa)/i, label: 'direct PSA/provider fetch' },
  { re: /(psa[_-]?api[_-]?key|client_secret|refresh_token|BEGIN PRIVATE KEY|AWS_SECRET_ACCESS_KEY)\s*[:=]\s*['\"][^'\"]{6,}/i, label: 'secret-like material' },
  { re: /microsoftStoreApprovalClaim['"\s:]+['"]approved/i, label: 'false Store approval claim' }
];
for (const file of sourceFiles) {
  const text = readText(file);
  for (const item of forbiddenPatterns) if (item.re.test(text)) forbiddenHits.push(`${rel(file)}: ${item.label}`);
}
if (forbiddenHits.length) fail('PASS262 detected forbidden direct integration/secret/false-claim patterns.', forbiddenHits.slice(0, 80));
const generatedBad = walk(root, (file) => /\.(msix|msixupload|appx|appxupload|msi|exe|pfx|p12|cer|key|zip)$/i.test(file));
if (generatedBad.length) fail('Generated/package/certificate artifacts appear in source tree.', generatedBad.map(rel));

console.log('PASS262_STORE_ASSET_EVIDENCE_PACK=PASS');
console.log('PASS262_VERSION=' + requiredVersion);
console.log('PASS262_ASSET_PACK_TEMPLATE=' + rel(assetPackTemplatePath));
console.log('PASS262_REQUIRED_SCREENSHOT_SLOTS=' + requiredScreenshotSlots.length);
console.log('PASS262_REQUIRED_LISTING_ASSETS=' + requiredListingAssets.length);
console.log('PASS262_STORE_SUBMISSION_STATUS=NOT_SUBMITTED_NOT_APPROVED');
console.log('PASS262_GATE_DEFAULT=BLOCKED_UNTIL_REAL_ASSETS_URLS_HASHES_NO_SECRET_REVIEW_AND_OPERATOR_APPROVAL');
