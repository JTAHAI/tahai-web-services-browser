# PASS 63 — Tri View asymmetry and universal pane drag reorder

## Purpose

PASS 63 upgrades Mission Control Tri View from an awkward equal-column/equal-pane model into operator-first asymmetric layouts and adds click/drag pane reordering for every 2-pane, 3-pane, and 4-pane Mission view.

## What changed

- Adds asymmetric 3-Up layout variants:
  - `triple-top`: one full-width top pane, two rectangular panes below.
  - `triple-bottom`: two rectangular panes above, one full-width bottom pane.
  - `triple-left`: one full-height left pane, two rectangular panes on the right.
  - `triple-right`: two rectangular panes on the left, one full-height right pane.
- Keeps legacy `triple` compatible but renders it as the safer `triple-bottom` variant instead of three equal panes.
- Adds a Tri View upgrade control group in Mission layout controls.
- Adds pane drag handles and drag/drop reordering for:
  - `split-horizontal`
  - `split-vertical`
  - `triple`
  - `triple-top`
  - `triple-bottom`
  - `triple-left`
  - `triple-right`
  - `quad`
- Reordering swaps pane tab assignments, preserves active-pane routing by preserving the active tab where possible, and records a `layout-set` timeline event.
- Extends layout literal validation so new mission layout types do not fail schema/source verification.

## Apply

```powershell
Set-Location C:\dev\browser\app
npm run pass63:apply
npm run verify:pass-63-triview-pane-reorder
npm run build
```

## Guard

The verifier fails if:

- asymmetric Tri View layout strings are missing from renderer source;
- pane drag/reorder code is missing;
- CSS grid placement for top/bottom/left/right Tri View is missing;
- `verify:release-blockers` is missing the PASS 63 verifier;
- prior pane-close logic would reintroduce the old equal-size `triple` layout.
