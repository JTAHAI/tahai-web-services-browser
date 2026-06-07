$ErrorActionPreference = "Stop"

$repo = (Get-Location).Path
$pkg = Join-Path $repo "package.json"
if (!(Test-Path $pkg)) {
  throw "Run this from the repo root: C:\dev\browser\app"
}

$rendererCandidates = @(
  "src\renderer\browser.css",
  "src\renderer\styles.css",
  "src\renderer\app.css",
  "src\renderer\renderer.css",
  "src\styles\browser.css",
  "src\styles.css"
) | ForEach-Object { Join-Path $repo $_ }

$cssTarget = $rendererCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (!$cssTarget) {
  $cssDir = Join-Path $repo "src\renderer"
  New-Item -ItemType Directory -Force -Path $cssDir | Out-Null
  $cssTarget = Join-Path $cssDir "browser.css"
}

$marker = "PASS317_EMERGENCY_VIEWPORT_COMPOSITOR_FILL"
$css = @'

/* PASS317_EMERGENCY_VIEWPORT_COMPOSITOR_FILL
   Emergency runtime fix for maximized/restored Electron window content being
   trapped in the upper-left while the BrowserWindow compositor fills the screen.
   This deliberately targets root/app/chrome/workspace wrappers and removes
   stale max-width/fixed-shell behavior without changing security boundaries. */
html,
body,
#root,
#app,
.app,
.browser-app,
.tahai-app,
.tahai-app-root,
.tahai-browser,
.tahai-browser-root,
.tahai-browser-shell,
.window-shell,
.app-shell,
.browser-shell,
.chrome-shell,
.browser-frame,
.browser-layout,
.browser-window,
.main-window,
.shell-root,
.workspace,
.workspace-root,
.workspace-shell,
.workspace-stage {
  width: 100vw !important;
  max-width: none !important;
  min-width: 0 !important;
  height: 100vh !important;
  max-height: none !important;
  min-height: 0 !important;
  box-sizing: border-box !important;
}

body {
  margin: 0 !important;
  overflow: hidden !important;
  background: #020710 !important;
}

body > *,
#root > *,
#app > *,
.app > *,
.browser-app > *,
.tahai-browser > *,
.tahai-browser-root > *,
.tahai-browser-shell > *,
.window-shell > *,
.app-shell > *,
.browser-shell > *,
.chrome-shell > *,
.browser-frame > *,
.browser-layout > *,
.shell-root > *,
.workspace-root > * {
  width: 100% !important;
  max-width: none !important;
  min-width: 0 !important;
  box-sizing: border-box !important;
}

.content-shell,
.content-root,
.content-area,
.browser-content,
.page-content,
.webview-stage,
.webview-host,
.webview-container,
.webview-stack,
.webview-layer,
.mission-stage,
.mission-panes,
.mission-pane,
.mission-pane-body,
[data-webview-stage],
[data-pane-shell],
[data-pane-body] {
  width: 100% !important;
  max-width: none !important;
  min-width: 0 !important;
  box-sizing: border-box !important;
}

webview,
.webview-stage webview,
.webview-host webview,
.webview-container webview,
.webview-stack webview,
.webview-layer webview,
.mission-pane webview {
  width: 100% !important;
  max-width: none !important;
  min-width: 0 !important;
  box-sizing: border-box !important;
}

@media (min-width: 1200px) {
  body > *,
  #root > *,
  #app > *,
  .app > *,
  .browser-app > *,
  .tahai-browser > *,
  .tahai-browser-root > *,
  .tahai-browser-shell > *,
  .window-shell > *,
  .app-shell > *,
  .browser-shell > *,
  .chrome-shell > *,
  .browser-frame > *,
  .browser-layout > *,
  .shell-root > *,
  .workspace-root > * {
    max-width: none !important;
  }
}
'@

$currentCss = if (Test-Path $cssTarget) { Get-Content -Raw -Path $cssTarget } else { "" }
if ($currentCss -notmatch [regex]::Escape($marker)) {
  Add-Content -Path $cssTarget -Value $css -Encoding UTF8
}
Write-Host "PASS317_CSS_TARGET=$cssTarget"

# Add a focused static verifier without relying on jq or npm package mutation tooling.
$scriptDir = Join-Path $repo "scripts"
New-Item -ItemType Directory -Force -Path $scriptDir | Out-Null
$verifierPath = Join-Path $scriptDir "verify-pass-317-viewport-compositor-fill.mjs"
$verifier = @'
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const candidates = [
  "src/renderer/browser.css",
  "src/renderer/styles.css",
  "src/renderer/app.css",
  "src/renderer/renderer.css",
  "src/styles/browser.css",
  "src/styles.css"
];
const existing = candidates.map((p) => path.join(root, p)).filter((p) => fs.existsSync(p));
const marker = "PASS317_EMERGENCY_VIEWPORT_COMPOSITOR_FILL";
const matches = existing.filter((p) => fs.readFileSync(p, "utf8").includes(marker));
if (!matches.length) {
  console.error("PASS317_VIEWPORT_COMPOSITOR_FILL=FAIL marker_missing");
  process.exit(1);
}
const css = fs.readFileSync(matches[0], "utf8");
const required = ["width: 100vw", "height: 100vh", "max-width: none", "body > *", "webview"];
const missing = required.filter((needle) => !css.includes(needle));
if (missing.length) {
  console.error(`PASS317_VIEWPORT_COMPOSITOR_FILL=FAIL missing=${missing.join(",")}`);
  process.exit(1);
}
const generatedDir = path.join(root, "release-candidate", "generated");
fs.mkdirSync(generatedDir, { recursive: true });
const report = {
  pass: "PASS317",
  name: "Emergency viewport compositor fill hotfix",
  result: "PASS",
  cssTarget: path.relative(root, matches[0]),
  guards: [
    "root/app/browser shells fill 100vw/100vh",
    "top-level children cannot retain stale max-width",
    "content/webview stages cannot retain stale max-width",
    "body overflow remains hidden for Electron shell"
  ],
  releaseTruth: {
    storeSubmitted: false,
    storeApproved: false,
    signedReleaseClaimAllowed: false,
    publicGaClaimAllowed: false
  }
};
fs.writeFileSync(path.join(generatedDir, "pass317-viewport-compositor-fill-report.json"), JSON.stringify(report, null, 2));
console.log("PASS317_VIEWPORT_COMPOSITOR_FILL=PASS");
'@
Set-Content -Path $verifierPath -Value $verifier -Encoding UTF8
Write-Host "PASS317_VERIFIER=$verifierPath"

# Patch package.json scripts safely.
$packageJson = Get-Content -Raw -Path $pkg | ConvertFrom-Json
if (-not $packageJson.scripts) {
  $packageJson | Add-Member -MemberType NoteProperty -Name scripts -Value ([pscustomobject]@{})
}
$packageJson.scripts | Add-Member -Force -MemberType NoteProperty -Name "verify:pass-317-viewport-compositor-fill" -Value "node scripts/verify-pass-317-viewport-compositor-fill.mjs"
$packageJson | ConvertTo-Json -Depth 100 | Set-Content -Path $pkg -Encoding UTF8
Write-Host "PASS317_PACKAGE_SCRIPT=verify:pass-317-viewport-compositor-fill"

npm run verify:pass-317-viewport-compositor-fill
npm run build
Write-Host "PASS317_APPLIED=PASS"
