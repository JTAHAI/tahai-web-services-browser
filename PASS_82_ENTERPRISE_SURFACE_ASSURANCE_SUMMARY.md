# PASS82 — Enterprise Surface Assurance

PASS82 hardens all browser surfaces again without drifting into IT Docs backend work, PSA connectors, secrets, or generated artifacts.

## Added

- Enterprise Surface Assurance command.
- `Ctrl+Alt+Shift+A` runtime assurance shortcut.
- Redaction-scanned PASS82 assurance report copy path.
- Status bar live-region hardening.
- Command registry metadata checks, required-command checks, duplicate command ID checks, and shortcut-collision checks.
- Evidence/export textarea boundaries: autocomplete off, spellcheck off, and redaction-boundary markers.
- External shell link hygiene: unsafe protocols blocked and HTTP(S) anchors repaired with safe target/rel behavior.
- Mission non-pane drop surface re-assertion and pane aria-label assurance.
- Webview assurance re-check for unsafe webpreferences, allowpopups=false, and autosize=off.
- Esc recovery for command toolbars and Ops panel.

## Guardrails preserved

- Browser-side only.
- No direct PSA API calls.
- No IT Docs backend code.
- No secrets, credentials, generated installers, `node_modules`, `dist`, `release`, or runtime profiles in source.
- Normal browser mode remains clean; Ops Mode / Mission Control remains optional.
