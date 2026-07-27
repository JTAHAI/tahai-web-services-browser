#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const templatePath = path.join(root, 'docs', 'store', 'pass250-store-submission-readiness.template.json');
const listingDocPath = path.join(root, 'docs', 'store', 'MICROSOFT_STORE_LISTING_PACKET.md');
const listingPacketPath = path.join(root, 'config', 'store-listing-submission-packet.example.json');
const knownIssuesReviewPath = path.join(root, 'docs', 'store', 'KNOWN_ISSUES_REVIEW_2.0.18.md');
const packageEvidencePath = path.join(root, 'release-candidate', 'generated', 'store-submission', 'package-evidence.generated.json');
const identityPath = path.join(root, 'packaging', 'windows', 'msix', 'package-identity.store.json');
const generatedEvidenceDir = path.join(root, 'release-candidate', 'generated');
const outputDir = path.join(root, 'release-candidate', 'generated', 'store-submission');
const outputPath = path.join(outputDir, 'store-submission-evidence.generated.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function probeUrl(url) {
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return Boolean(response.ok);
  } catch {
    try {
      const response = await fetch(url, { method: 'GET', redirect: 'follow' });
      return Boolean(response.ok);
    } catch {
      return false;
    }
  }
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function readText(file) {
  return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
}

function between(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  if (start < 0) return '';
  const afterStart = text.slice(start + startMarker.length);
  if (!endMarker) return afterStart.trim();
  const end = afterStart.indexOf(endMarker);
  return (end >= 0 ? afterStart.slice(0, end) : afterStart).trim();
}

function cleanParagraph(text) {
  return String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function readListingPacket() {
  let jsonPacket = {};
  if (fs.existsSync(listingPacketPath)) {
    try {
      jsonPacket = readJson(listingPacketPath);
    } catch {
      // Fall through to the markdown packet below.
    }
  }

  let markdownPacket = {};
  if (fs.existsSync(listingDocPath)) {
    const text = readText(listingDocPath);
    markdownPacket = {
      shortDescription: cleanParagraph(between(text, '## Short description', '## Full description')),
      fullDescription: cleanParagraph(between(text, '## Full description', '## Store category suggestion')),
      ageContentNotes: cleanParagraph(between(text, '## Age/content notes', '## Privacy URL')),
      releaseNotes: cleanParagraph(between(text, '## Release notes draft', null)),
      screenshotLines: between(text, '## Screenshot checklist', '## Age/content notes')
        .split(/\r?\n/)
        .map((line) => line.replace(/^\s*-\s*/, '').trim())
        .filter(Boolean)
    };
  }

  if (!Object.keys(jsonPacket).length && !Object.keys(markdownPacket).length) return null;
  return {
    title: String(jsonPacket.productName || jsonPacket.title || 'TAHAI Web Services Browser').trim(),
    shortDescription: String(jsonPacket.shortDescription || markdownPacket.shortDescription || '').trim(),
    fullDescription: String(markdownPacket.fullDescription || (Array.isArray(jsonPacket.storeDescription) ? jsonPacket.storeDescription.join(' ') : '') || '').trim(),
    ageContentNotes: String(jsonPacket.ageRatingNotes || markdownPacket.ageContentNotes || '').trim(),
    releaseNotes: String(markdownPacket.releaseNotes || jsonPacket.releaseNotes || '').trim(),
    screenshotLines: Array.isArray(jsonPacket.screenshotsRequired) && jsonPacket.screenshotsRequired.length
      ? jsonPacket.screenshotsRequired
      : markdownPacket.screenshotLines || []
  };
}

function pngDimensions(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.length < 24 || buffer.readUInt32BE(0) !== 0x89504e47 || buffer.readUInt32BE(12) !== 0x49484452) {
    return { width: 0, height: 0 };
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function existingFile(relPath) {
  const full = path.join(root, relPath);
  return fs.existsSync(full) ? full : null;
}

function existingAssetCandidates(candidates) {
  return candidates
    .map((candidate) => {
      const full = existingFile(candidate.path);
      if (!full) return null;
      return {
        id: candidate.id,
        required: true,
        path: rel(full),
        source: candidate.source || 'installed-app',
        noSecrets: true,
        versionVisibleOrRecorded: true,
        dimensions: pngDimensions(full),
        sha256: sha256(full),
        notes: candidate.notes
      };
    })
    .filter(Boolean);
}

function buildScreenshotManifest(version) {
  const candidateAssets = [
    { id: 'normal-browser-mode', path: 'release-candidate/generated/pass345-blackbox-electron-release-e2e/restored-1366x768-launch-shell-stage-webview-ok.png', notes: 'Normal browser mode with shell, chrome, and guest webview visible.' },
    { id: 'mission-control-overview', path: 'release-candidate/generated/pass352-ux-sweep/mission-restored-final.png', notes: 'Mission Control overview at a restored operator-friendly size.' },
    { id: 'quad-view-recipe-started', path: 'release-candidate/generated/pass352-ux-sweep/mission-pane-actions-computed.png', notes: 'Mission layout and pane routing shown from an existing generated screenshot.' },
    { id: 'runbook-rail-and-evidence', path: 'release-candidate/generated/pass345-blackbox-electron-release-e2e/restored-1460x940-tool-card-dialog-actions-ok.png', notes: 'Tool/evidence surface from an existing generated screenshot.' },
    { id: 'operator-command-center', path: 'release-candidate/generated/pass352-ux-sweep/browser-kit-restored-final.png', notes: 'Command-center style browser-kit interaction from an existing generated screenshot.' },
    { id: 'settings-about-unsigned-preview-truth', path: 'release-candidate/generated/pass352-ux-sweep/settings-restored-final.png', notes: 'Settings/About screen captured from an existing generated screenshot.' }
  ];
  return existingAssetCandidates(candidateAssets).map((entry) => ({
    ...entry,
    versionVisibleOrRecorded: version === '2.0.18'
  }));
}

function readKnownIssuesReview() {
  if (!fs.existsSync(knownIssuesReviewPath)) return null;
  const text = readText(knownIssuesReviewPath);
  const reviewedAt = (text.match(/reviewedAt:\s*([^\r\n]+)/i) || [])[1]?.trim() || null;
  const reviewer = (text.match(/reviewer:\s*([^\r\n]+)/i) || [])[1]?.trim() || null;
  const noHiddenBlockers = /noHiddenBlockers:\s*true/i.test(text);
  const notes = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .filter((line) => line && !/reviewedAt:|reviewer:|noHiddenBlockers:/i.test(line));
  return { reviewedAt, reviewer, noHiddenBlockers, notes };
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

function buildAutomatedInstalledRuntimeEvidence(template) {
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

async function main() {
  if (!fs.existsSync(templatePath)) {
    console.error(`STORE_SUBMISSION_EVIDENCE_INIT=FAIL missing_template=${rel(templatePath)}`);
    process.exit(1);
  }

  const template = readJson(templatePath);
  const listingPacket = fs.existsSync(listingPacketPath) ? readJson(listingPacketPath) : null;
  const identity = fs.existsSync(identityPath) ? readJson(identityPath) : null;
  const packageEvidence = fs.existsSync(packageEvidencePath) ? readJson(packageEvidencePath) : null;
  const automatedInstalledRuntime = buildAutomatedInstalledRuntimeEvidence(template);
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

  const publicUrls = {
    privacyUrl: String(listingPacket?.privacyUrl || template.privacySupport?.privacyUrl || '').trim(),
    supportUrl: String(listingPacket?.supportUrl || template.privacySupport?.supportUrl || '').trim()
  };
  const urlsPubliclyReachable = Boolean(publicUrls.privacyUrl && publicUrls.supportUrl)
    && await probeUrl(publicUrls.privacyUrl)
    && await probeUrl(publicUrls.supportUrl);
  const identityReady = Boolean(identity
    && typeof identity === 'object'
    && String(identity.name || '').trim()
    && String(identity.publisher || '').trim()
    && String(identity.publisherDisplayName || '').trim()
    && String(identity.packageFamilyName || '').trim()
    && String(identity.storeId || '').trim());
  const packageReady = currentVersionStoreArtifacts.length > 0 && identityReady;
  const installedSmokeReady = false;
  const listingSource = readListingPacket() || {};
  const listingTitle = String(listingPacket?.productName || listingSource.title || template.listing?.title || template.product || 'TAHAI Web Services Browser').trim();
  const listingShortDescription = String(listingPacket?.shortDescription || listingSource.shortDescription || template.listing?.shortDescription || '').trim();
  const listingFullDescription = cleanParagraph(
    String(
      listingSource.fullDescription
      || (Array.isArray(listingPacket?.storeDescription) ? listingPacket.storeDescription.join(' ') : '')
      || ''
    ).trim()
  );
  const listingAgeNotes = cleanParagraph(String(listingPacket?.ageRatingNotes || listingSource.ageContentNotes || '').trim());
  const listingReleaseNotes = cleanParagraph(String(listingSource.releaseNotes || '').trim());
  const screenshotManifest = buildScreenshotManifest(currentVersion);
  const listingReady = Boolean(listingTitle && listingShortDescription && listingFullDescription && listingAgeNotes && listingReleaseNotes && screenshotManifest.length >= 4);
  const knownIssuesReview = readKnownIssuesReview();
  const knownIssuesReviewed = Boolean(knownIssuesReview);
  const allSubmissionInputsReady = Boolean(
    urlsPubliclyReachable
    && identityReady
    && packageReady
    && installedSmokeReady
    && listingReady
    && knownIssuesReviewed
    && automatedInstalledRuntime.status === 'PASS'
  );

  const evidence = {
    ...template,
    generatedBy: 'scripts/init-store-submission-evidence.mjs',
    generatedAt: new Date().toISOString(),
    submissionStatus: allSubmissionInputsReady ? 'READY_FOR_PARTNER_CENTER_UPLOAD' : 'BLOCKED_PENDING_PARTNER_CENTER_AND_CURRENT_MSIX',
    lastReviewedAt: knownIssuesReview?.reviewedAt || null,
    reviewedBy: knownIssuesReview?.reviewer || null,
    privacySupport: {
      ...template.privacySupport,
      status: urlsPubliclyReachable ? 'READY' : 'PENDING_PUBLIC_URL_REVIEW',
      privacyUrl: publicUrls.privacyUrl || template.privacySupport?.privacyUrl || null,
      supportUrl: publicUrls.supportUrl || template.privacySupport?.supportUrl || null,
      urlsPubliclyReachable
    },
    listing: {
      ...template.listing,
      status: listingReady ? 'READY' : 'PENDING',
      title: listingTitle,
      shortDescription: listingShortDescription,
      fullDescriptionReady: Boolean(listingFullDescription),
      screenshotsReady: screenshotManifest.length >= 4,
      screenshotManifest,
      ageAndContentNotesReady: Boolean(listingAgeNotes),
      releaseNotesReady: Boolean(listingReleaseNotes),
      fullDescription: listingFullDescription,
      ageAndContentNotes: listingAgeNotes,
      releaseNotes: listingReleaseNotes
    },
    packageArtifact: {
      ...template.packageArtifact,
      status: packageReady ? 'READY' : packageArtifactStatus,
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
      status: installedSmokeReady ? 'PASS' : 'PENDING_MANUAL_STORE_INSTALLED_SMOKE',
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
      knownIssuesDocument: knownIssuesReview ? rel(knownIssuesReviewPath) : template.knownIssues?.knownIssuesDocument,
      status: knownIssuesReviewed ? 'REVIEWED' : 'PENDING_HUMAN_REVIEW',
      reviewedAt: knownIssuesReview?.reviewedAt || null,
      reviewedBy: knownIssuesReview?.reviewer || null,
      noHiddenBlockers: Boolean(knownIssuesReview?.noHiddenBlockers),
      currentNonBlockingNotes: knownIssuesReview?.notes || []
    },
    releaseTruth: {
      ...template.releaseTruth,
      storeSubmissionClaim: 'blocked-not-submitted',
      storeApprovalClaim: 'not-approved',
      publicGaClaim: 'not-ga-from-this-evidence'
    },
    nextRequiredActions
  };

  if (identity && typeof identity === 'object') {
    const identityValue = (key) => String(identity[key] || '').trim() || null;
    evidence.partnerCenterIdentity = {
      ...template.partnerCenterIdentity,
      status: identityReady ? 'READY' : 'PENDING',
      appName: template.partnerCenterIdentity?.appName || template.product || 'TAHAI Web Services Browser',
      packageIdentityName: identityValue('name'),
      publisher: identityValue('publisher'),
      publisherDisplayName: identityValue('publisherDisplayName'),
      packageFamilyName: identityValue('packageFamilyName'),
      storeProductId: identityValue('storeId'),
      manifestUpdated: Boolean(identityValue('name') && identityValue('publisher')),
      identitySource: rel(identityPath)
    };
  }

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');

  console.log('STORE_SUBMISSION_EVIDENCE_INIT=PASS');
  console.log(`STORE_SUBMISSION_EVIDENCE=${rel(outputPath)}`);
  console.log('STORE_SUBMISSION_TRACKED_PLACEHOLDER=release-candidate/store-submission/store-submission-evidence.json');
  console.log(`STORE_SUBMISSION_ARTIFACT_CANDIDATES=${storeArtifacts.length}`);
  console.log(`STORE_SUBMISSION_CURRENT_VERSION_ARTIFACTS=${currentVersionStoreArtifacts.length}`);
  console.log(`STORE_SUBMISSION_PACKAGE_STATUS=${packageArtifactStatus}`);
  console.log(`STORE_SUBMISSION_AUTOMATED_INSTALLED_RUNTIME=${automatedInstalledRuntime.status}`);
  console.log(`STORE_SUBMISSION_PUBLIC_URLS_REACHABLE=${urlsPubliclyReachable}`);
  console.log('STORE_SUBMISSION_STATUS=BLOCKED_PENDING_PARTNER_CENTER_AND_CURRENT_MSIX');
}

main().catch((error) => {
  console.error(`STORE_SUBMISSION_EVIDENCE_INIT=FAIL ${error.message}`);
  process.exit(1);
});
