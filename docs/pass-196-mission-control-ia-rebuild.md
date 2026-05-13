# PASS196 — Mission Control IA Rebuild

## Purpose

Make Mission Control feel like the flagship enterprise work surface instead of a collection of lower panels. Operators should immediately see the active mission, mission type/state, active pane/navigation target, layout, runbook readiness, evidence count, timeline count, and export safety posture.

## Changes

- Added a Mission Control command deck above the compact jumpbar.
- Added seven top-level IA cards: Mission, Active pane, Layout, Runbook, Evidence, Timeline, and Export.
- Wired the deck to local Mission state so active pane, layout, runbook step counts, evidence count, timeline count, and export state update during normal Mission rendering.
- Preserved the browser-side-only boundary. The IA deck is local and display-only; it does not add IT Docs or PSA backend behavior.
- Added responsive Mission Control CSS so the deck stays readable on constrained/restored windows.
- Added a static verifier and release-blocker wiring for the PASS196 surface.

## Verification

Run:

```powershell
Set-Location C:\devrowserpp
npm run verify:pass-196-mission-control-ia-rebuild
```

## Acceptance

- Mission Control visibly exposes the current mission identity and workflow state.
- Active pane/navigation target is obvious before navigation commands are used.
- Layout, Runbook Rail, Evidence Pack, Timeline, recipes/tools, saved missions, and export preview remain first-class sections.
- No generated artifacts, secrets, IT Docs backend work, PSA connector work, or direct integration secrets are added.
- Version remains `1.8.30`.
