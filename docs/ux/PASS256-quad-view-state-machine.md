# PASS256 — Quad View State Machine

## Goal

Make 1-Up, 2-Up, 3-Up variants, Quad, Focus, and restore deterministic and unable to get stuck.

## Scope

Browser-side source only. No IT Docs backend code. No PSA connector code. No direct PSA/API/provider secrets.

## State-machine phases

1. `preflight` — ensure mission layout/tabs/panes exist and active pane is visible.
2. `commit` — set requested layout, active pane, visible pane list, pane-to-mission-tab mapping, and runtime tab mapping.
3. `render` — stamp DOM health attributes and force layout ownership.
4. `geometry-settle` — two animation frames plus resize events.
5. `post-assert` — assert no hidden active pane, no missing mission tab, no orphaned runtime tab, and no blank pane URL.
6. `recover` — repair active pane and missing mappings.
7. `rollback` — return to the last stable layout when recovery cannot satisfy assertions.

## Stress sequence

The verifier models 50 cycles of:

`single → split-horizontal → triple-top → triple-bottom → triple-left → triple-right → quad → focus → quad → single`

Expected total modeled transitions: **500**.

## DOM health flags

- `data-pass256-state-machine`
- `data-pass256-layout-phase`
- `data-pass256-requested-layout`
- `data-pass256-pane-visible`
- `data-pass256-active-pane`
- `data-pass256-pane-has-runtime-view`
- `data-pass256-pane-geometry-ok`

## Store posture

Microsoft Store submission remains blocked until installed Recipe + Quad/Tri/Split smoke confirms no blank panes, no bottom-only rendering, no orphaned active pane state, and reliable layout switching.
