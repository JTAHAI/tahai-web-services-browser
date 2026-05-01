# Local Build Instructions

These instructions are for developers and visitors who want to build TAHAI Web Services Browser from source.

Current source version: `1.8.30`

Generated installers and packages are intentionally excluded from Git. Build outputs belong in `release/`, which is ignored.

## Requirements

- Node.js 22.x
- npm from the same Node installation
- Git
- Platform-specific packaging host:
  - Windows installers: Windows
  - Linux AppImage/deb/rpm: Linux or Ubuntu 24.04 WSL with a Linux-native build folder
  - macOS dmg/zip: macOS

## Clone and install

```bash
git clone https://github.com/JTAHAI/tahai-web-services-browser.git
cd tahai-web-services-browser
npm ci
```

## Verify source

```bash
npm run verify:public-repo
npm run verify:release-blockers
```

## Run development build

```bash
npm run dev
```

## Windows: build EXE and MSI

Run from Windows PowerShell:

```powershell
$ErrorActionPreference = "Stop"
Set-Location C:\dev\browser\app
npm ci
npm run verify:release-blockers
Remove-Item .\release -Recurse -Force -ErrorAction SilentlyContinue
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npm run package:win:release
```

Expected outputs:

```text
release\TAHAI-Web-Services-Browser-1.8.30-x64.exe
release\TAHAI-Web-Services-Browser-1.8.30-x64.msi
```

Notes:

- Current public preview Windows installers may be unsigned until the signing lane is active.
- Windows SmartScreen may warn on unsigned local builds.
- Do not commit `release/`, `.exe`, `.msi`, or generated zips.

## Linux: build AppImage, deb, and rpm from WSL Ubuntu

Do not reuse `/mnt/c/.../node_modules` for Linux packaging. The build script mirrors the repo into a Linux-native folder under `$HOME` and installs Linux-native dependencies there.

From Windows PowerShell:

```powershell
wsl -d Ubuntu-24.04 --cd /mnt/c/dev/browser/app -- bash -lc 'set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
hash -r
cd ~
sudo chown -R "$USER:$USER" "$HOME/tahai-browser-linux-build" 2>/dev/null || true
sudo chmod -R u+rwX "$HOME/tahai-browser-linux-build" 2>/dev/null || true
sudo rm -rf "$HOME/tahai-browser-linux-build"
cd /mnt/c/dev/browser/app
git pull --ff-only origin main
bash scripts/build-linux-installers.sh
'
```

Expected copied outputs on Windows:

```text
C:\dev\browser\app\release\linux\TAHAI-Web-Services-Browser-1.8.30-x64.AppImage
C:\dev\browser\app\release\linux\TAHAI-Web-Services-Browser-1.8.30-x64.deb
C:\dev\browser\app\release\linux\TAHAI-Web-Services-Browser-1.8.30-x64.rpm
```

The script fails if it detects Windows node/npm interop, a `/mnt/c` packaging working directory, missing `dist/main/main.js`, or missing/suspiciously small Linux artifacts.

## Linux: build from a native Linux checkout

```bash
npm ci
npm run package:linux:release
```

Single-target builds:

```bash
npm run package:linux:appimage
npm run package:linux:deb
npm run package:linux:rpm
```

## Linux install examples

AppImage:

```bash
chmod +x TAHAI-Web-Services-Browser-1.8.30-x64.AppImage
./TAHAI-Web-Services-Browser-1.8.30-x64.AppImage
```

Ubuntu/Debian-family:

```bash
sudo apt install ./TAHAI-Web-Services-Browser-1.8.30-x64.deb
```

Fedora/RHEL-family:

```bash
sudo dnf install ./TAHAI-Web-Services-Browser-1.8.30-x64.rpm
```

## macOS: local developer packages

macOS packaging must be run on macOS. Cross-building macOS installers from Windows or Linux is not the supported path.

Intel build:

```bash
npm ci
npm run verify:public-repo
npm run build
npx electron-builder --mac dmg zip --x64 --config electron-builder.yml
```

Apple Silicon build:

```bash
npm ci
npm run verify:public-repo
npm run build
npx electron-builder --mac dmg zip --arm64 --config electron-builder.yml
```

Signed/notarized public macOS releases require Apple Developer signing and notarization configuration. Unsigned macOS outputs should be treated as local developer packages only.

## Release hygiene

Before publishing any artifact:

```bash
npm run verify:public-repo
npm run verify:mission-tabs-security
npm run verify:release-blockers
```

Publish release artifacts through GitHub Releases or official TAHAI download pages with SHA256 checksums.
