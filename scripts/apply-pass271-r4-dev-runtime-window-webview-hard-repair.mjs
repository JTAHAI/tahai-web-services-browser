#!/usr/bin/env node
/*
  PASS271-R4 — Dev Runtime Window + Normal Webview Hard Repair

  This repairs the runtime state reported after a clean build:
  - Electron main process throws Object has been destroyed from renderer-failure fallback.
  - Normal 1-Up browser chrome renders but the website surface stays black / unclickable.
  - Idle Mission drag/drop overlays can remain visible over the website budget.

  Scope:
  - No new features.
  - No Store/GA/signing claims.
  - Normal browsing must be usable first.
*/
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pass = 'PASS271_R4';
const scriptName = 'verify:pass-271-r4-dev-runtime-window-webview-hard-repair';
const scriptValue = 'node scripts/verify-pass271-r4-dev-runtime-window-webview-hard-repair.mjs';
const mainStart = '/* PASS271_R4_MAIN_DESTROYED_WINDOW_GUARD_START */';
const mainEnd = '/* PASS271_R4_MAIN_DESTROYED_WINDOW_GUARD_END */';
const rendererStart = '/* PASS271_R4_NORMAL_WEBVIEW_HARD_REPAIR_START */';
const rendererEnd = '/* PASS271_R4_NORMAL_WEBVIEW_HARD_REPAIR_END */';
const cssStart = '/* PASS271_R4_NORMAL_WEBVIEW_HARD_REPAIR_CSS_START */';
const cssEnd = '/* PASS271_R4_NORMAL_WEBVIEW_HARD_REPAIR_CSS_END */';

const skipDirs = new Set(['.git','node_modules','dist','release','release-msix','out','coverage','.vite','.next','build']);
const mainCandidates = ['src/main/main.ts','src/main/index.ts','src/main.ts','main.ts','electron/main.ts'];
const rendererCandidates = ['src/renderer/app.ts','src/renderer/renderer.ts','src/renderer/index.ts','src/renderer/main.ts','src/renderer/app.tsx','src/renderer/index.tsx','src/renderer/app.js','src/renderer/renderer.js','renderer/app.js','renderer/renderer.js','app/renderer/app.js'];
const cssCandidates = ['src/renderer/styles/browser.css','src/renderer/styles.css','src/renderer/renderer.css','src/renderer/app.css','src/renderer/index.css','renderer/styles.css','renderer/renderer.css','renderer/app.css','styles.css'];

function rel(file) { return path.relative(root, file).split(path.sep).join('/'); }
function readText(file) { return fs.readFileSync(file, 'utf8'); }
function writeText(file, text) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }
function walk(dir, matcher, acc = []) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const entry of entries) {
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, matcher, acc);
    else if (matcher(full)) acc.push(full);
  }
  return acc;
}
function replaceBlock(text, start, end, block) {
  const s = text.indexOf(start);
  const e = text.indexOf(end);
  if (s >= 0 && e > s) return text.slice(0, s) + block + text.slice(e + end.length);
  return null;
}
function insertBlock(file, start, end, block, anchor) {
  let text = readText(file);
  const replaced = replaceBlock(text, start, end, block);
  if (replaced !== null) { writeText(file, replaced); return { file: rel(file), changed: replaced !== text, mode: 'replaced' }; }
  if (anchor && text.includes(anchor)) text = text.replace(anchor, anchor + '\n\n' + block);
  else text = text.trimEnd() + '\n\n' + block + '\n';
  writeText(file, text);
  return { file: rel(file), changed: true, mode: 'inserted' };
}
function ensurePackageScript() {
  const pkgPath = path.join(root, 'package.json');
  if (!fs.existsSync(pkgPath)) return { packageJsonFound: false, changed: false };
  const pkg = JSON.parse(readText(pkgPath));
  pkg.scripts = pkg.scripts || {};
  const before = pkg.scripts[scriptName];
  let changed = false;
  if (before !== scriptValue) { pkg.scripts[scriptName] = scriptValue; changed = true; }
  if (changed) writeText(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  return { packageJsonFound: true, changed, version: pkg.version, scriptName };
}
function findMainFile() {
  for (const candidate of mainCandidates) {
    const full = path.join(root, candidate);
    if (fs.existsSync(full) && readText(full).includes('loadRendererShell')) return full;
  }
  return walk(root, (file) => /\.(ts|tsx|js|jsx)$/i.test(file)).find((file) => readText(file).includes('loadRendererShell')) || null;
}
function findRendererFile() {
  for (const candidate of rendererCandidates) {
    const full = path.join(root, candidate);
    if (fs.existsSync(full) && readText(full).includes('webview-stage')) return full;
  }
  return walk(root, (file) => /\.(ts|tsx|js|jsx)$/i.test(file)).find((file) => readText(file).includes('webview-stage')) || null;
}
function findCssFile() {
  for (const candidate of cssCandidates) {
    const full = path.join(root, candidate);
    if (fs.existsSync(full)) return full;
  }
  const found = walk(root, (file) => /\.css$/i.test(file)).find((file) => readText(file).includes('webview-stage') || readText(file).includes('.browser-view'));
  if (found) return found;
  const fallback = path.join(root, 'src/renderer/styles/browser.css');
  if (!fs.existsSync(fallback)) writeText(fallback, '');
  return fallback;
}
function replaceShowFailure(mainFile) {
  let text = readText(mainFile);
  const prior = replaceBlock(text, mainStart, mainEnd, '');
  if (prior !== null) text = prior;
  const helper = `${mainStart}
function pass271R4BrowserWindowAlive(window: BrowserWindow): boolean {
  try {
    return Boolean(window && !window.isDestroyed() && window.webContents && !window.webContents.isDestroyed());
  } catch {
    return false;
  }
}
${mainEnd}\n\n`;
  if (!text.includes('function pass271R4BrowserWindowAlive(window: BrowserWindow): boolean')) {
    const anchor = 'async function checkRendererBootHeartbeat(window: BrowserWindow): Promise<boolean> {';
    if (!text.includes(anchor)) throw new Error('Could not locate checkRendererBootHeartbeat anchor in main source.');
    text = text.replace(anchor, helper + anchor);
  }

  const start = text.indexOf('  const showFailure = (detail: string) => {');
  const endAnchor = '\n\n  const scheduleHeartbeatCheck = (reason: string) => {';
  const end = text.indexOf(endAnchor, start);
  if (start < 0 || end < 0) throw new Error('Could not locate showFailure block in main source.');
  const replacement = `  const showFailure = (detail: string) => {
    if (fallbackShown || !pass271R4BrowserWindowAlive(window)) return;
    fallbackShown = true;
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
    const html = rendererShellFailureHtml(detail, rendererPath);
    const writeInlineFallback = () => {
      if (!pass271R4BrowserWindowAlive(window)) return;
      try {
        void window.webContents.loadURL('about:blank').then(() => {
          if (!pass271R4BrowserWindowAlive(window)) return undefined;
          return window.webContents.executeJavaScript(\`document.open();document.write(\${JSON.stringify(html)});document.close();\`, true);
        }).catch(() => undefined);
      } catch {
        // Window was destroyed between the liveness check and the fallback write. Ignore cleanly.
      }
    };
    try {
      const failurePath = rendererShellFailureFile(detail, rendererPath);
      if (!pass271R4BrowserWindowAlive(window)) return;
      try {
        void window.loadFile(failurePath).catch(() => writeInlineFallback());
      } catch {
        writeInlineFallback();
      }
    } catch {
      writeInlineFallback();
    }
  };`;
  text = text.slice(0, start) + replacement + text.slice(end);
  writeText(mainFile, text);
  return { file: rel(mainFile), changed: true, mode: 'showFailure-replaced' };
}

const rendererPatch = `${rendererStart}
type Pass271R4NormalWebviewReport = {
  pass: 'PASS271-R4';
  status: 'PASS' | 'WARN';
  reason: string;
  normalBrowsing: boolean;
  activeWebviewCount: number;
  hiddenMissionOverlayCount: number;
  restoredWebviewCount: number;
  clickBlocker: string;
  stageWidth: number;
  stageHeight: number;
  activeUrl: string;
  generatedAt: string;
};

type Pass271R4Window = Window & typeof globalThis & {
  __TAHAI_PASS271_R4_NORMAL_WEBVIEW_HARD_REPAIR__?: {
    repair: (reason?: string) => Pass271R4NormalWebviewReport;
    lastReport: () => Pass271R4NormalWebviewReport | null;
  };
  __TAHAI_PASS271_R4_NORMAL_WEBVIEW_HARD_REPAIR_REPORT__?: Pass271R4NormalWebviewReport;
};

let pass271R4Mounted = false;
let pass271R4Timer: number | undefined;
let pass271R4LastReport: Pass271R4NormalWebviewReport | null = null;

function pass271R4NormalBrowsing(): boolean {
  try {
    return !currentMission || !currentMission.layout || currentMission.layout.type === 'single';
  } catch {
    return true;
  }
}

function pass271R4Stage(): HTMLElement | null {
  return document.getElementById('webview-stage') as HTMLElement | null;
}

function pass271R4CurrentActiveTab(): TabState | undefined {
  try { return active(); } catch { return undefined; }
}

function pass271R4ElementLabel(element: Element | null): string {
  if (!element) return 'none';
  const html = element as HTMLElement;
  return [element.tagName.toLowerCase(), html.id ? '#' + html.id : '', html.className ? '.' + String(html.className).trim().replace(/\s+/g, '.') : ''].join('').slice(0, 180) || 'unknown';
}

function pass271R4IsMissionChrome(element: HTMLElement): boolean {
  const text = [element.id, String(element.className || ''), Object.keys(element.dataset || {}).join(' '), element.getAttribute('aria-label') || '', element.textContent || ''].join(' ').toLowerCase();
  return text.includes('mission-pane-drop') || text.includes('mission-pane-head') || text.includes('internal tahai drags only') || text.includes('drop target') || text.includes('drag');
}

function pass271R4HideIdleMissionOverlays(stage: HTMLElement, normalBrowsing: boolean, reason: string): number {
  let hidden = 0;
  const selectors = ['.mission-pane-drop-zones', '.mission-pane-drop-zone', '.mission-pane-heads', '.mission-pane-head-cell', '[data-pass81-non-pane-drop-surface="true"]', '[data-pass271-r3-neutralized]'];
  stage.querySelectorAll<HTMLElement>(selectors.join(',')).forEach((element) => {
    if (!normalBrowsing && !pass271R4IsMissionChrome(element)) return;
    element.dataset.pass271R4HiddenAsIdleOverlay = normalBrowsing ? reason : 'mission-active-click-through';
    element.style.pointerEvents = 'none';
    if (normalBrowsing) {
      element.hidden = true;
      element.style.display = 'none';
      element.setAttribute('aria-hidden', 'true');
      hidden += 1;
    }
  });
  if (normalBrowsing) {
    document.body.classList.remove('mission-tab-dragging', 'pass271-r3-drag-active');
    delete document.body.dataset.pass271R3LastDragState;
  }
  return hidden;
}

function pass271R4NormalizeWebview(view: HTMLElement, activeUrl: string): void {
  view.classList.add('browser-view', 'active');
  view.hidden = false;
  view.removeAttribute('hidden');
  view.removeAttribute('aria-hidden');
  view.style.display = 'inline-flex';
  view.style.position = 'absolute';
  view.style.inset = '0';
  view.style.width = '100%';
  view.style.height = '100%';
  view.style.minWidth = '0';
  view.style.minHeight = '0';
  view.style.opacity = '1';
  view.style.visibility = 'visible';
  view.style.pointerEvents = 'auto';
  view.style.zIndex = '10';
  view.style.transform = 'none';
  view.style.background = '#ffffff';
  view.setAttribute('data-pass271-r4-active-webview', 'true');
  if (activeUrl && !view.getAttribute('src')) view.setAttribute('src', activeUrl);
}

function pass271R4RepairNormalWebview(reason = 'manual'): Pass271R4NormalWebviewReport {
  const stage = pass271R4Stage();
  const normalBrowsing = pass271R4NormalBrowsing();
  let activeWebviewCount = 0;
  let restoredWebviewCount = 0;
  let hiddenMissionOverlayCount = 0;
  let activeUrl = '';
  if (stage) {
    stage.dataset.pass271R4NormalWebviewHardRepair = 'true';
    stage.style.position = 'relative';
    stage.style.overflow = 'hidden';
    stage.style.pointerEvents = 'auto';
    stage.style.setProperty('-webkit-app-region', 'no-drag');
    const tab = pass271R4CurrentActiveTab();
    activeUrl = tab?.url || addressInput?.value || config?.homeUrl || '';
    if (tab?.webview && !stage.contains(tab.webview)) {
      stage.appendChild(tab.webview);
      restoredWebviewCount += 1;
    }
    const activeViews = Array.from(stage.querySelectorAll<HTMLElement>('webview.browser-view.active, .browser-view.active, webview.active'));
    if (!activeViews.length && tab?.webview) activeViews.push(tab.webview as unknown as HTMLElement);
    activeViews.forEach((view) => { pass271R4NormalizeWebview(view, activeUrl); activeWebviewCount += 1; });
    if (normalBrowsing) {
      Array.from(stage.children).forEach((child) => {
        const element = child as HTMLElement;
        if (element.matches('webview.browser-view.active, .browser-view.active, webview.active')) return;
        if (pass271R4IsMissionChrome(element) || element.classList.contains('mission-pane-drop-zones') || element.classList.contains('mission-pane-heads')) {
          element.hidden = true;
          element.style.display = 'none';
          element.style.pointerEvents = 'none';
          element.setAttribute('aria-hidden', 'true');
          hiddenMissionOverlayCount += 1;
        } else {
          element.style.pointerEvents = 'none';
        }
      });
    }
    hiddenMissionOverlayCount += pass271R4HideIdleMissionOverlays(stage, normalBrowsing, reason);
  }
  document.querySelectorAll<HTMLElement>('.toolbar, .toolbar *, .topbar button, .topbar .tab, .topbar .tab *, #address, #address-form, #tabs, #tabs *, #new-tab, .statusbar, .statusbar *').forEach((element) => {
    element.style.setProperty('-webkit-app-region', 'no-drag');
    element.style.pointerEvents = 'auto';
    element.dataset.pass271R4ClickSurface = 'true';
  });
  const rect = stage?.getBoundingClientRect();
  const centerX = Math.max(1, Math.floor((rect?.left || 0) + (rect?.width || window.innerWidth) / 2));
  const centerY = Math.max(1, Math.floor((rect?.top || 0) + (rect?.height || window.innerHeight) / 2));
  const blocker = document.elementFromPoint(centerX, centerY);
  const clickBlocker = pass271R4ElementLabel(blocker);
  const stageWidth = Math.round(rect?.width || 0);
  const stageHeight = Math.round(rect?.height || 0);
  const status: 'PASS' | 'WARN' = stageWidth >= 320 && stageHeight >= 240 && activeWebviewCount > 0 ? 'PASS' : 'WARN';
  const report: Pass271R4NormalWebviewReport = { pass: 'PASS271-R4', status, reason, normalBrowsing, activeWebviewCount, hiddenMissionOverlayCount, restoredWebviewCount, clickBlocker, stageWidth, stageHeight, activeUrl, generatedAt: new Date().toISOString() };
  pass271R4LastReport = report;
  (window as Pass271R4Window).__TAHAI_PASS271_R4_NORMAL_WEBVIEW_HARD_REPAIR_REPORT__ = report;
  (window as Pass271R4Window).__TAHAI_PASS271_R4_NORMAL_WEBVIEW_HARD_REPAIR__ = { repair: pass271R4RepairNormalWebview, lastReport: () => pass271R4LastReport };
  document.body.dataset.pass271R4NormalWebviewHardRepair = status.toLowerCase();
  document.body.dataset.pass271R4NormalBrowsing = String(normalBrowsing);
  document.body.dataset.pass271R4ActiveWebviewCount = String(activeWebviewCount);
  document.body.dataset.pass271R4HiddenMissionOverlayCount = String(hiddenMissionOverlayCount);
  document.body.dataset.pass271R4ClickBlocker = clickBlocker;
  document.body.dataset.pass271R4StageWidth = String(stageWidth);
  document.body.dataset.pass271R4StageHeight = String(stageHeight);
  return report;
}

function pass271R4Schedule(reason = 'scheduled'): void {
  if (pass271R4Timer) window.clearTimeout(pass271R4Timer);
  pass271R4Timer = window.setTimeout(() => {
    pass271R4Timer = undefined;
    pass271R4RepairNormalWebview(reason);
  }, 50);
}

function pass271R4Mount(): void {
  if (pass271R4Mounted) return;
  pass271R4Mounted = true;
  document.body.dataset.pass271R4NormalWebviewHardRepairMounted = 'true';
  window.addEventListener('resize', () => pass271R4Schedule('resize'));
  window.addEventListener('focus', () => pass271R4Schedule('focus'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass271R4Schedule('visibility'); });
  document.addEventListener('dragend', () => pass271R4Schedule('dragend'), true);
  document.addEventListener('drop', () => pass271R4Schedule('drop'), true);
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass271R4Schedule('mutation'));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class','style','hidden','aria-hidden','data-pass271-r3-neutralized','data-pass271-r4-hidden-as-idle-overlay'] });
  }
  pass271R4RepairNormalWebview('mount');
  window.setTimeout(() => pass271R4RepairNormalWebview('settle-250'), 250);
  window.setTimeout(() => pass271R4RepairNormalWebview('settle-1000'), 1000);
  window.setInterval(() => pass271R4RepairNormalWebview('watchdog'), 2500);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pass271R4Mount, { once: true }); else pass271R4Mount();
${rendererEnd}`;

const cssPatch = `${cssStart}
/* PASS271-R4: normal browsing must put the actual webview above idle Mission/drop chrome. */
.app-shell,
.toolbar,
.toolbar *,
.statusbar,
.statusbar *,
#webview-stage,
#webview-stage *,
dialog,
dialog * {
  -webkit-app-region: no-drag !important;
}
.topbar { -webkit-app-region: drag; }
.topbar button,
.topbar .tab,
.topbar .tab *,
.topbar .new-tab-control,
.brand,
.brand * {
  -webkit-app-region: no-drag !important;
}
#webview-stage {
  position: relative !important;
  min-width: 0 !important;
  min-height: 0 !important;
  overflow: hidden !important;
  pointer-events: auto !important;
  isolation: isolate !important;
  background: #02050b !important;
}
#webview-stage > webview.browser-view.active,
#webview-stage > .browser-view.active,
#webview-stage webview.browser-view.active,
#webview-stage webview.active,
webview[data-pass271-r4-active-webview="true"] {
  display: inline-flex !important;
  position: absolute !important;
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
  min-width: 0 !important;
  min-height: 0 !important;
  max-width: none !important;
  max-height: none !important;
  margin: 0 !important;
  opacity: 1 !important;
  visibility: visible !important;
  pointer-events: auto !important;
  transform: none !important;
  z-index: 10 !important;
  background: #fff !important;
}
body[data-pass271-r4-normal-browsing="true"] #webview-stage > :not(webview.browser-view.active):not(.browser-view.active):not(webview.active),
body[data-pass271-r4-normal-browsing="true"] .mission-pane-drop-zones,
body[data-pass271-r4-normal-browsing="true"] .mission-pane-drop-zone,
body[data-pass271-r4-normal-browsing="true"] .mission-pane-heads,
body[data-pass271-r4-normal-browsing="true"] .mission-pane-head-cell {
  display: none !important;
  visibility: hidden !important;
  pointer-events: none !important;
}
body[data-pass271-r4-normal-browsing="true"] .mission-pane-drop-zones::before,
body[data-pass271-r4-normal-browsing="true"] .mission-pane-drop-zones::after,
body[data-pass271-r4-normal-browsing="true"] .mission-pane-drop-zone::before,
body[data-pass271-r4-normal-browsing="true"] .mission-pane-drop-zone::after,
body[data-pass271-r4-normal-browsing="true"] [data-pass81-non-pane-drop-surface="true"]::before,
body[data-pass271-r4-normal-browsing="true"] [data-pass81-non-pane-drop-surface="true"]::after,
body[data-pass271-r4-normal-browsing="true"] .pass81-non-pane-drop-guard::before,
body[data-pass271-r4-normal-browsing="true"] .pass81-non-pane-drop-guard::after {
  content: "" !important;
  display: none !important;
  visibility: hidden !important;
  pointer-events: none !important;
}
.toolbar,
.toolbar button,
.toolbar input,
.toolbar select,
.toolbar textarea,
.toolbar a,
.statusbar button,
.statusbar a,
#address,
#address-form,
#tabs,
#tabs *,
#new-tab,
[data-pass271-r4-click-surface="true"] {
  pointer-events: auto !important;
}
${cssEnd}`;

const packageResult = ensurePackageScript();
const mainFile = findMainFile();
const rendererFile = findRendererFile();
const cssFile = findCssFile();
if (!mainFile || !rendererFile || !cssFile) {
  console.error(pass + '_APPLY=FAIL');
  console.error(JSON.stringify({ mainFile: Boolean(mainFile), rendererFile: Boolean(rendererFile), cssFile: Boolean(cssFile) }, null, 2));
  process.exit(1);
}
const mainResult = replaceShowFailure(mainFile);
const rendererResult = insertBlock(rendererFile, rendererStart, rendererEnd, rendererPatch, '/* PASS271_R3_NORMAL_BROWSING_CLICK_SURFACE_REPAIR_END */');
const cssResult = insertBlock(cssFile, cssStart, cssEnd, cssPatch, '/* PASS271_R3_NORMAL_BROWSING_CLICK_SURFACE_REPAIR_CSS_END */');

const reportDir = path.join(root, 'release-candidate', 'generated');
fs.mkdirSync(reportDir, { recursive: true });
const report = {
  pass,
  appliedAt: new Date().toISOString(),
  packageResult,
  main: mainResult,
  renderer: rendererResult,
  css: cssResult,
  releasePosture: 'STORE_NOT_SUBMITTED_GA_NOT_CLAIMED_SIGNED_RELEASE_NOT_CLAIMED',
  fixes: [
    'main renderer failure fallback is guarded against destroyed BrowserWindow/WebContents',
    'normal 1-Up browsing hides idle Mission drag/drop chrome instead of merely making it transparent',
    'active browser webview is reattached/restored if detached from #webview-stage',
    'active browser webview is forced full-stage, visible, and clickable',
    'stale drag-active body classes are cleared during normal browsing'
  ]
};
writeText(path.join(reportDir, 'pass271-r4-dev-runtime-window-webview-hard-repair-apply-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(pass + '_APPLY=PASS');
console.log(pass + '_MAIN_TARGET=' + mainResult.file);
console.log(pass + '_RENDERER_TARGET=' + rendererResult.file);
console.log(pass + '_CSS_TARGET=' + cssResult.file);
console.log(pass + '_PACKAGE_SCRIPT=' + (packageResult.changed ? 'updated' : 'already-present'));
console.log(pass + '_REPORT=' + rel(path.join(reportDir, 'pass271-r4-dev-runtime-window-webview-hard-repair-apply-report.json')));
