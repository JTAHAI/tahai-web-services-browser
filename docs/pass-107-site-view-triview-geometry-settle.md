# PASS107 — Site View / 3-Up Geometry Settle

PASS107 makes Mission View 3-Up refit deterministic after Site View rail open/close, side changes, density changes, and Tri View variant changes.

## Acceptance

- Site View rail changes dispatch a reasoned layout-change event.
- Mission View records PASS107 settle markers.
- Tri View variant changes run `renderMissionLayout()` and viewport settle.
- Legacy `triple` layout canonicalizes to `triple-bottom`.
