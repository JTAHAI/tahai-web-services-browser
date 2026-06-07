#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const skipDirs = new Set(['.git', 'node_modules', 'dist', 'release', 'release-msix', 'out', 'coverage', '.vite', '.next', 'build']);
const cssMarker = 'PASS252_MISSION_MULTIVIEW_STATE_HARDENING_START';
const jsMarker = 'PASS252_MISSION_MULTIVIEW_STATE_GUARD_START';
const targetVersion = '2.0.1';

function fail(message, details = []) {
  console.error('PASS252_MISSION_MULTIVIEW_STATE_HARDENING=FAIL');
  console.error(message);
  for (const d of details) console.error(`- ${d}`);
  process.exit(1);
}
function rel(p) { return path.relative(root, p).split(path.sep).join('/'); }
function read(file) { try { return fs.readFileSync(file, 'utf8'); } catch { return ''; } }
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
function parseVersion(v) {
  const m = String(v || '').match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}
function versionAtLeast(actual, minimum) {
  const a = parseVersion(actual); const b = parseVersion(minimum);
  if (!a || !b) return false;
  return a.major > b.major || (a.major === b.major && (a.minor > b.minor || (a.minor === b.minor && a.patch >= b.patch)));
}

const pkgPath = path.join(root, 'package.json');
if (!fs.existsSync(pkgPath)) fail('package.json not found. Run from repo root.');
let pkg;
try { pkg = JSON.parse(read(pkgPath)); } catch { fail('package.json is not valid JSON.'); }
if (!pkg.version || !String(pkg.version).startsWith('2.0.')) fail('package.json version is not in the 2.0.x lane.', [`version=${pkg.version}`]);
if (!versionAtLeast(pkg.version, targetVersion)) fail('package.json version was not incremented to at least 2.0.1.', [`version=${pkg.version}`]);
if (pkg.scripts?.['verify:pass-252-mission-multiview-state-hardening'] !== 'node scripts/verify-pass252-mission-multiview-state-hardening.mjs') {
  fail('PASS252 package script is missing. Run node scripts/apply-pass252-mission-multiview-state-hardening.mjs first.');
}

for (const lock of ['package-lock.json', 'npm-shrinkwrap.json']) {
  const lockPath = path.join(root, lock);
  if (!fs.existsSync(lockPath)) continue;
  let json;
  try { json = JSON.parse(read(lockPath)); } catch { fail(`${lock} is not valid JSON.`); }
  const lockVersion = json.packages?.['']?.version || json.version;
  if (lockVersion && !versionAtLeast(lockVersion, targetVersion)) {
    fail(`${lock} root version is stale.`, [`version=${lockVersion}`]);
  }
}

const cssFiles = walk(root, f => f.endsWith('.css'));
const cssTargets = cssFiles.filter(f => read(f).includes(cssMarker));
if (!cssTargets.length) fail('PASS252 CSS marker not found in a source stylesheet.');
const css = read(cssTargets[0]);
const requiredCss = [
  'data-mission-layout="single"',
  'data-mission-layout="split"',
  'data-mission-layout="triple"',
  'data-mission-layout="quad"',
  'data-mission-layout="focus"',
  'grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)',
  'pointer-events: auto',
  'pass252-mission-pane-managed',
  'min-height: var(--pass252-pane-min-height)',
];
const missingCss = requiredCss.filter(token => !css.includes(token));
if (missingCss.length) fail('PASS252 CSS state hardening patch is present but incomplete.', missingCss);

const codeFiles = walk(root, f => /\.(js|jsx|ts|tsx)$/i.test(f) && !/scripts[\\/]/.test(rel(f)));
const jsTargets = codeFiles.filter(f => read(f).includes(jsMarker));
if (!jsTargets.length) fail('PASS252 renderer state guard marker not found in renderer source.');
const js = read(jsTargets[0]);
const requiredJs = [
  'MutationObserver',
  'data-mission-layout',
  'data-pass252-pane-count',
  'data-pass252-pane-index',
  'scheduleMissionViewRepair',
  'pass252-mission-layout-normalized',
  "window.dispatchEvent(new Event('resize'))",
  "['1', '2', '3', '4', 'q', 's', 'f']",
  'is-switching',
  'route-pending',
];
const missingJs = requiredJs.filter(token => !js.includes(token));
if (missingJs.length) fail('PASS252 renderer state guard is present but incomplete.', missingJs);

const generatedBad = walk(root, f => /\.(msix|msixupload|appx|appxupload|msi|exe|pfx|p12|cer|key|zip)$/i.test(f) && !/node_modules|release|release-msix|dist|out/.test(rel(f)));
if (generatedBad.length) fail('Generated/package/certificate artifacts appear in source tree.', generatedBad.map(rel));

console.log('PASS252_MISSION_MULTIVIEW_STATE_HARDENING=PASS');
console.log(`PASS252_VERSION=${pkg.version}`);
console.log(`PASS252_CSS_TARGET=${rel(cssTargets[0])}`);
console.log(`PASS252_RENDERER_TARGET=${rel(jsTargets[0])}`);
console.log('PASS252_ASSERTIONS=2.0.x-version-increment,layout-state-normalization,rapid-switch-repair,active-pane-recovery,webview-reflow,no-generated-artifacts');
