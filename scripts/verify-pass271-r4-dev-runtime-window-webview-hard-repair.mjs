#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const root = process.cwd();
const pass = 'PASS271_R4';
const scriptName = 'verify:pass-271-r4-dev-runtime-window-webview-hard-repair';
const scriptValue = 'node scripts/verify-pass271-r4-dev-runtime-window-webview-hard-repair.mjs';
const mainStart = '/* PASS271_R4_MAIN_DESTROYED_WINDOW_GUARD_START */';
const rendererStart = '/* PASS271_R4_NORMAL_WEBVIEW_HARD_REPAIR_START */';
const cssStart = '/* PASS271_R4_NORMAL_WEBVIEW_HARD_REPAIR_CSS_START */';
const skipDirs = new Set(['.git','node_modules','dist','release','release-msix','out','coverage','.vite','.next','build']);

function readText(file) { try { return fs.readFileSync(file, 'utf8'); } catch { return ''; } }
function walk(dir, matcher, acc = []) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const entry of entries) {
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, matcher, acc);
    else if (matcher(full)) acc.push(full);
  }
  return acc;
}
function fail(message, details = []) {
  console.error(pass + '=FAIL');
  console.error(message);
  for (const detail of details) console.error('- ' + detail);
  process.exit(1);
}
function npmCommand() { return process.platform === 'win32' ? 'npm.cmd' : 'npm'; }

for (const file of [
  path.join(root, 'scripts', 'apply-pass271-r4-dev-runtime-window-webview-hard-repair.mjs'),
  path.join(root, 'scripts', 'verify-pass271-r4-dev-runtime-window-webview-hard-repair.mjs')
]) {
  if (!fs.existsSync(file)) fail('Required script missing.', [path.relative(root, file)]);
  try { execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }); }
  catch (error) { fail('Syntax check failed.', [path.relative(root, file), String(error?.stderr || error?.message || error)]); }
}

const pkg = JSON.parse(readText(path.join(root, 'package.json')) || '{}');
if (pkg.scripts?.[scriptName] !== scriptValue) fail('package.json verification script is missing or stale.', [`expected ${scriptName}=${scriptValue}`]);

const sources = walk(root, (file) => /\.(ts|tsx|js|jsx|css)$/i.test(file));
const main = sources.find((file) => readText(file).includes(mainStart));
const renderer = sources.find((file) => readText(file).includes(rendererStart));
const css = sources.find((file) => readText(file).includes(cssStart));
if (!main) fail('PASS271-R4 main destroyed-window guard marker missing.');
if (!renderer) fail('PASS271-R4 renderer hard repair marker missing.');
if (!css) fail('PASS271-R4 CSS hard repair marker missing.');

const mainText = readText(main);
const rendererText = readText(renderer);
const cssText = readText(css);
const missing = [];
for (const token of [
  'pass271R4BrowserWindowAlive',
  '!window.webContents.isDestroyed()',
  'window.loadFile(failurePath).catch(() => writeInlineFallback())',
  'writeInlineFallback'
]) if (!mainText.includes(token)) missing.push('main token: ' + token);
for (const token of [
  'pass271R4RepairNormalWebview',
  'pass271R4HideIdleMissionOverlays',
  '__TAHAI_PASS271_R4_NORMAL_WEBVIEW_HARD_REPAIR__',
  'pass271R4CurrentActiveTab',
  'stage.appendChild(tab.webview)'
]) if (!rendererText.includes(token)) missing.push('renderer token: ' + token);
for (const token of [
  'body[data-pass271-r4-normal-browsing="true"] .mission-pane-drop-zones',
  'webview[data-pass271-r4-active-webview="true"]',
  'display: inline-flex !important',
  '-webkit-app-region: no-drag !important'
]) if (!cssText.includes(token)) missing.push('css token: ' + token);
if (missing.length) fail('PASS271-R4 required hard-repair tokens missing.', missing);

console.log(pass + '_STATIC=PASS');
console.log(pass + '_MAIN=' + path.relative(root, main).split(path.sep).join('/'));
console.log(pass + '_RENDERER=' + path.relative(root, renderer).split(path.sep).join('/'));
console.log(pass + '_CSS=' + path.relative(root, css).split(path.sep).join('/'));
console.log(pass + '_BUILD=RUNNING');
const build = spawnSync(npmCommand(), ['run', 'build'], { cwd: root, stdio: 'inherit', shell: false });
if (build.status !== 0) fail('npm run build failed after PASS271-R4 repair.', [`exit=${build.status}`]);
console.log(pass + '_BUILD=PASS');
console.log(pass + '=PASS');
