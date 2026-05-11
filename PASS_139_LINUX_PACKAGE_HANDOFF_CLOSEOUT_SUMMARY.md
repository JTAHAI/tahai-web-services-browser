# PASS139 — Linux RPM/AppImage/DEB Handoff Closeout

Version remains `1.8.30`.

## Purpose

Close the Linux package handoff lane after Windows installer closeout by making RPM, AppImage, and DEB packaging leave a deterministic, target-aware handoff under `release/linux`.

## Changed

- Added `scripts/write-linux-installer-handoff.mjs`.
- Reworked `scripts/build-linux-installers.sh` to normalize `all`, `rpm`, `deb`, and `AppImage` target modes before invoking electron-builder.
- Reworked Linux handoff generation so target-specific builds do not require unrelated artifacts.
- Updated `scripts/verify-linux-installer-handoff.mjs` for PASS139 schema v2 manifests, target mode checks, stale-artifact rejection, and per-target checksum validation.
- Added `scripts/verify-pass-139-linux-package-handoff-closeout.mjs`.
- Updated `scripts/verify-linux-installers-config.mjs` for the PASS139 writer/verifier contract.
- Added `package:linux`, `release:linux:manifest`, and `verify:pass-139-linux-package-handoff-closeout` scripts.
- Updated `package:linux:release` to use the explicit `all` target mode.
- Wired PASS139 into `verify:release-blockers`.
- Added `docs/linux-package-handoff-pass139.md`.

## Generated handoff after packaging

All-target builds generate:

```text
release/linux/TAHAI-Web-Services-Browser-1.8.30-x64.AppImage
release/linux/TAHAI-Web-Services-Browser-1.8.30-x64.deb
release/linux/TAHAI-Web-Services-Browser-1.8.30-x64.rpm
release/linux/TAHAI-Linux-installers-SHA256SUMS.txt
release/linux/TAHAI-Linux-installers-manifest.json
release/linux/TAHAI-Linux-installers-manifest.txt
```

Target-specific builds generate only the selected installer artifact plus the checksum and manifest files.

## TAHAI OS/SENTINEL handoff

TAHAI OS/SENTINEL can consume the RPM from `release/linux/TAHAI-Web-Services-Browser-1.8.30-x64.rpm` and verify it using the PASS139 checksum and JSON manifest without guessing upstream package names.

## Verification

Validated in this source lane:

```text
npm run build
npm run verify:public-repo
npm run verify:linux-installers-config
npm run verify:pass-139-linux-package-handoff-closeout
```

Linux package generation still requires local Fedora WSL/native Linux execution with the existing RPM/AppImage/DEB toolchain.
