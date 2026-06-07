#!/usr/bin/env node
/* PASS268 hard gate — blocks until real WebView DOM-ready lifecycle evidence exists. */
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const evidencePath = path.join(root, 'release-candidate', 'runtime', 'pass268-webview-dom-ready-lifecycle-evidence.json');
function rel(file) { return path.relative(root, file).replace(/\\/g, '/'); }
function fail(message, details = []) { console.error('PASS268_WEBVIEW_DOM_READY_LIFECYCLE_GATE=BLOCKED'); console.error(message); for (const detail of details) console.error('- ' + detail); process.exit(1); }
function parseJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) { fail('Could not parse PASS268 evidence JSON.', [error.message]); } }
if (!fs.existsSync(evidencePath)) fail('Missing real WebView lifecycle evidence.', [rel(evidencePath), 'Copy docs/qa/pass268-webview-dom-ready-lifecycle-evidence.template.json to the release-candidate runtime path and fill it with real installed-app evidence.']);
const evidence = parseJson(evidencePath);
const blockers = [];
if (evidence.pass !== 'PASS268') blockers.push('pass must be PASS268');
if (evidence.versionTarget !== '2.0.14' || evidence.packageVersion !== '2.0.14') blockers.push('versionTarget/packageVersion must both be 2.0.14');
if (evidence.status !== 'REAL_WEBVIEW_DOM_READY_LIFECYCLE_EVIDENCE_COMPLETE') blockers.push('status must be REAL_WEBVIEW_DOM_READY_LIFECYCLE_EVIDENCE_COMPLETE');
const installed = evidence.installedPackage || {};
for (const key of ['packageInstalledForSmoke','installedAppVersionVisible','launchedFromInstalledShortcut']) if (installed[key] !== true) blockers.push(`installedPackage.${key} must be true`);
if (!/^[a-f0-9]{64}$/i.test(String(installed.packageSha256 || ''))) blockers.push('installedPackage.packageSha256 must be a real SHA256');
const proof = evidence.lifecycleGuardProof || {};
for (const key of ['guardInstalledInRenderer','existingWebviewsWrapped','newWebviewsWrappedByMutationObserver','domReadyTracked','removedOrDetachedTracked','renderProcessGoneTracked','safeNoOpBeforeDomReady','safeNoOpAfterDetach','methodExistenceChecked']) if (proof[key] !== true) blockers.push(`lifecycleGuardProof.${key} must be true`);
const methods = evidence.guardedMethodSmoke || [];
for (const method of ['goBack','goForward','reload','focus','loadURL','executeJavaScript','openDevTools']) {
  const row = methods.find((item) => item.method === method);
  if (!row) { blockers.push(`guardedMethodSmoke missing ${method}`); continue; }
  if (row.beforeDomReadyNoOp !== true) blockers.push(`${method}.beforeDomReadyNoOp must be true`);
  if (row.afterDomReadySafe !== true) blockers.push(`${method}.afterDomReadySafe must be true`);
  if (!row.screenshotOrLogPath || String(row.screenshotOrLogPath).includes('REPLACE_WITH')) blockers.push(`${method}.screenshotOrLogPath must be real`);
}
const mission = evidence.missionControlSmoke || {};
for (const key of ['recipesLaunchedWithoutDomReadyError','splitTriQuadFocusSwitchingWithoutDomReadyError','resizeMaximizeRestoreWithoutDomReadyError','activePaneWebviewCommandsGuarded','evidencePreviewDoesNotCallDeadWebview']) if (mission[key] !== true) blockers.push(`missionControlSmoke.${key} must be true`);
if (!mission.screenshotPath || String(mission.screenshotPath).includes('REPLACE_WITH')) blockers.push('missionControlSmoke.screenshotPath must be real');
const runtime = evidence.runtimeErrors || {};
for (const key of ['noWebViewMustBeAttachedDomReadyError','noUnhandledRendererError','noUnhandledPromiseRejection','noConsoleNoiseAboveWarningBudget']) if (runtime[key] !== true) blockers.push(`runtimeErrors.${key} must be true`);
if (!runtime.logPath || String(runtime.logPath).includes('REPLACE_WITH')) blockers.push('runtimeErrors.logPath must be real');
const store = evidence.storeTruth || {};
if (store.microsoftStoreSubmissionClaim !== 'not-submitted') blockers.push('Store submission claim must remain not-submitted');
if (store.microsoftStoreApprovalClaim !== 'not-approved') blockers.push('Store approval claim must remain not-approved');
if (store.publicGaClaim !== false) blockers.push('publicGaClaim must remain false');
const approval = evidence.operatorApproval || {};
if (approval.approvedWebViewLifecycleEvidence !== true) blockers.push('operatorApproval.approvedWebViewLifecycleEvidence must be true');
if (approval.approvedToProceedToPass269 !== true) blockers.push('operatorApproval.approvedToProceedToPass269 must be true');
if (approval.approvedForPartnerCenterSubmission === true) blockers.push('PASS268 must not approve Partner Center submission yet');
if (approval.approvedForPublicGA === true) blockers.push('PASS268 must not approve public GA yet');
if ((evidence.goNoGo || {}).readyForPass269 !== true) blockers.push('goNoGo.readyForPass269 must be true');
if ((evidence.goNoGo || {}).readyForPartnerCenterSubmission === true) blockers.push('goNoGo.readyForPartnerCenterSubmission must remain false');
if ((evidence.goNoGo || {}).readyForPublicGA === true) blockers.push('goNoGo.readyForPublicGA must remain false');
if (blockers.length) fail('PASS268 real WebView lifecycle evidence is incomplete or unsafe.', blockers.slice(0, 120));
console.log('PASS268_WEBVIEW_DOM_READY_LIFECYCLE_GATE=PASS');
console.log('PASS268_EVIDENCE=' + rel(evidencePath));
console.log('PASS268_VERSION=2.0.14');
console.log('PASS268_NEXT_PASS=PASS269_Active_Pane_Routing_Input_Focus_Regression_Closeout');
