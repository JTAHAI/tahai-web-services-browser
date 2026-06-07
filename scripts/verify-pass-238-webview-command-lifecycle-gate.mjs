#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const appPath = path.join(root, 'src', 'renderer', 'app.ts');
const pkgPath = path.join(root, 'package.json');
const app = fs.readFileSync(appPath, 'utf8');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

function fail(code, detail) {
  console.error(`[PASS238][FAIL] ${code}: ${detail}`);
  process.exit(1);
}
function mustInclude(haystack, needle, code) {
  if (!haystack.includes(needle)) fail(code, `Missing ${needle}`);
}
function mustNotInclude(haystack, needle, code) {
  if (haystack.includes(needle)) fail(code, `Forbidden direct lifecycle call still present: ${needle}`);
}

mustInclude(app, 'PASS238_WEBVIEW_COMMAND_LIFECYCLE_GATE', 'marker');
mustInclude(app, 'function pass238SafeCanGoBack', 'safe-can-go-back');
mustInclude(app, 'function pass238SafeCanGoForward', 'safe-can-go-forward');
mustInclude(app, 'function pass238SafeWebviewCommand', 'safe-command');
mustInclude(app, 'async function pass238SafeExecuteJavaScript', 'safe-execute-javascript');
mustInclude(app, "webview.dataset.pass236DomReady = 'false';", 'pending-on-safe-load');
mustInclude(app, 'pass236MarkWebviewDomPending(webview, tabId);', 'pending-on-did-start-loading');
mustInclude(app, "pass238SafeWebviewCommand(tab.webview, 'reload'", 'reload-gated');
mustInclude(app, "pass238SafeWebviewCommand(tab.webview, 'print'", 'print-gated');
mustInclude(app, 'pass238SafeExecuteJavaScript<Partial<PageCapture>>', 'capture-gated');
mustInclude(app, 'pass238SafeExecuteJavaScript<Partial<EndpointSnapshot>>', 'endpoint-gated');
mustInclude(app, 'pass238SafeExecuteJavaScript<Partial<RouteMapPage>>', 'route-map-gated');
mustInclude(app, 'pass238SafeExecuteJavaScript<Partial<DevAuditPage>>', 'developer-audit-gated');
mustInclude(app, "pass238CanInvokeWebviewCommand(runtimeTab.webview, 'setZoomFactor'", 'zoom-factor-gated');
mustInclude(app, "pass238CanInvokeWebviewCommand(runtimeTab.webview, 'setVisualZoomLevelLimits'", 'zoom-limits-gated');

const forbiddenDirectPatterns = [
  'tab.webview.canGoBack()',
  'tab.webview.canGoForward()',
  'tab.webview.goBack()',
  'tab.webview.goForward()',
  'tab.webview.reload()',
  'tab.webview.print()',
  'tab.webview.executeJavaScript(',
  'activeTab.webview.executeJavaScript(',
  'targetTab.webview.executeJavaScript('
];
for (const pattern of forbiddenDirectPatterns) mustNotInclude(app, pattern, `direct-${pattern}`);

if (pkg.scripts?.['verify:pass-238-webview-command-lifecycle-gate'] !== 'node scripts/verify-pass-238-webview-command-lifecycle-gate.mjs') {
  fail('package-script', 'package.json is missing verify:pass-238-webview-command-lifecycle-gate');
}
if (!getReleaseBlockersContract(pkg).includes('verify:pass-238-webview-command-lifecycle-gate')) {
  fail('release-blocker-wire', 'verify:release-blockers does not include PASS238 verifier');
}

console.log('[PASS238][OK] WebView command lifecycle gate verified.');
