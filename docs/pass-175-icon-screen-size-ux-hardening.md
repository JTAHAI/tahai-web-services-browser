# PASS175 — Icon/Screen-Size UX Hardening

PASS175 continues the PASS173/PASS174 iconified utility chrome lane and targets the next weak responsive surface: icon-only controls at narrow widths and Mission layout controls under compact screens.

## What changed

- Profile switcher is no longer represented by a lone status dot when labels collapse. It now has a stable profile glyph plus the existing status dot.
- Bookmarks menu icon is visually distinct from the bookmark-star action, reducing confusion between “save this page” and “open saved bookmarks.”
- At tiny widths, all secondary utility controls are forced into More Tools instead of leaving the profile switcher as a cramped icon-only toolbar survivor.
- More Tools now treats Tab and Shift+Tab as roving keyboard movement inside the menu so compact menus do not leave a stale overlay open behind keyboard focus.
- Tooltip candidates are rejected when hidden by ancestors, invisible CSS, or zero client rects, reducing stale tooltip state during resize/reflow.
- Tooltip state is cleared before every responsive relayout so moved controls do not leave a floating hint behind.
- Mission layout controls now expose `aria-pressed` and explicit labels/titles so 1-Up, 2-Up, 3-Up variants, Quad, Focus, and Recover remain understandable under compact widths and assistive technology.

## Guardrails preserved

- Version remains `1.8.30`.
- No generated artifacts, packages, release output, runtime profile data, or secrets were added.
- No backend, PSA connector, credential storage, raw IPC, or external-open behavior was added.
- Normal browser mode stays clean; More Tools absorbs cramped utility controls before the address row becomes unusable.

## Verification

Run:

```bash
npm run verify:pass-173-iconified-utility-chrome
npm run verify:pass-174-iconified-utility-chrome-hardening
npm run verify:pass-175-icon-screen-size-ux-hardening
npm run typecheck
npm run build
```
