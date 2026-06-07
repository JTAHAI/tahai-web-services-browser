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
requireIncludes('src/renderer/app.ts', 'PASS235_WEBVIEW_PROTOTYPE_LIFECYCLE_GATE', 'must install PASS235 lifecycle gate marker');
requireIncludes('src/renderer/app.ts', 'pass235PatchPrototypeFromProbe', 'must patch the WebView prototype, not only created instances');
requireIncludes('src/renderer/app.ts', 'pass235SafeLoadURL', 'must replace early loadURL calls with src-first safe navigation');
requireIncludes('src/renderer/app.ts', "webview.setAttribute('src', nextUrl)", 'safe load wrapper must fall back to src before dom-ready');
requireIncludes('src/renderer/app.ts', 'pass235BindWebviewLifecycle(webview, tabId);', 'createTab WebViews must bind PASS235 lifecycle state');
requireIncludes('src/renderer/app.ts', 'pass235PatchInstance(webview, tabId);', 'createTab WebViews must install instance fallback patch');
requireIncludes('src/renderer/app.ts', 'new MutationObserver', 'must patch dynamically added WebViews');
requireIncludes('src/renderer/app.ts', "document.querySelectorAll<Electron.WebviewTag>('webview')", 'must patch existing WebViews during boot');
requireIncludes('src/renderer/app.ts', 'pass235SafeCanGoBack', 'history probes must fail closed before dom-ready');
requireIncludes('src/renderer/app.ts', 'pass235SafeCanGoForward', 'history probes must fail closed before dom-ready');
requireIncludes('src/renderer/app.ts', 'pass235LastLifecycleDiagnostic', 'non-secret runtime diagnostics must be available for local smoke evidence');
requireIncludes('src/renderer/app.ts', 'pass235SrcFallback', 'loadURL fallback must be diagnosable');

const forbiddenDirectCalls = [
  'tab.webview.loadURL(',
  'runtimeTab.webview.loadURL(',
  'activeTab.webview.loadURL(',
  'targetTab.webview.loadURL(',
  'active.webview.loadURL(',
  'webview.loadURL(',
  'tab.webview.canGoBack()',
  'tab.webview.canGoForward()',
  'activeTab.webview.canGoBack()',
  'activeTab.webview.canGoForward()',
  'tab.webview.reload()',
  'tab.webview.print()'
];
for (const token of forbiddenDirectCalls) {
  if (app.includes(token)) failures.push(`src/renderer/app.ts: forbidden direct WebView lifecycle call remains: ${token}`);
}

const requiredMethodNames = [
  'loadURL', 'reload', 'reloadIgnoringCache', 'stop', 'goBack', 'goForward', 'print',
  'openDevTools', 'closeDevTools', 'executeJavaScript', 'capturePage', 'send', 'insertCSS',
  'setZoomFactor', 'setZoomLevel', 'canGoBack', 'canGoForward', 'isDevToolsOpened', 'isLoading', 'getURL', 'getTitle'
];
for (const methodName of requiredMethodNames) {
  if (!app.includes(`'${methodName}'`)) failures.push(`src/renderer/app.ts: PASS235 lifecycle method coverage missing ${methodName}`);
}

const pkg = parseJson('package.json');
if (pkg.scripts?.['verify:pass-235-webview-prototype-lifecycle-hard-close'] !== 'node scripts/verify-pass-235-webview-prototype-lifecycle-hard-close.mjs') {
  failures.push('package.json: verify:pass-235-webview-prototype-lifecycle-hard-close script is missing or incorrect');
}
if (typeof getReleaseBlockersContract(pkg) !== 'string' || !getReleaseBlockersContract(pkg).includes('verify:pass-235-webview-prototype-lifecycle-hard-close')) {
  failures.push('package.json: verify:release-blockers must include PASS235 verifier');
}

requireIncludes('docs/webview-prototype-lifecycle-hard-close.md', 'WebView Prototype Lifecycle Hard Close', 'PASS235 docs missing title');
requireIncludes('docs/webview-prototype-lifecycle-hard-close.md', 'src-first', 'docs must explain src-first loadURL fallback');
requireIncludes('docs/webview-prototype-lifecycle-hard-close.md', 'prototype', 'docs must explain prototype-level hardening');
requireIncludes('docs/qa/pass235-webview-prototype-lifecycle-hard-close.md', 'The WebView must be attached to the DOM', 'QA must include exact failing runtime diagnostic');
requireIncludes('README-PASS235.md', 'PASS235', 'README-PASS235 must identify the pass');
requireIncludes('docs/known-issues.md', 'PASS235_WEBVIEW_PROTOTYPE_LIFECYCLE_GATE', 'known issues must include PASS235 release-blocker marker');

if (failures.length) {
  console.error('[PASS235][FAIL] WebView prototype lifecycle hard-close verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('[PASS235][OK] WebView prototype lifecycle hard close verified. Direct boot-time WebView method calls are routed through src-first/prototype lifecycle gates.');
