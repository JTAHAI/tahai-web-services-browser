import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const fail = (message) => { console.error(`[PASS113][FAIL] ${message}`); process.exit(1); };
const need = (condition, message) => { if (!condition) fail(message); };
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const pkg = JSON.parse(read('package.json'));
const releaseBlockers = pkg.scripts?.['verify:release-blockers'] || '';
const main = read('src/main/main.ts');
const html = read('src/renderer/index.html');
const browserCss = read('src/renderer/styles/browser.css');
const responsiveTs = read('src/renderer/responsive-toolbar.ts');
const docs = read('docs/pass-113-adaptive-chrome-density.md');
const summary = read('PASS_113_ADAPTIVE_CHROME_DENSITY_SUMMARY.md');
const next = read('NEXT_CHAT_STARTER.md');

need(pkg.version === '1.8.30', 'PASS113 must not increment version without explicit approval');
need(pkg.scripts?.['verify:pass-113-adaptive-chrome-density'] === 'node scripts/verify-pass-113-adaptive-chrome-density.mjs', 'package script missing PASS113 verifier');
need(releaseBlockers.includes('verify:pass-113-adaptive-chrome-density'), 'verify:release-blockers missing PASS113 verifier');
need(releaseBlockers.indexOf('verify:pass-113-adaptive-chrome-density') > releaseBlockers.indexOf('verify:pass-112-tabs-titlebar-chrome'), 'PASS113 must run after PASS112');
need(releaseBlockers.indexOf('verify:pass-113-adaptive-chrome-density') < releaseBlockers.lastIndexOf('npm run build'), 'PASS113 must run before final build');

need(main.includes('WINDOWS_TITLEBAR_CHROME_HEIGHT_PX'), 'main process missing titlebar chrome height constant');
need(main.includes('WINDOWS_TITLEBAR_CAPTION_RESERVE_PX'), 'main process missing Windows caption reserve constant');
need(main.includes('titleBarOverlay'), 'Electron titleBarOverlay must be preserved');
need(main.includes('height: WINDOWS_TITLEBAR_CHROME_HEIGHT_PX'), 'titleBarOverlay height must use the PASS113 chrome-height constant');
need(main.includes('autoHideMenuBar: true'), 'native menu bar must remain hidden by default');
need(!main.includes('frame: false'), 'PASS113 must not replace native OS caption buttons with a custom frame');

need(html.includes('data-pass113-adaptive-chrome-density="true"'), 'renderer body missing PASS113 adaptive chrome marker');
need(html.includes('data-pass112-tabs-titlebar="true"'), 'PASS112 titlebar marker must be preserved');
need(html.includes('<nav id="tabs" class="tabs" aria-label="Browser tabs"></nav>'), 'tabs must remain in the titlebar row');

for (const token of ['--pass113-titlebar-chrome-height','--pass113-titlebar-caption-reserve','--pass113-toolbar-chrome-height','calc(var(--pass113-titlebar-caption-reserve) + 10px)','.toolbar-overflow-menu','-webkit-app-region: no-drag','@media (max-width: 980px)','@media (max-width: 760px)']) need(browserCss.includes(token), `browser CSS missing PASS113 token: ${token}`);
for (const token of ['PASS113 adaptive chrome density','PASS113_MIN_ADDRESS_WIDTH','PASS113_ALWAYS_VISIBLE_IDS','CHROME_OVERFLOW_ITEMS','MutationObserver','targetCountForWidth','addressWidth()','dataset.pass113ChromeOverflowState','dataset.pass113AdaptiveChromeDensity']) need(responsiveTs.includes(token), `responsive toolbar missing PASS113 token: ${token}`);
for (const id of ['about','settings','onboarding','launchpad','ops-hub-toggle','site-view-rail-toggle','chromium-bookmarks-button','chromium-bookmark-star','profile-switcher']) need(responsiveTs.includes(`id: '${id}'`), `adaptive overflow missing managed control: ${id}`);
for (const id of ['back','forward','reload','home','address-form','devops-tools','it-tools','mission-control-toggle']) need(responsiveTs.includes(`'${id}'`), `always-visible chrome contract missing: ${id}`);
need(!/CHROME_OVERFLOW_ITEMS[\s\S]*id: 'mission-control-toggle'/.test(responsiveTs), 'Mission Control must not be moved into secondary overflow by PASS113');

need(docs.includes('PASS113') && docs.includes('More Tools') && docs.includes('titleBarOverlay'), 'PASS113 docs missing UX/security rationale');
need(summary.includes('PASS113') && summary.includes('Version remains `1.8.30`'), 'PASS113 summary missing required markers');
need(next.includes('PASS113') && next.includes('verify:pass-113-adaptive-chrome-density'), 'NEXT_CHAT_STARTER missing PASS113 handoff');
console.log('[PASS113][OK] Adaptive chrome density verified: titlebar tabs stay compact, native caption controls remain OS-owned, and secondary controls overflow before crowding the active address row.');
