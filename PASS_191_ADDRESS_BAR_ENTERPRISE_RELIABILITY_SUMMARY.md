# PASS191 — Address Bar Enterprise Reliability

Implemented on top of PASS190.

## Changed

- Added typed address-bar resolution in `src/shared/navigation-boundary.ts`.
- Added PASS191 contract coverage in `src/shared/address-bar-enterprise-reliability-contract.ts`.
- Replaced address submit flow with `pass191NavigateAddressInput()`.
- Address submissions now resolve/validate before targeting `loadURL`.
- Blocked explicit unsafe schemes and embedded-credential URLs from address submissions.
- Preserved host shorthand, localhost shorthand, and configured search fallback.
- Added paste/input sanitization for control characters and input caps.
- Recorded address target tab/pane, action, reason, and blocked state for runtime diagnostics.
- Reflected address loading/idle state on the canonical address input.
- Added a PASS191 verifier and release-blocker wiring.

## Verification

Run:

```powershell
npm run verify:pass-191-address-bar-enterprise-reliability
```

Full packaging/build still requires the local Windows/Electron environment and network access for Electron dependencies.
