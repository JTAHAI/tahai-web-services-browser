#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const appRoot = process.cwd();
const errors = [];
function exists(rel) { return fs.existsSync(path.join(appRoot, rel)); }
function read(rel) { return fs.readFileSync(path.join(appRoot, rel), 'utf8'); }
function add(error) { errors.push(error); }
const versionAtLeast = (actual, minimum) => {
  const parse = (v) => String(v).split(/[.-]/).slice(0, 3).map((x) => Number.parseInt(x, 10) || 0);
  const a = parse(actual), b = parse(minimum);
  for (let i = 0; i < 3; i += 1) { if (a[i] > b[i]) return true; if (a[i] < b[i]) return false; }
  return true;
};

const packageJson = JSON.parse(read('package.json'));
if (!versionAtLeast(packageJson.version, '1.8.12')) add(`package.json version should be >= 1.8.12, found ${packageJson.version}`);
if (!read('electron-builder.yml').includes('appId: com.tahai.webservices.browser')) add('electron-builder.yml appId mismatch');
if (!read('electron-builder.yml').includes('from: browser')) add('electron-builder.yml must package the complete browser directory');
if (packageJson.productName !== 'TAHAI Web Services Browser') add('productName mismatch');
if (packageJson.build?.appId !== 'com.tahai.webservices.browser') add('build.appId mismatch');
if (packageJson.build?.win?.icon !== 'build/icon.ico') add('Windows icon must be build/icon.ico');
if (packageJson.build?.nsis?.oneClick !== false) add('NSIS assisted installer must remain enabled');
if (packageJson.build?.nsis?.createDesktopShortcut !== true) add('NSIS desktop shortcut option missing');
if (packageJson.build?.nsis?.createStartMenuShortcut !== true) add('NSIS Start Menu shortcut option missing');
if (!packageJson.scripts?.['verify:builder-truth']) add('verify:builder-truth script missing');

const renderer = read('src/renderer/app.ts');
const mainTs = read('src/main/main.ts');
const html = read('src/renderer/index.html');
const css = read('src/renderer/styles/browser.css');
const banned = [
  'PASS29_RUNTIME_MENU_LAYOUT_FIX_START',
  'PASS36_TOOL_MENU_LAYOUT_HARDFIX_START',
  'PASS39_TOOL_MENU_REBUILD_LAYOUT_START',
  'PASS40_SAFE_TOOL_MENU_LAYOUT_START',
  'PASS41_TOOLMENU_OPSPANEL_UI_START',
  'PASS42_CLEAN_FAST_BASELINE_START',
  'PASS43_RELEASE_TOOLCARDS_OPSPANEL_START',
  'PASS44_FULL_OVERLAY_TOOLMENUS_START',
];
for (const marker of banned) {
  if (renderer.includes(marker)) add(`stale runtime injection marker remains in renderer: ${marker}`);
  if (html.includes(marker)) add(`stale runtime injection marker remains in html: ${marker}`);
  if (css.includes(marker)) add(`stale runtime injection marker remains in css: ${marker}`);
}
if (!html.includes('<strong>Capture</strong><kbd>Ctrl+Shift+E</kbd><span>')) add('tool-card markup was not split into title/kbd/description lanes');

for (const [name, command] of Object.entries(packageJson.scripts || {})) {
  const matches = String(command).matchAll(/(?:node)\s+([^&|]+?\.mjs)|(?:-File)\s+([^&|]+?\.ps1)/g);
  for (const match of matches) {
    const scriptPath = (match[1] || match[2]).replace(/^\.\\/, '').replace(/^\.\//, '').trim().replace(/\\/g, '/');
    if (scriptPath.startsWith('..')) { add(`package script ${name} references parent path: ${scriptPath}`); continue; }
    if (!fs.existsSync(path.join(appRoot, scriptPath))) add(`package script ${name} references missing file: ${scriptPath}`);
  }
}

for (const rel of ['browser/new-tab/index.html', 'browser/new-tab/start.js', 'browser/settings/index.html', 'browser/about/index.html', 'browser/error-page/index.html', 'browser/onboarding/index.html', 'browser/bookmarks/bookmarks.json']) {
  if (!exists(rel)) add(`packaged app browser resource missing: ${rel}`);
}
for (const entry of fs.readdirSync(appRoot)) {
  if (/^apply-pass\d+/.test(entry) || /^README-PASS\d+/.test(entry)) add(`old pass artifact remains in app root: ${entry}`);
}
if (errors.length) {
  for (const error of errors) console.error(`TAHAI_RELEASE_CLEAN_ERROR=${error}`);
  process.exit(1);
}
console.log('TAHAI_RELEASE_CLEAN=OK');
