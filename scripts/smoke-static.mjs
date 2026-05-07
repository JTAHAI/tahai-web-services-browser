import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const strictSourceMode = process.env.TAHAI_BROWSER_STRICT_SOURCE_TREE === '1';
const generatedOrRuntimeDirs = new Set(['.git', 'node_modules', 'dist', 'release', 'out', 'runtime', 'tmp', 'temp', 'logs', 'artifacts', 'coverage']);

function fail(message) {
  console.error(`TAHAI_BROWSER_SMOKE=FAILED: ${message}`);
  process.exit(1);
}
function exists(rel) { return fs.existsSync(path.join(root, rel)); }
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function readJson(rel) { return JSON.parse(read(rel)); }

const required = [
  'README.md',
  'package.json',
  'package-lock.json',
  'electron-builder.yml',
  'src/main/main.ts',
  'src/preload/preload.ts',
  'src/renderer/app.ts',
  'src/renderer/boot.ts',
  'src/renderer/index.html',
  'src/renderer/styles/browser.css',
  'browser/new-tab/index.html',
  'browser/settings/index.html',
  'browser/about/index.html',
  'browser/about/offline.html',
  'browser/error-page/index.html',
  'browser/onboarding/index.html',
  'browser/bookmarks/bookmarks.json',
  'browser/policies/managed-policy.windows.json',
  'browser/policies/managed-policy.linux.json',
  'browser/preferences/master-preferences.json',
  'browser/new-tab/assets/tws/tws-square-logo.png',
  'browser/new-tab/assets/tws/tws-footer.jpg',
  'browser/new-tab/assets/tws/tws-logo-motion.mp4',
  'build/icon.ico',
  'build/icon.png',
  'scripts/guard-win-codesign.mjs',
  'scripts/verify-win-package.mjs',
  'scripts/verify-builder-truth.mjs',
  'scripts/create-friend-feedback-release.ps1',
  'packaging/windows/build-windows-unpacked-zip.ps1'
];
for (const rel of required) if (!exists(rel)) fail(`missing ${rel}`);

const pkg = readJson('package.json');
const lock = readJson('package-lock.json');
if (pkg.productName !== 'TAHAI Web Services Browser') fail('productName mismatch');
if (pkg.homepage !== 'https://browser.tahai.net') fail('homepage mismatch');
if (lock.version !== pkg.version || lock.packages?.['']?.version !== pkg.version) fail('package-lock version mismatch');
if (!/^\d+\.\d+\.\d+/.test(pkg.version)) fail(`invalid semver-ish package version: ${pkg.version}`);

const bookmarks = readJson('browser/bookmarks/bookmarks.json');
if (!JSON.stringify(bookmarks).includes('TAHAI')) fail('bookmarks missing TAHAI entries');

const mainTs = read('src/main/main.ts');
if (!mainTs.includes('runFirstLaunchChecks')) fail('first launch checks not wired');
if (!mainTs.includes('contextIsolation: true')) fail('context isolation should be visibly enabled');
if (!mainTs.includes('nodeIntegration: false')) fail('node integration should be visibly disabled');
if (!mainTs.includes('devTools: true')) fail('developer DevTools should remain enabled for this browser lane');
if (!mainTs.includes('loadRendererShell') || !mainTs.includes('rendererShellFailureHtml')) fail('renderer shell load diagnostic fallback missing');

const rendererTs = read('src/renderer/app.ts');
for (const token of ['toggleActiveDevTools', 'devTools=yes', 'openDevOpsCapture', 'openOpsCheck', 'openItServiceCard', 'openEndpointSnapshot', 'openDeployReadiness', 'openSupportTriage', 'openRouteMap', 'openSecretBoundary']) {
  if (!rendererTs.includes(token)) fail(`renderer token missing: ${token}`);
}

const rendererHtml = read('src/renderer/index.html');
for (const id of ['devtools', 'capture', 'ops-check', 'it-card', 'endpoint', 'deploy', 'triage', 'route-map', 'secret-boundary']) {
  if (!rendererHtml.includes(`id="${id}"`)) fail(`renderer UI id missing: ${id}`);
}

const preloadTs = read('src/preload/preload.ts');
for (const token of ['contextBridge.exposeInMainWorld', 'copyDevOpsCapture', 'saveDevOpsCapture', 'runUrlDiagnostics', 'runItServiceCardDiagnostics', 'listProfiles']) {
  if (!preloadTs.includes(token)) fail(`preload token missing: ${token}`);
}

const winPackager = read('packaging/windows/build-windows-unpacked-zip.ps1');
for (const token of ['TAHAI_BROWSER_WINDOWS_UNPACKED_ZIP=OK', 'AppResourcesDir', 'ResourcesDir', 'release-build-truth.json']) {
  if (!winPackager.includes(token)) fail(`Windows custom unpacked packager token missing: ${token}`);
}

const builder = read('electron-builder.yml');
for (const token of ['appId: com.tahai.webservices.browser', 'productName: TAHAI Web Services Browser', 'from: browser', 'asar: true', 'publish: null']) {
  if (!builder.includes(token)) fail(`builder token missing: ${token}`);
}

const requiredScripts = ['typecheck', 'build', 'smoke:static', 'assert:production', 'verify:release', 'verify:builder-truth', 'guard:win:signed-package'];
for (const scriptName of requiredScripts) {
  if (!pkg.scripts || !pkg.scripts[scriptName]) fail(`package script missing: ${scriptName}`);
}

if (strictSourceMode) {
  function walkStrict(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(root, full);
      if (entry.isDirectory()) {
        if (generatedOrRuntimeDirs.has(entry.name)) fail(`forbidden source directory present: ${rel}`);
        walkStrict(full);
      }
    }
  }
  walkStrict(root);
}

console.log(`TAHAI_BROWSER_SMOKE=OK version=${pkg.version} strictSourceMode=${strictSourceMode}`);
process.exit(0);
