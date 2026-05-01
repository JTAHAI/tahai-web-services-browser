param(
  [switch]$SkipZip
)

$ErrorActionPreference = "Stop"

$AppRoot = Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\..")
Set-Location $AppRoot

$Package = Get-Content .\package.json -Raw | ConvertFrom-Json
$Version = [string]$Package.version
$ProductName = [string]$Package.productName
$ReleaseDir = Join-Path $AppRoot "release"
$UnpackedDir = Join-Path $ReleaseDir "win-unpacked"
$ResourcesDir = Join-Path $UnpackedDir "resources"
$AppResourcesDir = Join-Path $ResourcesDir "app"
$ElectronDist = Join-Path $AppRoot "node_modules\electron\dist"

if (-not (Test-Path $ElectronDist)) {
  throw "Electron runtime not found at $ElectronDist. Run npm ci before packaging."
}

npm run build

if (Test-Path $UnpackedDir) { Remove-Item $UnpackedDir -Recurse -Force }
New-Item -ItemType Directory -Path $UnpackedDir | Out-Null
New-Item -ItemType Directory -Path $AppResourcesDir | Out-Null

Copy-Item (Join-Path $ElectronDist "*") $UnpackedDir -Recurse -Force
$ElectronExe = Join-Path $UnpackedDir "electron.exe"
$ProductExe = Join-Path $UnpackedDir "$ProductName.exe"
if (Test-Path $ElectronExe) { Move-Item $ElectronExe $ProductExe -Force }

Copy-Item .\package.json $AppResourcesDir -Force
Copy-Item .\dist (Join-Path $AppResourcesDir "dist") -Recurse -Force
Copy-Item .\assets (Join-Path $AppResourcesDir "assets") -Recurse -Force
Copy-Item .\build (Join-Path $AppResourcesDir "build") -Recurse -Force
Copy-Item .\browser (Join-Path $ResourcesDir "browser") -Recurse -Force

$Truth = [ordered]@{
  product = $ProductName
  version = $Version
  appId = [string]$Package.build.appId
  channel = "windows-unpacked-preview"
  packagedAt = (Get-Date).ToUniversalTime().ToString("o")
  signer = "unsigned"
  source = "packaging/windows/build-windows-unpacked-zip.ps1"
  executable = "$ProductName.exe"
}
$TruthPath = Join-Path $ReleaseDir "release-build-truth.json"
$Truth | ConvertTo-Json -Depth 8 | Set-Content $TruthPath -Encoding UTF8

if (-not $SkipZip) {
  $ZipPath = Join-Path $ReleaseDir "TAHAI-Web-Services-Browser-$Version-win-unpacked-test.zip"
  if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
  Compress-Archive -Path $UnpackedDir -DestinationPath $ZipPath -Force
  Write-Host "TAHAI_BROWSER_WINDOWS_UNPACKED_ZIP=OK path=$ZipPath"
} else {
  Write-Host "TAHAI_BROWSER_WINDOWS_UNPACKED=OK path=$UnpackedDir"
}
