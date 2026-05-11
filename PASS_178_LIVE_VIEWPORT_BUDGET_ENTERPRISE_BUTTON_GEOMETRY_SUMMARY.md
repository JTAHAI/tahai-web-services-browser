# PASS178 — Live Viewport Budget + Enterprise Button Geometry

Version remains `1.8.30`.

PASS178 closes the next viewport/chrome weak surface after PASS177 by keeping the website-pane budget live after bookmarks, overlays, command toolbar state, restored-window resizing, and late chrome mutations. It also changes utility chrome buttons away from rounded mobile-app pill shapes into tighter enterprise rounded-rectangle controls.

## Verification

- `npm run verify:pass-178-live-viewport-budget-enterprise-button-geometry`
- `npm run verify:pass-177-website-pane-viewport-recovery`
- `npm run build`
