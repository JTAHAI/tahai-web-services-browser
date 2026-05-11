# PASS139 — Linux RPM/AppImage/DEB Handoff Closeout

PASS139 closes the Linux package handoff lane for RPM, AppImage, and DEB installers.

## Scope

Browser-side packaging only. This pass does not add IT Docs backend code, PSA connector code, direct PSA API calls, secrets, cloud credentials, generated installers, or runtime browser profiles to source.

## Target modes

The guarded Linux builder now accepts these target modes:

- `all` / `release` / `linux` — build AppImage, DEB, and RPM.
- `AppImage` / `appimage` — build and hand off only the AppImage.
- `deb` / `debian` — build and hand off only the DEB.
- `rpm` / `fedora` — build and hand off only the RPM.

Target-specific builds must not falsely require unrelated artifacts. For example, `npm run package:linux:rpm` should produce and verify the RPM handoff without requiring AppImage or DEB output.

## Handoff output

After a successful Linux package build, the generated handoff is written under:

```text
release/linux/
```

The directory is regenerated for the selected target set and contains only the selected installer artifacts plus handoff files:

```text
TAHAI-Web-Services-Browser-1.8.30-x64.AppImage
TAHAI-Web-Services-Browser-1.8.30-x64.deb
TAHAI-Web-Services-Browser-1.8.30-x64.rpm
TAHAI-Linux-installers-SHA256SUMS.txt
TAHAI-Linux-installers-manifest.json
TAHAI-Linux-installers-manifest.txt
```

A target-specific build contains only that target. An RPM-only build leaves the RPM, checksum file, JSON manifest, and text manifest.

## TAHAI OS/SENTINEL consumer contract

TAHAI OS/SENTINEL can consume the RPM handoff from `release/linux/TAHAI-Web-Services-Browser-1.8.30-x64.rpm` and verify it with `TAHAI-Linux-installers-SHA256SUMS.txt` and `TAHAI-Linux-installers-manifest.json` without guessing electron-builder output names.

The PASS139 JSON manifest uses `schemaVersion: 2`, `pass: PASS139`, `supersedesPass: PASS126`, `targetMode`, `requestedTargets`, and per-artifact `target`, `file`, `bytes`, and `sha256` fields.

## Verification

From Windows PowerShell:

```powershell
Set-Location C:\dev\browser\app
npm run build
npm run verify:public-repo
npm run verify:pass-139-linux-package-handoff-closeout
```

From Fedora WSL:

```bash
wsl -d FedoraLinux-43 --cd /mnt/c/dev/browser/app
/usr/bin/npm ci
/usr/bin/npm run build
/usr/bin/npm run diagnose:linux:rpm-toolchain
/usr/bin/npm run package:linux:rpm
/usr/bin/npm run verify:linux-installer-handoff -- rpm
```

Optional full-target validation:

```bash
/usr/bin/npm run package:linux
/usr/bin/npm run verify:linux-installer-handoff -- all
/usr/bin/npm run package:linux:appimage
/usr/bin/npm run verify:linux-installer-handoff -- appimage
/usr/bin/npm run package:linux:deb
/usr/bin/npm run verify:linux-installer-handoff -- deb
```

## Source hygiene

`release/`, `*.AppImage`, `*.deb`, `*.rpm`, `*.zip`, `artifacts/`, and `.pass-runs/` remain excluded from source. PASS139 verifier checks those exclusions so installer output and handoff manifests stay generated artifacts.
