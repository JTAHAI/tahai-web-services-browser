#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const repo = process.cwd();
const failures = [];
function file(rel) { return path.join(repo, rel); }
function read(rel) {
  const full = file(rel);
  if (!fs.existsSync(full)) {
    failures.push(`Missing required file: ${rel}`);
    return '';
  }
  return fs.readFileSync(full, 'utf8');
}
function requireIncludes(rel, needle, message) {
  const text = read(rel);
  if (!text.includes(needle)) failures.push(`${rel}: ${message || `missing ${needle}`}`);
}
function parseJson(rel) {
  const text = read(rel);
  try { return JSON.parse(text); }
  catch (error) { failures.push(`${rel}: invalid JSON: ${error.message}`); return {}; }
}

const app = read('src/renderer/app.ts');
requireIncludes('src/renderer/app.ts', 'PASS232_WEBVIEW_RUNTIME_COMMAND_GATE', 'must install PASS232 runtime command gate marker');
requireIncludes('src/renderer/app.ts', 'pass232InstallWebviewRuntimeCommandGate(webview, tabId);', 'newly created webviews must install the runtime command gate');
requireIncludes('src/renderer/app.ts', 'pass232StartGlobalWebviewRuntimeGate', 'must start a global WebView runtime gate for existing/future webviews');
requireIncludes('src/renderer/app.ts', 'new MutationObserver', 'must observe dynamically added WebViews beyond the primary createTab path');
requireIncludes('src/renderer/app.ts', "document.querySelectorAll<Electron.WebviewTag>('webview')", 'must patch existing webviews at runtime');
requireIncludes('src/renderer/app.ts', "webview.addEventListener('dom-ready', () => pass232FlushRuntimeGateQueue(webview, 'dom-ready'))", 'must flush runtime commands only after dom-ready');
requireIncludes('src/renderer/app.ts', "webview.addEventListener('did-start-loading', () =>", 'must reset dom-ready state when a webview starts a new navigation');
requireIncludes('src/renderer/app.ts', 'pass232PatchAsyncRuntimeMethod(webview, tabId, methodName)', 'async/void WebView methods must be patched through readiness gate');
requireIncludes('src/renderer/app.ts', 'pass232PatchSyncRuntimeMethod<boolean>(webview, tabId, \'canGoBack\', false)', 'canGoBack must fail closed before readiness');
requireIncludes('src/renderer/app.ts', 'pass232PatchSyncRuntimeMethod<boolean>(webview, tabId, \'canGoForward\', false)', 'canGoForward must fail closed before readiness');
requireIncludes('src/renderer/app.ts', 'pass232PatchSyncRuntimeMethod<boolean>(webview, tabId, \'isDevToolsOpened\', false)', 'DevTools sync probe must fail closed before readiness');
requireIncludes('src/renderer/app.ts', 'pass232LastRuntimeGateError', 'runtime gate must expose non-secret diagnostics');
requireIncludes('src/renderer/app.ts', 'pass232LastQueuedRuntimeCommand', 'runtime gate must expose queue diagnostics');
requireIncludes('src/renderer/app.ts', 'pass232LastRuntimeGateTimeout', 'runtime gate must expose wait-time diagnostics without throwing');

const requiredMethods = [
  'loadURL',
  'reload',
  'reloadIgnoringCache',
  'stop',
  'goBack',
  'goForward',
  'print',
  'openDevTools',
  'closeDevTools',
  'executeJavaScript',
  'capturePage',
  'send',
  'insertCSS',
  'setZoomFactor',
  'setZoomLevel'
];
for (const methodName of requiredMethods) {
  if (!app.includes(`'${methodName}'`)) failures.push(`src/renderer/app.ts: runtime gate method list must include ${methodName}`);
}

const pkg = parseJson('package.json');
if (pkg.scripts?.['verify:pass-232-webview-runtime-command-sweep-release-closeout'] !== 'node scripts/verify-pass-232-webview-runtime-command-sweep-release-closeout.mjs') {
  failures.push('package.json: verify:pass-232-webview-runtime-command-sweep-release-closeout script is missing or incorrect');
}
if (typeof getReleaseBlockersContract(pkg) !== 'string' || !getReleaseBlockersContract(pkg).includes('verify:pass-232-webview-runtime-command-sweep-release-closeout')) {
  failures.push('package.json: verify:release-blockers must include PASS232 verifier');
}

requireIncludes('docs/webview-runtime-command-sweep-release-closeout.md', 'WebView Runtime Command Sweep', 'PASS232 docs missing title');
requireIncludes('docs/webview-runtime-command-sweep-release-closeout.md', 'executeJavaScript', 'docs must call out executeJavaScript/capture class of remaining WebView commands');
requireIncludes('docs/webview-runtime-command-sweep-release-closeout.md', 'release blocker', 'docs must treat recurrence as a release blocker');
requireIncludes('docs/qa/pass232-webview-runtime-command-sweep-release-closeout.md', 'The WebView must be attached to the DOM', 'QA doc must include exact runtime diagnostic');
requireIncludes('README-PASS232.md', 'PASS232', 'README-PASS232 must identify the pass');
requireIncludes('docs/known-issues.md', 'PASS232_WEBVIEW_RUNTIME_COMMAND_GATE', 'known issues must include PASS232 release-blocker closeout marker');

if (failures.length) {
  console.error('[PASS232][FAIL] WebView runtime command sweep verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('[PASS232][OK] WebView runtime command sweep verified. Existing/future WebViews are patched behind attach/dom-ready and release blockers include the runtime closeout gate.');
