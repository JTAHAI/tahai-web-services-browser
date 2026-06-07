# PASS333 Bug Hunt Notes

The current evidence after PASS332 is:

- `npm run build` passes.
- Electron logs still show PASS271_R9 webview attach/load events.
- The website flashes briefly.
- The runtime then becomes a white surface.
- Browser chrome buttons stop working.

PASS333 treats this as a layer/hit-test bug, not a URL/load bug.

Priority next if PASS333 still shows white:

1. Use `window.__TAHAI_PASS333_CHROME_HITTEST__.lastCritical`.
2. If a webview is full-window, inspect the nearest parent chain and active CSS rule owner.
3. Remove or narrow the actual source CSS/DOM owner causing the webview to start at top edge.
4. Do not re-enable PASS329-PASS332 recovery imports until chrome hit-testing is clean.
