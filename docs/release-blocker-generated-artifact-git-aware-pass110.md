# PASS110 — Generated Artifact Git-Aware Release Blocker Repair

PASS110 separates two different hygiene questions that were previously conflated:

1. **Local Git workspace verification:** `npm ci` may create `node_modules/`, and `npm run build` may create `dist/`. That is acceptable if those generated folders are ignored and not tracked.
2. **Strict source ZIP hygiene:** the returned source ZIP must not contain `node_modules/`, `dist/`, `release/`, `artifacts/`, `.pass-runs/`, secrets, or local runtime data.

PASS110 keeps the source ZIP rule intact while allowing local post-install verification to run.
