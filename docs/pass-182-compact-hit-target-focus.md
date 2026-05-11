# PASS182 — Compact Hit-Target + Focus Hardening

## Purpose

PASS182 closes the next UX weak surface after PASS181: compact primary controls were understandable, but their click/focus target and tooltip behavior still felt too fragile at restored or narrow window sizes.

## What changed

- Keeps Home, DevOps, IT Tools, and Mission marked as explicit compact hit targets.
- Expands condensed primary controls to stronger desktop click/focus targets while preserving the address-bar budget.
- Reuses the anchored PASS174 tooltip controller for compact primary controls instead of the detached top-right pseudo-tooltip.
- Suppresses the older fixed-position CSS pseudo-tooltip under PASS182 so the hint appears near the actual focused/hovered control.
- Adds compact focus/hover status text so keyboard and pointer users get immediate confirmation of what `D`, `IT`, and `M` mean.
- Tracks compact pointer/keyboard activation state for regression diagnostics.

## Guardrails

- No action IDs changed.
- No control IDs changed.
- Existing button handlers remain intact.
- Compact mode remains governed by PASS180/PASS181 state.
- PASS177/PASS178 viewport protection remains the source of truth if chrome again threatens the website pane.

## Verification

Run:

```powershell
npm run verify:pass-182-compact-hit-target-focus
npm run verify:pass-181-compact-primary-ux-clarity
npm run build
```
