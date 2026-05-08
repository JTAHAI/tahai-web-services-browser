# PASS127 Enterprise Release Readiness Ledger

PASS127 records the late-stage enterprise release guardrails in one place so the browser can keep moving toward public release without losing source hygiene, UI guardrails, or Linux package handoff truth.

## Scope boundary

This is browser-side release-readiness hardening only. It does not add IT Docs backend code, PSA connector code, direct PSA API calls, cloud credentials, secrets, runtime browser profiles, generated installers, or generated evidence artifacts.

## Consolidated PASS112–PASS127 release guardrail ledger

| Pass | Verifier | Release surface protected |
| --- | --- | --- |
| PASS112 | `verify:pass-112-tabs-titlebar-chrome` | titlebar chrome and Mission tab placement |
| PASS113 | `verify:pass-113-adaptive-chrome-density` | adaptive chrome density under constrained viewports |
| PASS114 | `verify:pass-114-chrome-stack-guard` | chrome stack guard against duplicated toolbar layers |
| PASS115 | `verify:pass-115-overflow-visibility-guard` | overflow visibility for command/tool lanes |
| PASS116 | `verify:pass-116-overlay-arbitration` | overlay arbitration across browser chrome surfaces |
| PASS117 | `verify:pass-117-overlay-focus-recovery` | overlay focus recovery and operator focus safety |
| PASS118 | `verify:pass-118-overlay-dismiss-recovery` | deterministic overlay dismissal and stale-state cleanup |
| PASS119 | `verify:pass-119-overlay-aria-contract` | overlay ARIA contract and accessibility state sync |
| PASS120 | `verify:pass-120-overlay-pointer-boundary` | overlay pointer boundary and click-through protection |
| PASS121 | `verify:pass-121-overlay-scroll-containment` | overlay scroll containment and viewport safety |
| PASS122 | `verify:pass-122-overlay-viewport-reflow` | overlay viewport reflow under resize/full-screen stress |
| PASS123 | `verify:pass-123-overlay-cycle-guard` | repeated overlay open/close cycle guard |
| PASS124 | `verify:pass-124-linux-rpm-toolchain-recovery` | Fedora WSL RPM toolchain recovery guidance |
| PASS125 | `verify:pass-125-linux-package-target-verifier` | target-aware Linux packaging verification |
| PASS126 | `verify:pass-126-linux-rpm-handoff-manifest` | RPM handoff manifest, SHA-256 sums, and OS/SENTINEL handoff metadata |
| PASS127 | `verify:pass-127-enterprise-release-readiness` | enterprise release readiness evidence, source ZIP hygiene, and release-blocker consolidation |

## Product surfaces PASS127 explicitly preserves

- Mission Control remains the browser-side operational control surface.
- active-pane routing remains protected by the existing mission view, active capture, and navigation-boundary verifiers.
- Site View remains protected by `verify:site-view-rail` and the tri-view/site-view binding passes.
- Titlebar chrome behavior remains protected by PASS112 through PASS115.
- Overlay guards remain protected by PASS116 through PASS123.
- DevOps and IT lanes remain protected by the mission recipe, command center, and mission-tabs verifiers.
- Linux RPM handoff manifest files are generated during package builds under `release/linux` and are not committed as source.

## Source-only release evidence report generator

PASS127 adds:

```powershell
npm run generate:release-evidence -- --markdown --output artifacts/release-evidence/tahai-browser-release-evidence.md
```

The generator may also emit JSON to stdout:

```powershell
npm run generate:release-evidence -- --json
```

Generated reports are allowed only under ignored generated-output folders such as `artifacts/` or `.pass-runs/`. The generator is intentionally not a committed artifact. It exists so an operator can produce a local evidence packet after source verification without polluting the public repository.

## Source ZIP hygiene rule

Full source ZIPs must be non-empty and must exclude:

- `.git/`
- `node_modules/`
- `dist/`
- `release/`
- `artifacts/`
- `.pass-runs/`
- runtime browser profiles and local data
- generated installers and package files such as `.zip`, `.exe`, `.msi`, `.dmg`, `.AppImage`, `.deb`, `.rpm`, and `.blockmap`

## Package-script truth rule

`verify:release-blockers` must remain a source/release-readiness gate. It must not falsely require generated package targets such as `package:linux:rpm`, `package:linux:release`, `package:win:release`, or `verify:linux-installer-handoff`. Those commands remain explicit operator/package closeout steps after the relevant package build exists.

## Local closeout commands

```powershell
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
```

Linux package closeout remains explicit and artifact-dependent:

```bash
/usr/bin/npm run package:linux:rpm
/usr/bin/npm run verify:linux-installer-handoff -- rpm
```
