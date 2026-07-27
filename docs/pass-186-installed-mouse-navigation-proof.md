# PASS186 — Installed Mouse Navigation Proof Harness

## Purpose

PASS185 fixed the source path for Mouse Button 4/5 history routing. PASS186 adds the installed-app proof harness so that navigation parity cannot be claimed from source inspection alone.

The proof lane covers:

- Mouse Button 4/5 in normal active tabs.
- Mouse Button 4/5 while focus is inside remote `<webview>` content.
- Toolbar Back/Forward parity.
- Alt+Left/Alt+Right parity.
- Application menu Back/Forward parity.
- Address-bar navigation targeting.
- Split, Tri-view, Quad View, Focus/recovery, and hidden-pane guard cases.
- Active Mission pane targeting and safe no-op behavior when history is unavailable.

## Added source surfaces

- `src/shared/installed-mouse-navigation-proof-contract.ts` defines the required installed-app proof case matrix.
- `scripts/run-pass186-installed-mouse-navigation-proof.ps1` generates operator evidence JSON and Markdown from the source contract.
- `scripts/verify-pass-186-installed-mouse-navigation-proof.mjs` statically verifies that the proof harness, PASS185 routing, and release-blocker chain remain intact.
- `package.json` exposes `proof:pass-186-installed-mouse-navigation` and `verify:pass-186-installed-mouse-navigation-proof`.

## Guardrails

- This pass does not fake installed-app proof.
- The PowerShell runner does not synthesize mouse input, send keyboard events, or perform network calls.
- Installed behavior is not complete until every generated proof case is marked PASS by the operator against the installed Windows app.
- Navigation authority remains the existing active tab / visible active Mission pane resolver.
- No raw IPC exposure.
- No global mouse hook.
- No remote-page script injection.
- Version remains `2.0.18`.

## Run locally

```powershell
Set-Location C:\dev\browser\app
npm run verify:pass-186-installed-mouse-navigation-proof
npm run proof:pass-186-installed-mouse-navigation
```

Then complete the generated checklist under `artifacts/pass186-installed-mouse-navigation-proof/` against the installed app. Do not commit generated artifacts.

## Manual acceptance

PASS186 can be marked complete only when the operator confirms all generated cases PASS for the installed Windows app, including normal tab, focused webview, Split, Tri-view, Quad, menu, toolbar, shortcut, address-bar, hidden-pane, no-op, and dedupe cases.
