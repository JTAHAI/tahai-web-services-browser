# Pass 37 — Profile and privacy hardening

## Completed
- Added explicit privacy settings for Do Not Track / Global Privacy Control headers, third-party Cookie header blocking, cross-site referrer reduction, and optional clear-on-exit.
- Hardened session permission checks so prompt requests and permission checks share the same allowlist.
- Added profile-scoped browsing data clearing for active, selected, and all profiles, including cookies, cache, storage, service workers, and auth cache.
- Updated profile UI copy to clarify local-only account labels, partitioned sessions, no Chrome Sync, and no stored provider/PSA secrets in profile metadata.
- Added Pass 37 verifier and wired it into release blockers.

## Verification run in this environment
- `node scripts/verify-pass-37-profile-privacy-hardening.mjs`
- `node scripts/verify-pass-36-mission-module-extraction.mjs`
- `node scripts/verify-mission-tabs-security.mjs`

## Local verification still required
- `npm ci`
- `npm run verify:release-blockers`
- `npm run build`
- Windows installed-app profile switching and data-clear smoke test.
