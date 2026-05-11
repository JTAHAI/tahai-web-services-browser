# PASS167 — Overlay Source-Safe Close Guard

PASS167 hardens the shared overlay close path so a close event for one overlay cannot clear another overlay that is still active.

## Problem fixed

The browser has several overlay owners: More Tools, command toolbar, Ops Panel, Site View, and Mission Control. The cycle guard can intentionally close a non-active overlay while preserving the active one. Before this pass, the global close handler always deleted `data-pass116-active-overlay` even when the close event named a different/non-active source. That could leave a visible overlay open without active-overlay truth, causing viewport/cycle audits to no-op or later dismiss the wrong surface.

## Hardening

- Active overlay state is cleared only when the close event has no source, no active source exists, or the close source matches the active source.
- Non-active close events preserve the active overlay and write PASS167 telemetry.
- PASS167 markers are mounted in the renderer shell, More Tools, and Site View modules.
- A dedicated verifier guards against reintroducing unconditional active-overlay deletion.

## Verification

Run:

```powershell
npm run verify:pass-167-overlay-source-safe-close
npm run typecheck
npm run build
```
