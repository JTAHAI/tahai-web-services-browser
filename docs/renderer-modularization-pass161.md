# PASS161 — Renderer Modularization

PASS161 starts reducing the renderer monolith without destabilizing Mission Control, tabs, pane routing, KB, Guide, More Tools, or evidence flows.

## Scope

- Browser-side source only.
- No backend work.
- No PSA connector work.
- No direct PSA API calls.
- No generated artifacts.
- No runtime profile, cache, evidence, installer, or dist output committed.

## Implemented boundary

PASS161 extracts renderer shell lifecycle work from `src/renderer/app.ts` into `src/renderer/renderer-shell-lifecycle.ts`.

That module owns:

- boot diagnostic display,
- renderer ready markers,
- PASS158 runtime E2E marker propagation,
- PASS161 lifecycle module marker,
- fallback browser configuration,
- guarded preload/config bridge loading.

The module is intentionally not allowed to own:

- raw `ipcRenderer`,
- Node filesystem access,
- webview security preferences,
- PSA fetch/writeback behavior,
- mission persistence.

## Contract

`src/shared/renderer-modularization-contract.ts` records the renderer module boundary inventory and makes future renderer extraction reviewable instead of ad hoc.

## Verification

Run:

```powershell
npm run verify:pass-161-renderer-modularization
npm run build
npm run verify:release-blockers
```

PASS161 runs after PASS160 and before the final build inside `verify:release-blockers`.
