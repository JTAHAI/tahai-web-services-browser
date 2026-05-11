# Downloads, installers, and checksums

Official TAHAI Web Services Browser release artifacts must be distributed through GitHub Releases or official TAHAI Web Services download pages only.

Generated binaries and generated handoff manifests are intentionally not committed to this source repository.

Version: `1.8.30`

## Current public package matrix

| Platform | Artifact | Use | Checksum / manifest |
| --- | --- | --- | --- |
| Windows | `TAHAI-Web-Services-Browser-1.8.30-x64.exe` | Standard Windows preview installer | `TAHAI-Windows-installers-SHA256SUMS.txt` |
| Windows | `TAHAI-Web-Services-Browser-1.8.30-x64.msi` | MSI/managed deployment testing | `TAHAI-Windows-installers-SHA256SUMS.txt` |
| Linux | `TAHAI-Web-Services-Browser-1.8.30-x64.AppImage` | Portable Linux preview | `TAHAI-Linux-installers-SHA256SUMS.txt` |
| Linux | `TAHAI-Web-Services-Browser-1.8.30-x64.deb` | Debian/Ubuntu-family package testing | `TAHAI-Linux-installers-SHA256SUMS.txt` |
| Linux | `TAHAI-Web-Services-Browser-1.8.30-x64.rpm` | Fedora/RHEL-family and TAHAI OS/SENTINEL handoff | `TAHAI-Linux-installers-SHA256SUMS.txt` plus PASS139 manifest |

macOS developer builds may be produced locally on macOS, but macOS public releases should not be treated as trusted until Apple Developer signing and notarization are configured.

## Generated handoff outputs

Windows packaging should publish these generated files beside the Windows installers when the PASS138 lane is present locally:

```text
release/windows/TAHAI-Web-Services-Browser-1.8.30-x64.exe
release/windows/TAHAI-Web-Services-Browser-1.8.30-x64.msi
release/windows/TAHAI-Windows-installers-SHA256SUMS.txt
release/windows/TAHAI-Windows-installers-manifest.json
release/windows/TAHAI-Windows-installers-manifest.txt
```

Linux packaging should publish these generated files beside the Linux packages:

```text
release/linux/TAHAI-Web-Services-Browser-1.8.30-x64.AppImage
release/linux/TAHAI-Web-Services-Browser-1.8.30-x64.deb
release/linux/TAHAI-Web-Services-Browser-1.8.30-x64.rpm
release/linux/TAHAI-Linux-installers-SHA256SUMS.txt
release/linux/TAHAI-Linux-installers-manifest.json
release/linux/TAHAI-Linux-installers-manifest.txt
```

The Linux manifest is the downstream handoff for TAHAI OS/SENTINEL. Do not make the OS lane guess RPM names manually.

## Generate SHA256 checksums

Windows PowerShell:

```powershell
Set-Location C:\dev\browser\app
Get-FileHash .\release\windows\TAHAI-Web-Services-Browser-1.8.30-x64.exe -Algorithm SHA256
Get-FileHash .\release\windows\TAHAI-Web-Services-Browser-1.8.30-x64.msi -Algorithm SHA256
Get-FileHash .\release\linux\TAHAI-Web-Services-Browser-1.8.30-x64.AppImage -Algorithm SHA256
Get-FileHash .\release\linux\TAHAI-Web-Services-Browser-1.8.30-x64.deb -Algorithm SHA256
Get-FileHash .\release\linux\TAHAI-Web-Services-Browser-1.8.30-x64.rpm -Algorithm SHA256
```

Linux/macOS:

```bash
sha256sum TAHAI-Web-Services-Browser-1.8.30-x64.AppImage
sha256sum TAHAI-Web-Services-Browser-1.8.30-x64.deb
sha256sum TAHAI-Web-Services-Browser-1.8.30-x64.rpm
```

On macOS, use `shasum -a 256` if `sha256sum` is unavailable.

## Verify SHA256 checksums

Windows PowerShell example:

```powershell
$Expected = "REPLACE_WITH_64_CHARACTER_SHA256_FROM_TAHAI-Windows-installers-SHA256SUMS.txt"
$Actual = (Get-FileHash .\TAHAI-Web-Services-Browser-1.8.30-x64.exe -Algorithm SHA256).Hash.ToLowerInvariant()
if ($Actual -ne $Expected.ToLowerInvariant()) { throw "SHA256 mismatch" }
"SHA256 OK"
```

Linux examples:

```bash
grep 'TAHAI-Web-Services-Browser-1.8.30-x64.AppImage' TAHAI-Linux-installers-SHA256SUMS.txt | sha256sum -c -
grep 'TAHAI-Web-Services-Browser-1.8.30-x64.deb' TAHAI-Linux-installers-SHA256SUMS.txt | sha256sum -c -
grep 'TAHAI-Web-Services-Browser-1.8.30-x64.rpm' TAHAI-Linux-installers-SHA256SUMS.txt | sha256sum -c -
```

## Install notes

Windows:

- The current preview installers may be unsigned.
- Windows SmartScreen may warn until the approved signing lane is active.
- Only install preview builds from official TAHAI download pages or this repository's GitHub Releases.
- Verify SHA256 before running the EXE or MSI.

Linux AppImage:

```bash
chmod +x TAHAI-Web-Services-Browser-1.8.30-x64.AppImage
./TAHAI-Web-Services-Browser-1.8.30-x64.AppImage
```

Ubuntu/Debian-family:

```bash
sudo apt install ./TAHAI-Web-Services-Browser-1.8.30-x64.deb
```

Fedora/RHEL-family:

```bash
sudo dnf install ./TAHAI-Web-Services-Browser-1.8.30-x64.rpm
```



## PASS159 provenance and SBOM bundle

Publish these together for every public release:

- Installer/package artifacts.
- SHA256SUMS files generated from the exact artifacts being uploaded.
- Windows and Linux handoff manifests generated after packaging.
- SBOM generated from the exact `package-lock.json` used for packaging.
- release provenance manifest tying version, public commit/tag, package-lock SHA-256, artifact names, checksums, and signing status together.
- Installed-app smoke evidence summaries when claiming enterprise release readiness.

PASS159 requires the release provenance manifest and SBOM to carry the package-lock SHA-256. Do not call a Windows artifact signed unless the approved signing lane actually signed it and the signing evidence is available. Unsigned preview artifacts must remain labeled as unsigned preview artifacts.

## Release publishing checklist

Before publishing artifacts:

1. Run source and release verifiers.
2. Build Windows artifacts on Windows and publish the Windows SHA256SUMS/manifests from that build.
3. Build Linux artifacts from WSL/native Linux and publish the Linux SHA256SUMS/manifests from that build.
4. Verify each checksum against the exact artifact being uploaded.
5. Publish artifacts, checksum files, and manifests together.
6. Clearly label unsigned preview status where applicable.
7. Manually install and launch on each target OS before broad announcement.
8. Do not publish if any generated handoff file was copied from an older build.
