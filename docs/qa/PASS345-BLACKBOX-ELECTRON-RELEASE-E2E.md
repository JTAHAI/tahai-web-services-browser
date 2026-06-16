# PASS345 Black-Box Electron Release E2E

## Purpose

PASS345 adds an external Electron acceptance runner so release readiness no longer depends only on renderer-local `element.click()` coverage. The runner launches the built app through Playwright's Electron driver, uses real pointer and keyboard input, resizes the native window, captures screenshots, and writes machine-readable evidence under `release-candidate/generated/pass345-blackbox-electron-release-e2e/`.

## Commands

- `npm run build`
- `npm run test:blackbox-e2e`
- `npm run test:blackbox-e2e:plan`
- `npm run verify:pass-345-blackbox-electron-release-e2e`

## Coverage

- Launch shell and active webview stage-fit proof
- Real restored desktop profiles: `1460x940` and `1366x768`
- Launchpad, Guide, address bar, Back, Forward, Reload, and Home
- DevOps, IT Tools, Browser Kit, Ops Panel, Settings, Profile dialog, and Command Palette
- Browser Kit Find flow plus real guest click proof inside `#webview-stage`
- Browser Kit history/session recovery: Duplicate Tab, Reopen Closed Tab, recent-page population, and restore-session availability
- Browser tab pinning and switching: Pin Tab, `Ctrl+Tab`, `Ctrl+Shift+Tab`, and `Ctrl+1`
- Mission Control open/create/add-tab, Quad/Focus layouts, and export preview
- Restored-window regression coverage for the repeatable profile dialog issue
- Browser Kit cards must be scrolled into real hit-test ownership before the runner clicks them
- If a profile hits transient Electron timing noise, the runner relaunches that profile once and reruns the full slate on a fresh app instance

## Evidence

- JSON result: `release-candidate/generated/pass345-blackbox-electron-release-e2e/pass345-blackbox-electron-release-e2e-result.json`
- Markdown summary: `release-candidate/generated/pass345-blackbox-electron-release-e2e/pass345-blackbox-electron-release-e2e-summary.md`
- Per-profile scenario screenshots in the same directory

## Release Gate Role

PASS345 is wired into `verify:release-blockers:contract` in two places:

- Static verifier before the final build
- Live black-box run after the final build and before PASS158 runtime E2E

That ordering keeps the source contract fail-closed while still requiring real UI proof before the release blocker chain can pass.
