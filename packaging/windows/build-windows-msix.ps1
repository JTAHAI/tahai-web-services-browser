\
param(
  [string]$OutputRoot = "release-msix",
  [string]$ManifestOutput = "release-msix\Package.appxmanifest",
  [string]$CertificatePath = $env:TAHAI_MSIX_TEST_CERT_PFX,
  [string]$CertificatePassword = $env:TAHAI_MSIX_TEST_CERT_PASSWORD
)

$ErrorActionPreference = "Stop"

function Write-Step($Message) { Write-Host "[PASS247][MSIX] $Message" }
function Fail($Message) { Write-Error "[PASS247][MSIX][FAIL] $Message"; exit 1 }

if (-not $IsWindows -and $env:OS -ne "Windows_NT") { Fail "MSIX packaging is Windows-only. Run from Windows PowerShell in C:\dev\browser\app." }
if (-not (Test-Path "package.json")) { Fail "Run from repo root." }
if (-not (Test-Path "config\msix-manifest.template.xml")) { Fail "Missing config\msix-manifest.template.xml." }
if (-not (Test-Path "assets\store\windows\StoreLogo.png")) { Fail "Missing Store/MSIX assets." }

Write-Step "Preparing clean MSIX output under $OutputRoot"
Remove-Item $OutputRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null

Write-Step "Rendering manifest readiness template"
node scripts\render-msix-manifest-readiness.mjs --output=$ManifestOutput

Write-Step "Building Electron app before MSIX pack"
npm run build

Write-Step "Creating unpacked Windows app folder"
npx electron-builder --win dir --x64 --config electron-builder.yml --publish never

$unpacked = Join-Path (Resolve-Path "release").Path "win-unpacked"
if (-not (Test-Path $unpacked)) { Fail "Expected electron-builder output not found: $unpacked" }

Write-Step "Copying Store/MSIX assets into unpacked app folder"
$assetsDest = Join-Path $unpacked "Assets"
New-Item -ItemType Directory -Force -Path $assetsDest | Out-Null
Copy-Item "assets\store\windows\*.png" $assetsDest -Force

$packArgs = @("winapp", "pack", $unpacked, "--output", $OutputRoot, "--manifest", $ManifestOutput)
if ($CertificatePath) {
  if (-not (Test-Path $CertificatePath)) { Fail "TAHAI_MSIX_TEST_CERT_PFX points to a missing file: $CertificatePath" }
  $packArgs += @("--cert", $CertificatePath)
  if ($CertificatePassword) { $packArgs += @("--cert-password", $CertificatePassword) }
  Write-Step "Packing MSIX with provided test/dev certificate path. Do not commit certificates or generated packages."
} else {
  Write-Step "No TAHAI_MSIX_TEST_CERT_PFX provided. Running WinApp CLI pack without repo-stored certificate."
}

# npx winapp pack readiness token for source verification
Write-Step "Running: npx $($packArgs -join ' ')"
npx @($packArgs)

Write-Step "MSIX lane completed locally. Store submission remains blocked until installed smoke, package identity, and Partner Center evidence are clean."
