# PASS192 — Tab Strip and Titlebar Drag Final UX

PASS192 hardens the tabs-on-titlebar surface after the address bar enterprise reliability pass.

## What changed

- Added a shared titlebar chrome final UX contract.
- Added runtime titlebar/tab-strip diagnostics and data attributes.
- Converted the tab close control away from invalid nested-button markup.
- Added explicit no-drag hit targets for tab buttons, close controls, and the new-tab button.
- Added overflow-aware tab strip styling, active tab affordance, compact-width rules, and high-DPI polish.
- Added keyboard roving behavior for Arrow/Home/End on the tab strip.
- Added a PASS192 verifier and release-blocker wiring.

## Verification

Run:

```powershell
npm run verify:pass-192-tab-strip-titlebar-drag-final-ux
```

Full build/package verification still requires local dependency installation and installed Windows app validation.
