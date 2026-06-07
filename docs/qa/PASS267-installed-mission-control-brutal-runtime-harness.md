# PASS267 — Installed Mission Control Brutal Runtime Harness

Target version: `2.0.14`

Remaining release-confidence hardening passes after PASS267: **4**.

PASS267 creates the installed-app Mission Control runtime proof matrix and repairs the source-level blockers exposed in the local PASS266 verification run.

## Repairs included

- Re-wires PASS255 recipe-to-pane hydration into the PASS254 recipe start path when a prior overlay left the marker present but unwired.
- Sanitizes synthetic private-key fixture prose in `src/shared/*privacy*` and `src/shared/*evidence*` contracts so PASS259/PASS260 do not false-positive on documentation-only marker strings.
- Adds the missing PASS264 verifier alias: `verify:pass-264-store-submission-dry-run-evidence-gate` while preserving `verify:pass-264-store-submission-dry-run-evidence`.

## Runtime proof added

PASS267 does not claim the installed app passed. It defines the fail-closed installed runtime evidence contract for:

- all 8 flagship recipes,
- Single / Split / Tri variants / Quad / Focus / restore,
- at least 50 layout cycles per recipe,
- restored, small, maximized, and wide window profiles,
- no blank/black/bottom-only/orphaned panes,
- no hidden active pane,
- no WebView DOM-ready method error,
- export preview and redaction preview sanity.

## Commands

```powershell
Set-Location C:\dev\\browser\\app
node scripts\\apply-pass267-installed-mission-control-brutal-runtime-harness.mjs
npm run verify:pass-267-installed-mission-control-brutal-runtime-harness
```

Optional hard gate only after real installed evidence exists:

```powershell
npm run gate:pass-267-installed-mission-control-brutal-runtime-harness
```

## Store posture

Microsoft Store remains **not-submitted** and **not-approved**. PASS267 makes no public GA claim and no direct MSI/EXE signing claim.
