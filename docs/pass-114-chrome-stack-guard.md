# PASS114 — Chrome Stack Guard

PASS114 continues the PASS112/PASS113 chrome cleanup by removing the next visible collision risk: fixed overlays that still used old hardcoded top offsets after the toolbar became adaptive.

## Scope

Browser-side source only. No IT Docs backend work, no PSA connector work, no secrets, and no generated runtime artifacts.

## Changes

- Adds a `data-pass114-chrome-stack-guard` renderer marker.
- Measures the real topbar + toolbar height at runtime after PASS113 relayout.
- Publishes `--pass114-chrome-stack-top` and `--pass114-overlay-bottom` CSS variables.
- Anchors More Tools, DevOps/IT command lanes, Ops Panel, and Site View below the measured chrome-stack anchor instead of fixed stale offsets.
- Keeps overlay max-height bounded so narrow windows do not bury panel content under the status bar.
- Preserves titlebar drag/non-drag regions, active-pane routing, Mission Control, Site View, settings/about, and tool flyouts.

## Acceptance

- Version remains `1.8.30`.
- `verify:pass-114-chrome-stack-guard` is wired into `verify:release-blockers` after PASS113 and before final build.
- The release gate fails if PASS114 markers, runtime CSS variables, or overlay anchor selectors are removed.
