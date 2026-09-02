# TAHAI native Chromium patch series

This directory is the source delivery for the native TAHAI Browser worktree.
It is a 30-commit `git format-patch` series based on Chromium
`150.0.7871.186` (`0fcdce5f4fdec8d442d7df760cb541f1ca6e446d`).  It deliberately
contains source patches only; it does not include build outputs, profiles,
logs, certificates, credentials, or an MSIX binary.

Patch 0030 captures the Windows-native 2.0.32.0 source handoff. See
[the release record](RELEASE-2.0.32.0.md) for the package hash, recorded checks,
and remaining acceptance boundaries. The historical branch/directory name
does not imply GA or Microsoft Store certification.

## Apply

From a clean Chromium checkout at the stated base revision, apply the patches
in numeric order, excluding the cover letter:

```powershell
Get-ChildItem .\patches\native-chromium-ga-20260821\*.patch |
  Where-Object { $_.Name -notlike '0000-*' } |
  Sort-Object Name |
  ForEach-Object { git am --3way $_.FullName }
```

The final patches add a reproducible unsigned MSIX packer at
`chrome/installer/win/tahai_msix/package_unsigned_msix.ps1`.  With a completed
non-component release `out/tahai_release_x64` build and Windows SDK packaging
tools installed:

```powershell
.\chrome\installer\win\tahai_msix\package_unsigned_msix.ps1 `
  -BuildDir C:\src\TAHAI-Chromium\src\out\tahai_release_x64 `
  -OutDir C:\src\tahai-release\msix-2.0.32.0-new `
  -Version 2.0.32.0 `
  -ValidationEvidence C:\src\tahai-release\evidence\release.json
```

Use a new output directory and fresh passing evidence from the same build;
the example evidence path must be replaced with the actual release record.

The 2.0.32.0 package uses this reserved identity:

- Name: `TAHAIWebServices.TAHAIWebServicesBrowser`
- Publisher: `CN=D75EE668-B409-45ED-87E5-E37AA5FE3868`
- Display name: `TAHAI Browser`
- Packaged version: `2.0.32.0`, supplied explicitly to the packager

The resulting package is intentionally unsigned and therefore is a local
review artifact, not a signed production installer. Signing, Store submission,
and Store certification remain separate steps.

## Included native surfaces through patch 0029 (historical)

- TAHAI branding, isolated profile identity, and Windows app identity.
- The authoritative TAHAI Web Services spider artwork, copied directly from
  the website favicon masters at native sizes. Its geometry is locked: no
  tracing, redrawing, simplification, recoloring, masking, or regeneration.
- TAHAI Home, Mission Control, Command Center, Profiles, and Work Modes.
- Independent Dual (side-by-side and stacked), Tri (two-over-one and
  one-over-two), and Quad native Chromium pane layouts.
- Native toolbar flyout menus and an allowlisted command palette
  (`Ctrl+Shift+Space`), with fixed shortcuts for every workspace action.
- Work-mode defaults, formal per-mode cockpit systems, and a progressive
  Workspace Studio. Each mode keeps profile-scoped Light/Dark, restrained
  accent and surface selections, density, header treatment, start surface,
  exact native pane variant, and Mission Control runbook-rail visibility.
  These are finite visual-only choices; browser security, profiles,
  extensions, permissions, downloads, and policy remain Chromium-owned.
- A TAHAI-specific Windows external-extension registry channel. Chrome-only
  registry extensions, including machine-installed security-suite companions,
  cannot be imported into TAHAI.

## Verification recorded for 2.0.25.0 (historical)

- `MissionServiceTest.WorkModeWorkspaceChoicesAreFiniteAndProfileScoped`:
  passed with migration, per-profile persistence, and arbitrary-value rejection
  assertions.
- `TahaiWebUIBrowserTest.TahaiModesAreTrustedAndExplicitlySelected`: passed
  with the six visual identities, Workspace Studio controls, Light/Dark, accent,
  and persisted exact-pane-variant assertions.
- A fresh TAHAI profile launched from this source did not contain the
  Chrome-registered McAfee/WebAdvisor extension.
- The 2.0.25.0 release MSIX contained 491 release-runtime payload files and
  its staged executable launched for native review. The package identity,
  display name, publisher, version, and VC runtime payload were verified.
  The packer refuses component/debug outputs so an incomplete `base.dll`
  dependency set cannot be repackaged accidentally.
- The authoritative 256 px source and browser asset both have SHA-256
  `21D9B79F49523C4CA476E5CC02CAA2D8F45FBF6E07D9779B417DBFFD5FF7ECE9`.

Patches 0019–0030 change browser code and packaging. Rebuild, validate, and
repack after applying the full series; do not reuse a package built before
patch 0030. Historical checks above are not evidence for a newly built package.
