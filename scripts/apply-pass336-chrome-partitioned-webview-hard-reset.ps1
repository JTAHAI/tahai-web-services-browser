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
$backupDir = Join-Path $repo ".pass336-backup\$stamp"
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

function Get-SourceFiles {
  $srcPath = Join-Path $repo "src"
  if (!(Test-Path $srcPath)) { return @() }
  return Get-ChildItem -Path $srcPath -Recurse -File -Include *.ts,*.tsx,*.js,*.jsx,*.mjs,*.cjs,*.css,*.scss | Where-Object {
    $_.FullName -notmatch '\\(dist|release|node_modules|coverage|\.git|\.pass[0-9]+-backup)\\'
  }
}

$actions = [System.Collections.Generic.List[string]]::new()
$quarantinedImports = [System.Collections.Generic.List[string]]::new()
$contractCleanupFiles = [System.Collections.Generic.List[string]]::new()
$pass271MarkerFiles = [System.Collections.Generic.List[string]]::new()

$sentryPath = Join-Path $rendererDir "pass336-chrome-partitioned-webview-hard-reset.ts"
if (!(Test-Path $sentryPath)) { throw "Missing $sentryPath. Re-expand PASS336 ZIP at repo root." }
$actions.Add("confirmed PASS336 sentry file: $(Get-RepoRelativePath $sentryPath)")

$entryCandidates = @(
  "src\renderer\app.ts",
  "src\renderer\main.ts",
  "src\renderer\index.ts",
  "src\renderer\app.tsx",
  "src\renderer\main.tsx",
  "src\renderer\index.tsx"
) | ForEach-Object { Join-Path $repo $_ } | Where-Object { Test-Path $_ }

if ($entryCandidates.Count -lt 1) { throw "No renderer entry file found for PASS336 import" }
$entryPath = $entryCandidates[0]
$entryText = Read-Text $entryPath
$entryLines = [System.Collections.Generic.List[string]]::new()
foreach ($line in ($entryText -split "`r?`n")) {
  if ($line -match '^\s*import\s+["''].*pass(327|328|329|330|331|332|333|334|335)-.*["'']\s*;?\s*$' -and $line -notmatch 'PASS336_QUARANTINED_RUNTIME_RECOVERY_IMPORT') {
    $entryLines.Add("// PASS336_QUARANTINED_RUNTIME_RECOVERY_IMPORT: " + $line.Trim())
    $quarantinedImports.Add($line.Trim())
  } else {
    $entryLines.Add($line)
  }
}
$entryOut = ($entryLines -join "`n")
if ($entryOut -notmatch 'pass336-chrome-partitioned-webview-hard-reset') {
  $entryOut = 'import "./pass336-chrome-partitioned-webview-hard-reset";' + "`n" + $entryOut
  $actions.Add("imported PASS336 chrome partitioned webview hard reset in $(Get-RepoRelativePath $entryPath)")
} else {
  $actions.Add("PASS336 hard reset already imported in $(Get-RepoRelativePath $entryPath)")
}
Replace-Text $entryPath ($entryOut.TrimEnd() + "`n")
$actions.Add("quarantined runtime recovery imports from PASS327-PASS335: " + $quarantinedImports.Count)

$sourceFiles = Get-SourceFiles
foreach ($file in $sourceFiles) {
  $path = $file.FullName
  $text = Read-Text $path
  if ($text -match 'PASS271_R9|PASS271_R10') {
    $pass271MarkerFiles.Add((Get-RepoRelativePath $path))
  }
}

$cssFiles = $sourceFiles | Where-Object { $_.Extension -match '^\.(css|scss)$' }
foreach ($cssFile in $cssFiles) {
  $cssPath = $cssFile.FullName
  $css = Read-Text $cssPath
  $originalCss = $css
  $css = [regex]::Replace($css, '(?s)\r?\n?/\* PASS327_VIEWPORT_ROOT_CONTRACT_BEGIN.*?PASS327_VIEWPORT_ROOT_CONTRACT_END \*/\r?\n?', "`n")
  $css = [regex]::Replace($css, '(?s)\r?\n?/\* PASS328_WEBVIEW_STAGE_CONTRACT_BEGIN.*?PASS328_WEBVIEW_STAGE_CONTRACT_END \*/\r?\n?', "`n")
  $css = [regex]::Replace($css, '(?s)\r?\n?/\* PASS333_CHROME_SAFE_WEBVIEW_STAGE_CONTRACT_BEGIN.*?PASS333_CHROME_SAFE_WEBVIEW_STAGE_CONTRACT_END \*/\r?\n?', "`n")
  $css = [regex]::Replace($css, '(?s)\r?\n?/\* PASS334_DEAD_CHROME_STATIC_GUARD_BEGIN.*?PASS334_DEAD_CHROME_STATIC_GUARD_END \*/\r?\n?', "`n")
  if ($css -ne $originalCss) {
    Replace-Text $cssPath ($css.TrimEnd() + "`n")
    $contractCleanupFiles.Add((Get-RepoRelativePath $cssPath))
  }
}
$actions.Add("removed broad prior viewport CSS contracts from " + (($contractCleanupFiles | Sort-Object -Unique).Count) + " CSS files")

Backup-File $pkgPath
$pkg = Get-Content -Raw -Path $pkgPath | ConvertFrom-Json
if (-not $pkg.scripts) { $pkg | Add-Member -MemberType NoteProperty -Name scripts -Value ([pscustomobject]@{}) }
$scriptName = "verify:pass-336-chrome-partitioned-webview-hard-reset"
$scriptValue = "node scripts/verify-pass-336-chrome-partitioned-webview-hard-reset.mjs"
if ($pkg.scripts.PSObject.Properties.Name -contains $scriptName) {
  $pkg.scripts.$scriptName = $scriptValue
} else {
  $pkg.scripts | Add-Member -MemberType NoteProperty -Name $scriptName -Value $scriptValue
}
Write-Utf8NoBom $pkgPath (($pkg | ConvertTo-Json -Depth 100) + "`n")
$actions.Add("added package verifier script for PASS336")

$qaPath = Join-Path $qaDir "PASS336-chrome-partitioned-webview-hard-reset.md"
$qaLines = @(
  "# PASS336 — Chrome Partitioned WebView Hard Reset",
  "",
  "Current runtime failure: the webview loads and briefly flashes, then a white/native webview layer wins and browser chrome buttons do not respond.",
  "",
  "PASS336 quarantines stacked recovery imports from PASS327-PASS335 and installs one focused recovery: if a webview covers the browser chrome, it is partitioned below detected chrome height instead of being allowed to render as a full-window surface.",
  "",
  "Runtime probe:",
  "",
  "```js",
  "window.__TAHAI_PASS336_CHROME_PARTITION__.reconcile('manual-dead-chrome-white')",
  "document.documentElement.dataset.pass336ChromePartitionHealth",
  "window.__TAHAI_PASS336_CHROME_PARTITION__.lastSample",
  "window.__TAHAI_PASS336_CHROME_PARTITION__.lastCritical",
  "```",
  "",
  "Expected if fixed: browser chrome responds, page content is below the toolbar, and dataset health is ok or warning rather than critical."
)
Write-Utf8NoBom $qaPath (($qaLines -join "`n") + "`n")
$actions.Add("wrote PASS336 QA doc")

$bugPath = Join-Path $bugHuntDir "pass336-chrome-partitioned-webview-hard-reset.md"
$bugLines = @(
  "# PASS336 Bug Hunt Report",
  "",
  "PASS336 is the first pass that stops trying to out-z-index native webviews and instead partitions any webview that covers browser chrome below the detected chrome height.",
  "",
  "Quarantined runtime recovery imports:",
  "",
  (($quarantinedImports | ForEach-Object { "- $_" }) -join "`n"),
  "",
  "Prior viewport CSS contract files cleaned:",
  "",
  (($contractCleanupFiles | Sort-Object -Unique | ForEach-Object { "- $_" }) -join "`n"),
  "",
  "PASS271 marker files still present for review:",
  "",
  (($pass271MarkerFiles | Sort-Object -Unique | ForEach-Object { "- $_" }) -join "`n")
)
Write-Utf8NoBom $bugPath (($bugLines -join "`n") + "`n")
$actions.Add("wrote PASS336 bug-hunt report")

$applyReportPath = Join-Path $generatedDir "pass336-chrome-partitioned-webview-hard-reset-apply-report.json"
$applyReport = [ordered]@{
  pass = "PASS336"
  name = "Chrome Partitioned WebView Hard Reset"
  appliedAt = (Get-Date).ToString("o")
  repo = $repo
  backupDir = $backupDir
  actions = @($actions)
  quarantinedRuntimeRecoveryImports = @($quarantinedImports)
  priorViewportCssContractsCleaned = @($contractCleanupFiles | Sort-Object -Unique)
  pass271MarkerFiles = @($pass271MarkerFiles | Sort-Object -Unique)
  verifier = "npm run verify:pass-336-chrome-partitioned-webview-hard-reset"
}
Write-Utf8NoBom $applyReportPath (($applyReport | ConvertTo-Json -Depth 20) + "`n")

npm run verify:pass-336-chrome-partitioned-webview-hard-reset
if ($LASTEXITCODE -ne 0) { throw "PASS336 verifier failed with exit code $LASTEXITCODE" }

Write-Host "PASS336_APPLIED=PASS"
Write-Host "PASS336_QUARANTINED_RUNTIME_RECOVERY_IMPORTS=$($quarantinedImports.Count)"
Write-Host "PASS336_PRIOR_VIEWPORT_CSS_CONTRACT_FILES=$((@($contractCleanupFiles | Sort-Object -Unique)).Count)"
Write-Host "PASS336_PASS271_MARKER_FILES=$((@($pass271MarkerFiles | Sort-Object -Unique)).Count)"
Write-Host "PASS336_VERIFY_RESULT=PASS"
Write-Host "PASS336_REPORT=$applyReportPath"
Write-Host "PASS336_BACKUP_DIR=$backupDir"
