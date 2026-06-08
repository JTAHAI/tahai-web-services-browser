# PASS343 - IT/DevOps Priority Browser Kit

## Scope

PASS343 adds a daily-driver Browser Kit without demoting the TAHAI IT and DevOps lanes.

The toolbar order remains:

1. DevOps tools
2. IT Tools
3. Ops/Mission/Settings/About utility controls
4. Browser Kit daily-driver tools

## Fixed / Added

- Real `Find in Page` now targets the active webview or active Mission pane instead of focusing the address bar.
- Browser Kit flyout adds New Tab, Close Tab, Find, Print, Copy URL, Open External, Bookmarks, Downloads, and Page Zoom controls.
- Browser Kit uses the existing overlay owner model so hidden panels are inert and cannot block normal browsing clicks.
- Page zoom uses `webview.setZoomFactor` on the active target, not Electron window zoom.
- Copy URL uses the existing trusted clipboard bridge.
- Open External uses the existing safe main-process external-open boundary.

## Guardrails

- DevOps and IT remain first-class in DOM order, Command Palette order, and last-tool-lane preference.
- No unsafe `allowpopups`.
- No Node in remote content.
- No raw IPC exposure.
- No direct PSA/API/provider secrets or connector behavior.
- Hidden Browser Kit and Find surfaces are pointer-inert.

## Manual Acceptance

1. Launch `npm run dev`.
2. Confirm TAHAI Portal remains visible and webview content is clickable.
3. Click DevOps and IT Tools first; both should open and close.
4. Click Browser Kit; it should open on the first click and close on the second click.
5. Open Browser Kit again and click Find Page; the find bar should open.
6. Type a query and press Enter; active-page find should run.
7. Press Escape or click Close; normal browsing clickability should return.
8. Use Browser Kit Copy URL, Print, Zoom In, Zoom Out, Reset Zoom, Bookmarks, and Downloads.
9. Enter Mission split or quad view, focus a pane, and verify Browser Kit Find/Zoom/Print target the active pane.
10. Close all overlays and verify Back, Forward, Reload, Home, address Enter navigation, New Tab, DevOps, IT Tools, Ops Panel, Mission, Settings, and Profile still click.

## Verification

Run:

```powershell
npm run build
npm run test:runtime-e2e
npm run verify:pass-343-it-devops-priority-browser-kit
```

The verifier writes machine-readable evidence to:

```text
release-candidate/generated/pass343-it-devops-priority-browser-kit-report.json
```
