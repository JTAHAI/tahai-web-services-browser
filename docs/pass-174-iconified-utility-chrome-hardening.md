# PASS174 — Iconified Utility Chrome Hardening

PASS174 hardens the PASS173 icon-first utility chrome without adding backend scope or changing the browser version.

## What changed

- Added a fixed-position tooltip controller for iconified utility controls so tooltip text works on hover and keyboard focus without being clipped by the toolbar.
- Preserved `title`, `aria-label`, and temporary `aria-describedby` linkage while an iconified control has an active tooltip.
- Added runtime body-state alignment for PASS173/PASS174 so CSS flags are restored after boot instead of relying only on static HTML attributes.
- Added More Tools menu keyboard roving for Arrow Up/Down/Left/Right plus Home/End.
- Added `role="menuitem"` while utility controls are moved into More Tools, then restores the original toolbar role when controls return to the toolbar.
- Added Mission Control `aria-label` while keeping its visible text readable.

## Guardrails preserved

- No raw IPC, shell, external-open, secrets, backend connector code, generated artifacts, or runtime DOM hacks.
- Normal browser mode remains clean.
- Mission Control remains visibly readable.
- More Tools still closes after action dispatch and retains the PASS163-PASS171 overlay/focus guards.
- Version remains `1.8.30`.

## Verification

Run:

```bash
npm run verify:pass-173-iconified-utility-chrome
npm run verify:pass-174-iconified-utility-chrome-hardening
npm run typecheck
npm run build
```
