# PASS271-R1 — TypeScript Build Blocker Closeout

Target repo: `C:\dev\browser\app`

Version truth remains `2.0.14`.

This is a repair pass for the PASS255-PASS259 renderer hardening code that blocked `npm run build` after PASS271.

## Repairs

- Replaces stale `config?.docsUrl` usage with `config?.itDocsUrl`.
- Replaces stale `MissionTab` type references with `MissionTabRef`.
- Replaces invalid timeline kind `updated` with the allowed `layout-set` event kind.
- Normalizes PASS256 mount layout requests so generic `triple` cannot be passed into the narrower PASS256 state-machine request type.
- Replaces PASS258 runtime harness block with TypeScript-safe typed helpers and typed window hooks.
- Replaces PASS259 UX polish block with TypeScript-safe typed helpers and typed window hooks.
- Adds `npm run verify:pass-271-r1-typescript-build-blocker-closeout`.

## Run after overlay

```powershell
Set-Location C:\dev\browser\app
node scripts\apply-pass271-r1-typescript-build-blocker-closeout.mjs
npm run verify:pass-271-r1-typescript-build-blocker-closeout
```

The verifier runs targeted static checks and `npm run build` unless called with `-- --static-only`.

## Store / release posture

No Store submission, Store approval, GA, or signed-release claim is made by this repair pass.
