# Pass 29 — Bookmark Mission Manifest

## Goal
Harden bookmark-folder Mission launch handoff so every bookmark-launched Mission can carry a clear manifest into notes/export, without changing normal browsing mode.

## Changes
- Added bookmark Mission manifest model in `src/renderer/chromium-bookmarks.ts`.
- Added manifest counts for total bookmarks, safe URLs, duplicates skipped, unsafe/invalid blocked URLs, and opened Mission panes.
- Added Markdown manifest generation with pane/evidence labeling.
- Added `Copy Mission manifest` action to bookmark folder view.
- Added manifest payload to folder-launched and single-bookmark-launched Mission events.
- Preserved launch manifest in Mission notes for export/handoff.
- Updated Pass 27 verifier compatibility after manifest refactor.
- Added Pass 29 verifier and wired it into release blockers.

## Verified
- `node scripts/verify-pass-26-bookmark-folder-mission-launch.mjs`
- `node scripts/verify-pass-27-bookmark-mission-launch-hardening.mjs`
- `node scripts/verify-pass-28-bookmark-mission-safety-summary.mjs`
- `node scripts/verify-pass-29-bookmark-mission-manifest.mjs`
- `node scripts/verify-public-repo.mjs`

## Local follow-up
Run the normal Windows gates:

```powershell
Set-Location C:\dev\browser\app
npm ci
npm run build
npm run verify:release-blockers
npm run dev
```
