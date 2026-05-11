# PASS165 — Responsive Mission Recipe Hardening

PASS165 follows the PASS163/PASS164 compact-window fixes and closes the remaining adjacent risks found in the full-source review.

## Fixed surfaces

- More Tools now has a known-action settle contract for every moved control, including cross-module controls owned by Site View and Chromium Bookmarks.
- The central renderer action type now tracks all known More Tools actions instead of only the shell-owned subset.
- Cross-module More Tools actions keep the same first-click settle window even when they fall back to their native button handler.
- Mission Recipes now refactor for every selected Mission Type. If a type has no exact recipe pack yet, it shows an affinity-matched set instead of dumping the full library and making the selector feel unchanged.
- Audit and Security Review now get contextual recipe matches from evidence, handoff, security, incident, certificate, firewall, and admin-oriented recipes.

- Mission evidence metadata now keeps PASS91 redaction handoff expectations intact by re-sanitizing metadata keys and values before validated mission storage.
- Remote tab/evidence metadata now routes through PASS104 tab metadata sanitizers before mission evidence storage.
- PASS112 titlebar verifier and PASS113 adaptive chrome verifier now accept instrumented tabs nav markup while still requiring tabs to remain in the topbar/titlebar row.

- PASS141 release-truth verifier now follows the renderer lifecycle fallback module after PASS161 modularization instead of falsely requiring fallback literals in `app.ts`.

- PASS144 supply-chain verifier now allowlists the PASS162 verifier source and enterprise support bundle redaction contract so explicit guardrail literals are not misreported as committed secrets.

## Guardrails preserved

- No raw IPC added.
- No PSA/API/provider secrets added.
- No direct PSA connector behavior added.
- Version remains 1.8.30.
- Static verifier blocks regression of the More Tools known-action set and Mission Type recipe fallback behavior.

## Local manual check

At compact widths, open More Tools and first-click each moved item once:

- About
- Settings
- Guide
- Launchpad
- Ops Panel
- Profile Switcher
- Site View
- Bookmark Star
- Bookmarks

Then open Mission Control and change Mission Type through deployment, incident, support, documentation, migration, audit, admin, development, security-review, and generic. The recipe section should visibly refactor each time.

- PASS158 allowpopups runtime assertion now uses boolean-attribute presence semantics instead of falseable `getAttribute` checks, preserving PASS153 popup hardening.

- PASS157 evidence verifier now accepts the stricter mission-evidence metadata sanitizer wrapper instead of forcing the older direct sanitizer call.

- PASS158 verifier now recognizes renderer-shell-lifecycle owns runtime-E2E dataset truth after renderer modularization.
