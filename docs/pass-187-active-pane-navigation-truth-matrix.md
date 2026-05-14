# PASS187 — Active Pane Navigation Truth Matrix

PASS187 hardens the next weak enterprise browser surface after the installed mouse-navigation proof harness: navigation commands that appear to work but silently target the wrong tab or pane.

## What changed

- Added `src/shared/active-pane-navigation-truth-matrix-contract.ts` as the source contract for navigation resolution evidence.
- Added renderer-side PASS187 telemetry for address submits, toolbar back/forward/reload, mouse history buttons, menu/shortcut history commands, and safe no-op conditions.
- Every route resolution now records one target class: `mission-active-pane`, `active-tab`, or `safe-noop`.
- The renderer records pane ID, tab ID, title, URL, history availability, reason, and no-op reason into a bounded in-memory truth history.
- The address input receives PASS187 target metadata so restored/small-window Mission Control testing can prove what the next navigation action will target.
- PASS88 active-pane routing reports now refresh the PASS187 truth matrix, so diagnostics do not drift from actual routing state.

## Why this matters

The enterprise guardrail requires Back, Forward, Reload, address-bar navigation, menu commands, shortcuts, mouse buttons, and Mission panes to route to the active tab or active pane. PASS187 makes that contract inspectable at runtime instead of relying on visual guesswork.

## Manual checks

1. Open normal browsing and use Back, Forward, Reload, and address submit. Confirm `document.body.dataset.pass187LastNavigationTruth` resolves to `active-tab`.
2. Enter Split/Tri/Quad Mission Control, focus a non-default pane, and repeat toolbar, mouse, menu, keyboard, and address actions. Confirm the last truth resolves to `mission-active-pane` with the expected pane ID.
3. Try a no-history Back/Forward action. Confirm the no-op reason is explicit instead of silent.
4. Switch layouts and confirm PASS88 and PASS187 target metadata refresh together.

## Verification

```powershell
Set-Location C:\dev\browser\app
npm run verify:pass-187-active-pane-navigation-truth-matrix
```

Version remains `1.8.30`.
