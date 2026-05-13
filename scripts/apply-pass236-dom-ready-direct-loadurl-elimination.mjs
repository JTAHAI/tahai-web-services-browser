#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repo = process.cwd();
const PASS = 'PASS236 — DOM-Ready Direct loadURL Elimination';
function file(rel) { return path.join(repo, rel); }
function read(rel) {
  const full = file(rel);
  if (!fs.existsSync(full)) throw new Error(`${PASS}: missing ${rel}`);
  return fs.readFileSync(full, 'utf8');
}
function write(rel, content) {
  fs.mkdirSync(path.dirname(file(rel)), { recursive: true });
  fs.writeFileSync(file(rel), content, 'utf8');
}
function appendOnce(rel, marker, block) {
  const full = file(rel);
  const current = fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
  if (current.includes(marker)) return;
  write(rel, `${current}${current.endsWith('\n') || current.length === 0 ? '' : '\n'}${block.trimEnd()}\n`);
}
function parseJson(rel) {
  return JSON.parse(read(rel));
}

const appRel = 'src/renderer/app.ts';
let app = read(appRel);
const marker = 'PASS236_DOM_READY_DIRECT_LOADURL_ELIMINATION';

if (!app.includes(marker)) {
  const helper = `
const PASS236_DOM_READY_DIRECT_LOADURL_ELIMINATION = 'PASS236_DOM_READY_DIRECT_LOADURL_ELIMINATION';
const PASS236_DOM_READY_ERROR_PATTERN = /WebView must be attached to the DOM|dom-ready event emitted|must be attached/i;
function pass236IsDomReadyLifecycleError(message: unknown): boolean {
  return PASS236_DOM_READY_ERROR_PATTERN.test(String(message || ''));
}
function pass236RecordDomReadyLifecycle(label: string, detail: unknown): void {
  const body = document.body;
  if (!body) return;
  body.dataset.pass236DomReadyLifecycleGate = PASS236_DOM_READY_DIRECT_LOADURL_ELIMINATION;
  body.dataset.pass236LastDomReadyLifecycleLabel = String(label || 'unknown').slice(0, 160);
  body.dataset.pass236LastDomReadyLifecycleDetail = String(detail || '').slice(0, 900);
}
function pass236SafeLoadURL(webview: Electron.WebviewTag, targetUrl: string, options?: unknown): Promise<void> {
  const safeTarget = String(targetUrl || '');
  webview.dataset.pass236LastSafeLoadUrl = safeTarget.slice(0, 500);
  webview.dataset.pass236LastSafeLoadAt = new Date().toISOString();
  webview.dataset.pass236DomReadyAtLoad = webview.dataset.pass236DomReady || 'false';
  webview.setAttribute('src', safeTarget);
  pass236RecordDomReadyLifecycle('src-navigation', safeTarget);
  void options;
  return Promise.resolve();
}
function pass236MarkWebviewDomReady(webview: Electron.WebviewTag, tabId: string): void {
  webview.dataset.pass236DomReady = 'true';
  webview.dataset.pass236DomReadyTabId = tabId;
  webview.dataset.pass236DomReadyAt = new Date().toISOString();
  pass236RecordDomReadyLifecycle('dom-ready', tabId);
}
function pass236MarkWebviewDomPending(webview: Electron.WebviewTag, tabId: string): void {
  webview.dataset.pass236DomReady = 'false';
  webview.dataset.pass236DomPendingTabId = tabId;
  webview.dataset.pass236DomPendingAt = new Date().toISOString();
}
`;
  const createTabNeedle = 'function createTab(url: string): string {';
  if (!app.includes(createTabNeedle)) {
    throw new Error(`${PASS}: could not find createTab anchor`);
  }
  app = app.replace(createTabNeedle, `${helper}\n${createTabNeedle}`);
}

// PASS236 hard close: never call the Electron WebView loadURL method from renderer runtime paths.
// Use the declarative src assignment wrapper instead. That avoids the Electron throw before attach/dom-ready.
const loadUrlPatterns = [
  /\btab\.webview\.loadURL\(/g,
  /\bruntimeTab\.webview\.loadURL\(/g,
  /\bactiveTab\.webview\.loadURL\(/g,
  /\btargetTab\.webview\.loadURL\(/g,
  /\bactive\.webview\.loadURL\(/g,
  /\bwebview\.loadURL\(/g
];
const loadUrlReplacements = new Map([
  ['tab.webview.loadURL(', 'pass236SafeLoadURL(tab.webview, '],
  ['runtimeTab.webview.loadURL(', 'pass236SafeLoadURL(runtimeTab.webview, '],
  ['activeTab.webview.loadURL(', 'pass236SafeLoadURL(activeTab.webview, '],
  ['targetTab.webview.loadURL(', 'pass236SafeLoadURL(targetTab.webview, '],
  ['active.webview.loadURL(', 'pass236SafeLoadURL(active.webview, '],
  ['webview.loadURL(', 'pass236SafeLoadURL(webview, ']
]);
for (const [needle, replacement] of loadUrlReplacements.entries()) {
  if (app.includes(needle)) app = app.split(needle).join(replacement);
}

// Mark WebViews as pending before they attach and ready when dom-ready emits.
const datasetNeedle = 'webview.dataset.pass106SiteViewTabId = tabId;';
if (app.includes(datasetNeedle) && !app.includes("pass236MarkWebviewDomPending(webview, tabId);")) {
  app = app.replace(datasetNeedle, `${datasetNeedle} pass236MarkWebviewDomPending(webview, tabId);`);
}
const domReadyNeedle = "webview.addEventListener('dom-ready', () => pass74ScheduleMissionPaneRelayoutRetries('load'));";
if (app.includes(domReadyNeedle) && !app.includes("pass236MarkWebviewDomReady(webview, tabId);")) {
  app = app.replace(domReadyNeedle, "webview.addEventListener('dom-ready', () => { pass236MarkWebviewDomReady(webview, tabId); pass74ScheduleMissionPaneRelayoutRetries('load'); });");
}

// Make the existing runtime diagnostic preserve the exact lifecycle error detail without hiding it.
const errorNeedle = "window.addEventListener('error', (event) => { showBootDiagnostic(`Renderer error: ${event.message || 'unknown error'}`); });";
if (app.includes(errorNeedle) && !app.includes("pass236IsDomReadyLifecycleError(event.message)")) {
  app = app.replace(errorNeedle, "window.addEventListener('error', (event) => { if (pass236IsDomReadyLifecycleError(event.message)) pass236RecordDomReadyLifecycle('renderer-error', event.message); showBootDiagnostic(`Renderer error: ${event.message || 'unknown error'}`); });");
}

write(appRel, app);

const pkg = parseJson('package.json');
pkg.scripts = pkg.scripts || {};
pkg.scripts['verify:pass-236-dom-ready-direct-loadurl-elimination'] = 'node scripts/verify-pass-236-dom-ready-direct-loadurl-elimination.mjs';
const releaseBlockerCmd = 'npm run verify:pass-236-dom-ready-direct-loadurl-elimination';
if (typeof pkg.scripts['verify:release-blockers'] === 'string') {
  if (!pkg.scripts['verify:release-blockers'].includes('verify:pass-236-dom-ready-direct-loadurl-elimination')) {
    pkg.scripts['verify:release-blockers'] = `${pkg.scripts['verify:release-blockers']} && ${releaseBlockerCmd}`;
  }
} else {
  pkg.scripts['verify:release-blockers'] = releaseBlockerCmd;
}
write('package.json', `${JSON.stringify(pkg, null, 2)}\n`);

appendOnce('docs/known-issues.md', 'PASS236_DOM_READY_DIRECT_LOADURL_ELIMINATION', `
## PASS236 DOM-ready direct loadURL elimination

Marker: PASS236_DOM_READY_DIRECT_LOADURL_ELIMINATION

The release remains blocked if the renderer shows this exact diagnostic after PASS236:

\`\`\`text
The WebView must be attached to the DOM and the dom-ready event emitted before this method can be called.
\`\`\`

PASS236 removes direct renderer calls to \`webview.loadURL(...)\` and routes blocked-navigation and load-failure fallback navigation through a \`src\` assignment wrapper instead. This is intentionally stricter than prior queueing attempts because the installed app continued to hit the Electron lifecycle throw.
`);

console.log('[PASS236][APPLY] DOM-ready direct loadURL elimination applied.');
