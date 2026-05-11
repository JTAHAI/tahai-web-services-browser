# PASS148 — Cross-size/responsive/manual regression checklist

PASS148 closes the responsive/manual regression lane before RC freeze. It does **not** claim that installed-app UI testing was completed by automation. It gives operators a repeatable checklist and a responsive regression evidence runner so Windows and Linux installed builds can be tested consistently.

Version remains `1.8.30`. Release channel remains `public-rc`. Update posture remains `manual-release` and unsigned preview until signing/release policy changes explicitly.

## Required installed-app viewports

| ID | Size | Why it matters |
|---|---:|---|
| `compact-960x640` | 960x640 | Catches the historical failures where Mission Control could not open, overlays collided, or Guide/KB disappeared into overflow. |
| `small-1024x768` | 1024x768 | Common VM/small laptop stress size for More Tools, Mission entry, and small-window reflow. |
| `laptop-1366x768` | 1366x768 | Baseline laptop size for normal browsing, Guide/KB, Mission Control, 2-Up, and Tri-view entry. |
| `desktop-1920x1080` | 1920x1080 | Primary enterprise desktop monitor target for 2-Up, Tri-view, Quad, Runbook Rail, and active-pane routing. |
| `wide-2560x1440` | 2560x1440 | Large builder/DevOps workstation target where TAHAI should shine as an IT/DevOps command browser. |

## Manual regression checklist

At each applicable size, record screenshot or notes for:

1. Normal browser first paint remains clean.
2. Titlebar tabs/chrome stack remains compact.
3. Guide/KB remains discoverable.
4. More Tools overflow remains reachable when Guide moves.
5. Mission Control opens at the size.
6. Mission Control overlays do not collide with titlebar, tabs, panes, or viewport edges.
7. 2-Up entry and recovery are deterministic.
8. Tri-view entry and recovery are usable and not hidden.
9. Quad entry and recovery are usable and not hidden.
10. Focus Pane restores the prior layout.
11. Pane move/drag/drop targets remain visible and reversible.
12. Active-pane marker is visible and routing target is obvious.
13. Address bar, reload, back, and forward target the active pane.
14. Command Center remains reachable.
15. Runbook Rail remains usable without trapping scroll.
16. Evidence export redaction remains accessible.
17. DevTools remains available.
18. No critical scroll trap or cut-off controls.
19. No obvious renderer crash loops or unhandled errors.

## Evidence runner

Generate the manual evidence template from the repo root:

```bash
npm run evidence:cross-size-regression -- --platform windows --operator "manual-operator"
```

For Linux:

```bash
npm run evidence:cross-size-regression -- --platform linux --operator "manual-operator"
```

The runner writes generated files under:

```text
artifacts/cross-size-responsive-regression/
```

Generated evidence is intentionally excluded from source. Fill the generated JSON/Markdown only with sanitized notes. **Do not include secrets**, cookies, tokens, raw Authorization headers, customer data, screenshots with credentials, PSA credentials, or IT Docs backend details.

## Acceptance

PASS148 source acceptance means:

- `src/shared/cross-size-responsive-regression-contract.ts` defines the viewport and checklist contract.
- `scripts/run-pass148-cross-size-responsive-regression.mjs` creates a manual-pending evidence template without claiming success.
- `scripts/verify-pass-148-cross-size-responsive-regression.mjs` verifies the contract, docs, package scripts, release-blocker wiring, and generated-artifact exclusions.
- The checklist explicitly covers Guide/KB, More Tools, Mission Control, 2-Up, Tri-view, Quad, Focus Pane, active-pane routing, Runbook Rail, Evidence export redaction, DevTools, and no console/crash noise.
- No generated evidence files are committed.
- No IT Docs backend changes, no PSA connector code, and no direct PSA API calls are introduced.
- No claim of manual responsive success is made until installed-app testing is actually performed.
