import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const fail = (message) => { console.error(`[PASS114][FAIL] ${message}`); process.exit(1); };
const need = (condition, message) => { if (!condition) fail(message); };
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const pkg = JSON.parse(read('package.json'));
const releaseBlockers = pkg.scripts?.['verify:release-blockers'] || '';
const html = read('src/renderer/index.html');
const responsiveTs = read('src/renderer/responsive-toolbar.ts');
const responsiveCss = read('src/renderer/styles/responsive-toolbar.css');
const siteViewCss = read('src/renderer/styles/site-view-mission-rail.css');
const browserCss = read('src/renderer/styles/browser.css');
const docs = read('docs/pass-114-chrome-stack-guard.md');
const summary = read('PASS_114_CHROME_STACK_GUARD_SUMMARY.md');
const next = read('NEXT_CHAT_STARTER.md');

need(pkg.version === '1.8.30', 'PASS114 must not increment version without explicit approval');
need(pkg.scripts?.['verify:pass-114-chrome-stack-guard'] === 'node scripts/verify-pass-114-chrome-stack-guard.mjs', 'package script missing PASS114 verifier');
need(releaseBlockers.includes('verify:pass-114-chrome-stack-guard'), 'verify:release-blockers missing PASS114 verifier');
need(releaseBlockers.indexOf('verify:pass-114-chrome-stack-guard') > releaseBlockers.indexOf('verify:pass-113-adaptive-chrome-density'), 'PASS114 must run after PASS113');
need(releaseBlockers.indexOf('verify:pass-114-chrome-stack-guard') < releaseBlockers.lastIndexOf('npm run build'), 'PASS114 must run before final build');

need(html.includes('data-pass114-chrome-stack-guard="true"'), 'renderer body missing PASS114 chrome stack marker');
need(html.includes('data-pass113-adaptive-chrome-density="true"'), 'PASS113 marker must be preserved');
need(html.includes('./responsive-toolbar.js'), 'responsive toolbar runtime must remain loaded');

for (const token of ['PASS114_CHROME_STACK_GAP_PX','PASS114_OVERLAY_BOTTOM_PX','chromeStackTop()','updateChromeStackVars()',"document.body.style.setProperty('--pass114-chrome-stack-top'","document.body.style.setProperty('--pass114-overlay-bottom'",'dataset.pass114ChromeStackGuard','dataset.pass114ChromeStackTop','dataset.pass114OverlayBottom','topbar?.getBoundingClientRect().height','toolbar?.getBoundingClientRect().height']) need(responsiveTs.includes(token), `responsive toolbar missing PASS114 token: ${token}`);

for (const token of ['PASS114 chrome stack guard','--pass114-chrome-stack-top','--pass114-overlay-bottom','body[data-pass114-chrome-stack-guard="true"] .toolbar-overflow-menu','body[data-pass114-chrome-stack-guard="true"] .tool-menu-panel','body[data-pass114-chrome-stack-guard="true"] .site-view-mission-rail','body[data-pass114-chrome-stack-guard="true"] .ops-hub','max-height: calc(100vh - var(--pass114-chrome-stack-top) - var(--pass114-overlay-bottom))']) need(responsiveCss.includes(token), `responsive toolbar CSS missing PASS114 token: ${token}`);

need(siteViewCss.includes('.site-view-mission-rail'), 'Site View rail CSS must remain present');
need(browserCss.includes('data-pass113-adaptive-chrome-density'), 'PASS113 browser chrome CSS must remain present');
need(!responsiveCss.includes('body[data-pass114-chrome-stack-guard="true"] .webview-stage'), 'PASS114 must not move webview-stage or pane routing surfaces');
need(!responsiveTs.includes('Mission APIs') && !responsiveTs.includes('ipcRenderer'), 'PASS114 must not add privileged Mission/IPCs to renderer chrome stack logic');

need(docs.includes('PASS114') && docs.includes('measured chrome-stack anchor') && docs.includes('More Tools') && docs.includes('Site View'), 'PASS114 docs missing rationale/coverage');
need(summary.includes('PASS114') && summary.includes('Version remains `1.8.30`') && summary.includes('measured chrome-stack anchor'), 'PASS114 summary missing required markers');
need(next.includes('PASS114') && next.includes('verify:pass-114-chrome-stack-guard') && next.includes('PASS115'), 'NEXT_CHAT_STARTER missing PASS114/PASS115 handoff');

console.log('[PASS114][OK] Chrome stack guard verified: fixed overlays anchor below measured adaptive chrome without moving webview/pane routing surfaces.');
