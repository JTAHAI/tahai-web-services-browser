# PASS 62 — Mission layout timeline event type repair

## Purpose

PASS 62 fixes a TypeScript blocker introduced by the mission pane close polish helper. The renderer used the timeline event kind `layout-changed`, but the canonical mission timeline union only allows `layout-set`.

## Apply

```powershell
Set-Location C:\dev\browser\app
npm run pass62:apply
npm run verify:pass-62-layout-event-type-fix
npm run build
```

## Guard

The verifier fails if:

- `src/renderer/app.ts` contains `layout-changed`.
- `scripts/apply-pass59-mission-pane-close-polish.mjs` would reintroduce `layout-changed`.
- `package.json` does not expose the PASS 62 apply/verify scripts.
- `verify:release-blockers` is missing the PASS 62 verifier.
