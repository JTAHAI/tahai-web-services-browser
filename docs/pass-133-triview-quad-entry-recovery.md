# PASS133 — Tri-view / Quad View Entry + Recovery

PASS133 hardens Mission View layout entry and recovery before the browser moves deeper into enterprise GA closeout.

## Scope

Browser-side source only. No IT Docs backend work, no PSA connector work, no secrets, no generated installer artifacts.

## What changed

- Mission Control now exposes all supported 3-Up variants directly: Top, Bottom, Left, and Right.
- Added `Cycle 3-Up` for quick traversal of the four variants without losing pane assignments.
- Added `Recover View` to clear stale pane movement overlays, normalize active-pane visibility, repaint native webview bounds, and re-run Mission viewport settlement.
- Added command-palette entries for 3-Up Left, 3-Up Right, 3-Up cycle, and Mission View recovery.
- Hardened Ctrl+Alt+Shift+3 so it reliably opens 3-Up Top using `event.code`, and prevented shifted digit shortcuts from also focusing pane 3.

## Acceptance

- Version remains 1.8.30 unchanged.
- Quad View remains directly available.
- Existing Top/Bottom 3-Up entries remain directly available.
- Left/Right 3-Up entries are no longer hidden behind the older injected Tri View panel only.
- Operators have a visible recovery path when rapid layout switching, pane movement, or small-window changes leave stale overlays or geometry.
