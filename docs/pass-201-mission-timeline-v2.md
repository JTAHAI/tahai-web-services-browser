# PASS201 — Mission Timeline v2 UX

PASS201 adds the Mission Timeline v2 UX layer after PASS200 Runbook Rail v2. The goal is to make Mission Control activity understandable without crowding the browser chrome or creating a packaging/deployment shortcut.

## What changed

- Added `src/shared/mission-timeline-v2-contract.ts` as the source contract for Timeline v2.
- Added a visual event model for mission, tab, layout, pane, runbook, evidence, tool, and export activity.
- Added event filters: all, mission, tabs, layout, pane, runbook, evidence, tools, and export.
- Added operator timestamps and export-safe summaries to timeline events.
- Added renderer diagnostics and body dataset truth for Timeline v2 state.
- Added Timeline v2 styles that collapse cleanly under compact and micro Mission Control viewports.
- Added `tool-run`, `pane-focused`, and `tab-removed` event coverage.
- Updated Mission export so timeline rows use export-safe summaries instead of raw detail text.

## Guardrails preserved

- Timeline v2 remains local-only and browser-side-only.
- Timeline events store bounded, sanitized metadata only.
- Timeline export uses redaction-aware export-safe summaries.
- No IT Docs backend code was added.
- No PSA connector code was added.
- No direct PSA API calls were added.
- No provider secrets or credential fields were added.
- MSIX / Store work remains blocked behind the full UX hardening gate.

## UX acceptance

- Timeline has a clear visual hierarchy: diagnostics, filters, rail labels, timestamps, event title, export-safe summary, and source surface.
- Mission activity can be filtered by event class without changing mission state.
- Layout changes, pane focus, tab add/remove, notes, checklist/runbook updates, evidence capture, export, and operator tool-run events are represented.
- The Timeline surface remains inside Mission Control and does not steal website/content pane budget.
- Compact and micro Mission Control viewports keep timeline cards single-column and scroll-contained.

## Verification

```powershell
Set-Location C:\dev\browser\app
npm run verify:pass-201-mission-timeline-v2
npm run verify:pass-200-runbook-rail-v2
npm run verify:release-blockers
```

Version remains `1.8.30`.

PASS201 explicitly covers layout/change/evidence events in the filterable local timeline.
