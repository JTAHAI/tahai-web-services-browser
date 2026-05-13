#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repo = process.cwd();
const PASS = 'PASS232 — WebView Runtime Command Sweep + Release Closeout';
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
  'scripts/verify-pass-232-webview-runtime-command-sweep-release-closeout.mjs',
  'docs/webview-runtime-command-sweep-release-closeout.md',
  'docs/qa/pass232-webview-runtime-command-sweep-release-closeout.md',
  'README-PASS232.md'
].forEach(mustExist);

let app = read('src/renderer/app.ts');
const marker = 'PASS232_WEBVIEW_RUNTIME_COMMAND_GATE';

const helper = `
const PASS232_WEBVIEW_RUNTIME_COMMAND_GATE = 'PASS232_WEBVIEW_RUNTIME_COMMAND_GATE';
type Pass232QueuedCommand<T = unknown> = {
  label: string;
  queuedAt: number;
  run: () => T | Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};
type Pass232RuntimeGateState = {
  domReady: boolean;
  bound: boolean;
  patched: boolean;
  queue: Pass232QueuedCommand[];
  timeoutId?: number;
};
type Pass232PatchableWebview = Electron.WebviewTag & Record<string, unknown>;
const pass232RuntimeGateStates = new WeakMap<Electron.WebviewTag, Pass232RuntimeGateState>();
function pass232RuntimeLabel(webview: Electron.WebviewTag): string {
  return webview.dataset.browserTabId || webview.dataset.pass106SiteViewTabId || webview.dataset.pass232RuntimeGateId || 'unlabeled-webview';
}
function pass232EnsureRuntimeGateState(webview: Electron.WebviewTag): Pass232RuntimeGateState {
  let state = pass232RuntimeGateStates.get(webview);
  if (!state) {
    state = { domReady: false, bound: false, patched: false, queue: [] };
    pass232RuntimeGateStates.set(webview, state);
  }
  return state;
}
function pass232IsDomReadinessError(error: unknown): boolean {
  const detail = error instanceof Error ? error.message : String(error || '');
  return /WebView must be attached to the DOM|dom-ready event emitted|must be attached/i.test(detail);
}
function pass232ReportRuntimeGate(label: string, error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error || 'unknown webview runtime command error');
  document.body.dataset.pass232LastRuntimeGateError = (label + ':' + detail).slice(0, 900);
  setStatus('WebView runtime command guarded', detail);
}
function pass232IsWebviewRuntimeReady(webview: Electron.WebviewTag): boolean {
  const state = pass232EnsureRuntimeGateState(webview);
  return state.domReady && document.documentElement.contains(webview);
}
function pass232FlushRuntimeGateQueue(webview: Electron.WebviewTag, reason: string): void {
  const state = pass232EnsureRuntimeGateState(webview);
  state.domReady = true;
  if (state.timeoutId) {
    window.clearTimeout(state.timeoutId);
    state.timeoutId = undefined;
  }
  const queued = state.queue.splice(0);
  document.body.dataset.pass232LastRuntimeGateFlush = pass232RuntimeLabel(webview) + ':' + reason;
  document.body.dataset.pass232LastRuntimeGateFlushCount = String(queued.length);
  for (const item of queued) {
    try {
      const result = item.run();
      Promise.resolve(result).then(item.resolve, item.reject);
      document.body.dataset.pass232LastRuntimeCommand = item.label;
    } catch (error) {
      item.reject(error);
      pass232ReportRuntimeGate(item.label, error);
    }
  }
}
function pass232QueueRuntimeCommand<T>(webview: Electron.WebviewTag, label: string, run: () => T | Promise<T>): Promise<T> {
  const state = pass232EnsureRuntimeGateState(webview);
  return new Promise<T>((resolve, reject) => {
    if (state.queue.length >= 40) {
      const dropped = state.queue.shift();
      dropped?.reject(new Error('Dropped stale WebView runtime command while waiting for dom-ready: ' + dropped.label));
    }
    state.queue.push({ label, queuedAt: Date.now(), run: run as () => unknown, resolve: resolve as (value: unknown) => void, reject });
    document.body.dataset.pass232LastQueuedRuntimeCommand = label;
    document.body.dataset.pass232QueuedRuntimeCommandCount = String(state.queue.length);
    if (!state.timeoutId) {
      state.timeoutId = window.setTimeout(() => {
        const pending = state.queue.map((item) => item.label).join(', ');
        document.body.dataset.pass232LastRuntimeGateTimeout = pending || 'none';
        setStatus('WebView command waiting for DOM readiness', pending || 'No queued runtime command.');
      }, 8000);
    }
  });
}
function pass232RunRuntimeCommand<T>(webview: Electron.WebviewTag, label: string, run: () => T | Promise<T>): Promise<T> {
  if (!pass232IsWebviewRuntimeReady(webview)) return pass232QueueRuntimeCommand(webview, label, run);
  try {
    const result = run();
    document.body.dataset.pass232LastImmediateRuntimeCommand = label;
    return Promise.resolve(result);
  } catch (error) {
    if (pass232IsDomReadinessError(error)) {
      pass232EnsureRuntimeGateState(webview).domReady = false;
      return pass232QueueRuntimeCommand(webview, label, run);
    }
    pass232ReportRuntimeGate(label, error);
    return Promise.reject(error);
  }
}
function pass232RunSyncRuntimeCommand<T>(webview: Electron.WebviewTag, label: string, fallback: T, run: () => T): T {
  if (!pass232IsWebviewRuntimeReady(webview)) {
    document.body.dataset.pass232LastSyncRuntimeFallback = label;
    return fallback;
  }
  try {
    return run();
  } catch (error) {
    if (pass232IsDomReadinessError(error)) {
      pass232EnsureRuntimeGateState(webview).domReady = false;
      document.body.dataset.pass232LastSyncRuntimeFallback = label;
      return fallback;
    }
    pass232ReportRuntimeGate(label, error);
    return fallback;
  }
}
function pass232BindRuntimeGateEvents(webview: Electron.WebviewTag, tabId: string): void {
  const state = pass232EnsureRuntimeGateState(webview);
  if (state.bound) return;
  state.bound = true;
  webview.dataset.pass232RuntimeCommandGate = 'bound';
  webview.dataset.pass232RuntimeGateId = tabId;
  webview.addEventListener('dom-ready', () => pass232FlushRuntimeGateQueue(webview, 'dom-ready'));
  webview.addEventListener('did-attach', () => {
    document.body.dataset.pass232LastRuntimeAttach = tabId;
  });
  webview.addEventListener('did-start-loading', () => {
    pass232EnsureRuntimeGateState(webview).domReady = false;
    document.body.dataset.pass232LastRuntimeStartLoading = tabId;
  });
  webview.addEventListener('destroyed', () => {
    const nextState = pass232EnsureRuntimeGateState(webview);
    const pending = nextState.queue.splice(0);
    for (const item of pending) item.reject(new Error('WebView was destroyed before runtime command completed: ' + item.label));
    document.body.dataset.pass232LastRuntimeDestroyed = tabId;
  });
}
function pass232PatchAsyncRuntimeMethod(webview: Electron.WebviewTag, tabId: string, methodName: string): void {
  const patchable = webview as Pass232PatchableWebview;
  const wrapKey = '__pass232_wrapped_' + methodName;
  const original = patchable[methodName];
  if (patchable[wrapKey] || typeof original !== 'function') return;
  try {
    Object.defineProperty(patchable, '__pass232_original_' + methodName, {
      value: (original as (...args: unknown[]) => unknown).bind(webview),
      configurable: false,
      enumerable: false,
      writable: false
    });
    patchable[methodName] = (...args: unknown[]) => pass232RunRuntimeCommand(webview, methodName + ':' + tabId, () => (original as (...args: unknown[]) => unknown).apply(webview, args));
    patchable[wrapKey] = true;
  } catch (error) {
    pass232ReportRuntimeGate('patch:' + methodName + ':' + tabId, error);
  }
}
function pass232PatchSyncRuntimeMethod<T>(webview: Electron.WebviewTag, tabId: string, methodName: string, fallback: T): void {
  const patchable = webview as Pass232PatchableWebview;
  const wrapKey = '__pass232_wrapped_' + methodName;
  const original = patchable[methodName];
  if (patchable[wrapKey] || typeof original !== 'function') return;
  try {
    Object.defineProperty(patchable, '__pass232_original_' + methodName, {
      value: (original as (...args: unknown[]) => T).bind(webview),
      configurable: false,
      enumerable: false,
      writable: false
    });
    patchable[methodName] = (...args: unknown[]) => pass232RunSyncRuntimeCommand(webview, methodName + ':' + tabId, fallback, () => (original as (...args: unknown[]) => T).apply(webview, args));
    patchable[wrapKey] = true;
  } catch (error) {
    pass232ReportRuntimeGate('patch:' + methodName + ':' + tabId, error);
  }
}
function pass232InstallWebviewRuntimeCommandGate(webview: Electron.WebviewTag, tabId = pass232RuntimeLabel(webview)): void {
  const state = pass232EnsureRuntimeGateState(webview);
  pass232BindRuntimeGateEvents(webview, tabId);
  if (state.patched) return;
  state.patched = true;
  const asyncMethods = ['loadURL', 'reload', 'reloadIgnoringCache', 'stop', 'goBack', 'goForward', 'print', 'openDevTools', 'closeDevTools', 'executeJavaScript', 'capturePage', 'send', 'insertCSS', 'setZoomFactor', 'setZoomLevel'];
  for (const methodName of asyncMethods) pass232PatchAsyncRuntimeMethod(webview, tabId, methodName);
  pass232PatchSyncRuntimeMethod<boolean>(webview, tabId, 'canGoBack', false);
  pass232PatchSyncRuntimeMethod<boolean>(webview, tabId, 'canGoForward', false);
  pass232PatchSyncRuntimeMethod<boolean>(webview, tabId, 'isDevToolsOpened', false);
  pass232PatchSyncRuntimeMethod<boolean>(webview, tabId, 'isLoading', false);
  pass232PatchSyncRuntimeMethod<string>(webview, tabId, 'getURL', webview.dataset.lastSafeUrl || '');
  pass232PatchSyncRuntimeMethod<string>(webview, tabId, 'getTitle', '');
  webview.dataset.pass232RuntimeCommandGate = 'patched';
  document.body.dataset.pass232LastPatchedWebview = tabId;
}
function pass232StartGlobalWebviewRuntimeGate(): void {
  const installExisting = () => {
    document.querySelectorAll<Electron.WebviewTag>('webview').forEach((webview, index) => {
      pass232InstallWebviewRuntimeCommandGate(webview, pass232RuntimeLabel(webview) || 'existing-' + index);
    });
  };
  installExisting();
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.tagName.toLowerCase() === 'webview') pass232InstallWebviewRuntimeCommandGate(node as Electron.WebviewTag);
        node.querySelectorAll?.('webview').forEach((child) => pass232InstallWebviewRuntimeCommandGate(child as Electron.WebviewTag));
      });
    }
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  document.body.dataset.pass232RuntimeObserver = 'active';
}
function pass232ScheduleGlobalWebviewRuntimeGate(): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', pass232StartGlobalWebviewRuntimeGate, { once: true });
    return;
  }
  pass232StartGlobalWebviewRuntimeGate();
}
pass232ScheduleGlobalWebviewRuntimeGate();
`;

if (!app.includes(marker)) {
  const setStatusNeedle = "function setStatus(message: string, detail?: string): void { statusText.textContent = sanitizeStatusMetadataText(message, ''); if (detail) securityText.textContent = sanitizeStatusMetadataText(detail, ''); }";
  app = replaceOnce(app, setStatusNeedle, `${setStatusNeedle}${helper}`, 'setStatus insertion point for PASS232 runtime command gate');
}

if (!app.includes('pass232InstallWebviewRuntimeCommandGate(webview, tabId);')) {
  if (app.includes('pass231BindWebviewDomReadyGuard(webview, tabId);')) {
    app = app.replaceAll('pass231BindWebviewDomReadyGuard(webview, tabId);', 'pass231BindWebviewDomReadyGuard(webview, tabId); pass232InstallWebviewRuntimeCommandGate(webview, tabId);');
  } else if (app.includes('pass185BindWebviewMouseHistoryRouting(webview, tabId);')) {
    app = app.replaceAll('pass185BindWebviewMouseHistoryRouting(webview, tabId);', 'pass232InstallWebviewRuntimeCommandGate(webview, tabId); pass185BindWebviewMouseHistoryRouting(webview, tabId);');
  } else {
    throw new Error(`${PASS}: could not find a WebView creation/bind point for runtime command gate installation`);
  }
}

write('src/renderer/app.ts', app);

const pkgPath = 'package.json';
const pkg = JSON.parse(read(pkgPath));
pkg.scripts ||= {};
pkg.scripts['verify:pass-232-webview-runtime-command-sweep-release-closeout'] = 'node scripts/verify-pass-232-webview-runtime-command-sweep-release-closeout.mjs';
const releaseBlockers = pkg.scripts['verify:release-blockers'];
if (typeof releaseBlockers === 'string' && !releaseBlockers.includes('verify:pass-232-webview-runtime-command-sweep-release-closeout')) {
  if (releaseBlockers.includes('&& npm run build')) {
    pkg.scripts['verify:release-blockers'] = releaseBlockers.replace('&& npm run build', '&& npm run verify:pass-232-webview-runtime-command-sweep-release-closeout && npm run build');
  } else {
    pkg.scripts['verify:release-blockers'] = `${releaseBlockers} && npm run verify:pass-232-webview-runtime-command-sweep-release-closeout`;
  }
}
write(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

appendOnce('docs/known-issues.md', 'PASS232_WEBVIEW_RUNTIME_COMMAND_GATE', `
## PASS232 runtime closeout note — WebView command lifecycle

Marker: PASS232_WEBVIEW_RUNTIME_COMMAND_GATE

The boot diagnostic \"The WebView must be attached to the DOM and the dom-ready event emitted before this method can be called\" is treated as a release blocker. PASS232 installs a runtime command gate on every existing and future <webview> so navigation, history, reload, print, DevTools, capture, and executeJavaScript-style commands cannot crash boot by racing attachment/dom-ready. Any recurrence must block GA/Store submission until the local installed app is retested.
`);

console.log(`[PASS232][APPLY] WebView runtime command sweep installed. Run npm run verify:pass-232-webview-runtime-command-sweep-release-closeout`);
