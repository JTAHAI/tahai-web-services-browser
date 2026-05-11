# PASS175 — Icon/Screen-Size UX Hardening

Version remains `1.8.30`.

## Fixed / hardened

- Replaced the ambiguous profile-only status-dot compact state with a profile glyph plus status dot.
- Changed the Bookmarks menu icon so it no longer looks like the bookmark-star action.
- Forced every secondary utility into More Tools at the smallest toolbar width instead of leaving one confusing icon behind.
- Added Tab / Shift+Tab roving focus inside More Tools for keyboard users.
- Hardened tooltip eligibility against hidden ancestors, invisible CSS, zero client rects, and stale relayout state.
- Added `aria-pressed` runtime state and explicit layout labels for Mission Control layout buttons.

## Guardrails

- Source-only patch.
- No secrets, generated artifacts, backend code, PSA connector code, raw IPC, or external-open behavior added.
- Apache-2.0 / NOTICE / TRADEMARKS / SECURITY posture preserved.
