# PASS115 — Overflow Visibility Guard

## Purpose

PASS112 moved browser tabs into the effective Windows titlebar. PASS113 reduced chrome density by moving secondary controls into **More Tools** before they crowd the active address/pane-routing row. PASS114 anchored fixed overlays below the measured chrome stack.

PASS115 fixes the next visible regression risk: legacy responsive hide rules and narrow-width responsive CSS still hide controls such as **Settings**, **About**, **Launchpad**, **Guide**, and **Profile**. After PASS113 moves those controls into **More Tools**, those old `display:none` rules must not keep them invisible inside the overflow panel.

## What changed

- Adds the renderer marker `data-pass115-overflow-visibility-guard="true"`.
- Stamps overflow-managed controls with `data-pass115-overflow-visibility-guard="candidate"`.
- Adds explicit CSS overrides for `.in-toolbar-overflow` controls inside `#toolbar-overflow-items`.
- Keeps moved controls visible, clickable, focusable, and explicitly `no-drag` inside the overflow menu.
- Preserves hidden state only for controls that are intentionally `[hidden]`.
- Keeps the webview stage, Mission panes, Site View pane routing, and privileged APIs untouched.

## Guardrails

PASS115 is browser-side UX hardening only. It does not add IT Docs backend code, PSA connector code, direct PSA calls, secrets, raw IPC, external-open behavior, or webview privilege changes.

## Acceptance

- `npm run verify:pass-115-overflow-visibility-guard` passes.
- `verify:release-blockers` runs PASS115 after PASS114 and before final build.
- Version remains `1.8.30`.
