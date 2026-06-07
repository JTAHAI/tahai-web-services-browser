# PASS271 — Release Candidate Flagship Freeze Gate

## Purpose

PASS271 is the final no-new-features release-confidence gate for the 2.0.x flagship runtime hardening lane. It freezes the Mission Control release candidate only when the previous hardening chain has real evidence and the release posture remains truthful.

## Hard scope

- Browser-side work only.
- No IT Docs backend code.
- No PSA connector code.
- No direct PSA API calls.
- No PSA/API/provider secrets in browser code, mission files, docs, fixtures, or evidence.

## Required prior chain

The freeze gate requires the source/verifier chain from:

- PASS267 — Installed Mission Control Brutal Runtime Harness
- PASS268 — WebView DOM-Ready Lifecycle Hardening
- PASS269 — Active Pane Routing + Input/Focus Regression Closeout
- PASS270 — Restored/Maximized/Small-Window Visual Soak

## Runtime surfaces that must be frozen

- Mission Control
- Mission recipes
- Mission cards
- Split/Tri/Quad/Focus layouts
- WebView lifecycle and DOM-ready command queueing
- Active pane routing
- Input/focus recovery
- Restored, maximized, small laptop, 1080p, and wide-window visual behavior
- Overlays: Command Center, More Tools, Mission, Settings, KB/Guide
- Runbook Rail
- Evidence Pack and export preview
- Installed-app smoke proof

## Acceptance

- All PASS267–PASS270 source verifiers pass.
- PASS271 source verifier passes.
- The release-candidate evidence file has real installed-app evidence, not placeholders.
- Mission Control, recipes, Quad/Tri/Split/Focus, webviews, overlays, runbook/evidence, Command Center, Settings, KB, and tools are all marked pass with evidence references.
- No hidden/clipped buttons, no unscrollable cards, no black/bottom-only panes, no content pane sliver, no orphaned active pane, and no unhandled renderer errors remain in the freeze evidence.
- Known issues are reviewed and no known release-blocking flagship issue is waived silently.
- The build remains `not-submitted` and `not-approved` for Microsoft Store.
- Public GA, Store approval, and signed-release claims remain false unless real external evidence exists.

## Local commands

```powershell
Set-Location C:\dev\\browser\\app
node scripts\\apply-pass267-installed-mission-control-brutal-runtime-harness.mjs
node scripts\\apply-pass268-webview-dom-ready-lifecycle-hardening.mjs
node scripts\\apply-pass269-active-pane-routing-input-focus-regression-closeout.mjs
node scripts\\apply-pass270-restored-maximized-small-window-visual-soak.mjs
node scripts\\apply-pass271-release-candidate-flagship-freeze-gate.mjs

npm run verify:pass-267-installed-mission-control-brutal-runtime-harness
npm run verify:pass-268-webview-dom-ready-lifecycle-hardening
npm run verify:pass-269-active-pane-routing-input-focus-regression-closeout
npm run verify:pass-270-restored-maximized-small-window-visual-soak
npm run verify:pass-271-release-candidate-flagship-freeze-gate
```

## Fail-closed evidence gate

```powershell
npm run gate:pass-271-release-candidate-flagship-freeze-gate
```

The gate reads:

`release-candidate/evidence/pass271-release-candidate-flagship-freeze-evidence.json`

or the path supplied by `PASS271_EVIDENCE`.

## Store and release truth

Microsoft Store submission remains not-submitted and not-approved. This pass may approve a release-candidate freeze only; it does not approve GA, public Store submission, Store approval, or signed direct-distribution claims.
