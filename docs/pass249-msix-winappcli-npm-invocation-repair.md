# PASS249 — MSIX WinApp CLI npm Invocation Repair

## Why this pass exists

The PASS248 local run proved that the repo was clean, tagged, buildable, and able to create the Windows unpacked Electron app folder. The remaining failure was the WinApp CLI launch path:

```text
npm error 404 Not Found - GET https://registry.npmjs.org/winapp - Not found
```

That happened because bare `npx winapp` asks npm to resolve a package named `winapp` unless a local binary already exists. The current npm package for Microsoft WinApp CLI is scoped as `@microsoft/winappcli`.

## Implemented behavior

`packaging/windows/build-windows-msix.ps1` now uses a two-step path:

1. Use `winapp` from `PATH` when it is already installed through WinGet or another local installation.
2. Otherwise use npm's scoped package path:

```powershell
npm exec --yes --package @microsoft/winappcli -- winapp pack <input-folder> --output <output-folder> --manifest <manifest>
```

## Guardrails preserved

- No `.pfx`, `.cer`, `.msix`, `.msixupload`, Partner Center credential file, or generated package output is committed.
- The certificate path still comes only from `TAHAI_MSIX_TEST_CERT_PFX`.
- Unsigned MSIX output remains local-readiness only.
- Store submission remains blocked until the full evidence gates are clean.

## Verification

```powershell
npm run verify:pass-247-windows-store-msix-readiness
npm run verify:pass-248-msix-local-blocker-repair
npm run verify:pass-249-msix-winappcli-npm-invocation-repair
npm run package:win:msix
```
