#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const targetVersion = '2.0.3';
const skipDirs = new Set(['.git', 'node_modules', 'dist', 'release', 'release-msix', 'out', 'coverage', '.vite', '.next', 'build']);
const preferredRenderer = [
  'src/renderer/app.ts',
  'src/renderer/renderer.ts',
  'src/renderer/index.ts',
  'src/renderer/main.ts',
  'src/renderer/app.tsx',
  'src/renderer/index.tsx',
  'src/renderer/app.js',
  'src/renderer/renderer.js',
  'src/renderer/index.js',
  'src/renderer/main.js',
  'renderer/app.js',
  'renderer/renderer.js',
  'app/renderer/app.js',
  'app/renderer/renderer.js',
];
const preferredCss = [
  'src/renderer/styles/browser.css',
  'src/renderer/styles.css',
  'src/renderer/renderer.css',
  'src/renderer/app.css',
  'src/renderer/index.css',
  'src/renderer/style.css',
  'renderer/styles.css',
  'renderer/renderer.css',
  'renderer/app.css',
  'app/renderer/styles.css',
  'assets/styles.css',
  'public/styles.css',
  'styles.css',
];
function rel(p) { return path.relative(root, p).split(path.sep).join('/'); }
function readText(file) { try { return fs.readFileSync(file, 'utf8'); } catch { return ''; } }
function walk(dir, matcher, acc = []) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const entry of entries) {
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, matcher, acc);
    else if (matcher(full)) acc.push(full);
  }
  return acc;
}
function fail(message, details = []) {
  console.error('PASS254_MISSION_RECIPE_CLICK_CONTRACT=FAIL');
  console.error(message);
  for (const detail of details) console.error(`- ${detail}`);
  process.exit(1);
}
function parseVersion(v) {
  const m = String(v || '').match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}
function versionAtLeast(actual, expected) {
  const a = parseVersion(actual); const e = parseVersion(expected);
  if (!a || !e) return false;
  if (a.major !== e.major) return a.major > e.major;
  if (a.minor !== e.minor) return a.minor > e.minor;
  return a.patch >= e.patch;
}
function findRendererFile() {
  for (const candidate of preferredRenderer) {
    const full = path.join(root, candidate);
    if (fs.existsSync(full) && /PASS254_MISSION_RECIPE_CLICK_CONTRACT_START|startMissionFromRecipe|renderMissionRecipes|premiumLaunchRecipes/.test(readText(full))) return full;
  }
  const found = walk(root, (file) => /\.(ts|tsx|js|jsx)$/i.test(file))
    .filter((file) => /PASS254_MISSION_RECIPE_CLICK_CONTRACT_START|startMissionFromRecipe|renderMissionRecipes|premiumLaunchRecipes/.test(readText(file)));
  return found[0] || null;
}
function findCssFile() {
  for (const candidate of preferredCss) {
    const full = path.join(root, candidate);
    if (fs.existsSync(full) && /PASS254_MISSION_RECIPE_CLICK_CONTRACT_CSS_START/.test(readText(full))) return full;
  }
  const found = walk(root, (file) => /\.css$/i.test(file)).filter((file) => /PASS254_MISSION_RECIPE_CLICK_CONTRACT_CSS_START/.test(readText(file)));
  return found[0] || null;
}

const pkgPath = path.join(root, 'package.json');
if (!fs.existsSync(pkgPath)) fail('package.json not found.');
let pkg;
try { pkg = JSON.parse(readText(pkgPath)); } catch (error) { fail('package.json is invalid JSON.', [String(error)]); }
if (!versionAtLeast(pkg.version, targetVersion)) fail(`package.json version must be at least ${targetVersion}.`, [`found ${pkg.version || 'missing'}`]);
if (pkg.scripts?.['verify:pass-254-mission-recipe-click-contract'] !== 'node scripts/verify-pass254-mission-recipe-click-contract.mjs') {
  fail('package.json is missing verify:pass-254-mission-recipe-click-contract script.');
}

const renderer = findRendererFile();
if (!renderer) fail('Renderer source with PASS254 Mission Recipe contract was not found.');
const rendererText = readText(renderer);
const rendererMarkers = [
  'PASS254_MISSION_RECIPE_CLICK_CONTRACT_START',
  'pass254MountMissionRecipeClickContract',
  'pass254AnnotateMissionRecipeCards',
  'pass254SelectMissionRecipe',
  'pass254StartMissionFromRecipe',
  'pass254AssertRecipeHydrated',
  'data-pass254-start-mission-recipe-id',
  'data-pass254-recipe-id',
  'pass254MissionRecipeClickContractMounted',
  'pass254MissionRecipeHydration',
  'pass254MissionRecipeCardsAnnotated',
];
const missingRenderer = rendererMarkers.filter((marker) => !rendererText.includes(marker));
if (missingRenderer.length) fail('Renderer PASS254 contract markers are missing.', missingRenderer);
if (!/addEventListener\('click', pass254HandleMissionRecipeEvent, true\)/.test(rendererText)) fail('Delegated capture-phase recipe click handler is missing.');
if (!/addEventListener\('keydown', pass254HandleMissionRecipeEvent, true\)/.test(rendererText)) fail('Delegated keyboard recipe handler is missing.');
if (!/pass90MountLaunchRecipeFailsafe\(\); pass254MountMissionRecipeClickContract\(\);/.test(rendererText) && !/DOMContentLoaded.*pass254MountMissionRecipeClickContract/s.test(rendererText)) {
  fail('PASS254 mount hook is missing from renderer boot.');
}
if (!/pass254RequiredPaneCount/.test(rendererText) || !/pass254EnsureMissionPaneHydration/.test(rendererText)) fail('Recipe-to-pane hydration repair contract is missing.');

const css = findCssFile();
if (!css) fail('PASS254 CSS marker was not found.');
const cssText = readText(css);
const missingCss = [
  'PASS254_MISSION_RECIPE_CLICK_CONTRACT_CSS_START',
  'pass254-mission-recipe-card',
  'pass254-selected-recipe',
  'pass254-mission-recipe-preview',
  'pass254-preview-lists',
].filter((marker) => !cssText.includes(marker));
if (missingCss.length) fail('PASS254 CSS contract markers are missing.', missingCss);

const generatedBad = walk(root, (file) => /\.(msix|msixupload|appx|appxupload|msi|exe|pfx|p12|cer|key|zip)$/i.test(file) && !/node_modules|release|release-msix|dist|out/.test(rel(file)));
if (generatedBad.length) fail('Generated/package/certificate artifacts appear in source tree.', generatedBad.map(rel));

console.log('PASS254_MISSION_RECIPE_CLICK_CONTRACT=PASS');
console.log(`PASS254_VERSION=${pkg.version}`);
console.log(`PASS254_RENDERER_TARGET=${rel(renderer)}`);
console.log(`PASS254_CSS_TARGET=${rel(css)}`);
console.log('PASS254_ASSERTIONS=2.0.3-version,delegated-recipe-clicks,keyboard-selection,recipe-preview-population,start-mission-hydration,pane-fill-repair,no-generated-artifacts');
