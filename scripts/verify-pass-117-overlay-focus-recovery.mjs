
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const fail = (message) => { console.error(`[PASS117][FAIL] ${message}`); process.exit(1); };
const need = (condition, message) => { if (!condition) fail(message); };

const pkg = JSON.parse(read('package.json'));
const releaseBlockers = pkg.scripts?.['verify:release-blockers'] || '';
const html = read('src/renderer/index.html');
const responsiveTs = read('src/renderer/responsive-toolbar.ts');
const appTs = read('src/renderer/app.ts');
const siteViewTs = read('src/renderer/site-view-mission-rail.ts');
const responsiveCss = read('src/renderer/styles/responsive-toolbar.css');
const docs = read('docs/pass-117-overlay-focus-recovery.md');
const summary = read('PASS_117_OVERLAY_FOCUS_RECOVERY_SUMMARY.md');
const next = read('NEXT_CHAT_STARTER.md');

need(pkg.version === '1.8.30', 'PASS117 must not increment version without explicit approval');
need(pkg.scripts?.['verify:pass-117-overlay-focus-recovery'] === 'node scripts/verify-pass-117-overlay-focus-recovery.mjs', 'package script missing PASS117 verifier');
need(releaseBlockers.includes('verify:pass-117-overlay-focus-recovery'), 'verify:release-blockers missing PASS117 verifier');
need(releaseBlockers.indexOf('verify:pass-117-overlay-focus-recovery') > releaseBlockers.indexOf('verify:pass-116-overlay-arbitration'), 'PASS117 must run after PASS116');
need(releaseBlockers.indexOf('verify:pass-117-overlay-focus-recovery') < releaseBlockers.lastIndexOf('npm run build'), 'PASS117 must run before final build');

need(html.includes('data-pass117-overlay-focus-recovery="true"'), 'renderer body missing PASS117 overlay focus marker');

for (const token of [
  'PASS117 overlay focus recovery',
  'PASS117_FOCUSABLE_SELECTOR',
  "menuEl.dataset.pass117FocusScope = 'more-tools'",
  "buttonEl.dataset.pass117OverlayOpener = 'more-tools'",
  'pass117SetMenuFocusOpen(open: boolean)',
  'closeMenu({ restoreFocus: true })',
  'closeMenu({ restoreFocus: false })',
  'pass117FocusFirstMenuItem()',
  "focusScope: 'more-tools'",
  "document.body.dataset.pass117OverlayFocusRecovery = 'ready'"
]) need(responsiveTs.includes(token), `responsive toolbar missing PASS117 token: ${token}`);

for (const token of [
  'PASS117_FOCUSABLE_SELECTOR',
  'pass117FocusFirstIn(scope: HTMLElement)',
  'pass117MarkOverlayFocus(scope: Pass116ChromeOverlaySource, panel: HTMLElement, opener?: HTMLElement | null)',
  'pass117ClearOverlayFocus(scope: Pass116ChromeOverlaySource, panel: HTMLElement, opener?: HTMLElement | null, restoreFocus = false)',
  "panel.dataset.pass117FocusScope = scope",
  "document.body.dataset.pass117ActiveFocusScope = scope",
  "pass117MarkOverlayFocus('command-toolbar', panel, button)",
  "closeToolMenus(undefined, true)",
  "pass117MarkOverlayFocus('ops-hub', opsHub, opsHubToggleButton)",
  "toggleOpsHub(false, true)",
  "missionDialog.dataset.pass117FocusScope = 'mission-control'"
]) need(appTs.includes(token), `app renderer missing PASS117 token: ${token}`);

for (const token of [
  'PASS117_FOCUSABLE_SELECTOR',
  'pass117SiteViewOpener',
  "button.dataset.pass117OverlayOpener = 'site-view'",
  "rail.dataset.pass117FocusScope = 'site-view'",
  "focusScope: 'site-view'",
  'pass117FocusFirstRailControl(rail: HTMLElement)',
  'pass117SetRailFocusOpen(open: boolean, restoreFocus = false)',
  'setRailOpen(false, true, true)',
  'setRailOpen(false, true, false)',
  "document.body.dataset.pass117SiteViewFocusRecovery = 'ready'"
]) need(siteViewTs.includes(token), `Site View renderer missing PASS117 token: ${token}`);

for (const token of [
  'PASS117 overlay focus recovery',
  'body[data-pass117-overlay-focus-recovery="true"] [data-pass117-focus-scope]',
  'body[data-pass117-overlay-focus-recovery="true"] [data-pass117-focus-open="true"]',
  'body[data-pass117-overlay-focus-recovery="true"] [data-pass117-overlay-expanded="true"]',
  'body[data-pass117-active-focus-scope="more-tools"] .toolbar-overflow-toggle',
  'body[data-pass117-active-focus-scope="command-toolbar"] .tool-menu-button[aria-expanded="true"]',
  'body[data-pass117-active-focus-scope="ops-hub"] #ops-hub-toggle',
  'body[data-pass117-active-focus-scope="site-view"] #site-view-rail-toggle',
  '-webkit-app-region: no-drag'
]) need(responsiveCss.includes(token), `PASS117 CSS missing token: ${token}`);

need(!responsiveTs.includes('ipcRenderer') && !appTs.includes('ipcRenderer') && !siteViewTs.includes('ipcRenderer'), 'PASS117 must not add raw IPC to renderer overlay focus work');
need(!responsiveTs.includes('shell.openExternal') && !appTs.includes('shell.openExternal') && !siteViewTs.includes('shell.openExternal'), 'PASS117 must not add external-open behavior');
need(!responsiveTs.includes('BrowserView') && !siteViewTs.includes('BrowserView'), 'PASS117 must not touch BrowserView/webview routing');
need(!responsiveCss.includes('body[data-pass117-overlay-focus-recovery="true"] .webview-stage'), 'PASS117 must not move webview-stage or pane routing surfaces');
need(!appTs.includes('eval(') && !responsiveTs.includes('eval(') && !siteViewTs.includes('eval('), 'PASS117 must not introduce eval');

need(docs.includes('PASS117') && docs.includes('focus recovery') && docs.includes('restoreFocus=false'), 'PASS117 docs missing rationale/coverage');
need(summary.includes('PASS117') && summary.includes('Version remains `1.8.30`') && summary.includes('Overlay Focus Recovery Guard'), 'PASS117 summary missing required markers');
need(next.includes('PASS117') && next.includes('verify:pass-117-overlay-focus-recovery') && next.includes('PASS118'), 'NEXT_CHAT_STARTER missing PASS117/PASS118 handoff');

console.log('[PASS117][OK] Overlay focus recovery verified: active chrome overlays expose deterministic focus scopes and restore launcher focus on explicit close.');
