# PASS192 — Tab Strip and Titlebar Drag Final UX

PASS192 hardens the titlebar tab strip as an enterprise browser surface instead of a rough Electron chrome workaround.

## Fixed / hardened

- The empty titlebar and empty tab-strip track remain draggable for the native window.
- Browser tab buttons, the new-tab button, and tab close hit targets explicitly opt out of window dragging.
- The tab close control is no longer rendered as a nested `<button>` inside the tab `<button>`. It is now a dedicated close hit target with role/label metadata.
- Active tab state is mirrored through `aria-selected`, `tabindex`, data attributes, and a visible active titlebar style.
- Overflowing tabs remain horizontally scrollable and expose an overflow state for diagnostics.
- Compact and high-DPI widths preserve close-target sizing and avoid accidental drag blocking.
- Arrow/Home/End keyboard movement on the tab strip updates the active tab without breaking Mission pane routing.

## Manual validation

On Windows installed app, verify:

1. Drag the window from empty titlebar space and empty tab-strip space.
2. Click tabs without moving the window.
3. Close tabs from the close target without accidentally selecting/dragging the window.
4. Create enough tabs to overflow, then scroll the strip and confirm the active tab remains obvious.
5. Test restored-window, compact-width, and high-DPI display scaling.

This pass does not claim installed-app behavior was manually verified in this environment.
