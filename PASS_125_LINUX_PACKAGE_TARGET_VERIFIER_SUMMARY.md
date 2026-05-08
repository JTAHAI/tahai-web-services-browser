# PASS125 — Linux Package Target Verifier

PASS125 fixes the Linux package closeout gate exposed by the successful RPM-only build path.

## Purpose

`npm run package:linux:rpm` should validate the RPM it was asked to build without failing because AppImage and DEB were not requested.

## Changes

- Makes `scripts/verify-linux-installers.mjs` target-aware.
- Keeps the no-argument verifier behavior strict for full Linux release builds: AppImage, DEB, and RPM remain required when no target is specified.
- Updates `scripts/build-linux-installers.sh` to pass the selected Linux package targets into the verifier.
- Preserves copy-back behavior into `release/linux` after selected target verification succeeds.
- Reconciles PASS124 repair guidance to use Fedora packages that actually resolve the observed failures, including `libxcrypt-compat` for Electron Builder FPM/Ruby `libcrypt.so.1` failures.
- Adds `verify:pass-125-linux-package-target-verifier`.
- Wires PASS125 into `verify:release-blockers` after PASS124 and before final build.

## Scope

Browser-side packaging hardening only. No IT Docs backend work. No PSA connector work. No secrets. No generated installers committed.

Version remains `1.8.30`.
