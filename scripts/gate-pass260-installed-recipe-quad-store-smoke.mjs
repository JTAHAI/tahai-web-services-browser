#!/usr/bin/env node
/* PASS260 hard gate: real installed Recipe + Quad smoke evidence required before Store submission */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredVersion = '2.0.14';
const requiredRecipes = ['dns-migration','cloudflare-cutover','github-actions-release','production-deployment','certificate-renewal','m365-user-offboarding','incident-triage','vendor-support-handoff'];
const requiredLayoutSequence = ['single','split-horizontal','triple-top','triple-bottom','triple-left','triple-right','quad','focus','quad','single'];
const evidenceCandidates = [
  process.env.PASS260_INSTALLED_SMOKE_EVIDENCE,
  'release-candidate/store-submission/pass260-installed-recipe-quad-smoke-evidence.json'
].filter(Boolean);

function rel(file) { return path.relative(root, file).replace(/\\/g, '/'); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function findEvidence() {
  for (const candidate of evidenceCandidates) {
    const full = path.isAbsolute(candidate) ? candidate : path.join(root, candidate);
    if (fs.existsSync(full)) return full;
  }
  return null;
}
function bad(value) {
  return typeof value !== 'string' || !value.trim() || /REPLACE_WITH|PLACEHOLDER|PENDING|TODO|TBD/i.test(value);
}
function sha256(value) { return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value); }
function passValue(value) { return value === true || value === 'PASS' || (value && value.result === 'PASS'); }
function fail(blockers, evidenceFile = null) {
  console.error('PASS260_INSTALLED_RECIPE_QUAD_STORE_SMOKE_GATE=BLOCKED');
  if (evidenceFile) console.error('PASS260_EVIDENCE=' + rel(evidenceFile));
  for (const blocker of blockers) console.error('- ' + blocker);
  process.exit(1);
}

const evidenceFile = findEvidence();
if (!evidenceFile) {
  fail([
    'Missing real installed-app smoke evidence file.',
    'Create release-candidate/store-submission/pass260-installed-recipe-quad-smoke-evidence.json from docs/store/pass260-installed-recipe-quad-smoke-evidence.template.json.',
    'Do not mark this PASS from source-only checks. It requires installed Windows app smoke.'
  ]);
}

let evidence;
try { evidence = readJson(evidenceFile); } catch (error) { fail(['Evidence JSON could not be parsed: ' + error.message], evidenceFile); }
const blockers = [];

if (evidence.schemaVersion !== 1) blockers.push('schemaVersion must be 1.');
if (evidence.pass !== 'PASS260') blockers.push('pass must be PASS260.');
if (!['PASS','READY_FOR_STORE_PACKAGE_UPLOAD','READY_FOR_PARTNER_CENTER_UPLOAD'].includes(evidence.status)) blockers.push('status must be PASS/READY_FOR_STORE_PACKAGE_UPLOAD/READY_FOR_PARTNER_CENTER_UPLOAD after real smoke.');
if (bad(evidence.testedAt)) blockers.push('testedAt is missing or placeholder.');
if (bad(evidence.tester)) blockers.push('tester is missing or placeholder.');
if (bad(evidence.sourceCommit)) blockers.push('sourceCommit is missing or placeholder.');

const pkg = evidence.packageTruth || {};
if (!['msix','msixupload','msi'].includes(String(pkg.packageType || '').toLowerCase())) blockers.push('packageTruth.packageType must be msix, msixupload, or msi.');
if (bad(pkg.packagePath)) blockers.push('packageTruth.packagePath is missing or placeholder.');
if (!sha256(pkg.packageSha256)) blockers.push('packageTruth.packageSha256 must be a 64-character SHA256 hex value.');
if (Number(pkg.packageSizeBytes) <= 0) blockers.push('packageTruth.packageSizeBytes must be > 0.');
if (pkg.packageInstalledForSmoke !== true) blockers.push('packageTruth.packageInstalledForSmoke must be true.');
if (String(pkg.packageVersion || '') !== requiredVersion) blockers.push('packageTruth.packageVersion must be ' + requiredVersion + '.');

const app = evidence.installedAppTruth || {};
for (const field of ['appLaunchedFromInstall','noRendererBootError','noWebViewDomReadyError','noConsoleUnhandledRejection','windowResizeSmokePassed','evidenceExportPreviewOpened']) {
  if (app[field] !== true) blockers.push('installedAppTruth.' + field + ' must be true.');
}
if (String(app.aboutVersionShows || '') !== requiredVersion) blockers.push('installedAppTruth.aboutVersionShows must be ' + requiredVersion + '.');

const source = evidence.sourceVerification || {};
for (const key of ['verifyPass250','verifyPass251','verifyPass252','verifyPass253','verifyPass254','verifyPass255','verifyPass256','verifyPass257','verifyPass258','verifyPass259','verifyPass260','releaseBlockers']) {
  if (!passValue(source[key])) blockers.push('sourceVerification.' + key + ' must be PASS.');
}

const recipes = Array.isArray(evidence.recipeSmoke) ? evidence.recipeSmoke : [];
if (recipes.length < requiredRecipes.length) blockers.push('recipeSmoke must include all 8 flagship recipes.');
for (const id of requiredRecipes) {
  const recipe = recipes.find((entry) => entry && entry.recipeId === id);
  if (!recipe) { blockers.push('recipeSmoke missing ' + id + '.'); continue; }
  if (!passValue(recipe.result)) blockers.push('recipeSmoke.' + id + '.result must be PASS.');
  for (const boolField of ['selected','started','missionCreated','exportPreview']) {
    if (recipe[boolField] !== true) blockers.push('recipeSmoke.' + id + '.' + boolField + ' must be true.');
  }
  if (Number(recipe.paneCount) < 1) blockers.push('recipeSmoke.' + id + '.paneCount must be > 0.');
}

const stress = evidence.layoutStress || {};
if (!passValue(stress.result)) blockers.push('layoutStress.result must be PASS.');
if (Number(stress.cyclesCompleted) < 50) blockers.push('layoutStress.cyclesCompleted must be at least 50.');
if (JSON.stringify(stress.sequence || []) !== JSON.stringify(requiredLayoutSequence)) blockers.push('layoutStress.sequence must match PASS256/PASS258 stress sequence.');
for (const field of ['smallRestoredPassed','restoredLaptopPassed','maximized1080pPassed']) {
  if (stress[field] !== true) blockers.push('layoutStress.' + field + ' must be true.');
}

const pane = evidence.paneHealth || {};
if (!passValue(pane.result)) blockers.push('paneHealth.result must be PASS.');
for (const field of ['noBlankPanes','noBottomOnlyWebview','noOrphanedWebview','noHiddenActivePane','usefulPlaceholderForEmptyPane','focusRestorePassed','activePaneRoutingPassed']) {
  if (pane[field] !== true) blockers.push('paneHealth.' + field + ' must be true.');
}

const exportPreview = evidence.exportPreview || {};
if (!passValue(exportPreview.result)) blockers.push('exportPreview.result must be PASS.');
for (const field of ['openedForEveryRecipe','redactionPreviewVisible','noSecretsInPreview']) {
  if (exportPreview[field] !== true) blockers.push('exportPreview.' + field + ' must be true.');
}

const truth = evidence.storeTruth || {};
if (!['not-submitted','ready-not-submitted','ready-for-partner-center-upload'].includes(truth.microsoftStoreSubmissionClaim)) blockers.push('storeTruth.microsoftStoreSubmissionClaim must not claim submitted/approved.');
if (truth.microsoftStoreApprovalClaim !== 'not-approved') blockers.push('storeTruth.microsoftStoreApprovalClaim must be not-approved.');
if (!['unsigned-preview','trusted-signed-with-evidence'].includes(truth.directMsiExeSigningStatus)) blockers.push('storeTruth.directMsiExeSigningStatus must be unsigned-preview or trusted-signed-with-evidence.');
if (truth.msixStoreSigningTruthPreserved !== true) blockers.push('storeTruth.msixStoreSigningTruthPreserved must be true.');
if (Array.isArray(evidence.blockers) && evidence.blockers.some((item) => /REPLACE_WITH|PENDING|TODO|BLOCKED/i.test(String(item)))) blockers.push('blockers still contain template/blocking placeholders.');

if (blockers.length) fail(blockers, evidenceFile);
console.log('PASS260_INSTALLED_RECIPE_QUAD_STORE_SMOKE_GATE=PASS_READY_NOT_SUBMITTED');
console.log('PASS260_EVIDENCE=' + rel(evidenceFile));
console.log('PASS260_VERSION=' + requiredVersion);
console.log('PASS260_STORE_SUBMISSION_CLAIM=' + truth.microsoftStoreSubmissionClaim);
console.log('PASS260_STORE_APPROVAL_CLAIM=not-approved');
