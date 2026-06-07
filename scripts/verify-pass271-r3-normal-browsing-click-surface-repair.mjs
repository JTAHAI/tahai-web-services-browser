#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const root = process.cwd();
const pass = 'PASS271_R3';
const scriptName = 'verify:pass-271-r3-normal-browsing-click-surface-repair';
const scriptValue = 'node scripts/verify-pass271-r3-normal-browsing-click-surface-repair.mjs';
const jsStart = '/* PASS271_R3_NORMAL_BROWSING_CLICK_SURFACE_REPAIR_START */';
const cssStart = '/* PASS271_R3_NORMAL_BROWSING_CLICK_SURFACE_REPAIR_CSS_START */';
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

const applyScript = path.join(root, 'scripts', 'apply-pass271-r3-normal-browsing-click-surface-repair.mjs');
const verifyScript = path.join(root, 'scripts', 'verify-pass271-r3-normal-browsing-click-surface-repair.mjs');
for (const file of [applyScript, verifyScript]) {
  if (!fs.existsSync(file)) fail('Required script missing.', [path.relative(root, file)]);
  try { execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }); }
  catch (error) { fail('Syntax check failed.', [path.relative(root, file), String(error?.stderr || error?.message || error)]); }
}

const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(readText(pkgPath));
if (pkg.scripts?.[scriptName] !== scriptValue) fail('package.json verification script is missing or stale.', [`expected ${scriptName}=${scriptValue}`]);

const rendererFiles = walk(root, (file) => /\.(ts|tsx|js|jsx)$/i.test(file));
const cssFiles = walk(root, (file) => /\.css$/i.test(file));
const renderer = rendererFiles.find((file) => readText(file).includes(jsStart));
const css = cssFiles.find((file) => readText(file).includes(cssStart));
if (!renderer) fail('PASS271-R3 renderer guard marker missing.');
if (!css) fail('PASS271-R3 CSS guard marker missing.');

const rendererText = readText(renderer);
const cssText = readText(css);
const requiredRendererTokens = [
  'pass271R3RepairNormalBrowsingSurface',
  'pass271R3NeutralizeIdleDragOverlays',
  '__TAHAI_PASS271_R3_NORMAL_BROWSING_SURFACE__',
  'data-pass271-r3-active-webview',
  'mission-pane-drop-zones'
];
const requiredCssTokens = [
  '-webkit-app-region: no-drag !important',
  '#webview-stage > webview.browser-view.active',
  'body:not(.mission-tab-dragging):not(.pass271-r3-drag-active) .mission-pane-drop-zones',
  '[data-pass81-non-pane-drop-surface="true"]::after',
  'pointer-events: auto !important'
];
const missing = [];
for (const token of requiredRendererTokens) if (!rendererText.includes(token)) missing.push('renderer token: ' + token);
for (const token of requiredCssTokens) if (!cssText.includes(token)) missing.push('css token: ' + token);
if (missing.length) fail('PASS271-R3 required repair tokens missing.', missing);

console.log(pass + '_STATIC=PASS');
console.log(pass + '_RENDERER=' + path.relative(root, renderer).split(path.sep).join('/'));
console.log(pass + '_CSS=' + path.relative(root, css).split(path.sep).join('/'));
console.log(pass + '_BUILD=RUNNING');
const build = spawnSync(npmCommand(), ['run', 'build'], { cwd: root, stdio: 'inherit', shell: false });
if (build.status !== 0) fail('npm run build failed after PASS271-R3 repair.', [`exit=${build.status}`]);
console.log(pass + '_BUILD=PASS');
console.log(pass + '=PASS');
