# PASS155 — Admin Console Profiles v1

PASS155 adds the first Admin Console Profiles catalog and wires it into the existing launch recipe / Mission Control surface.

## Added

- `src/shared/admin-console-profiles-contract.ts`
- `scripts/verify-pass-155-admin-console-profiles.mjs`
- `docs/admin-console-profiles-pass155.md`
- `PASS_155_ADMIN_CONSOLE_PROFILES_SUMMARY.md`

## Hardened behavior

- Admin Console Profiles are data-driven Mission launch recipes.
- Profiles carry browser profile kind, launch URLs, Mission layout, pane roles, runbook steps, evidence prompts, policy tags, and stop conditions.
- PSA/ticket profile is reference-only and connector-gated.
- No direct PSA API calls, secrets, or generated artifacts were added.

## Release chain

- `verify:pass-155-admin-console-profiles` added.
- PASS155 runs after PASS154 and before the final build in `verify:release-blockers`.

remaining enterprise GA passes: 7
