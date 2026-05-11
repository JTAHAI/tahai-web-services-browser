# PASS147 — Linux installed package smoke checklist and evidence runner

PASS147 closes the Linux installed-app QA handoff gap. PASS139 made Linux package handoff artifacts deterministic; PASS147 makes the installed RPM, DEB, and AppImage smoke path repeatable without pretending the source verifier has completed a real desktop smoke run.

Version remains `1.8.30`. Release channel truth remains `public-rc`; update policy remains `manual-release`; installers/packages remain an unsigned preview until the signing lane is explicitly complete.

## Scope

Browser-side source/docs/verifier work only.

PASS147 adds:

- a Linux installed package smoke contract in `src/shared/linux-installed-smoke-contract.ts`
- a Linux evidence runner in `scripts/run-pass147-linux-installed-smoke.sh`
- a static verifier in `scripts/verify-pass-147-linux-installed-smoke.mjs`
- package scripts for `npm run evidence:linux-installed-smoke` and `npm run verify:pass-147-linux-installed-smoke`
- release-blocker wiring after PASS146

PASS147 does not install packages, remove packages, run sudo package-manager operations, or claim installed-app success from source-only verification.

## Build and handoff before installed smoke

From Fedora WSL or a native Linux build host:

```bash
/usr/bin/npm ci
/usr/bin/npm run build
/usr/bin/npm run package:linux:rpm
/usr/bin/npm run verify:linux-installer-handoff -- rpm
```

Optional target-specific package lanes:

```bash
/usr/bin/npm run package:linux:deb
/usr/bin/npm run verify:linux-installer-handoff -- deb

/usr/bin/npm run package:linux:appimage
/usr/bin/npm run verify:linux-installer-handoff -- appimage
```

Full Linux package lane:

```bash
/usr/bin/npm run package:linux
/usr/bin/npm run verify:linux-installer-handoff -- all
```

Before install or AppImage launch, verify SHA256 against `release/linux/TAHAI-Linux-installers-SHA256SUMS.txt`.

## Evidence runner

The runner records local Linux evidence under `artifacts/linux-installed-smoke/`. That directory is ignored and must not be committed.

RPM example after installing the RPM manually:

```bash
npm run evidence:linux-installed-smoke -- --package-type rpm --installed-bin /usr/bin/tahai-web-services-browser --package-path release/linux/TAHAI-Web-Services-Browser-1.8.30-x64.rpm --launch
```

DEB example after installing the DEB manually:

```bash
npm run evidence:linux-installed-smoke -- --package-type deb --installed-bin /usr/bin/tahai-web-services-browser --package-path release/linux/TAHAI-Web-Services-Browser-1.8.30-x64.deb --launch
```

AppImage example:

```bash
chmod +x release/linux/TAHAI-Web-Services-Browser-1.8.30-x64.AppImage
npm run evidence:linux-installed-smoke -- --package-type appimage --package-path release/linux/TAHAI-Web-Services-Browser-1.8.30-x64.AppImage --launch
```

The runner captures:

- distro/kernel/architecture
- executable or AppImage path
- file size, SHA256, and `file` summary
- RPM or dpkg package query output when available
- discovered desktop entries
- release/linux manifest file evidence when present
- optional launch attempt status
- manual checklist skeleton

## Manual checklist

Complete this from the installed Linux app, not from `npm run dev`.

1. RPM / DEB / AppImage checksum verified with SHA256.
2. RPM / DEB package installs cleanly, or AppImage permission step is clean.
3. Installed command or AppImage resolves without using a source/dev path.
4. Package manager truth is captured for RPM or DEB, where applicable.
5. Desktop entry/icon surfaces are visible and use TAHAI branding.
6. Installed Linux app launches.
7. About page shows v1.8.30, `public-rc`, `manual-release`, and unsigned preview truth.
8. Normal navigation works.
9. Guide/KB opens from primary chrome or More Tools.
10. Mission Control opens at practical installed-app sizes.
11. 2-Up, Tri-view, and Quad entry/recovery work.
12. Small-window reflow remains usable.
13. Active-pane routing targets the active pane/tab only.
14. Evidence export redaction warns and redacts before handoff.
15. DevTools remains available.
16. No console/crash noise or missing-library loop is observed.
17. Remove/uninstall path is understood, but destructive cleanup is manual and explicit.

## Guardrails

- Do not include secrets, cookies, tokens, customer screenshots, or raw customer data in evidence notes or screenshots.
- No direct PSA API calls.
- No IT Docs backend changes.
- No generated `artifacts/`, `release/`, `dist/`, `node_modules/`, RPM, DEB, or AppImage outputs in source.
- No claim of manual installed-app success until a human completes the Linux installed-app checklist and attaches the generated evidence JSON/Markdown.

## Verification

```bash
npm run build
npm run verify:public-repo
npm run verify:pass-146-windows-installed-smoke
npm run verify:pass-147-linux-installed-smoke
npm run verify:release-blockers
```
