# PASS141 — Version/about/update-channel truth pass

Version remains `1.8.30`.

## Completed

- Added shared release-truth source module: `src/shared/release-truth.ts`.
- Reused shared release truth from download UX source.
- Updated main-process runtime config to expose safe release metadata: version, pass, channel, update channel, update policy, signing status, and public download/repo origins.
- Replaced hard-coded OpsDiagnostics user-agent version with the shared release version.
- Updated the local About page from stale `1.8.28 / PASS54 polish` copy to v1.8.30 / PASS141 / public-rc truth.
- Added `browser/about/release-truth.json` for static about-page/site-copy parity.
- Documented manual update-channel posture: no silent auto-update in this preview lane.
- Added verifier `scripts/verify-pass-141-version-about-update-channel-truth.mjs`.
- Wired `verify:pass-141-version-about-update-channel-truth` into `verify:release-blockers` after PASS140 and before final build.

## Guardrails preserved

- Browser-side source/docs/verifier changes only.
- No IT Docs backend code.
- No PSA connector code.
- No direct PSA API calls.
- No secrets or token fields.
- No generated installers, generated handoff files, `dist/`, `release/`, `node_modules/`, runtime profiles, or local data included.

## Validation

Run:

```bash
npm run build
npm run verify:public-repo
npm run verify:pass-140-download-install-checksum-ux
npm run verify:pass-141-version-about-update-channel-truth
npm run verify:release-blockers
```
