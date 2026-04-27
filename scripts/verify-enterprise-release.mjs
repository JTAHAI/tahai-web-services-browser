#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const fail = (message) => { console.error(`TAHAI_BROWSER_RELEASE_VERIFY_FAIL=${message}`); process.exit(1); };
const exists = (p) => fs.existsSync(path.join(root, p));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const pkg = JSON.parse(read('package.json'));
if (pkg.version !== '1.8.6') fail(`expected version 1.8.6, got ${pkg.version}`);
if (pkg.build?.appId !== 'com.tahai.webservices.browser') fail('wrong appId');
if (pkg.build?.productName !== 'TAHAI Web Services Browser') fail('wrong productName');
if (pkg.build?.win?.icon !== 'build/icon.ico') fail('missing Windows icon config');
if (!pkg.build?.asar) fail('asar must be enabled');

const required = [
  'src/main/main.ts',
  'src/renderer/app.ts',
  'src/renderer/index.html',
  'src/renderer/styles/browser.css',
  'browser/about/index.html',
  'browser/about/offline.html',
  'browser/error-page/index.html',
  'browser/onboarding/index.html',
  'browser/new-tab/index.html',
  'build/icon.ico',
  'build/icon.png'
];
for (const rel of required) if (!exists(rel)) fail(`missing required file: ${rel}`);

const renderer = read('src/renderer/app.ts');
const banned = [
  'PASS29_RUNTIME_MENU_LAYOUT_FIX_START',
  'PASS36_TOOL_MENU_LAYOUT_HARDFIX_START',
  'PASS39_TOOL_MENU_REBUILD_LAYOUT_START',
  'PASS40_SAFE_TOOL_MENU_LAYOUT_START',
  'PASS41_TOOLMENU_OPSPANEL_UI_START',
  'PASS42_CLEAN_FAST_BASELINE_START',
  'PASS43_RELEASE_TOOLCARDS_OPSPANEL_START',
  'PASS44_FULL_OVERLAY_TOOLMENUS_START',
  'tahai-pass44-overlay',
  'replaceChildren(shell)',
  'stashOriginalContent(panel)'
];
for (const token of banned) if (renderer.includes(token)) fail(`stale runtime patch remains: ${token}`);

const html = read('src/renderer/index.html');
for (const id of ['devops-tools','it-tools','ops-hub-toggle','onboarding','about']) if (!html.includes(`id="${id}"`)) fail(`missing shell control ${id}`);
for (const id of ['capture','ops-check','deploy','route-map','dev-audit','ops-guard','devtools','it-card','endpoint','triage','credentials']) {
  const re = new RegExp(`<button id="${id}"[\\s\\S]*?<strong>[\\s\\S]*?</strong>[\\s\\S]*?<kbd>[\\s\\S]*?</kbd>[\\s\\S]*?<span>[\\s\\S]*?</span>[\\s\\S]*?</button>`);
  if (!re.test(html)) fail(`tool card ${id} does not use canonical title/kbd/description markup`);
}

const css = read('src/renderer/styles/browser.css');
for (const token of ['grid-template-columns:minmax(86px,108px) max-content minmax(0,1fr)', '.ops-hub { width:min(780px,calc(100vw - 28px))']) {
  if (!css.includes(token)) fail(`required CSS missing: ${token}`);
}

console.log('TAHAI_BROWSER_RELEASE_VERIFY=OK');
process.exit(0);
