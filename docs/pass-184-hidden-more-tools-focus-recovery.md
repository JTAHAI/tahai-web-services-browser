# PASS184 — Hidden More Tools Focus Recovery

## Purpose

Harden the next weakest UX surface after PASS183 overlay-collision recovery: keyboard focus must not remain trapped inside the More Tools menu after the menu is hidden by relayout, overlay arbitration, compact viewport recovery, or collision cleanup.

## Problem addressed

PASS183 correctly closes More Tools when dialogs or command panels open. A deeper UX failure can still happen when More Tools closes without restoring focus, especially during compact toolbar relayouts or viewport-budget recovery. The menu becomes hidden, but the browser can still consider a moved/hidden menu item the active element. That creates a stuck-feeling keyboard path.

## Changes

- Adds a hidden More Tools focus recovery controller.
- Detects when the active element remains inside a hidden More Tools menu.
- Repairs focus to the address bar first, then the More Tools button, then another safe toolbar control.
- Defers repair while a More Tools action is still in flight so it does not steal focus from an opening dialog/panel.
- Adds runtime markers for recovery state, source element, target element, and repair reason.
- Adds visual focus confirmation after recovery.

## Guardrails

- No raw IPC added.
- No external-open behavior added.
- No inline event handlers added.
- Existing More Tools action dispatch, overlay collision recovery, and compact toolbar recovery remain intact.
- Version remains `1.8.30`.

## Verification

```bash
npm run verify:pass-184-hidden-more-tools-focus-recovery
npm run verify:pass-183-more-tools-overlay-collision-recovery
npm run build
```
