#!/usr/bin/env node
/* PASS267 hard gate — blocks until real installed Mission Control runtime evidence exists. allFlagshipRecipesStart */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const evidencePath = path.join(root, 'release-candidate', 'runtime', 'pass267-installed-mission-control-brutal-runtime-evidence.json');
const requiredRecipes = ['dns-migration','cloudflare-cutover','github-actions-release','production-deployment','certificate-renewal','m365-user-offboarding','incident-triage','vendor-support-handoff'];
function rel(file) { return path.relative(root, file).replace(/\\/g, '/'); }
function fail(message, details = []) { console.error('PASS267_INSTALLED_MISSION_CONTROL_BRUTAL_RUNTIME_GATE=BLOCKED'); console.error(message); for (const detail of details) console.error('- ' + detail); process.exit(1); }
function parseJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) { fail('Could not parse PASS267 evidence JSON.', [error.message]); } }
if (!fs.existsSync(evidencePath)) fail('Missing real installed Mission Control runtime evidence.', [rel(evidencePath), 'Copy docs/qa/pass267-installed-mission-control-brutal-runtime-evidence.template.json to the release-candidate runtime path and fill it with real installed-app evidence.']);
const evidence = parseJson(evidencePath);
const blockers = [];
if (evidence.pass !== 'PASS267') blockers.push('pass must be PASS267');
if (evidence.versionTarget !== '2.0.14' || evidence.packageVersion !== '2.0.14') blockers.push('versionTarget/packageVersion must both be 2.0.14');
if (evidence.status !== 'REAL_INSTALLED_APP_RUNTIME_EVIDENCE_COMPLETE') blockers.push('status must be REAL_INSTALLED_APP_RUNTIME_EVIDENCE_COMPLETE');
const installed = evidence.installedPackage || {};
for (const key of ['packageInstalledForSmoke','installedAppVersionVisible','launchedFromInstalledShortcut']) if (installed[key] !== true) blockers.push(`installedPackage.${key} must be true`);
if (!/^[a-f0-9]{64}$/i.test(String(installed.packageSha256 || ''))) blockers.push('installedPackage.packageSha256 must be a real SHA256');
const repairs = evidence.priorBlockerRepairs || {};
for (const key of ['pass255WiredIntoPass254RecipeStart','pass259Pass260PrivateKeyFixtureFalsePositiveRepaired','pass264VerifyAliasPresent','sourceVerifyPass255Passed','sourceVerifyPass259Passed','sourceVerifyPass260Passed','sourceVerifyPass264Passed']) if (repairs[key] !== true) blockers.push(`priorBlockerRepairs.${key} must be true`);
if (!Array.isArray(evidence.recipeRuntimeSmoke)) blockers.push('recipeRuntimeSmoke must be an array');
for (const recipe of requiredRecipes) {
  const row = (evidence.recipeRuntimeSmoke || []).find((item) => item.recipeId === recipe);
  if (!row) { blockers.push(`recipeRuntimeSmoke missing ${recipe}`); continue; }
  for (const key of ['started','missionFieldsPopulated','runbookVisible','evidencePromptsVisible','timelineRecipeStartEventPresent','paneHydrationPassed','runtimeTabsMapped','exportPreviewOpened']) if (row[key] !== true) blockers.push(`${recipe}.${key} must be true`);
  if (!row.screenshotPath || String(row.screenshotPath).includes('REPLACE_WITH')) blockers.push(`${recipe}.screenshotPath must point to real evidence`);
}
const layout = evidence.layoutStress || {};
if (Number(layout.cyclesPerRecipe || 0) < 50) blockers.push('layoutStress.cyclesPerRecipe must be at least 50');
for (const key of ['allRecipesCompletedMinimumCycles','focusPaneRestorePassed','activePaneNeverHidden','noOrphanedWebviews','noBlankOrBlackPanes','noBottomOnlyWebviews']) if (layout[key] !== true) blockers.push(`layoutStress.${key} must be true`);
for (const profile of evidence.windowProfileSmoke || []) {
  for (const key of ['tested','missionCardsScrollable','noMissionCardOverlap','websiteBudgetPreserved','overlaysContained']) if (profile[key] !== true) blockers.push(`windowProfileSmoke.${profile.id || 'unknown'}.${key} must be true`);
  if (!profile.screenshotPath || String(profile.screenshotPath).includes('REPLACE_WITH')) blockers.push(`windowProfileSmoke.${profile.id || 'unknown'}.screenshotPath must be real`);
}
const runtime = evidence.runtimeErrors || {};
for (const key of ['noWebViewDomReadyMethodError','noUnhandledRendererError','noUnhandledPromiseRejection','noConsoleNoiseAboveWarningBudget']) if (runtime[key] !== true) blockers.push(`runtimeErrors.${key} must be true`);
const store = evidence.storeTruth || {};
if (store.microsoftStoreSubmissionClaim !== 'not-submitted') blockers.push('Store submission claim must remain not-submitted');
if (store.microsoftStoreApprovalClaim !== 'not-approved') blockers.push('Store approval claim must remain not-approved');
if (store.publicGaClaim !== false) blockers.push('publicGaClaim must remain false');
const approval = evidence.operatorApproval || {};
if (approval.approvedRuntimeHarnessEvidence !== true) blockers.push('operatorApproval.approvedRuntimeHarnessEvidence must be true');
if (approval.approvedToProceedToPass268 !== true) blockers.push('operatorApproval.approvedToProceedToPass268 must be true');
if (approval.approvedForPartnerCenterSubmission === true) blockers.push('PASS267 must not approve Partner Center submission yet');
if (approval.approvedForPublicGA === true) blockers.push('PASS267 must not approve public GA yet');
if ((evidence.goNoGo || {}).readyForPass268 !== true) blockers.push('goNoGo.readyForPass268 must be true');
if ((evidence.goNoGo || {}).readyForPartnerCenterSubmission === true) blockers.push('goNoGo.readyForPartnerCenterSubmission must remain false');
if ((evidence.goNoGo || {}).readyForPublicGA === true) blockers.push('goNoGo.readyForPublicGA must remain false');
if (blockers.length) fail('PASS267 real installed runtime evidence is incomplete or unsafe.', blockers.slice(0, 120));
console.log('PASS267_INSTALLED_MISSION_CONTROL_BRUTAL_RUNTIME_GATE=PASS');
console.log('PASS267_EVIDENCE=' + rel(evidencePath));
console.log('PASS267_VERSION=2.0.14');
console.log('PASS267_RECIPES=' + requiredRecipes.join(','));
console.log('PASS267_NEXT_PASS=PASS268_WebView_DOM_Ready_Lifecycle_Hardening');
