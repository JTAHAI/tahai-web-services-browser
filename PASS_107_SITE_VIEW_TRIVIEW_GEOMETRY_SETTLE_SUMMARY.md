# PASS107 — Site View / 3-Up Geometry Settle

PASS107 repairs stale Mission View 3-Up geometry after Site View rail changes and Tri View variant changes.

- Tri View variant buttons now run the full Mission Layout renderer.
- Legacy `triple` layout canonicalizes to `triple-bottom`.
- Active pane is repaired if layout changes would hide it.
- Site View rail layout-change events carry reasons and trigger multi-step viewport settle.
- Mission stage records PASS107 geometry markers for rail side, rail width, and settle reason.
