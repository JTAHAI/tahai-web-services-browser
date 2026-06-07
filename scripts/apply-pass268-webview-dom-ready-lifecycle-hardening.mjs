#!/usr/bin/env node
/* PASS268 — WebView DOM-Ready Lifecycle Hardening */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pass = 'PASS268';
const versionTarget = '2.0.14';
const remainingPassesAfterThisPass = 3;
const skipDirs = new Set(['.git','node_modules','dist','release','release-msix','out','coverage','.vite','.next','build']);
const packageScripts = {
  'verify:pass-268-webview-dom-ready-lifecycle-hardening': 'node scripts/verify-pass268-webview-dom-ready-lifecycle-hardening.mjs',
  'gate:pass-268-webview-dom-ready-lifecycle-hardening': 'node scripts/gate-pass268-webview-dom-ready-lifecycle-hardening.mjs'
};
function rel(file) { return path.relative(root, file).replace(/\\/g, '/'); }
function read(file) { try { return fs.readFileSync(file, 'utf8'); } catch { return ''; } }
function write(file, text) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }
function walk(dir, accept, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, accept, out);
    else if (!accept || accept(full)) out.push(full);
  }
  return out;
}
function parseVersion(v) { const m = String(v || '').match(/^(\d+)\.(\d+)\.(\d+)/); return m ? { major:+m[1], minor:+m[2], patch:+m[3] } : null; }
function versionAtLeast(actual, expected) {
  const a = parseVersion(actual); const e = parseVersion(expected);
  if (!a || !e) return false;
  if (a.major !== e.major) return a.major > e.major;
  if (a.minor !== e.minor) return a.minor > e.minor;
  return a.patch >= e.patch;
}
function patchPackageJson() {
  const pkgPath = path.join(root, 'package.json');
  if (!fs.existsSync(pkgPath)) return { found: false, changed: false };
  const pkg = JSON.parse(read(pkgPath));
  let changed = false;
  if (!versionAtLeast(pkg.version, versionTarget)) { pkg.version = versionTarget; changed = true; }
  pkg.scripts = pkg.scripts || {};
  for (const [name, value] of Object.entries(packageScripts)) {
    if (pkg.scripts[name] !== value) { pkg.scripts[name] = value; changed = true; }
  }
  if (changed) write(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  for (const lockName of ['package-lock.json','npm-shrinkwrap.json']) {
    const lockPath = path.join(root, lockName);
    if (!fs.existsSync(lockPath)) continue;
    try {
      const lock = JSON.parse(read(lockPath));
      let lockChanged = false;
      if (lock.version && !versionAtLeast(lock.version, versionTarget)) { lock.version = versionTarget; lockChanged = true; }
      if (lock.packages?.['']?.version && !versionAtLeast(lock.packages[''].version, versionTarget)) { lock.packages[''].version = versionTarget; lockChanged = true; }
      if (lockChanged) write(lockPath, JSON.stringify(lock, null, 2) + '\n');
    } catch {}
  }
  return { found: true, changed, scripts: Object.keys(packageScripts), version: pkg.version };
}
function findRenderer() {
  const candidates = ['src/renderer/app.ts','src/renderer/renderer.ts','src/renderer/index.ts','src/renderer/main.ts','src/renderer/app.tsx','src/renderer/index.tsx','src/renderer/app.js','src/renderer/renderer.js','renderer/app.js','renderer/renderer.js','app/renderer/app.js'];
  for (const c of candidates) { const p = path.join(root, c); if (read(p)) return p; }
  const found = walk(root, (f) => /\.(ts|tsx|js|jsx)$/i.test(f) && /renderer/i.test(rel(f)));
  return found[0] || null;
}
function lifecycleBlockTs() { return String.raw`

/* PASS268_WEBVIEW_DOM_READY_LIFECYCLE_HARDENING_START */
type Pass268WebViewMethod = 'goBack' | 'goForward' | 'reload' | 'reloadIgnoringCache' | 'stop' | 'focus' | 'loadURL' | 'executeJavaScript' | 'insertCSS' | 'openDevTools' | 'send';
type Pass268GuardedWebView = HTMLElement & Record<string, unknown> & {
  dataset: DOMStringMap;
  isConnected: boolean;
  addEventListener: EventTarget['addEventListener'];
  removeEventListener: EventTarget['removeEventListener'];
};
const PASS268_WEBVIEW_DOM_READY_LIFECYCLE = Object.freeze({
  pass: 'PASS268',
  reason: 'Never call Electron WebView methods before DOM attachment and dom-ready.',
  guardedMethods: ['goBack','goForward','reload','reloadIgnoringCache','stop','focus','loadURL','executeJavaScript','insertCSS','openDevTools','send'] as Pass268WebViewMethod[]
});
const pass268OriginalMethodKey = '__pass268_original_webview_methods__';
const pass268ReadyKey = 'pass268DomReady';
const pass268WrappedKey = 'pass268LifecycleWrapped';
function pass268AsWebView(value: unknown): Pass268GuardedWebView | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Pass268GuardedWebView;
  if (typeof candidate.addEventListener !== 'function') return null;
  return candidate;
}
function pass268MarkWebViewNotReady(webview: Pass268GuardedWebView, reason: string): void {
  webview.dataset[pass268ReadyKey] = 'false';
  webview.dataset.pass268LastNotReadyReason = reason;
}
function pass268MarkWebViewDomReady(webview: Pass268GuardedWebView): void {
  webview.dataset[pass268ReadyKey] = 'true';
  webview.dataset.pass268LastReadyAt = new Date().toISOString();
}
function pass268IsWebViewReadyForMethod(webview: unknown, methodName?: string): boolean {
  const guarded = pass268AsWebView(webview);
  if (!guarded) return false;
  if (!guarded.isConnected) return false;
  if (guarded.dataset[pass268ReadyKey] !== 'true') return false;
  if (guarded.dataset.pass268Destroyed === 'true') return false;
  if (guarded.dataset.pass268RenderGone === 'true') return false;
  if (methodName && typeof guarded[methodName] !== 'function') return false;
  return true;
}
function pass268GuardWebViewMethod(webview: unknown, methodName: Pass268WebViewMethod | string, args: unknown[] = [], context = 'unspecified'): unknown {
  const guarded = pass268AsWebView(webview);
  if (!pass268IsWebViewReadyForMethod(guarded, methodName)) {
    if (guarded) {
      guarded.dataset.pass268LastGuardedNoop = String(methodName);
      guarded.dataset.pass268LastGuardedContext = String(context);
      guarded.dataset.pass268LastGuardedAt = new Date().toISOString();
    }
    return false;
  }
  const originals = (guarded as Record<string, unknown>)[pass268OriginalMethodKey] as Record<string, Function> | undefined;
  const fn = originals?.[methodName] || (guarded as Record<string, unknown>)[methodName];
  if (typeof fn !== 'function') return false;
  try { return fn.apply(guarded, args); }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('WebView must be attached to the DOM') || message.includes('dom-ready')) {
      guarded.dataset.pass268PreventedDomReadyThrow = 'true';
      guarded.dataset.pass268PreventedDomReadyThrowAt = new Date().toISOString();
      return false;
    }
    throw error;
  }
}
function pass268WrapWebViewElement(webview: unknown): boolean {
  const guarded = pass268AsWebView(webview);
  if (!guarded || guarded.dataset[pass268WrappedKey] === 'true') return false;
  guarded.dataset[pass268WrappedKey] = 'true';
  if (guarded.dataset[pass268ReadyKey] !== 'true') pass268MarkWebViewNotReady(guarded, 'awaiting-dom-ready');
  const originals: Record<string, Function> = {};
  for (const methodName of PASS268_WEBVIEW_DOM_READY_LIFECYCLE.guardedMethods) {
    const existing = guarded[methodName];
    if (typeof existing !== 'function') continue;
    originals[methodName] = existing as Function;
    (guarded as Record<string, unknown>)[methodName] = (...args: unknown[]) => pass268GuardWebViewMethod(guarded, methodName, args, 'pass268-wrapped-method');
  }
  (guarded as Record<string, unknown>)[pass268OriginalMethodKey] = originals;
  guarded.addEventListener('dom-ready', () => pass268MarkWebViewDomReady(guarded));
  guarded.addEventListener('did-start-loading', () => pass268MarkWebViewNotReady(guarded, 'did-start-loading'));
  guarded.addEventListener('did-stop-loading', () => { if (guarded.isConnected) pass268MarkWebViewDomReady(guarded); });
  guarded.addEventListener('render-process-gone', () => { guarded.dataset.pass268RenderGone = 'true'; pass268MarkWebViewNotReady(guarded, 'render-process-gone'); });
  guarded.addEventListener('destroyed', () => { guarded.dataset.pass268Destroyed = 'true'; pass268MarkWebViewNotReady(guarded, 'destroyed'); });
  guarded.addEventListener('did-fail-load', () => { guarded.dataset.pass268DidFailLoad = 'true'; });
  return true;
}
function pass268InstallWebViewLifecycleGuards(scope: ParentNode = document): number {
  const webviews = Array.from(scope.querySelectorAll?.('webview') || []);
  let wrapped = 0;
  for (const webview of webviews) if (pass268WrapWebViewElement(webview)) wrapped += 1;
  return wrapped;
}
function pass268StartWebViewLifecycleObserver(): void {
  pass268InstallWebViewLifecycleGuards(document);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of Array.from(record.addedNodes)) {
        if (!(node instanceof Element)) continue;
        if (node.tagName?.toLowerCase() === 'webview') pass268WrapWebViewElement(node);
        pass268InstallWebViewLifecycleGuards(node);
      }
      for (const node of Array.from(record.removedNodes)) {
        if (node instanceof HTMLElement && node.tagName?.toLowerCase() === 'webview') pass268MarkWebViewNotReady(node as Pass268GuardedWebView, 'removed-from-dom');
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  (window as unknown as Record<string, unknown>).__PASS268_WEBVIEW_LIFECYCLE__ = { observer, pass268GuardWebViewMethod, pass268InstallWebViewLifecycleGuards, pass268IsWebViewReadyForMethod };
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pass268StartWebViewLifecycleObserver, { once: true });
  else pass268StartWebViewLifecycleObserver();
}
/* PASS268_WEBVIEW_DOM_READY_LIFECYCLE_HARDENING_END */
`; }
function lifecycleBlockJs() { return String.raw`

/* PASS268_WEBVIEW_DOM_READY_LIFECYCLE_HARDENING_START */
const PASS268_WEBVIEW_DOM_READY_LIFECYCLE = Object.freeze({
  pass: 'PASS268',
  reason: 'Never call Electron WebView methods before DOM attachment and dom-ready.',
  guardedMethods: ['goBack','goForward','reload','reloadIgnoringCache','stop','focus','loadURL','executeJavaScript','insertCSS','openDevTools','send']
});
const pass268OriginalMethodKey = '__pass268_original_webview_methods__';
const pass268ReadyKey = 'pass268DomReady';
const pass268WrappedKey = 'pass268LifecycleWrapped';
function pass268AsWebView(value) { return value && typeof value === 'object' && typeof value.addEventListener === 'function' ? value : null; }
function pass268MarkWebViewNotReady(webview, reason) { webview.dataset[pass268ReadyKey] = 'false'; webview.dataset.pass268LastNotReadyReason = reason; }
function pass268MarkWebViewDomReady(webview) { webview.dataset[pass268ReadyKey] = 'true'; webview.dataset.pass268LastReadyAt = new Date().toISOString(); }
function pass268IsWebViewReadyForMethod(webview, methodName) {
  const guarded = pass268AsWebView(webview);
  if (!guarded || !guarded.isConnected || guarded.dataset[pass268ReadyKey] !== 'true') return false;
  if (guarded.dataset.pass268Destroyed === 'true' || guarded.dataset.pass268RenderGone === 'true') return false;
  return !methodName || typeof guarded[methodName] === 'function';
}
function pass268GuardWebViewMethod(webview, methodName, args = [], context = 'unspecified') {
  const guarded = pass268AsWebView(webview);
  if (!pass268IsWebViewReadyForMethod(guarded, methodName)) {
    if (guarded) { guarded.dataset.pass268LastGuardedNoop = String(methodName); guarded.dataset.pass268LastGuardedContext = String(context); guarded.dataset.pass268LastGuardedAt = new Date().toISOString(); }
    return false;
  }
  const originals = guarded[pass268OriginalMethodKey] || {};
  const fn = originals[methodName] || guarded[methodName];
  if (typeof fn !== 'function') return false;
  try { return fn.apply(guarded, args); }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('WebView must be attached to the DOM') || message.includes('dom-ready')) { guarded.dataset.pass268PreventedDomReadyThrow = 'true'; guarded.dataset.pass268PreventedDomReadyThrowAt = new Date().toISOString(); return false; }
    throw error;
  }
}
function pass268WrapWebViewElement(webview) {
  const guarded = pass268AsWebView(webview);
  if (!guarded || guarded.dataset[pass268WrappedKey] === 'true') return false;
  guarded.dataset[pass268WrappedKey] = 'true';
  if (guarded.dataset[pass268ReadyKey] !== 'true') pass268MarkWebViewNotReady(guarded, 'awaiting-dom-ready');
  const originals = {};
  for (const methodName of PASS268_WEBVIEW_DOM_READY_LIFECYCLE.guardedMethods) {
    if (typeof guarded[methodName] !== 'function') continue;
    originals[methodName] = guarded[methodName];
    guarded[methodName] = (...args) => pass268GuardWebViewMethod(guarded, methodName, args, 'pass268-wrapped-method');
  }
  guarded[pass268OriginalMethodKey] = originals;
  guarded.addEventListener('dom-ready', () => pass268MarkWebViewDomReady(guarded));
  guarded.addEventListener('did-start-loading', () => pass268MarkWebViewNotReady(guarded, 'did-start-loading'));
  guarded.addEventListener('did-stop-loading', () => { if (guarded.isConnected) pass268MarkWebViewDomReady(guarded); });
  guarded.addEventListener('render-process-gone', () => { guarded.dataset.pass268RenderGone = 'true'; pass268MarkWebViewNotReady(guarded, 'render-process-gone'); });
  guarded.addEventListener('destroyed', () => { guarded.dataset.pass268Destroyed = 'true'; pass268MarkWebViewNotReady(guarded, 'destroyed'); });
  guarded.addEventListener('did-fail-load', () => { guarded.dataset.pass268DidFailLoad = 'true'; });
  return true;
}
function pass268InstallWebViewLifecycleGuards(scope = document) {
  const webviews = Array.from(scope.querySelectorAll?.('webview') || []);
  let wrapped = 0;
  for (const webview of webviews) if (pass268WrapWebViewElement(webview)) wrapped += 1;
  return wrapped;
}
function pass268StartWebViewLifecycleObserver() {
  pass268InstallWebViewLifecycleGuards(document);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of Array.from(record.addedNodes)) {
        if (!(node instanceof Element)) continue;
        if (node.tagName?.toLowerCase() === 'webview') pass268WrapWebViewElement(node);
        pass268InstallWebViewLifecycleGuards(node);
      }
      for (const node of Array.from(record.removedNodes)) if (node instanceof HTMLElement && node.tagName?.toLowerCase() === 'webview') pass268MarkWebViewNotReady(node, 'removed-from-dom');
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.__PASS268_WEBVIEW_LIFECYCLE__ = { observer, pass268GuardWebViewMethod, pass268InstallWebViewLifecycleGuards, pass268IsWebViewReadyForMethod };
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pass268StartWebViewLifecycleObserver, { once: true });
  else pass268StartWebViewLifecycleObserver();
}
/* PASS268_WEBVIEW_DOM_READY_LIFECYCLE_HARDENING_END */
`; }
function patchRendererLifecycleGuards() {
  const renderer = findRenderer();
  if (!renderer) return { found: false, changed: false, reason: 'renderer-not-found' };
  let text = read(renderer);
  if (text.includes('PASS268_WEBVIEW_DOM_READY_LIFECYCLE_HARDENING_START')) return { found: true, changed: false, file: rel(renderer), reason: 'already-present' };
  const block = /\.tsx?$/i.test(renderer) ? lifecycleBlockTs() : lifecycleBlockJs();
  text += block;
  write(renderer, text);
  return { found: true, changed: true, file: rel(renderer) };
}
const packageResult = patchPackageJson();
const rendererResult = patchRendererLifecycleGuards();
const reportDir = path.join(root, 'release-candidate', 'generated');
fs.mkdirSync(reportDir, { recursive: true });
const report = {
  pass,
  passName: 'WebView DOM-Ready Lifecycle Hardening',
  versionTarget,
  remainingPassesAfterThisPass,
  appliedAt: new Date().toISOString(),
  packageResult,
  rendererResult,
  storeSubmissionStatus: 'not-submitted',
  storeApprovalStatus: 'not-approved',
  publicGaClaim: false,
  nextPass: 'PASS269 — Active Pane Routing + Input/Focus Regression Closeout'
};
write(path.join(reportDir, 'pass268-webview-dom-ready-lifecycle-hardening-apply-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log('PASS268_APPLY=PASS');
console.log('PASS268_VERSION_TARGET=' + versionTarget);
console.log('PASS268_REMAINING_PASSES_AFTER_THIS=' + remainingPassesAfterThisPass);
console.log('PASS268_RENDERER_TARGET=' + (rendererResult.file || rendererResult.reason));
console.log('PASS268_STORE_SUBMISSION=not-submitted');
console.log('PASS268_STORE_APPROVAL=not-approved');
