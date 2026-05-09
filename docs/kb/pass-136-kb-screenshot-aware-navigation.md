# PASS136 — KB screenshot-aware navigation polish

PASS136 makes the shipped Guide / Knowledge Base easier to operate while screenshots are being collected.

## Scope

- Source-only browser KB work.
- No generated screenshots are required for build or verification.
- No remote screenshot loading or telemetry.
- Screenshot PNGs remain optional until explicitly ingested through `npm run kb:screenshots:ingest -- --apply`.

## User-facing changes

- Adds a screenshot readiness panel to the in-app KB.
- Shows ready / awaiting screenshot counts.
- Adds a first-missing-screenshot jump link.
- Adds filters for `Needs screenshots` and `Screenshot ready`.
- Preserves normal KB search and quick filters.

## Verification

Run:

```powershell
npm run verify:pass-136-kb-screenshot-aware-navigation
```

This pass is also wired into `npm run verify:release-blockers`.
