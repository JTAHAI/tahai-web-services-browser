# PASS154 — Enterprise Admin Policy Framework Summary

PASS154 adds the browser-side enterprise managed-policy foundation for TAHAI Web Services Browser.

## Added

- `src/shared/enterprise-admin-policy-contract.ts`
- `src/main/enterprise-admin-policy.ts`
- `scripts/verify-pass-154-enterprise-admin-policy-framework.mjs`
- `docs/enterprise-admin-policy-framework-pass154.md`

## Hardened

- Settings reads, writes, and resets now apply locked settings from the managed policy contract.
- Main process exposes sanitized policy truth through a typed `tahai-browser:get-admin-policy` IPC handler.
- Renderer preload exposes a narrow `getAdminPolicy()` API, not raw IPC or filesystem access.
- Policy v1 covers locked settings, disabled tools, allowed/blocked protocols, allowed/blocked domains, downloads, Mission export, evidence export, support bundle, and update channel posture.
- Silent auto-update remains forced off.

## Release gate

- Added `verify:pass-154-enterprise-admin-policy-framework`.
- PASS154 runs after PASS153 and before the final build in `verify:release-blockers`.

## Remaining enterprise GA passes

remaining enterprise GA passes: 8

Next planned pass: PASS155 — Admin Console Profiles v1.
