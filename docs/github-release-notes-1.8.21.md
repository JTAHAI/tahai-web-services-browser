# TAHAI Web Services Browser v1.8.21 Public Release Candidate

TAHAI Web Services Browser is an open-source Chromium-compatible command browser for developers, DevOps operators, IT engineers, and builders.

This public release candidate is focused on Mission Control: a clean normal browser mode with an optional operational workbench for large monitors, split views, quad views, launch recipes, evidence capture, and local-first handoff workflows.

## Highlights

- Mission Control with 1-Up, 2-Up, 3-Up, 4-Up, and Focus Pane workflows.
- Mission Tabs with roles for consoles, docs, runbooks, logs, tickets, evidence, monitoring, live targets, vendor portals, and local tools.
- Quad View for DevOps, IT Admin, DNS migration, support, and incident workflows.
- Evidence Pack v3 with local export posture, redaction awareness, and sanitized handoff support.
- OpsTools Pack 1 for local IT/DevOps utilities and handoff Markdown.
- IT Docs browser contract for future authorized server-side linking.
- PSA reference contract for future IT Docs-routed PSA writeback, with no direct browser-side PSA API calls.
- Public repo hygiene gates, release-blocker verifiers, unsigned preview packaging scripts, SHA256 release manifests, and upgraded Electron/electron-builder buildchain audit posture.

## Security posture

This RC is open-source and source-clean by design:

- No PSA/API/provider secrets are stored in the browser source or Mission files.
- No direct PSA API client is implemented in the browser.
- IT Docs and PSA integrations remain browser-side reference contracts unless server authorization exists outside this repo.
- Renderer input, mission files, and remote page content are treated as untrusted.
- Generated installers, zips, `dist/`, `release/`, runtime profiles, caches, local app data, and mission/evidence data are excluded from source.

## Unsigned Windows preview

This RC is currently unsigned while the code-signing lane is pending. Windows SmartScreen may show a warning. Install only builds published through the official GitHub Releases page or official TAHAI download page.

## Verification before publish

The public RC source gate is:

```powershell
npm ci
npm run verify:public-repo
npm run verify:release-blockers
npm run verify:mission-tabs-security
npm run release:public:verify
```

The Windows public RC build command is:

```powershell
npm run release:public:win
```

Publish `SHA256SUMS.txt` with the release artifacts.
