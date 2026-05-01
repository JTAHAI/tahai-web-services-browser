# TAHAI Web Services Browser

[![Validate Source](https://github.com/JTAHAI/tahai-web-services-browser/actions/workflows/validate-source.yml/badge.svg)](https://github.com/JTAHAI/tahai-web-services-browser/actions/workflows/validate-source.yml)

TAHAI Web Services Browser is a Chromium-compatible Electron browser workbench for developers, DevOps operators, IT engineers, support desks, and builders who want a cleaner browser surface that can become an operational command browser when needed.

Chrome is a browser. Edge is a productivity browser. TAHAI is an IT/DevOps command browser. Normal mode stays clean. Ops Mode opens Mission Control.

## Current status

Version: `1.8.30`

This is the current public 1.8.x source baseline for the TAHAI Web Services Browser Mission Control workbench.

Windows installer packaging has been repaired for Electron Builder 26 by removing the invalid `win.publisherName` configuration. The expected Windows artifacts are:

- `TAHAI-Web-Services-Browser-1.8.30-x64.exe`
- `TAHAI-Web-Services-Browser-1.8.30-x64.msi`

Linux packaging is configured for:

- `TAHAI-Web-Services-Browser-1.8.30-x64.AppImage`
- `TAHAI-Web-Services-Browser-1.8.30-x64.deb`
- `TAHAI-Web-Services-Browser-1.8.30-x64.rpm`

The Windows public preview installers are unsigned until the signing lane is active. Windows SmartScreen may show a warning. Only install preview builds downloaded directly from TAHAI Web Services or from the official GitHub Releases page for this repository, and compare published SHA256 checksums before installing.

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
- Not a place to store bearer tokens, OAuth refresh tokens, PSA API keys, customer secrets, or copied auth headers.

## Source license

This repository is licensed under the Apache License, Version 2.0.

See `LICENSE`, `NOTICE`, and `TRADEMARKS.md`.

The source code is open source. TAHAI trademarks and official release identity remain protected.

## Repository hygiene

Generated installers, `.exe`, `.msi`, `.AppImage`, `.deb`, `.rpm`, `.dmg`, generated zips, `release/`, `dist/`, `node_modules/`, local runtime profiles, caches, cookies, secrets, certificates, and private mission/evidence data are intentionally not committed to the source repository.

Installers should be distributed through GitHub Releases or official TAHAI download pages with checksums.

The public browser lane must not include credential-vault or provider-secret storage code. If stale files reappear after a ZIP overlay, clean mirror the source rather than expanding over the repo in place.

## Prerequisites

Use Node.js 22.x for packaging. Electron Builder 26 and the current dependency tree expect modern Node 22 tooling.

Install dependencies from a clean checkout:

```bash
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

Optional friend-feedback bundle:

```powershell
npm run release:friend:zip
```

## Build Linux AppImage, deb, and rpm

Use a Linux-native folder. Do not package Linux installers from `/mnt/c/.../node_modules`.

From Windows, launch Ubuntu 24.04 WSL at the Linux home directory:

```powershell
wsl -d Ubuntu-24.04 --cd ~
```

Inside Ubuntu:

```bash
set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
hash -r

which node
which npm
node -v
npm -v

cd /mnt/c/dev/browser/app
bash scripts/build-linux-installers.sh
```

The script mirrors the source into `~/tahai-browser-linux-build`, removes stale generated folders, installs Linux-native dependencies with `/usr/bin/npm`, builds the app, packages AppImage/deb/rpm, verifies artifact size, and copies the completed installers back to:

```text
C:\dev\browser\app\release\linux
```

Expected outputs:

```text
release/linux/TAHAI-Web-Services-Browser-1.8.30-x64.AppImage
release/linux/TAHAI-Web-Services-Browser-1.8.30-x64.deb
release/linux/TAHAI-Web-Services-Browser-1.8.30-x64.rpm
```

Direct native-Linux packaging from a Linux checkout is also supported:

```bash
npm ci
npm run package:linux:release
```

## Build a deb only

```bash
npm ci
npm run package:linux:deb
```

## Build an rpm only

```bash
npm ci
npm run package:linux:rpm
```

## Build an AppImage only

```bash
npm ci
npm run package:linux:appimage
```

## Build on macOS

macOS packaging must be run on macOS. Cross-building macOS installers from Windows or Linux is not the supported path.

Developer build:

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

Universal or signed/notarized macOS release builds require Apple Developer signing and notarization configuration. Until that lane is configured, macOS output should be treated as local developer packaging, not a trusted public release.

## Public verification

```bash
npm run verify:public-repo
npm run verify:release-blockers
npm run verify:mission-tabs-security
npm run release:public:verify
```

## Build documentation

See [docs/local-builds.md](docs/local-builds.md) for visitor-facing build instructions for Windows, Linux AppImage/deb/rpm, and macOS developer packages.

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
