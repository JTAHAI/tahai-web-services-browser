# PASS162 — Enterprise GA Decision Gate

PASS162 closes the PASS153–PASS162 enterprise lane with a source-controlled decision gate instead of a false release claim.

## Decision

Current decision status: **blocked-pending-external-evidence**.

This is intentional. The source gates can prove that the enterprise guardrails exist, are wired into release blockers, and have not regressed. They cannot honestly prove a real installed Windows/Linux package smoke, signed-package availability, manual cross-size testing, policy lockout on an installed build, or operator signoff unless that evidence is generated on the target machines.

## Required decision domains

- Source and build gates
- Windows package/install smoke
- Linux package/install smoke
- Manual cross-size QA attestation
- Enterprise policy management
- Electron webview/IPC security
- Mission evidence redaction
- Runtime E2E harness
- Signing/provenance/SBOM
- Support-bundle redaction

## Required external evidence before GA approval

- Windows installed-app smoke evidence
- Linux installed-package smoke evidence
- Cross-size responsive regression evidence
- Titlebar drag-region manual smoke evidence
- Package checksum and handoff manifests
- Runtime E2E harness run evidence from packaged app
- Enterprise admin policy lock/unlock manual evidence
- Signed package or explicit unsigned-preview approval record
- SBOM and provenance artifact checksum record
- Support bundle redaction review evidence
- Manual GA decision signoff record

## No-false-GA rule

PASS162 must block or avoid the following claims unless the external evidence exists and is attached to the release binder:

- enterprise GA approved
- production GA approved
- ready for unrestricted enterprise deployment
- all installed-app evidence complete
- signed enterprise package available

## What PASS162 adds

- `src/shared/enterprise-ga-decision-gate-contract.ts`
- `scripts/verify-pass-162-enterprise-ga-decision-gate.mjs`
- `docs/enterprise-ga-decision-gate-pass162.md`
- `PASS_162_ENTERPRISE_GA_DECISION_GATE_SUMMARY.md`
- `verify:pass-162-enterprise-ga-decision-gate`

## Verification

```powershell
Set-Location C:\devrowserpp
npm run build
npm run verify:pass-162-enterprise-ga-decision-gate
npm run verify:release-blockers
```

## Acceptance

- PASS162 runs after PASS161 and before the final build in `verify:release-blockers`.
- All PASS150–PASS162 source gates remain wired.
- The decision gate is explicit that enterprise GA is blocked until external package/install/manual evidence exists.
- No generated release artifacts, SBOMs, provenance JSON, support bundles, installers, runtime profiles, or local evidence data are committed.
- No IT Docs backend code, PSA connector code, direct PSA API calls, secrets, or provider credentials are added.
