# PASS105 — Build Green Boundary Repair

PASS105 repairs the TypeScript build regressions exposed by local Windows verification after PASS104 while preserving the PASS95 permission-origin boundary and PASS100/PASS104 capture metadata hardening.

## Fixed

- Electron permission handler details keep Electron-inferred types instead of narrowing `details` to `Record<string, unknown>`.
- Permission origin extraction now accepts `unknown` details and reads only known origin-like fields through a tiny safe accessor.
- activeCaptureSourceUrl now coerces fallback values to a string before passing them into the active capture URL sanitizer.

## Guardrail retained

- Permission grants still require the PASS95 origin-aware boundary.
- Unknown or malformed permission details still fail closed to the current webContents URL fallback or empty origin.
- Active capture URL fallback still routes through the PASS100 sanitizer before renderer/export use.

## Verification

- Added `verify:pass-105-build-green-boundary-repair`.
- Wired PASS105 into `verify:release-blockers`.
