#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repo = process.cwd();
const PASS = 'PASS235 — WebView Prototype Lifecycle Hard Close';
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
function mustExist(rel) {
  if (!fs.existsSync(file(rel))) throw new Error(`${PASS}: missing ${rel}`);
}
function replaceOnce(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`${PASS}: could not find ${label}`);
  return source.replace(needle, replacement);
}
function appendOnce(rel, marker, block) {
  const current = fs.existsSync(file(rel)) ? fs.readFileSync(file(rel), 'utf8') : '';
  if (current.includes(marker)) return;
  const next = `${current}${current.endsWith('\n') || current.length === 0 ? '' : '\n'}${block.trimEnd()}\n`;
  write(rel, next);
}

[
  'package.json',
  'src/renderer/app.ts',
  'scripts/verify-pass-235-webview-prototype-lifecycle-hard-close.mjs',
  'docs/webview-prototype-lifecycle-hard-close.md',
  'docs/qa/pass235-webview-prototype-lifecycle-hard-close.md',
  'README-PASS235.md'
].forEach(mustExist);

let app = read('src/renderer/app.ts');
const marker = 'PASS235_WEBVIEW_PROTOTYPE_LIFECYCLE_GATE';

if (!app.includes(marker)) {
  // Replace known early-crash loadURL call sites with a safe src-first wrapper. This is intentionally
  // narrow: the prototype gate below protects the wider method surface, while these replacements
  // remove the exact boot diagnostic class from navigation/error fallback paths.
  const directReplacements = [
    ['tab.webview.loadURL(', 'pass235SafeLoadURL(tab.webview, '],
    ['runtimeTab.webview.loadURL(', 'pass235SafeLoadURL(runtimeTab.webview, '],
    ['activeTab.webview.loadURL(', 'pass235SafeLoadURL(activeTab.webview, '],
    ['targetTab.webview.loadURL(', 'pass235SafeLoadURL(targetTab.webview, '],
    ['active.webview.loadURL(', 'pass235SafeLoadURL(active.webview, '],
    ['webview.loadURL(', 'pass235SafeLoadURL(webview, '],
    ['tab.webview.canGoBack()', 'pass235SafeCanGoBack(tab.webview)'],
    ['tab.webview.canGoForward()', 'pass235SafeCanGoForward(tab.webview)'],
    ['activeTab.webview.canGoBack()', 'pass235SafeCanGoBack(activeTab.webview)'],
    ['activeTab.webview.canGoForward()', 'pass235SafeCanGoForward(activeTab.webview)'],
    ['tab.webview.reload()', 'pass235SafeWebviewCommand(tab.webview, \'reload\', \'reload:\' + tab.id, [])'],
    ['tab.webview.print()', 'pass235SafeWebviewCommand(tab.webview, \'print\', \'print:\' + tab.id, [])']
  ];
  for (const [needle, replacement] of directReplacements) {
    if (app.includes(needle)) app = app.split(needle).join(replacement);
  }

}

const helper = `
const PASS235_WEBVIEW_PROTOTYPE_LIFECYCLE_GATE = 'PASS235_WEBVIEW_PROTOTYPE_LIFECYCLE_GATE';
type Pass235QueuedWebviewCommand = { label: string; methodName: string; args: unknown[]; resolve: (value: unknown) => void; reject: (reason?: unknown) => void; queuedAt: number };
type Pass235LifecycleState = { attached: boolean; domReady: boolean; bound: boolean; queue: Pass235QueuedWebviewCommand[]; lastUrl?: string; timeoutId?: number };
type Pass235PatchableWebview = Electron.WebviewTag & Record<string, unknown>;
const pass235LifecycleStates = new WeakMap<Electron.WebviewTag, Pass235LifecycleState>();
let pass235PrototypePatched = false;
function pass235WebviewLabel(webview: Electron.WebviewTag): string {
  return webview.dataset.browserTabId || webview.dataset.pass106SiteViewTabId || webview.dataset.pass235LifecycleId || webview.getAttribute('data-browser-tab-id') || 'webview';
}
function pass235State(webview: Electron.WebviewTag): Pass235LifecycleState {
  let state = pass235LifecycleStates.get(webview);
  if (!state) {
    state = { attached: document.documentElement.contains(webview), domReady: false, bound: false, queue: [] };
    pass235LifecycleStates.set(webview, state);
  }
  return state;
}
function pass235ReadinessError(error: unknown): boolean {
  const detail = error instanceof Error ? error.message : String(error || '');
  return /WebView must be attached to the DOM|dom-ready event emitted|must be attached/i.test(detail);
}
function pass235RuntimeDiagnostic(label: string, detail: string): void {
  document.body.dataset.pass235LastLifecycleDiagnostic = (label + ':' + detail).slice(0, 900);
  try { setStatus('WebView lifecycle guarded', detail); } catch { /* status may not be mounted during earliest boot */ }
}
function pass235IsReady(webview: Electron.WebviewTag): boolean {
  const state = pass235State(webview);
  state.attached = document.documentElement.contains(webview);
  return state.attached && state.domReady;
}
function pass235Original(webview: Electron.WebviewTag, methodName: string): ((...args: unknown[]) => unknown) | undefined {
  const patchable = webview as Pass235PatchableWebview;
  const ownOriginal = patchable['__pass235_original_' + methodName] || patchable['__pass232_original_' + methodName] || patchable['__pass231_original_' + methodName];
  if (typeof ownOriginal === 'function') return ownOriginal as (...args: unknown[]) => unknown;
  const proto = Object.getPrototypeOf(webview) as Record<string, unknown> | undefined;
  const protoOriginal = proto?.['__pass235_original_' + methodName];
  if (typeof protoOriginal === 'function') return (protoOriginal as (...args: unknown[]) => unknown).bind(webview);
  const current = patchable[methodName];
  if (typeof current === 'function' && !String(current).includes('PASS235_WEBVIEW_PROTOTYPE_LIFECYCLE_GATE')) return current as (...args: unknown[]) => unknown;
  return undefined;
}
function pass235FlushWebviewQueue(webview: Electron.WebviewTag, reason: string): void {
  const state = pass235State(webview);
  state.attached = document.documentElement.contains(webview);
  state.domReady = true;
  if (state.timeoutId) {
    window.clearTimeout(state.timeoutId);
    state.timeoutId = undefined;
  }
  const queued = state.queue.splice(0);
  document.body.dataset.pass235LastQueueFlush = pass235WebviewLabel(webview) + ':' + reason;
  document.body.dataset.pass235LastQueueFlushCount = String(queued.length);
  for (const item of queued) {
    const original = pass235Original(webview, item.methodName);
    try {
      if (!original) {
        item.resolve(undefined);
        continue;
      }
      const result = original(...item.args);
      Promise.resolve(result).then(item.resolve, item.reject);
      document.body.dataset.pass235LastFlushedCommand = item.label;
    } catch (error) {
      if (pass235ReadinessError(error)) {
        pass235QueueWebviewCommand(webview, item.methodName, item.args, item.label).then(item.resolve, item.reject);
        continue;
      }
      item.reject(error);
      pass235RuntimeDiagnostic(item.label, error instanceof Error ? error.message : String(error || 'unknown error'));
    }
  }
}
function pass235QueueWebviewCommand(webview: Electron.WebviewTag, methodName: string, args: unknown[], label: string): Promise<unknown> {
  const state = pass235State(webview);
  return new Promise((resolve, reject) => {
    if (state.queue.length >= 40) {
      const dropped = state.queue.shift();
      dropped?.resolve(undefined);
    }
    state.queue.push({ label, methodName, args, resolve, reject, queuedAt: Date.now() });
    document.body.dataset.pass235LastQueuedCommand = label;
    document.body.dataset.pass235QueuedCommandCount = String(state.queue.length);
    if (!state.timeoutId) {
      state.timeoutId = window.setTimeout(() => {
        const pending = state.queue.map((item) => item.label).join(', ');
        document.body.dataset.pass235LastQueueTimeout = pending || 'none';
        pass235RuntimeDiagnostic('waiting', pending || 'Waiting for WebView DOM readiness.');
      }, 5500);
    }
  });
}
function pass235SafeLoadURL(webview: Electron.WebviewTag, targetUrl: string, options?: unknown): Promise<unknown> {
  const nextUrl = String(targetUrl || '');
  const state = pass235State(webview);
  state.lastUrl = nextUrl;
  webview.dataset.pass235LastRequestedUrl = nextUrl.slice(0, 500);
  const attached = document.documentElement.contains(webview);
  const original = pass235Original(webview, 'loadURL');
  if (!attached || !state.domReady || !original) {
    // Key PASS235 behavior: loadURL is special. Before dom-ready, use the declarative src
    // attribute instead of calling the Electron method that throws the boot diagnostic.
    if (nextUrl) {
      webview.setAttribute('src', nextUrl);
      webview.dataset.pass235SrcFallback = 'true';
      document.body.dataset.pass235LastSrcFallback = pass235WebviewLabel(webview);
    }
    return Promise.resolve(undefined);
  }
  try {
    return Promise.resolve(original(nextUrl, options));
  } catch (error) {
    if (pass235ReadinessError(error)) {
      state.domReady = false;
      if (nextUrl) webview.setAttribute('src', nextUrl);
      webview.dataset.pass235SrcFallback = 'readiness-error';
      return Promise.resolve(undefined);
    }
    pass235RuntimeDiagnostic('loadURL:' + pass235WebviewLabel(webview), error instanceof Error ? error.message : String(error || 'unknown loadURL error'));
    return Promise.reject(error);
  }
}
function pass235SafeWebviewCommand(webview: Electron.WebviewTag, methodName: string, label: string, args: unknown[] = []): Promise<unknown> {
  if (methodName === 'loadURL') return pass235SafeLoadURL(webview, String(args[0] || ''), args[1]);
  const original = pass235Original(webview, methodName);
  if (!original) return Promise.resolve(undefined);
  if (!pass235IsReady(webview)) return pass235QueueWebviewCommand(webview, methodName, args, label);
  try {
    const result = original(...args);
    document.body.dataset.pass235LastImmediateCommand = label;
    return Promise.resolve(result);
  } catch (error) {
    if (pass235ReadinessError(error)) {
      pass235State(webview).domReady = false;
      return pass235QueueWebviewCommand(webview, methodName, args, label);
    }
    pass235RuntimeDiagnostic(label, error instanceof Error ? error.message : String(error || 'unknown webview command error'));
    return Promise.reject(error);
  }
}
function pass235SafeSyncWebviewCommand<T>(webview: Electron.WebviewTag, methodName: string, fallback: T, label: string, args: unknown[] = []): T {
  const original = pass235Original(webview, methodName);
  if (!original || !pass235IsReady(webview)) {
    document.body.dataset.pass235LastSyncFallback = label;
    return fallback;
  }
  try {
    return original(...args) as T;
  } catch (error) {
    if (pass235ReadinessError(error)) {
      pass235State(webview).domReady = false;
      document.body.dataset.pass235LastSyncFallback = label;
      return fallback;
    }
    pass235RuntimeDiagnostic(label, error instanceof Error ? error.message : String(error || 'unknown sync webview command error'));
    return fallback;
  }
}
function pass235SafeCanGoBack(webview: Electron.WebviewTag): boolean { return pass235SafeSyncWebviewCommand<boolean>(webview, 'canGoBack', false, 'canGoBack:' + pass235WebviewLabel(webview)); }
function pass235SafeCanGoForward(webview: Electron.WebviewTag): boolean { return pass235SafeSyncWebviewCommand<boolean>(webview, 'canGoForward', false, 'canGoForward:' + pass235WebviewLabel(webview)); }
function pass235BindWebviewLifecycle(webview: Electron.WebviewTag, tabId = pass235WebviewLabel(webview)): void {
  const state = pass235State(webview);
  if (state.bound) return;
  state.bound = true;
  webview.dataset.pass235LifecycleId = tabId;
  webview.dataset.pass235LifecycleGate = 'bound';
  webview.addEventListener('dom-ready', () => pass235FlushWebviewQueue(webview, 'dom-ready'));
  webview.addEventListener('did-start-loading', () => {
    const nextState = pass235State(webview);
    nextState.attached = document.documentElement.contains(webview);
    nextState.domReady = false;
    document.body.dataset.pass235LastStartLoading = tabId;
  });
  webview.addEventListener('did-stop-loading', () => {
    document.body.dataset.pass235LastStopLoading = tabId;
  });
  webview.addEventListener('did-fail-load', () => {
    document.body.dataset.pass235LastFailLoad = tabId;
  });
}
function pass235PatchInstance(webview: Electron.WebviewTag, tabId = pass235WebviewLabel(webview)): void {
  pass235BindWebviewLifecycle(webview, tabId);
  const patchable = webview as Pass235PatchableWebview;
  const methods = ['loadURL', 'reload', 'reloadIgnoringCache', 'stop', 'goBack', 'goForward', 'print', 'openDevTools', 'closeDevTools', 'executeJavaScript', 'capturePage', 'send', 'insertCSS', 'setZoomFactor', 'setZoomLevel'];
  for (const methodName of methods) {
    const wrapKey = '__pass235_instance_wrapped_' + methodName;
    const proto = Object.getPrototypeOf(webview) as Record<string, unknown> | undefined;
    if (proto?.['__pass235_prototype_wrapped_' + methodName]) continue;
    const original = patchable[methodName];
    if (patchable[wrapKey] || typeof original !== 'function') continue;
    try {
      Object.defineProperty(patchable, '__pass235_original_' + methodName, { value: (original as (...args: unknown[]) => unknown).bind(webview), configurable: false, enumerable: false });
      patchable[methodName] = (...args: unknown[]) => pass235SafeWebviewCommand(webview, methodName, methodName + ':' + tabId, args);
      patchable[wrapKey] = true;
    } catch (error) {
      pass235RuntimeDiagnostic('instance-patch:' + methodName + ':' + tabId, error instanceof Error ? error.message : String(error || 'patch failed'));
    }
  }
  const syncMethods: Array<[string, unknown]> = [['canGoBack', false], ['canGoForward', false], ['isDevToolsOpened', false], ['isLoading', false], ['getURL', webview.getAttribute('src') || ''], ['getTitle', '']];
  for (const [methodName, fallback] of syncMethods) {
    const wrapKey = '__pass235_instance_wrapped_' + methodName;
    const proto = Object.getPrototypeOf(webview) as Record<string, unknown> | undefined;
    if (proto?.['__pass235_prototype_wrapped_' + methodName]) continue;
    const original = patchable[methodName];
    if (patchable[wrapKey] || typeof original !== 'function') continue;
    try {
      Object.defineProperty(patchable, '__pass235_original_' + methodName, { value: (original as (...args: unknown[]) => unknown).bind(webview), configurable: false, enumerable: false });
      patchable[methodName] = (...args: unknown[]) => pass235SafeSyncWebviewCommand(webview, methodName, fallback, methodName + ':' + tabId, args);
      patchable[wrapKey] = true;
    } catch (error) {
      pass235RuntimeDiagnostic('instance-patch:' + methodName + ':' + tabId, error instanceof Error ? error.message : String(error || 'patch failed'));
    }
  }
  webview.dataset.pass235LifecycleGate = 'patched';
}
function pass235PatchPrototypeFromProbe(): void {
  if (pass235PrototypePatched) return;
  const probe = document.createElement('webview') as Pass235PatchableWebview;
  const proto = Object.getPrototypeOf(probe) as Record<string, unknown> | undefined;
  if (!proto) return;
  const asyncMethods = ['loadURL', 'reload', 'reloadIgnoringCache', 'stop', 'goBack', 'goForward', 'print', 'openDevTools', 'closeDevTools', 'executeJavaScript', 'capturePage', 'send', 'insertCSS', 'setZoomFactor', 'setZoomLevel'];
  let patched = 0;
  for (const methodName of asyncMethods) {
    const original = proto[methodName];
    const wrapKey = '__pass235_prototype_wrapped_' + methodName;
    if (proto[wrapKey] || typeof original !== 'function') continue;
    try {
      Object.defineProperty(proto, '__pass235_original_' + methodName, { value: original, configurable: false, enumerable: false });
      proto[methodName] = function pass235WebviewPrototypeMethod(this: Electron.WebviewTag, ...args: unknown[]) {
        return pass235SafeWebviewCommand(this, methodName, 'prototype:' + methodName + ':' + pass235WebviewLabel(this), args);
      };
      proto[wrapKey] = true;
      patched += 1;
    } catch { /* instance patch remains the fallback */ }
  }
  const syncMethods: Array<[string, unknown]> = [['canGoBack', false], ['canGoForward', false], ['isDevToolsOpened', false], ['isLoading', false], ['getURL', ''], ['getTitle', '']];
  for (const [methodName, fallback] of syncMethods) {
    const original = proto[methodName];
    const wrapKey = '__pass235_prototype_wrapped_' + methodName;
    if (proto[wrapKey] || typeof original !== 'function') continue;
    try {
      Object.defineProperty(proto, '__pass235_original_' + methodName, { value: original, configurable: false, enumerable: false });
      proto[methodName] = function pass235WebviewPrototypeSyncMethod(this: Electron.WebviewTag, ...args: unknown[]) {
        return pass235SafeSyncWebviewCommand(this, methodName, fallback, 'prototype:' + methodName + ':' + pass235WebviewLabel(this), args);
      };
      proto[wrapKey] = true;
      patched += 1;
    } catch { /* instance patch remains the fallback */ }
  }
  if (patched > 0) pass235PrototypePatched = true;
  document.body.dataset.pass235PrototypePatched = String(patched);
}
function pass235PatchExistingWebviews(): void {
  document.querySelectorAll<Electron.WebviewTag>('webview').forEach((webview, index) => pass235PatchInstance(webview, pass235WebviewLabel(webview) || 'existing-' + index));
}
function pass235StartLifecycleGate(): void {
  pass235PatchPrototypeFromProbe();
  pass235PatchExistingWebviews();
  const observer = new MutationObserver((mutations) => {
    pass235PatchPrototypeFromProbe();
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.tagName.toLowerCase() === 'webview') pass235PatchInstance(node as Electron.WebviewTag);
        node.querySelectorAll?.('webview').forEach((child) => pass235PatchInstance(child as Electron.WebviewTag));
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  document.body.dataset.pass235LifecycleObserver = 'active';
  window.setTimeout(pass235PatchPrototypeFromProbe, 0);
  window.setTimeout(pass235PatchPrototypeFromProbe, 100);
  window.setTimeout(pass235PatchPrototypeFromProbe, 500);
  window.setTimeout(pass235PatchExistingWebviews, 0);
  window.setTimeout(pass235PatchExistingWebviews, 100);
  window.setTimeout(pass235PatchExistingWebviews, 500);
  window.setTimeout(pass235PatchExistingWebviews, 1500);
}
function pass235ScheduleLifecycleGate(): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', pass235StartLifecycleGate, { once: true });
    return;
  }
  pass235StartLifecycleGate();
}
pass235ScheduleLifecycleGate();
`;

if (!app.includes(marker)) {
  const setStatusNeedle = "function setStatus(message: string, detail?: string): void { statusText.textContent = sanitizeStatusMetadataText(message, ''); if (detail) securityText.textContent = sanitizeStatusMetadataText(detail, ''); }";
  app = replaceOnce(app, setStatusNeedle, `${setStatusNeedle}${helper}`, 'setStatus insertion point for PASS235 lifecycle gate');
}

const pass235CreateBindAlreadyInstalled = app.includes('pass235PatchInstance(webview, tabId); pass232InstallWebviewRuntimeCommandGate(webview, tabId);')
  || app.includes('pass235PatchInstance(webview, tabId); pass231BindWebviewDomReadyGuard(webview, tabId);')
  || app.includes('pass235PatchInstance(webview, tabId); pass185BindWebviewMouseHistoryRouting(webview, tabId);');
if (!pass235CreateBindAlreadyInstalled) {
  if (app.includes('pass232InstallWebviewRuntimeCommandGate(webview, tabId);')) {
    app = app.replaceAll('pass232InstallWebviewRuntimeCommandGate(webview, tabId);', 'pass235BindWebviewLifecycle(webview, tabId); pass235PatchInstance(webview, tabId); pass232InstallWebviewRuntimeCommandGate(webview, tabId);');
  } else if (app.includes('pass231BindWebviewDomReadyGuard(webview, tabId);')) {
    app = app.replaceAll('pass231BindWebviewDomReadyGuard(webview, tabId);', 'pass235BindWebviewLifecycle(webview, tabId); pass235PatchInstance(webview, tabId); pass231BindWebviewDomReadyGuard(webview, tabId);');
  } else if (app.includes('pass185BindWebviewMouseHistoryRouting(webview, tabId);')) {
    app = app.replaceAll('pass185BindWebviewMouseHistoryRouting(webview, tabId);', 'pass235BindWebviewLifecycle(webview, tabId); pass235PatchInstance(webview, tabId); pass185BindWebviewMouseHistoryRouting(webview, tabId);');
  } else {
    throw new Error(`${PASS}: could not find WebView bind point for PASS235 lifecycle gate`);
  }
}

write('src/renderer/app.ts', app);

const pkgPath = 'package.json';
const pkg = JSON.parse(read(pkgPath));
pkg.scripts ||= {};
pkg.scripts['verify:pass-235-webview-prototype-lifecycle-hard-close'] = 'node scripts/verify-pass-235-webview-prototype-lifecycle-hard-close.mjs';
const releaseBlockers = pkg.scripts['verify:release-blockers'];
if (typeof releaseBlockers === 'string' && !releaseBlockers.includes('verify:pass-235-webview-prototype-lifecycle-hard-close')) {
  if (releaseBlockers.includes('&& npm run build')) {
    pkg.scripts['verify:release-blockers'] = releaseBlockers.replace('&& npm run build', '&& npm run verify:pass-235-webview-prototype-lifecycle-hard-close && npm run build');
  } else {
    pkg.scripts['verify:release-blockers'] = `${releaseBlockers} && npm run verify:pass-235-webview-prototype-lifecycle-hard-close`;
  }
}
write(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

appendOnce('docs/known-issues.md', 'PASS235_WEBVIEW_PROTOTYPE_LIFECYCLE_GATE', `
## PASS235 runtime blocker closeout — WebView prototype lifecycle gate

Marker: PASS235_WEBVIEW_PROTOTYPE_LIFECYCLE_GATE

The launch diagnostic "The WebView must be attached to the DOM and the dom-ready event emitted before this method can be called" remains a release blocker. PASS235 hard-closes the class by patching the WebView prototype early, binding every created WebView, and replacing direct loadURL fallbacks with a src-first safe navigation wrapper. If this diagnostic appears again in an installed build, do not ship; collect the runtime diagnostics dataset and add the exact call site to the hard-close verifier.
`);

console.log(`[PASS235][APPLY] WebView prototype lifecycle hard close installed. Run npm run verify:pass-235-webview-prototype-lifecycle-hard-close`);
