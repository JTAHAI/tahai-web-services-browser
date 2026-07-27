#!/usr/bin/env node
/* PASS267 source verifier — installed Mission Control brutal runtime harness */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pass = 'PASS267';
const versionTarget = '2.0.18';
const remainingPassesAfterThisPass = 4;
const fixturePath = path.join(root, 'tests', 'runtime', 'pass267-installed-mission-control-brutal-runtime-matrix.json');
const templatePath = path.join(root, 'docs', 'qa', 'pass267-installed-mission-control-brutal-runtime-evidence.template.json');
const docsPath = path.join(root, 'docs', 'qa', 'PASS267-installed-mission-control-brutal-runtime-harness.md');
const gatePath = path.join(root, 'scripts', 'gate-pass267-installed-mission-control-brutal-runtime-harness.mjs');
const requiredRecipes = ['dns-migration','cloudflare-cutover','github-actions-release','production-deployment','certificate-renewal','m365-user-offboarding','incident-triage','vendor-support-handoff'];
const requiredLayouts = ['single','split-horizontal','triple-top','triple-bottom','triple-left','triple-right','quad','focus','quad','single'];
const skipDirs = new Set(['.git','node_modules','dist','release','release-msix','out','coverage','.vite','.next','build']);
function rel(file) { return path.relative(root, file).replace(/\\/g, '/'); }
function read(file) { return fs.readFileSync(file, 'utf8'); }
function parseJson(file) { try { return JSON.parse(read(file)); } catch (error) { fail('Invalid JSON: ' + rel(file), [error.message]); } }
function walk(dir, accept, out = []) { if (!fs.existsSync(dir)) return out; for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { if (skipDirs.has(entry.name)) continue; const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full, accept, out); else if (!accept || accept(full)) out.push(full); } return out; }
function fail(message, details = []) { console.error('PASS267_INSTALLED_MISSION_CONTROL_BRUTAL_RUNTIME_HARNESS=FAIL'); console.error(message); for (const detail of details) console.error('- ' + detail); process.exit(1); }
function parseVersion(v) { const m = String(v || '').match(/^(\d+)\.(\d+)\.(\d+)/); return m ? { major:+m[1], minor:+m[2], patch:+m[3] } : null; }
function versionAtLeast(actual, expected) { const a = parseVersion(actual); const e = parseVersion(expected); if (!a || !e) return false; if (a.major !== e.major) return a.major > e.major; if (a.minor !== e.minor) return a.minor > e.minor; return a.patch >= e.patch; }
function findRenderer() { const candidates = ['src/renderer/app.ts','src/renderer/renderer.ts','src/renderer/index.ts','src/renderer/main.ts','src/renderer/app.tsx','src/renderer/index.tsx','src/renderer/app.js','src/renderer/renderer.js','renderer/app.js','renderer/renderer.js','app/renderer/app.js']; for (const c of candidates) { const p = path.join(root, c); if (fs.existsSync(p) && /PASS255_RECIPE_PANE_HYDRATION|PASS267_PASS255_START_PATH_REPAIR/.test(read(p))) return p; } const found = walk(root, (f) => /\.(ts|tsx|js|jsx)$/i.test(f)).filter((f) => /PASS255_RECIPE_PANE_HYDRATION|PASS267_PASS255_START_PATH_REPAIR/.test(read(f))); return found[0] || null; }
function sourcePrivateKeyHits() { const hits = []; for (const file of walk(path.join(root, 'src'), (f) => /\.(js|ts|tsx|jsx|json|md|css)$/i.test(f))) { const text = read(file); if (/BEGIN (RSA |EC |OPENSSH |)?PRIVATE KEY/.test(text)) hits.push(rel(file) + ':private-key-material'); } return hits; }

const pkgPath = path.join(root, 'package.json');
if (!fs.existsSync(pkgPath)) fail('package.json not found.');
const pkg = parseJson(pkgPath);
if (!versionAtLeast(pkg.version, versionTarget)) fail('package.json version must be at least ' + versionTarget + '.', ['found ' + (pkg.version || 'missing')]);
const expectedScripts = {
  'verify:pass-267-installed-mission-control-brutal-runtime-harness': 'node scripts/verify-pass267-installed-mission-control-brutal-runtime-harness.mjs',
  'gate:pass-267-installed-mission-control-brutal-runtime-harness': 'node scripts/gate-pass267-installed-mission-control-brutal-runtime-harness.mjs',
  'verify:pass-264-store-submission-dry-run-evidence-gate': 'node scripts/verify-pass264-store-submission-dry-run-evidence-gate.mjs',
  'verify:pass-264-store-submission-dry-run-evidence': 'node scripts/verify-pass264-store-submission-dry-run-evidence-gate.mjs'
};
for (const [name, value] of Object.entries(expectedScripts)) {
  if (pkg.scripts?.[name] !== value) fail('package.json script mismatch.', [`${name} expected ${value}`]);
}
for (const file of [fixturePath, templatePath, docsPath, gatePath]) if (!fs.existsSync(file)) fail('Required PASS267 file missing.', [rel(file)]);
const fixture = parseJson(fixturePath);
if (fixture.pass !== pass || fixture.schemaVersion !== 1 || fixture.versionTarget !== versionTarget) fail('PASS267 runtime matrix metadata invalid.');
if (fixture.remainingPassesAfterThisPass !== remainingPassesAfterThisPass) fail('PASS267 remaining pass count mismatch in fixture.');
for (const recipe of requiredRecipes) if (!fixture.requiredRecipes?.includes(recipe)) fail('PASS267 fixture missing flagship recipe.', [recipe]);
if (JSON.stringify(fixture.requiredLayoutSequence || []) !== JSON.stringify(requiredLayouts)) fail('PASS267 layout stress sequence mismatch.');
if (fixture.minimumLayoutCyclesPerRecipe < 50) fail('PASS267 minimum layout cycles must be at least 50.');
for (const assertion of ['packageInstalledForSmoke','allFlagshipRecipesStart','noBottomOnlyWebview','noOrphanedWebview','noHiddenActivePane','noWebViewDomReadyMethodError','exportPreviewOpened']) {
  if (!fixture.requiredInstalledAppAssertions?.includes(assertion)) fail('PASS267 fixture missing installed-app assertion.', [assertion]);
}
const template = parseJson(templatePath);
if (template.pass !== pass || template.schemaVersion !== 1 || template.versionTarget !== versionTarget) fail('PASS267 evidence template metadata invalid.');
if (!Array.isArray(template.recipeRuntimeSmoke) || template.recipeRuntimeSmoke.length < requiredRecipes.length) fail('PASS267 evidence template must include every flagship recipe.');
for (const recipe of requiredRecipes) if (!template.recipeRuntimeSmoke.some((row) => row.recipeId === recipe)) fail('PASS267 evidence template missing recipe row.', [recipe]);
if (template.storeTruth?.microsoftStoreSubmissionClaim !== 'not-submitted' || template.storeTruth?.microsoftStoreApprovalClaim !== 'not-approved') fail('PASS267 template must preserve Store not-submitted/not-approved truth.');
const gateText = read(gatePath);
for (const token of ['PASS267_INSTALLED_MISSION_CONTROL_BRUTAL_RUNTIME_GATE=BLOCKED','noWebViewDomReadyMethodError','allFlagshipRecipesStart','cyclesPerRecipe','microsoftStoreApprovalClaim','not-approved']) if (!gateText.includes(token)) fail('PASS267 gate missing fail-closed token.', [token]);
const renderer = findRenderer();
if (!renderer) fail('Renderer source with PASS255/PASS267 wiring was not found. Apply PASS254/PASS255/PASS267 first.');
const rendererText = read(renderer);
if (!rendererText.includes("pass255HydrateCurrentMissionFromRecipe(recipe, 'pass254-start')")) fail('PASS255 hydration is still not wired into PASS254 recipe start path.', [rel(renderer)]);
const privateKeyHits = sourcePrivateKeyHits();
if (privateKeyHits.length) fail('Source still contains literal private-key fixture material that trips PASS259/PASS260.', privateKeyHits.slice(0, 80));
const generatedBad = walk(root, (file) => /\.(msix|msixupload|appx|appxupload|msi|exe|pfx|p12|cer|key|zip)$/i.test(file) && !/node_modules|release|release-msix|dist|out/.test(rel(file)));
if (generatedBad.length) fail('Generated/package/certificate artifacts appear in source tree.', generatedBad.map(rel));
console.log('PASS267_INSTALLED_MISSION_CONTROL_BRUTAL_RUNTIME_HARNESS=PASS');
console.log('PASS267_VERSION=' + pkg.version);
console.log('PASS267_REMAINING_PASSES_AFTER_THIS=' + remainingPassesAfterThisPass);
console.log('PASS267_FIXTURE=' + rel(fixturePath));
console.log('PASS267_TEMPLATE=' + rel(templatePath));
console.log('PASS267_RENDERER_TARGET=' + rel(renderer));
console.log('PASS267_STORE_SUBMISSION_STATUS=NOT_SUBMITTED_NOT_APPROVED');
console.log('PASS267_ASSERTIONS=pass255-start-path-repaired,pass264-verify-alias-present,private-key-fixture-false-positive-repaired,8-recipes,50-layout-cycles,installed-runtime-evidence-template,no-webview-domready-error-required,no-store-claim,no-generated-artifacts');
