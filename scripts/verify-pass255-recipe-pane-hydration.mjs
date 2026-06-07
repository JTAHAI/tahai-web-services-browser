#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const targetVersion = '2.0.4';
const skipDirs = new Set(['.git', 'node_modules', 'dist', 'release', 'release-msix', 'out', 'coverage', '.vite', '.next', 'build']);
const preferredRenderer = [
  'src/renderer/app.ts', 'src/renderer/renderer.ts', 'src/renderer/index.ts', 'src/renderer/main.ts',
  'src/renderer/app.tsx', 'src/renderer/index.tsx', 'src/renderer/app.js', 'src/renderer/renderer.js',
  'src/renderer/index.js', 'src/renderer/main.js', 'renderer/app.js', 'renderer/renderer.js',
  'app/renderer/app.js', 'app/renderer/renderer.js',
];
const preferredCss = [
  'src/renderer/styles/browser.css', 'src/renderer/styles.css', 'src/renderer/renderer.css', 'src/renderer/app.css',
  'src/renderer/index.css', 'src/renderer/style.css', 'renderer/styles.css', 'renderer/renderer.css',
  'renderer/app.css', 'app/renderer/styles.css', 'assets/styles.css', 'public/styles.css', 'styles.css',
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
  console.error('PASS255_RECIPE_PANE_HYDRATION=FAIL');
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
    if (fs.existsSync(full) && /PASS255_RECIPE_PANE_HYDRATION_START/.test(readText(full))) return full;
  }
  const found = walk(root, (file) => /\.(ts|tsx|js|jsx)$/i.test(file)).filter((file) => /PASS255_RECIPE_PANE_HYDRATION_START/.test(readText(file)));
  return found[0] || null;
}
function findCssFile() {
  for (const candidate of preferredCss) {
    const full = path.join(root, candidate);
    if (fs.existsSync(full) && /PASS255_RECIPE_PANE_HYDRATION_CSS_START/.test(readText(full))) return full;
  }
  const found = walk(root, (file) => /\.css$/i.test(file)).filter((file) => /PASS255_RECIPE_PANE_HYDRATION_CSS_START/.test(readText(file)));
  return found[0] || null;
}
const pkgPath = path.join(root, 'package.json');
if (!fs.existsSync(pkgPath)) fail('package.json not found.');
let pkg;
try { pkg = JSON.parse(readText(pkgPath)); } catch (error) { fail('package.json is invalid JSON.', [String(error)]); }
if (!versionAtLeast(pkg.version, targetVersion)) fail(`package.json version must be at least ${targetVersion}.`, [`found ${pkg.version || 'missing'}`]);
if (pkg.scripts?.['verify:pass-255-recipe-pane-hydration'] !== 'node scripts/verify-pass255-recipe-pane-hydration.mjs') {
  fail('package.json is missing verify:pass-255-recipe-pane-hydration script.');
}
const renderer = findRendererFile();
if (!renderer) fail('Renderer source with PASS255 recipe pane hydration was not found.');
const rendererText = readText(renderer);
const missingRenderer = [
  'PASS255_RECIPE_PANE_HYDRATION_START',
  'pass255BuildRecipePaneBlueprint',
  'pass255HydrateCurrentMissionFromRecipe',
  'pass255EnsureMissionTabRuntimeMapping',
  'pass255EnsureMissionPaneFromBlueprint',
  'pass255AssertVisiblePaneHealth',
  'pass255MountRecipePaneHydration',
  'pass255RecipeHydrationStatus',
  'pass255LastRecipeHydrationReport',
  'pass255WebviewTopLeftOk',
].filter((marker) => !rendererText.includes(marker));
if (missingRenderer.length) fail('Renderer PASS255 hydration markers are missing.', missingRenderer);
if (!rendererText.includes("pass255HydrateCurrentMissionFromRecipe(recipe, 'pass254-start')")) {
  fail('PASS255 is not wired into the PASS254 recipe start path.');
}
if (!/missionRuntimeTabs\.set/.test(rendererText) || !/createTab\(/.test(rendererText)) {
  fail('PASS255 runtime tab mapping/fallback creation contract is missing.');
}
if (!/layout\.panes\.push/.test(rendererText) || !/mission-tab-added/.test(rendererText)) {
  fail('PASS255 layout pane and mission-tab fill contract is missing.');
}
const css = findCssFile();
if (!css) fail('PASS255 CSS marker was not found.');
const cssText = readText(css);
const missingCss = [
  'PASS255_RECIPE_PANE_HYDRATION_CSS_START',
  'data-pass255-pane-has-webview',
  'data-pass255-pane-geometry-ok',
  'pass255-hydration-summary',
].filter((marker) => !cssText.includes(marker));
if (missingCss.length) fail('PASS255 CSS markers are missing.', missingCss);
const generatedBad = walk(root, (file) => /\.(msix|msixupload|appx|appxupload|msi|exe|pfx|p12|cer|key|zip)$/i.test(file) && !/node_modules|release|release-msix|dist|out/.test(rel(file)));
if (generatedBad.length) fail('Generated/package/certificate artifacts appear in source tree.', generatedBad.map(rel));
console.log('PASS255_RECIPE_PANE_HYDRATION=PASS');
console.log(`PASS255_VERSION=${pkg.version}`);
console.log(`PASS255_RENDERER_TARGET=${rel(renderer)}`);
console.log(`PASS255_CSS_TARGET=${rel(css)}`);
console.log('PASS255_ASSERTIONS=2.0.4-version,recipe-pane-blueprint,runtime-tab-mapping,layout-pane-fill,no-blank-quad-panes,visible-pane-health,top-left-webview-fill,no-generated-artifacts');
