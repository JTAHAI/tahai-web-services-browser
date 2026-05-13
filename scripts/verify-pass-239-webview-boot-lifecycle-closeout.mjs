#!/usr/bin/env node
import fs from 'node:fs';

const app = fs.readFileSync('src/renderer/app.ts', 'utf8');
const docs = fs.readFileSync('docs/pass239-webview-boot-lifecycle-closeout.md', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

function fail(message) {
  console.error(`[PASS239][FAIL] ${message}`);
  process.exit(1);
}
function mustInclude(text, needle, label) {
  if (!text.includes(needle)) fail(`${label}: missing ${needle}`);
}
function mustNotInclude(text, needle, label) {
  if (text.includes(needle)) fail(`${label}: forbidden ${needle}`);
}

mustInclude(app, "PASS238_WEBVIEW_COMMAND_LIFECYCLE_GATE", 'safe lifecycle gate dependency');
mustInclude(app, "canGoBack: tab ? pass238SafeCanGoBack(tab.webview, `truth:${tab.id}:back`) : false", 'navigation truth back wrapper');
mustInclude(app, "canGoForward: tab ? pass238SafeCanGoForward(tab.webview, `truth:${tab.id}:forward`) : false", 'navigation truth forward wrapper');
mustNotInclude(app, "canGoBack: Boolean(tab?.webview?.canGoBack?.())", 'raw navigation truth back probe');
mustNotInclude(app, "canGoForward: Boolean(tab?.webview?.canGoForward?.())", 'raw navigation truth forward probe');
mustNotInclude(app, "webview.src = safeUrl;", 'pre-attach initial src assignment');
mustInclude(app, "webview.dataset.pass239InitialSrcDeferred = 'true';", 'deferred initial src marker');
mustInclude(app, "pass236SafeLoadURL(webview, safeUrl);", 'attached initial safe load');
mustInclude(app, "webview.dataset.pass239InitialSrcDeferredLoaded = 'true';", 'deferred load completion marker');
mustInclude(docs, 'PASS239', 'pass docs');
if (pkg.scripts['verify:pass-239-webview-boot-lifecycle-closeout'] !== 'node scripts/verify-pass-239-webview-boot-lifecycle-closeout.mjs') {
  fail('package verifier script missing or mismatched');
}
console.log('[PASS239][OK] WebView boot lifecycle closeout verified.');
