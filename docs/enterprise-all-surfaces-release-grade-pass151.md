# PASS151 — Enterprise All-Surfaces Release Grade Gate

PASS151 closes the gap between an RC2 manifest and a build that can honestly be called enterprise release grade across all surfaces.

This is not a new feature pass. It is a release-grade gate over source gates, source truth, installer handoff truth, installed-app evidence, responsive/manual regression evidence, security boundaries, privacy/support truth, and generated-artifact hygiene.

## Enterprise release-grade rule

Do not call the build enterprise release grade unless all of these are true:

1. `npm run verify:release-blockers` passes with PASS138 through PASS151 wired before the final build.
2. Windows installers are packaged and their PASS138 handoff manifest/checksum files exist under `release/windows/`.
3. Linux RPM/AppImage/DEB packages are packaged and their PASS139 handoff manifest/checksum files exist under `release/linux/`.
4. Windows installed-app smoke evidence is captured locally with `npm run evidence:windows-installed-smoke`.
5. Linux installed-package smoke evidence is captured locally with `npm run evidence:linux-installed-smoke`.
6. cross-size responsive regression evidence is captured locally with `npm run evidence:cross-size-regression`.
7. The PASS151 evidence report is generated with `npm run evidence:enterprise-all-surfaces -- --strict`.
8. Titlebar drag smoke is manually confirmed: empty brand/titlebar/tab-strip regions drag the window, while tabs, close buttons, `+`, and native caption controls remain clickable.

## Surfaces covered

- Normal browser shell
- Tabs-on-titlebar chrome and full empty titlebar drag region
- Native caption controls
- Address navigation, reload, back, forward, and active-pane routing
- Mission Control 1-Up, 2-Up, Tri-view, Quad, and Focus Pane
- Guide / KB / More Tools overflow and small-window entry
- Runbook Rail and Command Center
- Evidence Pack redaction/export and Mission file boundary
- Electron, IPC, webview, external-open, and protocol security boundaries
- Windows NSIS/MSI installer handoff and checksum outputs
- Linux RPM/DEB/AppImage handoff and checksum outputs
- Download/install documentation and checksum UX
- About/version/update-channel release truth
- Privacy/support/known-issues truth
- Public repo supply-chain hygiene
- Windows installed-app smoke evidence
- Linux installed-package smoke evidence
- cross-size responsive regression and responsive/manual regression evidence

## Source ZIP rule

The source ZIP must not include generated outputs. That means the following remain generated local artifacts only:

- `release/`
- `dist/`
- `artifacts/`
- `.pass-runs/`
- generated installers
- generated package manifests
- generated evidence reports
- runtime browser profiles
- local Mission data
- local Evidence data

## Local enterprise evidence command

After packaging and manual smoke runs, run:

```bash
npm run evidence:enterprise-all-surfaces -- --strict
```

Without `--strict`, the runner creates a readiness report but does not fail when package handoffs or manual evidence are not present yet. With `--strict`, it exits blocked until the Windows, Linux, and cross-size evidence files exist.

## Stop conditions

Do not proceed to enterprise release if any of these are true:

- PASS138 Windows installer closeout is missing from `verify:release-blockers`.
- PASS139 Linux handoff closeout is missing from `verify:release-blockers`.
- PASS150 final ship candidate is not present.
- PASS151 enterprise all-surfaces gate is not present.
- Installer/package manifests or checksum files are missing after packaging.
- Installed Windows or Linux smoke evidence is missing.
- Cross-size responsive evidence is missing.
- Titlebar drag only works in small isolated areas instead of the empty topbar/tab-strip track.
- Any generated installer, package, manifest, or evidence output is committed into source.
