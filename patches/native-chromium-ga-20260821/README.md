# TAHAI native Chromium GA patch series

This directory is the source delivery for the native TAHAI Browser worktree.
It is a 19-commit `git format-patch` series based on Chromium
`150.0.7871.183` (`0fcdce5f4fdec8d442d7df760cb541f1ca6e446d`).  It deliberately
contains source patches only; it does not include build outputs, profiles,
logs, certificates, credentials, or an MSIX binary.

## Apply

From a clean Chromium checkout at the stated base revision, apply the patches
in numeric order, excluding the cover letter:

```powershell
Get-ChildItem .\patches\native-chromium-ga-20260821\*.patch |
  Where-Object { $_.Name -notlike '0000-*' } |
  Sort-Object Name |
  ForEach-Object { git am --3way $_.FullName }
```

The final patch adds a reproducible unsigned MSIX packer at
`chrome/installer/win/tahai_msix/package_unsigned_msix.ps1`.  With a completed
`out/tahai_stock_debug_x64` build and Windows SDK packaging tools installed:

```powershell
.\chrome\installer\win\tahai_msix\package_unsigned_msix.ps1 `
  -OutDir C:\src\tahai-release\msix
```

The final Store-reservation patch sets the active Partner Center identity:

- Name: `TAHAIWebServices.TAHAIWebServicesBrowser`
- Publisher: `CN=D75EE668-B409-45ED-87E5-E37AA5FE3868`
- Display name: `TAHAI Web Services Browser`
- Version: `2.0.19.0`

The resulting package is intentionally unsigned and therefore is a local
review artifact, not a production installer. It has no signature payload;
Microsoft Store can apply its distribution signing only after all submission
metadata is complete.

## Included native surfaces

- TAHAI branding, isolated profile identity, and Windows app identity.
- TAHAI Home, Mission Control, Command Center, Profiles, and Work Modes.
- Independent Dual (side-by-side and stacked), Tri (two-over-one and
  one-over-two), and Quad native Chromium pane layouts.
- Native toolbar flyout menus and an allowlisted command palette
  (`Ctrl+Shift+Space`), with fixed shortcuts for every workspace action.
- Work-mode defaults, per-mode visual identities, and progressive
  configuration surfaces. Each identity keeps its own Light/Dark choice.
- A TAHAI-specific Windows external-extension registry channel. Chrome-only
  registry extensions, including machine-installed security-suite companions,
  cannot be imported into TAHAI.

## Verification recorded for this handoff

- `TahaiWebUIBrowserTest.TahaiModesAreTrustedAndExplicitlySelected`: passed
  with the six visual identities and Light/Dark persistence assertions.
- A fresh TAHAI profile launched from this source did not contain the
  Chrome-registered McAfee/WebAdvisor extension.

Patch 0019 changes browser code. Rebuild and repack after applying the full
series; do not reuse a package built from patches 0001–0018 alone.
