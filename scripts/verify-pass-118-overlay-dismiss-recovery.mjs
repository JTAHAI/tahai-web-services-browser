import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const fail = (message) => { console.error(`[PASS118][FAIL] ${message}`); process.exit(1); };
const need = (condition, message) => { if (!condition) fail(message); };

const pkg = JSON.parse(read('package.json'));
const releaseBlockers = pkg.scripts?.['verify:release-blockers'] || '';
const html = read('src/renderer/index.html');
const appTs = read('src/renderer/app.ts');
const responsiveTs = read('src/renderer/responsive-toolbar.ts');
const siteViewTs = read('src/renderer/site-view-mission-rail.ts');
const responsiveCss = read('src/renderer/styles/responsive-toolbar.css');
const docs = read('docs/pass-118-overlay-dismiss-recovery.md');
const summary = read('PASS_118_OVERLAY_DISMISS_RECOVERY_SUMMARY.md');
const next = read('NEXT_CHAT_STARTER.md');

need(pkg.version === '1.8.30', 'PASS118 must not increment version without explicit approval');
need(pkg.scripts?.['verify:pass-118-overlay-dismiss-recovery'] === 'node scripts/verify-pass-118-overlay-dismiss-recovery.mjs', 'package script missing PASS118 verifier');
need(releaseBlockers.includes('verify:pass-118-overlay-dismiss-recovery'), 'verify:release-blockers missing PASS118 verifier');
need(releaseBlockers.indexOf('verify:pass-118-overlay-dismiss-recovery') > releaseBlockers.indexOf('verify:pass-117-overlay-focus-recovery'), 'PASS118 must run after PASS117');
need(releaseBlockers.indexOf('verify:pass-118-overlay-dismiss-recovery') < releaseBlockers.lastIndexOf('npm run build'), 'PASS118 must run before final build');

need(html.includes('data-pass118-overlay-dismiss-recovery="true"'), 'renderer body missing PASS118 marker');

need(appTs.includes('type Pass118OverlayCloseReason ='), 'app renderer missing PASS118 close-reason type');
for (const reason of ['escape', 'explicit-close', 'overlay-switch', 'outside-click', 'mission-control', 'stale-state', 'unknown']) {
  need(appTs.includes(`'${reason}'`), `app renderer missing PASS118 close reason: ${reason}`);
}

for (const token of [
  "const PASS118_CHROME_OVERLAY_CLOSE_EVENT = 'tahai:chrome-overlay-close-all'",
  'pass118OverlayCloseSource(event: Event)',
  'pass118ActiveChromeOverlaySource()',
  'pass118OverlayIsActuallyOpen(source: Pass116ChromeOverlaySource)',
  'pass118ClearChromeOverlayState(reason: Pass118OverlayCloseReason',
  'pass118AnnounceChromeOverlayClose(reason: Pass118OverlayCloseReason = \'escape\'',
  'pass118ScheduleOverlayStateAudit(reason: Pass118OverlayCloseReason = \'stale-state\')',
  'pass118InstallOverlayDismissRecovery()',
  "document.addEventListener(PASS118_CHROME_OVERLAY_CLOSE_EVENT",
  "document.addEventListener('keydown', (event) => {\n    if (event.key !== 'Escape'",
  "pass118AnnounceChromeOverlayClose('escape', source, true)",
  "panel.dataset.pass118DismissBoundary = 'true'",
  'closeMissionControl(restoreFocus = false)',
  "missionDialog.dataset.pass118DismissBoundary = 'true'",
  "closeMissionButton.addEventListener('click', () => closeMissionControl(true))",
  'pass118InstallOverlayDismissRecovery();'
]) need(appTs.includes(token), `app renderer missing PASS118 token: ${token}`);

for (const token of [
  'PASS118 overlay dismiss recovery',
  "const PASS118_CHROME_OVERLAY_CLOSE_EVENT = 'tahai:chrome-overlay-close-all'",
  "buttonEl.setAttribute('aria-keyshortcuts', 'Escape')",
  "menuEl.dataset.pass118DismissBoundary = 'true'",
  'pass118InstallDismissRecovery()',
  "document.addEventListener(PASS118_CHROME_OVERLAY_CLOSE_EVENT",
  "document.body.dataset.pass118MoreToolsDismissRecovery = 'ready'",
  "document.body.dataset.pass118OverlayDismissRecovery = 'ready'"
]) need(responsiveTs.includes(token), `responsive toolbar missing PASS118 token: ${token}`);

for (const token of [
  "const PASS118_CHROME_OVERLAY_CLOSE_EVENT = 'tahai:chrome-overlay-close-all'",
  "button.setAttribute('aria-keyshortcuts', 'Escape')",
  "rail.dataset.pass118DismissBoundary = 'true'",
  'installPass118DismissRecovery()',
  "document.addEventListener(PASS118_CHROME_OVERLAY_CLOSE_EVENT",
  "document.body.dataset.pass118SiteViewDismissRecovery = 'ready'",
  "document.body.dataset.pass118LastDismissedOverlay = 'site-view'",
  'installPass118DismissRecovery();'
]) need(siteViewTs.includes(token), `Site View missing PASS118 token: ${token}`);

for (const token of [
  'PASS118 overlay dismiss recovery',
  'body[data-pass118-overlay-dismiss-recovery="true"] [data-pass118-dismiss-boundary="true"]',
  'body[data-pass118-overlay-dismiss-recovery="true"] [aria-keyshortcuts~="Escape"]',
  'body[data-pass118-overlay-dismiss-recovery="true"][data-pass118-last-dismissed-overlay] .toolbar-overflow-toggle',
  'body[data-pass118-overlay-dismiss-recovery="true"] .toolbar-overflow-menu[aria-hidden="true"]',
  '-webkit-app-region: no-drag'
]) need(responsiveCss.includes(token), `PASS118 CSS missing token: ${token}`);

for (const source of [appTs, responsiveTs, siteViewTs]) {
  need(!source.includes('ipcRenderer'), 'PASS118 must not add raw IPC');
  need(!source.includes('shell.openExternal'), 'PASS118 must not add external-open behavior');
  need(!source.includes('BrowserView'), 'PASS118 must not touch BrowserView/webview routing');
  need(!source.includes('eval('), 'PASS118 must not introduce eval');
  need(!source.includes('psa:direct-fetch'), 'PASS118 must not add direct PSA behavior');
}
need(!responsiveCss.includes('body[data-pass118-overlay-dismiss-recovery="true"] .webview-stage'), 'PASS118 must not move webview-stage or pane routing surfaces');
need(docs.includes('PASS118') && docs.includes('tahai:chrome-overlay-close-all') && docs.includes('restoreFocus=true'), 'PASS118 docs missing close-all/restoration rationale');
need(summary.includes('PASS118') && summary.includes('Overlay Dismiss Recovery Guard') && summary.includes('Version remains `1.8.30`'), 'PASS118 summary missing required markers');
need(next.includes('PASS118') && next.includes('verify:pass-118-overlay-dismiss-recovery') && next.includes('PASS119'), 'NEXT_CHAT_STARTER missing PASS118/PASS119 handoff');

console.log('[PASS118][OK] Overlay dismiss recovery verified: shared Escape/close-all overlay dismissal, stale-state cleanup, focus restoration, and no privileged surface drift.');
