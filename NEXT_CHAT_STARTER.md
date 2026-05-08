# TAHAI Web Services Browser — PASS128 Handoff

We are continuing TAHAI Web Services Browser hardening after PASS127.

Repo:
`C:\dev\browser\app`

Public repo:
`https://github.com/JTAHAI/tahai-web-services-browser`

Current version:
`1.8.30` unless explicitly incremented.

Latest completed source ZIP:
`TAHAI-browser-pass127-enterprise-release-readiness-20260508.zip`

Latest completed pass:
**PASS127 — Enterprise Release Readiness Evidence**

PASS127 added:

- `scripts/generate-release-evidence-report.mjs` as a source-only release evidence report generator.
- `scripts/verify-pass-127-enterprise-release-readiness.mjs`.
- `generate:release-evidence` for optional local evidence output under ignored generated-output folders.
- `verify:pass-127-enterprise-release-readiness`, wired into `verify:release-blockers` after PASS126 and before final build.
- A consolidated PASS112–PASS127 release-readiness ledger in `docs/enterprise-release-readiness-pass127.md`.
- Stronger generated-installer hygiene coverage for ZIP, EXE, MSI, DMG, AppImage, DEB, RPM, and blockmap outputs.
- Version remains `1.8.30`.

Hard scope:
Browser-side work only. No IT Docs backend work. No PSA connector work. No direct PSA API calls. No secrets, tokens, cloud credentials, runtime browser profiles, generated installers, dist, release, node_modules, artifacts, `.pass-runs`, or local data in source.

Security guardrails:
Open-source posture. Never trust renderer input, mission files, remote page content, webview metadata, downloads, or diagnostics targets. No blind DOM hacks. No raw IPC exposure. No shell.openExternal without validated wrapper. Webviews/remote pages get no Mission APIs, no Node integration, and no privileged IPC.

Immediate validation:

```powershell
Set-Location C:\dev\browser\app
npm ci
npm run build
npm run verify:public-repo
npm run verify:mission-tabs-security
npm run verify:site-view-rail
npm run verify:pass-112-tabs-titlebar-chrome
npm run verify:pass-113-adaptive-chrome-density
npm run verify:pass-114-chrome-stack-guard
npm run verify:pass-115-overflow-visibility-guard
npm run verify:pass-116-overlay-arbitration
npm run verify:pass-117-overlay-focus-recovery
npm run verify:pass-118-overlay-dismiss-recovery
npm run verify:pass-119-overlay-aria-contract
npm run verify:pass-120-overlay-pointer-boundary
npm run verify:pass-121-overlay-scroll-containment
npm run verify:pass-122-overlay-viewport-reflow
npm run verify:pass-123-overlay-cycle-guard
npm run verify:pass-124-linux-rpm-toolchain-recovery
npm run verify:pass-125-linux-package-target-verifier
npm run verify:pass-126-linux-rpm-handoff-manifest
npm run verify:pass-127-enterprise-release-readiness
npm run verify:release-blockers
npm run dev
```

Linux RPM validation from Fedora WSL remains explicit and artifact-dependent:

```bash
wsl -d FedoraLinux-43 --cd /mnt/c/dev/browser/app
/usr/bin/npm ci
/usr/bin/npm run build
/usr/bin/npm run diagnose:linux:rpm-toolchain
/usr/bin/npm run package:linux:rpm
/usr/bin/npm run verify:linux-installer-handoff -- rpm
```

Next task:
Build PASS128 as the next bounded enterprise-release hardening pass. Inspect the actual browser app source, run the PASS127 release-readiness ledger, and pick the next weakest release-blocking/operator surface.

Suggested PASS128 targets:

- Deepen operator-visible release diagnostics without adding generated artifacts to source.
- Add a source ZIP verifier command that validates a ZIP path before handoff.
- Tighten manual Windows installed-app checklist evidence without claiming unverified local UI behavior.
- Continue preserving Mission Control, active-pane routing, Site View, titlebar chrome, overlay guards, DevOps/IT lanes, Linux package handoff, and source hygiene.
- Add `verify:pass-128-...` and wire it into `verify:release-blockers`.
- Return a full source ZIP and SHA-256.

## Prior release-continuity markers required by earlier verifiers

- PASS86 Source Contract Sentinel
- PASS87 Operator Recovery Mesh
- PASS88 Active Pane Routing Failsafe
- PASS109 Release Blocker Continuity Repair
- PASS110 Release Blocker Generated Artifact Git-Aware
- PASS111 Release Blocker Build Phase Ordering

## Chrome/overlay/Linux continuity markers

- PASS112 — `verify:pass-112-tabs-titlebar-chrome`
- PASS113 — `verify:pass-113-adaptive-chrome-density`
- PASS114 — `verify:pass-114-chrome-stack-guard`
- PASS115 — `verify:pass-115-overflow-visibility-guard`
- PASS116 — `verify:pass-116-overlay-arbitration`
- PASS117 — `verify:pass-117-overlay-focus-recovery`
- PASS118 — `verify:pass-118-overlay-dismiss-recovery`
- PASS119 — `verify:pass-119-overlay-aria-contract`
- PASS120 — `verify:pass-120-overlay-pointer-boundary`
- PASS121 — `verify:pass-121-overlay-scroll-containment`
- PASS122 — `verify:pass-122-overlay-viewport-reflow`
- PASS123 — `verify:pass-123-overlay-cycle-guard`
- PASS124 — `verify:pass-124-linux-rpm-toolchain-recovery`
- PASS125 — `verify:pass-125-linux-package-target-verifier`
- PASS126 — `verify:pass-126-linux-rpm-handoff-manifest`
- PASS127 — Enterprise Release Readiness Evidence — `verify:pass-127-enterprise-release-readiness`
