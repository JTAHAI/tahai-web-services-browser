#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const templatePath = path.join(root, 'docs', 'store', 'pass250-store-submission-readiness.template.json');
const packageEvidencePath = path.join(root, 'release-candidate', 'generated', 'store-submission', 'package-evidence.generated.json');
const generatedEvidenceDir = path.join(root, 'release-candidate', 'generated');
const outputDir = path.join(root, 'release-candidate', 'generated', 'store-submission');
const outputPath = path.join(outputDir, 'store-submission-evidence.generated.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function collectRuntimeProofCandidates(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectRuntimeProofCandidates(full, results);
    } else if (
      entry.isFile()
      && /\.json$/i.test(entry.name)
      && /(pass342-installed.*result|pass158.*installed.*result|runtime-e2e.*installed.*result)/i.test(entry.name)
    ) {
      const stat = fs.statSync(full);
      results.push({ full, mtimeMs: stat.mtimeMs });
    }
  }
  return results;
}

function findLatestInstalledRuntimeProof() {
  const candidates = collectRuntimeProofCandidates(generatedEvidenceDir)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  for (const candidate of candidates) {
    try {
      const proof = readJson(candidate.full);
      const result = proof?.result || {};
      const scenarios = Array.isArray(result.results) ? result.results : [];
      const launchShell = scenarios.find((scenario) => scenario?.id === 'launch-shell');
      if (result.ok === true && launchShell?.ok === true) {
        return { path: candidate.full, proof, result, scenarios, launchShell };
      }
    } catch {
      // Ignore malformed generated diagnostics and keep looking for usable proof.
    }
  }
  return null;
}

function buildAutomatedInstalledRuntimeEvidence() {
  const latest = findLatestInstalledRuntimeProof();
  if (!latest) {
    return {
      ...template.automatedInstalledRuntime,
      status: 'PENDING_NO_AUTOMATED_INSTALLED_RUNTIME_PROOF',
      caveat: 'Automated installed runtime E2E proof is supportive only; it does not replace the manual Store installed smoke checklist.'
    };
  }

  const passedScenarioCount = latest.scenarios.filter((scenario) => scenario?.ok === true).length;
  const launchShellDetail = String(latest.launchShell?.detail || '');
  const documentBottomProof = launchShellDetail.match(/document bottom\s+\d+px/i)?.[0] || null;
  const guestViewportProof = launchShellDetail.match(/guest viewport\s+\d+x\d+/i)?.[0] || null;

  return {
    ...template.automatedInstalledRuntime,
    status: 'PASS',
    evidencePath: rel(latest.path),
    pass: latest.proof?.pass || latest.result?.pass || null,
    contractId: latest.result?.contractId || null,
    startedAt: latest.proof?.startedAt || null,
    finishedAt: latest.proof?.finishedAt || null,
    scenarioCount: Number(latest.result?.scenarioCount || latest.scenarios.length),
    passedScenarioCount,
    launchShellDetail,
    documentBottomProof,
    guestViewportProof,
    caveat: 'Automated installed runtime E2E proof is supportive only; it does not replace the manual Store installed smoke checklist.'
  };
}

if (!fs.existsSync(templatePath)) {
  console.error(`STORE_SUBMISSION_EVIDENCE_INIT=FAIL missing_template=${rel(templatePath)}`);
  process.exit(1);
}

const template = readJson(templatePath);
const packageEvidence = fs.existsSync(packageEvidencePath) ? readJson(packageEvidencePath) : null;
const automatedInstalledRuntime = buildAutomatedInstalledRuntimeEvidence();
const storeArtifacts = Array.isArray(packageEvidence?.artifacts)
  ? packageEvidence.artifacts.filter((artifact) => /\.(msix|msixupload|appxupload)$/i.test(String(artifact?.path || '')))
  : [];
const currentVersion = String(packageEvidence?.version || template.version || '').trim();
const currentMsixVersion = packageEvidence?.msixVersion || (currentVersion ? `${currentVersion}.0` : null);
function isCurrentArtifact(artifact) {
  const haystack = `${artifact?.fileName || ''} ${artifact?.path || ''}`;
  return Boolean(currentVersion && haystack.includes(currentVersion)) || Boolean(currentMsixVersion && haystack.includes(currentMsixVersion));
}
const currentVersionStoreArtifacts = Array.isArray(packageEvidence?.currentVersionArtifactCandidates)
  ? packageEvidence.currentVersionArtifactCandidates
  : storeArtifacts.filter(isCurrentArtifact);
const legacyStoreArtifacts = Array.isArray(packageEvidence?.legacyVersionArtifactCandidates)
  ? packageEvidence.legacyVersionArtifactCandidates
  : storeArtifacts.filter((artifact) => !isCurrentArtifact(artifact));
const storePackageCandidateStatus = packageEvidence?.storePackageCandidateStatus
  || (currentVersionStoreArtifacts.length ? 'CURRENT_STORE_PACKAGE_FOUND' : storeArtifacts.length ? 'LEGACY_STORE_PACKAGE_ONLY' : 'NO_STORE_PACKAGE_ARTIFACT_FOUND');
const packageArtifactStatus = currentVersionStoreArtifacts.length
  ? 'PENDING_CURRENT_STORE_PACKAGE_REVIEW'
  : storeArtifacts.length
    ? 'BLOCKED_LEGACY_STORE_PACKAGE_ONLY'
    : 'BLOCKED_NO_STORE_PACKAGE_ARTIFACT';
const readinessNote = currentVersionStoreArtifacts.length
  ? 'Current-version Store package artifact candidates were found, but Partner Center identity, signing/namespace trust, installed smoke evidence, and final human review are still required.'
    : storeArtifacts.length
    ? `Only legacy Store package artifacts were found. Build a current ${currentVersion}/${currentMsixVersion} MSIX/MSIXUPLOAD package and rerun npm run store:evidence:capture.`
    : 'No MSIX/MSIXUPLOAD/APPXUPLOAD artifact candidate was found. Build the current Store package and rerun npm run store:evidence:capture.';
const nextRequiredActions = [
  'Create or link the Microsoft Partner Center account and reserve/confirm the app identity.',
  'Update config/msix-manifest.template.xml with the real Partner Center package identity.',
  currentVersionStoreArtifacts.length
    ? `Review the current ${currentVersion}/${currentMsixVersion} MSIX/MSIXUPLOAD artifact, then rebuild from the final clean commit/tag before upload.`
    : `Build a current ${currentVersion}/${currentMsixVersion} MSIX/MSIXUPLOAD package and rerun npm run store:evidence:capture.`,
  'Complete installed smoke on the packaged app and replace PENDING checklist values with PASS only after manual verification.',
  'Confirm public privacy/support URLs and listing screenshot manifest.',
  'Review known issues and release truth before changing submissionStatus to READY_FOR_PARTNER_CENTER_UPLOAD.'
];
if (packageEvidence?.sourceTagReview && packageEvidence.sourceTagReview !== 'MATCHES_PACKAGE_JSON_VERSION') {
  nextRequiredActions.splice(3, 0, `Fix source provenance: current package evidence has sourceTagReview=${packageEvidence.sourceTagReview}.`);
}
if (packageEvidence?.workingTreeReview && packageEvidence.workingTreeReview !== 'CLEAN_WORKING_TREE') {
  nextRequiredActions.splice(3, 0, `Fix source provenance: current package evidence has workingTreeReview=${packageEvidence.workingTreeReview}.`);
}

const evidence = {
  ...template,
  generatedBy: 'scripts/init-store-submission-evidence.mjs',
  generatedAt: new Date().toISOString(),
  submissionStatus: 'BLOCKED_PENDING_PARTNER_CENTER_AND_CURRENT_MSIX',
  lastReviewedAt: null,
  reviewedBy: null,
  packageArtifact: {
    ...template.packageArtifact,
    status: packageArtifactStatus,
    sourceCommit: packageEvidence?.sourceCommit || template.packageArtifact?.sourceCommit || 'PENDING_CURRENT_SOURCE_COMMIT',
    sourceTag: packageEvidence?.sourceTag || template.packageArtifact?.sourceTag || null,
    sourceTagReview: packageEvidence?.sourceTagReview || null,
    workingTreeStatus: packageEvidence?.workingTreeStatus || null,
    workingTreeReview: packageEvidence?.workingTreeReview || null,
    packageEvidencePath: packageEvidence ? rel(packageEvidencePath) : null,
    packageEvidenceGeneratedAt: packageEvidence?.generatedAt || null,
    version: currentVersion || null,
    msixVersion: currentMsixVersion,
    storePackageCandidateStatus,
    artifactCount: storeArtifacts.length,
    currentVersionArtifactCount: currentVersionStoreArtifacts.length,
    legacyStoreArtifactCount: legacyStoreArtifacts.length,
    artifacts: storeArtifacts.map((artifact) => ({
      path: artifact.path,
      fileName: artifact.fileName,
      extension: artifact.extension,
      sizeBytes: artifact.sizeBytes,
      sha256: artifact.sha256,
      lastModified: artifact.lastModified,
      reviewRequired: true,
      currentVersionReview: isCurrentArtifact(artifact)
        ? 'MATCHES_PACKAGE_JSON_VERSION_TEXT'
        : 'REVIEW_VERSION_MISMATCH_OR_LEGACY_ARTIFACT'
    })),
    readinessNote
  },
  installedSmoke: {
    ...template.installedSmoke,
    status: 'PENDING',
    packageType: currentVersionStoreArtifacts.length ? 'MSIX_REVIEW_REQUIRED' : null,
    checklist: {
      appLaunches: 'PENDING',
      normalBrowsingVisible: 'PENDING',
      toolbarButtonsClickable: 'PENDING',
      addressBarNavigation: 'PENDING',
      launchpadGuideTools: 'PENDING',
      missionControlLayouts: 'PENDING',
      settingsProfiles: 'PENDING',
      evidenceRedaction: 'PENDING',
      noSecretsCaptured: 'PENDING',
      uninstallOrReset: 'PENDING'
    }
  },
  automatedInstalledRuntime,
  knownIssues: {
    ...template.knownIssues,
    status: 'PENDING_HUMAN_REVIEW',
    noHiddenBlockers: false
  },
  releaseTruth: {
    ...template.releaseTruth,
    storeSubmissionClaim: 'blocked-not-submitted',
    storeApprovalClaim: 'not-approved',
    publicGaClaim: 'not-ga-from-this-evidence'
  },
  nextRequiredActions
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');

console.log('STORE_SUBMISSION_EVIDENCE_INIT=PASS');
console.log(`STORE_SUBMISSION_EVIDENCE=${rel(outputPath)}`);
console.log('STORE_SUBMISSION_TRACKED_PLACEHOLDER=release-candidate/store-submission/store-submission-evidence.json');
console.log(`STORE_SUBMISSION_ARTIFACT_CANDIDATES=${storeArtifacts.length}`);
console.log(`STORE_SUBMISSION_CURRENT_VERSION_ARTIFACTS=${currentVersionStoreArtifacts.length}`);
console.log(`STORE_SUBMISSION_PACKAGE_STATUS=${packageArtifactStatus}`);
console.log(`STORE_SUBMISSION_AUTOMATED_INSTALLED_RUNTIME=${automatedInstalledRuntime.status}`);
console.log('STORE_SUBMISSION_STATUS=BLOCKED_PENDING_PARTNER_CENTER_AND_CURRENT_MSIX');
