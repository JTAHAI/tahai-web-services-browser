# PASS270 — Restored/Maximized/Small-Window Visual Soak

## Goal

Hard-close restored, maximized, small laptop, 1080p, and wide-window visual behavior so flagship browser surfaces do not overlap, clip, collapse, orphan routing, create dead panes, or reduce useful web content to a sliver.

## Scope

Browser-side only. This pass does not add IT Docs backend code, PSA connector code, direct PSA API calls, provider secrets, or Store/GA claims.

## Covered surfaces

- Mission Control
- Mission recipes
- Mission cards
- 1-Up / 2-Up / Tri / Quad / Focus layouts
- Webview lifecycle geometry
- Active-pane visibility
- Runbook Rail
- Evidence Pack
- Command Center / Ctrl+K
- More Tools
- DevOps tools
- IT tools
- Settings
- KB / Guide
- Overlays and drawers
- Normal content/website pane

## Required window profiles

- Restored compact: 1280 × 720
- Small laptop: 1366 × 768
- 1080p restored/maximized: 1920 × 1080
- Wide operator display: 2560 × 1440
- Maximized Windows shell profile using available screen bounds

## Release blocker assertions

- No Mission card overlap.
- No hidden or clipped recipe buttons.
- No unscrollable cards.
- No overlay collision.
- No website/content pane collapse.
- No black/bottom-only webview panes.
- No orphaned active pane.
- No clipped Command Center / More Tools / Mission / Settings / KB surfaces.
- Restored, maximized, small laptop, 1080p, and wide layouts preserve useful website budget.
- Store status remains not-submitted and not-approved.

## Verifier

```powershell
npm run verify:pass-270-restored-maximized-small-window-visual-soak
```

## Installed evidence gate

The gate is intentionally fail-closed and requires a real installed-app evidence JSON at:

```text
release-candidate/evidence/pass270-restored-maximized-small-window-visual-soak-evidence.json
```

Override path:

```powershell
$env:PASS270_EVIDENCE="C:\path\to\pass270-evidence.json"
npm run gate:pass-270-restored-maximized-small-window-visual-soak
```

## Evidence must include

- Installed package version and SHA256.
- Source commit.
- Store posture truth: not-submitted / not-approved.
- Operator approval.
- Window-profile results for restored compact, small laptop, 1080p, wide, and maximized.
- Surface results for Mission Control, recipes, cards, overlays, panes, Runbook Rail, Evidence Pack, Command Center, More Tools, DevOps/IT tools, Settings, and KB.
- Screenshots or evidence references for every required window profile.
- Truthful known-issues text; `pending` is blocked.
