$ErrorActionPreference = "Stop"
$AppRoot = Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\..")
Set-Location $AppRoot
Write-Host "TAHAI_BROWSER_PUBLIC_RELEASE_CANDIDATE_START=1"
$Package = Get-Content .\package.json -Raw | ConvertFrom-Json
$Version = [string]$Package.version
$ReleaseDir = Join-Path $AppRoot "release"
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
Get-Process | Where-Object { $_.ProcessName -eq "TAHAI Web Services Browser" -or $_.ProcessName -eq "electron" } | ForEach-Object {
  try { Stop-Process -Id $_.Id -Force -ErrorAction Stop; Write-Host "TAHAI_BROWSER_PUBLIC_RC_STOPPED_PROCESS=$($_.Id)" } catch { Write-Warning "Could not stop process $($_.Id): $($_.Exception.Message)" }
}
npm run clean:release:windows
npm run release:public:verify
npm run package:win:release
npm run release:friend:zip
npm run release:public:manifest
$Manifest = Join-Path $ReleaseDir "public-release-candidate-manifest.json"
$ShaSums = Join-Path $ReleaseDir "SHA256SUMS.txt"
if (-not (Test-Path $Manifest)) { throw "public-release-candidate-manifest.json was not created." }
if (-not (Test-Path $ShaSums)) { throw "SHA256SUMS.txt was not created." }
$Installers = Get-ChildItem $ReleaseDir -File | Where-Object { $_.Extension -in @(".exe", ".msi", ".zip") }
if ($Installers.Count -lt 1) { throw "No public RC artifacts found in $ReleaseDir." }
$Truth = [ordered]@{
  product = "TAHAI Web Services Browser"; version = $Version; channel = "public-release-candidate"; unsigned = $true; generatedAt = (Get-Date).ToUniversalTime().ToString("o"); manifest = "public-release-candidate-manifest.json"; sha256 = "SHA256SUMS.txt"; githubReleaseNotes = "docs/github-release-notes-1.8.21.md"; browserDownloadCopy = "docs/browser-download-page-copy.md";
  artifacts = @($Installers | ForEach-Object { [ordered]@{ name = $_.Name; bytes = $_.Length; sha256 = (Get-FileHash -Algorithm SHA256 -Path $_.FullName).Hash.ToLowerInvariant() } })
}
$Truth | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $ReleaseDir "public-rc-truth.json") -Encoding UTF8
Write-Host "TAHAI_BROWSER_PUBLIC_RELEASE_CANDIDATE_OK=1 version=$Version path=$ReleaseDir"
