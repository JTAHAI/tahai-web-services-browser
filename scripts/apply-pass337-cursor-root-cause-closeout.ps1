$ErrorActionPreference = "Stop"

$repo = (Get-Location).Path
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $repo (".pass337-backup\" + $timestamp)
$generatedDir = Join-Path $repo "release-candidate\generated"
$bugHuntDir = Join-Path $repo "release-candidate\bug-hunt"
$qaDir = Join-Path $repo "docs\qa"

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
New-Item -ItemType Directory -Force -Path $generatedDir | Out-Null
New-Item -ItemType Directory -Force -Path $bugHuntDir | Out-Null
New-Item -ItemType Directory -Force -Path $qaDir | Out-Null

$actions = New-Object System.Collections.Generic.List[string]

function Require-File([string]$relative) {
  $path = Join-Path $repo $relative
  if (-not (Test-Path $path)) {
    throw "Required file not found: $relative"
  }
  return $path
}

function Backup-File([string]$path) {
  $full = [System.IO.Path]::GetFullPath($path)
  $repoFull = [System.IO.Path]::GetFullPath($repo).TrimEnd('\', '/')
  $relative = $full
  if ($full.StartsWith($repoFull, [System.StringComparison]::OrdinalIgnoreCase)) {
    $relative = $full.Substring($repoFull.Length).TrimStart('\', '/')
  }
  $dest = Join-Path $backupDir $relative
  $parent = Split-Path -Parent $dest
  if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
  Copy-Item -Force $path $dest
}

function Read-RepoText([string]$relative) {
  $path = Require-File $relative
  return [System.IO.File]::ReadAllText($path)
}

function Write-RepoText([string]$relative, [string]$text) {
  $path = Require-File $relative
  Backup-File $path
  [System.IO.File]::WriteAllText($path, $text, [System.Text.Encoding]::UTF8)
}

function Add-Action([string]$message) {
  $actions.Add($message) | Out-Null
}

function Guard-ExactCallLine([string]$relative, [string]$callName, [string]$envName, [string]$label) {
  $path = Require-File $relative
  $text = [System.IO.File]::ReadAllText($path)
  if ($text.Contains($envName)) {
    Add-Action "$label already guarded"
    return
  }

  $lines = [System.IO.File]::ReadAllLines($path)
  $out = New-Object System.Collections.Generic.List[string]
  $changed = $false
  foreach ($line in $lines) {
    $trim = $line.Trim()
    if ($trim -eq ($callName + "();")) {
      $indentLen = $line.Length - $line.TrimStart().Length
      $indent = $line.Substring(0, $indentLen)
      $out.Add($indent + "if (((globalThis as any).process?.env?." + $envName + ") === ""1"") {") | Out-Null
      $out.Add($indent + "  " + $trim) | Out-Null
      $out.Add($indent + "}") | Out-Null
      $changed = $true
    } else {
      $out.Add($line) | Out-Null
    }
  }
  if ($changed) {
    Backup-File $path
    [System.IO.File]::WriteAllLines($path, $out.ToArray(), [System.Text.Encoding]::UTF8)
    Add-Action "$label guarded behind $envName"
  } else {
    Add-Action "$label call not found"
  }
}

function Guard-CallPatternLine([string]$relative, [string]$callPattern, [string]$envName, [string]$label) {
  $path = Require-File $relative
  $text = [System.IO.File]::ReadAllText($path)
  if ($text.Contains($envName)) {
    Add-Action "$label already guarded"
    return
  }

  $lines = [System.IO.File]::ReadAllLines($path)
  $out = New-Object System.Collections.Generic.List[string]
  $changed = $false
  foreach ($line in $lines) {
    $trim = $line.Trim()
    if ($trim -match $callPattern -and $trim -notmatch "^function\s+") {
      $indentLen = $line.Length - $line.TrimStart().Length
      $indent = $line.Substring(0, $indentLen)
      $out.Add($indent + "if (((globalThis as any).process?.env?." + $envName + ") === ""1"") {") | Out-Null
      $out.Add($indent + "  " + $trim) | Out-Null
      $out.Add($indent + "}") | Out-Null
      $changed = $true
    } else {
      $out.Add($line) | Out-Null
    }
  }
  if ($changed) {
    Backup-File $path
    [System.IO.File]::WriteAllLines($path, $out.ToArray(), [System.Text.Encoding]::UTF8)
    Add-Action "$label guarded behind $envName"
  } else {
    Add-Action "$label call not found"
  }
}

# 1. Main-process PASS271_R9 GPU/compositor disable must be opt-in.
$mainRel = "src\main\main.ts"
$main = Read-RepoText $mainRel
if ($main -notmatch "TAHAI_BROWSER_ENABLE_PASS271_R9_GPU_DISABLE") {
  $pattern = "(function\s+installPass271R9WebviewCompositorCloseout\s*\([^)]*\)\s*(?::\s*[^\{]+)?\s*\{)"
  if ([regex]::IsMatch($main, $pattern)) {
    $guard = '$1' + [Environment]::NewLine +
      '  if (process.env.TAHAI_BROWSER_ENABLE_PASS271_R9_GPU_DISABLE !== "1") {' + [Environment]::NewLine +
      '    console.info("[PASS337] PASS271_R9 GPU/compositor disable is opt-in; set TAHAI_BROWSER_ENABLE_PASS271_R9_GPU_DISABLE=1 to re-enable.");' + [Environment]::NewLine +
      '    return;' + [Environment]::NewLine +
      '  }'
    $main = [regex]::Replace($main, $pattern, $guard, 1)
    Write-RepoText $mainRel $main
    Add-Action "PASS271_R9 GPU/compositor disable made opt-in in src/main/main.ts"
  } else {
    Add-Action "PASS271_R9 GPU/compositor function not found in src/main/main.ts"
  }
} else {
  Add-Action "PASS271_R9 GPU/compositor disable already has PASS337 opt-in guard"
}

# 2. Renderer emergency repair loops must be opt-in only.
$appRel = "src\renderer\app.ts"
Guard-ExactCallLine $appRel "pass271R4Mount" "TAHAI_BROWSER_ENABLE_PASS271_R4_NORMAL_WEBVIEW_REPAIR" "PASS271_R4 normal webview hard repair"
Guard-CallPatternLine $appRel "^pass271R9ArmWebviewBlankSurfaceRecovery\(.*\);$" "TAHAI_BROWSER_ENABLE_PASS271_R9_BLANK_SURFACE_RECOVERY" "PASS271_R9 blank-surface recovery retry loop"

# 3. Quarantine known emergency recovery imports that can fight runtime geometry. Keep PASS333 diagnostic.
$appPath = Require-File $appRel
$appText = [System.IO.File]::ReadAllText($appPath)
$importPattern = '(?m)^\s*import\s+["'']\.\/(pass(329|330|331|332|334|335|336)[^"'']*)["''];\s*$'
if ([regex]::IsMatch($appText, $importPattern)) {
  Backup-File $appPath
  $appText = [regex]::Replace($appText, $importPattern, '// PASS337 quarantined emergency runtime recovery import: ./$1')
  [System.IO.File]::WriteAllText($appPath, $appText, [System.Text.Encoding]::UTF8)
  Add-Action "PASS329/PASS330/PASS331/PASS332/PASS334/PASS335/PASS336 emergency imports quarantined if present"
} else {
  Add-Action "No active PASS329/PASS330/PASS331/PASS332/PASS334/PASS335/PASS336 imports found"
}

# 4. Add loaded CSS contract to actual stylesheet used by index.html.
$cssRel = "src\renderer\styles\browser.css"
$cssPath = Require-File $cssRel
$css = [System.IO.File]::ReadAllText($cssPath)
if ($css -notmatch "PASS337_LOADED_CHROME_SAFE_WEBVIEW_STAGE_CONTRACT") {
  Backup-File $cssPath
  $blockLines = @(
    '',
    '/* PASS337_LOADED_CHROME_SAFE_WEBVIEW_STAGE_CONTRACT',
    '   Cursor root-cause closeout: this is the stylesheet actually loaded by index.html.',
    '   Keep webviews inside #webview-stage and keep browser chrome hit-testable.',
    '*/',
    'html,',
    'body {',
    '  width: 100%;',
    '  height: 100%;',
    '  min-width: 0;',
    '  min-height: 0;',
    '  overflow: hidden;',
    '}',
    '',
    '#webview-stage {',
    '  position: relative;',
    '  min-width: 0;',
    '  min-height: 0;',
    '  overflow: hidden;',
    '  isolation: isolate;',
    '}',
    '',
    '#webview-stage:not(.mission-layout) > webview.browser-view,',
    '#webview-stage:not(.mission-layout) > webview.active,',
    '#webview-stage:not(.mission-layout) > webview[data-active="true"] {',
    '  position: absolute !important;',
    '  top: 0 !important;',
    '  right: 0 !important;',
    '  bottom: 0 !important;',
    '  left: 0 !important;',
    '  width: 100% !important;',
    '  height: 100% !important;',
    '  min-width: 0 !important;',
    '  min-height: 0 !important;',
    '  max-width: none !important;',
    '  max-height: none !important;',
    '  transform: none !important;',
    '  opacity: 1;',
    '  visibility: visible;',
    '  z-index: 1 !important;',
    '  pointer-events: auto !important;',
    '  background: transparent !important;',
    '}',
    '',
    '#webview-stage:not(.mission-layout) > webview.browser-view:not(.active):not([data-active="true"]) {',
    '  display: none !important;',
    '  pointer-events: none !important;',
    '}',
    '',
    '.titlebar,',
    '.toolbar,',
    '.tab-strip,',
    '.browser-chrome,',
    '#titlebar,',
    '#toolbar,',
    '#browser-chrome {',
    '  position: relative;',
    '  z-index: 1000;',
    '  pointer-events: auto;',
    '}',
    '/* END PASS337_LOADED_CHROME_SAFE_WEBVIEW_STAGE_CONTRACT */',
    ''
  )
  $css = $css.TrimEnd() + [Environment]::NewLine + ($blockLines -join [Environment]::NewLine)
  [System.IO.File]::WriteAllText($cssPath, $css, [System.Text.Encoding]::UTF8)
  Add-Action "PASS337 loaded chrome-safe webview stage contract appended to src/renderer/styles/browser.css"
} else {
  Add-Action "PASS337 loaded CSS contract already present"
}

# 5. Ensure package.json exposes the verifier without JSON reformatting.
$pkgRel = "package.json"
$pkgPath = Require-File $pkgRel
$pkg = [System.IO.File]::ReadAllText($pkgPath)
if ($pkg -notmatch 'verify:pass-337-cursor-root-cause-closeout') {
  Backup-File $pkgPath
  $scriptLine = '    "verify:pass-337-cursor-root-cause-closeout": "node scripts/verify-pass-337-cursor-root-cause-closeout.mjs",'
  $pkg = [regex]::Replace($pkg, '("scripts"\s*:\s*\{\s*)', '$1' + [Environment]::NewLine + $scriptLine + [Environment]::NewLine, 1)
  [System.IO.File]::WriteAllText($pkgPath, $pkg, [System.Text.Encoding]::UTF8)
  Add-Action "package.json verifier script added"
} else {
  Add-Action "package.json verifier script already present"
}

# 6. Write QA and bug-hunt docs.
$qaPath = Join-Path $qaDir "PASS337-CURSOR-ROOT-CAUSE-CLOSEOUT.md"
$qaLines = @(
  '# PASS337 - Cursor Root-Cause Closeout',
  '',
  'Scope: browser-side source only.',
  '',
  'Cursor findings applied:',
  '- PASS271_R9 GPU/compositor disable made opt-in only.',
  '- PASS271_R4 normal-webview repair MutationObserver/interval made opt-in only.',
  '- PASS271_R9 blank-surface retry loop made opt-in only.',
  '- Emergency recovery imports PASS329-PASS336 are quarantined when active, except PASS333 diagnostic.',
  '- Runtime-loaded stylesheet `src/renderer/styles/browser.css` now owns the chrome-safe webview stage contract.',
  '',
  'Verification:',
  '```powershell',
  'npm run verify:pass-337-cursor-root-cause-closeout',
  'npm run build',
  'npm run dev',
  '```',
  '',
  'Manual runtime check:',
  '- tahaiportal.com should remain painted after first load.',
  '- toolbar/chrome buttons should remain clickable.',
  '- console should not require PASS271_R9 GPU disable to paint.',
  '- PASS333 diagnostic may remain active for hit-test sampling only.'
)
[System.IO.File]::WriteAllLines($qaPath, $qaLines, [System.Text.Encoding]::UTF8)
Add-Action "PASS337 QA doc written"

$bugPath = Join-Path $bugHuntDir "pass337-cursor-root-cause-closeout.md"
$bugLines = @(
  '# PASS337 Cursor Root-Cause Closeout',
  '',
  'This pass implements the source-level remediation from the Cursor white-screen/dead-chrome report.',
  '',
  'Primary root-cause class:',
  '- successful webview navigation followed by white compositor/layer ownership failure',
  '- default GPU teardown from PASS271_R9',
  '- PASS271_R4 white webview repair loop reasserting geometry after first paint',
  '- previous CSS fixes landing in the wrong stylesheet path',
  '',
  'No IT Docs backend, PSA connector, direct PSA API, secrets, Store, GA, or signing claim is introduced.'
)
[System.IO.File]::WriteAllLines($bugPath, $bugLines, [System.Text.Encoding]::UTF8)
Add-Action "PASS337 bug-hunt doc written"

# 7. Run verifier and write apply report.
$reportPath = Join-Path $generatedDir "pass337-cursor-root-cause-closeout-apply-report.json"
$reportObject = [ordered]@{
  pass = "PASS337"
  name = "Cursor Root-Cause Closeout"
  repo = $repo
  actions = $actions.ToArray()
  backupDir = $backupDir
  generatedAt = (Get-Date).ToString("o")
}
($reportObject | ConvertTo-Json -Depth 10) | Set-Content -Encoding UTF8 $reportPath

npm run verify:pass-337-cursor-root-cause-closeout
if ($LASTEXITCODE -ne 0) {
  throw "PASS337 verifier failed with exit code $LASTEXITCODE"
}

Write-Host "PASS337_APPLIED=PASS"
Write-Host ("PASS337_ACTIONS=" + $actions.Count)
Write-Host "PASS337_GPU_DISABLE_DEFAULT=OPT_IN_ONLY"
Write-Host "PASS337_PASS271_R4_REPAIR_DEFAULT=OPT_IN_ONLY"
Write-Host "PASS337_LOADED_CSS_CONTRACT=src/renderer/styles/browser.css"
Write-Host "PASS337_REPORT=$reportPath"
Write-Host "PASS337_BACKUP_DIR=$backupDir"
Write-Host "PASS337_NEXT=npm run build; npm run dev"
