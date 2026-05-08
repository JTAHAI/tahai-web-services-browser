# PASS129 — Guide / Knowledge Base Repo Foundation

## Purpose

Turn the old first-run Guide into the local TAHAI Browser Knowledge Base entry point, with source-reviewable KB articles and an explicit screenshot intake path for later user-supplied screenshots.

## Changed

- Replaced `browser/onboarding/index.html` with a local-first **Guide / Knowledge Base** page.
- Added `browser/onboarding/kb-manifest.json` as the machine-readable article/screenshot manifest.
- Added `docs/kb/README.md` with screenshot intake instructions.
- Added `docs/kb/articles/*.md` for the first 18 main-feature KB articles.
- Added screenshot placeholder directories without committing generated screenshots.
- Updated renderer local-page metadata from `First-run guide` to `TAHAI Knowledge Base`.
- Updated app menu labels from `First-run Guide` to `Guide / Knowledge Base`.
- Added `scripts/verify-pass-129-kb-repo-foundation.mjs`.
- Added `npm run verify:pass-129-kb-repo-foundation`.
- Wired PASS129 into `verify:release-blockers`.

## Screenshot queue

1. Main browser normal mode
2. Guide / KB entry point
3. Mission Control open
4. Mission Tabs
5. 2-Up Split View
6. 3-Up Top
7. 3-Up Bottom
8. Quad View
9. Active pane focus
10. Runbook Rail
11. Operator Command Center
12. DevOps tools
13. IT tools
14. Site View rail
15. Evidence/export
16. Downloads/installers
17. Settings/profiles/security
18. Error/empty/blocked/redaction state

## Verification

Validated in the extracted PASS129 source tree:

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm run verify:public-repo
npm run verify:pass-128-guide-mission-triview-hardening
npm run verify:pass-129-kb-repo-foundation
```

`npm run verify:release-blockers` was started as a full chain and passed through PASS81 before the container timeout. The remaining PASS82-PASS129 release-blocker segment plus final build was then run and passed.

A normal `npm ci` stopped because the container could not resolve `github.com` while Electron tried to download its binary. The source compile/build was validated using `npm ci --ignore-scripts`, which installs package sources and types without running Electron's download script.

## Version

Version remains `1.8.30`.
