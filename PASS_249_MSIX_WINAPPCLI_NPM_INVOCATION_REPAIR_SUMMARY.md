# PASS249 — MSIX WinApp CLI npm Invocation Repair

## Result

PASS249 closes the next local blocker in the Microsoft Store/MSIX lane.

## Local blocker addressed

`npm run package:win:msix` reached the WinApp CLI pack step, but the script invoked `npx winapp pack ...`. On a machine without a local `winapp` binary, npm interpreted that as a package lookup for `winapp`, which returned `404 Not Found`.

## Repair

- Replaced the bare `npx winapp` package lookup path.
- Added installed `winapp` PATH detection.
- Added scoped npm fallback through `@microsoft/winappcli`.
- Hardened PASS247 and PASS248 verifiers so this stale invocation cannot return.
- Added PASS249 verifier and release-blocker wiring.

## Release truth

This pass does not submit to the Microsoft Store and does not claim a signed public direct-download package. Store submission remains blocked pending installed smoke, Partner Center identity, package evidence, privacy/support links, and release gate evidence.
