$ErrorActionPreference = "Stop"

$repo = (Get-Location).Path
$pkgPath = Join-Path $repo "package.json"
if (!(Test-Path $pkgPath)) { throw "package.json not found. Run from D:\dev\browser\app" }
if ($repo -notmatch '^[Dd]:\\dev\\browser\\app$') {
  Write-Warning "Expected repo path D:\dev\browser\app. Current path: $repo"
}

$scriptDir = Join-Path $repo "scripts"
$rendererDir = Join-Path $repo "src\renderer"
$qaDir = Join-Path $repo "docs\qa"
$generatedDir = Join-Path $repo "release-candidate\generated"
$bugHuntDir = Join-Path $repo "release-candidate\bug-hunt"
New-Item -ItemType Directory -Force -Path $scriptDir, $rendererDir, $qaDir, $generatedDir, $bugHuntDir | Out-Null

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $repo ".pass333-backup\$stamp"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

function Get-RepoRelativePath([string]$path) {
  if ([string]::IsNullOrWhiteSpace($path)) { return $path }
  $repoFull = [System.IO.Path]::GetFullPath($repo).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
  $pathFull = [System.IO.Path]::GetFullPath($path)
  if ($pathFull.StartsWith($repoFull, [System.StringComparison]::OrdinalIgnoreCase)) {
    $relative = $pathFull.Substring($repoFull.Length).TrimStart([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
    if ([string]::IsNullOrWhiteSpace($relative)) { return "." }
    return $relative
  }
  return $pathFull
}

function Backup-File([string]$path) {
  if (!(Test-Path $path)) { return }
  $relative = Get-RepoRelativePath $path
  $dest = Join-Path $backupDir $relative
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dest) | Out-Null
  Copy-Item -Force $path $dest
}

function Write-Utf8NoBom([string]$path, [string]$content) {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $path) | Out-Null
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($path, $content, $encoding)
}

function Read-Text([string]$path) {
  if (!(Test-Path $path)) { return "" }
  return [System.IO.File]::ReadAllText($path)
}

function Replace-Text([string]$path, [string]$content) {
  Backup-File $path
  Write-Utf8NoBom $path $content
}

$actions = [System.Collections.Generic.List[string]]::new()
$entryCandidates = @(
  "src\renderer\app.ts",
  "src\renderer\main.ts",
  "src\renderer\index.ts",
  "src\renderer\app.tsx",
  "src\renderer\main.tsx",
  "src\renderer\index.tsx"
) | ForEach-Object { Join-Path $repo $_ } | Where-Object { Test-Path $_ }

$entryUpdated = $false
foreach ($entry in $entryCandidates) {
  $text = Read-Text $entry
  $original = $text
  $text = [regex]::Replace($text, '(?m)^\s*import\s+["'']\.\/pass329-viewport-lifecycle-sentry["''];\s*$', '// PASS333: quarantined PASS329 auto viewport sentry; browser chrome is dead/white after recovery lane.')
  $text = [regex]::Replace($text, '(?m)^\s*import\s+["'']\.\/pass330-webview-occlusion-sentry["''];\s*$', '// PASS333: quarantined PASS330 auto occlusion sentry; diagnostic-only PASS333 owns next proof.')
  $text = [regex]::Replace($text, '(?m)^\s*import\s+["'']\.\/pass331-webview-load-visibility-reconciler["''];\s*$', '// PASS333: quarantined PASS331 auto visibility reconciler; it can hide the wrong owner while chrome is dead.')
  $text = [regex]::Replace($text, '(?m)^\s*import\s+["'']\.\/pass332-webview-navigation-owner-truth["''];\s*$', '// PASS333: quarantined PASS332 auto navigation-owner recovery; it did not fix runtime and chrome is not clickable.')
  if ($text -notmatch 'import\s+["'']\.\/pass333-chrome-hit-test-webview-layer-truth["'']') {
    $text = 'import "./pass333-chrome-hit-test-webview-layer-truth";' + "`n" + $text
  }
  if ($text -ne $original) {
    Replace-Text $entry $text
    $actions.Add("updated renderer entry import quarantine: $(Get-RepoRelativePath $entry)")
    $entryUpdated = $true
    break
  }
}
if (!$entryUpdated) { $actions.Add("no renderer entry import change was required or no active entry was found") }

# Package script
Backup-File $pkgPath
$pkg = Get-Content -Raw -Path $pkgPath | ConvertFrom-Json
if (-not $pkg.scripts) { $pkg | Add-Member -MemberType NoteProperty -Name scripts -Value ([pscustomobject]@{}) }
$scriptName = "verify:pass-333-chrome-hit-test-webview-layer-truth"
$scriptValue = "node scripts/verify-pass-333-chrome-hit-test-webview-layer-truth.mjs"
if ($pkg.scripts.PSObject.Properties.Name -contains $scriptName) {
  $pkg.scripts.$scriptName = $scriptValue
} else {
  $pkg.scripts | Add-Member -MemberType NoteProperty -Name $scriptName -Value $scriptValue
}
Write-Utf8NoBom $pkgPath (($pkg | ConvertTo-Json -Depth 100) + "`n")
$actions.Add("added package verifier script for PASS333")

# CSS: remove broad PASS328 stage contract and replace with a narrower chrome-safe contract.
$srcPath = Join-Path $repo "src"
$cssCandidates = @()
if (Test-Path $srcPath) {
  $cssCandidates = Get-ChildItem -Path $srcPath -Recurse -File -Include *.css,*.scss | Where-Object { $_.FullName -notmatch '\\(dist|release|node_modules|coverage)\\' }
}
$preferredCssRel = @(
  "src\renderer\browser.css",
  "src\renderer\style.css",
  "src\renderer\styles.css",
  "src\renderer\app.css",
  "src\renderer\index.css"
)
$cssPath = $null
foreach ($rel in $preferredCssRel) {
  $candidate = Join-Path $repo $rel
  if (Test-Path $candidate) { $cssPath = $candidate; break }
}
if (!$cssPath -and $cssCandidates.Count -gt 0) { $cssPath = ($cssCandidates | Select-Object -First 1).FullName }

$pass333Css = @'

/* PASS333_CHROME_SAFE_WEBVIEW_STAGE_CONTRACT_BEGIN
   Chrome-safe webview stage contract.
   This intentionally replaces the broad PASS328 contract, which matched generic
   .browser-content/.webview-container surfaces and could let a webview become
   a full-window hit-test owner above toolbar buttons.
*/
[data-webview-stage],
[data-browser-content-stage],
[data-tab-stage],
[data-mission-stage],
.browser-webview-stage,
.tahai-webview-stage,
.tab-webview-stage,
.mission-stage,
.mission-pane-body {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  isolation: isolate;
}

[data-webview-stage] > webview,
[data-browser-content-stage] > webview,
[data-tab-stage] > webview,
[data-mission-stage] > webview,
.browser-webview-stage > webview,
.tahai-webview-stage > webview,
.tab-webview-stage > webview,
.mission-pane-body > webview,
webview[data-browser-webview="true"],
webview[data-mission-pane-webview="true"] {
  position: absolute;
  inset: 0;
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  max-width: 100%;
  max-height: 100%;
  transform: none;
  transform-origin: top left;
  zoom: 1;
  pointer-events: auto;
}

header,
nav,
[role="toolbar"],
[role="tablist"],
.titlebar,
.title-bar,
.toolbar,
.browser-toolbar,
.tab-strip,
.address-bar,
.omnibox,
[data-toolbar],
[data-browser-toolbar],
[data-tab-strip],
[data-address-bar] {
  position: relative;
  z-index: 30;
  pointer-events: auto;
}
/* PASS333_CHROME_SAFE_WEBVIEW_STAGE_CONTRACT_END */
'@

if ($cssPath) {
  $css = Read-Text $cssPath
  $css = [regex]::Replace($css, '(?s)\r?\n?/\* PASS328_WEBVIEW_STAGE_OWNERSHIP_CONTRACT_BEGIN.*?PASS328_WEBVIEW_STAGE_OWNERSHIP_CONTRACT_END \*/\r?\n?', "`n")
  $css = [regex]::Replace($css, '(?s)\r?\n?/\* PASS333_CHROME_SAFE_WEBVIEW_STAGE_CONTRACT_BEGIN.*?PASS333_CHROME_SAFE_WEBVIEW_STAGE_CONTRACT_END \*/\r?\n?', "`n")
  Replace-Text $cssPath ($css.TrimEnd() + $pass333Css + "`n")
  $actions.Add("replaced broad PASS328 stage CSS with PASS333 chrome-safe contract in $(Get-RepoRelativePath $cssPath)")
} else {
  $cssPath = Join-Path $repo "src\renderer\pass333-chrome-safe-webview-stage-contract.css"
  Write-Utf8NoBom $cssPath $pass333Css
  $actions.Add("created standalone PASS333 chrome-safe CSS at src\renderer\pass333-chrome-safe-webview-stage-contract.css; active CSS file not found")
}

# QA and bug-hunt docs
$qaPath = Join-Path $qaDir "PASS333-chrome-hit-test-webview-layer-truth.md"
$qaText = @'
# PASS333 — Chrome Hit-Test + WebView Layer Truth

PASS333 responds to the current runtime evidence: the website briefly flashes, then the browser becomes a white screen and the chrome buttons stop working.

That symptom is different from the original upper-left compositor trap. It points to a full-window or top-layer webview surface winning hit tests over the browser shell.

Changes:

- Quarantines PASS329–PASS332 auto-recovery imports from the renderer entry point.
- Removes the broad PASS328 stage CSS contract.
- Adds a narrower chrome-safe webview-stage CSS contract.
- Adds a diagnostic-only runtime sentry at `window.__TAHAI_PASS333_CHROME_HITTEST__`.
- Adds `npm run verify:pass-333-chrome-hit-test-webview-layer-truth`.

Runtime probe:

```js
window.__TAHAI_PASS333_CHROME_HITTEST__.sample('manual-white-buttons-dead')
document.documentElement.dataset.pass333ChromeHitTestHealth
window.__TAHAI_PASS333_CHROME_HITTEST__.lastSample
window.__TAHAI_PASS333_CHROME_HITTEST__.lastCritical
```

Healthy shell target: `ok`.

Critical findings to paste back:

- `webview-occludes-browser-chrome`
- `webview-enters-browser-chrome-band`
- `webview-full-window-surface`
'@
Write-Utf8NoBom $qaPath $qaText
$actions.Add("wrote PASS333 QA doc")

$bugPath = Join-Path $bugHuntDir "pass333-chrome-hit-test-webview-layer-truth.md"
$bugText = @'
# PASS333 Bug Hunt Notes

The current evidence after PASS332 is:

- `npm run build` passes.
- Electron logs still show PASS271_R9 webview attach/load events.
- The website flashes briefly.
- The runtime then becomes a white surface.
- Browser chrome buttons stop working.

PASS333 treats this as a layer/hit-test bug, not a URL/load bug.

Priority next if PASS333 still shows white:

1. Use `window.__TAHAI_PASS333_CHROME_HITTEST__.lastCritical`.
2. If a webview is full-window, inspect the nearest parent chain and active CSS rule owner.
3. Remove or narrow the actual source CSS/DOM owner causing the webview to start at top edge.
4. Do not re-enable PASS329–PASS332 recovery imports until chrome hit-testing is clean.
'@
Write-Utf8NoBom $bugPath $bugText
$actions.Add("wrote PASS333 bug-hunt report")

$applyReportPath = Join-Path $generatedDir "pass333-chrome-hit-test-webview-layer-truth-apply-report.json"
$applyReport = [ordered]@{
  pass = "PASS333"
  name = "Chrome Hit-Test + WebView Layer Truth"
  actions = @($actions)
  backupDir = $backupDir
  generatedAt = (Get-Date).ToString("o")
}
Write-Utf8NoBom $applyReportPath (($applyReport | ConvertTo-Json -Depth 20) + "`n")

npm run verify:pass-333-chrome-hit-test-webview-layer-truth
if ($LASTEXITCODE -ne 0) { throw "PASS333 verifier failed with exit code $LASTEXITCODE" }

Write-Host "PASS333_APPLIED=PASS"
Write-Host "PASS333_PRIOR_RECOVERY_IMPORTS=QUARANTINED"
Write-Host "PASS333_CSS_CONTRACT=$(Get-RepoRelativePath $cssPath)"
Write-Host "PASS333_VERIFY_RESULT=PASS"
Write-Host "PASS333_REPORT=$applyReportPath"
Write-Host "PASS333_BACKUP_DIR=$backupDir"
