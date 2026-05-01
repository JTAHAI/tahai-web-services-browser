# PASS 56 — Linux installer config repair

This pass repairs the electron-builder 26 configuration break and makes Linux packaging first-class.

## Changes
- Removed unsupported `win.publisherName` from `electron-builder.yml`.
- Removed unsupported `build.win.publisherName` from `package.json`.
- Added `package:linux:release` for AppImage, deb, and rpm builds.
- Added `package:linux:wsl` to run Linux packaging from Ubuntu or Fedora WSL.
- Added Linux installer config verifier.
- Added Linux installer artifact verifier.
- Added WSL build helper script with explicit unsigned build posture.
- Bumped version to `1.8.30`.

## Build targets
- AppImage
- deb
- rpm

## Primary local command

```bash
npm run package:linux:wsl
```
