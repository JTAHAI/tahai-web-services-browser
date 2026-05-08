# PASS118 — Overlay Dismiss Recovery Guard

PASS118 hardens the chrome overlay lifecycle after PASS116/PASS117.

## Goal

Keep TAHAI Browser recoverable when an operator rapidly opens overlays, presses Escape, clicks away, changes window size, or switches between More Tools, DevOps / IT command lanes, Ops Panel, Site View, and Mission Control.

## Changes

- Adds the shared `tahai:chrome-overlay-close-all` dismissal event.
- Adds a renderer-level Escape recovery hook that closes the currently active chrome overlay.
- Keeps dismissal local to browser chrome only; no webview, remote-page, PSA, IT Docs backend, or connector behavior is added.
- Adds stale overlay-state cleanup for cases where `data-pass116-active-overlay` remains set after the visual surface is gone.
- Adds `data-pass118-dismiss-boundary="true"` to participating overlay surfaces.
- Keeps `restoreFocus=true` for explicit Escape/close flows and `restoreFocus=false` for overlay-switch arbitration.

## Covered surfaces

- More Tools overflow menu
- DevOps / IT command toolbar panels
- TAHAI Ops Panel
- Site View Mission Rail
- Mission Control dialog chrome state

## Guardrails

PASS118 does not add raw IPC, shell execution, external-open behavior, direct PSA calls, IT Docs backend code, webview privilege changes, or blind DOM injection. It only coordinates existing renderer chrome surfaces.
