# TAHAI Web Services Browser

[![Validate Source](https://github.com/JTAHAI/tahai-web-services-browser/actions/workflows/validate-source.yml/badge.svg)](https://github.com/JTAHAI/tahai-web-services-browser/actions/workflows/validate-source.yml)

TAHAI Web Services Browser is a Chromium-compatible Electron browser workbench for developers, DevOps operators, IT engineers, and builders who want a more operationally useful browser surface.

It is designed as a polished TAHAI-branded launchpad for developer workflows, DevOps workflows, IT engineering workflows, provider consoles, AI/BYOK workflows, operational documentation, and local-first browser workbench patterns.

## Current status

Version: `1.8.0`

This is an early friend-feedback preview.

The current Windows preview installer is unsigned. Windows SmartScreen may show a warning. Only install preview builds downloaded directly from TAHAI Web Services or from the official GitHub Releases page for this repository.

Open-source publication and code signing are in progress.

## Known preview limitation

Keyboard back/forward shortcuts work, including `Alt+Left` and `Alt+Right`. Dedicated mouse back/forward buttons are scheduled for the next browser navigation parity pass.

## Source license

This repository is licensed under the Apache License, Version 2.0.

See `LICENSE`, `NOTICE`, and `TRADEMARKS.md`.

The source code is open source. TAHAI trademarks and official release identity remain protected.

## Installers and releases

Generated installers, `.exe`, `.msi`, zips, `release/`, `dist/`, and local runtime profiles are intentionally not committed to the source repository.

Installers should be distributed through GitHub Releases or official TAHAI download pages with checksums.

## Local development

```powershell
npm ci
npm run verify:release-blockers
npm run dev
```

## Windows preview build

```powershell
$ErrorActionPreference = "Stop"
Set-Location C:\dev\browser\app
npm ci
npm run verify:release-blockers
Remove-Item .\release -Recurse -Force -ErrorAction SilentlyContinue
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npm run package:win:release
npm run release:friend:zip
```

## Public verification

```powershell
npm run verify:public-repo
npm run verify:release-blockers
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

