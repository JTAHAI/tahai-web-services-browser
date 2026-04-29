# Site View Mission Rail

The Site View Mission Rail is a PDF-viewer-style visual navigation rail for live browser sites.

It turns open tabs into scrollable visual site thumbnails while keeping normal browsing clean. It is local-first, privacy-aware, and designed to support Mission Control, Split View, Quad View, Focus View, and evidence capture.

## Pass 3 additions

- Safe/Visual privacy toggle.
- Pause/Resume thumbnail capture to keep CPU/GPU use predictable.
- HTTPS / HTTP / Local / Safe status chips.
- Copy URL quick action.
- Keyboard navigation outside the rail: `Ctrl+Alt+J` and `Ctrl+Alt+K`.
- Force-refresh previews: `Ctrl+Alt+Shift+V`.
- Privacy shortcut: `Ctrl+Alt+Shift+P`.
- In-rail keys: `C` copy URL, `R` reload, `F` focus, `P` toggle privacy mode.

## UX

- Toggle button: `Site View`
- Shortcut: `Ctrl+Alt+V`
- Mouse wheel scrolls the rail
- Click a thumbnail to activate that site
- Double-click a thumbnail to focus the site and close the rail
- Right-click a thumbnail to reveal quick actions
- Drag a thumbnail to reorder open tabs
- Actions: copy URL, reload, capture evidence, send to Mission pane 1-4, close
- Active site is visually outlined
- Aspect ratio is preserved with `object-fit: contain`

## Privacy and security

- Thumbnails are generated locally with Electron webview capture APIs.
- The rail does not expose APIs to remote pages.
- Sign-in, auth, billing, checkout, and password-like URLs default to title-only cards.
- Safe mode turns all thumbnails into title-only cards.
- Thumbnails are kept in memory only.
- Nothing is synced or exported unless the user explicitly captures evidence through existing browser tooling.
- The rail makes no network requests, exposes no IPC, and stores no image data in localStorage or IndexedDB.

## Build validation

Run from the app root:

```powershell
Set-Location C:\devrowserpp
npm run typecheck
npm run build
npm run verify:site-view-rail
npm run verify:release-blockers
```

## Pass 06 — Site View v2

- Thumbnail cards are explicit tab switchers: clicking a preview activates the matching browser tab.
- Hovering a preview refreshes the thumbnail opportunistically without storing image data in localStorage.
- Site favorites are stored as safe URL/title keys only; pinned cards float to the top of Site View.
- Compact density keeps action buttons readable and preserves the aspect-ratio-safe thumbnail frame.
