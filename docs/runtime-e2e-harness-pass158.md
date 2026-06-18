# PASS158 — Runtime E2E Harness

PASS158 adds a source-tracked Electron runtime E2E harness for TAHAI Web Services Browser without adding backend services, accounts, PSA connectors, secrets, or generated release artifacts.

## Purpose

Runtime regressions have repeatedly surfaced in browser chrome, Browser Kit tab flow, Mission Control, tri-view/quad entry, active-pane routing, titlebar drag, Guide/KB access, tool-card click ownership, popup behavior, and evidence export. PASS158 creates one bounded harness that can be run locally on a desktop session to exercise those surfaces after `npm run build`.

The harness covers launch, tabs, Browser Kit tab pinning/cycling, panes, titlebar drag, popups, KB/Guide/More Tools, representative DevOps/IT/Ops action cards, Mission Control, active-pane routing, and evidence export. The launch-shell scenario also proves the active guest viewport and guest document bottom fill the webview stage, preventing the portal footer/bottom line from floating above the view pane bottom. Runtime clicks now fail closed if a control is visible in the DOM but does not own its hit target.

## What PASS158 adds

- `src/shared/runtime-e2e-harness-contract.ts` defines the PASS158 runtime scenario registry.
- Renderer runtime harness wiring exposes `window.__TAHAI_RUNTIME_E2E__.run()` only inside the trusted app shell.
- Main-process opt-in runtime execution runs only when `TAHAI_RUNTIME_E2E=1` is set.
- Stable `data-testid` selectors were added for shell surfaces that need runtime coverage.
- `scripts/run-pass-158-runtime-e2e-harness.mjs` provides both a source-only plan and live Electron run mode.
- `scripts/verify-pass-158-runtime-e2e-harness.mjs` verifies the source contract and release-blocker wiring.

## Commands

Source-only plan:

```powershell
npm run test:runtime-e2e:plan
```

Live runtime E2E after build:

```powershell
npm run build
npm run test:runtime-e2e
```

Release/source verifier:

```powershell
npm run verify:pass-158-runtime-e2e-harness
```

## Guardrails

- No backend.
- No PSA connector.
- No direct PSA API calls.
- No secrets or credential fixtures.
- No network-opening requirement by default.
- No generated release artifacts in source.
- Live runtime execution is opt-in through `TAHAI_RUNTIME_E2E=1` and writes a JSON result to a temp path.
