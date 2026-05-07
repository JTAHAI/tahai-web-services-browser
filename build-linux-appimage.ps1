$ErrorActionPreference = "Stop"

Set-Location C:\dev\browser\app

Write-Host "== TAHAI Web Services Browser Linux AppImage build =="
Write-Host "== Windows preflight =="
npm ci
npm run build
npm run verify:release-blockers

Write-Host "== WSL Linux package pass =="
wsl -d FedoraLinux-43 --cd /mnt/c/dev/browser/app -- bash -lc '
set -euo pipefail

echo "== Linux node/npm preflight =="
node --version
npm --version

echo "== Install Linux dependencies when dnf is available =="
if command -v dnf >/dev/null 2>&1; then
  sudo dnf install -y nodejs npm libsecret rpm-build fakeroot dpkg tar gzip xz
fi

echo "== Install locked dependencies =="
npm ci

echo "== Build source =="
npm run build

echo "== Build AppImage =="
npm run package:linux:appimage

echo "== AppImage outputs =="
find release dist -type f \( -name "*.AppImage" -o -name "*.AppImage.sha512" \) -print 2>/dev/null || true
'

Write-Host "DONE. Check C:\dev\browser\app\release for the AppImage."
