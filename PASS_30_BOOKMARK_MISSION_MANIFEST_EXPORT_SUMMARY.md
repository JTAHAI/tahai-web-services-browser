# Pass 30 — Bookmark Mission Manifest Export Hardening

Source-only pass.

## Added

- Sanitized JSON Mission manifest export for bookmark folders.
- Copy manifest JSON action.
- Download manifest JSON action.
- Manifest schema version field.
- Sanitized handoff export profile marker.
- Evidence-only URL count.
- Explicit pane/evidence export roles per URL.
- Markdown label escaping for manifest handoff copy.

## Guardrails

- No generated installers or release artifacts committed.
- No secrets added.
- Normal browsing remains clean.
- Bookmark folder Mission launch remains local-only.
