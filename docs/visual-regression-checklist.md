# TAHAI Browser visual regression checklist

Run this before every public release candidate and after any CSS/layout pass.

## Required screenshots

Capture the same flows at 1366x768, 1440x900, 1920x1080, and ultrawide 2560x1080:

1. Launchpad / default home with no panel open.
2. DevOps menu open; shortcut pills must stay inside each tool card.
3. IT Tools menu open; Secret Boundary card must replace the removed public credential vault.
4. Ops Panel open; Launch recipes must show title, provider chip, and detail without overlap.
5. Mission Control open; Mission recipes, saved missions, evidence, runbook, and export controls must scroll only inside intended panes.
6. About page; SENTINEL image must stay contained inside the card at every viewport.
7. Settings page; profile/privacy controls must not overflow.
8. Keyboard Shortcuts dialog; rows and keycaps must remain readable.

## Fail conditions

- Any horizontal scrollbar in a local page except intentional browser/webview content.
- Any recipe chip overlapping its title.
- SENTINEL/About imagery bleeding outside its card.
- Hidden close buttons or unreachable controls.
- Any production text that says “stub” or “coming soon” instead of “IT Docs-routed”, “local draft”, or “requires connector authorization”.
