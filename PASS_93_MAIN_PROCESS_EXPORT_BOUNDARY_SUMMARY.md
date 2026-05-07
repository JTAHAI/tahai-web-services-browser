# PASS93 — Main-Process Export Boundary

PASS93 hardens the browser-side evidence/export handoff surface by moving DevOps capture copy/save redaction enforcement into the privileged main process as a second fail-closed boundary.

## Scope

Browser-side only. No IT Docs backend work. No PSA connector work. No direct PSA API calls. No secrets or generated runtime artifacts added.

## Hardened surfaces

- `copy-devops-capture` IPC now redaction-sanitizes Markdown inside the main process before writing to clipboard.
- `save-devops-capture` IPC now redaction-sanitizes Markdown inside the main process before writing to disk.
- Main-process capture output uses the shared PASS91 evidence safety engine with the operational handoff profile.
- Main-process capture output strips null bytes, normalizes line endings, enforces the existing 120k output cap, and writes a trimmed redacted Markdown packet.
- Save dialog now labels the action as `Save Redacted Markdown`.
- Default capture path slug generation now uses the same sanitized main-process export text path.
- Evidence/change bundle, operational handoff, and Ops Guard UI copy was updated to disclose the second privileged redaction boundary.
- Export/capture action footers now carry a visual `main-process redaction boundary` marker.

## Carried forward

Because the working artifact reset removed the PASS92 ZIP from `/mnt/data`, this PASS93 source ZIP carries forward PASS92 Mission State Invariant Guard from the latest available PASS91 source.

## Verifier

Added:

```bash
npm run verify:pass-93-main-process-export-boundary
```

Wired into:

```bash
npm run verify:release-blockers
```

The verifier asserts that DevOps capture copy/save can no longer use the raw `markdownSafe(markdown).slice(...)` path and must pass through `mainProcessExportMarkdownSafe` plus shared evidence redaction before clipboard or disk output.
