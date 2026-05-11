# PASS152 — Enterprise Evidence Binder + No-False-GA Gate

PASS152 keeps the browser honest after PASS151: the source may be release-candidate hardened, but the product must not be described as enterprise GA until package handoff evidence, installed-app smoke evidence, cross-size evidence, and manual titlebar-drag evidence exist outside the source tree.

## Rule

Do not call TAHAI Web Services Browser enterprise GA unless all of these are available and reviewed:

- Windows installer handoff manifest and checksums from a real package run.
- Linux RPM/DEB/AppImage handoff manifest and checksums from a real package run.
- Windows installed-app smoke evidence.
- Linux installed-package smoke evidence.
- Cross-size responsive/manual regression evidence.
- Titlebar drag-region manual smoke evidence.
- Release binder summary showing what passed, what was blocked, and what remains unsigned/manual.

## Source posture

This pass is a source gate and documentation/contract gate. It does not add generated evidence, installers, package manifests, checksums, runtime profiles, or local browser data to the repository.

## No-false-GA language

Allowed: public RC, unsigned preview, source-ready gate, enterprise evidence required.

Blocked until evidence exists: enterprise GA approved, production GA approved, fully enterprise released, signed enterprise GA package available.
