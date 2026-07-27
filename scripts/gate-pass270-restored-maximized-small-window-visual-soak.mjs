#!/usr/bin/env node
/* PASS270 fail-closed installed visual soak evidence gate */
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const evidencePath=process.env.PASS270_EVIDENCE || path.join(root,'release-candidate/evidence/pass270-restored-maximized-small-window-visual-soak-evidence.json');
function fail(message, details=[]){ console.error('PASS270_GATE=BLOCKED'); console.error(message); for (const d of details) console.error(`- ${d}`); process.exit(1); }
if (!fs.existsSync(evidencePath)) fail('Real installed PASS270 evidence file is missing.', [`Expected: ${evidencePath}`]);
let evidence;
try { evidence=JSON.parse(fs.readFileSync(evidencePath,'utf8')); } catch { fail('PASS270 evidence file is not valid JSON.'); }
const problems=[];
if (evidence.pass !== 'PASS270') problems.push('pass must equal PASS270');
if (evidence.versionTarget !== '2.0.18') problems.push('versionTarget must equal 2.0.18');
if (evidence.storeSubmission !== 'not-submitted') problems.push('storeSubmission must remain not-submitted');
if (evidence.storeApproval !== 'not-approved') problems.push('storeApproval must remain not-approved');
if (evidence.publicGaClaim !== false) problems.push('publicGaClaim must be false');
if (evidence.signedReleaseClaim !== false) problems.push('signedReleaseClaim must be false');
if (evidence.operatorApproval !== true) problems.push('operatorApproval must be true');
if (!evidence.installedPackage?.version || evidence.installedPackage.version !== '2.0.18') problems.push('installedPackage.version must be 2.0.18');
if (!/^[a-f0-9]{64}$/i.test(String(evidence.installedPackage?.sha256||''))) problems.push('installedPackage.sha256 must be a SHA256 hash');
if (!String(evidence.installedPackage?.sourceCommit||'').trim() || String(evidence.installedPackage?.sourceCommit||'').startsWith('REPLACE_')) problems.push('installedPackage.sourceCommit is required');
const assertions=evidence.requiredAssertions||{};
for (const key of ['noMissionCardOverlap','noHiddenOrClippedRecipeButtons','noUnscrollableCards','noOverlayCollision','noWebsiteContentPaneCollapse','noBlackOrBottomOnlyWebViewPanes','noOrphanedActivePane','noClippedCommandCenterMoreToolsMissionSettingsKb','restoredMaximizedSmall1080pWidePreserveUsefulWebsiteBudget','missionControlRecipesQuadTriSplitFocusUsable','runbookRailEvidencePackCommandCenterUsable','noUnhandledRendererErrors','screenshotsAttached']) {
  if (assertions[key] !== true) problems.push(`requiredAssertions.${key} must be true`);
}
const requiredProfiles=['restored-compact-1280x720','small-laptop-1366x768','1080p-1920x1080','wide-2560x1440','maximized-available-screen'];
const profiles=Array.isArray(evidence.windowProfiles) ? evidence.windowProfiles : [];
for (const profile of requiredProfiles) {
  const row=profiles.find(p=>p.profile===profile);
  if (!row) problems.push(`windowProfiles missing ${profile}`);
  else {
    if (String(row.result||'').toLowerCase() !== 'pass') problems.push(`windowProfiles.${profile}.result must be PASS`);
    if (String(row.usefulWebsiteBudget||'').toLowerCase() === 'pending' || !String(row.usefulWebsiteBudget||'').trim()) problems.push(`windowProfiles.${profile}.usefulWebsiteBudget must be real evidence`);
    if (String(row.screenshot||'').toLowerCase() === 'pending' || !String(row.screenshot||'').trim()) problems.push(`windowProfiles.${profile}.screenshot must be attached/referenced`);
  }
}
const requiredSurfaces=['Mission Control','Mission Recipes','Mission Cards','Split/Tri/Quad/Focus layouts','Webview panes','Runbook Rail','Evidence Pack','Command Center','More Tools','DevOps/IT Tools','Settings','KB/Guide'];
const surfaces=Array.isArray(evidence.surfaceMatrix) ? evidence.surfaceMatrix : [];
for (const surface of requiredSurfaces) {
  const row=surfaces.find(s=>String(s.surface||'').toLowerCase()===surface.toLowerCase());
  if (!row) problems.push(`surfaceMatrix missing ${surface}`);
  else if (String(row.result||'').toLowerCase() !== 'pass') problems.push(`surfaceMatrix.${surface}.result must be PASS`);
}
if (!Array.isArray(evidence.screenshots) || evidence.screenshots.length < requiredProfiles.length) problems.push(`at least ${requiredProfiles.length} screenshots/evidence references are required`);
if (String(evidence.knownIssuesTruth||'').toLowerCase() === 'pending' || !String(evidence.knownIssuesTruth||'').trim()) problems.push('knownIssuesTruth must be filled with real truth, not pending');
const sweep=evidence.rendererErrorSweep||{};
for (const key of ['unhandledErrors','webviewDomReadyErrors','blackPaneOrSliverReports']) {
  if (String(sweep[key]||'').toLowerCase() === 'pending' || !String(sweep[key]||'').trim()) problems.push(`rendererErrorSweep.${key} must be real evidence`);
}
if (problems.length) fail('PASS270 evidence is incomplete or unsafe.', problems);
console.log('PASS270_GATE=PASS');
console.log('PASS270_INSTALLED_VISUAL_SOAK_EVIDENCE=PASS');
console.log('PASS270_STORE_SUBMISSION_STATUS=NOT_SUBMITTED_NOT_APPROVED');
