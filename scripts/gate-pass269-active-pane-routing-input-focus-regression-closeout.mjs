#!/usr/bin/env node
/* PASS269 fail-closed installed evidence gate */
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const evidencePath=process.env.PASS269_EVIDENCE || path.join(root,'release-candidate/evidence/pass269-active-pane-routing-input-focus-evidence.json');
function fail(message, details=[]){ console.error('PASS269_GATE=BLOCKED'); console.error(message); for (const d of details) console.error(`- ${d}`); process.exit(1); }
if (!fs.existsSync(evidencePath)) fail('Real installed PASS269 evidence file is missing.', [`Expected: ${evidencePath}`]);
let evidence;
try { evidence=JSON.parse(fs.readFileSync(evidencePath,'utf8')); } catch { fail('PASS269 evidence file is not valid JSON.'); }
const problems=[];
if (evidence.pass !== 'PASS269') problems.push('pass must equal PASS269');
if (evidence.versionTarget !== '2.0.18') problems.push('versionTarget must equal 2.0.18');
if (evidence.storeSubmission !== 'not-submitted') problems.push('storeSubmission must remain not-submitted');
if (evidence.storeApproval !== 'not-approved') problems.push('storeApproval must remain not-approved');
if (evidence.operatorApproval !== true) problems.push('operatorApproval must be true');
if (!evidence.installedPackage?.version || evidence.installedPackage.version !== '2.0.18') problems.push('installedPackage.version must be 2.0.18');
if (!/^[a-f0-9]{64}$/i.test(String(evidence.installedPackage?.sha256||''))) problems.push('installedPackage.sha256 must be a SHA256 hash');
if (!String(evidence.installedPackage?.sourceCommit||'').trim()) problems.push('installedPackage.sourceCommit is required');
const assertions=evidence.requiredAssertions||{};
for (const key of ['exactlyOneRoutingTargetPerInput','noHiddenActivePane','noOrphanRoutingTarget','safeNoopWhenCannotNavigate','focusReturnsAfterOverlayClose','focusPaneRestoresPriorLayout','recipeStartDoesNotReplaceWrongPane','ctrlKDisplaysTargetScope','noUnhandledRendererErrors','noWebViewDomReadyMethodError','screenshotsAttached']) {
  if (assertions[key] !== true) problems.push(`requiredAssertions.${key} must be true`);
}
const matrix=Array.isArray(evidence.routingMatrix) ? evidence.routingMatrix : [];
if (matrix.length < 5) problems.push('routingMatrix must include normal, split, tri, quad, and focus coverage');
for (const row of matrix) if (String(row.result||'').toLowerCase() !== 'pass') problems.push(`routingMatrix row ${row.surface || 'unknown'} must have result PASS`);
if (!Array.isArray(evidence.screenshots) || evidence.screenshots.length < 5) problems.push('at least 5 screenshots/evidence references are required');
if (String(evidence.knownIssuesTruth||'').toLowerCase() === 'pending') problems.push('knownIssuesTruth must be filled with real truth, not pending');
if (problems.length) fail('PASS269 evidence is incomplete or unsafe.', problems);
console.log('PASS269_GATE=PASS');
console.log('PASS269_INSTALLED_ROUTING_FOCUS_EVIDENCE=PASS');
console.log('PASS269_STORE_SUBMISSION_STATUS=NOT_SUBMITTED_NOT_APPROVED');
