# PASS138 — Windows Installer Closeout Summary

PASS138 repairs the Windows installer handoff lane so Windows packaging mirrors the Linux handoff discipline.

## Added

- `scripts/write-windows-installer-handoff.mjs`
- `scripts/verify-windows-installer-handoff.mjs`
- `scripts/verify-pass-138-windows-installer-closeout.mjs`
- `docs/windows-installer-closeout-pass138.md`

## Package scripts

- `release:win:manifest`
- `verify:windows-installer-handoff`
- `verify:pass-138-windows-installer-closeout`

## Handoff files

Generated after packaging only:

- `release/windows/TAHAI-Web-Services-Browser-1.8.30-x64.exe`
- `release/windows/TAHAI-Web-Services-Browser-1.8.30-x64.msi`
- `release/windows/TAHAI-Windows-installers-SHA256SUMS.txt`
- `release/windows/TAHAI-Windows-installers-manifest.json`
- `release/windows/TAHAI-Windows-installers-manifest.txt`

## Guardrails

- NSIS-only and MSI-only lanes remain target-specific.
- `package:win:release` builds NSIS + MSI together and writes/verifies the all-target PASS138 handoff.
- `release/windows` remains generated output and must not be committed.
- Version remains `1.8.30`.
