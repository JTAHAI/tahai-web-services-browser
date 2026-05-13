# PASS190 — Overlay State Machine Closeout

## Purpose

Close the repeated-click and overlay-collision class by making shell overlays behave like a single-owned state machine. Settings, More Tools, DevOps / IT command lanes, Ops Panel, Site View rail, Mission Control, Command Palette, Profiles, and Keyboard Shortcuts now share the same ownership, close, focus-return, viewport-audit, and stale-state cleanup path.

## What changed

- Extended overlay ownership beyond the older chrome-only surfaces to include Settings, Command Palette, Profiles, and Keyboard Shortcuts.
- Added PASS190 state-machine telemetry on `document.body` so manual/runtime evidence can see owner, state, reason, version, and transition time.
- Opening any owned overlay closes rival overlays instead of stacking dialogs/panels.
- Escape routes through the active owner and does not indiscriminately clear unrelated overlay state.
- Settings, Command Palette, Profiles, and Keyboard Shortcuts now clear overlay ownership on explicit close and native dialog close.
- Viewport/cycle audits include all owned overlays, not only More Tools / command lanes / Mission Control.

## Manual check

At restored and small window sizes:

1. Open More Tools, then Settings. More Tools must close and Settings must open on the first click.
2. Open Settings, then Mission Control. Settings must close and Mission Control must own focus.
3. Open Mission Control, then Command Palette. Mission Control must close and Command Palette must own focus.
4. Open DevOps or IT Tools, then Ops Panel. The tool lane must close and Ops Panel must own focus.
5. Press Escape with each owned surface open. Only the active owner should close and focus should return to a valid shell control.

## Guardrail

This pass does not add new product features. It hardens ownership, focus, and collision recovery for existing surfaces so the browser does not require repeated clicks or leave hidden overlays intercepting input.
