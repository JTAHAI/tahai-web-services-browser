# TAHAI Web Services Browser

[![Validate Source](https://github.com/JTAHAI/tahai-web-services-browser/actions/workflows/validate-source.yml/badge.svg)](https://github.com/JTAHAI/tahai-web-services-browser/actions/workflows/validate-source.yml)

TAHAI Web Services Browser is a Chromium-compatible Electron browser workbench for developers, DevOps operators, IT engineers, support desks, and builders who want a clean browser that can become an operational command surface when needed.

Chrome is a browser. Edge is a productivity browser. **TAHAI is an IT/DevOps command browser.** Normal mode stays clean. Ops Mode opens Mission Control.

## Latest tested build

| Item | Status |
| --- | --- |
| Current source version | `1.8.30` |
| Windows packaging | NSIS `.exe` and MSI `.msi` generated successfully |
| Linux packaging | Linux RC1 generated successfully: AppImage, `.deb`, `.rpm` |
| macOS packaging | Developer build instructions provided; public signing/notarization lane not yet configured |
| Windows signing | Unsigned preview until the approved signing lane is active |
| Public repo lane | Open-source browser lane; no credential vault or provider-secret storage code |

Expected Windows outputs:

```text
release\TAHAI-Web-Services-Browser-1.8.30-x64.exe
release\TAHAI-Web-Services-Browser-1.8.30-x64.msi
```

Expected Linux RC1 outputs:

```text
release/linux/TAHAI-Web-Services-Browser-1.8.30-x64.AppImage
release/linux/TAHAI-Web-Services-Browser-1.8.30-x64.deb
release/linux/TAHAI-Web-Services-Browser-1.8.30-x64.rpm
```

Linux Builder may emit native architecture names internally, such as `x86_64.AppImage`, `amd64.deb`, and `x86_64.rpm`. The WSL build script copies those back into `release/linux/` with canonical `x64` release filenames.

## Download, build, verify

| User goal | Start here |
| --- | --- |
| Download a release | Use GitHub Releases or official TAHAI download pages only. Compare SHA256 checksums before installing. |
| Build on Windows | See [Local Build Instructions](docs/local-builds.md#windows-build-exe-and-msi). |
| Build Linux AppImage/deb/rpm | See [Local Build Instructions](docs/local-builds.md#linux-build-appimage-deb-and-rpm-from-wsl-ubuntu). |
| Build on macOS | See [Local Build Instructions](docs/local-builds.md#macos-local-developer-packages). |
| Verify checksums | See [Downloads and Checksums](docs/downloads-and-checksums.md). |
| Troubleshoot WSL/build issues | See [Build Troubleshooting](docs/troubleshooting-builds.md). |
| Review known issues | See [Known Issues](docs/known-issues.md). |

## What this browser is

- A Chromium-compatible browser shell focused on IT, DevOps, cloud, provider-console, documentation, and BYOK workflows.
- A clean normal-mode browser with optional Ops Mode / Mission Control.
- A local-first mission/workspace browser that remembers operational context, not just URLs.
- A public open-source project that must remain safe to inspect, fork, audit, and build without leaking secrets.

## What this browser is not

- Not a secret vault.
- Not a PSA connector host.
- Not an IT Docs backend.
- Not a cloud-provider credential manager.
- Not a place to store bearer tokens, OAuth refresh tokens, PSA API keys, customer secrets, copied cookies, or copied auth headers.

## Mission Control direction

Mission Control = Mission Tabs + Mission Views + Mission Tools + Mission Evidence.

The browser may support local mission state, layouts, launch recipes, evidence metadata, redaction, and validated references. IT Docs and PSA integrations are browser-side contracts only in this repository. Actual authorization, server-side writes, and PSA connectors belong outside this public browser repo.

## Source license

This repository is licensed under the Apache License, Version 2.0.

See `LICENSE`, `NOTICE`, and `TRADEMARKS.md`.

The source code is open source. TAHAI trademarks and official release identity remain protected.

## Repository hygiene

Generated installers, `.exe`, `.msi`, `.AppImage`, `.deb`, `.rpm`, `.dmg`, generated zips, `release/`, `dist/`, `node_modules/`, local runtime profiles, caches, cookies, secrets, certificates, and private mission/evidence data are intentionally not committed to the source repository.

The public browser lane must not include credential-vault or provider-secret storage code. If stale files reappear after a ZIP overlay, clean mirror the source rather than expanding over the repo in place.

## Prerequisites

Use Node.js 22.x for packaging. Electron Builder 26 and the current dependency tree expect modern Node 22 tooling.

```bash
node -v
npm -v
npm ci
```

## Local development

```bash
npm ci
npm run verify:public-repo
npm run verify:release-blockers
npm run dev
```

On Windows PowerShell:

```powershell
$ErrorActionPreference = "Stop"
Set-Location C:\dev\browser\app
npm ci
npm run verify:public-repo
npm run verify:release-blockers
npm run dev
```

## Build Windows installers

Run from Windows, not WSL:

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

## Build Linux AppImage, deb, and rpm

Use Ubuntu 24.04 WSL or a native Linux checkout. Do not package Linux installers from `/mnt/c/.../node_modules`.

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

The script mirrors the source into `~/tahai-browser-linux-build`, removes stale generated folders, installs Linux-native dependencies, builds the app, packages AppImage/deb/rpm, verifies artifact size, and copies completed installers back to `release/linux/`.

## Build on macOS

macOS packaging must be run on macOS. Cross-building macOS installers from Windows or Linux is not the supported path.

Intel developer build:

```bash
npm ci
npm run verify:public-repo
npm run build
npx electron-builder --mac dmg zip --x64 --config electron-builder.yml
```

Apple Silicon developer build:

```bash
npm ci
npm run verify:public-repo
npm run build
npx electron-builder --mac dmg zip --arm64 --config electron-builder.yml
```

Signed/notarized public macOS releases require Apple Developer signing and notarization configuration. Until that lane is configured, macOS output should be treated as local developer packaging, not a trusted public release.

## Public verification

```bash
npm run verify:public-repo
npm run verify:release-blockers
npm run verify:mission-tabs-security
npm run release:public:verify
```

## Code signing roadmap

1. Publish source publicly on GitHub.
2. Keep source/build outputs cleanly separated.
3. Preserve Apache-2.0 license, NOTICE, and trademark attribution.
4. Add public CI build verification.
5. Apply for open-source signing through SignPath Foundation.
6. Move future Windows releases to a signed installer workflow.

## Code signing policy

See [docs/code-signing-policy.md](docs/code-signing-policy.md).

## Privacy policy

See [docs/privacy-policy.md](docs/privacy-policy.md).
