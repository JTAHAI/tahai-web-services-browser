# PASS329 — Runtime Lifecycle Geometry Sentry

Verifier repair: **REPAIRED3_ESM_VERIFIER**

Result: **BLOCKED_REVIEW_REQUIRED**

Scanned files: 102

Sentry imported by: none

Lifecycle candidates: 116

Ungated pass-residue lifecycle candidates: 0

## Runtime console probe

`window.__TAHAI_PASS329_VIEWPORT_LIFECYCLE__.assert('manual-after-load')`

Expected healthy value: `document.documentElement.dataset.pass329ViewportHealth === 'ok'`

## Finding categories

- active-viewport-lifecycle-owner-review: 116
- post-pass328-inline-geometry-owner: 53
- sentry-not-imported: 1

## Lifecycle candidates

- active: `src/renderer/app.ts:1633` — window.addEventListener('resize', () => pass82ScheduleEnterpriseSurfaceAssurance('scheduled'));
- active: `src/renderer/app.ts:1635` — document.addEventListener('visibilitychange', () => { if (!document.hidden) pass82ScheduleEnterpriseSurfaceAssurance('scheduled'); });
- active: `src/renderer/app.ts:1878` — window.addEventListener('resize', () => pass83ScheduleOperatorSafetyContract('scheduled'));
- active: `src/renderer/app.ts:1880` — document.addEventListener('visibilitychange', () => { if (!document.hidden) pass83ScheduleOperatorSafetyContract('scheduled'); });
- active: `src/renderer/app.ts:1882` — const observer = new MutationObserver(() => pass83ScheduleOperatorSafetyContract('scheduled'));
- active: `src/renderer/app.ts:2153` — window.addEventListener('resize', () => pass84ScheduleReleaseGateTruthMesh('scheduled'));
- active: `src/renderer/app.ts:2155` — document.addEventListener('visibilitychange', () => { if (!document.hidden) pass84ScheduleReleaseGateTruthMesh('scheduled'); });
- active: `src/renderer/app.ts:2157` — const observer = new MutationObserver(() => pass84ScheduleReleaseGateTruthMesh('scheduled'));
- active: `src/renderer/app.ts:2467` — window.addEventListener('resize', () => pass85ScheduleEnterpriseContractLedger('scheduled'));
- active: `src/renderer/app.ts:2469` — document.addEventListener('visibilitychange', () => { if (!document.hidden) pass85ScheduleEnterpriseContractLedger('scheduled'); });
- active: `src/renderer/app.ts:2471` — const observer = new MutationObserver(() => pass85ScheduleEnterpriseContractLedger('scheduled'));
- active: `src/renderer/app.ts:2778` — window.addEventListener('resize', () => pass86ScheduleSourceContractSentinel('scheduled'));
- active: `src/renderer/app.ts:2780` — document.addEventListener('visibilitychange', () => { if (!document.hidden) pass86ScheduleSourceContractSentinel('scheduled'); });
- active: `src/renderer/app.ts:2782` — const observer = new MutationObserver(() => pass86ScheduleSourceContractSentinel('scheduled'));
- active: `src/renderer/app.ts:3084` — window.addEventListener('resize', () => pass87ScheduleOperatorRecoveryMesh('scheduled'));
- active: `src/renderer/app.ts:3086` — document.addEventListener('visibilitychange', () => { if (!document.hidden) pass87ScheduleOperatorRecoveryMesh('scheduled'); });
- active: `src/renderer/app.ts:3088` — const observer = new MutationObserver(() => pass87ScheduleOperatorRecoveryMesh('scheduled'));
- active: `src/renderer/app.ts:3508` — window.addEventListener('resize', () => pass88ScheduleActivePaneRoutingFailsafe('scheduled'));
- active: `src/renderer/app.ts:3511` — document.addEventListener('visibilitychange', () => { if (!document.hidden) pass88ScheduleActivePaneRoutingFailsafe('scheduled'); });
- active: `src/renderer/app.ts:3513` — const observer = new MutationObserver(() => pass88ScheduleActivePaneRoutingFailsafe('scheduled'));
- active: `src/renderer/app.ts:3717` — window.addEventListener('resize', () => pass188ScheduleFocusInputBoundary('resize'));
- active: `src/renderer/app.ts:3925` — window.addEventListener('resize', () => pass89ScheduleMissionPaneRestoreFailsafe('scheduled'));
- active: `src/renderer/app.ts:3927` — document.addEventListener('visibilitychange', () => { if (!document.hidden) pass89ScheduleMissionPaneRestoreFailsafe('scheduled'); });
- active: `src/renderer/app.ts:3929` — const observer = new MutationObserver(() => pass89ScheduleMissionPaneRestoreFailsafe('scheduled'));
- active: `src/renderer/app.ts:4161` — window.addEventListener('resize', () => pass90ScheduleLaunchRecipeFailsafe('scheduled'));
- active: `src/renderer/app.ts:4163` — document.addEventListener('visibilitychange', () => { if (!document.hidden) pass90ScheduleLaunchRecipeFailsafe('scheduled'); });
- active: `src/renderer/app.ts:4165` — const observer = new MutationObserver(() => pass90ScheduleLaunchRecipeFailsafe('scheduled'));
- active: `src/renderer/app.ts:4183` — window.addEventListener('resize', () => pass81ScheduleAllSurfaceDoctor('scheduled'));
- active: `src/renderer/app.ts:4185` — document.addEventListener('visibilitychange', () => { if (!document.hidden) pass81ScheduleAllSurfaceDoctor('scheduled'); });
- active: `src/renderer/app.ts:4187` — const observer = new MutationObserver(() => pass81ScheduleAllSurfaceDoctor('scheduled'));
- active: `src/renderer/app.ts:4287` — window.addEventListener('resize', () => pass192ScheduleTitlebarChromeSync('resize'));
- active: `src/renderer/app.ts:4313` — pass192TitlebarChromeObserver = new MutationObserver(() => pass192ScheduleTitlebarChromeSync('mutation'));
- active: `src/renderer/app.ts:5079` — window.addEventListener('resize', () => pass339ScheduleNormalBrowsingInputPaintCloseout('resize'));
- active: `src/renderer/app.ts:5087` — if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pass339MountNormalBrowsingInputPaintCloseout, { once: true }); else pass339MountNormalBrowsingInputPaintCloseout();
- active: `src/renderer/app.ts:5271` — window.addEventListener('resize', () => pass340ScheduleChromeInputCloseout('resize'));
- active: `src/renderer/app.ts:5285` — if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pass340MountChromeInputCloseout, { once: true }); else pass340MountChromeInputCloseout();
- active: `src/renderer/app.ts:5363` — window.requestAnimationFrame(() => pass107RunMissionViewportSettle(reason + ':raf'));
- active: `src/renderer/app.ts:7190` — window.addEventListener('resize', () => pass122ScheduleOverlayViewportReflow('viewport-reflow'));
- active: `src/renderer/app.ts:7191` — window.visualViewport?.addEventListener('resize', () => pass122ScheduleOverlayViewportReflow('viewport-reflow'));
- active: `src/renderer/app.ts:7224` — window.addEventListener('resize', () => pass118ScheduleOverlayStateAudit('stale-state'));
- active: `src/renderer/app.ts:7346` — window.addEventListener('resize', () => updateToolMenuScrollState(panel));
- active: `src/renderer/app.ts:9415` — pass254MissionRecipeObserver = new MutationObserver(() => pass254AnnotateMissionRecipeCards('mutation'));
- active: `src/renderer/app.ts:9724` — window.addEventListener('resize', () => pass255HydrateSelectedRecipe('resize'));
- active: `src/renderer/app.ts:9839` — return new Promise((resolve) => requestAnimationFrame(() => { window.dispatchEvent(new Event('resize')); requestAnimationFrame(() => { window.dispatchEvent(new Event('resize')); resolve(); }); }));
- active: `src/renderer/app.ts:9870` — if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pass256MountQuadViewStateMachine, { once: true }); else pass256MountQuadViewStateMachine();
- active: `src/renderer/app.ts:9975` — function pass257ScheduleGeometry(reason: string): void { if (pass257PendingGeometryFrame) cancelAnimationFrame(pass257PendingGeometryFrame); pass257PendingGeometryFrame = requestAnimationFrame(() => { pass257PendingGeometryFrame = undefined; pass257RecalculateMissionPaneGeometry(reason); }); }
- active: `src/renderer/app.ts:9979` — pass257ResizeObserver = new ResizeObserver(() => pass257ScheduleGeometry('resize-observer'));
- active: `src/renderer/app.ts:9985` — window.addEventListener('resize', () => pass257ScheduleGeometry('window-resize'));
- active: `src/renderer/app.ts:9994` — if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pass257MountMissionPaneGeometryEngine, { once: true }); else pass257MountMissionPaneGeometryEngine();
- active: `src/renderer/app.ts:10150` — if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pass258Mount, { once: true }); else pass258Mount();
- active: `src/renderer/app.ts:10361` — if (target) window.requestAnimationFrame(() => { pass259PolishMissionControl('click'); });
- active: `src/renderer/app.ts:10367` — window.requestAnimationFrame(() => { pass259PolishMissionControl('focus'); });
- active: `src/renderer/app.ts:10370` — window.addEventListener('resize', () => { window.requestAnimationFrame(() => { pass259PolishMissionControl('resize'); }); }, { passive: true });
- active: `src/renderer/app.ts:13005` — window.addEventListener('resize', () => { if (missionDialog.open) pass128UpdateMissionViewportMode('resize'); });
- active: `src/renderer/app.ts:14345` — document.addEventListener('visibilitychange', () => {
- active: `src/renderer/app.ts:14477` — window.requestAnimationFrame(() => {
- active: `src/renderer/app.ts:14483` — window.requestAnimationFrame(() => {
- active: `src/renderer/app.ts:14593` — window.addEventListener('resize', () => pass76StartMissionPaneRepairLoop('resize'));
- active: `src/renderer/app.ts:14594` — document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pass76StartMissionPaneRepairLoop('visibility'); });
- active: `src/renderer/app.ts:14805` — window.requestAnimationFrame(run);
- active: `src/renderer/app.ts:14863` — window.requestAnimationFrame(run);
- active: `src/renderer/app.ts:14971` — window.requestAnimationFrame(run);
- active: `src/renderer/app.ts:14978` — window.addEventListener('resize', () => pass74ScheduleMissionPaneRelayoutRetries('resize'));
- active: `src/renderer/app.ts:15076` — window.requestAnimationFrame(() => {
- active: `src/renderer/app.ts:15086` — window.addEventListener('resize', relayout);
- active: `src/renderer/app.ts:15089` — const observer = new ResizeObserver(relayout);
- active: `src/renderer/app.ts:15117` — window.requestAnimationFrame(() => {
- active: `src/renderer/app.ts:15150` — const observer = new MutationObserver(() => pass64ScheduleMissionPaneRefresh());
- active: `src/renderer/app.ts:15157` — document.addEventListener('DOMContentLoaded', pass64BootMissionPaneReorderHardening, { once: true });
- active: `src/renderer/app.ts:15265` — requestAnimationFrame(() => {
- active: `src/renderer/app.ts:15268` — requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
- active: `src/renderer/app.ts:15285` — requestAnimationFrame(repairMissionViews);
- active: `src/renderer/app.ts:15302` — window.addEventListener('resize', scheduleMissionViewRepair);
- active: `src/renderer/app.ts:15306` — observer = new MutationObserver((mutations: MutationRecord[]): void => {
- active: `src/renderer/app.ts:15318` — if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startObserver, { once: true });
- active: `src/renderer/app.ts:15404` — requestAnimationFrame(() => { window.dispatchEvent(new Event('resize')); host.dispatchEvent(new Event('pass253-mission-pane-viewport-normalized', { bubbles: true })); requestAnimationFrame(() => window.dispatchEvent(new Event('resize'))); });
- active: `src/renderer/app.ts:15407` — const schedule = (): void => { if (queued) return; queued = true; requestAnimationFrame(repair); };
- active: `src/renderer/app.ts:15411` — window.addEventListener('resize', schedule);
- active: `src/renderer/app.ts:15416` — observer = new MutationObserver((mutations: MutationRecord[]): void => { for (const mutation of mutations) { const target = mutation.target; if (!(target instanceof Element)) continue; if (target.matches(hostSelectors) || target.closest(hostSelectors) || target.matches(paneSelectors) || target.closest(paneSelectors)) { schedule(); break; } } });
- active: `src/renderer/app.ts:15418` — if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
- active: `src/renderer/app.ts:15706` — window.addEventListener('resize', () => pass341ScheduleNormalBrowserAndFeatureClickabilityCloseout('resize'));
- active: `src/renderer/app.ts:15708` — document.addEventListener('visibilitychange', () => { if (!document.hidden) pass341ScheduleNormalBrowserAndFeatureClickabilityCloseout('visibility'); });
- active: `src/renderer/app.ts:15718` — if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pass341MountNormalBrowserAndFeatureClickabilityCloseout, { once: true }); else pass341MountNormalBrowserAndFeatureClickabilityCloseout();
- active: `src/renderer/app.ts:15939` — window.addEventListener('resize', () => pass271R4Schedule('resize'));
- active: `src/renderer/app.ts:15941` — document.addEventListener('visibilitychange', () => { if (!document.hidden) pass271R4Schedule('visibility'); });
- active: `src/renderer/app.ts:15945` — const observer = new MutationObserver(() => pass271R4Schedule('mutation'));
- active: `src/renderer/app.ts:15951` — window.setInterval(() => pass271R4RepairNormalWebview('watchdog'), 2500);
- active: `src/renderer/app.ts:15955` — if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pass271R4Mount, { once: true }); else pass271R4Mount();
- active: `src/renderer/chromium-bookmarks.ts:945` — window.addEventListener('resize', () => window.setTimeout(updateBookmarkRailArrows, 60));
- active: `src/renderer/operator-command-center-v2.ts:131` — window.addEventListener('DOMContentLoaded', () => {
- active: `src/renderer/operator-command-center-v2.ts:134` — if (dialog) new MutationObserver(refresh).observe(dialog, { attributes: true, attributeFilter: ['open'] });
- active: `src/renderer/operator-command-center-v2.ts:136` — if (missionDialog) new MutationObserver(refresh).observe(missionDialog, { childList: true, subtree: true, attributes: true });
- active: `src/renderer/pass332-webview-navigation-owner-truth.ts:533` — pass332Raf = requestAnimationFrame(() => {
- active: `src/renderer/pass332-webview-navigation-owner-truth.ts:564` — pass332MutationObserver = new MutationObserver((mutations) => {
- active: `src/renderer/pass332-webview-navigation-owner-truth.ts:587` — window.addEventListener("resize", () => scheduleReconcile("resize"), { passive: true });
- active: `src/renderer/pass332-webview-navigation-owner-truth.ts:588` — document.addEventListener("visibilitychange", () => scheduleReconcile("visibilitychange"), { passive: true });
- active: `src/renderer/pass332-webview-navigation-owner-truth.ts:626` — document.addEventListener("DOMContentLoaded", installPass332, { once: true });
- active: `src/renderer/pass333-chrome-hit-test-webview-layer-truth.ts:242` — window.addEventListener("resize", () => schedule("resize", 120), { passive: true });
- active: `src/renderer/pass333-chrome-hit-test-webview-layer-truth.ts:243` — window.addEventListener("load", () => schedule("window-load", 160), { passive: true });
- active: `src/renderer/pass333-chrome-hit-test-webview-layer-truth.ts:244` — document.addEventListener("visibilitychange", () => schedule("visibilitychange", 160), { passive: true });
- active: `src/renderer/pass333-chrome-hit-test-webview-layer-truth.ts:245` — document.addEventListener("DOMContentLoaded", () => schedule("dom-content-loaded", 160), { passive: true });
- active: `src/renderer/pass333-chrome-hit-test-webview-layer-truth.ts:249` — document.addEventListener("DOMContentLoaded", install, { once: true });
- active: `src/renderer/pass336-chrome-partitioned-webview-hard-reset.ts:433` — document.addEventListener("DOMContentLoaded", boot, { once: true });
- active: `src/renderer/pass336-chrome-partitioned-webview-hard-reset.ts:438` — window.addEventListener("resize", () => schedule("resize"), { passive: true });
- active: `src/renderer/pass336-chrome-partitioned-webview-hard-reset.ts:440` — document.addEventListener("visibilitychange", () => schedule("visibilitychange"), { passive: true });
- active: `src/renderer/pass336-chrome-partitioned-webview-hard-reset.ts:444` — const observer = new MutationObserver(() => schedule("mutation"));
- active: `src/renderer/responsive-toolbar.ts:208` — window.addEventListener('resize', () => pass174HideUtilityTooltip());
- active: `src/renderer/responsive-toolbar.ts:334` — pass178ViewportBudgetObserver = new ResizeObserver(() => pass178ScheduleViewportBudgetAudit('resize-observer', 60));
- active: `src/renderer/responsive-toolbar.ts:339` — pass178ViewportMutationObserver = new MutationObserver(() => {
- active: `src/renderer/responsive-toolbar.ts:508` — pass183OverlayCollisionObserver = new MutationObserver((records) => {
- active: `src/renderer/responsive-toolbar.ts:990` — mutationObserver = new MutationObserver(() => scheduleRelayout(80));
- active: `src/renderer/responsive-toolbar.ts:1033` — window.addEventListener('resize', () => { scheduleRelayout(80); pass178ScheduleViewportBudgetAudit('window-resize', 140); });
- active: `src/renderer/responsive-toolbar.ts:1036` — if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
- active: `src/renderer/site-view-mission-rail.ts:1066` — const observer = new MutationObserver(() => scheduleRender(90));
- active: `src/renderer/site-view-mission-rail.ts:1119` — window.setInterval(() => {
- active: `src/renderer/site-view-mission-rail.ts:1127` — document.addEventListener('DOMContentLoaded', initSiteViewMissionRail, { once: true });

## Findings

### CRITICAL — sentry-not-imported — RELEASE BLOCKING

File: `src/renderer/*`

Why: PASS329 sentry exists but is not imported by a known renderer entry.

Action: Import './pass329-viewport-lifecycle-sentry' from the renderer entry that actually boots the browser shell.

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:1633`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
      }
    }
    if ((event.ctrlKey || event.metaKey) && event.altKey && event.shiftKey && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      event.stopPropagation();
      pass82RunEnterpriseSurfaceAssurance('shortcut');
    }
  }, true);
  window.addEventListener('resize', () => pass82ScheduleEnterpriseSurfaceAssurance('scheduled'));
  window.addEventListener('focus', () => pass82ScheduleEnterpriseSurfaceAssurance('scheduled'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass82ScheduleEnterpriseSurfaceAssurance('scheduled'); });
  pass82ScheduleEnterpriseSurfaceAssurance('scheduled');
}


// PASS83 Operator Safety Contract: redaction-gates every operator-facing copy/save path,
// audits dialog escape/recovery affordances, pane target truth, toolbar state truth, and runtime
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:1635`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    if ((event.ctrlKey || event.metaKey) && event.altKey && event.shiftKey && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      event.stopPropagation();
      pass82RunEnterpriseSurfaceAssurance('shortcut');
    }
  }, true);
  window.addEventListener('resize', () => pass82ScheduleEnterpriseSurfaceAssurance('scheduled'));
  window.addEventListener('focus', () => pass82ScheduleEnterpriseSurfaceAssurance('scheduled'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass82ScheduleEnterpriseSurfaceAssurance('scheduled'); });
  pass82ScheduleEnterpriseSurfaceAssurance('scheduled');
}


// PASS83 Operator Safety Contract: redaction-gates every operator-facing copy/save path,
// audits dialog escape/recovery affordances, pane target truth, toolbar state truth, and runtime
// fault visibility. Browser-side only: no backend connector, no direct PSA API, no credentials.
type Pass83ContractLevel = 'warn' | 'repair';
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:1878`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text

document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.altKey && event.shiftKey && event.key.toLowerCase() === 'm') {
      event.preventDefault();
      event.stopPropagation();
      pass83RunOperatorSafetyContract('shortcut');
    }
  }, true);
  window.addEventListener('resize', () => pass83ScheduleOperatorSafetyContract('scheduled'));
  window.addEventListener('focus', () => pass83ScheduleOperatorSafetyContract('scheduled'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass83ScheduleOperatorSafetyContract('scheduled'); });
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass83ScheduleOperatorSafetyContract('scheduled'));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-expanded', 'class', 'data-mission-pane-id', 'data-pane-id', 'data-export-redaction-boundary'] });
  }
  pass83ScheduleOperatorSafetyContract('scheduled');
}
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:1880`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    if ((event.ctrlKey || event.metaKey) && event.altKey && event.shiftKey && event.key.toLowerCase() === 'm') {
      event.preventDefault();
      event.stopPropagation();
      pass83RunOperatorSafetyContract('shortcut');
    }
  }, true);
  window.addEventListener('resize', () => pass83ScheduleOperatorSafetyContract('scheduled'));
  window.addEventListener('focus', () => pass83ScheduleOperatorSafetyContract('scheduled'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass83ScheduleOperatorSafetyContract('scheduled'); });
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass83ScheduleOperatorSafetyContract('scheduled'));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-expanded', 'class', 'data-mission-pane-id', 'data-pane-id', 'data-export-redaction-boundary'] });
  }
  pass83ScheduleOperatorSafetyContract('scheduled');
}


```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:1882`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
      event.stopPropagation();
      pass83RunOperatorSafetyContract('shortcut');
    }
  }, true);
  window.addEventListener('resize', () => pass83ScheduleOperatorSafetyContract('scheduled'));
  window.addEventListener('focus', () => pass83ScheduleOperatorSafetyContract('scheduled'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass83ScheduleOperatorSafetyContract('scheduled'); });
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass83ScheduleOperatorSafetyContract('scheduled'));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-expanded', 'class', 'data-mission-pane-id', 'data-pane-id', 'data-export-redaction-boundary'] });
  }
  pass83ScheduleOperatorSafetyContract('scheduled');
}



// PASS84 Release Gate Truth Mesh: stitches the runtime hardening passes into one release-facing
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:2153`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text

document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.altKey && event.shiftKey && event.key.toLowerCase() === 'v') {
      event.preventDefault();
      event.stopPropagation();
      pass84RunReleaseGateTruthMesh('shortcut');
    }
  }, true);
  window.addEventListener('resize', () => pass84ScheduleReleaseGateTruthMesh('scheduled'));
  window.addEventListener('focus', () => pass84ScheduleReleaseGateTruthMesh('scheduled'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass84ScheduleReleaseGateTruthMesh('scheduled'); });
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass84ScheduleReleaseGateTruthMesh('scheduled'));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-expanded', 'class', 'data-pass83-redacted', 'data-export-redaction-boundary', 'data-pane-id', 'data-mission-pane-id'] });
  }
  pass84ScheduleReleaseGateTruthMesh('scheduled');
}
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:2155`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    if ((event.ctrlKey || event.metaKey) && event.altKey && event.shiftKey && event.key.toLowerCase() === 'v') {
      event.preventDefault();
      event.stopPropagation();
      pass84RunReleaseGateTruthMesh('shortcut');
    }
  }, true);
  window.addEventListener('resize', () => pass84ScheduleReleaseGateTruthMesh('scheduled'));
  window.addEventListener('focus', () => pass84ScheduleReleaseGateTruthMesh('scheduled'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass84ScheduleReleaseGateTruthMesh('scheduled'); });
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass84ScheduleReleaseGateTruthMesh('scheduled'));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-expanded', 'class', 'data-pass83-redacted', 'data-export-redaction-boundary', 'data-pane-id', 'data-mission-pane-id'] });
  }
  pass84ScheduleReleaseGateTruthMesh('scheduled');
}


```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:2157`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
      event.stopPropagation();
      pass84RunReleaseGateTruthMesh('shortcut');
    }
  }, true);
  window.addEventListener('resize', () => pass84ScheduleReleaseGateTruthMesh('scheduled'));
  window.addEventListener('focus', () => pass84ScheduleReleaseGateTruthMesh('scheduled'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass84ScheduleReleaseGateTruthMesh('scheduled'); });
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass84ScheduleReleaseGateTruthMesh('scheduled'));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-expanded', 'class', 'data-pass83-redacted', 'data-export-redaction-boundary', 'data-pane-id', 'data-mission-pane-id'] });
  }
  pass84ScheduleReleaseGateTruthMesh('scheduled');
}


// PASS85 Enterprise Contract Ledger: closes the runtime/source gap left by the prior doctors.
// The ledger records deterministic contracts for critical shell surfaces, navigation, Mission non-drop
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:2467`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text

document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.altKey && event.shiftKey && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      event.stopPropagation();
      pass85RunEnterpriseContractLedger('shortcut');
    }
  }, true);
  window.addEventListener('resize', () => pass85ScheduleEnterpriseContractLedger('scheduled'));
  window.addEventListener('focus', () => pass85ScheduleEnterpriseContractLedger('scheduled'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass85ScheduleEnterpriseContractLedger('scheduled'); });
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass85ScheduleEnterpriseContractLedger('scheduled'));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-expanded', 'class', 'data-pass85-enterprise-contract', 'data-pass85-navigation-contract', 'data-pane-id', 'data-mission-pane-id'] });
  }
  pass85ScheduleEnterpriseContractLedger('scheduled');
}
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:2469`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    if ((event.ctrlKey || event.metaKey) && event.altKey && event.shiftKey && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      event.stopPropagation();
      pass85RunEnterpriseContractLedger('shortcut');
    }
  }, true);
  window.addEventListener('resize', () => pass85ScheduleEnterpriseContractLedger('scheduled'));
  window.addEventListener('focus', () => pass85ScheduleEnterpriseContractLedger('scheduled'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass85ScheduleEnterpriseContractLedger('scheduled'); });
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass85ScheduleEnterpriseContractLedger('scheduled'));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-expanded', 'class', 'data-pass85-enterprise-contract', 'data-pass85-navigation-contract', 'data-pane-id', 'data-mission-pane-id'] });
  }
  pass85ScheduleEnterpriseContractLedger('scheduled');
}


```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:2471`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
      event.stopPropagation();
      pass85RunEnterpriseContractLedger('shortcut');
    }
  }, true);
  window.addEventListener('resize', () => pass85ScheduleEnterpriseContractLedger('scheduled'));
  window.addEventListener('focus', () => pass85ScheduleEnterpriseContractLedger('scheduled'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass85ScheduleEnterpriseContractLedger('scheduled'); });
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass85ScheduleEnterpriseContractLedger('scheduled'));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-expanded', 'class', 'data-pass85-enterprise-contract', 'data-pass85-navigation-contract', 'data-pane-id', 'data-mission-pane-id'] });
  }
  pass85ScheduleEnterpriseContractLedger('scheduled');
}


// PASS86 Source Contract Sentinel: fail-closed runtime/source contracts for every operator surface.
// This sentinel hardens the accumulated PASS81-PASS85 doctors into one stricter source-level contract
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:2778`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text

document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.altKey && event.shiftKey && event.key.toLowerCase() === 'x') {
      event.preventDefault();
      event.stopPropagation();
      pass86RunSourceContractSentinel('shortcut');
    }
  }, true);
  window.addEventListener('resize', () => pass86ScheduleSourceContractSentinel('scheduled'));
  window.addEventListener('focus', () => pass86ScheduleSourceContractSentinel('scheduled'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass86ScheduleSourceContractSentinel('scheduled'); });
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass86ScheduleSourceContractSentinel('scheduled'));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-expanded', 'class', 'data-pass86-source-contract', 'data-export-redaction-boundary', 'data-pane-id', 'data-mission-pane-id'] });
  }
  pass86ScheduleSourceContractSentinel('scheduled');
}
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:2780`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    if ((event.ctrlKey || event.metaKey) && event.altKey && event.shiftKey && event.key.toLowerCase() === 'x') {
      event.preventDefault();
      event.stopPropagation();
      pass86RunSourceContractSentinel('shortcut');
    }
  }, true);
  window.addEventListener('resize', () => pass86ScheduleSourceContractSentinel('scheduled'));
  window.addEventListener('focus', () => pass86ScheduleSourceContractSentinel('scheduled'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass86ScheduleSourceContractSentinel('scheduled'); });
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass86ScheduleSourceContractSentinel('scheduled'));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-expanded', 'class', 'data-pass86-source-contract', 'data-export-redaction-boundary', 'data-pane-id', 'data-mission-pane-id'] });
  }
  pass86ScheduleSourceContractSentinel('scheduled');
}


```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:2782`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
      event.stopPropagation();
      pass86RunSourceContractSentinel('shortcut');
    }
  }, true);
  window.addEventListener('resize', () => pass86ScheduleSourceContractSentinel('scheduled'));
  window.addEventListener('focus', () => pass86ScheduleSourceContractSentinel('scheduled'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass86ScheduleSourceContractSentinel('scheduled'); });
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass86ScheduleSourceContractSentinel('scheduled'));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-expanded', 'class', 'data-pass86-source-contract', 'data-export-redaction-boundary', 'data-pane-id', 'data-mission-pane-id'] });
  }
  pass86ScheduleSourceContractSentinel('scheduled');
}


// PASS87 Operator Recovery Mesh: source-true recovery contracts across navigation, tools, panes, exports, dialogs, and runtime fault truth.
// This pass closes drift between accumulated runtime doctors and the actual shell DOM by checking the real address/input ids,
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:3084`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text

document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.altKey && event.shiftKey && event.key.toLowerCase() === 'o') {
      event.preventDefault();
      event.stopPropagation();
      pass87RunOperatorRecoveryMesh('shortcut');
    }
  }, true);
  window.addEventListener('resize', () => pass87ScheduleOperatorRecoveryMesh('scheduled'));
  window.addEventListener('focus', () => pass87ScheduleOperatorRecoveryMesh('scheduled'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass87ScheduleOperatorRecoveryMesh('scheduled'); });
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass87ScheduleOperatorRecoveryMesh('scheduled'));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-expanded', 'class', 'data-pass87-recovery-contract', 'data-pass87-navigation-recovery', 'data-pass87-non-drop-boundary', 'data-pass87-evidence-recovery'] });
  }
  pass87ScheduleOperatorRecoveryMesh('scheduled');
}
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:3086`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    if ((event.ctrlKey || event.metaKey) && event.altKey && event.shiftKey && event.key.toLowerCase() === 'o') {
      event.preventDefault();
      event.stopPropagation();
      pass87RunOperatorRecoveryMesh('shortcut');
    }
  }, true);
  window.addEventListener('resize', () => pass87ScheduleOperatorRecoveryMesh('scheduled'));
  window.addEventListener('focus', () => pass87ScheduleOperatorRecoveryMesh('scheduled'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass87ScheduleOperatorRecoveryMesh('scheduled'); });
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass87ScheduleOperatorRecoveryMesh('scheduled'));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-expanded', 'class', 'data-pass87-recovery-contract', 'data-pass87-navigation-recovery', 'data-pass87-non-drop-boundary', 'data-pass87-evidence-recovery'] });
  }
  pass87ScheduleOperatorRecoveryMesh('scheduled');
}


```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:3088`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
      event.stopPropagation();
      pass87RunOperatorRecoveryMesh('shortcut');
    }
  }, true);
  window.addEventListener('resize', () => pass87ScheduleOperatorRecoveryMesh('scheduled'));
  window.addEventListener('focus', () => pass87ScheduleOperatorRecoveryMesh('scheduled'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass87ScheduleOperatorRecoveryMesh('scheduled'); });
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass87ScheduleOperatorRecoveryMesh('scheduled'));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-expanded', 'class', 'data-pass87-recovery-contract', 'data-pass87-navigation-recovery', 'data-pass87-non-drop-boundary', 'data-pass87-evidence-recovery'] });
  }
  pass87ScheduleOperatorRecoveryMesh('scheduled');
}


// PASS88 Active Pane Routing Failsafe: closes the weakest remaining operator surface by hardening
// real navigation and focus paths instead of adding a decorative status-only doctor. The address bar,
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:3508`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text

document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.altKey && event.shiftKey && event.key.toLowerCase() === 'p') {
      event.preventDefault();
      event.stopPropagation();
      pass88RunActivePaneRoutingFailsafe('shortcut');
    }
  }, true);
  window.addEventListener('resize', () => pass88ScheduleActivePaneRoutingFailsafe('scheduled'));
  window.addEventListener('focus', () => pass88ScheduleActivePaneRoutingFailsafe('scheduled'));
  document.addEventListener('mission-layout-change', () => pass88ScheduleActivePaneRoutingFailsafe('mission-layout-change'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass88ScheduleActivePaneRoutingFailsafe('scheduled'); });
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass88ScheduleActivePaneRoutingFailsafe('scheduled'));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-expanded', 'class', 'data-pane-id', 'data-mission-pane-id', 'data-pass88-active-pane-routing'] });
  }
  pass187RefreshNavigationTruthMatrix('mount');
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:3511`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
      event.preventDefault();
      event.stopPropagation();
      pass88RunActivePaneRoutingFailsafe('shortcut');
    }
  }, true);
  window.addEventListener('resize', () => pass88ScheduleActivePaneRoutingFailsafe('scheduled'));
  window.addEventListener('focus', () => pass88ScheduleActivePaneRoutingFailsafe('scheduled'));
  document.addEventListener('mission-layout-change', () => pass88ScheduleActivePaneRoutingFailsafe('mission-layout-change'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass88ScheduleActivePaneRoutingFailsafe('scheduled'); });
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass88ScheduleActivePaneRoutingFailsafe('scheduled'));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-expanded', 'class', 'data-pane-id', 'data-mission-pane-id', 'data-pass88-active-pane-routing'] });
  }
  pass187RefreshNavigationTruthMatrix('mount');
  pass88ScheduleActivePaneRoutingFailsafe('scheduled');
}

```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:3513`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
      pass88RunActivePaneRoutingFailsafe('shortcut');
    }
  }, true);
  window.addEventListener('resize', () => pass88ScheduleActivePaneRoutingFailsafe('scheduled'));
  window.addEventListener('focus', () => pass88ScheduleActivePaneRoutingFailsafe('scheduled'));
  document.addEventListener('mission-layout-change', () => pass88ScheduleActivePaneRoutingFailsafe('mission-layout-change'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass88ScheduleActivePaneRoutingFailsafe('scheduled'); });
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass88ScheduleActivePaneRoutingFailsafe('scheduled'));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-expanded', 'class', 'data-pane-id', 'data-mission-pane-id', 'data-pass88-active-pane-routing'] });
  }
  pass187RefreshNavigationTruthMatrix('mount');
  pass88ScheduleActivePaneRoutingFailsafe('scheduled');
}


// PASS188 WebView Focus/Input Boundary Hardening: shell accelerators, pane focus,
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:3717`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    if (paneId && /^pane-[1-4]$/.test(paneId)) setMissionActivePane(paneId);
    pass188ScheduleFocusInputBoundary('pointer-down');
  }, true);

document.addEventListener('keydown', (event) => {
    pass188RecordFocusBoundary(pass188SurfaceForElement(event.target instanceof Element ? event.target : document.activeElement), `keydown:${event.key}`, 'renderer-keydown', event.target instanceof Element ? event.target : document.activeElement);
  }, true);
  window.addEventListener('focus', () => pass188ScheduleFocusInputBoundary('window-focus'));
  window.addEventListener('resize', () => pass188ScheduleFocusInputBoundary('resize'));
  document.addEventListener('mission-layout-change', () => pass188ScheduleFocusInputBoundary('mission-layout-change'));
  pass188RepairFocusInputBoundaries('mount');
  pass188LastFocusInputBoundaryReport = pass188BuildFocusInputBoundaryReport('mount');
}


// PASS89 Mission Pane Restore Failsafe: pane assignment, layout restoration, focus mode,
// command-dock moves, and stale drag overlays now share a layout-promotion contract so a
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:3925`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.altKey && event.shiftKey && event.key.toLowerCase() === 'g') {
      event.preventDefault();
      event.stopPropagation();
      pass89RunMissionPaneRestoreFailsafe('shortcut');
    }
  }, true);
  document.addEventListener('mission-layout-change', () => pass89ScheduleMissionPaneRestoreFailsafe('mission-layout-change'));
  window.addEventListener('resize', () => pass89ScheduleMissionPaneRestoreFailsafe('scheduled'));
  window.addEventListener('focus', () => pass89ScheduleMissionPaneRestoreFailsafe('scheduled'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass89ScheduleMissionPaneRestoreFailsafe('scheduled'); });
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass89ScheduleMissionPaneRestoreFailsafe('scheduled'));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class', 'data-pane-id', 'data-mission-pane-id', 'data-pass89-pane-restore'] });
  }
  pass89ScheduleMissionPaneRestoreFailsafe('scheduled');
}
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:3927`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
      event.preventDefault();
      event.stopPropagation();
      pass89RunMissionPaneRestoreFailsafe('shortcut');
    }
  }, true);
  document.addEventListener('mission-layout-change', () => pass89ScheduleMissionPaneRestoreFailsafe('mission-layout-change'));
  window.addEventListener('resize', () => pass89ScheduleMissionPaneRestoreFailsafe('scheduled'));
  window.addEventListener('focus', () => pass89ScheduleMissionPaneRestoreFailsafe('scheduled'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass89ScheduleMissionPaneRestoreFailsafe('scheduled'); });
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass89ScheduleMissionPaneRestoreFailsafe('scheduled'));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class', 'data-pane-id', 'data-mission-pane-id', 'data-pass89-pane-restore'] });
  }
  pass89ScheduleMissionPaneRestoreFailsafe('scheduled');
}


```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:3929`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
      pass89RunMissionPaneRestoreFailsafe('shortcut');
    }
  }, true);
  document.addEventListener('mission-layout-change', () => pass89ScheduleMissionPaneRestoreFailsafe('mission-layout-change'));
  window.addEventListener('resize', () => pass89ScheduleMissionPaneRestoreFailsafe('scheduled'));
  window.addEventListener('focus', () => pass89ScheduleMissionPaneRestoreFailsafe('scheduled'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass89ScheduleMissionPaneRestoreFailsafe('scheduled'); });
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass89ScheduleMissionPaneRestoreFailsafe('scheduled'));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class', 'data-pane-id', 'data-mission-pane-id', 'data-pass89-pane-restore'] });
  }
  pass89ScheduleMissionPaneRestoreFailsafe('scheduled');
}


// PASS90 Launch Recipe Failsafe: every recipe, bookmark-derived mission, and Command Center
// launch path now runs through one fail-closed plan before profile switching, tab closure, pane
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:4161`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.altKey && event.shiftKey && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      event.stopPropagation();
      pass90RunLaunchRecipeFailsafe('shortcut');
    }
  }, true);
  document.addEventListener('mission-layout-change', () => pass90ScheduleLaunchRecipeFailsafe('mission-layout-change'));
  window.addEventListener('resize', () => pass90ScheduleLaunchRecipeFailsafe('scheduled'));
  window.addEventListener('focus', () => pass90ScheduleLaunchRecipeFailsafe('scheduled'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass90ScheduleLaunchRecipeFailsafe('scheduled'); });
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass90ScheduleLaunchRecipeFailsafe('scheduled'));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class', 'disabled', 'data-recipe-id', 'data-start-mission-recipe-id', 'data-pass90-recipe-launch'] });
  }
  pass90ScheduleLaunchRecipeFailsafe('scheduled');
}
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:4163`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
      event.preventDefault();
      event.stopPropagation();
      pass90RunLaunchRecipeFailsafe('shortcut');
    }
  }, true);
  document.addEventListener('mission-layout-change', () => pass90ScheduleLaunchRecipeFailsafe('mission-layout-change'));
  window.addEventListener('resize', () => pass90ScheduleLaunchRecipeFailsafe('scheduled'));
  window.addEventListener('focus', () => pass90ScheduleLaunchRecipeFailsafe('scheduled'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass90ScheduleLaunchRecipeFailsafe('scheduled'); });
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass90ScheduleLaunchRecipeFailsafe('scheduled'));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class', 'disabled', 'data-recipe-id', 'data-start-mission-recipe-id', 'data-pass90-recipe-launch'] });
  }
  pass90ScheduleLaunchRecipeFailsafe('scheduled');
}

function pass81ScheduleAllSurfaceDoctor(reason = 'scheduled'): void {
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:4165`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
      pass90RunLaunchRecipeFailsafe('shortcut');
    }
  }, true);
  document.addEventListener('mission-layout-change', () => pass90ScheduleLaunchRecipeFailsafe('mission-layout-change'));
  window.addEventListener('resize', () => pass90ScheduleLaunchRecipeFailsafe('scheduled'));
  window.addEventListener('focus', () => pass90ScheduleLaunchRecipeFailsafe('scheduled'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass90ScheduleLaunchRecipeFailsafe('scheduled'); });
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass90ScheduleLaunchRecipeFailsafe('scheduled'));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class', 'disabled', 'data-recipe-id', 'data-start-mission-recipe-id', 'data-pass90-recipe-launch'] });
  }
  pass90ScheduleLaunchRecipeFailsafe('scheduled');
}

function pass81ScheduleAllSurfaceDoctor(reason = 'scheduled'): void {
  if (pass81AllSurfaceTimer) window.clearTimeout(pass81AllSurfaceTimer);
  pass81AllSurfaceTimer = window.setTimeout(() => {
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:4183`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    pass81RunAllSurfaceDoctor(reason);
  }, 180);
}

function pass81MountAllSurfaceGuard(): void {
  if (pass81AllSurfaceMounted) return;
  pass81AllSurfaceMounted = true;
  document.body.dataset.pass81AllSurfaceGuardMounted = 'true';
  window.addEventListener('resize', () => pass81ScheduleAllSurfaceDoctor('scheduled'));
  window.addEventListener('focus', () => pass81ScheduleAllSurfaceDoctor('scheduled'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass81ScheduleAllSurfaceDoctor('scheduled'); });
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass81ScheduleAllSurfaceDoctor('scheduled'));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-expanded', 'class', 'style', 'data-command-toolbar', 'data-pane-id'] });
  }
  pass81ScheduleAllSurfaceDoctor('scheduled');
}
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:4185`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
}

function pass81MountAllSurfaceGuard(): void {
  if (pass81AllSurfaceMounted) return;
  pass81AllSurfaceMounted = true;
  document.body.dataset.pass81AllSurfaceGuardMounted = 'true';
  window.addEventListener('resize', () => pass81ScheduleAllSurfaceDoctor('scheduled'));
  window.addEventListener('focus', () => pass81ScheduleAllSurfaceDoctor('scheduled'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass81ScheduleAllSurfaceDoctor('scheduled'); });
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass81ScheduleAllSurfaceDoctor('scheduled'));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-expanded', 'class', 'style', 'data-command-toolbar', 'data-pane-id'] });
  }
  pass81ScheduleAllSurfaceDoctor('scheduled');
}

function applyUiSettings(): void {
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:4187`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
function pass81MountAllSurfaceGuard(): void {
  if (pass81AllSurfaceMounted) return;
  pass81AllSurfaceMounted = true;
  document.body.dataset.pass81AllSurfaceGuardMounted = 'true';
  window.addEventListener('resize', () => pass81ScheduleAllSurfaceDoctor('scheduled'));
  window.addEventListener('focus', () => pass81ScheduleAllSurfaceDoctor('scheduled'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass81ScheduleAllSurfaceDoctor('scheduled'); });
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass81ScheduleAllSurfaceDoctor('scheduled'));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-expanded', 'class', 'style', 'data-command-toolbar', 'data-pane-id'] });
  }
  pass81ScheduleAllSurfaceDoctor('scheduled');
}

function applyUiSettings(): void {
  statusBar.hidden = settings?.ui?.showStatusBar === false;
}
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:4287`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
  next.focus({ preventScroll: false });
  next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function pass192MountTitlebarChromeFinalizer(): void {
  if (pass192TitlebarChromeMounted) return;
  pass192TitlebarChromeMounted = true;
  pass192SyncTitlebarChromeState('mount');
  window.addEventListener('resize', () => pass192ScheduleTitlebarChromeSync('resize'));
  tabsEl.addEventListener('scroll', () => pass192ScheduleTitlebarChromeSync('scroll'), { passive: true });
  tabsEl.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      pass192FocusTabByOffset(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:4313`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
      if (last) setActive(last);
      tabs.get(last || '')?.button.focus({ preventScroll: false });
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && tabs.size > 1 && document.activeElement?.classList.contains('tab')) {
      event.preventDefault();
      closeTab((document.activeElement as HTMLElement).dataset.browserTabId || activeTabId);
    }
  });
  if (typeof MutationObserver !== 'undefined') {
    pass192TitlebarChromeObserver = new MutationObserver(() => pass192ScheduleTitlebarChromeSync('mutation'));
    pass192TitlebarChromeObserver.observe(tabsEl, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-selected', 'data-browser-tab-id', 'title'] });
  }
}

function setActive(tabId: string): void {
  activeTabId = tabId;
  if (currentMission && currentMission.layout.type !== 'single') {
    const paneEntry = Array.from(missionRuntimeTabs.entries()).find(([, runtimeTabId]) => runtimeTabId === tabId);
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:5004`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
    tab.webview.removeAttribute('data-pane-label');
    tab.webview.removeAttribute('data-pass63-mission-pane-id');
    tab.webview.removeAttribute('data-pane-id');
    if (isActive) {
      tab.webview.hidden = false;
      tab.webview.removeAttribute('hidden');
      tab.webview.removeAttribute('aria-hidden');
      tab.webview.style.position = 'absolute';
      tab.webview.style.inset = '0';
      tab.webview.style.width = '100%';
      tab.webview.style.height = '100%';
      tab.webview.style.minWidth = '0';
      tab.webview.style.minHeight = '0';
      tab.webview.style.display = 'block';
      tab.webview.style.opacity = '1';
      tab.webview.style.visibility = 'visible';
      tab.webview.style.pointerEvents = 'auto';
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:5005`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
    tab.webview.removeAttribute('data-pass63-mission-pane-id');
    tab.webview.removeAttribute('data-pane-id');
    if (isActive) {
      tab.webview.hidden = false;
      tab.webview.removeAttribute('hidden');
      tab.webview.removeAttribute('aria-hidden');
      tab.webview.style.position = 'absolute';
      tab.webview.style.inset = '0';
      tab.webview.style.width = '100%';
      tab.webview.style.height = '100%';
      tab.webview.style.minWidth = '0';
      tab.webview.style.minHeight = '0';
      tab.webview.style.display = 'block';
      tab.webview.style.opacity = '1';
      tab.webview.style.visibility = 'visible';
      tab.webview.style.pointerEvents = 'auto';
      tab.webview.style.zIndex = '1';
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:5006`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
    tab.webview.removeAttribute('data-pane-id');
    if (isActive) {
      tab.webview.hidden = false;
      tab.webview.removeAttribute('hidden');
      tab.webview.removeAttribute('aria-hidden');
      tab.webview.style.position = 'absolute';
      tab.webview.style.inset = '0';
      tab.webview.style.width = '100%';
      tab.webview.style.height = '100%';
      tab.webview.style.minWidth = '0';
      tab.webview.style.minHeight = '0';
      tab.webview.style.display = 'block';
      tab.webview.style.opacity = '1';
      tab.webview.style.visibility = 'visible';
      tab.webview.style.pointerEvents = 'auto';
      tab.webview.style.zIndex = '1';
      tab.webview.style.transform = 'none';
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:5014`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
      tab.webview.style.height = '100%';
      tab.webview.style.minWidth = '0';
      tab.webview.style.minHeight = '0';
      tab.webview.style.display = 'block';
      tab.webview.style.opacity = '1';
      tab.webview.style.visibility = 'visible';
      tab.webview.style.pointerEvents = 'auto';
      tab.webview.style.zIndex = '1';
      tab.webview.style.transform = 'none';
      tab.webview.style.background = 'transparent';
      activeWebviewCount += 1;
    } else {
      tab.webview.hidden = true;
      tab.webview.style.display = 'none';
      tab.webview.style.pointerEvents = 'none';
      tab.webview.style.visibility = 'hidden';
      tab.webview.style.zIndex = '0';
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:5079`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    pass339NormalBrowsingInputPaintCloseout(reason);
  }, 40);
}

function pass339MountNormalBrowsingInputPaintCloseout(): void {
  pass339NormalBrowsingInputPaintCloseout('mount');
  window.setTimeout(() => pass339NormalBrowsingInputPaintCloseout('settle-250'), 250);
  window.setTimeout(() => pass339NormalBrowsingInputPaintCloseout('settle-1000'), 1000);
  window.addEventListener('resize', () => pass339ScheduleNormalBrowsingInputPaintCloseout('resize'));
  window.addEventListener('focus', () => pass339ScheduleNormalBrowsingInputPaintCloseout('focus'));
  document.addEventListener('dragend', () => pass339ScheduleNormalBrowsingInputPaintCloseout('dragend'), true);
  document.addEventListener('drop', () => pass339ScheduleNormalBrowsingInputPaintCloseout('drop'), true);
  document.addEventListener('pointerup', () => pass339ScheduleNormalBrowsingInputPaintCloseout('pointerup'), true);
  document.addEventListener('keyup', (event) => { if (event.key === 'Escape') pass339ScheduleNormalBrowsingInputPaintCloseout('escape'); }, true);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pass339MountNormalBrowsingInputPaintCloseout, { once: true }); else pass339MountNormalBrowsingInputPaintCloseout();
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:5087`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
  window.addEventListener('resize', () => pass339ScheduleNormalBrowsingInputPaintCloseout('resize'));
  window.addEventListener('focus', () => pass339ScheduleNormalBrowsingInputPaintCloseout('focus'));
  document.addEventListener('dragend', () => pass339ScheduleNormalBrowsingInputPaintCloseout('dragend'), true);
  document.addEventListener('drop', () => pass339ScheduleNormalBrowsingInputPaintCloseout('drop'), true);
  document.addEventListener('pointerup', () => pass339ScheduleNormalBrowsingInputPaintCloseout('pointerup'), true);
  document.addEventListener('keyup', (event) => { if (event.key === 'Escape') pass339ScheduleNormalBrowsingInputPaintCloseout('escape'); }, true);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pass339MountNormalBrowsingInputPaintCloseout, { once: true }); else pass339MountNormalBrowsingInputPaintCloseout();
/* PASS339_NORMAL_BROWSING_INPUT_PAINT_CLOSEOUT_END */

/* PASS340_CHROME_INPUT_HITTEST_CLOSEOUT_START */
type Pass340ChromeInputReport = {
  pass: 'PASS340';
  status: 'PASS' | 'WARN';
  reason: string;
  chromeControlCount: number;
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:5175`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
  stageEl.style.setProperty('-webkit-app-region', 'no-drag');
  const activeTab = tabs.get(activeTabId) || active();
  for (const tab of tabs.values()) {
    const isActive = tab.id === activeTab?.id;
    const view = tab.webview as unknown as HTMLElement;
    if (tab.webview.parentElement !== stageEl) stageEl.appendChild(tab.webview);
    view.classList.toggle('active', isActive);
    view.style.position = 'absolute';
    view.style.top = '0';
    view.style.left = '0';
    view.style.right = 'auto';
    view.style.bottom = 'auto';
    view.style.width = isActive ? '100%' : '1px';
    view.style.height = isActive ? '100%' : '1px';
    view.style.minWidth = '0';
    view.style.minHeight = '0';
    view.style.margin = '0';
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:5176`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
  const activeTab = tabs.get(activeTabId) || active();
  for (const tab of tabs.values()) {
    const isActive = tab.id === activeTab?.id;
    const view = tab.webview as unknown as HTMLElement;
    if (tab.webview.parentElement !== stageEl) stageEl.appendChild(tab.webview);
    view.classList.toggle('active', isActive);
    view.style.position = 'absolute';
    view.style.top = '0';
    view.style.left = '0';
    view.style.right = 'auto';
    view.style.bottom = 'auto';
    view.style.width = isActive ? '100%' : '1px';
    view.style.height = isActive ? '100%' : '1px';
    view.style.minWidth = '0';
    view.style.minHeight = '0';
    view.style.margin = '0';
    view.style.transform = 'none';
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:5177`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
  for (const tab of tabs.values()) {
    const isActive = tab.id === activeTab?.id;
    const view = tab.webview as unknown as HTMLElement;
    if (tab.webview.parentElement !== stageEl) stageEl.appendChild(tab.webview);
    view.classList.toggle('active', isActive);
    view.style.position = 'absolute';
    view.style.top = '0';
    view.style.left = '0';
    view.style.right = 'auto';
    view.style.bottom = 'auto';
    view.style.width = isActive ? '100%' : '1px';
    view.style.height = isActive ? '100%' : '1px';
    view.style.minWidth = '0';
    view.style.minHeight = '0';
    view.style.margin = '0';
    view.style.transform = 'none';
    view.style.opacity = isActive ? '1' : '0';
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:5178`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
    const isActive = tab.id === activeTab?.id;
    const view = tab.webview as unknown as HTMLElement;
    if (tab.webview.parentElement !== stageEl) stageEl.appendChild(tab.webview);
    view.classList.toggle('active', isActive);
    view.style.position = 'absolute';
    view.style.top = '0';
    view.style.left = '0';
    view.style.right = 'auto';
    view.style.bottom = 'auto';
    view.style.width = isActive ? '100%' : '1px';
    view.style.height = isActive ? '100%' : '1px';
    view.style.minWidth = '0';
    view.style.minHeight = '0';
    view.style.margin = '0';
    view.style.transform = 'none';
    view.style.opacity = isActive ? '1' : '0';
    view.style.visibility = isActive ? 'visible' : 'hidden';
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:5179`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
    const view = tab.webview as unknown as HTMLElement;
    if (tab.webview.parentElement !== stageEl) stageEl.appendChild(tab.webview);
    view.classList.toggle('active', isActive);
    view.style.position = 'absolute';
    view.style.top = '0';
    view.style.left = '0';
    view.style.right = 'auto';
    view.style.bottom = 'auto';
    view.style.width = isActive ? '100%' : '1px';
    view.style.height = isActive ? '100%' : '1px';
    view.style.minWidth = '0';
    view.style.minHeight = '0';
    view.style.margin = '0';
    view.style.transform = 'none';
    view.style.opacity = isActive ? '1' : '0';
    view.style.visibility = isActive ? 'visible' : 'hidden';
    view.style.display = isActive ? 'block' : 'none';
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:5180`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
    if (tab.webview.parentElement !== stageEl) stageEl.appendChild(tab.webview);
    view.classList.toggle('active', isActive);
    view.style.position = 'absolute';
    view.style.top = '0';
    view.style.left = '0';
    view.style.right = 'auto';
    view.style.bottom = 'auto';
    view.style.width = isActive ? '100%' : '1px';
    view.style.height = isActive ? '100%' : '1px';
    view.style.minWidth = '0';
    view.style.minHeight = '0';
    view.style.margin = '0';
    view.style.transform = 'none';
    view.style.opacity = isActive ? '1' : '0';
    view.style.visibility = isActive ? 'visible' : 'hidden';
    view.style.display = isActive ? 'block' : 'none';
    view.style.pointerEvents = isActive ? 'auto' : 'none';
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:5271`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    pass340Timer = undefined;
    pass340RecoverChromeInput(reason);
  }, 45);
}

function pass340MountChromeInputCloseout(): void {
  pass340RecoverChromeInput('mount');
  for (const delay of [120, 350, 900, 1800, 3200] as const) window.setTimeout(() => pass340RecoverChromeInput('settle-' + delay), delay);
  window.addEventListener('resize', () => pass340ScheduleChromeInputCloseout('resize'));
  window.addEventListener('focus', () => pass340ScheduleChromeInputCloseout('focus'));
  document.addEventListener('pointermove', (event) => {
    const topbarRect = document.querySelector<HTMLElement>('.topbar')?.getBoundingClientRect();
    const toolbarRect = document.querySelector<HTMLElement>('.toolbar')?.getBoundingClientRect();
    const inChrome = Boolean((topbarRect && event.clientY >= topbarRect.top && event.clientY <= topbarRect.bottom) || (toolbarRect && event.clientY >= toolbarRect.top && event.clientY <= toolbarRect.bottom));
    if (inChrome) pass340PauseWebviewForChrome('pointer-over-chrome'); else pass340ReleaseChromePointerPause();
  }, true);
  document.addEventListener('pointerdown', (event) => {
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:5285`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    if (inChrome) pass340PauseWebviewForChrome('pointer-over-chrome'); else pass340ReleaseChromePointerPause();
  }, true);
  document.addEventListener('pointerdown', (event) => {
    const target = event.target as Element | null;
    if (target?.closest?.('.topbar, .toolbar, .statusbar, #tabs, #address, button')) pass340RecoverChromeInput('chrome-pointerdown');
  }, true);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pass340MountChromeInputCloseout, { once: true }); else pass340MountChromeInputCloseout();
/* PASS340_CHROME_INPUT_HITTEST_CLOSEOUT_END */


function upsertBrowserTabIntoMissionPane(tabId: string, paneIdInput: string, options: { activateLayout?: boolean } = {}): void {
  const tab = tabs.get(tabId);
  if (!tab) return;
  const mission = ensureCurrentMission();
  const paneId = normalizeMissionPaneId(paneIdInput);
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:5363`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
  pass72ApplyMissionPanePixelLayoutNow();
  pass74ScheduleMissionPaneRelayoutRetries(reason);
  pass77ForceMissionPaneViewportFit(reason);
  pass76RefreshMissionPaneDirectMoveControls(reason);
}

function pass107ScheduleMissionViewportSettle(reason = 'mission-view'): void {
  pass107RunMissionViewportSettle(reason + ':now');
  window.requestAnimationFrame(() => pass107RunMissionViewportSettle(reason + ':raf'));
  window.setTimeout(() => pass107RunMissionViewportSettle(reason + ':settle-80'), 80);
  window.setTimeout(() => pass107RunMissionViewportSettle(reason + ':settle-240'), 240);
}

function pass106RepaintMissionViewAfterSiteRail(reason = 'site-view-rail'): void {
  if (!currentMission || currentMission.layout.type === 'single') return;
  if (stageEl) stageEl.dataset.pass106SiteViewMissionFit = reason;
  document.body.dataset.pass106SiteViewMissionFit = reason;
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:7190`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
  if (document.body.dataset.pass123OverlayCycleGuardMounted === 'true') return;
  document.body.dataset.pass119OverlayAriaContract = 'true'; document.body.dataset.pass120OverlayPointerBoundary = 'true'; document.body.dataset.pass121OverlayScrollContainment = 'true'; document.body.dataset.pass122OverlayViewportReflow = 'true'; document.body.dataset.pass123OverlayCycleGuard = 'true'; document.body.dataset.pass123OverlayCycleGuardMounted = 'true'; document.body.dataset.pass167OverlaySourceSafeClose = 'true'; document.body.dataset.pass168OverlayOpenAgeStamp = 'true'; document.body.dataset.pass169DelayedOverlayFocusGuard = 'true'; document.body.dataset.pass170RestoreFocusTargetGuard = 'true'; document.body.dataset.pass171OverlayFocusEpochGuard = 'true'; document.body.dataset.pass190OverlayStateMachine = 'true';
  document.addEventListener(PASS116_CHROME_OVERLAY_OPEN_EVENT, () => { pass122ScheduleOverlayViewportReflow('overlay-switch'); pass123ScheduleOverlayCycleAudit('overlay-open'); });
  document.addEventListener(PASS118_CHROME_OVERLAY_CLOSE_EVENT, () => { pass122ScheduleOverlayViewportReflow('viewport-reflow'); pass123ScheduleOverlayCycleAudit('overlay-close'); });
  document.addEventListener(PASS122_CHROME_STACK_REFLOW_EVENT, () => pass122ScheduleOverlayViewportReflow('viewport-reflow'));
  document.addEventListener(PASS123_OVERLAY_CYCLE_AUDIT_EVENT, (event) => { const reason = event instanceof CustomEvent && typeof event.detail?.reason === 'string' ? event.detail.reason : 'cycle-stress'; pass123ScheduleOverlayCycleAudit(reason); });

document.addEventListener('keydown', (event) => { if (event.key === 'Escape') pass123ScheduleOverlayCycleAudit('escape-key'); }, true);
  window.addEventListener('resize', () => pass122ScheduleOverlayViewportReflow('viewport-reflow'));
  window.visualViewport?.addEventListener('resize', () => pass122ScheduleOverlayViewportReflow('viewport-reflow'));
  window.addEventListener('orientationchange', () => pass122ScheduleOverlayViewportReflow('viewport-reflow'));
  pass122ScheduleOverlayViewportReflow('viewport-reflow');
}

function pass118InstallOverlayDismissRecovery(): void {
  if (document.body.dataset.pass118OverlayDismissRecoveryMounted === 'true') return;
  document.body.dataset.pass118OverlayDismissRecoveryMounted = 'true';
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:7191`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
  document.body.dataset.pass119OverlayAriaContract = 'true'; document.body.dataset.pass120OverlayPointerBoundary = 'true'; document.body.dataset.pass121OverlayScrollContainment = 'true'; document.body.dataset.pass122OverlayViewportReflow = 'true'; document.body.dataset.pass123OverlayCycleGuard = 'true'; document.body.dataset.pass123OverlayCycleGuardMounted = 'true'; document.body.dataset.pass167OverlaySourceSafeClose = 'true'; document.body.dataset.pass168OverlayOpenAgeStamp = 'true'; document.body.dataset.pass169DelayedOverlayFocusGuard = 'true'; document.body.dataset.pass170RestoreFocusTargetGuard = 'true'; document.body.dataset.pass171OverlayFocusEpochGuard = 'true'; document.body.dataset.pass190OverlayStateMachine = 'true';
  document.addEventListener(PASS116_CHROME_OVERLAY_OPEN_EVENT, () => { pass122ScheduleOverlayViewportReflow('overlay-switch'); pass123ScheduleOverlayCycleAudit('overlay-open'); });
  document.addEventListener(PASS118_CHROME_OVERLAY_CLOSE_EVENT, () => { pass122ScheduleOverlayViewportReflow('viewport-reflow'); pass123ScheduleOverlayCycleAudit('overlay-close'); });
  document.addEventListener(PASS122_CHROME_STACK_REFLOW_EVENT, () => pass122ScheduleOverlayViewportReflow('viewport-reflow'));
  document.addEventListener(PASS123_OVERLAY_CYCLE_AUDIT_EVENT, (event) => { const reason = event instanceof CustomEvent && typeof event.detail?.reason === 'string' ? event.detail.reason : 'cycle-stress'; pass123ScheduleOverlayCycleAudit(reason); });

document.addEventListener('keydown', (event) => { if (event.key === 'Escape') pass123ScheduleOverlayCycleAudit('escape-key'); }, true);
  window.addEventListener('resize', () => pass122ScheduleOverlayViewportReflow('viewport-reflow'));
  window.visualViewport?.addEventListener('resize', () => pass122ScheduleOverlayViewportReflow('viewport-reflow'));
  window.addEventListener('orientationchange', () => pass122ScheduleOverlayViewportReflow('viewport-reflow'));
  pass122ScheduleOverlayViewportReflow('viewport-reflow');
}

function pass118InstallOverlayDismissRecovery(): void {
  if (document.body.dataset.pass118OverlayDismissRecoveryMounted === 'true') return;
  document.body.dataset.pass118OverlayDismissRecoveryMounted = 'true';
  document.body.dataset.pass118OverlayDismissRecovery = 'true';
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:7224`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    const source = pass118ActiveChromeOverlaySource();
    if (!source) return;
    event.preventDefault();
    event.stopPropagation();
    pass118AnnounceChromeOverlayClose('escape', source, true);
  }, true);
  window.addEventListener('resize', () => pass118ScheduleOverlayStateAudit('stale-state'));
  window.addEventListener('blur', () => pass118ScheduleOverlayStateAudit('stale-state'));
  pass119To123InstallOverlayGuards();
}


function pass116InstallChromeOverlayArbitration(): void {
  if (document.body.dataset.pass116OverlayArbitrationMounted === 'true') return;
  document.body.dataset.pass116OverlayArbitrationMounted = 'true';
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:7346`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    right.setAttribute('aria-label', `Scroll ${commandToolbarLabel(name)} right`);
    right.title = 'Scroll command lane right';
    right.addEventListener('click', (event) => { event.stopPropagation(); scrollToolMenu(panel, 1); });
    panel.appendChild(right);
  }
  if (!panel.dataset.commandToolbarScrollBound) {
    panel.dataset.commandToolbarScrollBound = 'true';
    panel.addEventListener('scroll', () => updateToolMenuScrollState(panel), { passive: true });
    window.addEventListener('resize', () => updateToolMenuScrollState(panel));
  }
}

function ensureToolMenuBackButton(name: ToolMenuName): void {
  const { button, panel } = toolMenuPair(name);
  if (panel.querySelector('[data-command-toolbar-back]')) return;
  const back = document.createElement('button');
  back.type = 'button';
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:9415`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
function pass254MountMissionRecipeClickContract(): void {
  if (pass254MissionRecipeClickContractMounted) return;
  pass254MissionRecipeClickContractMounted = true;
  document.body.dataset.pass254MissionRecipeClickContractMounted = 'true';
  document.addEventListener('click', pass254HandleMissionRecipeEvent, true);
  document.addEventListener('keydown', pass254HandleMissionRecipeEvent, true);
  document.addEventListener('mission-layout-change', () => pass254AnnotateMissionRecipeCards('mission-layout-change'));
  if (typeof MutationObserver !== 'undefined') {
    pass254MissionRecipeObserver = new MutationObserver(() => pass254AnnotateMissionRecipeCards('mutation'));
    pass254MissionRecipeObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class', 'data-recipe-id', 'data-start-mission-recipe-id'] });
  }
  window.setTimeout(() => pass254AnnotateMissionRecipeCards('mount'), 0);
}
/* PASS254_MISSION_RECIPE_CLICK_CONTRACT_END */

/* PASS255_RECIPE_PANE_HYDRATION_START */
type Pass255PaneBlueprint = {
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:9610`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
  const rect = element.getBoundingClientRect();
  const embedded = element.querySelector('webview, iframe, .webview, .mission-webview, .site-view, browserview') as HTMLElement | null;
  const visible = rect.width > 24 && rect.height > 24 && element.offsetParent !== null;
  element.dataset.pass255PaneVisible = String(visible);
  element.dataset.pass255PaneId = paneId;
  element.dataset.pass255PaneGeometryOk = String(rect.width > 120 && rect.height > 90);
  if (embedded) {
    embedded.dataset.pass255WebviewTopLeftOk = 'true';
    embedded.style.top = '0';
    embedded.style.left = '0';
    embedded.style.right = '0';
    embedded.style.bottom = '0';
    embedded.style.width = '100%';
    embedded.style.height = '100%';
    embedded.style.minWidth = '0';
    embedded.style.minHeight = '0';
    embedded.style.transform = 'none';
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:9611`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
  const embedded = element.querySelector('webview, iframe, .webview, .mission-webview, .site-view, browserview') as HTMLElement | null;
  const visible = rect.width > 24 && rect.height > 24 && element.offsetParent !== null;
  element.dataset.pass255PaneVisible = String(visible);
  element.dataset.pass255PaneId = paneId;
  element.dataset.pass255PaneGeometryOk = String(rect.width > 120 && rect.height > 90);
  if (embedded) {
    embedded.dataset.pass255WebviewTopLeftOk = 'true';
    embedded.style.top = '0';
    embedded.style.left = '0';
    embedded.style.right = '0';
    embedded.style.bottom = '0';
    embedded.style.width = '100%';
    embedded.style.height = '100%';
    embedded.style.minWidth = '0';
    embedded.style.minHeight = '0';
    embedded.style.transform = 'none';
    element.dataset.pass255PaneHasWebview = 'true';
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:9612`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
  const visible = rect.width > 24 && rect.height > 24 && element.offsetParent !== null;
  element.dataset.pass255PaneVisible = String(visible);
  element.dataset.pass255PaneId = paneId;
  element.dataset.pass255PaneGeometryOk = String(rect.width > 120 && rect.height > 90);
  if (embedded) {
    embedded.dataset.pass255WebviewTopLeftOk = 'true';
    embedded.style.top = '0';
    embedded.style.left = '0';
    embedded.style.right = '0';
    embedded.style.bottom = '0';
    embedded.style.width = '100%';
    embedded.style.height = '100%';
    embedded.style.minWidth = '0';
    embedded.style.minHeight = '0';
    embedded.style.transform = 'none';
    element.dataset.pass255PaneHasWebview = 'true';
  } else {
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:9613`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
  element.dataset.pass255PaneVisible = String(visible);
  element.dataset.pass255PaneId = paneId;
  element.dataset.pass255PaneGeometryOk = String(rect.width > 120 && rect.height > 90);
  if (embedded) {
    embedded.dataset.pass255WebviewTopLeftOk = 'true';
    embedded.style.top = '0';
    embedded.style.left = '0';
    embedded.style.right = '0';
    embedded.style.bottom = '0';
    embedded.style.width = '100%';
    embedded.style.height = '100%';
    embedded.style.minWidth = '0';
    embedded.style.minHeight = '0';
    embedded.style.transform = 'none';
    element.dataset.pass255PaneHasWebview = 'true';
  } else {
    element.dataset.pass255PaneHasWebview = 'false';
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:9614`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
  element.dataset.pass255PaneId = paneId;
  element.dataset.pass255PaneGeometryOk = String(rect.width > 120 && rect.height > 90);
  if (embedded) {
    embedded.dataset.pass255WebviewTopLeftOk = 'true';
    embedded.style.top = '0';
    embedded.style.left = '0';
    embedded.style.right = '0';
    embedded.style.bottom = '0';
    embedded.style.width = '100%';
    embedded.style.height = '100%';
    embedded.style.minWidth = '0';
    embedded.style.minHeight = '0';
    embedded.style.transform = 'none';
    element.dataset.pass255PaneHasWebview = 'true';
  } else {
    element.dataset.pass255PaneHasWebview = 'false';
  }
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:9615`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
  element.dataset.pass255PaneGeometryOk = String(rect.width > 120 && rect.height > 90);
  if (embedded) {
    embedded.dataset.pass255WebviewTopLeftOk = 'true';
    embedded.style.top = '0';
    embedded.style.left = '0';
    embedded.style.right = '0';
    embedded.style.bottom = '0';
    embedded.style.width = '100%';
    embedded.style.height = '100%';
    embedded.style.minWidth = '0';
    embedded.style.minHeight = '0';
    embedded.style.transform = 'none';
    element.dataset.pass255PaneHasWebview = 'true';
  } else {
    element.dataset.pass255PaneHasWebview = 'false';
  }
  return visible && rect.width > 120 && rect.height > 90;
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:9618`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
    embedded.style.top = '0';
    embedded.style.left = '0';
    embedded.style.right = '0';
    embedded.style.bottom = '0';
    embedded.style.width = '100%';
    embedded.style.height = '100%';
    embedded.style.minWidth = '0';
    embedded.style.minHeight = '0';
    embedded.style.transform = 'none';
    element.dataset.pass255PaneHasWebview = 'true';
  } else {
    element.dataset.pass255PaneHasWebview = 'false';
  }
  return visible && rect.width > 120 && rect.height > 90;
}

function pass255AssertVisiblePaneHealth(expectedPaneIds: string[], report: Pass255HydrationReport): boolean {
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:9724`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
  }, 35);
}

function pass255MountRecipePaneHydration(): void {
  if (pass255RecipePaneHydrationMounted) return;
  pass255RecipePaneHydrationMounted = true;
  document.body.dataset.pass255RecipePaneHydrationMounted = 'true';
  document.addEventListener('mission-layout-change', () => pass255HydrateSelectedRecipe('mission-layout-change'));
  window.addEventListener('resize', () => pass255HydrateSelectedRecipe('resize'));
  document.addEventListener('click', (event) => {
    const target = event.target as Element | null;
    const start = target?.closest?.('[data-pass254-start-mission-recipe-id], [data-start-mission-recipe-id]') as HTMLElement | null;
    if (start) {
      const recipeId = start.dataset.pass254StartMissionRecipeId || start.dataset.startMissionRecipeId || '';
      if (recipeId) document.body.dataset.pass255SelectedMissionRecipe = recipeId;
    }
  }, true);
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:9833`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
  document.querySelectorAll<HTMLElement>('[data-mission-pane], [data-pane-id], .mission-pane, .mission-pane-shell, .mission-webview-pane').forEach((pane, index) => {
    const paneId = pane.getAttribute('data-mission-pane') || pane.getAttribute('data-pane-id') || pane.id || 'pane-' + (index + 1);
    const resolvedPaneId = visible[index] || paneId;
    if (!pane.getAttribute('data-mission-pane')) pane.setAttribute('data-mission-pane', resolvedPaneId);
    const isVisible = visible.includes(paneId) || index < visible.length;
    pane.toggleAttribute('hidden', !isVisible); pane.classList.toggle('is-active', resolvedPaneId === active);
    pane.setAttribute('data-pass256-pane-visible', isVisible ? 'true' : 'false'); pane.setAttribute('data-pass256-active-pane', resolvedPaneId === active ? 'true' : 'false');
    const view = pane.querySelector<HTMLElement>('webview, iframe'); pane.setAttribute('data-pass256-pane-has-runtime-view', view ? 'true' : 'false');
    if (view) { view.style.position = 'absolute'; view.style.inset = '0'; view.style.width = '100%'; view.style.height = '100%'; view.style.transform = 'none'; }
  });
  window.dispatchEvent(new CustomEvent('tahai:mission-layout-change', { detail: { source: 'pass256', request } })); window.dispatchEvent(new Event('resize'));
}
function pass256GeometrySettle(report: Pass256TransitionReport): Promise<void> {
  report.phase = 'geometry-settle'; report.phases.push('geometry-settle');
  return new Promise((resolve) => requestAnimationFrame(() => { window.dispatchEvent(new Event('resize')); requestAnimationFrame(() => { window.dispatchEvent(new Event('resize')); resolve(); }); }));
}
function pass256PostAssertLayoutTransition(request: Pass256LayoutRequest, report: Pass256TransitionReport): boolean {
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:9839`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    pane.setAttribute('data-pass256-pane-visible', isVisible ? 'true' : 'false'); pane.setAttribute('data-pass256-active-pane', resolvedPaneId === active ? 'true' : 'false');
    const view = pane.querySelector<HTMLElement>('webview, iframe'); pane.setAttribute('data-pass256-pane-has-runtime-view', view ? 'true' : 'false');
    if (view) { view.style.position = 'absolute'; view.style.inset = '0'; view.style.width = '100%'; view.style.height = '100%'; view.style.transform = 'none'; }
  });
  window.dispatchEvent(new CustomEvent('tahai:mission-layout-change', { detail: { source: 'pass256', request } })); window.dispatchEvent(new Event('resize'));
}
function pass256GeometrySettle(report: Pass256TransitionReport): Promise<void> {
  report.phase = 'geometry-settle'; report.phases.push('geometry-settle');
  return new Promise((resolve) => requestAnimationFrame(() => { window.dispatchEvent(new Event('resize')); requestAnimationFrame(() => { window.dispatchEvent(new Event('resize')); resolve(); }); }));
}
function pass256PostAssertLayoutTransition(request: Pass256LayoutRequest, report: Pass256TransitionReport): boolean {
  report.phase = 'post-assert'; report.phases.push('post-assert');
  const active = currentMission?.layout?.activePaneId || 'pane-1'; const visible = pass256VisiblePaneIds(request, active);
  if (!visible.includes(active)) report.issues.push('hidden-active-pane');
  if (currentMission) visible.forEach((paneId) => { const tab = currentMission?.tabs.find((candidate) => candidate.paneId === paneId); const runtimeTabId = tab ? missionRuntimeTabs.get(tab.tabId) : ''; if (!tab) report.issues.push('missing-mission-tab:' + paneId); if (!runtimeTabId || !tabs.has(runtimeTabId)) report.issues.push('orphaned-runtime-tab:' + paneId); if (tab && (!tab.url || tab.url === 'about:blank')) report.issues.push('blank-pane:' + paneId); });
  document.querySelectorAll<HTMLElement>('[data-pass256-pane-visible="true"]').forEach((pane) => { const rect = pane.getBoundingClientRect(); pane.setAttribute('data-pass256-pane-geometry-ok', rect.width > 80 && rect.height > 80 ? 'true' : 'false'); });
  report.ok = !report.issues.some((issue) => /hidden-active-pane|missing-mission-tab|orphaned-runtime-tab|blank-pane/.test(issue));
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:9870`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
  pass256TransitionBusy = true;
  try { pass256PreflightLayoutTransition(request, report); pass256CommitLayoutTransition(request, report); pass256RenderLayoutTransition(request, report); await pass256GeometrySettle(report); if (!pass256PostAssertLayoutTransition(request, report)) { pass256RecoverLayoutTransition(request, report); await pass256GeometrySettle(report); if (!pass256PostAssertLayoutTransition(request, report)) pass256RollbackLayoutTransition(report); } report.phase = 'complete'; report.phases.push('complete'); report.completedAt = new Date().toISOString(); pass256LastTransitionReport = report; if (report.ok && currentMission) { const active = currentMission.layout.activePaneId || 'pane-1'; pass256LastStableLayout = { request, activePaneId: active, visiblePaneIds: pass256VisiblePaneIds(request, active) }; appendMissionTimelineEvent(currentMission, 'layout-set', 'Mission layout state machine transition', 'PASS256 ' + request + ' committed via ' + reason + '.'); } return report; }
  finally { pass256TransitionBusy = false; }
}
function pass256RequestFromControl(element: Element | null): Pass256LayoutRequest | undefined { if (!element) return undefined; const text = [element.getAttribute('data-pass256-layout'), element.getAttribute('data-mission-layout'), element.getAttribute('data-layout'), element.getAttribute('data-view'), element.getAttribute('aria-label'), element.getAttribute('title'), element.textContent, element.className && String(element.className)].filter(Boolean).join(' ').toLowerCase(); return /mission|layout|view|pane|quad|split|tri|3-up|4-up|2-up|1-up|focus|restore/.test(text) ? pass256NormalizeLayoutRequest(text) : undefined; }
function pass256ScheduleTransition(request: Pass256LayoutRequest | undefined, reason: string): void { if (!request) return; if (pass256PendingTimer) window.clearTimeout(pass256PendingTimer); pass256PendingTimer = window.setTimeout(() => { void pass256TransitionMissionLayout(request, reason); }, 30); }
function pass256RunLayoutStressContract(cycles = PASS256_LAYOUT_STRESS_CYCLE_COUNT): { ok: boolean; cycles: number; transitions: number; issues: string[] } { const issues: string[] = []; let activePaneId = 'pane-1'; let transitions = 0; for (let cycle = 0; cycle < cycles; cycle += 1) { for (const request of PASS256_LAYOUT_STRESS_SEQUENCE) { const visible = pass256VisiblePaneIds(request, activePaneId); if (!visible.length) issues.push('no-visible-panes:' + cycle + ':' + request); if (!visible.includes(activePaneId)) activePaneId = visible[0] || 'pane-1'; if (!visible.includes(activePaneId)) issues.push('hidden-active-pane:' + cycle + ':' + request); transitions += 1; } } return { ok: issues.length === 0 && transitions === cycles * PASS256_LAYOUT_STRESS_SEQUENCE.length, cycles, transitions, issues }; }
function pass256MountQuadViewStateMachine(): void { if (pass256Mounted) return; pass256Mounted = true; document.addEventListener('click', (event) => { const target = event.target; if (!(target instanceof Element)) return; const control = target.closest('button, [role="button"], [data-layout], [data-mission-layout], [data-view], .mission-layout-tabs, .mission-pane-controls, .mission-view-controls'); pass256ScheduleTransition(pass256RequestFromControl(control), 'layout-control-click'); }, true); document.addEventListener('keydown', (event) => { if (!event.ctrlKey || !event.altKey) return; const key = String(event.key || '').toLowerCase(); const requestByKey: Record<string, Pass256LayoutRequest> = { '1': 'single', '2': 'split-horizontal', '3': 'triple-top', '4': 'quad', q: 'quad', s: 'split-horizontal', f: 'focus' }; pass256ScheduleTransition(requestByKey[key], 'layout-keyboard-shortcut'); }, true); (window as unknown as { __TAHAI_PASS256_MISSION_VIEW_STATE_MACHINE__?: unknown }).__TAHAI_PASS256_MISSION_VIEW_STATE_MACHINE__ = { transition: pass256TransitionMissionLayout, stress: pass256RunLayoutStressContract, lastReport: () => pass256LastTransitionReport }; pass256ScheduleTransition(pass256NormalizeLayoutRequest(currentMission?.layout?.type || 'single'), 'mount'); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pass256MountQuadViewStateMachine, { once: true }); else pass256MountQuadViewStateMachine();
/* PASS256_QUAD_VIEW_STATE_MACHINE_END */

/* PASS257_MISSION_PANE_GEOMETRY_ENGINE_START */
type Pass257LayoutIntent = 'single' | 'split-horizontal' | 'split-vertical' | 'triple-top' | 'triple-bottom' | 'triple-left' | 'triple-right' | 'quad' | 'focus';
type Pass257PaneBounds = { left: number; top: number; width: number; height: number };
type Pass257PaneGeometrySnapshot = { paneId: string; visible: boolean; hasWebview: boolean; geometryOk: boolean; webviewTopLeftOk: boolean; bounds: Pass257PaneBounds; reason: string };
const PASS257_MIN_PANE_WIDTH = 96;
const PASS257_MIN_PANE_HEIGHT = 96;
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:9932`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
  if (layout === 'triple-bottom') return index === 0 ? { left: 0, top: 0, width, height: height - thirdH } : { left: index === 1 ? 0 : halfW, top: height - thirdH, width: index === 1 ? halfW : width - halfW, height: thirdH };
  if (layout === 'triple-left') return index === 0 ? { left: 0, top: 0, width: thirdW, height } : { left: thirdW, top: index === 1 ? 0 : halfH, width: width - thirdW, height: index === 1 ? halfH : height - halfH };
  if (layout === 'triple-right') return index === 0 ? { left: width - thirdW, top: 0, width: thirdW, height } : { left: 0, top: index === 1 ? 0 : halfH, width: width - thirdW, height: index === 1 ? halfH : height - halfH };
  if (layout === 'triple-top') return index === 0 ? { left: 0, top: 0, width, height: thirdH } : { left: index === 1 ? 0 : halfW, top: thirdH, width: index === 1 ? halfW : width - halfW, height: height - thirdH };
  return { left: 0, top: 0, width, height };
}
function pass257PaneIdFor(pane: HTMLElement, index: number): string { return pane.getAttribute('data-mission-pane') || pane.getAttribute('data-pane-id') || pane.id || 'pane-' + (index + 1); }
function pass257PinRuntimeView(view: HTMLElement): boolean {
  view.style.position = 'absolute'; view.style.top = '0px'; view.style.left = '0px'; view.style.right = '0px'; view.style.bottom = '0px'; view.style.width = '100%'; view.style.height = '100%'; view.style.minWidth = '0'; view.style.minHeight = '0'; view.style.transform = 'none'; view.style.margin = '0';
  const topLeftOk = view.style.top === '0px' && view.style.left === '0px' && view.style.transform === 'none';
  view.setAttribute('data-webview-top-left-ok', topLeftOk ? 'true' : 'false');
  view.setAttribute('data-pass257-runtime-view-pinned', 'true');
  return topLeftOk;
}
function pass257ApplyPaneBounds(pane: HTMLElement, index: number, layout: Pass257LayoutIntent, stageRect: DOMRectReadOnly | { width: number; height: number }, visible: boolean, reason: string): Pass257PaneGeometrySnapshot {
  const paneId = pass257PaneIdFor(pane, index);
  const bounds = pass257ComputePaneBounds(layout, index, stageRect);
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:9933`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
  if (layout === 'triple-left') return index === 0 ? { left: 0, top: 0, width: thirdW, height } : { left: thirdW, top: index === 1 ? 0 : halfH, width: width - thirdW, height: index === 1 ? halfH : height - halfH };
  if (layout === 'triple-right') return index === 0 ? { left: width - thirdW, top: 0, width: thirdW, height } : { left: 0, top: index === 1 ? 0 : halfH, width: width - thirdW, height: index === 1 ? halfH : height - halfH };
  if (layout === 'triple-top') return index === 0 ? { left: 0, top: 0, width, height: thirdH } : { left: index === 1 ? 0 : halfW, top: thirdH, width: index === 1 ? halfW : width - halfW, height: height - thirdH };
  return { left: 0, top: 0, width, height };
}
function pass257PaneIdFor(pane: HTMLElement, index: number): string { return pane.getAttribute('data-mission-pane') || pane.getAttribute('data-pane-id') || pane.id || 'pane-' + (index + 1); }
function pass257PinRuntimeView(view: HTMLElement): boolean {
  view.style.position = 'absolute'; view.style.top = '0px'; view.style.left = '0px'; view.style.right = '0px'; view.style.bottom = '0px'; view.style.width = '100%'; view.style.height = '100%'; view.style.minWidth = '0'; view.style.minHeight = '0'; view.style.transform = 'none'; view.style.margin = '0';
  const topLeftOk = view.style.top === '0px' && view.style.left === '0px' && view.style.transform === 'none';
  view.setAttribute('data-webview-top-left-ok', topLeftOk ? 'true' : 'false');
  view.setAttribute('data-pass257-runtime-view-pinned', 'true');
  return topLeftOk;
}
function pass257ApplyPaneBounds(pane: HTMLElement, index: number, layout: Pass257LayoutIntent, stageRect: DOMRectReadOnly | { width: number; height: number }, visible: boolean, reason: string): Pass257PaneGeometrySnapshot {
  const paneId = pass257PaneIdFor(pane, index);
  const bounds = pass257ComputePaneBounds(layout, index, stageRect);
  pane.setAttribute('data-mission-pane', paneId); pane.setAttribute('data-pass257-pane-managed', 'true'); pane.setAttribute('data-pane-visible', visible ? 'true' : 'false');
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:9942`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
  view.setAttribute('data-webview-top-left-ok', topLeftOk ? 'true' : 'false');
  view.setAttribute('data-pass257-runtime-view-pinned', 'true');
  return topLeftOk;
}
function pass257ApplyPaneBounds(pane: HTMLElement, index: number, layout: Pass257LayoutIntent, stageRect: DOMRectReadOnly | { width: number; height: number }, visible: boolean, reason: string): Pass257PaneGeometrySnapshot {
  const paneId = pass257PaneIdFor(pane, index);
  const bounds = pass257ComputePaneBounds(layout, index, stageRect);
  pane.setAttribute('data-mission-pane', paneId); pane.setAttribute('data-pass257-pane-managed', 'true'); pane.setAttribute('data-pane-visible', visible ? 'true' : 'false');
  pane.style.position = 'absolute'; pane.style.boxSizing = 'border-box'; pane.style.minWidth = '0'; pane.style.minHeight = '0'; pane.style.overflow = 'hidden'; pane.style.contain = 'layout style'; pane.style.transform = 'none';
  if (visible) { pane.hidden = false; pane.style.display = ''; pane.style.left = bounds.left + 'px'; pane.style.top = bounds.top + 'px'; pane.style.width = bounds.width + 'px'; pane.style.height = bounds.height + 'px'; }
  else { pane.hidden = true; pane.style.display = 'none'; pane.setAttribute('data-pass257-removed-from-active-routing', 'true'); }
  const webview = pane.querySelector<HTMLElement>('webview, iframe');
  const hasWebview = Boolean(webview);
  pane.setAttribute('data-pane-has-webview', hasWebview ? 'true' : 'false');
  let webviewTopLeftOk = !hasWebview;
  if (webview) webviewTopLeftOk = pass257PinRuntimeView(webview);
  const geometryOk = !visible || (bounds.width >= PASS257_MIN_PANE_WIDTH && bounds.height >= PASS257_MIN_PANE_HEIGHT && bounds.top >= 0 && bounds.left >= 0);
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:9943`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
  view.setAttribute('data-pass257-runtime-view-pinned', 'true');
  return topLeftOk;
}
function pass257ApplyPaneBounds(pane: HTMLElement, index: number, layout: Pass257LayoutIntent, stageRect: DOMRectReadOnly | { width: number; height: number }, visible: boolean, reason: string): Pass257PaneGeometrySnapshot {
  const paneId = pass257PaneIdFor(pane, index);
  const bounds = pass257ComputePaneBounds(layout, index, stageRect);
  pane.setAttribute('data-mission-pane', paneId); pane.setAttribute('data-pass257-pane-managed', 'true'); pane.setAttribute('data-pane-visible', visible ? 'true' : 'false');
  pane.style.position = 'absolute'; pane.style.boxSizing = 'border-box'; pane.style.minWidth = '0'; pane.style.minHeight = '0'; pane.style.overflow = 'hidden'; pane.style.contain = 'layout style'; pane.style.transform = 'none';
  if (visible) { pane.hidden = false; pane.style.display = ''; pane.style.left = bounds.left + 'px'; pane.style.top = bounds.top + 'px'; pane.style.width = bounds.width + 'px'; pane.style.height = bounds.height + 'px'; }
  else { pane.hidden = true; pane.style.display = 'none'; pane.setAttribute('data-pass257-removed-from-active-routing', 'true'); }
  const webview = pane.querySelector<HTMLElement>('webview, iframe');
  const hasWebview = Boolean(webview);
  pane.setAttribute('data-pane-has-webview', hasWebview ? 'true' : 'false');
  let webviewTopLeftOk = !hasWebview;
  if (webview) webviewTopLeftOk = pass257PinRuntimeView(webview);
  const geometryOk = !visible || (bounds.width >= PASS257_MIN_PANE_WIDTH && bounds.height >= PASS257_MIN_PANE_HEIGHT && bounds.top >= 0 && bounds.left >= 0);
  pane.setAttribute('data-pane-geometry-ok', geometryOk ? 'true' : 'false'); pane.setAttribute('data-webview-top-left-ok', webviewTopLeftOk ? 'true' : 'false'); pane.setAttribute('data-pass257-geometry-reason', reason);
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:9975`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
  stage.setAttribute('data-pass257-geometry-engine', 'managed'); stage.setAttribute('data-pass257-layout-intent', layout); stage.setAttribute('data-pass257-expected-pane-count', String(expected));
  stage.style.position = stage.style.position || 'relative'; stage.style.minWidth = '0'; stage.style.minHeight = '0'; stage.style.overflow = 'hidden'; stage.style.contain = 'layout style';
  pass257LastGeometrySnapshot = panes.map((pane, index) => pass257ApplyPaneBounds(pane, index, layout, rect, index < expected, reason));
  const visibleIssues = pass257LastGeometrySnapshot.filter((snap) => snap.visible && (!snap.geometryOk || !snap.webviewTopLeftOk));
  stage.setAttribute('data-pass257-geometry-ok', visibleIssues.length ? 'false' : 'true');
  stage.setAttribute('data-pass257-last-recalc', new Date().toISOString());
  return pass257LastGeometrySnapshot;
}
function pass257ScheduleGeometry(reason: string): void { if (pass257PendingGeometryFrame) cancelAnimationFrame(pass257PendingGeometryFrame); pass257PendingGeometryFrame = requestAnimationFrame(() => { pass257PendingGeometryFrame = undefined; pass257RecalculateMissionPaneGeometry(reason); }); }
function pass257ObserveGeometryTargets(): void {
  if (typeof ResizeObserver === 'undefined') return;
  if (pass257ResizeObserver) pass257ResizeObserver.disconnect();
  pass257ResizeObserver = new ResizeObserver(() => pass257ScheduleGeometry('resize-observer'));
  const stage = pass257FindMissionStage(); if (stage) pass257ResizeObserver.observe(stage);
  pass257FindMissionPanes(stage).forEach((pane) => pass257ResizeObserver?.observe(pane));
}
function pass257MountMissionPaneGeometryEngine(): void {
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:9979`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
  stage.setAttribute('data-pass257-geometry-ok', visibleIssues.length ? 'false' : 'true');
  stage.setAttribute('data-pass257-last-recalc', new Date().toISOString());
  return pass257LastGeometrySnapshot;
}
function pass257ScheduleGeometry(reason: string): void { if (pass257PendingGeometryFrame) cancelAnimationFrame(pass257PendingGeometryFrame); pass257PendingGeometryFrame = requestAnimationFrame(() => { pass257PendingGeometryFrame = undefined; pass257RecalculateMissionPaneGeometry(reason); }); }
function pass257ObserveGeometryTargets(): void {
  if (typeof ResizeObserver === 'undefined') return;
  if (pass257ResizeObserver) pass257ResizeObserver.disconnect();
  pass257ResizeObserver = new ResizeObserver(() => pass257ScheduleGeometry('resize-observer'));
  const stage = pass257FindMissionStage(); if (stage) pass257ResizeObserver.observe(stage);
  pass257FindMissionPanes(stage).forEach((pane) => pass257ResizeObserver?.observe(pane));
}
function pass257MountMissionPaneGeometryEngine(): void {
  if (pass257Mounted) return; pass257Mounted = true;
  window.addEventListener('resize', () => pass257ScheduleGeometry('window-resize'));
  window.addEventListener('tahai:mission-layout-change', () => pass257ScheduleGeometry('mission-layout-change'));
  document.addEventListener('did-stop-loading', () => pass257ScheduleGeometry('did-stop-loading'), true);
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:9985`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
  if (typeof ResizeObserver === 'undefined') return;
  if (pass257ResizeObserver) pass257ResizeObserver.disconnect();
  pass257ResizeObserver = new ResizeObserver(() => pass257ScheduleGeometry('resize-observer'));
  const stage = pass257FindMissionStage(); if (stage) pass257ResizeObserver.observe(stage);
  pass257FindMissionPanes(stage).forEach((pane) => pass257ResizeObserver?.observe(pane));
}
function pass257MountMissionPaneGeometryEngine(): void {
  if (pass257Mounted) return; pass257Mounted = true;
  window.addEventListener('resize', () => pass257ScheduleGeometry('window-resize'));
  window.addEventListener('tahai:mission-layout-change', () => pass257ScheduleGeometry('mission-layout-change'));
  document.addEventListener('did-stop-loading', () => pass257ScheduleGeometry('did-stop-loading'), true);
  document.addEventListener('dom-ready', () => pass257ScheduleGeometry('dom-ready'), true);
  document.addEventListener('focusin', () => pass257ScheduleGeometry('focusin'), true);
  document.addEventListener('click', () => pass257ScheduleGeometry('operator-click'), true);
  pass257ObserveGeometryTargets(); pass257ScheduleGeometry('mount');
  (window as unknown as { __TAHAI_PASS257_MISSION_PANE_GEOMETRY__?: unknown }).__TAHAI_PASS257_MISSION_PANE_GEOMETRY__ = { recalc: pass257RecalculateMissionPaneGeometry, observe: pass257ObserveGeometryTargets, lastSnapshot: () => pass257LastGeometrySnapshot, computePaneBounds: pass257ComputePaneBounds };
}
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:9994`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
  window.addEventListener('tahai:mission-layout-change', () => pass257ScheduleGeometry('mission-layout-change'));
  document.addEventListener('did-stop-loading', () => pass257ScheduleGeometry('did-stop-loading'), true);
  document.addEventListener('dom-ready', () => pass257ScheduleGeometry('dom-ready'), true);
  document.addEventListener('focusin', () => pass257ScheduleGeometry('focusin'), true);
  document.addEventListener('click', () => pass257ScheduleGeometry('operator-click'), true);
  pass257ObserveGeometryTargets(); pass257ScheduleGeometry('mount');
  (window as unknown as { __TAHAI_PASS257_MISSION_PANE_GEOMETRY__?: unknown }).__TAHAI_PASS257_MISSION_PANE_GEOMETRY__ = { recalc: pass257RecalculateMissionPaneGeometry, observe: pass257ObserveGeometryTargets, lastSnapshot: () => pass257LastGeometrySnapshot, computePaneBounds: pass257ComputePaneBounds };
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pass257MountMissionPaneGeometryEngine, { once: true }); else pass257MountMissionPaneGeometryEngine();
/* PASS257_MISSION_PANE_GEOMETRY_ENGINE_END */

/* PASS258_RECIPE_QUAD_RUNTIME_E2E_HARNESS_START */
(function pass258RecipeQuadRuntimeE2EHarness(): void {
  type Pass258SafeUrl = { role?: string; title?: string; url: string };
  type Pass258RecipeFixture = {
    id: string;
    title: string;
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:10150`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
  function pass258Mount(): void {
    const tahaiWindow = window as Pass258Window;
    const api = { fixtures: PASS258_FIXTURES, requiredRecipeIds: PASS258_REQUIRED_RECIPE_IDS.slice(), layoutSequence: PASS258_LAYOUT_SEQUENCE.slice(), isSafeRecipeUrl: pass258IsSafeRecipeUrl, buildScenario: pass258BuildScenario, assertScenario: pass258AssertScenario, runRecipeQuadRuntimeContract: pass258RunRecipeQuadRuntimeContract };
    tahaiWindow.__TAHAI_PASS258_RECIPE_QUAD_RUNTIME_E2E__ = api;
    const initialReport = pass258RunRecipeQuadRuntimeContract(PASS258_FIXTURES.recipes);
    tahaiWindow.__TAHAI_PASS258_RECIPE_QUAD_RUNTIME_REPORT__ = initialReport;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pass258Mount, { once: true }); else pass258Mount();
})();
/* PASS258_RECIPE_QUAD_RUNTIME_E2E_HARNESS_END */

/* PASS259_MISSION_CONTROL_UX_FINAL_FLAGSHIP_POLISH_START */
(function pass259MissionControlUxFinalFlagshipPolish(): void {
  type Pass259WebsiteBudget = { width: number; height: number; ratio: number; ok: boolean };
  type Pass259FocusRestore = { currentLayout: string; previousLayout: string; activePaneId: string; ready: boolean };
  type Pass259MissionControlUxReport = {
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:10361`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    document.documentElement.setAttribute('data-pass259-card-section-contract', PASS259_CARD_SECTIONS.join(','));
    (window as Pass259Window).__TAHAI_PASS259_MISSION_CONTROL_UX_REPORT__ = report;
    return report;
  }

  function pass259InstallEventHooks(): void {
    document.addEventListener('click', (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('[data-mission-recipe-id], [data-recipe-id], .mission-recipe-card, .recipe-card, [data-mission-pane], [data-pane-id], .mission-pane') : null;
      if (target) window.requestAnimationFrame(() => { pass259PolishMissionControl('click'); });
    }, true);
    document.addEventListener('focusin', (event: FocusEvent) => {
      const pane = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-mission-pane], [data-pane-id], .mission-pane') : null;
      if (pane) {
        pass259LastFocusedPane = pane.getAttribute('data-mission-pane') || pane.getAttribute('data-pane-id') || pane.id || pass259LastFocusedPane;
        window.requestAnimationFrame(() => { pass259PolishMissionControl('focus'); });
      }
    }, true);
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:10367`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    document.addEventListener('click', (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('[data-mission-recipe-id], [data-recipe-id], .mission-recipe-card, .recipe-card, [data-mission-pane], [data-pane-id], .mission-pane') : null;
      if (target) window.requestAnimationFrame(() => { pass259PolishMissionControl('click'); });
    }, true);
    document.addEventListener('focusin', (event: FocusEvent) => {
      const pane = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-mission-pane], [data-pane-id], .mission-pane') : null;
      if (pane) {
        pass259LastFocusedPane = pane.getAttribute('data-mission-pane') || pane.getAttribute('data-pane-id') || pane.id || pass259LastFocusedPane;
        window.requestAnimationFrame(() => { pass259PolishMissionControl('focus'); });
      }
    }, true);
    window.addEventListener('resize', () => { window.requestAnimationFrame(() => { pass259PolishMissionControl('resize'); }); }, { passive: true });
  }

  function pass259Mount(): void {
    pass259InstallEventHooks();
    pass259PolishMissionControl('mount');
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:10370`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    }, true);
    document.addEventListener('focusin', (event: FocusEvent) => {
      const pane = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-mission-pane], [data-pane-id], .mission-pane') : null;
      if (pane) {
        pass259LastFocusedPane = pane.getAttribute('data-mission-pane') || pane.getAttribute('data-pane-id') || pane.id || pass259LastFocusedPane;
        window.requestAnimationFrame(() => { pass259PolishMissionControl('focus'); });
      }
    }, true);
    window.addEventListener('resize', () => { window.requestAnimationFrame(() => { pass259PolishMissionControl('resize'); }); }, { passive: true });
  }

  function pass259Mount(): void {
    pass259InstallEventHooks();
    pass259PolishMissionControl('mount');
    (window as Pass259Window).__TAHAI_PASS259_MISSION_CONTROL_UX__ = { cardSections: PASS259_CARD_SECTIONS.slice(), minimumWebsiteBudget: Object.assign({}, PASS259_MIN_WEBSITE_BUDGET), polish: pass259PolishMissionControl, report: () => pass259LastReport };
  }

```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:13005`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
forwardButton.addEventListener('click', () => goForwardTarget('toolbar'));
reloadButton.addEventListener('click', () => reloadTarget('toolbar'));
homeButton.addEventListener('click', () => navigate(settings.homeUrl || config.homeUrl, 'home'));
launchpadButton.addEventListener('click', () => navigate(config.newTabUrl, 'launchpad'));
onboardingButton.addEventListener('click', () => navigate(pass195OperatorWalkthroughUrl(), 'guide'));
profileSwitcherButton.addEventListener('click', () => { void openProfileManager(); });
opsHubToggleButton.addEventListener('click', () => toggleOpsHub());
missionControlButton.addEventListener('click', () => { void openMissionControl(); });
window.addEventListener('resize', () => { if (missionDialog.open) pass128UpdateMissionViewportMode('resize'); });
window.addEventListener('orientationchange', () => { if (missionDialog.open) window.setTimeout(() => pass128UpdateMissionViewportMode('orientationchange'), 40); });
closeOpsHubButton.addEventListener('click', () => toggleOpsHub(false, true));
opsHub.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const button = target.closest('button') as HTMLButtonElement | null;
  if (!button) return;
  const action = button.dataset.opsAction;
  if (action === 'command') openCommandPalette();
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:14345`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!pass66MissionPanePointerDragging && !pass63MissionPaneDragSource && !pass68MissionPaneClickSwapSource) return;
    event.preventDefault();
    event.stopPropagation();
    pass70ClearTransientMissionPaneUiState();
    setStatus('Mission pane move cancelled', 'Pane content returned to normal clarity.');
  }, true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') pass70ClearTransientMissionPaneUiState();
  });
  pass70MissionPaneTransientCleanupMounted = true;
}



// PASS76 Mission View direct controls + viewport health doctor.
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:14466`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
    const target = pass108SwapTargetForPane(layer, paneId);
    const left = pass72Rounded(bounds.left + pad);
    const top = pass72Rounded(bounds.top + pad);
    const width = Math.max(1, pass72Rounded(bounds.width));
    const height = Math.max(1, pass72Rounded(bounds.height));
    target.hidden = false;
    target.classList.toggle('armed-source', paneId === sourcePaneId);
    target.setAttribute('aria-pressed', String(paneId === sourcePaneId));
    target.style.setProperty('left', left + 'px', 'important');
    target.style.setProperty('top', top + 'px', 'important');
    target.style.setProperty('width', width + 'px', 'important');
    target.style.setProperty('height', height + 'px', 'important');
  }
}

function pass76NudgeWebviewGuestResize(webview: Electron.WebviewTag, width: number, height: number): void {
  const key = Math.max(1, Math.round(width)) + 'x' + Math.max(1, Math.round(height));
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:14467`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
    const left = pass72Rounded(bounds.left + pad);
    const top = pass72Rounded(bounds.top + pad);
    const width = Math.max(1, pass72Rounded(bounds.width));
    const height = Math.max(1, pass72Rounded(bounds.height));
    target.hidden = false;
    target.classList.toggle('armed-source', paneId === sourcePaneId);
    target.setAttribute('aria-pressed', String(paneId === sourcePaneId));
    target.style.setProperty('left', left + 'px', 'important');
    target.style.setProperty('top', top + 'px', 'important');
    target.style.setProperty('width', width + 'px', 'important');
    target.style.setProperty('height', height + 'px', 'important');
  }
}

function pass76NudgeWebviewGuestResize(webview: Electron.WebviewTag, width: number, height: number): void {
  const key = Math.max(1, Math.round(width)) + 'x' + Math.max(1, Math.round(height));
  if (webview.dataset.pass76ResizeNudge === key) return;
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:14468`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
    const top = pass72Rounded(bounds.top + pad);
    const width = Math.max(1, pass72Rounded(bounds.width));
    const height = Math.max(1, pass72Rounded(bounds.height));
    target.hidden = false;
    target.classList.toggle('armed-source', paneId === sourcePaneId);
    target.setAttribute('aria-pressed', String(paneId === sourcePaneId));
    target.style.setProperty('left', left + 'px', 'important');
    target.style.setProperty('top', top + 'px', 'important');
    target.style.setProperty('width', width + 'px', 'important');
    target.style.setProperty('height', height + 'px', 'important');
  }
}

function pass76NudgeWebviewGuestResize(webview: Electron.WebviewTag, width: number, height: number): void {
  const key = Math.max(1, Math.round(width)) + 'x' + Math.max(1, Math.round(height));
  if (webview.dataset.pass76ResizeNudge === key) return;
  webview.dataset.pass76ResizeNudge = key;
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:14469`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
    const width = Math.max(1, pass72Rounded(bounds.width));
    const height = Math.max(1, pass72Rounded(bounds.height));
    target.hidden = false;
    target.classList.toggle('armed-source', paneId === sourcePaneId);
    target.setAttribute('aria-pressed', String(paneId === sourcePaneId));
    target.style.setProperty('left', left + 'px', 'important');
    target.style.setProperty('top', top + 'px', 'important');
    target.style.setProperty('width', width + 'px', 'important');
    target.style.setProperty('height', height + 'px', 'important');
  }
}

function pass76NudgeWebviewGuestResize(webview: Electron.WebviewTag, width: number, height: number): void {
  const key = Math.max(1, Math.round(width)) + 'x' + Math.max(1, Math.round(height));
  if (webview.dataset.pass76ResizeNudge === key) return;
  webview.dataset.pass76ResizeNudge = key;
  window.requestAnimationFrame(() => {
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:14477`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    target.style.setProperty('height', height + 'px', 'important');
  }
}

function pass76NudgeWebviewGuestResize(webview: Electron.WebviewTag, width: number, height: number): void {
  const key = Math.max(1, Math.round(width)) + 'x' + Math.max(1, Math.round(height));
  if (webview.dataset.pass76ResizeNudge === key) return;
  webview.dataset.pass76ResizeNudge = key;
  window.requestAnimationFrame(() => {
    if (!webview.isConnected) return;
    const wantedWidth = Math.max(1, Math.round(width));
    const wantedHeight = Math.max(1, Math.round(height));
    webview.style.setProperty('width', Math.max(1, wantedWidth - 1) + 'px', 'important');
    webview.style.setProperty('height', Math.max(1, wantedHeight - 1) + 'px', 'important');
    window.requestAnimationFrame(() => {
      if (!webview.isConnected) return;
      webview.style.setProperty('width', wantedWidth + 'px', 'important');
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:14481`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
function pass76NudgeWebviewGuestResize(webview: Electron.WebviewTag, width: number, height: number): void {
  const key = Math.max(1, Math.round(width)) + 'x' + Math.max(1, Math.round(height));
  if (webview.dataset.pass76ResizeNudge === key) return;
  webview.dataset.pass76ResizeNudge = key;
  window.requestAnimationFrame(() => {
    if (!webview.isConnected) return;
    const wantedWidth = Math.max(1, Math.round(width));
    const wantedHeight = Math.max(1, Math.round(height));
    webview.style.setProperty('width', Math.max(1, wantedWidth - 1) + 'px', 'important');
    webview.style.setProperty('height', Math.max(1, wantedHeight - 1) + 'px', 'important');
    window.requestAnimationFrame(() => {
      if (!webview.isConnected) return;
      webview.style.setProperty('width', wantedWidth + 'px', 'important');
      webview.style.setProperty('height', wantedHeight + 'px', 'important');
    });
  });
}
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:14482`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
  const key = Math.max(1, Math.round(width)) + 'x' + Math.max(1, Math.round(height));
  if (webview.dataset.pass76ResizeNudge === key) return;
  webview.dataset.pass76ResizeNudge = key;
  window.requestAnimationFrame(() => {
    if (!webview.isConnected) return;
    const wantedWidth = Math.max(1, Math.round(width));
    const wantedHeight = Math.max(1, Math.round(height));
    webview.style.setProperty('width', Math.max(1, wantedWidth - 1) + 'px', 'important');
    webview.style.setProperty('height', Math.max(1, wantedHeight - 1) + 'px', 'important');
    window.requestAnimationFrame(() => {
      if (!webview.isConnected) return;
      webview.style.setProperty('width', wantedWidth + 'px', 'important');
      webview.style.setProperty('height', wantedHeight + 'px', 'important');
    });
  });
}

```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:14483`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
  if (webview.dataset.pass76ResizeNudge === key) return;
  webview.dataset.pass76ResizeNudge = key;
  window.requestAnimationFrame(() => {
    if (!webview.isConnected) return;
    const wantedWidth = Math.max(1, Math.round(width));
    const wantedHeight = Math.max(1, Math.round(height));
    webview.style.setProperty('width', Math.max(1, wantedWidth - 1) + 'px', 'important');
    webview.style.setProperty('height', Math.max(1, wantedHeight - 1) + 'px', 'important');
    window.requestAnimationFrame(() => {
      if (!webview.isConnected) return;
      webview.style.setProperty('width', wantedWidth + 'px', 'important');
      webview.style.setProperty('height', wantedHeight + 'px', 'important');
    });
  });
}

function pass76MoveHandleForPane(layer: HTMLElement, paneId: string): HTMLButtonElement {
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:14485`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
  window.requestAnimationFrame(() => {
    if (!webview.isConnected) return;
    const wantedWidth = Math.max(1, Math.round(width));
    const wantedHeight = Math.max(1, Math.round(height));
    webview.style.setProperty('width', Math.max(1, wantedWidth - 1) + 'px', 'important');
    webview.style.setProperty('height', Math.max(1, wantedHeight - 1) + 'px', 'important');
    window.requestAnimationFrame(() => {
      if (!webview.isConnected) return;
      webview.style.setProperty('width', wantedWidth + 'px', 'important');
      webview.style.setProperty('height', wantedHeight + 'px', 'important');
    });
  });
}

function pass76MoveHandleForPane(layer: HTMLElement, paneId: string): HTMLButtonElement {
  let handle = layer.querySelector<HTMLButtonElement>('.pass76-mission-pane-direct-move[data-pass76-pane-id="' + paneId + '"]');
  if (!handle) {
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:14486`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
    if (!webview.isConnected) return;
    const wantedWidth = Math.max(1, Math.round(width));
    const wantedHeight = Math.max(1, Math.round(height));
    webview.style.setProperty('width', Math.max(1, wantedWidth - 1) + 'px', 'important');
    webview.style.setProperty('height', Math.max(1, wantedHeight - 1) + 'px', 'important');
    window.requestAnimationFrame(() => {
      if (!webview.isConnected) return;
      webview.style.setProperty('width', wantedWidth + 'px', 'important');
      webview.style.setProperty('height', wantedHeight + 'px', 'important');
    });
  });
}

function pass76MoveHandleForPane(layer: HTMLElement, paneId: string): HTMLButtonElement {
  let handle = layer.querySelector<HTMLButtonElement>('.pass76-mission-pane-direct-move[data-pass76-pane-id="' + paneId + '"]');
  if (!handle) {
    handle = document.createElement('button');
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:14543`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
    const paneId = handle.dataset.pass76PaneId || handle.dataset.pass63MissionPaneId || '';
    handle.hidden = !visible.has(paneId);
  });
  if (stageWidth < 20 || stageHeight < 20) return;
  for (const paneId of visiblePanes) {
    const bounds = pass72PaneBoundsForLayout(currentMission.layout.type, paneId, stageWidth, stageHeight);
    if (!bounds) continue;
    const handle = pass76MoveHandleForPane(layer, paneId);
    handle.style.setProperty('left', pass72Rounded(bounds.left + pad + Math.max(12, bounds.width - 86)) + 'px', 'important');
    handle.style.setProperty('top', pass72Rounded(bounds.top + pad + 10) + 'px', 'important');
    handle.style.setProperty('display', 'inline-flex', 'important');
  }
  if (pass108MissionPaneSwapTargetSource || pass68MissionPaneClickSwapSource) pass108RefreshMissionPaneSwapTargets(reason);
  if (reason !== 'doctor') pass76MountMissionPaneMoveHandleWatchdog();
}

function pass76PaneHealthSignature(): string {
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:14544`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
    handle.hidden = !visible.has(paneId);
  });
  if (stageWidth < 20 || stageHeight < 20) return;
  for (const paneId of visiblePanes) {
    const bounds = pass72PaneBoundsForLayout(currentMission.layout.type, paneId, stageWidth, stageHeight);
    if (!bounds) continue;
    const handle = pass76MoveHandleForPane(layer, paneId);
    handle.style.setProperty('left', pass72Rounded(bounds.left + pad + Math.max(12, bounds.width - 86)) + 'px', 'important');
    handle.style.setProperty('top', pass72Rounded(bounds.top + pad + 10) + 'px', 'important');
    handle.style.setProperty('display', 'inline-flex', 'important');
  }
  if (pass108MissionPaneSwapTargetSource || pass68MissionPaneClickSwapSource) pass108RefreshMissionPaneSwapTargets(reason);
  if (reason !== 'doctor') pass76MountMissionPaneMoveHandleWatchdog();
}

function pass76PaneHealthSignature(): string {
  if (!stageEl || !currentMission || currentMission.layout.type === 'single') return 'single';
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:14593`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    if (!handle) return;
    event.stopPropagation();
  }, true);
  pass76MissionPaneMoveHandlesMounted = true;
}

function pass76MountMissionPaneHealthDoctor(): void {
  if (pass76MissionPaneHealthMounted) return;
  window.addEventListener('resize', () => pass76StartMissionPaneRepairLoop('resize'));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pass76StartMissionPaneRepairLoop('visibility'); });
  stageEl?.addEventListener('scroll', () => pass76StartMissionPaneRepairLoop('stage-scroll'), true);
  pass76MissionPaneHealthMounted = true;
}

// PASS77 Mission View command dock + viewport fit hardening.
function pass77EnsureMissionPaneCommandDock(): HTMLElement | null {
  if (!missionLayoutsEl) return null;
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:14594`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    event.stopPropagation();
  }, true);
  pass76MissionPaneMoveHandlesMounted = true;
}

function pass76MountMissionPaneHealthDoctor(): void {
  if (pass76MissionPaneHealthMounted) return;
  window.addEventListener('resize', () => pass76StartMissionPaneRepairLoop('resize'));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pass76StartMissionPaneRepairLoop('visibility'); });
  stageEl?.addEventListener('scroll', () => pass76StartMissionPaneRepairLoop('stage-scroll'), true);
  pass76MissionPaneHealthMounted = true;
}

// PASS77 Mission View command dock + viewport fit hardening.
function pass77EnsureMissionPaneCommandDock(): HTMLElement | null {
  if (!missionLayoutsEl) return null;
  if (!pass77MissionPaneCommandDock) {
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:14775`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
  // PASS78 Deterministic UX Guard: webview autosize stays off; the app shell owns exact pane bounds.
  webview.setAttribute('autosize', 'off');
  webview.removeAttribute('minwidth');
  webview.removeAttribute('minheight');
  webview.removeAttribute('maxwidth');
  webview.removeAttribute('maxheight');
  webview.setAttribute('width', String(wantedWidth));
  webview.setAttribute('height', String(wantedHeight));
  webview.style.setProperty('width', wantedWidth + 'px', 'important');
  webview.style.setProperty('height', wantedHeight + 'px', 'important');
  webview.style.setProperty('min-width', wantedWidth + 'px', 'important');
  webview.style.setProperty('min-height', wantedHeight + 'px', 'important');
  webview.style.setProperty('max-width', wantedWidth + 'px', 'important');
  webview.style.setProperty('max-height', wantedHeight + 'px', 'important');
  webview.dataset.pass77ViewportFit = wantedWidth + 'x' + wantedHeight;
  webview.dataset.pass78AutosizeGuard = 'off';
}
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:14776`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
  webview.setAttribute('autosize', 'off');
  webview.removeAttribute('minwidth');
  webview.removeAttribute('minheight');
  webview.removeAttribute('maxwidth');
  webview.removeAttribute('maxheight');
  webview.setAttribute('width', String(wantedWidth));
  webview.setAttribute('height', String(wantedHeight));
  webview.style.setProperty('width', wantedWidth + 'px', 'important');
  webview.style.setProperty('height', wantedHeight + 'px', 'important');
  webview.style.setProperty('min-width', wantedWidth + 'px', 'important');
  webview.style.setProperty('min-height', wantedHeight + 'px', 'important');
  webview.style.setProperty('max-width', wantedWidth + 'px', 'important');
  webview.style.setProperty('max-height', wantedHeight + 'px', 'important');
  webview.dataset.pass77ViewportFit = wantedWidth + 'x' + wantedHeight;
  webview.dataset.pass78AutosizeGuard = 'off';
}

```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:14805`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
      const runtimeTab = missionPaneRuntimeTab(paneId);
      const bounds = pass72PaneBoundsForLayout(layout, paneId, stageWidth, stageHeight);
      if (!runtimeTab || !bounds) continue;
      pass77FitWebviewGuestViewport(runtimeTab.webview, Math.max(1, pass72Rounded(bounds.width)), Math.max(1, pass72Rounded(bounds.height)));
    }
    pass76RefreshMissionPaneDirectMoveControls('doctor');
    pass77RefreshMissionPaneCommandDock(reason);
  };
  window.requestAnimationFrame(run);
  window.setTimeout(run, 80);
  window.setTimeout(run, 260);
  window.setTimeout(run, 700);
}

function pass78ClearStaleMissionPaneMoveState(reason = 'doctor'): number {
  let corrected = 0;
  const staleClasses = '.pass63-mission-pane-drop-target,.pass63-mission-pane-dragging,.pass68-mission-pane-click-swap-source,.pass67-mission-pane-swap-armed';
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:14863`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    const overlayRepairs = pass78ClearStaleMissionPaneMoveState(reason);
    pass72ApplyMissionPanePixelLayoutNow();
    pass74ValidateMissionPaneSurfaces();
    pass76RefreshMissionPaneDirectMoveControls('doctor');
    pass77ForceMissionPaneViewportFit(reason);
    pass77RefreshMissionPaneCommandDock('doctor');
    setStatus('Mission View Doctor complete', overlayRepairs ? 'Cleared stale pane move state and repaired bounds.' : 'Bounds, autosize, command dock, and overlays are in sync.');
  };
  window.requestAnimationFrame(run);
  window.setTimeout(run, 120);
  window.setTimeout(run, 360);
}


// PASS72 verifier compatibility: PASS74 writes the same pixel sizing through setProperty(..., 'important') in pass74HardenDirectWebviewSurface:
// runtimeTab.webview.style.width = width + 'px'
// runtimeTab.webview.style.height = height + 'px'
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:14971`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
function pass74ScheduleMissionPaneRelayoutRetries(reason = 'layout'): void {
  const token = ++pass74MissionPaneRelayoutRetryToken;
  const run = () => {
    if (token !== pass74MissionPaneRelayoutRetryToken) return;
    pass72ApplyMissionPanePixelLayoutNow();
    pass74ValidateMissionPaneSurfaces();
    pass76StartMissionPaneRepairLoop(reason);
  };
  window.requestAnimationFrame(run);
  window.setTimeout(run, reason === 'load' ? 80 : 40);
  window.setTimeout(run, reason === 'load' ? 260 : 160);
}

function pass74MountMissionPaneSurfaceSelfHeal(): void {
  if (pass74MissionPaneSurfaceSelfHealMounted) return;
  window.addEventListener('resize', () => pass74ScheduleMissionPaneRelayoutRetries('resize'));
  document.addEventListener('mission-layout-change', () => pass74ScheduleMissionPaneRelayoutRetries('layout'));
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:14978`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
  };
  window.requestAnimationFrame(run);
  window.setTimeout(run, reason === 'load' ? 80 : 40);
  window.setTimeout(run, reason === 'load' ? 260 : 160);
}

function pass74MountMissionPaneSurfaceSelfHeal(): void {
  if (pass74MissionPaneSurfaceSelfHealMounted) return;
  window.addEventListener('resize', () => pass74ScheduleMissionPaneRelayoutRetries('resize'));
  document.addEventListener('mission-layout-change', () => pass74ScheduleMissionPaneRelayoutRetries('layout'));
  stageEl?.addEventListener('transitionend', () => pass74ScheduleMissionPaneRelayoutRetries('transition'));
  pass76MountMissionPaneHealthDoctor();
  pass74MissionPaneSurfaceSelfHealMounted = true;
}



```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:15045`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
  for (const paneId of visiblePanes) {
    const shell = ensureMissionPaneShell(paneId);
    const bounds = pass72PaneBoundsForLayout(layout, paneId, stageWidth, stageHeight);
    if (!bounds) continue;
    const left = pass72Rounded(bounds.left + pad);
    const top = pass72Rounded(bounds.top + pad);
    const width = Math.max(1, pass72Rounded(bounds.width));
    const height = Math.max(1, pass72Rounded(bounds.height));
    shell.style.left = left + 'px';
    shell.style.top = top + 'px';
    shell.style.width = width + 'px';
    shell.style.height = height + 'px';
    shell.style.removeProperty('order');
    const runtimeTab = missionPaneRuntimeTab(paneId);
    if (runtimeTab) {
      // PASS73: direct webview pixel bounds.  The shell overlays the same rectangle, but the
      // webview remains a flat direct child of the stage so Electron does not clip or stale-size
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:15046`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
    const shell = ensureMissionPaneShell(paneId);
    const bounds = pass72PaneBoundsForLayout(layout, paneId, stageWidth, stageHeight);
    if (!bounds) continue;
    const left = pass72Rounded(bounds.left + pad);
    const top = pass72Rounded(bounds.top + pad);
    const width = Math.max(1, pass72Rounded(bounds.width));
    const height = Math.max(1, pass72Rounded(bounds.height));
    shell.style.left = left + 'px';
    shell.style.top = top + 'px';
    shell.style.width = width + 'px';
    shell.style.height = height + 'px';
    shell.style.removeProperty('order');
    const runtimeTab = missionPaneRuntimeTab(paneId);
    if (runtimeTab) {
      // PASS73: direct webview pixel bounds.  The shell overlays the same rectangle, but the
      // webview remains a flat direct child of the stage so Electron does not clip or stale-size
      // the guest page surface inside an intermediate decorated wrapper.
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:15047`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
    const bounds = pass72PaneBoundsForLayout(layout, paneId, stageWidth, stageHeight);
    if (!bounds) continue;
    const left = pass72Rounded(bounds.left + pad);
    const top = pass72Rounded(bounds.top + pad);
    const width = Math.max(1, pass72Rounded(bounds.width));
    const height = Math.max(1, pass72Rounded(bounds.height));
    shell.style.left = left + 'px';
    shell.style.top = top + 'px';
    shell.style.width = width + 'px';
    shell.style.height = height + 'px';
    shell.style.removeProperty('order');
    const runtimeTab = missionPaneRuntimeTab(paneId);
    if (runtimeTab) {
      // PASS73: direct webview pixel bounds.  The shell overlays the same rectangle, but the
      // webview remains a flat direct child of the stage so Electron does not clip or stale-size
      // the guest page surface inside an intermediate decorated wrapper.
      if (runtimeTab.webview.parentElement !== stageEl) stageEl.appendChild(runtimeTab.webview);
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:15048`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
    if (!bounds) continue;
    const left = pass72Rounded(bounds.left + pad);
    const top = pass72Rounded(bounds.top + pad);
    const width = Math.max(1, pass72Rounded(bounds.width));
    const height = Math.max(1, pass72Rounded(bounds.height));
    shell.style.left = left + 'px';
    shell.style.top = top + 'px';
    shell.style.width = width + 'px';
    shell.style.height = height + 'px';
    shell.style.removeProperty('order');
    const runtimeTab = missionPaneRuntimeTab(paneId);
    if (runtimeTab) {
      // PASS73: direct webview pixel bounds.  The shell overlays the same rectangle, but the
      // webview remains a flat direct child of the stage so Electron does not clip or stale-size
      // the guest page surface inside an intermediate decorated wrapper.
      if (runtimeTab.webview.parentElement !== stageEl) stageEl.appendChild(runtimeTab.webview);
      pass74HardenDirectWebviewSurface(runtimeTab.webview, { left, top, width, height });
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:15076`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    }
  });
  pass74ValidateMissionPaneSurfaces();
}

function pass72ScheduleMissionPanePixelLayout(): void {
  if (pass72MissionPanePixelLayoutScheduled) return;
  pass72MissionPanePixelLayoutScheduled = true;
  window.requestAnimationFrame(() => {
    pass72MissionPanePixelLayoutScheduled = false;
    pass72ApplyMissionPanePixelLayoutNow();
    pass74ScheduleMissionPaneRelayoutRetries('layout');
  });
}

function pass72MountMissionPanePixelResizeObserver(): void {
  if (pass72MissionPaneResizeObserverMounted) return;
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:15086`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    pass72ApplyMissionPanePixelLayoutNow();
    pass74ScheduleMissionPaneRelayoutRetries('layout');
  });
}

function pass72MountMissionPanePixelResizeObserver(): void {
  if (pass72MissionPaneResizeObserverMounted) return;
  const relayout = () => pass72ScheduleMissionPanePixelLayout();
  window.addEventListener('resize', relayout);
  window.addEventListener('orientationchange', relayout);
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(relayout);
    observer.observe(stageEl);
  }
  pass72MissionPaneResizeObserverMounted = true;
}

```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:15089`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
}

function pass72MountMissionPanePixelResizeObserver(): void {
  if (pass72MissionPaneResizeObserverMounted) return;
  const relayout = () => pass72ScheduleMissionPanePixelLayout();
  window.addEventListener('resize', relayout);
  window.addEventListener('orientationchange', relayout);
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(relayout);
    observer.observe(stageEl);
  }
  pass72MissionPaneResizeObserverMounted = true;
}

function pass66MountMissionPaneKeyboardShortcuts(): void {
  if (pass66MissionPaneKeyboardMounted) return;

```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:15117`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    pass66FocusMissionPaneByNumber(paneNumber);
  }, true);
  pass66MissionPaneKeyboardMounted = true;
}

function pass64ScheduleMissionPaneRefresh(): void {
  if (pass64MissionPaneRefreshScheduled) return;
  pass64MissionPaneRefreshScheduled = true;
  window.requestAnimationFrame(() => {
    pass64MissionPaneRefreshScheduled = false;
    pass63MountMissionPaneDragReorder();
    pass63MountTriViewUpgradeControls();
    pass63RefreshTriViewUpgradeControls();
    pass63RefreshMissionPaneDragTargets();
    pass72ScheduleMissionPanePixelLayout();
  });
}
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:15150`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
  pass193InitializeBookmarkAdminLaunchReliability();
  pass194InitializeDownloadArtifactShelf();
  pass89MountMissionPaneRestoreFailsafe();
  pass90MountLaunchRecipeFailsafe(); pass254MountMissionRecipeClickContract(); pass255MountRecipePaneHydration(); pass256MountQuadViewStateMachine();
  pass116InstallChromeOverlayArbitration();
  pass118InstallOverlayDismissRecovery();
  pass119To123InstallOverlayGuards();
  if (!pass64MissionPaneObserverMounted && document.body && typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass64ScheduleMissionPaneRefresh());
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-pane-id', 'data-mission-pane-id', 'data-pass63-mission-pane-id'] });
    pass64MissionPaneObserverMounted = true;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', pass64BootMissionPaneReorderHardening, { once: true });
} else {
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:15157`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
  if (!pass64MissionPaneObserverMounted && document.body && typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass64ScheduleMissionPaneRefresh());
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-pane-id', 'data-mission-pane-id', 'data-pass63-mission-pane-id'] });
    pass64MissionPaneObserverMounted = true;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', pass64BootMissionPaneReorderHardening, { once: true });
} else {
  pass64BootMissionPaneReorderHardening();
}

/* PASS252_MISSION_MULTIVIEW_STATE_GUARD_START */
((): void => {
  type LayoutDefinition = { name: string; count: number; tokens: string[] };
  const layoutClassPrefix = 'mission-layout-';
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:15265`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    const activePane = panes.find((pane) => pane.classList.contains('is-active') || pane.classList.contains('active') || pane.getAttribute('data-active') === 'true');
    if (!activePane && panes[0]) {
      panes[0].classList.add('is-active');
      panes[0].setAttribute('data-active', 'true');
    }
  };
  const forceReflow = (host: HTMLElement): void => {
    void host.offsetHeight;
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
      host.dispatchEvent(new Event('pass252-mission-layout-normalized', { bubbles: true }));
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    });
  };
  const repairMissionViews = (): void => {
    repairQueued = false;
    getMissionHosts().forEach((host) => {
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:15268`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
      panes[0].setAttribute('data-active', 'true');
    }
  };
  const forceReflow = (host: HTMLElement): void => {
    void host.offsetHeight;
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
      host.dispatchEvent(new Event('pass252-mission-layout-normalized', { bubbles: true }));
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    });
  };
  const repairMissionViews = (): void => {
    repairQueued = false;
    getMissionHosts().forEach((host) => {
      if (!(host instanceof HTMLElement)) return;
      const layout = resolveLayout(host);
      normalizeHostLayoutClasses(host, layout);
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:15285`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
      clearStaleLockState(host);
      normalizePanes(host, layout);
      forceReflow(host);
    });
  };
  const scheduleMissionViewRepair = (): void => {
    if (repairQueued) return;
    repairQueued = true;
    requestAnimationFrame(repairMissionViews);
  };
  const isMissionLayoutControl = (element: Element | null): boolean => {
    if (!element) return false;
    if (element.closest(hostSelectors)) return true;
    return /mission|pane|layout|view|quad|split|tri|3-up|4-up|2-up|1-up|focus|repair|doctor|fit/.test(toText(element));
  };
  document.addEventListener('click', (event: MouseEvent): void => {
    const target = event.target;
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:15302`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    if (!(target instanceof Element)) return;
    const control = target.closest('button, [role="button"], [data-layout], [data-mission-layout], [data-view], [aria-label], .mission-layout-tabs, .mission-pane-controls, .mission-view-controls');
    if (isMissionLayoutControl(control)) scheduleMissionViewRepair();
  }, true);
  document.addEventListener('keydown', (event: KeyboardEvent): void => {
    const key = String(event.key || '').toLowerCase();
    if ((event.ctrlKey && event.altKey && ['1', '2', '3', '4', 'q', 's', 'f'].includes(key)) || key === 'escape') scheduleMissionViewRepair();
  }, true);
  window.addEventListener('resize', scheduleMissionViewRepair);
  window.addEventListener('orientationchange', scheduleMissionViewRepair);
  window.addEventListener('tahai:mission-layout-change', scheduleMissionViewRepair);
  window.addEventListener('tahai:mission-pane-change', scheduleMissionViewRepair);
  observer = new MutationObserver((mutations: MutationRecord[]): void => {
    for (const mutation of mutations) {
      const target = mutation.target;
      if (!(target instanceof Element)) continue;
      if (target.closest(hostSelectors) || target.matches(hostSelectors)) { scheduleMissionViewRepair(); break; }
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:15306`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
  document.addEventListener('keydown', (event: KeyboardEvent): void => {
    const key = String(event.key || '').toLowerCase();
    if ((event.ctrlKey && event.altKey && ['1', '2', '3', '4', 'q', 's', 'f'].includes(key)) || key === 'escape') scheduleMissionViewRepair();
  }, true);
  window.addEventListener('resize', scheduleMissionViewRepair);
  window.addEventListener('orientationchange', scheduleMissionViewRepair);
  window.addEventListener('tahai:mission-layout-change', scheduleMissionViewRepair);
  window.addEventListener('tahai:mission-pane-change', scheduleMissionViewRepair);
  observer = new MutationObserver((mutations: MutationRecord[]): void => {
    for (const mutation of mutations) {
      const target = mutation.target;
      if (!(target instanceof Element)) continue;
      if (target.closest(hostSelectors) || target.matches(hostSelectors)) { scheduleMissionViewRepair(); break; }
    }
  });
  const startObserver = (): void => {
    if (!document.documentElement || observer === null) return;
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:15318`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
      if (target.closest(hostSelectors) || target.matches(hostSelectors)) { scheduleMissionViewRepair(); break; }
    }
  });
  const startObserver = (): void => {
    if (!document.documentElement || observer === null) return;
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'data-layout', 'data-mission-layout', 'data-active'] });
    scheduleMissionViewRepair();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startObserver, { once: true });
  else startObserver();
})();
/* PASS252_MISSION_MULTIVIEW_STATE_GUARD_END */

/* PASS253_MISSION_PANE_VIEWPORT_GUARD_START */
((): void => {
  type LayoutDefinition = { name: string; count: number; tokens: string[] };
  const hostSelectors = ['[data-mission-control]', '[data-mission-layout]', '.mission-control-shell', '.mission-control-modal', '.mission-modal', '.mission-overlay-panel', '.mission-drawer', '.mission-view-host', '.mission-multiview'].join(',');
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:15404`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    }
    const panes = Array.from(paneHost.querySelectorAll(paneSelectors)).filter((pane) => pane instanceof HTMLElement && !pane.closest('template'));
    const visibleCount = Math.min(Math.max(layout.count, 1), Math.max(panes.length, 1));
    host.setAttribute('data-pass253-visible-pane-count', String(visibleCount));
    panes.forEach((pane, index) => normalizePane(pane, layout.name, index));
    const activePane = panes.find((pane) => pane.classList.contains('is-active') || pane.classList.contains('active') || pane.getAttribute('data-active') === 'true');
    if (!activePane && panes[0] instanceof HTMLElement) { panes[0].classList.add('is-active'); panes[0].setAttribute('data-active', 'true'); }
    void host.offsetHeight;
    requestAnimationFrame(() => { window.dispatchEvent(new Event('resize')); host.dispatchEvent(new Event('pass253-mission-pane-viewport-normalized', { bubbles: true })); requestAnimationFrame(() => window.dispatchEvent(new Event('resize'))); });
  };
  const repair = (): void => { queued = false; missionHosts().forEach(normalizeHost); };
  const schedule = (): void => { if (queued) return; queued = true; requestAnimationFrame(repair); };
  const missionControlIntent = (element: Element | null): boolean => !!element && (element.closest(hostSelectors) !== null || /mission|pane|view|layout|split|tri|quad|focus|1-up|2-up|3-up|4-up|repair|fit|doctor/.test(toText(element)));
  document.addEventListener('click', (event: MouseEvent): void => { const target = event.target; if (!(target instanceof Element)) return; const control = target.closest('button, [role="button"], [data-layout], [data-mission-layout], [data-view], [aria-label], .mission-layout-tabs, .mission-pane-controls, .mission-view-controls'); if (missionControlIntent(control)) schedule(); }, true);
  document.addEventListener('keydown', (event: KeyboardEvent): void => { const key = String(event.key || '').toLowerCase(); if ((event.ctrlKey && event.altKey && ['1', '2', '3', '4', 'q', 's', 'f'].includes(key)) || key === 'escape') schedule(); }, true);
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:15407`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    host.setAttribute('data-pass253-visible-pane-count', String(visibleCount));
    panes.forEach((pane, index) => normalizePane(pane, layout.name, index));
    const activePane = panes.find((pane) => pane.classList.contains('is-active') || pane.classList.contains('active') || pane.getAttribute('data-active') === 'true');
    if (!activePane && panes[0] instanceof HTMLElement) { panes[0].classList.add('is-active'); panes[0].setAttribute('data-active', 'true'); }
    void host.offsetHeight;
    requestAnimationFrame(() => { window.dispatchEvent(new Event('resize')); host.dispatchEvent(new Event('pass253-mission-pane-viewport-normalized', { bubbles: true })); requestAnimationFrame(() => window.dispatchEvent(new Event('resize'))); });
  };
  const repair = (): void => { queued = false; missionHosts().forEach(normalizeHost); };
  const schedule = (): void => { if (queued) return; queued = true; requestAnimationFrame(repair); };
  const missionControlIntent = (element: Element | null): boolean => !!element && (element.closest(hostSelectors) !== null || /mission|pane|view|layout|split|tri|quad|focus|1-up|2-up|3-up|4-up|repair|fit|doctor/.test(toText(element)));
  document.addEventListener('click', (event: MouseEvent): void => { const target = event.target; if (!(target instanceof Element)) return; const control = target.closest('button, [role="button"], [data-layout], [data-mission-layout], [data-view], [aria-label], .mission-layout-tabs, .mission-pane-controls, .mission-view-controls'); if (missionControlIntent(control)) schedule(); }, true);
  document.addEventListener('keydown', (event: KeyboardEvent): void => { const key = String(event.key || '').toLowerCase(); if ((event.ctrlKey && event.altKey && ['1', '2', '3', '4', 'q', 's', 'f'].includes(key)) || key === 'escape') schedule(); }, true);
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  window.addEventListener('tahai:mission-layout-change', schedule);
  window.addEventListener('tahai:mission-pane-change', schedule);
  window.addEventListener('pass252-mission-layout-normalized', schedule);
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:15411`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    void host.offsetHeight;
    requestAnimationFrame(() => { window.dispatchEvent(new Event('resize')); host.dispatchEvent(new Event('pass253-mission-pane-viewport-normalized', { bubbles: true })); requestAnimationFrame(() => window.dispatchEvent(new Event('resize'))); });
  };
  const repair = (): void => { queued = false; missionHosts().forEach(normalizeHost); };
  const schedule = (): void => { if (queued) return; queued = true; requestAnimationFrame(repair); };
  const missionControlIntent = (element: Element | null): boolean => !!element && (element.closest(hostSelectors) !== null || /mission|pane|view|layout|split|tri|quad|focus|1-up|2-up|3-up|4-up|repair|fit|doctor/.test(toText(element)));
  document.addEventListener('click', (event: MouseEvent): void => { const target = event.target; if (!(target instanceof Element)) return; const control = target.closest('button, [role="button"], [data-layout], [data-mission-layout], [data-view], [aria-label], .mission-layout-tabs, .mission-pane-controls, .mission-view-controls'); if (missionControlIntent(control)) schedule(); }, true);
  document.addEventListener('keydown', (event: KeyboardEvent): void => { const key = String(event.key || '').toLowerCase(); if ((event.ctrlKey && event.altKey && ['1', '2', '3', '4', 'q', 's', 'f'].includes(key)) || key === 'escape') schedule(); }, true);
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  window.addEventListener('tahai:mission-layout-change', schedule);
  window.addEventListener('tahai:mission-pane-change', schedule);
  window.addEventListener('pass252-mission-layout-normalized', schedule);
  observer = new MutationObserver((mutations: MutationRecord[]): void => { for (const mutation of mutations) { const target = mutation.target; if (!(target instanceof Element)) continue; if (target.matches(hostSelectors) || target.closest(hostSelectors) || target.matches(paneSelectors) || target.closest(paneSelectors)) { schedule(); break; } } });
  const start = (): void => { if (!document.documentElement || observer === null) return; observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'data-layout', 'data-mission-layout', 'data-active'] }); schedule(); setTimeout(schedule, 60); setTimeout(schedule, 240); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:15416`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
  const missionControlIntent = (element: Element | null): boolean => !!element && (element.closest(hostSelectors) !== null || /mission|pane|view|layout|split|tri|quad|focus|1-up|2-up|3-up|4-up|repair|fit|doctor/.test(toText(element)));
  document.addEventListener('click', (event: MouseEvent): void => { const target = event.target; if (!(target instanceof Element)) return; const control = target.closest('button, [role="button"], [data-layout], [data-mission-layout], [data-view], [aria-label], .mission-layout-tabs, .mission-pane-controls, .mission-view-controls'); if (missionControlIntent(control)) schedule(); }, true);
  document.addEventListener('keydown', (event: KeyboardEvent): void => { const key = String(event.key || '').toLowerCase(); if ((event.ctrlKey && event.altKey && ['1', '2', '3', '4', 'q', 's', 'f'].includes(key)) || key === 'escape') schedule(); }, true);
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  window.addEventListener('tahai:mission-layout-change', schedule);
  window.addEventListener('tahai:mission-pane-change', schedule);
  window.addEventListener('pass252-mission-layout-normalized', schedule);
  observer = new MutationObserver((mutations: MutationRecord[]): void => { for (const mutation of mutations) { const target = mutation.target; if (!(target instanceof Element)) continue; if (target.matches(hostSelectors) || target.closest(hostSelectors) || target.matches(paneSelectors) || target.closest(paneSelectors)) { schedule(); break; } } });
  const start = (): void => { if (!document.documentElement || observer === null) return; observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'data-layout', 'data-mission-layout', 'data-active'] }); schedule(); setTimeout(schedule, 60); setTimeout(schedule, 240); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
/* PASS253_MISSION_PANE_VIEWPORT_GUARD_END */



```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:15418`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
  document.addEventListener('keydown', (event: KeyboardEvent): void => { const key = String(event.key || '').toLowerCase(); if ((event.ctrlKey && event.altKey && ['1', '2', '3', '4', 'q', 's', 'f'].includes(key)) || key === 'escape') schedule(); }, true);
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  window.addEventListener('tahai:mission-layout-change', schedule);
  window.addEventListener('tahai:mission-pane-change', schedule);
  window.addEventListener('pass252-mission-layout-normalized', schedule);
  observer = new MutationObserver((mutations: MutationRecord[]): void => { for (const mutation of mutations) { const target = mutation.target; if (!(target instanceof Element)) continue; if (target.matches(hostSelectors) || target.closest(hostSelectors) || target.matches(paneSelectors) || target.closest(paneSelectors)) { schedule(); break; } } });
  const start = (): void => { if (!document.documentElement || observer === null) return; observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'data-layout', 'data-mission-layout', 'data-active'] }); schedule(); setTimeout(schedule, 60); setTimeout(schedule, 240); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
/* PASS253_MISSION_PANE_VIEWPORT_GUARD_END */



/* PASS341_NORMAL_BROWSER_AND_FEATURE_CLICKABILITY_CLOSEOUT_START */
type Pass341ClickabilityStatus = 'PASS' | 'WARN';
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:15572`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
  stageEl.style.zIndex = '0';
  stageEl.style.isolation = 'isolate';
  stageEl.style.setProperty('-webkit-app-region', 'no-drag', 'important');
  stageEl.dataset.pass341StageContained = reason;
  const activeView = active()?.webview || stageEl.querySelector<HTMLElement>('webview.browser-view.active, webview.active, webview[data-active="true"]');
  if (activeView instanceof HTMLElement && !stageEl.classList.contains('mission-layout')) {
    activeView.style.display = 'block';
    activeView.style.position = 'absolute';
    activeView.style.top = '0';
    activeView.style.left = '0';
    activeView.style.right = 'auto';
    activeView.style.bottom = 'auto';
    activeView.style.width = '100%';
    activeView.style.height = '100%';
    activeView.style.maxWidth = 'none';
    activeView.style.maxHeight = 'none';
    activeView.style.minWidth = '0';
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:15573`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
  stageEl.style.isolation = 'isolate';
  stageEl.style.setProperty('-webkit-app-region', 'no-drag', 'important');
  stageEl.dataset.pass341StageContained = reason;
  const activeView = active()?.webview || stageEl.querySelector<HTMLElement>('webview.browser-view.active, webview.active, webview[data-active="true"]');
  if (activeView instanceof HTMLElement && !stageEl.classList.contains('mission-layout')) {
    activeView.style.display = 'block';
    activeView.style.position = 'absolute';
    activeView.style.top = '0';
    activeView.style.left = '0';
    activeView.style.right = 'auto';
    activeView.style.bottom = 'auto';
    activeView.style.width = '100%';
    activeView.style.height = '100%';
    activeView.style.maxWidth = 'none';
    activeView.style.maxHeight = 'none';
    activeView.style.minWidth = '0';
    activeView.style.minHeight = '0';
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:15574`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
  stageEl.style.setProperty('-webkit-app-region', 'no-drag', 'important');
  stageEl.dataset.pass341StageContained = reason;
  const activeView = active()?.webview || stageEl.querySelector<HTMLElement>('webview.browser-view.active, webview.active, webview[data-active="true"]');
  if (activeView instanceof HTMLElement && !stageEl.classList.contains('mission-layout')) {
    activeView.style.display = 'block';
    activeView.style.position = 'absolute';
    activeView.style.top = '0';
    activeView.style.left = '0';
    activeView.style.right = 'auto';
    activeView.style.bottom = 'auto';
    activeView.style.width = '100%';
    activeView.style.height = '100%';
    activeView.style.maxWidth = 'none';
    activeView.style.maxHeight = 'none';
    activeView.style.minWidth = '0';
    activeView.style.minHeight = '0';
    activeView.style.margin = '0';
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:15575`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
  stageEl.dataset.pass341StageContained = reason;
  const activeView = active()?.webview || stageEl.querySelector<HTMLElement>('webview.browser-view.active, webview.active, webview[data-active="true"]');
  if (activeView instanceof HTMLElement && !stageEl.classList.contains('mission-layout')) {
    activeView.style.display = 'block';
    activeView.style.position = 'absolute';
    activeView.style.top = '0';
    activeView.style.left = '0';
    activeView.style.right = 'auto';
    activeView.style.bottom = 'auto';
    activeView.style.width = '100%';
    activeView.style.height = '100%';
    activeView.style.maxWidth = 'none';
    activeView.style.maxHeight = 'none';
    activeView.style.minWidth = '0';
    activeView.style.minHeight = '0';
    activeView.style.margin = '0';
    activeView.style.transform = 'none';
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:15576`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
  const activeView = active()?.webview || stageEl.querySelector<HTMLElement>('webview.browser-view.active, webview.active, webview[data-active="true"]');
  if (activeView instanceof HTMLElement && !stageEl.classList.contains('mission-layout')) {
    activeView.style.display = 'block';
    activeView.style.position = 'absolute';
    activeView.style.top = '0';
    activeView.style.left = '0';
    activeView.style.right = 'auto';
    activeView.style.bottom = 'auto';
    activeView.style.width = '100%';
    activeView.style.height = '100%';
    activeView.style.maxWidth = 'none';
    activeView.style.maxHeight = 'none';
    activeView.style.minWidth = '0';
    activeView.style.minHeight = '0';
    activeView.style.margin = '0';
    activeView.style.transform = 'none';
    activeView.style.opacity = '1';
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:15577`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
  if (activeView instanceof HTMLElement && !stageEl.classList.contains('mission-layout')) {
    activeView.style.display = 'block';
    activeView.style.position = 'absolute';
    activeView.style.top = '0';
    activeView.style.left = '0';
    activeView.style.right = 'auto';
    activeView.style.bottom = 'auto';
    activeView.style.width = '100%';
    activeView.style.height = '100%';
    activeView.style.maxWidth = 'none';
    activeView.style.maxHeight = 'none';
    activeView.style.minWidth = '0';
    activeView.style.minHeight = '0';
    activeView.style.margin = '0';
    activeView.style.transform = 'none';
    activeView.style.opacity = '1';
    activeView.style.visibility = 'visible';
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:15583`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
    activeView.style.bottom = 'auto';
    activeView.style.width = '100%';
    activeView.style.height = '100%';
    activeView.style.maxWidth = 'none';
    activeView.style.maxHeight = 'none';
    activeView.style.minWidth = '0';
    activeView.style.minHeight = '0';
    activeView.style.margin = '0';
    activeView.style.transform = 'none';
    activeView.style.opacity = '1';
    activeView.style.visibility = 'visible';
    activeView.style.pointerEvents = 'auto';
    activeView.style.zIndex = '1';
    activeView.style.setProperty('-webkit-app-region', 'no-drag', 'important');
    activeView.dataset.pass341StageContainedWebview = reason;
  }
}
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:15706`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
  pass341NormalBrowserAndFeatureClickabilityCloseout('address-submit-before');
  pass191NavigateAddressInput();
  window.setTimeout(() => pass341NormalBrowserAndFeatureClickabilityCloseout('address-submit-after'), 50);
}

function pass341MountNormalBrowserAndFeatureClickabilityCloseout(): void {
  pass341NormalBrowserAndFeatureClickabilityCloseout('mount');
  for (const delay of [120, 350, 900, 1800, 3200] as const) window.setTimeout(() => pass341NormalBrowserAndFeatureClickabilityCloseout('settle-' + delay), delay);
  window.addEventListener('resize', () => pass341ScheduleNormalBrowserAndFeatureClickabilityCloseout('resize'));
  window.addEventListener('focus', () => pass341ScheduleNormalBrowserAndFeatureClickabilityCloseout('focus'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass341ScheduleNormalBrowserAndFeatureClickabilityCloseout('visibility'); });
  document.addEventListener('dragend', () => pass341ScheduleNormalBrowserAndFeatureClickabilityCloseout('dragend'), true);
  document.addEventListener('drop', () => pass341ScheduleNormalBrowserAndFeatureClickabilityCloseout('drop'), true);
  document.addEventListener('keyup', (event) => { if (event.key === 'Escape') pass341ScheduleNormalBrowserAndFeatureClickabilityCloseout('escape'); }, true);
  document.addEventListener('pointerup', () => pass341ScheduleNormalBrowserAndFeatureClickabilityCloseout('pointerup'), true);
  document.addEventListener('mission-layout-change', () => pass341ScheduleNormalBrowserAndFeatureClickabilityCloseout('mission-layout-change'));
  document.addEventListener('click', pass341HandlePrimaryFeatureClick, true);
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:15708`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
  window.setTimeout(() => pass341NormalBrowserAndFeatureClickabilityCloseout('address-submit-after'), 50);
}

function pass341MountNormalBrowserAndFeatureClickabilityCloseout(): void {
  pass341NormalBrowserAndFeatureClickabilityCloseout('mount');
  for (const delay of [120, 350, 900, 1800, 3200] as const) window.setTimeout(() => pass341NormalBrowserAndFeatureClickabilityCloseout('settle-' + delay), delay);
  window.addEventListener('resize', () => pass341ScheduleNormalBrowserAndFeatureClickabilityCloseout('resize'));
  window.addEventListener('focus', () => pass341ScheduleNormalBrowserAndFeatureClickabilityCloseout('focus'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass341ScheduleNormalBrowserAndFeatureClickabilityCloseout('visibility'); });
  document.addEventListener('dragend', () => pass341ScheduleNormalBrowserAndFeatureClickabilityCloseout('dragend'), true);
  document.addEventListener('drop', () => pass341ScheduleNormalBrowserAndFeatureClickabilityCloseout('drop'), true);
  document.addEventListener('keyup', (event) => { if (event.key === 'Escape') pass341ScheduleNormalBrowserAndFeatureClickabilityCloseout('escape'); }, true);
  document.addEventListener('pointerup', () => pass341ScheduleNormalBrowserAndFeatureClickabilityCloseout('pointerup'), true);
  document.addEventListener('mission-layout-change', () => pass341ScheduleNormalBrowserAndFeatureClickabilityCloseout('mission-layout-change'));
  document.addEventListener('click', pass341HandlePrimaryFeatureClick, true);
  document.addEventListener('submit', pass341HandleAddressSubmit, true);
}
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:15718`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
  document.addEventListener('drop', () => pass341ScheduleNormalBrowserAndFeatureClickabilityCloseout('drop'), true);
  document.addEventListener('keyup', (event) => { if (event.key === 'Escape') pass341ScheduleNormalBrowserAndFeatureClickabilityCloseout('escape'); }, true);
  document.addEventListener('pointerup', () => pass341ScheduleNormalBrowserAndFeatureClickabilityCloseout('pointerup'), true);
  document.addEventListener('mission-layout-change', () => pass341ScheduleNormalBrowserAndFeatureClickabilityCloseout('mission-layout-change'));
  document.addEventListener('click', pass341HandlePrimaryFeatureClick, true);
  document.addEventListener('submit', pass341HandleAddressSubmit, true);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pass341MountNormalBrowserAndFeatureClickabilityCloseout, { once: true }); else pass341MountNormalBrowserAndFeatureClickabilityCloseout();
/* PASS341_NORMAL_BROWSER_AND_FEATURE_CLICKABILITY_CLOSEOUT_END */

/* PASS271_R4_NORMAL_WEBVIEW_HARD_REPAIR_START */
type Pass271R4NormalWebviewReport = {
  pass: 'PASS271-R4';
  status: 'PASS' | 'WARN';
  reason: string;
  normalBrowsing: boolean;
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/app.ts:15839`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
  view.style.width = '100%';
  view.style.height = '100%';
  view.style.minWidth = '0';
  view.style.minHeight = '0';
  view.style.opacity = '1';
  view.style.visibility = 'visible';
  view.style.pointerEvents = 'auto';
  view.style.zIndex = '10';
  view.style.transform = 'none';
  view.style.background = '#ffffff';
  view.setAttribute('data-pass271-r4-active-webview', 'true');
  if (activeUrl && !view.getAttribute('src')) view.setAttribute('src', activeUrl);
}

function pass271R4RepairNormalWebview(reason = 'manual'): Pass271R4NormalWebviewReport {
  if (!pass271R4NormalWebviewRepairEnabled()) {
    pass271R4ClearDisabledMarkers();
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:15939`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
  if (!pass271R4NormalWebviewRepairEnabled()) {
    pass271R4ClearDisabledMarkers();
    console.info('[PASS338] PASS271_R4 normal-webview hard repair is opt-in; set TAHAI_BROWSER_ENABLE_PASS271_R4_NORMAL_WEBVIEW_REPAIR=1 to re-enable.');
    return;
  }
  if (pass271R4Mounted) return;
  pass271R4Mounted = true;
  document.body.dataset.pass271R4NormalWebviewHardRepairMounted = 'true';
  window.addEventListener('resize', () => pass271R4Schedule('resize'));
  window.addEventListener('focus', () => pass271R4Schedule('focus'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass271R4Schedule('visibility'); });
  document.addEventListener('dragend', () => pass271R4Schedule('dragend'), true);
  document.addEventListener('drop', () => pass271R4Schedule('drop'), true);
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass271R4Schedule('mutation'));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class','style','hidden','aria-hidden','data-pass271-r3-neutralized','data-pass271-r4-hidden-as-idle-overlay'] });
  }
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:15941`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    console.info('[PASS338] PASS271_R4 normal-webview hard repair is opt-in; set TAHAI_BROWSER_ENABLE_PASS271_R4_NORMAL_WEBVIEW_REPAIR=1 to re-enable.');
    return;
  }
  if (pass271R4Mounted) return;
  pass271R4Mounted = true;
  document.body.dataset.pass271R4NormalWebviewHardRepairMounted = 'true';
  window.addEventListener('resize', () => pass271R4Schedule('resize'));
  window.addEventListener('focus', () => pass271R4Schedule('focus'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass271R4Schedule('visibility'); });
  document.addEventListener('dragend', () => pass271R4Schedule('dragend'), true);
  document.addEventListener('drop', () => pass271R4Schedule('drop'), true);
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass271R4Schedule('mutation'));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class','style','hidden','aria-hidden','data-pass271-r3-neutralized','data-pass271-r4-hidden-as-idle-overlay'] });
  }
  pass271R4RepairNormalWebview('mount');
  window.setTimeout(() => pass271R4RepairNormalWebview('settle-250'), 250);
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:15945`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
  pass271R4Mounted = true;
  document.body.dataset.pass271R4NormalWebviewHardRepairMounted = 'true';
  window.addEventListener('resize', () => pass271R4Schedule('resize'));
  window.addEventListener('focus', () => pass271R4Schedule('focus'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass271R4Schedule('visibility'); });
  document.addEventListener('dragend', () => pass271R4Schedule('dragend'), true);
  document.addEventListener('drop', () => pass271R4Schedule('drop'), true);
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass271R4Schedule('mutation'));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class','style','hidden','aria-hidden','data-pass271-r3-neutralized','data-pass271-r4-hidden-as-idle-overlay'] });
  }
  pass271R4RepairNormalWebview('mount');
  window.setTimeout(() => pass271R4RepairNormalWebview('settle-250'), 250);
  window.setTimeout(() => pass271R4RepairNormalWebview('settle-1000'), 1000);
  window.setInterval(() => pass271R4RepairNormalWebview('watchdog'), 2500);
}

```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:15951`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
  document.addEventListener('drop', () => pass271R4Schedule('drop'), true);
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass271R4Schedule('mutation'));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class','style','hidden','aria-hidden','data-pass271-r3-neutralized','data-pass271-r4-hidden-as-idle-overlay'] });
  }
  pass271R4RepairNormalWebview('mount');
  window.setTimeout(() => pass271R4RepairNormalWebview('settle-250'), 250);
  window.setTimeout(() => pass271R4RepairNormalWebview('settle-1000'), 1000);
  window.setInterval(() => pass271R4RepairNormalWebview('watchdog'), 2500);
}

if (pass271R4NormalWebviewRepairEnabled()) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pass271R4Mount, { once: true }); else pass271R4Mount();
} else {
  pass271R4ClearDisabledMarkers();
  console.info('[PASS338] PASS271_R4 normal-webview hard repair stayed disabled by default.');
}
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/app.ts:15955`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
  }
  pass271R4RepairNormalWebview('mount');
  window.setTimeout(() => pass271R4RepairNormalWebview('settle-250'), 250);
  window.setTimeout(() => pass271R4RepairNormalWebview('settle-1000'), 1000);
  window.setInterval(() => pass271R4RepairNormalWebview('watchdog'), 2500);
}

if (pass271R4NormalWebviewRepairEnabled()) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pass271R4Mount, { once: true }); else pass271R4Mount();
} else {
  pass271R4ClearDisabledMarkers();
  console.info('[PASS338] PASS271_R4 normal-webview hard repair stayed disabled by default.');
}
/* PASS271_R4_NORMAL_WEBVIEW_HARD_REPAIR_END */

```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/chromium-bookmarks.ts:945`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text

    bar.append(left, strip, right);
    const stage = byId<HTMLElement>('webview-stage');
    stage?.insertAdjacentElement('beforebegin', bar);
    barEl = bar;
    barStripEl = strip;
    barLeftButton = left;
    barRightButton = right;
    window.addEventListener('resize', () => window.setTimeout(updateBookmarkRailArrows, 60));
  }

  function scrollBookmarkRail(direction: -1 | 1): void {
    if (!barStripEl) return;
    const distance = Math.max(180, Math.floor(barStripEl.clientWidth * 0.72));
    barStripEl.scrollBy({ left: distance * direction, behavior: 'smooth' });
    window.setTimeout(updateBookmarkRailArrows, 220);
  }
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/operator-command-center-v2.ts:131`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
  guardrail.textContent = 'Browser-side only · IT Docs/PSA writeback requires authorized server-side contracts.';

  panel.append(header, summary, filters, details, guardrail);
}

export function installOperatorCommandCenterV2(getMission: () => MissionState | undefined): { refresh: () => void } {
  const refresh = () => renderPanel(buildOperatorCommandCenterV2Report(getMission()));

  window.addEventListener('DOMContentLoaded', () => {
    refresh();
    const dialog = document.getElementById('command-palette-dialog');
    if (dialog) new MutationObserver(refresh).observe(dialog, { attributes: true, attributeFilter: ['open'] });
    const missionDialog = document.getElementById('mission-dialog');
    if (missionDialog) new MutationObserver(refresh).observe(missionDialog, { childList: true, subtree: true, attributes: true });
  });

  window.addEventListener('tahai-renderer-ready', refresh);
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/operator-command-center-v2.ts:134`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
}

export function installOperatorCommandCenterV2(getMission: () => MissionState | undefined): { refresh: () => void } {
  const refresh = () => renderPanel(buildOperatorCommandCenterV2Report(getMission()));

  window.addEventListener('DOMContentLoaded', () => {
    refresh();
    const dialog = document.getElementById('command-palette-dialog');
    if (dialog) new MutationObserver(refresh).observe(dialog, { attributes: true, attributeFilter: ['open'] });
    const missionDialog = document.getElementById('mission-dialog');
    if (missionDialog) new MutationObserver(refresh).observe(missionDialog, { childList: true, subtree: true, attributes: true });
  });

  window.addEventListener('tahai-renderer-ready', refresh);
  window.setInterval(refresh, 2600);
  refresh();
  return { refresh };
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/operator-command-center-v2.ts:136`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
export function installOperatorCommandCenterV2(getMission: () => MissionState | undefined): { refresh: () => void } {
  const refresh = () => renderPanel(buildOperatorCommandCenterV2Report(getMission()));

  window.addEventListener('DOMContentLoaded', () => {
    refresh();
    const dialog = document.getElementById('command-palette-dialog');
    if (dialog) new MutationObserver(refresh).observe(dialog, { attributes: true, attributeFilter: ['open'] });
    const missionDialog = document.getElementById('mission-dialog');
    if (missionDialog) new MutationObserver(refresh).observe(missionDialog, { childList: true, subtree: true, attributes: true });
  });

  window.addEventListener('tahai-renderer-ready', refresh);
  window.setInterval(refresh, 2600);
  refresh();
  return { refresh };
}

```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/pass332-webview-navigation-owner-truth.ts:533`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
  const hasCritical = findings.some((finding) => finding.severity === "critical" && !finding.recovered);
  const hasWarn = findings.some((finding) => finding.severity === "warn") || findings.some((finding) => finding.recovered);
  document.documentElement.dataset.pass332NavigationHealth = hasCritical ? "critical" : hasWarn ? "warn" : "ok";
  return sample;
}

function scheduleReconcile(reason: string): void {
  if (pass332Raf) cancelAnimationFrame(pass332Raf);
  pass332Raf = requestAnimationFrame(() => {
    pass332Raf = 0;
    reconcile(reason);
    window.setTimeout(() => reconcile(`${reason}:settled`), 180);
  });
}

function bindWebviewEvents(): void {
  const webviews = Array.from(document.querySelectorAll("webview"));
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/pass332-webview-navigation-owner-truth.ts:564`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    for (const event of events) {
      webview.addEventListener(event, () => scheduleReconcile(`webview:${event}`));
    }
  }
}

function installObservers(): void {
  if (pass332MutationObserver) return;
  pass332MutationObserver = new MutationObserver((mutations) => {
    let relevant = false;
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node instanceof Element && (node.tagName.toLowerCase() === "webview" || !!node.querySelector("webview"))) relevant = true;
        }
      }
      if (mutation.type === "attributes" && mutation.target instanceof Element) {
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/pass332-webview-navigation-owner-truth.ts:587`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    if (relevant) scheduleReconcile("mutation");
  });
  pass332MutationObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "class", "style", "data-active", "data-url", "data-current-url", "data-requested-url", "aria-hidden", "aria-selected"],
  });
  window.addEventListener("resize", () => scheduleReconcile("resize"), { passive: true });
  document.addEventListener("visibilitychange", () => scheduleReconcile("visibilitychange"), { passive: true });
  document.addEventListener("focusin", () => scheduleReconcile("focusin"), { passive: true });
  document.addEventListener("change", () => scheduleReconcile("input-change"), { passive: true });
  document.addEventListener("input", () => scheduleReconcile("input"), { passive: true });
}

function installPass332(): void {
  if (window.__TAHAI_PASS332_NAV_OWNER__) return;
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/pass332-webview-navigation-owner-truth.ts:588`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
  });
  pass332MutationObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "class", "style", "data-active", "data-url", "data-current-url", "data-requested-url", "aria-hidden", "aria-selected"],
  });
  window.addEventListener("resize", () => scheduleReconcile("resize"), { passive: true });
  document.addEventListener("visibilitychange", () => scheduleReconcile("visibilitychange"), { passive: true });
  document.addEventListener("focusin", () => scheduleReconcile("focusin"), { passive: true });
  document.addEventListener("change", () => scheduleReconcile("input-change"), { passive: true });
  document.addEventListener("input", () => scheduleReconcile("input"), { passive: true });
}

function installPass332(): void {
  if (window.__TAHAI_PASS332_NAV_OWNER__) return;
  window.__TAHAI_PASS332_NAV_OWNER__ = {
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/pass332-webview-navigation-owner-truth.ts:626`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
  bindWebviewEvents();
  scheduleReconcile("install");
  window.setTimeout(() => scheduleReconcile("startup-500ms"), 500);
  window.setTimeout(() => scheduleReconcile("startup-1500ms"), 1500);
  window.setTimeout(() => scheduleReconcile("startup-3000ms"), 3000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", installPass332, { once: true });
} else {
  installPass332();
}

export {};
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/pass333-chrome-hit-test-webview-layer-truth.ts:242`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
}

function install(): void {
  if (window.__TAHAI_PASS333_CHROME_HITTEST__) return;
  window.__TAHAI_PASS333_CHROME_HITTEST__ = { samples: [], sample };
  document.documentElement.dataset.pass333ChromeHitTestHealth = "pending";
  schedule("install", 120);
  schedule("install-settled", 900);
  window.addEventListener("resize", () => schedule("resize", 120), { passive: true });
  window.addEventListener("load", () => schedule("window-load", 160), { passive: true });
  document.addEventListener("visibilitychange", () => schedule("visibilitychange", 160), { passive: true });
  document.addEventListener("DOMContentLoaded", () => schedule("dom-content-loaded", 160), { passive: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", install, { once: true });
} else {
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/pass333-chrome-hit-test-webview-layer-truth.ts:243`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text

function install(): void {
  if (window.__TAHAI_PASS333_CHROME_HITTEST__) return;
  window.__TAHAI_PASS333_CHROME_HITTEST__ = { samples: [], sample };
  document.documentElement.dataset.pass333ChromeHitTestHealth = "pending";
  schedule("install", 120);
  schedule("install-settled", 900);
  window.addEventListener("resize", () => schedule("resize", 120), { passive: true });
  window.addEventListener("load", () => schedule("window-load", 160), { passive: true });
  document.addEventListener("visibilitychange", () => schedule("visibilitychange", 160), { passive: true });
  document.addEventListener("DOMContentLoaded", () => schedule("dom-content-loaded", 160), { passive: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", install, { once: true });
} else {
  install();
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/pass333-chrome-hit-test-webview-layer-truth.ts:244`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
function install(): void {
  if (window.__TAHAI_PASS333_CHROME_HITTEST__) return;
  window.__TAHAI_PASS333_CHROME_HITTEST__ = { samples: [], sample };
  document.documentElement.dataset.pass333ChromeHitTestHealth = "pending";
  schedule("install", 120);
  schedule("install-settled", 900);
  window.addEventListener("resize", () => schedule("resize", 120), { passive: true });
  window.addEventListener("load", () => schedule("window-load", 160), { passive: true });
  document.addEventListener("visibilitychange", () => schedule("visibilitychange", 160), { passive: true });
  document.addEventListener("DOMContentLoaded", () => schedule("dom-content-loaded", 160), { passive: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", install, { once: true });
} else {
  install();
}
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/pass333-chrome-hit-test-webview-layer-truth.ts:245`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
  if (window.__TAHAI_PASS333_CHROME_HITTEST__) return;
  window.__TAHAI_PASS333_CHROME_HITTEST__ = { samples: [], sample };
  document.documentElement.dataset.pass333ChromeHitTestHealth = "pending";
  schedule("install", 120);
  schedule("install-settled", 900);
  window.addEventListener("resize", () => schedule("resize", 120), { passive: true });
  window.addEventListener("load", () => schedule("window-load", 160), { passive: true });
  document.addEventListener("visibilitychange", () => schedule("visibilitychange", 160), { passive: true });
  document.addEventListener("DOMContentLoaded", () => schedule("dom-content-loaded", 160), { passive: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", install, { once: true });
} else {
  install();
}

```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/pass333-chrome-hit-test-webview-layer-truth.ts:249`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
  schedule("install-settled", 900);
  window.addEventListener("resize", () => schedule("resize", 120), { passive: true });
  window.addEventListener("load", () => schedule("window-load", 160), { passive: true });
  document.addEventListener("visibilitychange", () => schedule("visibilitychange", 160), { passive: true });
  document.addEventListener("DOMContentLoaded", () => schedule("dom-content-loaded", 160), { passive: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", install, { once: true });
} else {
  install();
}

export {};

```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/pass336-chrome-partitioned-webview-hard-reset.ts:271`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
  return wide && tall && (startsTooHigh || forcedViewport || computed.position === "fixed");
}

function partitionWebview(webview: HTMLElement, chromeBottom: number, actions: string[], index: number): void {
  const top = Math.max(32, chromeBottom);
  webview.setAttribute(PARTITION_ATTR, "true");
  webview.dataset.pass336ChromePartitionTop = String(top);
  webview.style.position = "fixed";
  webview.style.top = `${top}px`;
  webview.style.left = "0";
  webview.style.right = "0";
  webview.style.bottom = "0";
  webview.style.width = "100vw";
  webview.style.height = `calc(100vh - ${top}px)`;
  webview.style.maxWidth = "100vw";
  webview.style.maxHeight = `calc(100vh - ${top}px)`;
  webview.style.minWidth = "0";
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/pass336-chrome-partitioned-webview-hard-reset.ts:272`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
}

function partitionWebview(webview: HTMLElement, chromeBottom: number, actions: string[], index: number): void {
  const top = Math.max(32, chromeBottom);
  webview.setAttribute(PARTITION_ATTR, "true");
  webview.dataset.pass336ChromePartitionTop = String(top);
  webview.style.position = "fixed";
  webview.style.top = `${top}px`;
  webview.style.left = "0";
  webview.style.right = "0";
  webview.style.bottom = "0";
  webview.style.width = "100vw";
  webview.style.height = `calc(100vh - ${top}px)`;
  webview.style.maxWidth = "100vw";
  webview.style.maxHeight = `calc(100vh - ${top}px)`;
  webview.style.minWidth = "0";
  webview.style.minHeight = "0";
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/pass336-chrome-partitioned-webview-hard-reset.ts:273`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text

function partitionWebview(webview: HTMLElement, chromeBottom: number, actions: string[], index: number): void {
  const top = Math.max(32, chromeBottom);
  webview.setAttribute(PARTITION_ATTR, "true");
  webview.dataset.pass336ChromePartitionTop = String(top);
  webview.style.position = "fixed";
  webview.style.top = `${top}px`;
  webview.style.left = "0";
  webview.style.right = "0";
  webview.style.bottom = "0";
  webview.style.width = "100vw";
  webview.style.height = `calc(100vh - ${top}px)`;
  webview.style.maxWidth = "100vw";
  webview.style.maxHeight = `calc(100vh - ${top}px)`;
  webview.style.minWidth = "0";
  webview.style.minHeight = "0";
  webview.style.transform = "none";
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/pass336-chrome-partitioned-webview-hard-reset.ts:274`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
function partitionWebview(webview: HTMLElement, chromeBottom: number, actions: string[], index: number): void {
  const top = Math.max(32, chromeBottom);
  webview.setAttribute(PARTITION_ATTR, "true");
  webview.dataset.pass336ChromePartitionTop = String(top);
  webview.style.position = "fixed";
  webview.style.top = `${top}px`;
  webview.style.left = "0";
  webview.style.right = "0";
  webview.style.bottom = "0";
  webview.style.width = "100vw";
  webview.style.height = `calc(100vh - ${top}px)`;
  webview.style.maxWidth = "100vw";
  webview.style.maxHeight = `calc(100vh - ${top}px)`;
  webview.style.minWidth = "0";
  webview.style.minHeight = "0";
  webview.style.transform = "none";
  webview.style.margin = "0";
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/pass336-chrome-partitioned-webview-hard-reset.ts:275`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
  const top = Math.max(32, chromeBottom);
  webview.setAttribute(PARTITION_ATTR, "true");
  webview.dataset.pass336ChromePartitionTop = String(top);
  webview.style.position = "fixed";
  webview.style.top = `${top}px`;
  webview.style.left = "0";
  webview.style.right = "0";
  webview.style.bottom = "0";
  webview.style.width = "100vw";
  webview.style.height = `calc(100vh - ${top}px)`;
  webview.style.maxWidth = "100vw";
  webview.style.maxHeight = `calc(100vh - ${top}px)`;
  webview.style.minWidth = "0";
  webview.style.minHeight = "0";
  webview.style.transform = "none";
  webview.style.margin = "0";
  webview.style.zIndex = "1";
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/pass336-chrome-partitioned-webview-hard-reset.ts:276`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
  webview.setAttribute(PARTITION_ATTR, "true");
  webview.dataset.pass336ChromePartitionTop = String(top);
  webview.style.position = "fixed";
  webview.style.top = `${top}px`;
  webview.style.left = "0";
  webview.style.right = "0";
  webview.style.bottom = "0";
  webview.style.width = "100vw";
  webview.style.height = `calc(100vh - ${top}px)`;
  webview.style.maxWidth = "100vw";
  webview.style.maxHeight = `calc(100vh - ${top}px)`;
  webview.style.minWidth = "0";
  webview.style.minHeight = "0";
  webview.style.transform = "none";
  webview.style.margin = "0";
  webview.style.zIndex = "1";
  webview.style.pointerEvents = "auto";
```

### CRITICAL — post-pass328-inline-geometry-owner — RELEASE BLOCKING

File: `src/renderer/pass336-chrome-partitioned-webview-hard-reset.ts:281`

Why: An active inline geometry writer remains after PASS328.

Action: Move geometry to source CSS/layout or gate as a legacy rollback path.

```text
  webview.style.right = "0";
  webview.style.bottom = "0";
  webview.style.width = "100vw";
  webview.style.height = `calc(100vh - ${top}px)`;
  webview.style.maxWidth = "100vw";
  webview.style.maxHeight = `calc(100vh - ${top}px)`;
  webview.style.minWidth = "0";
  webview.style.minHeight = "0";
  webview.style.transform = "none";
  webview.style.margin = "0";
  webview.style.zIndex = "1";
  webview.style.pointerEvents = "auto";
  webview.style.display = "flex";
  webview.style.visibility = "visible";
  actions.push(`partitioned-webview-${index}-below-chrome-${top}`);
}

```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/pass336-chrome-partitioned-webview-hard-reset.ts:433`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text

  const boot = () => {
    reconcile("install");
    window.setTimeout(() => reconcile("install+250ms"), 250);
    window.setTimeout(() => reconcile("install+1000ms"), 1000);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener("resize", () => schedule("resize"), { passive: true });
  window.addEventListener("focus", () => schedule("focus"), { passive: true });
  document.addEventListener("visibilitychange", () => schedule("visibilitychange"), { passive: true });
  document.addEventListener("pointerdown", () => schedule("pointerdown"), true);
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/pass336-chrome-partitioned-webview-hard-reset.ts:438`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener("resize", () => schedule("resize"), { passive: true });
  window.addEventListener("focus", () => schedule("focus"), { passive: true });
  document.addEventListener("visibilitychange", () => schedule("visibilitychange"), { passive: true });
  document.addEventListener("pointerdown", () => schedule("pointerdown"), true);
  document.addEventListener("click", () => schedule("click"), true);

  const observer = new MutationObserver(() => schedule("mutation"));
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "src", "hidden", "inert"] });
}
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/pass336-chrome-partitioned-webview-hard-reset.ts:440`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener("resize", () => schedule("resize"), { passive: true });
  window.addEventListener("focus", () => schedule("focus"), { passive: true });
  document.addEventListener("visibilitychange", () => schedule("visibilitychange"), { passive: true });
  document.addEventListener("pointerdown", () => schedule("pointerdown"), true);
  document.addEventListener("click", () => schedule("click"), true);

  const observer = new MutationObserver(() => schedule("mutation"));
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "src", "hidden", "inert"] });
}

install();
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/pass336-chrome-partitioned-webview-hard-reset.ts:444`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
  }

  window.addEventListener("resize", () => schedule("resize"), { passive: true });
  window.addEventListener("focus", () => schedule("focus"), { passive: true });
  document.addEventListener("visibilitychange", () => schedule("visibilitychange"), { passive: true });
  document.addEventListener("pointerdown", () => schedule("pointerdown"), true);
  document.addEventListener("click", () => schedule("click"), true);

  const observer = new MutationObserver(() => schedule("mutation"));
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "src", "hidden", "inert"] });
}

install();

export {};

```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/responsive-toolbar.ts:208`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
      const related = event.relatedTarget instanceof Node ? event.relatedTarget : null;
      if (related && source.contains(related)) return;
      pass174HideUtilityTooltip(source);
    });
    document.addEventListener('focusin', (event) => { const source = pass174TooltipCandidate(event.target); if (source) pass174ShowUtilityTooltip(source); });
    document.addEventListener('focusout', (event) => { const source = pass174TooltipCandidate(event.target); if (source) pass174HideUtilityTooltip(source); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') pass174HideUtilityTooltip(); });
    document.addEventListener('click', (event) => { if (pass174TooltipCandidate(event.target)) pass174HideUtilityTooltip(); }, true);
    window.addEventListener('resize', () => pass174HideUtilityTooltip());
    window.addEventListener('scroll', () => pass174HideUtilityTooltip(), true);
  }
  function pass174MenuFocusableItems(): HTMLElement[] {
    if (!menuEl) return [];
    return Array.from(menuEl.querySelectorAll<HTMLElement>(PASS117_FOCUSABLE_SELECTOR)).filter((element) => {
      if (element.hidden || element.getAttribute('aria-hidden') === 'true') return false;
      if (element instanceof HTMLButtonElement && element.disabled) return false;
      return Boolean(element.getClientRects().length);
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/responsive-toolbar.ts:334`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    if (document.body.dataset.pass178ViewportBudgetObserver === 'true') return;
    document.body.dataset.pass178ViewportBudgetObserver = 'true';
    document.body.dataset.pass178EnterpriseButtonGeometry = 'true';
    document.body.dataset.pass180PrimaryChromeCompactRecovery = 'true';
    document.body.dataset.pass179MoreToolsOverflowClarity = 'true';
    document.body.dataset.pass181CompactPrimaryUxClarity = 'true';
    document.body.dataset.pass182CompactHitTargetFocus = 'true';
    if (typeof ResizeObserver !== 'undefined') {
      pass178ViewportBudgetObserver = new ResizeObserver(() => pass178ScheduleViewportBudgetAudit('resize-observer', 60));
      for (const node of pass178ViewportBudgetNodes()) pass178ViewportBudgetObserver.observe(node);
    } else {
      document.body.dataset.pass178ViewportBudgetObserverFallback = 'window-resize-only';
    }
    pass178ViewportMutationObserver = new MutationObserver(() => {
      for (const node of pass178ViewportBudgetNodes()) pass178ViewportBudgetObserver?.observe(node);
      pass178ScheduleViewportBudgetAudit('chrome-mutation', 80);
    });
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/responsive-toolbar.ts:339`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    document.body.dataset.pass181CompactPrimaryUxClarity = 'true';
    document.body.dataset.pass182CompactHitTargetFocus = 'true';
    if (typeof ResizeObserver !== 'undefined') {
      pass178ViewportBudgetObserver = new ResizeObserver(() => pass178ScheduleViewportBudgetAudit('resize-observer', 60));
      for (const node of pass178ViewportBudgetNodes()) pass178ViewportBudgetObserver.observe(node);
    } else {
      document.body.dataset.pass178ViewportBudgetObserverFallback = 'window-resize-only';
    }
    pass178ViewportMutationObserver = new MutationObserver(() => {
      for (const node of pass178ViewportBudgetNodes()) pass178ViewportBudgetObserver?.observe(node);
      pass178ScheduleViewportBudgetAudit('chrome-mutation', 80);
    });
    pass178ViewportMutationObserver.observe(document.body, { attributes: true, childList: true, subtree: false, attributeFilter: ['class', 'style', 'hidden', 'data-command-toolbar'] });
    const appShell = document.querySelector<HTMLElement>('.app-shell');
    if (appShell) pass178ViewportMutationObserver.observe(appShell, { childList: true, subtree: false });
    document.addEventListener(PASS122_CHROME_STACK_REFLOW_EVENT, () => pass178ScheduleViewportBudgetAudit('chrome-stack-reflow', 120));
    for (const delay of PASS178_VIEWPORT_BUDGET_AUDIT_DELAYS_MS) window.setTimeout(() => pass178AuditViewportBudget(`startup-${delay}`), delay);
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/responsive-toolbar.ts:508`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    pass183OverlayCollisionTimer = window.setTimeout(() => pass183AuditMoreToolsOverlayCollision(reason), delay);
  }

  function pass183InstallMoreToolsOverlayCollisionRecovery(): void {
    if (document.body.dataset.pass183MoreToolsOverlayCollisionController === 'ready') return;
    document.body.dataset.pass183MoreToolsOverlayCollisionController = 'ready';
    document.body.dataset.pass183MoreToolsOverlayCollisionRecovery = 'true';
    document.body.dataset.pass184HiddenMoreToolsFocusRecovery = 'true';
    pass183OverlayCollisionObserver = new MutationObserver((records) => {
      const relevant = records.some((record) => {
        const target = record.target instanceof HTMLElement ? record.target : null;
        return Boolean(target && (target.matches('dialog, .tool-menu-panel') || target.closest('dialog, .tool-menu-panel')));
      });
      if (relevant) pass183ScheduleMoreToolsOverlayCollisionAudit('surface-mutation', 20);
    });
    pass183OverlayCollisionObserver.observe(document.body, {
      subtree: true,
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/responsive-toolbar.ts:990`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
      setStatus(`${target} secondary browser controls are available in More Tools`);
    }
  }
  function scheduleRelayout(delay = 80): void { window.clearTimeout(resizeTimer); resizeTimer = window.setTimeout(relayout, delay); }
  function watchDynamicChromeControls(): void {
    if (mutationObserver) return;
    const toolbar = document.querySelector<HTMLElement>('.toolbar');
    if (!toolbar) return;
    mutationObserver = new MutationObserver(() => scheduleRelayout(80));
    mutationObserver.observe(toolbar, { childList: true, subtree: false });
  }
  function init(): void {
    if (document.body.dataset.responsiveToolbarReady === '1') return;
    document.body.dataset.responsiveToolbarReady = '1';
    document.body.dataset.pass113AdaptiveChromeDensity = 'true';
    document.body.dataset.pass114ChromeStackGuard = 'true';
    document.body.dataset.pass115OverflowVisibilityGuard = 'true';
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/responsive-toolbar.ts:1033`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    document.body.dataset.pass181CompactPrimaryUxClarity = 'true';
    document.body.dataset.pass182CompactHitTargetFocus = 'true';
    document.body.dataset.pass183MoreToolsOverlayCollisionRecovery = 'true';
    document.body.dataset.pass184HiddenMoreToolsFocusRecovery = 'true';
    pass174InstallUtilityTooltipController();
    pass116InstallOverlayArbitration();
    pass118InstallDismissRecovery();
    ensureShell(); pass181PreparePrimaryCompactControls(); pass182InstallCompactPrimaryFocusController(); pass183InstallMoreToolsOverlayCollisionRecovery(); pass184InstallHiddenMoreToolsFocusRecovery(); watchDynamicChromeControls(); pass178InstallViewportBudgetObserver(); relayout();
    window.addEventListener('resize', () => { scheduleRelayout(80); pass178ScheduleViewportBudgetAudit('window-resize', 140); });
    for (const delay of PASS113_RELAYOUT_DELAYS_MS) window.setTimeout(relayout, delay);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();

```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/responsive-toolbar.ts:1036`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    document.body.dataset.pass184HiddenMoreToolsFocusRecovery = 'true';
    pass174InstallUtilityTooltipController();
    pass116InstallOverlayArbitration();
    pass118InstallDismissRecovery();
    ensureShell(); pass181PreparePrimaryCompactControls(); pass182InstallCompactPrimaryFocusController(); pass183InstallMoreToolsOverlayCollisionRecovery(); pass184InstallHiddenMoreToolsFocusRecovery(); watchDynamicChromeControls(); pass178InstallViewportBudgetObserver(); relayout();
    window.addEventListener('resize', () => { scheduleRelayout(80); pass178ScheduleViewportBudgetAudit('window-resize', 140); });
    for (const delay of PASS113_RELAYOUT_DELAYS_MS) window.setTimeout(relayout, delay);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();

```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/site-view-mission-rail.ts:1066`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
      event.preventDefault();
      setRailOpen(false, true, true);
    }
  }

  function installObservers(): void {
    const tabsEl = byId<HTMLElement>('tabs');
    const stageEl = byId<HTMLElement>('webview-stage');
    const observer = new MutationObserver(() => scheduleRender(90));
    if (tabsEl) observer.observe(tabsEl, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'title'] });
    if (stageEl) observer.observe(stageEl, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'src'] });

    document.addEventListener('keydown', (event) => {
      const key = event.key.toLowerCase();
      if (event.ctrlKey && event.altKey && event.shiftKey && key === 'v') {
        event.preventDefault();
        refreshAllThumbnails(true);
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/site-view-mission-rail.ts:1119`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    applyRailPresentationState();
    const shouldOpen = localStorage.getItem(RAIL_STORAGE_KEY) === '1';
    document.body.dataset.pass117SiteViewFocusRecovery = 'true';
    document.body.dataset.pass169DelayedOverlayFocusGuard = 'true';
    document.body.dataset.pass170RestoreFocusTargetGuard = 'true';
    document.body.dataset.pass171OverlayFocusEpochGuard = 'true';
    setRailOpen(shouldOpen, false, false);
    scheduleRender(0);
    window.setInterval(() => {
      if (!isRailOpen()) return;
      const active = collectSnapshots().find((snapshot) => snapshot.active);
      if (active) requestThumbnailCapture(active.webview, false);
    }, CAPTURE_MIN_AGE_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSiteViewMissionRail, { once: true });
```

### WARN — active-viewport-lifecycle-owner-review

File: `src/renderer/site-view-mission-rail.ts:1127`

Why: A lifecycle observer/timer near viewport/webview geometry remains active. It may be legitimate, but it must not write inline geometry or zoom.

Action: Review this owner against PASS329 sentry output and PASS328 geometry report.

```text
    window.setInterval(() => {
      if (!isRailOpen()) return;
      const active = collectSnapshots().find((snapshot) => snapshot.active);
      if (active) requestThumbnailCapture(active.webview, false);
    }, CAPTURE_MIN_AGE_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSiteViewMissionRail, { once: true });
  } else {
    initSiteViewMissionRail();
  }
})();

```
