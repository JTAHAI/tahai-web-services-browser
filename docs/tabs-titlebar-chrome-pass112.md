# PASS112 — Tabs Titlebar Chrome

PASS112 removes the extra native title/menu bar level on Windows by moving the existing renderer tabs into the window chrome.

## Why

The prior shell showed the native Windows title/menu area above the TAHAI tab strip. On large displays this looked like an extra toolbar level and pushed the useful browser surface downward.

PASS112 keeps the actual browser controls intact, but makes the first renderer row the window tab strip.

## Implementation

- Uses Electron `titleBarStyle: hidden` on Windows.
- Uses `titleBarOverlay` so native minimize, maximize, and close controls remain owned by the OS.
- Enables `autoHideMenuBar` and explicitly hides the native menu bar after the application menu is installed.
- Keeps menu accelerators available through the application menu.
- Adds draggable titlebar behavior to the renderer topbar.
- Opts tabs, tab close buttons, and the new-tab button out of drag handling so tab interaction still works.
- Reserves right-side space for the native Windows caption buttons.

## Guardrails

PASS112 does not use `frame: false`, does not implement custom close/minimize/maximize buttons, and does not move privileged actions into the renderer.

The normal browser remains clean while Mission Control still stays behind Ops/Mission entry points.
