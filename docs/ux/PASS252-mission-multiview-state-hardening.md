# PASS252 — Mission Multi-View State Hardening + 2.0.x Version Increment

## Scope

PASS252 hardens Mission multi-view behavior after the PASS251 visual containment pass.

This pass specifically targets the failure mode where Mission Control looks good on first entry but can get visually stuck or broken after repeated switching between:

- 1-Up
- 2-Up / Split
- 3-Up / Tri-view
- 4-Up / Quad
- Focus Pane
- Back-and-forth restored/maximized switching

## Version truth

PASS252 increments the app/package version inside the 2.0.x lane to at least `2.0.1`.

The apply script updates:

- `package.json`
- `package-lock.json`, when present
- `npm-shrinkwrap.json`, when present

The script is idempotent. Re-running PASS252 does not repeatedly bump the patch version.

## Source-side changes

PASS252 adds two hardening layers.

### 1. CSS layout-state hardening

The CSS patch makes Mission view layout state deterministic with explicit selectors for:

- `data-mission-layout="single"`
- `data-mission-layout="split"`
- `data-mission-layout="triple"`
- `data-mission-layout="quad"`
- `data-mission-layout="focus"`

It also reinforces:

- `min-width: 0`
- `min-height: 0`
- grid/flex containment
- webview/iframe pane fill
- pointer-event recovery after transitions
- restored-width stacking behavior
- active-pane-friendly focus layout

### 2. Renderer Mission view state guard

The renderer patch adds a state normalization guard that runs after layout controls, keyboard shortcuts, resize events, and relevant Mission DOM mutations.

It normalizes:

- one `data-mission-layout` truth value
- one `mission-layout-*` class
- pane host pane count
- pane indexes
- stale transition classes
- stuck `pointer-events: none`
- stuck `inert` state
- active-pane recovery when no pane is active
- webview/iframe min-size repair
- resize/reflow dispatch after rapid switches

## Guardrails

PASS252 does not add installer artifacts, certificates, generated MSIX/MSI/EXE files, secrets, or runtime data.

PASS252 does not claim Microsoft Store readiness. Store submission remains blocked until installed-app visual smoke confirms Mission switching across 1/2/3/4/focus in restored, maximized, and ultrawide states.

## Verification

Run from repo root:

```powershell
npm run verify:pass-252-mission-multiview-state-hardening
```

Expected output:

```text
PASS252_MISSION_MULTIVIEW_STATE_HARDENING=PASS
```

## Manual smoke checklist

After rebuild/install, test this sequence at restored size, maximized size, and ultrawide/fullscreen size:

1. Launch browser.
2. Open Mission.
3. Switch 1-Up → 2-Up → 3-Up → 4-Up → Focus Pane.
4. Switch back Focus Pane → 4-Up → 3-Up → 2-Up → 1-Up.
5. Repeat quickly with toolbar buttons.
6. Repeat with keyboard shortcuts where available.
7. Confirm active pane border remains visible.
8. Confirm webviews fill pane space.
9. Confirm no pane remains hidden, inert, pointer-locked, or clipped.
10. Confirm the Mission modal scrolls internally without hiding critical controls.
