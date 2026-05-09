# PASS135 — KB Screenshot Ingestion Summary

Version: 1.8.30 unchanged.

## Completed

- Added `scripts/ingest-kb-screenshots.mjs`.
- Added `scripts/verify-pass-135-kb-screenshot-ingestion.mjs`.
- Promoted `docs/kb/screenshot-manifest.json` to PASS135/schemaVersion 2 with ingestion policy.
- Added screenshot directory README files for canonical docs screenshots and in-app mirrored screenshots.
- Updated the in-app KB to detect approved local screenshots and switch slots from “Awaiting screenshot” to “Screenshot ready.”
- Updated PASS130/PASS131 verifiers so future allowlisted screenshots do not break older KB gates.
- Wired PASS135 into `verify:release-blockers`.

## Commands

```powershell
npm run kb:screenshots:ingest -- --apply
npm run verify:pass-135-kb-screenshot-ingestion
```

## Notes

Missing screenshots are allowed. Only sanitized, allowlisted PNG screenshots should be committed.
