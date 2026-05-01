# PASS 27 — Bookmark Mission Launch Hardening

## Completed

- Bookmark-folder Mission launches now preserve bookmark titles in Mission tabs, runbook steps, and evidence entries.
- Bookmark-folder Mission launches now carry source metadata (`sourceFolderId`, `sourceKind`, `paneOpened`) for local-only handoff/export context.
- Folder launch still caps live Mission panes at four, but preserves all safe folder URLs as Mission Evidence metadata.
- Mission pane roles are assigned with a lightweight DevOps/IT heuristic instead of all URLs defaulting to generic roles.
- Single-bookmark Mission launch now carries the bookmark title and source metadata.
- Pass 27 verifier added and wired into release blockers.
- Pass 26 verifier updated to accept the hardened layout helper/evidence metadata while preserving the original acceptance intent.

## Validation

- `node scripts/verify-pass-26-bookmark-folder-mission-launch.mjs` — PASS
- `node scripts/verify-pass-27-bookmark-mission-launch-hardening.mjs` — PASS
- `node scripts/verify-public-repo.mjs` — PASS

## Local Windows validation still recommended

```powershell
Set-Location C:\dev\browser\app
npm ci
npm run build
npm run verify:release-blockers
npm run dev
```
