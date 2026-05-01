# Browser downloads page copy — v1.8.21 public RC

## TAHAI Web Services Browser v1.8.21 Public Release Candidate

A Chromium-compatible command browser for developers, DevOps operators, IT engineers, and builders.

TAHAI Browser keeps normal browsing clean, then opens into Mission Control when the work needs more context.

### What is new

- Quad View and Mission Control for large monitors, support desks, and engineering workflows.
- Mission Tabs with role-aware panes for consoles, docs, runbooks, logs, tickets, evidence, monitoring, and live validation targets.
- Evidence Pack v3 for local handoff packets with redaction awareness.
- OpsTools Pack 1 for practical IT/DevOps checks and local Markdown output.
- IT Docs and PSA reference contracts designed for future authorized server-side integration without storing provider secrets in the browser.

### Download

Windows x64 public RC installer: publish the generated `.exe` from the `release/` directory.

Optional MSI: publish only if the Windows builder generated and locally verified it.

Checksums: publish `SHA256SUMS.txt` beside the installer artifacts and tell users to compare SHA256 values before installing.

### Preview warning

This is an unsigned preview build. Windows may show a SmartScreen warning until the approved code-signing lane is active. Only install downloads from the official TAHAI site or the official GitHub Releases page.

### Best fit

- DevOps engineers switching between CI logs, cloud consoles, runbooks, and live targets.
- IT admins using Microsoft 365, Entra, Google Workspace, Cloudflare, registrars, ticket systems, and documentation in the same operational context.
- Builders using big monitors, ultrawides, or TV-style workstations who want browser panes that preserve useful aspect ratios.

### Source posture

The project is open source under Apache-2.0 with TAHAI trademark attribution. Generated installers, runtime profiles, caches, credentials, and local Mission data are not committed to the source repository.
