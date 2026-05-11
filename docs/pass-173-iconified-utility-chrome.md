# PASS173 — Iconified Utility Chrome + Accessible Tooltips

## Scope

PASS173 reduces top-chrome pressure by converting secondary utility pills into icon-first controls while preserving readable labels for the primary product controls.

Core product controls such as Mission Control, DevOps, and IT Tools remain text-forward. Secondary controls such as Launchpad, Guide, Profiles, Ops Panel, Site View, Bookmarks, Settings, About, and More Tools now support iconified display when the toolbar is compact.

## What changed

- Utility controls now use a stable `utility-chrome-button` structure with a `.chrome-action-icon` and `.chrome-action-label`.
- At normal widths the controls remain icon + label.
- At compact widths the label is visually hidden rather than removed, keeping accessible names available.
- Every iconified utility control keeps a `title`, `aria-label`, and `data-pass173-tooltip` hook.
- More Tools and Guide quick-anchor controls created at runtime use the same structure.
- Runtime-generated Site View and Chromium bookmark controls use the same structure.
- Labels remain visible inside the More Tools overflow menu so the menu stays clear.

## Guardrails

- No raw IPC.
- No inline click handlers.
- No external-open behavior.
- No version bump.
- No icon-only control may rely on the icon as its accessible name.
