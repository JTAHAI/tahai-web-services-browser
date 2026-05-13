# PASS204 — Operator Command Center v2

PASS204 turns Ctrl+K into the power surface for operator workflows without changing the browser-side security boundary.

## What changed

- Adds a shared `PASS204_OPERATOR_COMMAND_CENTER_V2` contract.
- Adds command-family modeling for Mission, Layouts, Profiles, Evidence, OpsTools, and KB/Export.
- Adds target scope summaries for the active mission, layout, active pane, tab count, evidence count, and blocked runbook items.
- Adds disabled reasons so command families explain why a mission/evidence-scoped action is not complete yet.
- Adds quick filters inside the command palette that push focused search terms into the existing Ctrl+K command list.

## Boundary

No IT Docs backend code. No PSA connector code. No direct PSA API calls. No secret storage. No raw IPC exposure. No signing, Store, or GA claim.

## Local verification

```powershell
Set-Location C:\dev\browser\app
npm ci
node scripts\apply-pass204-operator-command-center-v2.mjs
npm run verify:pass-204-operator-command-center-v2
npm run verify:release-blockers
npm run build
```
