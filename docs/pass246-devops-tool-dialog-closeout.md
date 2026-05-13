# PASS246 — DevOps Tool Dialog Closeout

Fixes a real UX blocker where DevOps tool dialogs such as Route Map and Developer Audit could open but their header close buttons were not wired to close the dialogs.

Changes:
- Wires `close-route-map` to `routeMapDialog.close()`.
- Wires `close-dev-audit` to `devAuditDialog.close()`.
- Raises close-button hit targets above dense scroll/content regions.

Scope: renderer UX only. No backend, integration, security, or packaging behavior changed.
