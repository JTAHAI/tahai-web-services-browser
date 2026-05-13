# PASS202 — Evidence Pack v2 UX

PASS202 upgrades Mission evidence from simple local pins into a predictable Evidence Pack v2 UX model.

## What changed

- Added a browser-side `mission-evidence-pack-v2` contract with explicit local-only guardrails.
- Added Evidence Pack v2 diagnostics for evidence count, active-pane captures, all-pane captures, tool-output captures, URL/title/time metadata, and current export profile.
- Added an operator-visible export profile selector for `sanitized-handoff`, `internal`, `incident-packet`, `change-record`, `itdocs-sync`, and `psa-ticket-note`.
- Added capture note input for active-pane and all-pane evidence actions.
- Reframed active page capture as active-pane capture so Mission Control routing remains predictable.
- Added all-visible-pane summary capture for Mission layouts without collecting cookies, storage, request bodies, response bodies, credentials, or hidden page data.
- Added scope/status metadata to captured evidence entries: `captureScope`, `captureStatus`, `capturedAt`, `paneId`, `exportProfile`, and `urlTitleTimeMetadata`.
- Extended the redacted Mission export packet with PASS202 scope/profile diagnostics.
- Kept IT Docs and PSA as browser-side contracts only. No connector code or direct PSA/API/provider secrets were added.

## Acceptance mapping

- Active pane capture is explicit and targets the active Mission pane where available.
- All-pane capture creates summary entries for visible Mission panes only.
- Evidence rows show title, URL, pane, timestamp, capture scope, status, and export profile.
- Export profiles are visible before copy/save.
- Success/error states write deterministic status text and renderer dataset markers.
- Small/restored windows keep evidence controls stacked safely through responsive CSS.

## Still blocked

MSIX, Store submission, signed-release claims, public GA, and broad installer push remain blocked behind the UX/security/release gates.

Version remains `1.8.30`.
