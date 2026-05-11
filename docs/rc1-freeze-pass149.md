# PASS149 — RC1 freeze and no-new-features pass

PASS149 freezes the TAHAI Web Services Browser public release-candidate lane for RC1. The goal is to stop feature creep, preserve the current enterprise-hardening work, and make the last pass about final ship/GA manifest truth instead of more product scope.

## Release truth

| Field | Value |
| --- | --- |
| Version | `1.8.30` |
| Pass | `PASS149` |
| Channel | `public-rc` |
| Update channel | `manual-release` |
| Freeze status | `rc1-freeze-no-new-features` |

Version remains `1.8.30`. The About page and renderer-safe release metadata may report PASS149 to show RC1 freeze truth, but this pass does not bump product version and does not enable silent auto-update.

## What is frozen

The following surfaces are frozen for RC1:

- Normal browser shell and titlebar/tab chrome.
- Guide/KB and More Tools overflow behavior.
- Mission Control entry and recovery for 1-Up, 2-Up, Tri-view, Quad, and Focus Pane.
- Active-pane routing for address bar, reload, back, forward, and command actions.
- Command Center inventory.
- Runbook Rail usability.
- Evidence Pack redaction/export behavior.
- KB screenshot intake and screenshot-aware navigation.
- Windows installer handoff and Linux RPM/AppImage/DEB handoff.
- Download/install/checksum UX.
- Electron security boundary.
- Public repo and supply-chain boundary.
- Privacy, support, and known-issues truth.
- Windows/Linux installed-app and cross-size manual QA evidence runners.

## Allowed after freeze

Only these changes are allowed after PASS149 unless Justin explicitly reopens scope:

- Release-blocker verifier fixes.
- Security blocker fixes.
- Build or packaging fixes.
- Installer handoff, SHA256, and manifest truth fixes.
- Documentation truth fixes.
- Manual QA evidence/checklist fixes.
- Critical regression fixes for normal browsing, Mission Control entry/recovery, active-pane routing, installer launch, or export safety.

## Blocked after freeze

The following are blocked for RC1:

- New user-facing features.
- New provider or integration surfaces.
- No direct PSA API calls.
- No IT Docs backend work.
- No secret, token, cookie, OAuth, cloud credential, or PSA credential storage.
- No silent auto-update lane.
- No telemetry or analytics additions.
- No unreviewed dependency additions.
- No generated artifacts in source, including `release/`, `dist/`, `artifacts/`, installers, manifests, local Mission output, Evidence output, runtime profiles, or `node_modules/`.
- No version bump without an explicit release decision.

## Verification

PASS149 adds `verify:pass-149-rc1-freeze` and wires it into `verify:release-blockers` after PASS148 and before the final build.

Run locally:

```powershell
Set-Location C:\dev\browser\app

npm ci
npm run build
npm run verify:public-repo
npm run verify:pass-148-cross-size-responsive-regression
npm run verify:pass-149-rc1-freeze
npm run verify:release-blockers
```

## Stop rule

If any requested change after PASS149 smells like feature work, defer it to a post-GA pass unless it is explicitly required to fix a release blocker, a security blocker, or a critical installed-app regression.

Next pass: PASS150 final ship candidate / GA manifest.
