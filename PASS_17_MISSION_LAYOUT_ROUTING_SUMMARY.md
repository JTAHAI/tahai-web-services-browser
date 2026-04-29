# PASS 17 - Mission Control Layout Routing Polish

Date: 2026-04-29

## Scope

Bounded Mission Control layout polish after Toolbar Polish. This pass keeps normal browsing simple and improves Mission Control behavior without adding backend integrations, secrets, generated artifacts, or blind runtime hacks.

## Changes

- Added active Mission pane navigation targeting so address bar navigation, Back, Forward, Reload, Home, and command-center navigation route to the active Mission pane when Mission Control is in a multi-pane layout.
- Added active pane inference when a user focuses/clicks a runtime browser tab already assigned to a Mission pane.
- Added pane quick swap helpers for the active Mission pane.
- Added command palette actions for 3-Up Triad and active pane quick swap left/right.
- Added keyboard shortcuts:
  - `Ctrl+Alt+1..4` focus Mission pane 1 through 4 (existing behavior preserved and now status-confirmed).
  - `Ctrl+Alt+Shift+Left` quick-swap active pane with previous visible pane.
  - `Ctrl+Alt+Shift+Right` quick-swap active pane with next visible pane.
- Added pane label overlay polish so active panes remain obvious in 2-up, 3-up, 4-up, and focus layouts.
- Added `verify:pass-17-mission-layout-routing` and wired it into `verify:release-blockers` before build.

## Verification performed in this environment

- `node scripts/verify-public-repo.mjs` - OK
- `node scripts/verify-enterprise-release.mjs` - OK
- `node scripts/verify-mission-tabs-security.mjs` - OK
- `node scripts/verify-mission-tabs-ux.mjs` - OK
- `node scripts/verify-pass-16-toolbar-polish.mjs` - OK
- `node scripts/verify-pass-17-mission-layout-routing.mjs` - OK

## Local Windows verification required

Run:

```powershell
Set-Location C:\dev\browser\app
npm ci
npm run build
npm run verify:release-blockers
npm run dev
```

Manual checks:

- Open 2-Up / 3-Up / 4-Up Mission layouts.
- Focus panes with `Ctrl+Alt+1..4`.
- Confirm Back / Forward / Reload / address bar navigation only targets the active Mission pane.
- Confirm `Ctrl+Alt+Shift+Left/Right` swaps active pane assignment without losing mission state.
- Confirm normal single-tab browsing stays clean.
