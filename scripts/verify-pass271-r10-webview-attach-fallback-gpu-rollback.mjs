#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const checks = [];
function read(p) { return fs.readFileSync(p, 'utf8'); }
function check(name, ok, detail = '') { checks.push({ name, ok, detail }); }

const main = read('src/main/main.ts');
const app = read('src/renderer/app.ts');
const css = read('src/renderer/styles/browser.css');
const pkg = JSON.parse(read('package.json'));

check('PASS271_R10_MAIN_MARKER', main.includes('PASS271_R10_WEBVIEW_ATTACH_FALLBACK_GATE'));
check('PASS271_R10_ATTACH_REPAIR_HELPER', main.includes('function pass271R10RepairWebviewAttachParams'));
check('PASS271_R10_ATTACH_REPAIR_CALLED', main.includes('pass271R10RepairWebviewAttachParams(params as TahaiWebviewAttachRecord);'));
check('PASS271_R10_GPU_DEFAULT_ROLLED_BACK', main.includes("TAHAI_BROWSER_DISABLE_GPU_WHITE_SCREEN_REPAIR !== '1'"));
check('PASS271_R10_RENDERER_MARKER', app.includes('PASS271_R10_WEBVIEW_ATTACH_FALLBACK_RUNTIME_MARKER'));
check('PASS271_R10_RENDERER_MARKER_CALLED', app.includes('pass271R10MarkNormalWebviewRuntime(webview, safeUrl, tabId);'));
check('PASS271_R10_CSS_MARKER', css.includes('PASS271_R10_WEBVIEW_ATTACH_FALLBACK_GPU_ROLLBACK_CSS'));
check('PASS271_R10_PACKAGE_SCRIPT', pkg.scripts?.['verify:pass-271-r10-webview-attach-fallback-gpu-rollback'] === 'node scripts/verify-pass271-r10-webview-attach-fallback-gpu-rollback.mjs');

for (const script of [
  'scripts/apply-pass271-r10-webview-attach-fallback-gpu-rollback.mjs',
  'scripts/verify-pass271-r10-webview-attach-fallback-gpu-rollback.mjs'
]) {
  const result = spawnSync(process.execPath, ['--check', script], { encoding: 'utf8' });
  check(`PASS271_R10_SYNTAX_${script.replace(/[^a-z0-9]+/gi, '_')}`, result.status === 0, result.stderr || result.stdout || '');
}

let failed = false;
for (const item of checks) {
  console.log(`${item.name}=${item.ok ? 'PASS' : 'FAIL'}${item.detail && !item.ok ? ' ' + item.detail.replace(/\s+/g, ' ').slice(0, 260) : ''}`);
  if (!item.ok) failed = true;
}
console.log(`PASS271_R10=${failed ? 'FAIL' : 'PASS'}`);
if (failed) process.exit(1);
