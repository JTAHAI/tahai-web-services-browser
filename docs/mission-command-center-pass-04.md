# PASS 04 - Mission Command Center Targeting

This pass makes the Command Palette more operationally useful without adding clutter to the browser shell.

## Added

- Command metadata for phase and target scope.
- Target badges inside Command Palette results.
- Mission pane focus commands for Pane 1 through Pane 4.
- Active-tab-to-pane routing commands for Pane 1 through Pane 4.
- Explicit DevOps/Mission command targeting for core Mission Control actions.
- Static verifier for Mission Command Center contract.

## Guardrails

- Commands stay renderer-side and call existing Mission Control functions.
- No direct PSA API calls.
- No IT Docs backend behavior is added in this repo.
- No raw IPC, shell, eval, or secret-bearing behavior is introduced.
- Active pane routing stays aligned with Mission Control guardrails.

## Manual check

Open `Ctrl+K` and search:

- `focus pane`
- `send active tab`
- `deploy cockpit`
- `quad`
- `runbook`

Commands should show target badges and should route Mission panes without horizontal toolbar scrollbars.
