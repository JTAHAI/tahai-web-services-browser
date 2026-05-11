$ErrorActionPreference = "Stop"

$AppRoot = Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..")
Set-Location $AppRoot

$Package = Get-Content .\package.json -Raw | ConvertFrom-Json
$Version = [string]$Package.version
$ProductName = [string]$Package.productName
$AppId = [string]$Package.build.appId
$ReleaseDir = Join-Path $AppRoot "release"
# PASS138 handoff path: release\windows
$HandoffDir = Join-Path $ReleaseDir "windows"

if (-not (Test-Path $ReleaseDir)) {
  throw "Release directory not found: $ReleaseDir"
}

if (-not (Test-Path $HandoffDir)) {
  throw "PASS138 Windows handoff directory not found: $HandoffDir. Run npm run package:win:installer or npm run package:win:release first."
}

npm run verify:windows-installer-handoff -- nsis

$WindowsSha = Join-Path $HandoffDir "TAHAI-Windows-installers-SHA256SUMS.txt"
$WindowsManifestJson = Join-Path $HandoffDir "TAHAI-Windows-installers-manifest.json"
$WindowsManifestTxt = Join-Path $HandoffDir "TAHAI-Windows-installers-manifest.txt"
foreach ($HandoffFile in @($WindowsSha, $WindowsManifestJson, $WindowsManifestTxt)) {
  if (-not (Test-Path $HandoffFile)) {
    throw "Required PASS138 Windows handoff file missing: $HandoffFile"
  }
}

function Resolve-ReleaseArtifact {
  param(
    [Parameter(Mandatory=$true)][string[]]$Patterns,
    [Parameter(Mandatory=$true)][string]$Kind,
    [switch]$Required
  )

  $Matches = @()
  foreach ($Pattern in $Patterns) {
    $Matches += Get-ChildItem -Path $ReleaseDir -Filter $Pattern -File -ErrorAction SilentlyContinue
  }
  $Matches = $Matches | Sort-Object LastWriteTimeUtc -Descending -Unique
  if ($Required -and $Matches.Count -eq 0) {
    throw "$Kind artifact not found in $ReleaseDir. Patterns: $($Patterns -join ', ')"
  }
  if ($Matches.Count -gt 0) { return $Matches[0] }
  return $null
}

$Exe = Resolve-ReleaseArtifact -Kind "EXE installer" -Required -Patterns @(
  "TAHAI-Web-Services-Browser-$Version-x64.exe",
  "TAHAI-Web-Services-Browser-$Version-*.exe",
  "*TAHAI*Browser*$Version*.exe",
  "*.exe"
)
$Msi = Resolve-ReleaseArtifact -Kind "MSI installer" -Patterns @(
  "TAHAI-Web-Services-Browser-$Version-x64.msi",
  "TAHAI-Web-Services-Browser-$Version-*.msi",
  "*TAHAI*Browser*$Version*.msi",
  "*.msi"
)

Set-Location $ReleaseDir

$Artifacts = @($Exe)
if ($null -ne $Msi) { $Artifacts += $Msi }

$Artifacts |
  ForEach-Object {
    Get-FileHash $_.FullName -Algorithm SHA256 |
      ForEach-Object { "$($_.Hash)  $([IO.Path]::GetFileName($_.Path))" }
  } | Set-Content .\SHA256SUMS.txt -Encoding UTF8

$Truth = [ordered]@{
  product = $ProductName
  version = $Version
  appId = $AppId
  channel = "friend-feedback-preview"
  signer = "unsigned"
  createdAt = (Get-Date).ToUniversalTime().ToString("o")
  exe = $Exe.Name
  msi = $(if ($null -ne $Msi) { $Msi.Name } else { $null })
  checksums = "SHA256SUMS.txt"
  source = "scripts/create-friend-feedback-release.ps1"
}
$Truth | ConvertTo-Json -Depth 8 | Set-Content .\release-build-truth.json -Encoding UTF8

@"
TAHAI Web Services Browser v$Version Preview
Windows x64
Unsigned friend-feedback build

Install:
Run $($Exe.Name)

Release truth:
- Product: $ProductName
- App ID: $AppId
- Version: $Version
- Signing: unsigned preview
- Checksums: SHA256SUMS.txt
- Machine-readable manifest: release-build-truth.json

Notes:
- Windows may show SmartScreen because this preview build is not code-signed yet.
- Use the EXE installer for normal testing.
- MSI is included only when the builder produced one.

Feedback requested:
- Guide opens.
- DevOps menu opens and has no overlapping text.
- IT Tools menu opens and has no overlapping text.
- Mission Control opens and remains readable at common window sizes.
- Ops Panel opens and is readable.
- About opens browser.tahai.net online and local fallback offline.
- Start/Desktop/taskbar icons look correct after pinning the running app.
"@ | Set-Content .\README-FIRST.txt -Encoding UTF8

$ZipName = "TAHAI-Web-Services-Browser-$Version-Preview-Friend-Feedback.zip"
$Inputs = @($Exe.FullName, (Join-Path $ReleaseDir "SHA256SUMS.txt"), (Join-Path $ReleaseDir "README-FIRST.txt"), (Join-Path $ReleaseDir "release-build-truth.json"), $WindowsSha, $WindowsManifestJson, $WindowsManifestTxt)
if ($null -ne $Msi) { $Inputs += $Msi.FullName }
Compress-Archive -Path $Inputs -DestinationPath (Join-Path $ReleaseDir $ZipName) -Force
Get-Item (Join-Path $ReleaseDir $ZipName) | Select-Object FullName, Length, LastWriteTime
