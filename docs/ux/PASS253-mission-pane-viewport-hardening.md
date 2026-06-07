# PASS253 — Mission Pane Viewport Hardening

Status: source-side viewport hardening pass for TAHAI Web Services Browser 2.0.2.

## Purpose

PASS253 hardens Mission multi-view panes so each visible pane shows the actual website surface, top anchored, instead of a large black/dead area with only the bottom of the page visible.

## Acceptance

- 1-Up, 2-Up, 3-Up, Quad, and Focus can be switched repeatedly without stale hidden/collapsed panes.
- Visible split/tri/quad panes remain visible and allocate a real webview/iframe viewport.
- Webviews/iframes are top-left anchored, flex-filled, and reflowed after layout changes.
- Runtime viewport repair marks bottom-only failures with `data-pass253-viewport-repaired`.
- Version truth is in the 2.0.x lane at 2.0.2 or higher.
- Store submission remains blocked until installed visual smoke confirms Mission view behavior.
