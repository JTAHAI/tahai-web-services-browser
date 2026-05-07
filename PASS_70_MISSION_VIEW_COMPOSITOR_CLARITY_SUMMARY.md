# PASS70 — Mission View Compositor Clarity

PASS70 fixes blurred Mission View panes by keeping Electron `<webview>` surfaces out of compositor states that can rasterize hosted pages as scaled/blurred layers.

## Changes

- Keeps Mission View `<webview>` panes as `display:block` instead of flex surfaces.
- Removes rounded clipping, overflow clipping, transforms, filters, opacity dimming, box shadows, and paint containment from the actual hosted webview surface.
- Preserves active/drop/source pane affordances with outlines instead of dimming or transforming webviews.
- Adds transient cleanup for stuck drag/click-swap classes on Escape, blur, mouseup, or page visibility loss.
- Adds `verify:pass-70-mission-view-compositor-clarity` and wires it into release blockers.

## Reason

Electron webviews are compositor surfaces. Applying decorative CSS directly to the webview element can make Chromium render the hosted page through an intermediate bitmap layer, which appears permanently blurred while the TAHAI chrome and pane labels stay sharp.
