# PASS140 — Download/install docs and checksum UX

PASS140 closes the public-download handoff gap after the Windows and Linux installer handoff passes. It does not add generated installers to source. It defines the download-page copy, package-selection language, checksum instructions, and stop conditions that must be used when publishing TAHAI Web Services Browser `1.8.30`.

## Scope

- Browser-side source, docs, KB, and verifier work only.
- No IT Docs backend work.
- No PSA connector work.
- No direct PSA API calls.
- No generated installers, release manifests, runtime profiles, caches, `dist/`, `release/`, `artifacts/`, or `node_modules/` committed to source.

## Canonical public-download rule

Every public download surface must show the package file, platform, best-fit use case, signing/preview status, and SHA256 verification path before the install command.

The download page must not present an installer by itself without the checksum material next to it.

## Current artifact matrix

| Platform | Artifact | Best fit | Checksum file |
| --- | --- | --- | --- |
| Windows | `TAHAI-Web-Services-Browser-1.8.30-x64.exe` | Normal Windows preview install | `TAHAI-Windows-installers-SHA256SUMS.txt` |
| Windows | `TAHAI-Web-Services-Browser-1.8.30-x64.msi` | Managed/enterprise MSI testing | `TAHAI-Windows-installers-SHA256SUMS.txt` |
| Linux | `TAHAI-Web-Services-Browser-1.8.30-x64.AppImage` | Portable Linux preview | `TAHAI-Linux-installers-SHA256SUMS.txt` |
| Linux | `TAHAI-Web-Services-Browser-1.8.30-x64.deb` | Ubuntu/Debian family | `TAHAI-Linux-installers-SHA256SUMS.txt` |
| Linux | `TAHAI-Web-Services-Browser-1.8.30-x64.rpm` | Fedora/RHEL family and TAHAI OS/SENTINEL bundling | `TAHAI-Linux-installers-SHA256SUMS.txt` |

Linux package handoff also publishes:

```text
release/linux/TAHAI-Linux-installers-manifest.json
release/linux/TAHAI-Linux-installers-manifest.txt
```

Those files are generated package handoff outputs and must stay out of source.

## Download-page UX requirements

1. Put the checksum link immediately beside the installer link.
2. Label unsigned Windows builds as Unsigned preview builds until signing is active.
3. Give copy/paste verification commands for Windows PowerShell and Linux shells.
4. Clearly state that users should download only from official TAHAI pages or GitHub Releases.
5. State that generated `release/` outputs are not source files and are not committed.
6. For Linux RPM, preserve the PASS139 handoff manifest when feeding TAHAI OS/SENTINEL so downstream scripts do not guess filenames.
7. Do not publish a package if its checksum file or manifest was not generated from the actual artifact in the same packaging run.

## Verification commands for users

Windows PowerShell:

```powershell
$Expected = "REPLACE_WITH_64_CHARACTER_SHA256_FROM_TAHAI-Windows-installers-SHA256SUMS.txt"
$Actual = (Get-FileHash .\TAHAI-Web-Services-Browser-1.8.30-x64.exe -Algorithm SHA256).Hash.ToLowerInvariant()
if ($Actual -ne $Expected.ToLowerInvariant()) { throw "SHA256 mismatch" }
"SHA256 OK"
```

Linux:

```bash
grep 'TAHAI-Web-Services-Browser-1.8.30-x64.AppImage' TAHAI-Linux-installers-SHA256SUMS.txt | sha256sum -c -
grep 'TAHAI-Web-Services-Browser-1.8.30-x64.deb' TAHAI-Linux-installers-SHA256SUMS.txt | sha256sum -c -
grep 'TAHAI-Web-Services-Browser-1.8.30-x64.rpm' TAHAI-Linux-installers-SHA256SUMS.txt | sha256sum -c -
```

## Install commands

Windows:

```powershell
Start-Process .\TAHAI-Web-Services-Browser-1.8.30-x64.exe
```

AppImage:

```bash
chmod +x TAHAI-Web-Services-Browser-1.8.30-x64.AppImage
./TAHAI-Web-Services-Browser-1.8.30-x64.AppImage
```

Debian/Ubuntu:

```bash
sudo apt install ./TAHAI-Web-Services-Browser-1.8.30-x64.deb
```

Fedora/RHEL:

```bash
sudo dnf install ./TAHAI-Web-Services-Browser-1.8.30-x64.rpm
```

## Publisher stop conditions

Do not publish if:

- Any package artifact is missing its checksum line.
- A checksum was copied from an older build.
- A public page still references the old v1.8.21 public RC as the current download.
- The Windows signing/preview status is hidden or misleading.
- Linux RPM/AppImage/DEB package choices are collapsed into one ambiguous Linux download.
- Generated `release/` files, installers, or handoff manifests appear in source.
- IT Docs or PSA language implies direct browser-side PSA/API integration.

## Source files touched by PASS140

- `src/shared/release-download-ux.ts`
- `docs/downloads-and-checksums.md`
- `docs/browser-download-page-copy.md`
- `docs/kb/articles/downloads-installers.md`
- `docs/download-install-checksum-ux-pass140.md`
- `scripts/verify-pass-140-download-install-checksum-ux.mjs`
- `PASS_140_DOWNLOAD_INSTALL_CHECKSUM_UX_SUMMARY.md`
