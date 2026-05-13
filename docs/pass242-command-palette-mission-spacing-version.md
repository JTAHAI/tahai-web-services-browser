# PASS242 — Command Palette + Mission Control Spacing / 1.9.0 Version Lane

Purpose: close the post-maximize Ctrl+K flash-close issue, clean Mission Control card overlap, and bump the public RC lane to `1.9.0`.

What changed:
- Ctrl+K open is idempotent while the command palette is already open.
- Command palette gets a short flash guard after `showModal()` so a maximize/restore stale close cannot immediately collapse it.
- Native dialog cancel is routed through the explicit close path.
- Command palette rows are clamped and contained so diagnostics, targets, shortcuts, and details cannot overlap.
- Mission Control command cards, recipe cards, evidence preview cards, redaction cards, and action rows now wrap/clamp within their own boxes.
- Version truth updated from `1.8.30` to `1.9.0` with release pass `PASS242`.

Boundary:
- No Microsoft Store/2.0 claim.
- No IT Docs backend or PSA connector changes.
- No generated installers committed.
