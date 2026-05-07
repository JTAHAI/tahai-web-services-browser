# PASS85 — Enterprise Contract Ledger

PASS85 adds a browser-side enterprise contract ledger across the shell, navigation controls, Mission surfaces, command registry, launch recipes, dialogs, panes, and evidence/export redaction gates.

## Scope

- Browser-side only.
- No IT Docs backend work.
- No PSA connector/API work.
- No secrets, generated artifacts, runtime browser profiles, installers, `dist`, `release`, or `node_modules`.

## Added

- `Enterprise Contract Ledger` command.
- `Copy Enterprise Contract Ledger Report` command.
- `Ctrl+Alt+Shift+L` shortcut.
- Runtime ledger checks for critical shell surfaces, address/navigation controls, Mission non-drop surfaces, dialogs, redaction-controlled exports, command/recipe coverage, and visible/active pane truth.
- Source-truth alias binding prior runtime doctors to the canonical `premiumLaunchRecipes` table so PASS83/PASS84 recipe doctors do not reference an undefined runtime symbol.
- `verify:pass-85-enterprise-contract-ledger` release gate wired into `verify:release-blockers`.

## Acceptance

- PASS85 verifier must pass.
- Public repo and Mission Tabs security verifiers must still pass.
- PASS83/PASS84 verifiers must still pass.
- Clean source ZIP must exclude generated artifacts.
