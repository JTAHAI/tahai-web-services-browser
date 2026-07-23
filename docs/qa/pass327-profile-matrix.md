# PASS327 — Runtime Profile Matrix QA

_Generated: 2026-07-11T14:30:33.313Z_

## Profile Matrix

| Profile Kind | Default Mode | Ops Available | IT Tools | DevOps | Mission | Evidence | Support Bundle |
|---|---|---|---|---|---|---|---|
| personal | daily-driver | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| it-admin | ops-mode | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ |
| devops | ops-mode | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ |
| msp-support | ops-mode | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ |
| security-incident | ops-mode | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ |
| minimal-privacy | daily-driver | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| custom | daily-driver | configurable | configurable | configurable | configurable | configurable | configurable |

## Verified Behaviors

- Personal profile: Daily Driver, no ops surfaces, no IT/DevOps clutter.
- IT Admin profile: Ops Mode default, IT tools, admin consoles, mission, evidence, runbook, support.
- DevOps profile: Ops Mode default, DevOps tools, cloud consoles, mission recipes, evidence.
- MSP/Support: Ops Mode, support bundle, evidence, mission.
- Security/Incident: Ops Mode, DNS/TLS/JWT/CIDR/headers, mission, evidence.
- Minimal/Privacy: Daily Driver, privacy controls only. All operator surfaces suppressed.
- Custom: User-configurable. All surfaces toggleable.

## Ops Boundary

- Personal + Minimal/Privacy: mission overlays suppressed, drag zones suppressed, no runbook/evidence rails.
- IT/DevOps/MSP/Security: Ops Mode available, mission surfaces active.

## Evidence

See: `release-candidate/generated/pass327-profile-matrix.json`
