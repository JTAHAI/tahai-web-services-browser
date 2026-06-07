#!/usr/bin/env node
/* PASS271 source verifier */
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const versionTarget='2.0.14';
const requiredFiles=[
  'PASS271_README.md',
  'docs/qa/PASS271-release-candidate-flagship-freeze-gate.md',
  'docs/qa/pass271-release-candidate-flagship-freeze-evidence.template.json',
  'tests/runtime/pass271-release-candidate-freeze-required-gates.json',
  'scripts/apply-pass271-release-candidate-flagship-freeze-gate.mjs',
  'scripts/verify-pass271-release-candidate-flagship-freeze-gate.mjs',
  'scripts/gate-pass271-release-candidate-flagship-freeze-gate.mjs'
];
const priorFiles=[
  'scripts/verify-pass267-installed-mission-control-brutal-runtime-harness.mjs',
  'scripts/verify-pass268-webview-dom-ready-lifecycle-hardening.mjs',
  'scripts/verify-pass269-active-pane-routing-input-focus-regression-closeout.mjs',
  'scripts/verify-pass270-restored-maximized-small-window-visual-soak.mjs',
  'scripts/gate-pass267-installed-mission-control-brutal-runtime-harness.mjs',
  'scripts/gate-pass268-webview-dom-ready-lifecycle-hardening.mjs',
  'scripts/gate-pass269-active-pane-routing-input-focus-regression-closeout.mjs',
  'scripts/gate-pass270-restored-maximized-small-window-visual-soak.mjs',
  'docs/qa/PASS267-installed-mission-control-brutal-runtime-harness.md',
  'docs/qa/PASS268-webview-dom-ready-lifecycle-hardening.md',
  'docs/qa/PASS269-active-pane-routing-input-focus-regression-closeout.md',
  'docs/qa/PASS270-restored-maximized-small-window-visual-soak.md'
];
function read(file){ try { return fs.readFileSync(path.join(root,file),'utf8'); } catch { return ''; } }
function exists(file){ return fs.existsSync(path.join(root,file)); }
function fail(message, details=[]){ console.error('PASS271_RELEASE_CANDIDATE_FLAGSHIP_FREEZE_GATE=FAIL'); console.error(message); for (const d of details) console.error(`- ${d}`); process.exit(1); }
const missing=requiredFiles.filter(f=>!exists(f));
if (missing.length) fail('PASS271 missing required files.', missing);
const missingPrior=priorFiles.filter(f=>!exists(f));
if (missingPrior.length) fail('PASS271 cannot freeze because prior PASS267-PASS270 chain files are missing.', missingPrior);
let pkg={};
try { pkg=JSON.parse(read('package.json') || '{}'); } catch { fail('package.json is not valid JSON.'); }
if (pkg.version !== versionTarget) fail(`package.json version must be ${versionTarget}; found ${pkg.version || 'missing'}.`);
const requiredScripts=[
  'verify:pass-267-installed-mission-control-brutal-runtime-harness',
  'verify:pass-268-webview-dom-ready-lifecycle-hardening',
  'verify:pass-269-active-pane-routing-input-focus-regression-closeout',
  'verify:pass-270-restored-maximized-small-window-visual-soak',
  'verify:pass-271-release-candidate-flagship-freeze-gate',
  'gate:pass-271-release-candidate-flagship-freeze-gate'
];
for (const script of requiredScripts) if (!pkg.scripts?.[script]) fail(`Missing package script ${script}. Run the cumulative apply scripts first.`);
let matrix={};
try { matrix=JSON.parse(read('tests/runtime/pass271-release-candidate-freeze-required-gates.json')); } catch { fail('PASS271 required-gates matrix is invalid JSON.'); }
if (matrix.pass !== 'PASS271') fail('PASS271 matrix pass must equal PASS271.');
if (matrix.versionTarget !== versionTarget) fail(`PASS271 matrix versionTarget must equal ${versionTarget}.`);
for (const p of ['PASS267','PASS268','PASS269','PASS270']) if (!matrix.requiredPriorPasses?.includes(p)) fail(`PASS271 matrix missing required prior pass ${p}.`);
for (const cmd of requiredScripts.filter(s=>s.startsWith('verify:')).map(s=>`verify:${s.split('verify:')[1]}`)) {
  if (!matrix.sourceVerifierChain?.includes(cmd)) fail(`PASS271 matrix missing verifier chain command ${cmd}.`);
}
for (const gate of ['mission-control-loads-without-runtime-errors','mission-recipes-select-and-start','quad-tri-split-focus-layouts-preserve-visible-panes','webview-dom-ready-queue-has-no-early-command-error','active-pane-routing-targets-focused-pane','input-focus-recovers-from-overlays-and-webviews','restored-maximized-small-1080p-wide-visual-soak-passes','command-center-more-tools-mission-settings-kb-not-clipped','runbook-rail-evidence-pack-and-export-preview-pass','installed-windows-smoke-evidence-present','no-black-or-bottom-only-webview-panes','no-content-pane-sliver','no-orphaned-active-pane','known-issues-reviewed-no-flagship-release-blocker']) {
  if (!matrix.manualRuntimeGates?.includes(gate)) fail(`PASS271 matrix missing manual runtime gate ${gate}.`);
}
const truth=matrix.releaseTruth||{};
if (truth.microsoftStoreSubmission !== 'not-submitted' || truth.microsoftStoreApproval !== 'not-approved') fail('PASS271 matrix must preserve Microsoft Store not-submitted/not-approved truth.');
if (truth.publicGaClaimAllowed !== false || truth.signedReleaseClaimAllowed !== false || truth.storeSubmissionAllowedByThisPass !== false) fail('PASS271 matrix must block GA/signing/Store-submission claims.');
let template={};
try { template=JSON.parse(read('docs/qa/pass271-release-candidate-flagship-freeze-evidence.template.json')); } catch { fail('PASS271 evidence template is invalid JSON.'); }
if (template.pass !== 'PASS271' || template.versionTarget !== versionTarget) fail('PASS271 evidence template pass/version mismatch.');
if (template.storeSubmission !== 'not-submitted' || template.storeApproval !== 'not-approved') fail('PASS271 evidence template must keep Store posture blocked.');
if (template.publicGaClaim !== false || template.signedReleaseClaim !== false) fail('PASS271 evidence template must keep GA/signing claims false.');
if (template.releaseCandidate?.publicReleaseApproved !== false || template.releaseCandidate?.storeSubmissionApproved !== false || template.releaseCandidate?.gaApproved !== false || template.releaseCandidate?.signedReleaseApproved !== false) fail('PASS271 evidence template must not pre-approve public release, Store submission, GA, or signing.');
const assertionKeys=['missionControlLoadsWithoutRuntimeErrors','missionRecipesSelectAndStart','quadTriSplitFocusLayoutsPreserveVisiblePanes','webviewDomReadyQueueHasNoEarlyCommandError','activePaneRoutingTargetsFocusedPane','inputFocusRecoversFromOverlaysAndWebviews','restoredMaximizedSmall1080pWideVisualSoakPasses','commandCenterMoreToolsMissionSettingsKbNotClipped','runbookRailEvidencePackAndExportPreviewPass','installedWindowsSmokeEvidencePresent','noBlackOrBottomOnlyWebviewPanes','noContentPaneSliver','noOrphanedActivePane','noUnhandledRendererErrors','evidenceExportPreviewRedactionPasses','knownIssuesReviewedNoFlagshipReleaseBlocker'];
for (const key of assertionKeys) if (!(key in (template.requiredRuntimeAssertions||{}))) fail(`PASS271 template missing requiredRuntimeAssertions.${key}.`);
const doc=read('docs/qa/PASS271-release-candidate-flagship-freeze-gate.md');
for (const token of ['No IT Docs backend code','No PSA connector code','No direct PSA API calls','not-submitted','not-approved','no-new-features','Release Candidate']) {
  if (!doc.toLowerCase().includes(token.toLowerCase())) fail(`PASS271 doc missing required truth token: ${token}`);
}
console.log('PASS271_RELEASE_CANDIDATE_FLAGSHIP_FREEZE_GATE=PASS');
console.log(`PASS271_VERSION=${versionTarget}`);
console.log('PASS271_REQUIRED_CHAIN=PASS267,PASS268,PASS269,PASS270,PASS271');
console.log('PASS271_REMAINING_PASSES_AFTER_THIS=0');
console.log('PASS271_STORE_SUBMISSION_STATUS=NOT_SUBMITTED_NOT_APPROVED');
