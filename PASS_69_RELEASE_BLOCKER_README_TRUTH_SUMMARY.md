# PASS69 — Release Blocker README Truth Repair

PASS69 fixes the late release-blocker failure observed after PASS68:

- `PASS45_PUBLIC_RELEASE_CANDIDATE_FAIL=readme-version-not-updated`

The README already reported the current source version in its build-status table, but the older PASS45 verifier expects a literal `Version: `<package.version>`` marker or the original 1.8.21 RC marker. This pass adds the explicit current-version marker without changing package version, Electron settings, installer settings, or Mission View source behavior.

Also removes the stale generated `testwrite` file if present in the uploaded working tree, because PASS45 correctly treats it as a generated-artifact blocker.

Version remains `1.8.30`.
