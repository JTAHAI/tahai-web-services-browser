# PASS341 - Normal Browser and Feature Clickability Closeout

## Purpose

PASS341 closes the remaining normal-browsing input failure after PASS337-PASS340. The guest webview load path was already proven alive, but browser chrome and primary feature buttons still needed a deterministic clickability owner.

## Runtime ownership

PASS341 adds `pass341NormalBrowserAndFeatureClickabilityCloseout()` in `src/renderer/app.ts`.

It reasserts:

- topbar, toolbar, tabs, buttons, address form, statusbar, and feature controls are `pointer-events:auto` and `-webkit-app-region:no-drag`;
- hidden overlays, dialogs, flyouts, and panels are inert;
- Mission drag/drop residue is hidden outside active Mission drag/layout state;
- active webviews stay contained inside `#webview-stage`;
- normal active webviews receive inline-flex, exact inline-priority pixel bounds from `pass339ApplyStageViewportFit()` after PASS340/PASS341 cleanup, preventing Electron from rendering the loaded guest page as a 150px-tall strip at the top of an otherwise black stage;
- PASS342 native guest viewport settle nudges Chromium through a bounded attach/load/resize sequence and proves the guest document bottom reaches the guest viewport bottom, closing the portal footer-line floating above the pane bottom case;
- primary buttons keep direct event bindings; PASS341 capture-phase fallback remains available but is now opt-in (`TAHAI_BROWSER_ENABLE_PASS341_CAPTURE_FALLBACK=1`) so it cannot accidentally steal normal handlers.

## Root causes closed

- PASS340 hit-test/pointer interception could still own runtime input at startup; it is now opt-in (`TAHAI_BROWSER_ENABLE_PASS340_CHROME_INPUT_HITTEST_CLOSEOUT=1`) so default browsing stays deterministic.
- PASS252/PASS253 mission-repair loops were too broad and could run against non-mission state; they are now gated to active Mission runtime state only.
- Stale Mission layout state could leave an empty mission surface (black stage) with no mapped pane runtime; renderer now hard-falls back to single normal browsing when Mission runtime mappings are empty.
- Mission residue cleanup no longer treats a stale `.mission-layout` class as "mission active"; normal-mode cleanup now clears stale classes/overlays deterministically.
- PASS340/PASS341 no longer overwrite PASS339's exact stage-sized webview bounds with percentage sizing during normal browsing; this closes the visible portal-bottom-line-not-aligned-with-pane-bottom regression.
- Active normal webviews remain inline-flex native planes with runtime-owned pixel attributes; PASS342 then nudges and proves the Electron guest viewport follows the stage rectangle instead of preserving stale intrinsic layout.

## Primary controls covered

- Back
- Forward
- Reload
- Home
- Address form submit
- New tab
- Launchpad
- Guide / KB
- Profile selector
- DevOps tools
- IT Tools
- Ops Panel
- Mission
- Settings
- Major DevOps / IT tool cards

## Guardrails preserved

- No unsafe `allowpopups` behavior.
- No Node integration in remote content.
- No raw IPC exposure.
- No direct PSA/API/provider secrets.
- No Store, GA, or signed-release claim.

## Verification

Run:

```powershell
Set-Location D:\dev\browser\app
npm run build
npm run verify:pass-337-cursor-root-cause-closeout
npm run verify:pass-338-cursor-runtime-root-cause-closeout
npm run verify:pass-339-normal-browsing-input-paint-closeout
npm run verify:pass-340-chrome-input-hittest-closeout
npm run verify:pass-341-normal-browser-and-feature-clickability-closeout
npm run dev
```

Manual runtime acceptance remains required on Windows because Electron GUI click-through cannot be fully proven in a headless build environment.
