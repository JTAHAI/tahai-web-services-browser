#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const app = read('src/renderer/app.ts');
const css = read('src/renderer/styles/browser.css');
const pkg = JSON.parse(read('package.json'));
const outDir = path.join(root, 'release-candidate', 'generated');
fs.mkdirSync(outDir, { recursive: true });

const checks = [];
function check(id, ok, detail) {
  checks.push({ id, ok: Boolean(ok), detail });
}

check(
  'pass339-runtime-closeout-installed',
  app.includes('PASS339_NORMAL_BROWSING_INPUT_PAINT_CLOSEOUT_START') && app.includes('function pass339NormalBrowsingInputPaintCloseout'),
  'renderer has the PASS339 normal-browsing input/paint closeout owner'
);
check(
  'normal-browsing-clears-stale-drag-state',
  /document\.body\.classList\.remove\([^)]*mission-tab-dragging[^)]*pass271-r3-drag-active[^)]*pass66-mission-pane-pointer-dragging[^)]*\)/s.test(app),
  'normal browsing clears stale Mission drag/drop body classes'
);
check(
  'normal-browsing-hides-mission-overlays',
  /mission-pane-drop-zones, \.mission-pane-drop-zone, \.mission-pane-heads, \.mission-pane-head-cell/.test(app) && /pass339HideElement\(element, reason\)/.test(app),
  'normal browsing hides Mission drop zones and pane headers without relying on PASS271_R4'
);
check(
  'render-single-invokes-closeout',
  app.includes("pass339NormalBrowsingInputPaintCloseout('render-single-layout')"),
  'renderMissionLayout single-mode path invokes PASS339 closeout'
);
check(
  'normal-browsing-clears-mission-fit-residue',
  app.includes("tab.webview.removeAttribute('width')") &&
    app.includes("tab.webview.removeAttribute('height')") &&
    app.includes('delete tab.webview.dataset.pass77ViewportFit') &&
    app.includes('delete tab.webview.dataset.pass78AutosizeGuard') &&
    app.includes('pass339ApplyStageViewportFit(tab.webview)'),
  'normal browsing clears Mission viewport-fit residue and reapplies a stage-sized guest viewport'
);
check(
  'create-tab-schedules-closeout',
  app.includes("pass339ScheduleNormalBrowsingInputPaintCloseout('create-tab')"),
  'createTab schedules PASS339 closeout after active tab creation'
);
check(
  'create-tab-pre-attach-stage-fit',
  app.includes("webview.className = 'browser-view active'") &&
    /pass339ApplyStageViewportFit\(webview\);[\s\S]*webview\.addEventListener\('did-attach'/.test(app) &&
    /webview\.addEventListener\('did-attach'[\s\S]*pass339ApplyStageViewportFit\(webview\)/.test(app),
  'new active webviews are stage-fitted before and during native guest attach to avoid the 150px guest viewport default'
);
check(
  'stage-fit-writes-exact-priority-pixels',
    app.includes("webview.style.setProperty('width', stageWidth + 'px', 'important')") &&
    app.includes("webview.style.setProperty('height', stageHeight + 'px', 'important')") &&
    app.includes("webview.style.setProperty('min-height', stageHeight + 'px', 'important')") &&
    app.includes('pass342ExactStageViewportFit') &&
    app.includes("webview.style.setProperty('display', 'inline-flex', 'important')"),
  'stage viewport fit writes exact inline-priority pixel bounds so later CSS cannot fall back to Electron webview intrinsic 150px height'
);
check(
  'stage-fit-settles-native-guest-bottom',
  app.includes('PASS342_NATIVE_GUEST_VIEWPORT_BOTTOM_ALIGN') &&
    app.includes('pass342ScheduleNativeGuestViewportSettle') &&
    app.includes('pass342GuestViewportBottomAligned') &&
    app.includes('active guest document bottom stops before viewport bottom'),
  'runtime has a bounded native guest resize settle path and a fail-closed document-bottom proof'
);
check(
  'load-lifecycle-schedules-closeout',
  app.includes("pass339ScheduleNormalBrowsingInputPaintCloseout('webview-dom-ready')") &&
    app.includes("pass339ScheduleNormalBrowsingInputPaintCloseout('webview-did-stop-loading')") &&
    app.includes("pass339ApplyStageViewportFit(webview, 'webview-did-start-loading')") &&
    app.includes("visual-viewport-resize"),
  'webview load completion and visual viewport resize both re-run PASS339 viewport closeout'
);
check(
  'drag-end-closeout',
  app.includes("pass339NormalBrowsingInputPaintCloseout('mission-tab-drag-end')"),
  'Mission tab drag end clears overlay state immediately'
);
check(
  'css-pass339-installed',
  css.includes('PASS339_NORMAL_BROWSING_INPUT_PAINT_CLOSEOUT') && css.includes('body:not(.mission-tab-dragging) .mission-pane-drop-zones'),
  'loaded runtime stylesheet has PASS339 stale Mission overlay inertness rules'
);
check(
  'css-normal-mode-overlay-hidden',
  css.includes('#webview-stage:not(.mission-layout) .mission-pane-drop-zones') && css.includes('#webview-stage[data-pass339-normal-browsing="true"] .mission-pane-drop-zones'),
  'Mission drop zones are hidden and non-hit-testable outside active Mission drag'
);
check(
  'css-active-webview-explicit-display',
  /#webview-stage:not\(\.mission-layout\) > webview\.browser-view[\s\S]*display:\s*inline-flex\s*!important/.test(css),
  'normal active webview uses inline-flex display and containment in the loaded stylesheet'
);
check(
  'pass271-r4-remains-gated',
  app.includes('TAHAI_BROWSER_ENABLE_PASS271_R4_NORMAL_WEBVIEW_REPAIR') && /if \(pass271R4NormalWebviewRepairEnabled\(\)\) \{[\s\S]*else pass271R4Mount\(\);[\s\S]*\} else \{[\s\S]*pass271R4ClearDisabledMarkers\(\)/.test(app),
  'PASS271_R4 repair remains opt-in only'
);
check(
  'no-unsafe-webview-popups-added',
  !/setAttribute\(\s*['\"]allowpopups['\"]/i.test(app) && !/<webview[^>]*allowpopups/i.test(css),
  'PASS339 did not add unsafe allowpopups behavior'
);
check(
  'package-script-present',
  pkg.scripts?.['verify:pass-339-normal-browsing-input-paint-closeout'] === 'node scripts/verify-pass-339-normal-browsing-input-paint-closeout.mjs',
  'package.json exposes PASS339 verifier'
);

const failed = checks.filter((entry) => !entry.ok);
const report = {
  pass: 'PASS339',
  name: 'Normal Browsing Input/Paint Closeout',
  result: failed.length ? 'FAIL' : 'PASS',
  generatedAt: new Date().toISOString(),
  checks
};
fs.writeFileSync(path.join(outDir, 'pass339-normal-browsing-input-paint-closeout-report.json'), JSON.stringify(report, null, 2));

for (const entry of checks) {
  console.log(`${entry.ok ? 'PASS' : 'FAIL'} ${entry.id} - ${entry.detail}`);
}
console.log(`PASS339_VERIFY_RESULT=${report.result}`);
console.log(`PASS339_REPORT=release-candidate/generated/pass339-normal-browsing-input-paint-closeout-report.json`);

if (failed.length) process.exit(1);
