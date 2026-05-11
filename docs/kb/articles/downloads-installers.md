# Downloads and installers

**Screenshot target:** `docs/kb/screenshots/16-downloads-installers.png`

## Screenshot capture checklist

- **File to add later:** `16-downloads-installers.png`
- **Capture:** Capture the downloads or installer surface showing package choices and checksum context.
- **Must show:** Windows/Linux package options; SHA256 or checksum verification language; signing/preview posture; official source language
- **Avoid:** Local filesystem paths; stale v1.8.21 current-download copy; unsigned installer warning screens unless intentionally documenting them

## What this feature does

The downloads/installers surface makes Windows and Linux package choices clear, keeps checksums beside the packages, and explains known signing status before the user runs an installer.

## How to use it

1. Download only from official TAHAI pages or the official GitHub Releases page.
2. Download the matching checksum file beside the package.
3. Verify SHA256 before installing.
4. Use the package that matches the operating system and deployment path.
5. For Linux RPM/TAHAI OS/SENTINEL work, keep the PASS139 manifest with the RPM so downstream packaging does not guess filenames.

## Package choices

| Package | Use |
| --- | --- |
| `.exe` | Standard Windows preview install |
| `.msi` | Managed Windows/enterprise testing |
| `.AppImage` | Portable Linux preview |
| `.deb` | Ubuntu/Debian-family install |
| `.rpm` | Fedora/RHEL-family install and TAHAI OS/SENTINEL handoff |

## Checksum UX

- Windows packages verify against `TAHAI-Windows-installers-SHA256SUMS.txt`.
- Linux packages verify against `TAHAI-Linux-installers-SHA256SUMS.txt`.
- Linux package handoff also includes `TAHAI-Linux-installers-manifest.json` and `TAHAI-Linux-installers-manifest.txt`.
- Generated installers and generated manifests are build outputs, not source files.

## Safety notes

- Keep secrets, tokens, cookies, runtime browser profiles, generated installers, and local data out of source.
- IT Docs and PSA references remain browser-side display/context unless a server-authorized workflow exists.
- Treat Mission files and exported evidence as untrusted until validated and redacted.
- Do not publish a package if the checksum was copied from an older build or the manifest is missing.
