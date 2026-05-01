# TAHAI Web Services Browser — Enterprise Release Pass Plan

Current lane: Pass 34 / v1.8.10

## Hard direction
TAHAI Web Services Browser is an IT / DevOps command browser. Normal browsing stays clean. Ops Mode opens Mission Control.

Mission Control remains browser-side only:
- Mission Tabs
- Mission Views
- Mission Tools
- Mission Evidence

No IT Docs backend code, no PSA connector code, no direct PSA API calls, and no provider/API secrets in browser source or mission files.

## Remaining pass sequence to first enterprise-ready release

### Pass 35 — Release script and builder truth
- Remove or repair broken legacy package scripts.
- Pick one canonical Electron Builder config.
- Ensure Windows/Linux package commands resolve from repo root.
- Add broken-script-path verifier.
- Update README, known issues, and version references.

### Pass 36 — Mission module extraction
- Stop growing `src/renderer/app.ts`.
- Move Mission Control renderer state, renderers, exports, evidence, and recipes into focused modules.
- Import shared mission types instead of duplicating them locally.
- Add module-boundary verifier.

### Pass 37 — Profile and privacy hardening
- Clear browsing data for every active profile partition.
- Add per-profile clear data action.
- Add safe profile-folder open confirmation.
- Add profile privacy verifier.

### Pass 38 — Credential boundary hardening
- Reconcile local credential manager with the no-secret-vault browser boundary.
- Either remove from core Mission flows or gate as optional local-only user-controlled storage.
- Add warnings and verifier coverage that blocks API/provider-token language.

### Pass 39 — Evidence Pack v3
- Capture active pane screenshot.
- Capture all Mission panes.
- Store evidence files under app user data only.
- Export packet folder with markdown, manifest JSON, screenshots, and checksum summary.
- Add redaction preview before export.

### Pass 40 — OpsTools Pack 1 completion
- TLS certificate summary.
- Redirect chain inspector.
- JWT decoder, local only.
- JSON/YAML formatter.
- CIDR calculator.
- curl builder.
- Headers before/after diff.

### Pass 41 — IT Docs browser contract
- Add `/api/browser/mission-capabilities` client contract stub.
- Add IT Docs origin allowlist.
- Add signed-in/session display states.
- Add org/project/runbook reference selectors as browser-side placeholders only.

### Pass 42 — PSA reference contract
- Add PSA display-reference model.
- Add validated PSA deep links.
- Add IT Docs-routed writeback command stub only.
- Add verifier proving no direct PSA API calls or secrets exist.

### Pass 43 — Mission Views hardening
- Validate 1-up, 2-up, 3-up, 4-up, and Focus mode routing.
- Add active pane clarity pass.
- Repair mouse Button 4/5 app-command routing if still absent.
- Add keyboard map overlay verification.

### Pass 44 — Enterprise QA and installer RC
- Full `npm ci` / build / release blocker verification.
- Windows NSIS/MSI local package verification.
- Linux AppImage verification.
- Manual installed-app QA checklist.
- Update docs, known issues, privacy, support, and code-signing posture.

### Pass 45 — Public release candidate
- Final source cleanup.
- Verify no generated artifacts are tracked.
- Verify no secrets, runtime profiles, caches, or installers are committed.
- Tag release candidate.
- Prepare GitHub release notes and browser.tahai.net download copy.
