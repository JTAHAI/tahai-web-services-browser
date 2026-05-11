# PASS138 — Windows Installer Closeout

PASS138 closes the Windows installer handoff gap by making the Windows packaging lanes leave a clean, machine-readable handoff under `release/windows` after packaging. Generated installers, copied handoff artifacts, checksum files, and manifests remain build outputs and must not be committed to source.

## Handoff output

After a Windows package build, the handoff directory contains:

- `release/windows/TAHAI-Web-Services-Browser-1.8.30-x64.exe`
- `release/windows/TAHAI-Web-Services-Browser-1.8.30-x64.msi` when MSI is requested
- `release/windows/TAHAI-Windows-installers-SHA256SUMS.txt`
- `release/windows/TAHAI-Windows-installers-manifest.json`
- `release/windows/TAHAI-Windows-installers-manifest.txt`

## Target-specific behavior

The writer supports target-specific modes so NSIS and MSI-only builds do not falsely require the other installer:

- `npm run release:win:manifest -- nsis`
- `npm run release:win:manifest -- msi`
- `npm run release:win:manifest -- all`

The matching verifier accepts the same target names:

- `npm run verify:windows-installer-handoff -- nsis`
- `npm run verify:windows-installer-handoff -- msi`
- `npm run verify:windows-installer-handoff -- all`

## Packaging lanes

- `package:win:installer` builds NSIS, writes the NSIS handoff, and verifies the NSIS handoff.
- `package:win:release` builds NSIS + MSI, writes the all-target handoff, and verifies the all-target handoff.
- `package:win:nsis` builds only NSIS and writes the NSIS handoff.
- `package:win:msi` preserves the PowerShell MSI lane and now writes/verifies the MSI handoff.

## Source hygiene

`release/windows` is a generated directory. It exists only after packaging and must remain excluded from the source ZIP and public repo. PASS138 is enforced by `verify:pass-138-windows-installer-closeout` and is wired into `verify:release-blockers` before PASS139+.
