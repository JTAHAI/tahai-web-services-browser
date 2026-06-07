#!/usr/bin/env node
/* PASS271 fail-closed release-candidate freeze evidence gate */
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const evidencePath=process.env.PASS271_EVIDENCE || path.join(root,'release-candidate/evidence/pass271-release-candidate-flagship-freeze-evidence.json');
const versionTarget='2.0.14';
function fail(message, details=[]){ console.error('PASS271_GATE=BLOCKED'); console.error(message); for (const d of details) console.error(`- ${d}`); process.exit(1); }
if (!fs.existsSync(evidencePath)) fail('Real PASS271 release-candidate freeze evidence file is missing.', [`Expected: ${evidencePath}`]);
let evidence;
try { evidence=JSON.parse(fs.readFileSync(evidencePath,'utf8')); } catch { fail('PASS271 evidence file is not valid JSON.'); }
const problems=[];
const pending=(v)=> String(v ?? '').trim()==='' || /^PENDING$/i.test(String(v).trim()) || /^REPLACE_/i.test(String(v).trim());
if (evidence.pass !== 'PASS271') problems.push('pass must equal PASS271');
if (evidence.versionTarget !== versionTarget) problems.push(`versionTarget must equal ${versionTarget}`);
if (evidence.storeSubmission !== 'not-submitted') problems.push('storeSubmission must remain not-submitted');
if (evidence.storeApproval !== 'not-approved') problems.push('storeApproval must remain not-approved');
if (evidence.publicGaClaim !== false) problems.push('publicGaClaim must be false');
if (evidence.signedReleaseClaim !== false) problems.push('signedReleaseClaim must be false');
if (evidence.operatorApproval !== true) problems.push('operatorApproval must be true');
if (evidence.releaseManagerApproval !== true) problems.push('releaseManagerApproval must be true');
const rc=evidence.releaseCandidate||{};
if (rc.freezeApproved !== true) problems.push('releaseCandidate.freezeApproved must be true');
if (rc.publicReleaseApproved !== false) problems.push('releaseCandidate.publicReleaseApproved must be false');
if (rc.storeSubmissionApproved !== false) problems.push('releaseCandidate.storeSubmissionApproved must be false');
if (rc.gaApproved !== false) problems.push('releaseCandidate.gaApproved must be false');
if (rc.signedReleaseApproved !== false) problems.push('releaseCandidate.signedReleaseApproved must be false');
const pkg=evidence.installedPackage||{};
if (pkg.version !== versionTarget) problems.push(`installedPackage.version must be ${versionTarget}`);
if (!/^[a-f0-9]{64}$/i.test(String(pkg.sha256||''))) problems.push('installedPackage.sha256 must be a 64-character SHA256 hash');
if (pending(pkg.sourceCommit)) problems.push('installedPackage.sourceCommit is required');
if (pending(pkg.installedAppLaunchProof)) problems.push('installedPackage.installedAppLaunchProof is required');
const requiredPasses=['PASS267','PASS268','PASS269','PASS270','PASS271'];
const chain=Array.isArray(evidence.sourceVerifierChain) ? evidence.sourceVerifierChain : [];
for (const p of requiredPasses) {
  const row=chain.find(x=>x.pass===p);
  if (!row) problems.push(`sourceVerifierChain missing ${p}`);
  else {
    if (String(row.result||'').toUpperCase() !== 'PASS') problems.push(`sourceVerifierChain.${p}.result must be PASS`);
    if (pending(row.evidence)) problems.push(`sourceVerifierChain.${p}.evidence must be real proof, not pending`);
  }
}
const assertions=evidence.requiredRuntimeAssertions||{};
for (const key of ['missionControlLoadsWithoutRuntimeErrors','missionRecipesSelectAndStart','quadTriSplitFocusLayoutsPreserveVisiblePanes','webviewDomReadyQueueHasNoEarlyCommandError','activePaneRoutingTargetsFocusedPane','inputFocusRecoversFromOverlaysAndWebviews','restoredMaximizedSmall1080pWideVisualSoakPasses','commandCenterMoreToolsMissionSettingsKbNotClipped','runbookRailEvidencePackAndExportPreviewPass','installedWindowsSmokeEvidencePresent','noBlackOrBottomOnlyWebviewPanes','noContentPaneSliver','noOrphanedActivePane','noUnhandledRendererErrors','evidenceExportPreviewRedactionPasses','knownIssuesReviewedNoFlagshipReleaseBlocker']) {
  if (assertions[key] !== true) problems.push(`requiredRuntimeAssertions.${key} must be true`);
}
const requiredSurfaces=['Mission Control','Mission Recipes','Mission Cards','Split/Tri/Quad/Focus layouts','WebView panes','Active pane routing','Input/focus recovery','Runbook Rail','Evidence Pack/export','Command Center','More Tools / DevOps / IT Tools','Settings','KB/Guide'];
const surfaces=Array.isArray(evidence.surfaceMatrix) ? evidence.surfaceMatrix : [];
for (const surface of requiredSurfaces) {
  const row=surfaces.find(s=>String(s.surface||'').toLowerCase()===surface.toLowerCase());
  if (!row) problems.push(`surfaceMatrix missing ${surface}`);
  else {
    if (String(row.result||'').toUpperCase() !== 'PASS') problems.push(`surfaceMatrix.${surface}.result must be PASS`);
    if (pending(row.evidence)) problems.push(`surfaceMatrix.${surface}.evidence must be real proof`);
  }
}
const requiredWindows=['restored-compact-1280x720','small-laptop-1366x768','1080p-1920x1080','wide-2560x1440','maximized-available-screen'];
const windows=Array.isArray(evidence.windowEvidence) ? evidence.windowEvidence : [];
for (const profile of requiredWindows) {
  const row=windows.find(w=>w.profile===profile);
  if (!row) problems.push(`windowEvidence missing ${profile}`);
  else {
    if (String(row.result||'').toUpperCase() !== 'PASS') problems.push(`windowEvidence.${profile}.result must be PASS`);
    if (pending(row.screenshot)) problems.push(`windowEvidence.${profile}.screenshot must be real evidence`);
  }
}
const known=evidence.knownIssues||{};
if (known.reviewed !== true) problems.push('knownIssues.reviewed must be true');
if (pending(known.knownIssuesDocument)) problems.push('knownIssues.knownIssuesDocument must reference the reviewed known issues truth');
if (Array.isArray(known.releaseBlockingIssues) && known.releaseBlockingIssues.length > 0) problems.push('knownIssues.releaseBlockingIssues must be empty for the freeze gate');
if (!Array.isArray(evidence.screenshots) || evidence.screenshots.length < requiredWindows.length) problems.push(`at least ${requiredWindows.length} screenshot/evidence references are required`);
const raw=JSON.stringify(evidence);
if (/PENDING|REPLACE_WITH/i.test(raw)) problems.push('evidence still contains PENDING or REPLACE_WITH placeholders');
if (problems.length) fail('PASS271 evidence is incomplete or unsafe for release-candidate freeze.', problems);
console.log('PASS271_GATE=PASS');
console.log('PASS271_RELEASE_CANDIDATE_FLAGSHIP_FREEZE=APPROVED_WITH_EVIDENCE');
console.log('PASS271_PUBLIC_GA=NOT_APPROVED');
console.log('PASS271_STORE_SUBMISSION=NOT_APPROVED_NOT_SUBMITTED');
console.log('PASS271_SIGNED_RELEASE_CLAIM=NOT_APPROVED');
console.log('PASS271_REMAINING_PASSES_AFTER_THIS=0');
