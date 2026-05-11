import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const fail = (message) => { console.error(`[PASS116][FAIL] ${message}`); process.exit(1); };
const need = (condition, message) => { if (!condition) fail(message); };

const pkg = JSON.parse(read('package.json'));
const releaseBlockers = pkg.scripts?.['verify:release-blockers'] || '';
const html = read('src/renderer/index.html');
const responsiveTs = read('src/renderer/responsive-toolbar.ts');
const appTs = read('src/renderer/app.ts');
const siteViewTs = read('src/renderer/site-view-mission-rail.ts');
const responsiveCss = read('src/renderer/styles/responsive-toolbar.css');
const docs = read('docs/pass-116-overlay-arbitration.md');
const summary = read('PASS_116_OVERLAY_ARBITRATION_SUMMARY.md');
const next = read('NEXT_CHAT_STARTER.md');

need(pkg.version === '1.8.30', 'PASS116 must not increment version without explicit approval');
need(pkg.scripts?.['verify:pass-116-overlay-arbitration'] === 'node scripts/verify-pass-116-overlay-arbitration.mjs', 'package script missing PASS116 verifier');
need(releaseBlockers.includes('verify:pass-116-overlay-arbitration'), 'verify:release-blockers missing PASS116 verifier');
need(releaseBlockers.indexOf('verify:pass-116-overlay-arbitration') > releaseBlockers.indexOf('verify:pass-115-overflow-visibility-guard'), 'PASS116 must run after PASS115');
need(releaseBlockers.indexOf('verify:pass-116-overlay-arbitration') < releaseBlockers.lastIndexOf('npm run build'), 'PASS116 must run before final build');

need(html.includes('data-pass116-overlay-arbitration="true"'), 'renderer body missing PASS116 overlay arbitration marker');

for (const token of [
  'PASS116 overlay arbitration',
  "PASS116_CHROME_OVERLAY_OPEN_EVENT = 'tahai:chrome-overlay-open'",
  'pass116AnnounceMoreToolsOpen()',
  "detail: { source: 'more-tools', overlay: 'toolbar-overflow-menu' }",
  "pass116ChromeOverlaySource(event) !== 'more-tools'",
  "document.body.dataset.pass116OverlayArbitration = 'true'"
]) need(responsiveTs.includes(token), `responsive toolbar missing PASS116 token: ${token}`);

for (const token of [
  "type Pass116ChromeOverlaySource = 'more-tools' | 'command-toolbar' | 'ops-hub' | 'site-view' | 'mission-control'",
  "PASS116_CHROME_OVERLAY_OPEN_EVENT = 'tahai:chrome-overlay-open'",
  'pass116AnnounceChromeOverlayOpen(source: Pass116ChromeOverlaySource)',
  'pass116InstallChromeOverlayArbitration()',
  "if (source !== 'command-toolbar') closeToolMenus();",
  "if (source !== 'ops-hub' && opsHub && !opsHub.hidden) opsHub.hidden = true;",
  "pass116AnnounceChromeOverlayOpen('mission-control')",
  "pass116AnnounceChromeOverlayOpen('command-toolbar')",
  "pass116AnnounceChromeOverlayOpen('ops-hub')",
  'pass116InstallChromeOverlayArbitration();'
]) need(appTs.includes(token), `app renderer missing PASS116 token: ${token}`);

for (const token of [
  "PASS116_CHROME_OVERLAY_OPEN_EVENT = 'tahai:chrome-overlay-open'",
  'pass116AnnounceSiteViewOpen()',
  "detail: { source: 'site-view', overlay: RAIL_ID }",
  'installPass116OverlayArbitration()',
  "pass116ChromeOverlaySource(event) !== 'site-view' && isRailOpen()",
  "if (open) pass116AnnounceSiteViewOpen()"
]) need(siteViewTs.includes(token), `Site View renderer missing PASS116 token: ${token}`);

for (const token of [
  'PASS116 overlay arbitration',
  'body[data-pass116-overlay-arbitration="true"] .toolbar-overflow-menu',
  'body[data-pass116-overlay-arbitration="true"] .tool-menu-panel',
  'body[data-pass116-overlay-arbitration="true"] .ops-hub',
  'body[data-pass116-overlay-arbitration="true"] .site-view-mission-rail',
  '-webkit-app-region: no-drag',
  'pointer-events: none !important',
  'data-pass116-active-overlay="more-tools"',
  'data-pass116-active-overlay="command-toolbar"',
  'data-pass116-active-overlay="ops-hub"',
  'data-pass116-active-overlay="site-view"'
]) need(responsiveCss.includes(token), `responsive toolbar CSS missing PASS116 token: ${token}`);

for (const source of ['more-tools', 'command-toolbar', 'ops-hub', 'site-view', 'mission-control']) {
  need(appTs.includes(source) || responsiveTs.includes(source) || siteViewTs.includes(source), `PASS116 source missing: ${source}`);
}

need(!responsiveTs.includes('ipcRenderer') && !appTs.includes('ipcRenderer') && !siteViewTs.includes('ipcRenderer'), 'PASS116 must not add raw IPC to renderer overlay arbitration');
need(!responsiveTs.includes('shell.openExternal') && !appTs.includes('shell.openExternal') && !siteViewTs.includes('shell.openExternal'), 'PASS116 must not add external-open behavior');
need(!responsiveTs.includes('BrowserView') && !siteViewTs.includes('BrowserView'), 'PASS116 must not touch BrowserView/webview routing');
need(!responsiveCss.includes('body[data-pass116-overlay-arbitration="true"] .webview-stage'), 'PASS116 must not move webview-stage or pane routing surfaces');

need(docs.includes('PASS116') && docs.includes('overlay stacking') && docs.includes('tahai:chrome-overlay-open'), 'PASS116 docs missing rationale/coverage');
need(summary.includes('PASS116') && summary.includes('Version remains `1.8.30`') && summary.includes('Overlay Arbitration Guard'), 'PASS116 summary missing required markers');
need(next.includes('PASS116') && next.includes('verify:pass-116-overlay-arbitration') && next.includes('PASS117'), 'NEXT_CHAT_STARTER missing PASS116/PASS117 handoff');

console.log('[PASS116][OK] Overlay arbitration guard verified: fixed chrome overlays coordinate through a renderer-local one-active-overlay contract.');
