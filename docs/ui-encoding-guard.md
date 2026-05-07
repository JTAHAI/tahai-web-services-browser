# UI Encoding and CSS Guard

Pass 00 locks the renderer shell against character-encoding corruption and missing stylesheet regressions.

## Rules

- Renderer HTML must stay UTF-8 and declare `<meta charset="utf-8" />`.
- Toolbar/control glyphs in `src/renderer/index.html` use HTML entities such as `&larr;`, `&rarr;`, `&times;`, `&hellip;`, and `&middot;` instead of raw glyphs.
- CSS pseudo-content uses escaped code points, such as `content: '\\2605';`, instead of raw symbols.
- `src/renderer/styles/chromium-bookmarks.css` must be linked directly from `src/renderer/index.html` so the bookmarks bar never falls back to native white buttons.
- `npm run verify:ui-encoding` fails on common UTF-8/Windows-1252 corruption markers.
- `npm run verify:release-blockers` runs the UI encoding guard before the rest of the release blocker lane.

## Manual check

After `npm run build` and `npm run dev`, confirm:

- Navigation buttons render as arrows, not corrupt text.
- DevOps / IT Tools icons render cleanly.
- Close buttons render as multiplication signs.
- Bookmarks bar is dark themed and not native white buttons.
- No character-corruption boxes or Windows-1252 junk appear in the toolbar, dialogs, or bookmarks bar.
