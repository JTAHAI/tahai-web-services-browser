# PASS271-R2 — Verifier Windows Path Repair

## Purpose

PASS271-R1 repaired the TypeScript/build blockers in `src/renderer/app.ts`, but its verifier used Windows shell mode while invoking `process.execPath`. On machines where Node lives under `C:\Program Files\nodejs\node.exe`, the verifier split the path and failed with:

```text
'C:\Program' is not recognized as an internal or external command
```

PASS271-R2 repairs the verifier itself so the build gate can run on Windows.

## Changes

- Replaces the PASS271-R1 verifier process runner with shell-free `spawnSync` for Node syntax checks.
- Runs `npm run build` through `cmd.exe /d /s /c` on Windows to avoid unquoted path failure.
- Adds `verify:pass-271-r2-verifier-windows-path-repair` to `package.json`.
- Keeps version target at `2.0.14`.
- Does not add new product features, Store submission claims, signing claims, or GA claims.

## Run

```powershell
Set-Location C:\dev\browser\app
node scripts\apply-pass271-r2-verifier-windows-path-repair.mjs
npm run verify:pass-271-r2-verifier-windows-path-repair
```

The R2 verifier invokes the repaired R1 verifier, which then runs `npm run build`.

## Remaining passes

0
