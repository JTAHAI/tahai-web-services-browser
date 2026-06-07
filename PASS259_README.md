# PASS259 — Mission Control UX Final Flagship Polish

Version target: **2.0.8**

PASS259 makes recipes and Quad View feel like the flagship surface of the browser without crossing the browser-side boundary.

## Adds

- Recipe card polish sections:
  - What opens
  - Layout
  - Runbook
  - Evidence
  - Recovery
  - Policy locks
- Visible Mission Control start confirmation.
- Useful local empty-pane placeholders instead of visually dead black panes.
- Clear active-pane marking for multi-view routing.
- Focus-pane restore truth attributes.
- Small/restored/maximized website-budget fixtures.
- Verifier: `npm run verify:pass-259-mission-control-ux-final-polish`

## Hard scope preserved

- Browser-side only.
- No IT Docs backend code.
- No PSA connector code.
- No direct PSA API calls.
- No PSA/API/provider secrets in browser code or mission files.

## Store posture

Microsoft Store submission remains blocked until installed Recipe + Quad/Tri/Split smoke confirms no blank panes, no bottom-only rendering, no orphaned active pane state, reliable layout switching, visible UX polish, and export preview from real installed app behavior.
