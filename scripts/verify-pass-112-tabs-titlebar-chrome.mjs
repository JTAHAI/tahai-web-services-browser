#!/usr/bin/env node
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const fail = (message) => { console.error(`[PASS112][FAIL] ${message}`); process.exit(1); };
const need = (condition, message) => { if (!condition) fail(message); };

const pkg = JSON.parse(read('package.json'));
const releaseBlockers = String(pkg.scripts?.['verify:release-blockers'] || '');
const main = read('src/main/main.ts');
const html = read('src/renderer/index.html');
const css = read('src/renderer/styles/browser.css');

need(pkg.scripts?.['verify:pass-112-tabs-titlebar-chrome'] === 'node scripts/verify-pass-112-tabs-titlebar-chrome.mjs', 'package script missing PASS112 verifier');
need(releaseBlockers.includes('verify:pass-112-tabs-titlebar-chrome'), 'verify:release-blockers missing PASS112 verifier');
need(releaseBlockers.indexOf('verify:pass-112-tabs-titlebar-chrome') > releaseBlockers.indexOf('verify:pass-111-release-blocker-build-phase-ordering'), 'PASS112 must run after PASS111');
need(releaseBlockers.indexOf('verify:pass-112-tabs-titlebar-chrome') < releaseBlockers.lastIndexOf('npm run build'), 'PASS112 must run before final build');

need(main.includes('function titleBarChromeOptions()'), 'main process missing titleBarChromeOptions helper');
need(main.includes("titleBarStyle: 'hidden' as const"), 'Windows title bar must be hidden so renderer tabs occupy the window chrome');
need(main.includes('titleBarOverlay'), 'Windows title bar overlay must remain native instead of custom close/minimize controls');
need(main.includes("color: '#06101d'"), 'titleBarOverlay color must match the topbar shell');
need(main.includes("symbolColor: '#dff7ff'"), 'titleBarOverlay symbol color must be readable on dark shell');
need(main.includes('height: 44'), 'titleBarOverlay height must match the tab strip height');
need(main.includes('autoHideMenuBar: true'), 'native menu bar must be hidden by default to remove the extra toolbar level');
need(main.includes('window.setMenuBarVisibility(false)'), 'created window must hide the native menu bar after menu install');
need(main.includes('window.setAutoHideMenuBar(true)'), 'created window must preserve Alt/menu accelerator behavior without showing an extra bar');
need(!main.includes('frame: false'), 'PASS112 must not disable the native frame or replace OS window controls');

const pass73 = read('scripts/verify-pass-73-mission-view-direct-webview-bounds.mjs');
need(pass73.includes('const releaseBlockers = String'), 'PASS73 verifier must use current release-blocker chain parsing');
need(pass73.includes('PASS73 must run before final build'), 'PASS73 verifier must accept PASS111/PASS112 final-build ordering');
need(!pass73.includes("const releaseChainToken = 'npm run verify:pass-73-mission-view-direct-webview-bounds && npm run build'"), 'PASS73 verifier must not require legacy adjacent build ordering');

need(html.includes('data-pass112-tabs-titlebar="true"'), 'topbar missing PASS112 titlebar marker');
need(html.includes('aria-label="Window tab strip"'), 'topbar needs accessible window tab strip label');
need(html.includes('<nav id="tabs" class="tabs" aria-label="Browser tabs"></nav>'), 'browser tabs must remain in the topbar/titlebar row');

need(css.includes('border-top:0'), 'app shell must not render an extra top border below the native title bar');
need(css.includes('-webkit-app-region:drag'), 'topbar must be draggable as custom titlebar chrome');
need(css.includes('-webkit-app-region:no-drag'), 'tabs/buttons must opt out of drag so tab clicks keep working');
need(css.includes('padding:6px 150px 6px 10px'), 'topbar must reserve space for native Windows caption buttons');
need(css.includes('.topbar .tabs, .topbar .tab, .topbar .tab *, .topbar .new-tab-control'), 'no-drag must cover tabs, close buttons, and new-tab control');

need(read('PASS_112_TABS_TITLEBAR_CHROME_SUMMARY.md').includes('PASS112'), 'PASS112 summary missing marker');
need(read('docs/tabs-titlebar-chrome-pass112.md').includes('tabs into the window chrome'), 'PASS112 docs missing UX rationale');
need(read('NEXT_CHAT_STARTER.md').includes('PASS112'), 'NEXT_CHAT_STARTER.md missing PASS112');

console.log('[PASS112][OK] Tabs-on-titlebar chrome verified: native extra title/menu bars hidden while tab controls remain interactive.');
