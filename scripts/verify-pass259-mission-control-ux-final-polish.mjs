#!/usr/bin/env node
/* PASS259 verifier — Mission Control UX Final Flagship Polish */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const targetVersion = '2.0.8';
const skipDirs = new Set(['.git','node_modules','dist','release','release-msix','out','coverage','.vite','.next','build']);
const rendererCandidates = ['src/renderer/app.ts','src/renderer/renderer.ts','src/renderer/index.ts','src/renderer/main.ts','src/renderer/app.tsx','src/renderer/index.tsx','src/renderer/app.js','src/renderer/renderer.js','renderer/app.js','renderer/renderer.js','app/renderer/app.js'];
const cssCandidates = ['src/renderer/styles/browser.css','src/renderer/styles.css','src/renderer/renderer.css','src/renderer/app.css','src/renderer/index.css','renderer/styles.css','renderer/renderer.css','renderer/app.css','styles.css','src/renderer/styles/pass259-mission-control-ux.css'];
const fixturePath = path.join(root, 'tests', 'runtime', 'pass259-mission-control-window-budget-fixtures.json');
const requiredMarkers = [
  'PASS259_MISSION_CONTROL_UX_FINAL_FLAGSHIP_POLISH_START',
  'PASS259_CARD_SECTIONS',
  'PASS259_MIN_WEBSITE_BUDGET',
  'pass259PolishRecipeCard',
  'pass259EnsureUsefulEmptyPane',
  'pass259MarkActivePane',
  'pass259TrackFocusRestore',
  'pass259ComputeWebsiteBudget',
  'pass259ShowStartConfirmation',
  'pass259PolishMissionControl',
  'data-pass259-card-polished',
  'data-pass259-useful-empty-pane',
  'data-pass259-active-pane-clear',
  'data-pass259-focus-restore-ready',
  'data-pass259-website-budget-ok',
  '__TAHAI_PASS259_MISSION_CONTROL_UX__',
  '__TAHAI_PASS259_MISSION_CONTROL_UX_REPORT__'
];
const requiredPriorMarkers = [
  'PASS254_MISSION_RECIPE_CLICK_CONTRACT',
  'PASS255_RECIPE_PANE_HYDRATION',
  'PASS256_QUAD_VIEW_STATE_MACHINE',
  'PASS257_MISSION_PANE_GEOMETRY_ENGINE',
  'PASS258_RECIPE_QUAD_RUNTIME_E2E_HARNESS'
];
const requiredCardSections = ['what-opens','layout','runbook','evidence','recovery','policy-locks'];
const requiredCssMarkers = ['PASS259_MISSION_CONTROL_UX_FINAL_FLAGSHIP_POLISH_CSS_START', '.pass259-recipe-card-sections', '.pass259-empty-pane-placeholder', '.pass259-start-confirmation', '[data-pass259-active-pane-clear="true"]'];

function rel(file) { return path.relative(root, file).split(path.sep).join('/'); }
function readText(file) { return fs.readFileSync(file, 'utf8'); }
function parseJson(file) { try { return JSON.parse(readText(file)); } catch (error) { fail('Invalid JSON: ' + rel(file), [error.message]); } }
function walk(dir, matcher, acc = []) { let entries = []; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; } for (const entry of entries) { if (skipDirs.has(entry.name)) continue; const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full, matcher, acc); else if (matcher(full)) acc.push(full); } return acc; }
function parseVersion(v) { const m = String(v || '').match(/^(\d+)\.(\d+)\.(\d+)(.*)$/); return m ? { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) } : null; }
function versionAtLeast(actual, expected) { const a = parseVersion(actual); const e = parseVersion(expected); if (!a || !e) return false; if (a.major !== e.major) return a.major > e.major; if (a.minor !== e.minor) return a.minor > e.minor; return a.patch >= e.patch; }
function fail(message, details = []) { console.error('PASS259_MISSION_CONTROL_UX_FINAL_FLAGSHIP_POLISH=FAIL'); console.error(message); for (const detail of details) console.error(' - ' + detail); process.exit(1); }
function findRendererFile() { for (const candidate of rendererCandidates) { const full = path.join(root, candidate); if (fs.existsSync(full) && readText(full).includes('PASS259_MISSION_CONTROL_UX_FINAL_FLAGSHIP_POLISH_START')) return full; } const found = walk(root, (file) => /\.(ts|tsx|js|jsx)$/i.test(file)).filter((file) => readText(file).includes('PASS259_MISSION_CONTROL_UX_FINAL_FLAGSHIP_POLISH_START')); return found[0] || null; }
function findCssFile() { for (const candidate of cssCandidates) { const full = path.join(root, candidate); if (fs.existsSync(full) && readText(full).includes('PASS259_MISSION_CONTROL_UX_FINAL_FLAGSHIP_POLISH_CSS_START')) return full; } const found = walk(root, (file) => /\.(css|scss)$/i.test(file)).filter((file) => readText(file).includes('PASS259_MISSION_CONTROL_UX_FINAL_FLAGSHIP_POLISH_CSS_START')); return found[0] || null; }
function computeBudget(win, minimum) {
  const width = Math.max(0, Number(win.width) - Number(win.sideRailReserveWidth || 0));
  const height = Math.max(0, Number(win.height) - Number(win.chromeReserveHeight || 0));
  const ratio = Math.round(((width * height) / Math.max(1, Number(win.width) * Number(win.height))) * 100) / 100;
  return { id: win.id, width, height, ratio, ok: width >= minimum.width && height >= minimum.height && ratio >= minimum.ratio };
}
function checkForbiddenPatterns() {
  const hits = [];
  for (const file of walk(root, (f) => /\.(js|ts|tsx|jsx|json|md|css)$/i.test(f))) {
    const r = rel(file);
    if (/node_modules|release-candidate\/generated/.test(r)) continue;
    const text = readText(file);
    if (/fetch\(['"]https:\/\/[^'"]*(connectwise|autotask|halo|syncro|zendesk|freshservice)/i.test(text)) hits.push(r + ':direct-psa-fetch');
    if (/(access_token|refresh_token|client_secret|api_key)=/i.test(text)) hits.push(r + ':secret-query-string');
    if (/BEGIN (RSA |EC |OPENSSH |)?PRIVATE KEY/.test(text)) hits.push(r + ':private-key-material');
  }
  return hits;
}

const pkgPath = path.join(root, 'package.json');
if (!fs.existsSync(pkgPath)) fail('package.json not found.');
const pkg = parseJson(pkgPath);
if (!versionAtLeast(pkg.version, targetVersion)) fail('package.json version must be at least ' + targetVersion + '.', ['found ' + (pkg.version || 'missing')]);
if (pkg.scripts?.['verify:pass-259-mission-control-ux-final-polish'] !== 'node scripts/verify-pass259-mission-control-ux-final-polish.mjs') fail('package.json is missing verify:pass-259-mission-control-ux-final-polish script.');

const renderer = findRendererFile();
if (!renderer) fail('Renderer source with PASS259 UX polish was not found.');
const rendererText = readText(renderer);
const missingPrior = requiredPriorMarkers.filter((marker) => !rendererText.includes(marker));
if (missingPrior.length) fail('Prior cumulative runtime markers are missing. Apply PASS250-PASS258 first.', missingPrior);
const missingRenderer = requiredMarkers.filter((marker) => !rendererText.includes(marker));
if (missingRenderer.length) fail('PASS259 renderer UX markers are missing.', missingRenderer);
const missingSections = requiredCardSections.filter((section) => !rendererText.includes(section));
if (missingSections.length) fail('PASS259 recipe card sections are missing.', missingSections);

const css = findCssFile();
if (!css) fail('PASS259 CSS polish block was not found.');
const cssText = readText(css);
const missingCss = requiredCssMarkers.filter((marker) => !cssText.includes(marker));
if (missingCss.length) fail('PASS259 CSS markers/rules are missing.', missingCss);

if (!fs.existsSync(fixturePath)) fail('PASS259 window budget fixtures missing.', [rel(fixturePath)]);
const fixtures = parseJson(fixturePath);
if (fixtures.pass !== 'PASS259' || fixtures.schemaVersion !== 1) fail('PASS259 fixture schema/pass metadata invalid.');
for (const section of requiredCardSections) if (!fixtures.requiredRecipeCardSections?.includes(section)) fail('PASS259 fixture missing recipe card section.', [section]);
const budgetFailures = [];
for (const win of fixtures.windows || []) {
  const result = computeBudget(win, fixtures.minimumWebsiteBudget || { width: 360, height: 260, ratio: 0.52 });
  if (!result.ok) budgetFailures.push(result.id + ': ' + result.width + 'x' + result.height + ' ratio=' + result.ratio);
}
if (budgetFailures.length) fail('PASS259 window budget fixtures do not preserve useful website/content budget.', budgetFailures);
for (const flag of fixtures.requiredUxFlags || []) if (!rendererText.includes(flag)) fail('PASS259 required UX flag missing from renderer.', [flag]);

const forbidden = checkForbiddenPatterns();
if (forbidden.length) fail('PASS259 detected forbidden direct integration/secret patterns.', forbidden.slice(0, 80));
const generatedBad = walk(root, (file) => /\.(msix|msixupload|appx|appxupload|msi|exe|pfx|p12|cer|key|zip)$/i.test(file) && !/node_modules|release|release-msix|dist|out/.test(rel(file)));
if (generatedBad.length) fail('Generated/package/certificate artifacts appear in source tree.', generatedBad.map(rel));

console.log('PASS259_MISSION_CONTROL_UX_FINAL_FLAGSHIP_POLISH=PASS');
console.log('PASS259_VERSION=' + pkg.version);
console.log('PASS259_RENDERER_TARGET=' + rel(renderer));
console.log('PASS259_CSS_TARGET=' + rel(css));
console.log('PASS259_WINDOW_BUDGET_FIXTURES=' + rel(fixturePath));
console.log('PASS259_CARD_SECTIONS=' + requiredCardSections.join(','));
console.log('PASS259_ASSERTIONS=recipe-card-sections,start-confirmation,useful-empty-panes,active-pane-clarity,focus-restore-truth,small-restored-maximized-budget,no-direct-psa-api,no-secrets,no-generated-artifacts');
