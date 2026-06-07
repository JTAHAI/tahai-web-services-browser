# PASS269 — Active Pane Routing + Input/Focus Regression Closeout

## Purpose

Prove that every operator input targets exactly one active browser surface before release: active tab or active Mission pane.

## Required installed-app coverage

- Address bar navigation targets active pane in Split/Tri/Quad/Focus.
- Toolbar Back, Forward, Reload, Stop target active pane or safely no-op with a visible reason.
- Mouse Button 4/5 target active pane or active tab.
- Alt+Left / Alt+Right target active pane or active tab.
- Ctrl+K command targeting displays active mission/pane scope.
- Ctrl+Alt+1..4 pane focus updates active-pane truth.
- Focus Pane enter/restore returns to the exact prior layout and active pane.
- Recipe-start routing does not replace the wrong pane.
- Overlay open/close returns focus to the last active pane/tab.
- No hidden active pane, orphan routing target, or focus trap.

## Release rule

PASS269 is a release-confidence pass. It must not claim Microsoft Store submission, approval, or GA.
