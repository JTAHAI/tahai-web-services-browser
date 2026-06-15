#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const candidatePaths = [
  process.env.STORE_SUBMISSION_EVIDENCE,
  'release-candidate/generated/store-submission/store-submission-evidence.generated.json',
  'release-candidate/store-submission/store-submission-evidence.json',
  'release-candidate/store-submission/pass250-store-submission-evidence.json',
  'store-submission-evidence.json'
].filter(Boolean);

function rel(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function findEvidenceFile() {
  for (const candidate of candidatePaths) {
    const full = path.isAbsolute(candidate) ? candidate : path.join(root, candidate);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

function parseJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function isHttps(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function badPlaceholder(value) {
  if (typeof value !== 'string') return true;
  return !value.trim() || /TODO|TBD|PENDING|REPLACE_WITH|PLACEHOLDER/i.test(value);
}

function artifactReady(artifact) {
  return artifact && typeof artifact.path === 'string' && /\.(msix|msixupload|appxupload)$/i.test(artifact.path) && typeof artifact.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(artifact.sha256) && Number(artifact.sizeBytes) > 0;
}

function checklistPass(checklist) {
  if (!checklist || typeof checklist !== 'object') return false;
  const entries = Object.entries(checklist);
  return entries.length >= 10 && entries.every(([, value]) => value === 'PASS' || (value && value.result === 'PASS'));
}

function readySubmissionStatus(status) {
  return ['READY_FOR_PARTNER_CENTER_UPLOAD', 'READY_FOR_STORE_SUBMISSION'].includes(status);
}

function fail(blockers, evidencePath = null) {
  console.error('STORE_SUBMISSION_GATE=BLOCKED');
  if (evidencePath) console.error(`STORE_SUBMISSION_EVIDENCE=${rel(evidencePath)}`);
  for (const blocker of blockers) console.error(`- ${blocker}`);
  process.exit(1);
}

const evidencePath = findEvidenceFile();
if (!evidencePath) {
  fail([
    'No real Store submission evidence JSON found.',
    'Run npm run store:evidence:refresh to create ignored local Store evidence, or set STORE_SUBMISSION_EVIDENCE to a real evidence JSON.',
    'Fill Partner Center identity, privacy/support URLs, listing assets, package artifact hashes, installed smoke, known-issues truth, and release-truth fields.'
  ]);
}

let evidence;
try {
  evidence = parseJson(evidencePath);
} catch (error) {
  fail([`Evidence file is not valid JSON: ${error.message}`], evidencePath);
}

const blockers = [];
if (!readySubmissionStatus(evidence.submissionStatus)) {
  blockers.push('submissionStatus must be READY_FOR_PARTNER_CENTER_UPLOAD or READY_FOR_STORE_SUBMISSION.');
}

const identity = evidence.partnerCenterIdentity || {};
if (identity.status !== 'READY') blockers.push('partnerCenterIdentity.status must be READY.');
for (const field of ['packageIdentityName', 'publisher', 'publisherDisplayName', 'packageFamilyName']) {
  if (badPlaceholder(identity[field])) blockers.push(`partnerCenterIdentity.${field} is missing or still a placeholder.`);
}
if (identity.manifestUpdated !== true) blockers.push('partnerCenterIdentity.manifestUpdated must be true.');

const privacy = evidence.privacySupport || {};
if (privacy.status !== 'READY') blockers.push('privacySupport.status must be READY.');
if (!isHttps(privacy.privacyUrl)) blockers.push('privacySupport.privacyUrl must be public HTTPS.');
if (!isHttps(privacy.supportUrl)) blockers.push('privacySupport.supportUrl must be public HTTPS.');
if (privacy.urlsPubliclyReachable !== true) blockers.push('privacySupport.urlsPubliclyReachable must be true.');

const listing = evidence.listing || {};
if (listing.status !== 'READY') blockers.push('listing.status must be READY.');
if (badPlaceholder(listing.title)) blockers.push('listing.title is missing.');
if (badPlaceholder(listing.shortDescription)) blockers.push('listing.shortDescription is missing.');
if (listing.fullDescriptionReady !== true) blockers.push('listing.fullDescriptionReady must be true.');
if (listing.screenshotsReady !== true) blockers.push('listing.screenshotsReady must be true.');
if (!Array.isArray(listing.screenshotManifest) || listing.screenshotManifest.length < 4) blockers.push('listing.screenshotManifest must include at least four screenshot records.');
if (listing.ageAndContentNotesReady !== true) blockers.push('listing.ageAndContentNotesReady must be true.');
if (listing.releaseNotesReady !== true) blockers.push('listing.releaseNotesReady must be true.');

const pkg = evidence.packageArtifact || {};
if (pkg.status !== 'READY') blockers.push('packageArtifact.status must be READY.');
if (badPlaceholder(pkg.sourceCommit)) blockers.push('packageArtifact.sourceCommit is missing or placeholder.');
const packageVersion = String(pkg.version || evidence.version || '').trim();
const msixVersion = String(pkg.msixVersion || (packageVersion ? `${packageVersion}.0` : '')).trim();
const readyArtifacts = Array.isArray(pkg.artifacts) ? pkg.artifacts.filter(artifactReady) : [];
const currentReadyArtifacts = readyArtifacts.filter((artifact) => {
  const haystack = `${artifact.fileName || ''} ${artifact.path || ''}`;
  return Boolean(packageVersion && haystack.includes(packageVersion)) || Boolean(msixVersion && haystack.includes(msixVersion)) || artifact.currentVersionReview === 'MATCHES_PACKAGE_JSON_VERSION_TEXT';
});
if (!readyArtifacts.length) blockers.push('packageArtifact.artifacts must include at least one MSIX/MSIXUPLOAD/APPXUPLOAD with SHA256 and size.');
if (!currentReadyArtifacts.length) blockers.push(`packageArtifact.artifacts must include a current-version Store package matching ${packageVersion || 'package.json version'}${msixVersion ? ` / ${msixVersion}` : ''}.`);
if (pkg.storePackageCandidateStatus && pkg.storePackageCandidateStatus !== 'CURRENT_STORE_PACKAGE_FOUND') blockers.push(`packageArtifact.storePackageCandidateStatus must be CURRENT_STORE_PACKAGE_FOUND; found ${pkg.storePackageCandidateStatus}.`);
if (typeof pkg.currentVersionArtifactCount === 'number' && pkg.currentVersionArtifactCount < 1) blockers.push('packageArtifact.currentVersionArtifactCount must be at least 1.');
if (pkg.sourceTagReview && pkg.sourceTagReview !== 'MATCHES_PACKAGE_JSON_VERSION') blockers.push(`packageArtifact.sourceTagReview must be MATCHES_PACKAGE_JSON_VERSION; found ${pkg.sourceTagReview}.`);
if (pkg.workingTreeReview && pkg.workingTreeReview !== 'CLEAN_WORKING_TREE') blockers.push(`packageArtifact.workingTreeReview must be CLEAN_WORKING_TREE; found ${pkg.workingTreeReview}.`);

const smoke = evidence.installedSmoke || {};
if (smoke.status !== 'PASS') blockers.push('installedSmoke.status must be PASS.');
if (badPlaceholder(smoke.tester)) blockers.push('installedSmoke.tester is missing.');
if (badPlaceholder(smoke.testedAt)) blockers.push('installedSmoke.testedAt is missing.');
if (!checklistPass(smoke.checklist)) blockers.push('installedSmoke.checklist must contain at least 10 PASS checks.');

const automatedRuntime = evidence.automatedInstalledRuntime || {};
if (automatedRuntime.status === 'PASS') {
  if (badPlaceholder(automatedRuntime.evidencePath)) blockers.push('automatedInstalledRuntime.evidencePath is missing.');
  if (badPlaceholder(automatedRuntime.contractId)) blockers.push('automatedInstalledRuntime.contractId is missing.');
  if (Number(automatedRuntime.scenarioCount) < 10) blockers.push('automatedInstalledRuntime.scenarioCount must prove at least 10 runtime scenarios.');
  if (Number(automatedRuntime.passedScenarioCount) < Number(automatedRuntime.scenarioCount)) blockers.push('automatedInstalledRuntime.passedScenarioCount must cover every runtime scenario.');
  if (!/guest viewport\s+\d+x\d+/i.test(String(automatedRuntime.launchShellDetail || ''))) blockers.push('automatedInstalledRuntime.launchShellDetail must include guest viewport proof.');
  if (!/document bottom\s+\d+px/i.test(String(automatedRuntime.launchShellDetail || ''))) blockers.push('automatedInstalledRuntime.launchShellDetail must include document bottom proof.');
  if (!/does not replace the manual Store installed smoke checklist/i.test(String(automatedRuntime.caveat || ''))) blockers.push('automatedInstalledRuntime.caveat must preserve manual smoke ownership.');
} else if (readySubmissionStatus(evidence.submissionStatus)) {
  blockers.push('automatedInstalledRuntime.status must be PASS before submissionStatus can be READY.');
}

const issues = evidence.knownIssues || {};
if (issues.status !== 'REVIEWED') blockers.push('knownIssues.status must be REVIEWED.');
if (issues.noHiddenBlockers !== true) blockers.push('knownIssues.noHiddenBlockers must be true.');
if (!String(issues.directInstallerSigningTruth || '').includes('unsigned-preview')) blockers.push('knownIssues.directInstallerSigningTruth must preserve unsigned-preview truth for direct MSI/EXE unless signing evidence exists.');

const truth = evidence.releaseTruth || {};
if (!['ready-not-submitted', 'ready-for-partner-center-upload'].includes(truth.storeSubmissionClaim)) blockers.push('releaseTruth.storeSubmissionClaim must be ready-not-submitted or ready-for-partner-center-upload, not submitted/approved.');
if (truth.storeApprovalClaim !== 'not-approved') blockers.push('releaseTruth.storeApprovalClaim must remain not-approved until Microsoft approval exists.');
if (!['unsigned-preview', 'trusted-signed-with-evidence'].includes(truth.directMsiExeSigningStatus)) blockers.push('releaseTruth.directMsiExeSigningStatus must be explicit.');

if (blockers.length) fail(blockers, evidencePath);
console.log('STORE_SUBMISSION_GATE=PASS_READY_NOT_SUBMITTED');
console.log(`STORE_SUBMISSION_EVIDENCE=${rel(evidencePath)}`);
console.log('STORE_SUBMISSION_CLAIM=ready-not-submitted');
console.log('STORE_APPROVAL_CLAIM=not-approved');
console.log(`AUTOMATED_INSTALLED_RUNTIME=${automatedRuntime.status || 'MISSING'}`);
