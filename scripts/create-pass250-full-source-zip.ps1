param(
  [string]$OutputPath = ".\TAHAI-browser-pass250-microsoft-store-submission-evidence-identity-prep-full-source-20260513.zip"
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path ".").Path
$TempRoot = Join-Path $env:TEMP ("tahai-browser-pass250-full-source-" + [guid]::NewGuid().ToString("N"))
$OutputFull = if ([System.IO.Path]::IsPathRooted($OutputPath)) { $OutputPath } else { Join-Path $Root $OutputPath }

$ExcludeDirs = @(".git", "node_modules", "dist", "release", "release-msix", "coverage", "out", ".next", ".vite")
$ExcludeFiles = @("*.zip", "*.7z", "*.tar", "*.gz", "*.msi", "*.exe", "*.msix", "*.msixupload", "*.appx", "*.appxupload", "*.pfx", "*.p12", "*.cer", "*.key", "PartnerCenter*.json", "partner-center*.json")

New-Item -ItemType Directory -Force $TempRoot | Out-Null

$robocopyArgs = @($Root, $TempRoot, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/NP", "/R:1", "/W:1", "/XD") + $ExcludeDirs + @("/XF") + $ExcludeFiles
& robocopy @robocopyArgs | Out-Null
$rc = $LASTEXITCODE
if ($rc -gt 7) {
  Remove-Item -Recurse -Force $TempRoot -ErrorAction SilentlyContinue
  throw "robocopy failed with exit code $rc"
}

if (Test-Path $OutputFull) {
  Remove-Item -Force $OutputFull
}
Compress-Archive -Path (Join-Path $TempRoot "*") -DestinationPath $OutputFull -Force
Remove-Item -Recurse -Force $TempRoot -ErrorAction SilentlyContinue

Write-Host "PASS250_FULL_SOURCE_ZIP=PASS"
Write-Host "PASS250_FULL_SOURCE_ZIP_PATH=$OutputFull"
