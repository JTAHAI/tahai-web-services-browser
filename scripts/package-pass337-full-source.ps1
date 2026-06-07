$ErrorActionPreference = "Stop"
$repo = (Get-Location).Path
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outDir = Join-Path $repo "release-candidate\generated"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$outZip = Join-Path $outDir ("TAHAI-browser-pass337-cursor-root-cause-closeout-full-source-" + $stamp + ".zip")
$stage = Join-Path $env:TEMP ("tahai-browser-pass337-source-" + $stamp)
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force -Path $stage | Out-Null

$excludeDirs = @(
  ".git", "node_modules", "dist", "release", ".pass327-backup", ".pass328-backup", ".pass329-backup", ".pass330-backup", ".pass331-backup", ".pass332-backup", ".pass333-backup", ".pass334-backup", ".pass335-backup", ".pass336-backup", ".pass337-backup"
)
$excludeFiles = @("*.msi", "*.exe", "*.msix", "*.appx", "*.msixupload", "*.pfx", "*.p12", "*.pem", "*.key", ".env", ".env.*")

$items = Get-ChildItem -Force $repo
foreach ($item in $items) {
  if ($excludeDirs -contains $item.Name) { continue }
  $dest = Join-Path $stage $item.Name
  if ($item.PSIsContainer) {
    Copy-Item -Force -Recurse $item.FullName $dest
  } else {
    $skip = $false
    foreach ($pattern in $excludeFiles) {
      if ($item.Name -like $pattern) { $skip = $true }
    }
    if (-not $skip) { Copy-Item -Force $item.FullName $dest }
  }
}

# Remove generated binary/archive/secret-looking artifacts that may be nested.
foreach ($pattern in @("*.msi", "*.exe", "*.msix", "*.appx", "*.msixupload", "*.pfx", "*.p12", "*.pem", "*.key", ".env", ".env.*")) {
  Get-ChildItem -Force -Recurse $stage -File -Filter $pattern -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
}
Get-ChildItem -Force -Recurse $stage -Directory -Filter "node_modules" -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Get-ChildItem -Force -Recurse $stage -Directory -Filter "dist" -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Get-ChildItem -Force -Recurse $stage -Directory -Filter "release" -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

if (Test-Path $outZip) { Remove-Item $outZip -Force }
Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $outZip -Force
Remove-Item $stage -Recurse -Force
Write-Host "PASS337_FULL_SOURCE_ZIP=$outZip"
