#!/usr/bin/env node
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const errors = [];
const need = (condition, message) => { if (!condition) errors.push(message); };

const app = read('src/renderer/app.ts');
const rail = read('src/renderer/site-view-mission-rail.ts');
const summary = read('PASS_106_SITE_VIEW_TRIVIEW_BINDING_SUMMARY.md');
const pkg = JSON.parse(read('package.json'));
const releaseBlockers = String(pkg.scripts?.['verify:release-blockers'] || '');

need(pkg.scripts?.['verify:pass-106-site-view-triview-binding'] === 'node scripts/verify-pass-106-site-view-triview-binding.mjs', 'package-script-missing');
need(releaseBlockers.includes('verify:pass-106-site-view-triview-binding'), 'release-blockers-not-wired');

need(app.includes('webview.dataset.browserTabId = tabId'), 'webview-stable-browser-tab-id-missing');
need(app.includes('button.dataset.browserTabId = tabId'), 'tab-button-stable-browser-tab-id-missing');
need(app.includes('webview.dataset.pass106SiteViewTabId = tabId'), 'webview-pass106-tab-marker-missing');
need(app.includes('button.dataset.pass106SiteViewTabId = tabId'), 'button-pass106-tab-marker-missing');
need(app.includes("document.addEventListener('tahai-site-view-send-tab-to-pane'"), 'site-view-pane-send-event-listener-missing');
need(app.includes('pass106AssignBrowserTabToMissionPaneFromSiteView'), 'site-view-direct-pane-assignment-helper-missing');
need(app.includes('upsertBrowserTabIntoMissionPane(tabId, safePaneId, { activateLayout: true })'), 'site-view-pane-send-does-not-use-mission-upsert');
need(app.includes("document.addEventListener('tahai-site-view-rail-layout-change'"), 'site-view-layout-change-event-listener-missing');
need(app.includes('pass106RepaintMissionViewAfterSiteRail'), 'site-view-triview-repaint-helper-missing');
need(app.includes('pass72ScheduleMissionPanePixelLayout()'), 'pixel-layout-reschedule-missing');
need(app.includes('pass74ScheduleMissionPaneRelayoutRetries(reason)'), 'relayout-retry-missing');
need(app.includes('pass77ForceMissionPaneViewportFit(reason)'), 'viewport-fit-reschedule-missing');
need(app.includes('pass76RefreshMissionPaneDirectMoveControls(reason)'), 'direct-move-control-refresh-missing');
need(app.includes('stageEl.dataset.pass106SiteViewMissionFit'), 'stage-pass106-fit-truth-marker-missing');

need(rail.includes('browserTabId: string'), 'rail-snapshot-browser-tab-id-missing');
need(rail.includes('const webviewByTabId = new Map<string, CaptureCapableWebview>()'), 'rail-webview-map-missing');
need(rail.includes("webview.dataset.browserTabId || webview.dataset.pass106SiteViewTabId"), 'rail-webview-dataset-pairing-missing');
need(rail.includes("button.dataset.browserTabId || button.dataset.pass106SiteViewTabId"), 'rail-button-dataset-pairing-missing');
need(rail.includes("document.dispatchEvent(new CustomEvent('tahai-site-view-send-tab-to-pane'"), 'rail-pane-send-custom-event-missing');
need(rail.includes("document.dispatchEvent(new CustomEvent('tahai-site-view-rail-layout-change'"), 'rail-layout-change-custom-event-missing');
need(rail.includes("dispatchRailLayoutChange(open ? 'open' : 'closed')"), 'rail-open-close-layout-signal-missing');
need(rail.includes("dispatchRailLayoutChange('side')"), 'rail-side-layout-signal-missing');
need(rail.includes("dispatchRailLayoutChange('density')"), 'rail-density-layout-signal-missing');
need(!rail.includes('document.querySelector<HTMLButtonElement>(`[data-send-active-pane="${paneId}"]`)'), 'legacy-hidden-control-click-path-still-present');
need(!rail.includes('button.click();\n        setShellStatus(`${snapshot.title} sent'), 'legacy-delayed-active-tab-click-still-present');

need(summary.includes('PASS106 — Site View / Tri View Binding Repair'), 'summary-title-missing');
need(summary.includes('stable browser tab ID'), 'summary-stable-id-missing');
need(summary.includes('Mission View 3-Up'), 'summary-triview-repair-missing');

if (errors.length) {
  console.error('PASS106 Site View / Tri View binding verifier failed:');
  for (const error of errors) console.error(' - ' + error);
  process.exit(1);
}

console.log('PASS106 Site View / Tri View binding verification passed.');
