# PASS195 — First-Run Operator Walkthrough v2

Status: source hardening complete.

## Fixed

- Added a typed operator walkthrough contract for first-run state.
- Added a First 10 minutes in-app KB panel for normal browsing, Mission Control, Mission Views, Runbook Rail, DevOps/IT tools, evidence/export, settings, and troubleshooting.
- Routed Guide / KB entry points to the operator walkthrough anchor.
- Added query/hash handling for `walkthrough=operator-v2` without storage, telemetry, or remote calls.
- Removed visible development-pass labels from the public KB screenshot sections.
- De-duplicated the First-run walkthrough KB article.
- Added PASS195 verifier and release-blocker wiring.

## Not claimed

This pass does not certify installed Windows or Linux behavior. It hardens source, local static KB behavior, and verifier coverage. Installed-app onboarding proof remains a local/manual gate.

Version: 1.8.30 unchanged.
