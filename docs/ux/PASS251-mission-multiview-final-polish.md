# PASS251 — Mission Multi-View Final Polish

Status: source-side UX repair overlay

This pass closes the installed-app screenshots showing Mission Control crowding in multi-view mode.

## Fixed surfaces

- Mission Control modal containment at restored, maximized, and ultrawide sizes.
- Mission Control internal body scrolling, with horizontal overflow isolated to dense control rails.
- Layout chips, active-pane controls, pane transfer controls, and Repair/Fit/Doctor actions wrapping instead of overlapping.
- Mission cards and grids shrink correctly inside flex/grid parents.
- Mission pane/webview surfaces use `min-height: 0` and flex-fill semantics so content receives the available pane budget.
- Restored-width modal grids collapse cleanly rather than crushing controls.

## Acceptance

- Mission modal never clips critical controls.
- Layout/pane/repair controls wrap or horizontally scroll in a contained rail.
- 1-Up, 2-Up, Tri-view, Quad, and Focus Pane preserve usable content space.
- Active pane marker remains visible without stealing content budget.
- Store submission remains blocked until installed Windows visual smoke is repeated.

## Commands

```powershell
Set-Location C:\dev\browser\app
node scripts\apply-pass251-mission-multiview-final-polish.mjs
npm run verify:pass-251-mission-multiview-final-polish
npm run verify:store:submission
```

`verify:store:submission` is still expected to remain blocked until Partner Center identity, listing screenshots, installed smoke, package evidence, and known-issues truth are complete.
