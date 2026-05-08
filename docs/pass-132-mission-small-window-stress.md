# PASS132 — Mission Control small-window stress

PASS132 hardens Mission Control when the main browser window is too narrow or too short for the full desktop workbench.

## Scope

Browser-side source only. No backend, PSA, IT Docs, installer, runtime profile, generated release, or secret material changed.

## Changes

- Adds a compact Mission jumpbar with section shortcuts for Recipes, Tabs, Runbook, Evidence, Export, and Saved missions.
- Adds PASS132 viewport states: `standard`, `compact`, and `micro`.
- Expands stress detection beyond the PASS128 emergency threshold:
  - `compact`: width below `1040` or height below `760`.
  - `micro`: width below `620` or height below `560`.
- Keeps Mission header, section jumpbar, and layout controls sticky in constrained windows.
- Collapses the Mission workbench into a deterministic single-column order under small-window stress.
- Bounds Mission sections and export preview so the dialog remains scrollable instead of feeling unavailable.
- Handles orientation changes while Mission Control is open.

## Acceptance

- Mission Control still opens through the canonical Mission button and `Ctrl+Alt+M`.
- PASS128 dialog fallback behavior remains in place.
- PASS132 adds stress-state classes and data attributes without changing version `1.8.30`.
- PASS132 is wired into `verify:release-blockers`.
