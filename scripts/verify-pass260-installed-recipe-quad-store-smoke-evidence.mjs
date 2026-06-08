#!/usr/bin/env node
/* PASS260 source verifier: verifies the installed Recipe + Quad Store smoke evidence gate is present and fail-closed. */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const targetVersion = '2.0.14';
const fixturePath = path.join(root, 'tests', 'runtime', 'pass260-installed-recipe-quad-smoke-checks.json');
const templatePath = path.join(root, 'docs', 'store', 'pass260-installed-recipe-quad-smoke-evidence.template.json');
const docsPath = path.join(root, 'docs', 'store', 'PASS260-installed-recipe-quad-store-smoke-evidence.md');
const gateScriptPath = path.join(root, 'scripts', 'gate-pass260-installed-recipe-quad-store-smoke.mjs');
const requiredRecipes = ['dns-migration','cloudflare-cutover','github-actions-release','production-deployment','certificate-renewal','m365-user-offboarding','incident-triage','vendor-support-handoff'];
const requiredLayouts = ['single','split-horizontal','triple-top','triple-bottom','triple-left','triple-right','quad','focus','quad','single'];
const requiredEvidenceSections = ['packageTruth','installedAppTruth','sourceVerification','recipeSmoke','layoutStress','paneHealth','exportPreview','storeTruth','blockers'];
const requiredPaneFlags = ['noBlankPanes','noBottomOnlyWebview','noOrphanedWebview','noHiddenActivePane','usefulPlaceholderForEmptyPane','focusRestorePassed','activePaneRoutingPassed'];
const skipDirs = new Set(['.git','node_modules','dist','release','release-msix','out','coverage','.vite','.next','build']);

function rel(file) { return path.relative(root, file).replace(/\\/g, '/'); }
function readText(file) { return fs.readFileSync(file, 'utf8'); }
function parseJson(file) { return JSON.parse(readText(file)); }
function parseVersion(v) { const m = String(v || '0.0.0').match(/^(\d+)\.(\d+)\.(\d+)/); return m ? { major:+m[1], minor:+m[2], patch:+m[3] } : { major:0, minor:0, patch:0 }; }
function versionAtLeast(v, expected) { const a = parseVersion(v), e = parseVersion(expected); if (a.major !== e.major) return a.major > e.major; if (a.minor !== e.minor) return a.minor > e.minor; return a.patch >= e.patch; }
function fail(message, details = []) { console.error('PASS260_INSTALLED_RECIPE_QUAD_STORE_SMOKE_EVIDENCE=FAIL'); console.error(message); for (const detail of details) console.error('- ' + detail); process.exit(1); }
function walk(dir, accept, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, accept, out);
    else if (!accept || accept(full)) out.push(full);
  }
  return out;
}
function checkForbiddenPatterns() {
  const hits = [];
  for (const file of walk(root, (f) => /\.(js|ts|tsx|jsx|json|md|css)$/i.test(f))) {
    const r = rel(file);
    if (/release-candidate\/generated/.test(r)) continue;
    const text = readText(file);
    if (/fetch\(['"]https:\/\/[^'"]*(connectwise|autotask|halo|syncro|zendesk|freshservice)/i.test(text)) hits.push(r + ':direct-psa-fetch');
    if (/(access_token|refresh_token|client_secret|api_key)=/i.test(text)) hits.push(r + ':secret-query-string');
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]{20,}?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) hits.push(r + ':private-key-material');
    if (/microsoftStoreApprovalClaim['"\s:]+['"]approved/i.test(text)) hits.push(r + ':false-store-approval-claim');
  }
  return hits;
}

const pkgPath = path.join(root, 'package.json');
if (!fs.existsSync(pkgPath)) fail('package.json not found.');
const pkg = parseJson(pkgPath);
if (!versionAtLeast(pkg.version, targetVersion)) fail('package.json version must be at least ' + targetVersion + '.', ['found ' + (pkg.version || 'missing')]);
if (pkg.scripts?.['verify:pass-260-installed-recipe-quad-store-smoke-evidence'] !== 'node scripts/verify-pass260-installed-recipe-quad-store-smoke-evidence.mjs') fail('package.json missing verify:pass-260-installed-recipe-quad-store-smoke-evidence script.');
if (pkg.scripts?.['gate:pass-260-installed-recipe-quad-store-smoke'] !== 'node scripts/gate-pass260-installed-recipe-quad-store-smoke.mjs') fail('package.json missing gate:pass-260-installed-recipe-quad-store-smoke script.');

for (const file of [fixturePath, templatePath, docsPath, gateScriptPath]) {
  if (!fs.existsSync(file)) fail('Required PASS260 file missing.', [rel(file)]);
}

const fixture = parseJson(fixturePath);
if (fixture.pass !== 'PASS260' || fixture.schemaVersion !== 1) fail('PASS260 fixture metadata invalid.');
if (fixture.versionTarget !== targetVersion) fail('PASS260 fixture versionTarget mismatch.', [String(fixture.versionTarget)]);
if (fixture.storePosture !== 'BLOCKED_UNTIL_REAL_INSTALLED_RECIPE_QUAD_SMOKE_EVIDENCE') fail('PASS260 fixture must preserve blocked Store posture.');
for (const recipe of requiredRecipes) if (!fixture.requiredRecipes?.includes(recipe)) fail('PASS260 fixture missing required recipe.', [recipe]);
if (JSON.stringify(fixture.requiredLayouts || []) !== JSON.stringify(requiredLayouts)) fail('PASS260 fixture required layout stress sequence mismatch.');
for (const section of requiredEvidenceSections) if (!fixture.requiredEvidenceSections?.includes(section)) fail('PASS260 fixture missing evidence section.', [section]);
for (const flag of requiredPaneFlags) if (!fixture.requiredPaneHealthFlags?.includes(flag)) fail('PASS260 fixture missing pane health flag.', [flag]);
if (fixture.minimumRecipePassCount < requiredRecipes.length) fail('PASS260 fixture minimumRecipePassCount is too low.');
if (fixture.minimumLayoutCycleCount < 50) fail('PASS260 fixture minimumLayoutCycleCount must be at least 50.');

const template = parseJson(templatePath);
if (template.pass !== 'PASS260' || template.schemaVersion !== 1) fail('PASS260 evidence template metadata invalid.');
for (const section of requiredEvidenceSections) if (!(section in template)) fail('PASS260 evidence template missing section.', [section]);
if (!Array.isArray(template.recipeSmoke) || template.recipeSmoke.length < requiredRecipes.length) fail('PASS260 evidence template must include all flagship recipe smoke rows.');
for (const recipe of requiredRecipes) if (!template.recipeSmoke.some((entry) => entry.recipeId === recipe)) fail('PASS260 evidence template missing recipe row.', [recipe]);
if (template.storeTruth?.microsoftStoreApprovalClaim !== 'not-approved') fail('PASS260 template must not claim Store approval.');
if (template.storeTruth?.directMsiExeSigningStatus !== 'unsigned-preview') fail('PASS260 template must preserve unsigned-preview direct MSI/EXE truth.');

const gateText = readText(gateScriptPath);
for (const token of ['PASS260_INSTALLED_RECIPE_QUAD_STORE_SMOKE_GATE=BLOCKED','packageInstalledForSmoke','noBottomOnlyWebview','noOrphanedWebview','noHiddenActivePane','cyclesCompleted','microsoftStoreApprovalClaim','not-approved']) {
  if (!gateText.includes(token)) fail('PASS260 gate script missing fail-closed token.', [token]);
}

const docsText = readText(docsPath);
for (const phrase of ['Blocked by default','installed app','not submitted','not approved','No direct PSA API calls']) {
  if (!docsText.includes(phrase)) fail('PASS260 docs missing required truth language.', [phrase]);
}

const forbidden = checkForbiddenPatterns();
if (forbidden.length) fail('PASS260 detected forbidden direct integration/secret/false-claim patterns.', forbidden.slice(0, 80));
const generatedBad = walk(root, (file) => /\.(msix|msixupload|appx|appxupload|msi|exe|pfx|p12|cer|key|zip)$/i.test(file) && !/node_modules|release|release-msix|dist|out/.test(rel(file)));
if (generatedBad.length) fail('Generated/package/certificate artifacts appear in source tree.', generatedBad.map(rel));

console.log('PASS260_INSTALLED_RECIPE_QUAD_STORE_SMOKE_EVIDENCE=PASS');
console.log('PASS260_VERSION=' + pkg.version);
console.log('PASS260_FIXTURE=' + rel(fixturePath));
console.log('PASS260_TEMPLATE=' + rel(templatePath));
console.log('PASS260_GATE_SCRIPT=' + rel(gateScriptPath));
console.log('PASS260_STORE_SUBMISSION_STATUS=BLOCKED_UNTIL_REAL_INSTALLED_RECIPE_QUAD_SMOKE_EVIDENCE');
console.log('PASS260_ASSERTIONS=source-gate-present,evidence-template-present,8-recipes-required,50-layout-cycles-required,no-bottom-only-webview,no-blank-pane,no-orphaned-webview,no-hidden-active-pane,no-false-store-claim,no-direct-psa-api,no-secrets,no-generated-artifacts');
