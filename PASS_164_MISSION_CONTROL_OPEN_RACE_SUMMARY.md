# PASS164 — Responsive Overlay Action Reliability Summary

Version remains `1.8.30`.

Remaining enterprise GA passes: 0.

## Changes

- Mission Control async open race guard added so the dialog is not treated as a stale overlay while mission-store refresh is still pending.
- More Tools first-click action broker added so compact-menu controls execute on the first click before the overflow panel closes.
- Site View and Chromium Bookmarks now participate in the same More Tools broker as the app-owned buttons.
- Mission Type recipe refactor added so changing the Mission Type selector immediately refactors the Mission Recipes list to matching recipes.
- Settings duplicate `showModal()` guard added to prevent repeated compact-click dialog errors.

## Verification

Run:

```powershell
npm run verify:pass-164-mission-control-open-race
npm run typecheck
npm run build
```
