# PASS134 — Active-pane Routing Brutal Regression Pass

## Purpose

Close the final UX/regression hardening item before the KB/onboarding lane by making browser navigation impossible to silently route to the wrong surface when Mission Control is active.

## Scope

Browser-side source only. No backend work, no PSA connector work, no secrets, no generated installers, and no runtime profiles committed.

## Changes

- Added one canonical PASS134 route resolver for navigation-sensitive actions.
- Address-bar submits, toolbar buttons, menu commands, shortcuts, mouse XButtons, print, reload, home, launchpad, Guide/KB, About, and DevTools now resolve through the same active-pane-aware path.
- Hidden active Mission panes are repaired before routing.
- `activeTabId` is synchronized to the visible active Mission pane before navigation-sensitive commands.
- Back/forward on an empty or historyless target now fail closed with a safe no-op status instead of affecting another pane.
- Added PASS134 route telemetry on `document.body.dataset` for manual QA/evidence.
- Added `verify:pass-134-active-pane-routing-regression` and wired it into `verify:release-blockers`.

## Acceptance

- Version remains `1.8.30`.
- Browser-side only.
- Active-pane routing remains compatible with PASS88/PASS89/PASS133.
- No raw `active()?.webview.reload()` or `active()?.webview.print()` routing remains.
- Release blockers include the PASS134 verifier.
