# PASS164 — Responsive Overlay Action Reliability

PASS164 hardens the compact-window action path that showed up after PASS163.

## Fixed surfaces

- Mission Control no longer announces itself as the active overlay until the async mission-store refresh has completed and the dialog is actually opening.
- The overlay viewport/reflow guard treats Mission Control's opening phase as intentional, not stale state.
- More Tools now has a first-click action broker. Moved controls dispatch through a deterministic custom action request before the overflow panel is allowed to close or trigger overlay cleanup.
- Settings, About, Guide, Launchpad, Ops Panel, Profile Switcher, Site View, Bookmark Star, and Bookmarks are covered by the first-click broker.
- Mission Type selection now refactors the Mission Recipes list immediately. Deployment shows deployment recipes, admin shows admin recipes, incident shows incident recipes, and unsupported/generic types safely fall back to the full library.

## Why this matters

Small windows create a tighter sequence of pointer, focus, resize, overlay arbitration, and viewport reflow events. The previous path could make the first click act like focus/settle instead of action. PASS164 makes the click path explicit and gives the target overlay a short settle window before More Tools is closed.

## Guardrails preserved

- Browser-side only.
- No backend, PSA connector, credentials, or raw IPC behavior added.
- Version remains 1.8.30.
- Existing PASS163 reflow guard remains intact.
