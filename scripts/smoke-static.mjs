import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd(), '..');
const strictSourceMode = process.env.TAHAI_BROWSER_STRICT_SOURCE_TREE === '1';
const required = [
  'README.md',
  'browser/new-tab/index.html',
  'browser/settings/index.html',
  'browser/about/index.html',
  'browser/error-page/index.html',
  'browser/onboarding/index.html',
  'browser/bookmarks/bookmarks.json',
  'browser/policies/managed-policy.windows.json',
  'browser/policies/managed-policy.linux.json',
  'browser/preferences/master-preferences.json',
  'browser/new-tab/assets/tws/tws-square-logo.png',
  'browser/new-tab/assets/tws/tws-footer.jpg',
  'browser/new-tab/assets/tws/tws-logo-motion.mp4',
  'docs/enterprise-release-readiness.md',
  'release-plan/release-manifest.template.json',
  'docs/windows-packaging.md',
  'docs/visual-qa-checklist.md',
  'app/scripts/verify-win-package.mjs',
  'docs/devops-evidence-capture.md',
  'docs/pass22-devops-evidence-capture.md',
  'docs/devops-url-ops-check.md',
  'docs/pass23-url-ops-check.md',
  'docs/it-service-card.md',
  'docs/pass24-it-service-card.md',
  'docs/developer-audit.md',
  'docs/pass25-developer-audit.md',
  'docs/it-endpoint-snapshot.md',
  'docs/pass26-endpoint-snapshot.md',
  'docs/devops-deploy-readiness.md',
  'docs/pass27-deploy-readiness.md',
  'docs/developer-route-map.md',
  'docs/pass28-route-map-win-guard.md',
  'docs/it-support-triage.md',
  'docs/pass29-it-support-triage.md',
  'docs/pass30-windows-packager-shell-diagnostics.md',
  'app/scripts/guard-win-codesign.mjs',
  'app/src/main/credential-vault.ts',
  'docs/pass33-v1-1-about-credentials.md'
];

const generatedOrRuntimeDirs = new Set(['.git', 'node_modules', 'dist', 'release', 'out', 'runtime', 'tmp', 'temp', 'logs', 'artifacts']);

function fail(message) {
  console.error(`TAHAI_BROWSER_SMOKE=FAILED: ${message}`);
  process.exit(1);
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, rel), 'utf8'));
}

for (const rel of required) {
  if (!fs.existsSync(path.join(repoRoot, rel))) fail(`missing ${rel}`);
}

const pkg = readJson('app/package.json');
const releaseManifest = readJson('release-plan/release-manifest.template.json');

if (pkg.productName !== 'TAHAI Web Services Browser') fail('productName mismatch');
if (pkg.homepage !== 'https://tahaiportal.com') fail('homepage mismatch');
if (releaseManifest.product !== 'TAHAI Web Services Browser') fail('release manifest product mismatch');
if (releaseManifest.defaultHome !== 'https://tahaiportal.com') fail('release manifest defaultHome mismatch');
if (releaseManifest.version !== pkg.version) fail(`package/release version mismatch: ${pkg.version} != ${releaseManifest.version}`);
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(pkg.version)) fail(`invalid semver-ish package version: ${pkg.version}`);
if (releaseManifest.channel !== 'enterprise-rc') fail('release manifest channel mismatch');

const bookmarks = readJson('browser/bookmarks/bookmarks.json');
if (!JSON.stringify(bookmarks).includes('https://tahaiportal.com')) fail('bookmarks missing TAHAI portal');

const mainTs = fs.readFileSync(path.join(repoRoot, 'app/src/main/main.ts'), 'utf8');
if (!mainTs.includes('https://tahaiportal.com')) fail('main default home missing');
if (!mainTs.includes('runFirstLaunchChecks')) fail('first launch checks not wired');
if (!mainTs.includes('contextIsolation: true')) fail('context isolation should be visibly enabled');
if (!mainTs.includes('nodeIntegration: false')) fail('node integration should be visibly disabled');
if (!mainTs.includes('devTools: true')) fail('developer DevTools should remain enabled for this browser lane');

const rendererTs = fs.readFileSync(path.join(repoRoot, 'app/src/renderer/app.ts'), 'utf8');
if (!rendererTs.includes('toggleActiveDevTools') || !rendererTs.includes('devTools=yes')) fail('active-tab Chromium DevTools wiring missing');
for (const token of ['openDevOpsCapture', 'buildDevOpsCaptureMarkdown', 'executeJavaScript(captureScript()', 'copyDevOpsCapture', 'saveDevOpsCapture']) {
  if (!rendererTs.includes(token)) fail(`DevOps evidence capture renderer token missing: ${token}`);
}
for (const token of ['openOpsCheck', 'buildOpsCheckMarkdown', 'runUrlDiagnostics', 'opsCheckButton']) {
  if (!rendererTs.includes(token)) fail(`URL Ops Check renderer token missing: ${token}`);
}
for (const token of ['openItServiceCard', 'buildItServiceCardMarkdown', 'runItServiceCardDiagnostics', 'itCardButton', 'itCardMarkdown']) {
  if (!rendererTs.includes(token)) fail(`IT Service Card renderer token missing: ${token}`);
}
for (const token of ['openEndpointSnapshot', 'buildEndpointSnapshotMarkdown', 'endpointScript', 'endpointButton', 'endpointMarkdown']) {
  if (!rendererTs.includes(token)) fail(`Endpoint Snapshot renderer token missing: ${token}`);
}
for (const token of ['openDeployReadiness', 'buildDeployReadinessMarkdown', 'deployDecision', 'deployButton', 'deployMarkdown']) {
  if (!rendererTs.includes(token)) fail(`Deploy Readiness renderer token missing: ${token}`);
}
for (const token of ['openSupportTriage', 'buildSupportTriageMarkdown', 'triageButton', 'triageMarkdown', 'latestTriage']) {
  if (!rendererTs.includes(token)) fail(`Support Triage renderer token missing: ${token}`);
}
for (const token of ['openRouteMap', 'buildRouteMapMarkdown', 'routeMapScript', 'routeMapButton', 'routeMapMarkdown']) {
  if (!rendererTs.includes(token)) fail(`Route Map renderer token missing: ${token}`);
}

for (const token of ['openCredentialVault', 'credentialVaultRecords', 'credentialDialog', 'credentialPassword']) {
  if (!rendererTs.includes(token)) fail(`Credential Manager renderer token missing: ${token}`);
}

const rendererHtml = fs.readFileSync(path.join(repoRoot, 'app/src/renderer/index.html'), 'utf8');
if (!rendererHtml.includes('id="devtools"')) fail('DevTools button missing');
if (!rendererHtml.includes('id="capture"') || !rendererHtml.includes('id="capture-markdown"')) fail('DevOps evidence capture UI missing');
if (!rendererHtml.includes('id="ops-check"') || !rendererHtml.includes('id="ops-markdown"')) fail('URL Ops Check UI missing');
if (!rendererHtml.includes('id="it-card"') || !rendererHtml.includes('id="it-card-markdown"')) fail('IT Service Card UI missing');
if (!rendererHtml.includes('id="endpoint"') || !rendererHtml.includes('id="endpoint-markdown"')) fail('Endpoint Snapshot UI missing');
if (!rendererHtml.includes('id="deploy"') || !rendererHtml.includes('id="deploy-markdown"')) fail('Deploy Readiness UI missing');
if (!rendererHtml.includes('id="triage"') || !rendererHtml.includes('id="triage-markdown"')) fail('Support Triage UI missing');
if (!rendererHtml.includes('id="route-map"') || !rendererHtml.includes('id="route-map-markdown"')) fail('Route Map UI missing');

if (!rendererHtml.includes('id="credentials"') || !rendererHtml.includes('id="credential-dialog"')) fail('Credential Manager UI missing');

const preloadTs = fs.readFileSync(path.join(repoRoot, 'app/src/preload/preload.ts'), 'utf8');

const winPackager = fs.readFileSync(path.join(repoRoot, 'packaging/windows/build-windows-unpacked-zip.ps1'), 'utf8');
if (/\bnpx\s+electron-builder\b|\belectron-builder\s+--win\b/i.test(winPackager)) fail('supported Windows unpacked ZIP lane should not invoke electron-builder');
for (const token of ['TAHAI_BROWSER_WINDOWS_UNPACKED_ZIP=OK', 'resources\\app', 'resources\\browser']) {
  if (!winPackager.includes(token)) fail(`Windows custom unpacked packager token missing: ${token}`);
}
if (!mainTs.includes('loadRendererShell') || !mainTs.includes('rendererShellFailureHtml')) fail('renderer shell load diagnostic fallback missing');
const credentialVaultTs = fs.readFileSync(path.join(repoRoot, 'app/src/main/credential-vault.ts'), 'utf8');
if (!mainTs.includes('tahai-browser:list-credentials') || !credentialVaultTs.includes('safeStorage')) fail('Credential Manager main/safeStorage wiring missing');
for (const token of ['tahai-browser:copy-devops-capture', 'tahai-browser:save-devops-capture', 'defaultCapturePath']) {
  if (!mainTs.includes(token)) fail(`DevOps evidence capture main token missing: ${token}`);
}
for (const token of ['tahai-browser:run-url-diagnostics', 'SAFE_DIAGNOSTIC_HEADERS', 'runUrlDiagnostics']) {
  if (!mainTs.includes(token)) fail(`URL Ops Check main token missing: ${token}`);
}
for (const token of ['tahai-browser:run-it-service-card-diagnostics', 'runItServiceCardDiagnostics', 'isPublicDnsEligibleHost']) {
  if (!mainTs.includes(token)) fail(`IT Service Card main token missing: ${token}`);
}
for (const token of ['copyDevOpsCapture', 'saveDevOpsCapture', 'runUrlDiagnostics', 'OpsUrlDiagnostics', 'runItServiceCardDiagnostics', 'ItServiceCardDiagnostics']) {
  if (!preloadTs.includes(token)) fail(`DevOps/Ops Check preload token missing: ${token}`);
}

for (const token of ['listCredentials', 'saveCredential', 'copyCredentialValue', 'revealCredentialPassword']) {
  if (!preloadTs.includes(token)) fail(`Credential Manager preload token missing: ${token}`);
}
const settingsTs = fs.readFileSync(path.join(repoRoot, 'app/src/main/settings.ts'), 'utf8');
for (const token of ['plainRecord(value: unknown)', 'const rawPermissions = plainRecord(raw.permissions)', 'const rawDownloads = plainRecord(raw.downloads)', 'const rawUi = plainRecord(raw.ui)']) {
  if (!settingsTs.includes(token)) fail(`settings sanitizer token missing: ${token}`);
}

const requiredScripts = ['typecheck', 'build', 'smoke:static', 'assert:production', 'verify:release', 'audit:runtime', 'guard:win:signed-package'];
for (const scriptName of requiredScripts) {
  if (!pkg.scripts || !pkg.scripts[scriptName]) fail(`package script missing: ${scriptName}`);
}

if (strictSourceMode) {
  function walkStrict(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(repoRoot, full);
      if (entry.isDirectory()) {
        if (generatedOrRuntimeDirs.has(entry.name)) fail(`forbidden source directory present: ${rel}`);
        walkStrict(full);
      }
    }
  }
  walkStrict(repoRoot);
}

console.log(`TAHAI_BROWSER_SMOKE=OK version=${pkg.version} strictSourceMode=${strictSourceMode}`);
process.exit(0);
// explicit smoke exit for CI shells that keep Node handles open
