# PASS179 — More Tools Overflow Clarity

## Purpose

PASS177 and PASS178 protect the website pane from collapsing into a horizontal sliver by forcing secondary controls into More Tools when the chrome stack threatens the viewport. PASS179 hardens the user-facing side of that recovery: when controls move, the operator should not be left with a mystery icon or unclear compact state.

## What changed

- Adds an overflow count badge to the More Tools button.
- Updates the More Tools button `aria-label`, `title`, and tooltip text with the number of moved controls.
- Exposes runtime state on `document.body` for `toolbar-clear`, `responsive`, and `viewport-forced` overflow modes.
- Styles viewport-forced overflow with a restrained amber affordance so forced recovery is visible without looking like an error.
- Adds More Tools panel helper copy explaining that controls may move automatically to preserve website pane height.

## Guardrails

- No raw IPC.
- No shell/external-open behavior.
- No inline click handlers.
- No generated artifacts.
- Version remains `1.8.30`.

The verifier requires the exact closeout terms: overflow count, forced-overflow, and website pane.
