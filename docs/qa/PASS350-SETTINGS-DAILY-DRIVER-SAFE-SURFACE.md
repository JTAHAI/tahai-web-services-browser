# PASS350 - Settings Daily-Driver Safe Surface

PASS350 extends the TAHAI Browser settings surface with a few practical daily-driver controls while keeping the existing Electron/webview security contract intact.

## Scope

- Keep safe external handoffs inside new TAHAI tabs instead of sending them to the system browser.
- Launch maximized on the next app start when the operator enables it.
- Confirm before closing a tab when multiple tabs are open, but only when the operator explicitly enables that guard.
- Preserve managed-policy lock support for each new setting.
- Preserve popup, IPC, Node, webSecurity, and safe external-open guardrails without weakening security.

## Acceptance

- `Settings > Shell` shows controls for safe external handoff routing, launch maximized, and confirm before closing when multiple tabs are open.
- Saving settings persists the new fields through the existing sanitized settings boundary.
- Managed policy can lock the new fields and the renderer shows them as locked/inert when managed.
- Browser Kit `Open External` opens a new TAHAI tab when the in-app handoff option is enabled.
- Browser Kit `Open External` still uses the safe main-process external-open boundary when the in-app handoff option is disabled.
- `launch maximized` applies on the next start without weakening BrowserWindow security.
- `confirm before closing` only affects interactive browser tab closes and does not create runaway prompts in non-interactive flows.
- The active release-blocker contract includes PASS350 and the PASS350 verifier writes machine-readable evidence.

## Security Truth

- This pass does not add `allowpopups`, Node in remote content, raw IPC exposure, or `webSecurity: false`.
- External system-browser handoff remains behind the existing safe main-process boundary.
- Popup-as-tab behavior remains separately controlled by the existing popup safety contract.
- The new surface expands daily-driver control without weakening security.
