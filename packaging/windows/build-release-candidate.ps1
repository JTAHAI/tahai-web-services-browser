$ErrorActionPreference = "Stop"

$AppRoot = Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\..")
Set-Location $AppRoot

Write-Host "TAHAI_BROWSER_RELEASE_CANDIDATE_START=1"

$Package = Get-Content .\package.json -Raw | ConvertFrom-Json
$Version = [string]$Package.version
$ReleaseDir = Join-Path $AppRoot "release"

# Installer RC builds are intentionally unsigned until a public signing lane is approved.
# This prevents accidental machine-certificate discovery on contributor workstations.
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"

# Avoid locked EXE/package outputs from prior installed-app smoke tests.
Get-Process | Where-Object {
  $_.ProcessName -eq "TAHAI Web Services Browser" -or $_.ProcessName -eq "electron"
} | ForEach-Object {
  try {
    Stop-Process -Id $_.Id -Force -ErrorAction Stop
    Write-Host "TAHAI_BROWSER_RELEASE_CANDIDATE_STOPPED_PROCESS=$($_.Id)"
  } catch {
    Write-Warning "Could not stop process $($_.Id): $($_.Exception.Message)"
  }
}

npm run clean:release:windows
npm run verify:release-blockers
npm run package:win:release
npm run release:friend:zip
npm run release:rc:manifest

$Manifest = Join-Path $ReleaseDir "release-candidate-manifest.json"
$ShaSums = Join-Path $ReleaseDir "SHA256SUMS.txt"
if (-not (Test-Path $Manifest)) { throw "release-candidate-manifest.json was not created." }
if (-not (Test-Path $ShaSums)) { throw "SHA256SUMS.txt was not created." }

$Installers = Get-ChildItem $ReleaseDir -File | Where-Object { $_.Extension -in @(".exe", ".msi", ".zip") }
if ($Installers.Count -lt 1) { throw "No release artifacts found in $ReleaseDir." }

$Truth = [ordered]@{
  product = "TAHAI Web Services Browser"
  version = $Version
  channel = "enterprise-installer-rc"
  unsigned = $true
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  manifest = "release-candidate-manifest.json"
  sha256 = "SHA256SUMS.txt"
  artifacts = @($Installers | ForEach-Object {
    [ordered]@{
      name = $_.Name
      bytes = $_.Length
      sha256 = (Get-FileHash -Algorithm SHA256 -Path $_.FullName).Hash.ToLowerInvariant()
    }
  })
}
$Truth | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $ReleaseDir "installer-rc-truth.json") -Encoding UTF8

Write-Host "TAHAI_BROWSER_RELEASE_CANDIDATE_OK=1 version=$Version path=$ReleaseDir"
