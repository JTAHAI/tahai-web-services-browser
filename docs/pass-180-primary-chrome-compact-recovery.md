# PASS180 — Primary Chrome Compact Recovery

PASS180 hardens the next compact-window weak surface after PASS179. The secondary controls can now move into More Tools with a visible count, but the always-visible primary controls — Home, DevOps, IT Tools, and Mission — could still keep their full labels and crowd the address bar in restored or narrow windows.

## Changes

- Adds `data-pass180-primary-chrome-compact-recovery="true"` to the shell.
- Adds compact-safe Home and Mission inner labels/icons without changing button IDs or action wiring.
- Adds a runtime `data-pass180-primary-chrome-compact-mode` marker that switches between `full` and `condensed`.
- Condenses Home, DevOps, IT Tools, and Mission into enterprise square controls when the window/address budget is tight.
- Keeps text available through existing `title`/`aria-label` while visually hiding labels only in compact mode.
- Preserves More Tools, Mission Control, command toolbar, and active website pane behavior.

## Guardrails

- Browser-side source only.
- No IPC changes.
- No direct external-open behavior.
- No generated artifacts.
- Version remains `1.8.30`.
