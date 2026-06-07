# PASS146 Windows installed-app smoke evidence runner.
# Source-only helper. Generated evidence is written under artifacts/ and must not be committed.
[CmdletBinding()]
param(
  [string]$InstalledExePath,
  [ValidateSet('nsis','msi','portable','unknown')]
  [string]$InstallerType = 'unknown',
  [string]$InstallerPath,
  [string]$ExpectedVersion = '2.0.14',
  [switch]$Launch,
  [switch]$Force,
  [string]$OutputDir = 'artifacts/windows-installed-smoke',
  [string]$OperatorNotes = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-CandidateExe {
  param([string]$ExplicitPath)
  $candidates = @()
  if ($ExplicitPath) { $candidates += $ExplicitPath }
  $candidates += @(
    (Join-Path $env:LOCALAPPDATA 'Programs\TAHAI Web Services Browser\TAHAI Web Services Browser.exe'),
    (Join-Path $env:ProgramFiles 'TAHAI Web Services Browser\TAHAI Web Services Browser.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'TAHAI Web Services Browser\TAHAI Web Services Browser.exe')
  ) | Where-Object { $_ -and $_.Trim().Length -gt 0 }

  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }
  return $null
}

function Get-Sha256Hex {
  param([string]$PathValue)
  $hashCommand = Get-Command Get-FileHash -ErrorAction SilentlyContinue
  if ($hashCommand) {
    return (Get-FileHash -LiteralPath $PathValue -Algorithm SHA256).Hash.ToLowerInvariant()
  }

  $stream = [System.IO.File]::OpenRead($PathValue)
  try {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
      $bytes = $sha.ComputeHash($stream)
      return ([System.BitConverter]::ToString($bytes) -replace '-', '').ToLowerInvariant()
    } finally {
      $sha.Dispose()
    }
  } finally {
    $stream.Dispose()
  }
}

function Get-FileEvidence {
  param([string]$PathValue)
  if (-not $PathValue -or -not (Test-Path -LiteralPath $PathValue -PathType Leaf)) { return $null }
  $item = Get-Item -LiteralPath $PathValue
  $version = $item.VersionInfo
  [ordered]@{
    path = $item.FullName
    sizeBytes = $item.Length
    sha256 = Get-Sha256Hex -PathValue $item.FullName
    productName = $version.ProductName
    productVersion = $version.ProductVersion
    fileVersion = $version.FileVersion
    companyName = $version.CompanyName
    lastWriteTimeUtc = $item.LastWriteTimeUtc.ToString('o')
  }
}

$isWindowsHost = [System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform([System.Runtime.InteropServices.OSPlatform]::Windows)
if (-not $isWindowsHost) {
  throw 'PASS146 Windows installed-app smoke runner must be executed from Windows PowerShell/PowerShell on Windows.'
}

$repoRoot = (Resolve-Path '.').Path
$resolvedExe = Resolve-CandidateExe -ExplicitPath $InstalledExePath
if (-not $resolvedExe) {
  throw 'Installed TAHAI Web Services Browser executable was not found. Pass -InstalledExePath or install the NSIS/MSI preview first.'
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$jsonPath = Join-Path $OutputDir "PASS146-windows-installed-smoke-evidence-$stamp.json"
$mdPath = Join-Path $OutputDir "PASS146-windows-installed-smoke-evidence-$stamp.md"

$exeEvidence = Get-FileEvidence -PathValue $resolvedExe
$installerEvidence = Get-FileEvidence -PathValue $InstallerPath
$manifestCandidates = @(
  'release/windows/TAHAI-Windows-installers-manifest.json',
  'release/windows/TAHAI-Windows-installers-manifest.txt',
  'release/windows/TAHAI-Windows-installers-SHA256SUMS.txt'
)
$manifestEvidence = foreach ($candidate in $manifestCandidates) {
  if (Test-Path -LiteralPath $candidate -PathType Leaf) { Get-FileEvidence -PathValue $candidate }
}

$launchEvidence = [ordered]@{
  attempted = [bool]$Launch
  started = $false
  processId = $null
  warning = $null
}
if ($Launch) {
  $proc = Start-Process -FilePath $resolvedExe -PassThru
  Start-Sleep -Seconds 4
  $launchEvidence.started = -not $proc.HasExited
  $launchEvidence.processId = $proc.Id
  if (-not $Force) {
    $launchEvidence.warning = 'Runner launched the app only. Complete the manual checklist, capture screenshots separately, then close the app yourself.'
  }
}

$manualChecklist = @(
  'installer-checksum-verified',
  'installer-completes-cleanly',
  'installed-app-launches',
  'about-version-truth',
  'normal-navigation',
  'guide-kb-opens',
  'mission-control-entry',
  'split-triview-quad-entry',
  'small-window-reflow',
  'active-pane-routing',
  'evidence-export-redaction',
  'devtools-available',
  'no-console-crash-noise',
  'uninstall-clean-path'
) | ForEach-Object {
  [ordered]@{
    id = $_
    status = 'manual-pending'
    evidence = ''
  }
}

$versionLooksExpected = $false
foreach ($value in @($exeEvidence.productVersion, $exeEvidence.fileVersion)) {
  if ($value -and $value.ToString().Contains($ExpectedVersion)) { $versionLooksExpected = $true }
}

$evidence = [ordered]@{
  pass = 'PASS146'
  product = 'TAHAI Web Services Browser'
  expectedVersion = $ExpectedVersion
  installerType = $InstallerType
  collectedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
  repoRoot = $repoRoot
  windows = [ordered]@{
    computerName = $env:COMPUTERNAME
    userName = $env:USERNAME
    os = (Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version, BuildNumber, OSArchitecture)
    powershellVersion = $PSVersionTable.PSVersion.ToString()
  }
  installedExecutable = $exeEvidence
  installer = $installerEvidence
  releaseManifestFiles = @($manifestEvidence)
  launch = $launchEvidence
  versionLooksExpected = $versionLooksExpected
  manualChecklist = @($manualChecklist)
  operatorNotes = $OperatorNotes
  redactionReminder = 'Do not include secrets, cookies, tokens, customer screenshots, or raw customer data in attached notes/screenshots.'
}

$evidence | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $jsonPath -Encoding UTF8

$md = @"
# PASS146 Windows Installed-App Smoke Evidence

- Product: TAHAI Web Services Browser
- Expected version: $ExpectedVersion
- Installer type: $InstallerType
- Collected UTC: $($evidence.collectedAtUtc)
- Installed executable: $resolvedExe
- Executable SHA256: $($exeEvidence.sha256)
- Version looks expected: $versionLooksExpected
- Launch attempted: $($launchEvidence.attempted)
- Launch started: $($launchEvidence.started)

## Manual checklist

Mark each item in the JSON after completing the installed-app smoke run:

$($manualChecklist | ForEach-Object { "- [ ] $($_.id)" } | Out-String)

## Redaction reminder

Do not include secrets, cookies, tokens, customer screenshots, or raw customer data in attached notes/screenshots.
"@
$md | Set-Content -LiteralPath $mdPath -Encoding UTF8

Write-Host "PASS146_WINDOWS_INSTALLED_SMOKE_EVIDENCE_JSON=$jsonPath"
Write-Host "PASS146_WINDOWS_INSTALLED_SMOKE_EVIDENCE_MD=$mdPath"
if (-not $versionLooksExpected) {
  Write-Warning "Installed executable version fields did not visibly include expected version $ExpectedVersion. Review the JSON before claiming PASS146 installed-app smoke success."
}
