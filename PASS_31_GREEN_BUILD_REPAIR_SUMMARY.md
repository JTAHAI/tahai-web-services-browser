# Pass 31 — Green Build Repair

## Purpose
Repair the Pass 30 TypeScript build failure before commit/push.

## Fixes
- Added the required `evidenceNote` field to bookmark Mission runbook steps.
- Replaced unsupported timeline event kind `updated` with supported `note`.
- Restored chevron-overflow verifier tokens required by the release-blocker gate.

## Verification
- `npm run build` passes with Electron binary download skipped during dependency install in this environment.
- Release-blocker chain reached the final build stage; a separate `npm run build` completed successfully.

## Local validation
Run on Windows from `C:\dev\browser\app`:

```powershell
npm ci
npm run build
npm run verify:release-blockers
```
