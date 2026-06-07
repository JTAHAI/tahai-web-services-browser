# PASS271-R2 QA — Verifier Windows Path Repair

## Gate

PASS271-R2 is a verifier/runtime evidence gate repair. It closes the Windows path quoting failure in the R1 TypeScript/build-blocker verifier.

## Acceptance

- The R1 verifier no longer uses `shell: process.platform === 'win32'` for `process.execPath` syntax checks.
- Node syntax checks run with `spawnSync(process.execPath, ['--check', file], { shell: false })`.
- Windows build invocation runs via `cmd.exe /d /s /c npm run build`.
- The R2 verifier runs the R1 verifier, which proves the build.
- No Store, signing, or GA claims are introduced.
