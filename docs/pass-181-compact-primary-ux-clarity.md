# PASS181 — Compact Primary UX Clarity

## Purpose

Harden the next compact-window UX surface after PASS180. Primary controls can condense without starving the address bar, but the condensed state must remain understandable to operators.

## Changes

- DevOps and IT Tools no longer collapse into identical hamburger-only controls.
- Compact primary controls expose stable glyphs: Home, D for DevOps, IT for IT Tools, and M for Mission.
- Hover/focus titles and accessible labels explain compact glyph meaning.
- More Tools now publishes a live compact UX summary: how many controls moved, whether primary labels are compact, why controls moved, and measured address width.
- Adds runtime state markers for compact glyph readiness and overflow explanation.

## Guardrails

- No raw IPC.
- No shell/open-external changes.
- No inline click handlers.
- Existing IDs and button wiring remain unchanged.
- Version remains `1.8.30`.
