# PASS166 — Runtime CSS State Alignment

## Purpose

PASS166 closes a hidden responsive-regression class found after PASS165. Several renderer modules initialized body `data-pass*` flags by changing values from `"true"` to `"ready"`. The public CSS selectors for compact chrome, More Tools, overlay arbitration, scroll containment, and Mission Control viewport hardening key off the `"true"` contract from the HTML shell. Changing those values at runtime can silently disable responsive CSS after boot.

## Fixed surfaces

- More Tools compact-window positioning and overflow visibility.
- Adaptive titlebar / toolbar density rules.
- Overlay arbitration visual/pointer guards.
- Overlay scroll containment and viewport reflow guards.
- Mission Control small-window reflow support.
- First-click More Tools broker visual/settle state.

## Implementation

- Runtime body flags that activate CSS remain `"true"` after renderer initialization.
- Existing state-specific values remain allowed for non-CSS activation fields such as active overlay, focus-open, hidden/active pointer state, and site-view-specific diagnostics.
- Verifiers were adjusted where they had accidentally locked runtime CSS flags to `"ready"` instead of the CSS-active `"true"` contract.
- Added a PASS166 verifier that scans for CSS-active body flags being overwritten to `"ready"` or `"initializing"`.

## Acceptance

- Normal browsing remains unchanged.
- More Tools and Mission Control compact-window hardening remains active after boot.
- No IPC, external-open, webview, credential, IT Docs backend, or PSA connector behavior was added.
- Version remains `1.8.30`.
