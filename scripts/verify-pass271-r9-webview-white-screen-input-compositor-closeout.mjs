#!/usr/bin/env node
/* PASS271-R9 verifier — static + syntax, deliberately no embedded npm build to avoid false null exits on Windows. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const failures = [];
const file = (rel) => path.join(root, rel);
const text = (rel) => fs.existsSync(file(rel)) ? fs.readFileSync(file(rel), 'utf8') : '';
function ok(name) { console.log(`${name}=PASS`); }
function fail(name, detail) { failures.push(`${name}: ${detail}`); console.error(`${name}=FAIL ${detail}`); }
function requireContains(rel, needle, name) {
  const body = text(rel);
  if (!body) return fail(name, `${rel} missing`);
  if (!body.includes(needle)) return fail(name, `${rel} missing ${needle}`);
  ok(name);
}
function requireBefore(rel, before, after, name) {
  const body = text(rel);
  const i = body.indexOf(before);
  const j = body.indexOf(after);
  if (i >= 0 && j >= 0 && i < j) ok(name);
  else fail(name, `${before} must appear before ${after}`);
}

requireContains('src/main/main.ts', 'PASS271_R9_WEBVIEW_WHITE_SCREEN_COMPOSITOR_CLOSEOUT', 'PASS271_R9_MAIN_MARKER');
requireContains('src/main/main.ts', 'app.disableHardwareAcceleration()', 'PASS271_R9_GPU_DISABLED');
requireContains('src/main/main.ts', "app.commandLine.appendSwitch('disable-gpu')", 'PASS271_R9_DISABLE_GPU_SWITCH');
requireContains('src/main/main.ts', 'PASS271_R9_DID_ATTACH_WEBVIEW_LOG', 'PASS271_R9_GUEST_ATTACH_DIAGNOSTIC');
requireBefore('src/main/main.ts', 'installPass271R9WebviewCompositorCloseout();', 'app.whenReady().then', 'PASS271_R9_GPU_BEFORE_READY');

requireContains('src/renderer/app.ts', 'PASS271_R9_WEBVIEW_WHITE_SCREEN_INPUT_COMPOSITOR_CLOSEOUT', 'PASS271_R9_RENDERER_MARKER');
requireContains('src/renderer/app.ts', 'function pass271R9ChromiumCompatibleUserAgent', 'PASS271_R9_USER_AGENT_HELPER');
requireContains('src/renderer/app.ts', "webview.setAttribute('useragent', pass271R9ChromiumCompatibleUserAgent())", 'PASS271_R9_USER_AGENT_SET');
requireContains('src/renderer/app.ts', "pass271R9SetWebviewSrc(webview, safeUrl, 'before-attach')", 'PASS271_R9_SRC_SETTER');
requireContains('src/renderer/app.ts', 'pass271R9ArmWebviewBlankSurfaceRecovery(webview, safeUrl, tabId)', 'PASS271_R9_RECOVERY_ARMED');
requireBefore('src/renderer/app.ts', "pass271R9SetWebviewSrc(webview, safeUrl, 'before-attach')", 'stageEl.appendChild(webview);', 'PASS271_R9_SRC_BEFORE_APPEND');
requireBefore('src/renderer/app.ts', 'stageEl.appendChild(webview);', 'pass271R9ArmWebviewBlankSurfaceRecovery(webview, safeUrl, tabId)', 'PASS271_R9_RECOVERY_AFTER_APPEND');

requireContains('src/renderer/styles/browser.css', 'PASS271_R9_WEBVIEW_WHITE_SCREEN_INPUT_COMPOSITOR_CLOSEOUT_CSS', 'PASS271_R9_CSS_MARKER');
requireContains('package.json', 'verify:pass-271-r9-webview-white-screen-input-compositor-closeout', 'PASS271_R9_PACKAGE_SCRIPT');
requireContains('docs/qa/PASS271-R9-webview-white-screen-input-compositor-closeout.md', 'Webview White-Screen Input/Compositor Closeout', 'PASS271_R9_DOC');

for (const target of [
  'scripts/apply-pass271-r9-webview-white-screen-input-compositor-closeout.mjs',
  'scripts/verify-pass271-r9-webview-white-screen-input-compositor-closeout.mjs'
]) {
  const result = spawnSync(process.execPath, ['--check', file(target)], { encoding: 'utf8', shell: false });
  if (result.status === 0) ok(`PASS271_R9_SYNTAX_${path.basename(target).replace(/[^A-Za-z0-9]+/g, '_')}`);
  else fail(`PASS271_R9_SYNTAX_${target}`, result.stderr || result.stdout || `exit ${result.status}`);
}

if (failures.length) {
  console.error('PASS271_R9=FAIL');
  for (const item of failures) console.error(` - ${item}`);
  process.exit(1);
}
console.log('PASS271_R9=PASS');
console.log('PASS271_R9_WHITE_SCREEN_CLOSEOUT=STATIC_READY');
console.log('PASS271_R9_RUN_NEXT=npm run build && npm run dev');
