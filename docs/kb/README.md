# TAHAI Browser Knowledge Base

PASS129 turns the old first-run Guide into the browser Knowledge Base source repo. The in-app Guide / KB page is static source under `browser/onboarding/` and ships through the existing static-copy build path.

## Canonical KB goals

- Explain the main browser features in user-facing language.
- Keep the KB local-first so it opens offline.
- Leave screenshot slots explicit without committing generated captures or runtime browser data.
- Preserve the browser-side only boundary: no IT Docs backend code, PSA connectors, secrets, tokens, cloud credentials, or direct PSA API behavior.
- Keep every article source-reviewable in this repo.

## PASS130 screenshot intake hardening

- Canonical screenshot manifest: `docs/kb/screenshot-manifest.json`.
- Human capture checklist: `docs/kb/screenshot-intake.md`.
- Article writing rules: `docs/kb/article-authoring-contract.md`.
- Real screenshots are added only after review and only as sanitized public/user-facing KB assets.

## Screenshot intake list

Use PNG screenshots. Prefer full-window captures unless a focused crop is specifically needed.

| Order | File name | Article |
| --- | --- | --- |
| 01 | `01-main-browser-normal-mode.png` | Getting started |
| 02 | `02-guide-kb-entry.png` | Guide / Knowledge Base |
| 03 | `03-mission-control-open.png` | Mission Control |
| 04 | `04-mission-tabs.png` | Mission Tabs |
| 05 | `05-two-up-split-view.png` | 2-Up Split View |
| 06 | `06-three-up-top.png` | 3-Up Top |
| 07 | `07-three-up-bottom.png` | 3-Up Bottom |
| 08 | `08-quad-view.png` | Quad View |
| 09 | `09-active-pane-focus.png` | Active pane routing |
| 10 | `10-runbook-rail.png` | Runbook Rail |
| 11 | `11-command-center.png` | Operator Command Center |
| 12 | `12-devops-tools.png` | DevOps tools |
| 13 | `13-it-tools.png` | IT tools |
| 14 | `14-site-view-rail.png` | Site View rail |
| 15 | `15-evidence-export.png` | Evidence and export |
| 16 | `16-downloads-installers.png` | Downloads and installers |
| 17 | `17-settings-security.png` | Settings, profiles, and safety |
| 18 | `18-error-empty-blocked-state.png` | Troubleshooting states |
| 19 | `19-first-run-walkthrough.png` | First-run walkthrough |

## Editing rule

Update the Markdown article first, then mirror the user-facing copy into `browser/onboarding/index.html` and `browser/onboarding/kb-manifest.json`. Run `npm run verify:pass-129-kb-repo-foundation` and `npm run verify:pass-130-kb-screenshot-intake`.


## PASS131 search/navigation polish

PASS131 adds a local-only KB search panel, quick filters, source `docs/kb/search-index.json`, and a self-hosted `browser/onboarding/kb-search.js` controller. The KB search does not use remote scripts, telemetry, network requests, cookies, localStorage, or external services.

## PASS135 screenshot ingestion

PASS135 adds a source-side screenshot ingestion workflow. Put sanitized PNG files in `docs/kb/screenshots/` using the exact names from `docs/kb/screenshot-manifest.json`, then run:

```powershell
npm run kb:screenshots:ingest -- --apply
npm run verify:pass-135-kb-screenshot-ingestion
```

The workflow validates file names, PNG signatures, size limits, and manifest targets before mirroring approved screenshots into `browser/onboarding/screenshots/` for the in-app KB. Missing screenshots are allowed and keep the awaiting-screenshot placeholders active.


## PASS136 screenshot-aware navigation

The shipped KB now includes screenshot readiness counts plus filters for articles that still need screenshots and articles with screenshots already ingested. Screenshots remain optional for source builds.


## PASS137 first-run walkthrough

PASS137 adds a local-first guided walkthrough to the in-app Guide / Knowledge Base. It gives new users a safe order for learning normal browsing, Guide access, Mission Control, Mission Tabs, Mission Views, active-pane routing, Runbook Rail, Command Center, tools, evidence/export, settings, and troubleshooting states. The walkthrough uses static source, a self-hosted KB script only, no telemetry, no remote KB service, no cookies, and no browser storage.
