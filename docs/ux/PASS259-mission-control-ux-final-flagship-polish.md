# PASS259 — Mission Control UX Final Flagship Polish

## Goal

Make recipes + Quad View feel like the reason the product exists while preserving normal-browser cleanliness and the browser-side-only security boundary.

## Acceptance mapping

| Acceptance item | PASS259 implementation |
|---|---|
| Recipe cards show “What opens” | Adds `data-pass259-card-section="what-opens"` section. |
| Recipe cards show “Layout” | Adds `data-pass259-card-section="layout"` section. |
| Recipe cards show “Runbook” | Adds `data-pass259-card-section="runbook"` section. |
| Recipe cards show “Evidence” | Adds `data-pass259-card-section="evidence"` section. |
| Recipe cards show “Recovery” | Adds `data-pass259-card-section="recovery"` section. |
| Recipe cards show “Policy locks” | Adds `data-pass259-card-section="policy-locks"` section. |
| Starting a recipe visibly confirms success | Adds `data-pass259-start-confirmation` status region inside Mission Control. |
| Empty panes are useful, not dead | Adds `data-pass259-useful-empty-pane` placeholder with runbook/evidence/launchpad next actions. |
| Quad controls are clear without crowding | Adds compact card-section grid and lightweight active-pane focus treatment. |
| Focus Pane restores perfectly | Tracks `data-pass259-focus-restore-ready`, restore layout, and restore pane. |
| Active pane routing is obvious | Marks the active pane with `data-pass259-active-pane-clear="true"` and `aria-current`. |
| Window sizes preserve useful website budget | Adds runtime budget flags and `tests/runtime/pass259-mission-control-window-budget-fixtures.json`. |

## Verification

```powershell
Set-Location C:\dev\\browser\\app
node scripts\\apply-pass259-mission-control-ux-final-polish.mjs
npm run verify:pass-259-mission-control-ux-final-polish
```

## Manual installed-app smoke still required

PASS259 improves source-side and renderer-side polish, but Store submission remains blocked until the installed app proves:

- recipes launch cleanly into Mission Control;
- Quad/Tri/Split/Focus transitions remain deterministic;
- no blank or bottom-only panes appear;
- active-pane routing remains visible and correct;
- useful website/content budget remains at small, restored, maximized, and wide sizes;
- export preview remains available after recipe launch.
