# NEXT CHAT STARTER — TAHAI Web Services Browser PASS108

We are continuing TAHAI Web Services Browser hardening from the latest completed source ZIP:

`TAHAI-browser-pass108-mission-pane-movement-overlay-20260506.zip`

Repo:
`C:\dev\browser\app`

Public repo:
`https://github.com/JTAHAI/tahai-web-services-browser`

Current version: `1.8.30` unless explicitly incremented.

Latest completed pass:
**PASS108 — Mission Pane Movement Overlay Repair**

PASS108 includes PASS107 geometry settle plus PASS108 pane movement repair:
- PASS107: Site View rail and Tri View layout changes trigger multi-step Mission viewport settle.
- PASS107: legacy `triple` canonicalizes to `triple-bottom`, and Tri View variants run full Mission Layout render.
- PASS108: pane movement no longer depends on fragile native webview drag/drop hit-testing.
- PASS108: click `Move` on a Mission pane, then click a highlighted full-pane target to swap panes.
- PASS108: pane swaps now run full Mission Layout render, restore failsafe, and viewport settle.
- PASS108: pane assignment/upsert paths also schedule viewport settle.
- Added/wired `verify:pass-107-site-view-triview-geometry-settle` and `verify:pass-108-mission-pane-movement-overlay` into `verify:release-blockers`.

Hard scope:
Browser-side work only. No IT Docs backend work. No PSA connector work. No direct PSA API calls. No secrets or generated artifacts in source.

Baseline local verification:
```powershell
Set-Location C:\dev\browser\app
npm ci
npm run build
npm run verify:public-repo
npm run verify:mission-tabs-security
npm run verify:site-view-rail
npm run verify:pass-105-build-green-boundary-repair
npm run verify:pass-106-site-view-triview-binding
npm run verify:pass-107-site-view-triview-geometry-settle
npm run verify:pass-108-mission-pane-movement-overlay
npm run verify:release-blockers
npm run dev
```

Manual UX checks after `npm run dev`:
- Open Mission Control and switch to 3-Up.
- Assign three browser tabs to Pane 1, Pane 2, and Pane 3.
- Click `Move` on Pane 1 and confirm highlighted full-pane swap targets appear above the webviews.
- Click Pane 2 or Pane 3 target and confirm panes swap without clipped/stale bounds.
- Press `Esc` while a pane move is armed and confirm targets disappear.
- Open Site View rail, use `Send to Pane`, then repeat pane movement with the rail open/closed and left/right.
- Confirm active-pane routing still controls address bar, reload, back/forward, shortcuts, and tab-to-pane actions.

Next task:
Continue PASS109 by inspecting the next weakest real browser surface. Prioritize remaining Mission View responsive UX faults first, then Command Center side-effect confirmations, clipboard/export sanitization, and mission import/export stale schema rejection paths.
