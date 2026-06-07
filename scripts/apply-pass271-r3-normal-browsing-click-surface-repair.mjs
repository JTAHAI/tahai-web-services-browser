#!/usr/bin/env node
/*
  PASS271-R3 — Normal Browsing Click Surface + Webview Visibility Repair

  This is a release-blocker repair after installed/runtime smoke showed the UI chrome
  rendering while the website surface stayed black and the shell/webview was not clickable.

  Scope:
  - No new product feature.
  - Protect normal 1-Up browsing first.
  - Ensure browser chrome remains no-drag/clickable.
  - Ensure the active <webview> owns the website budget.
  - Ensure Mission drag/drop helper layers are click-through when the operator is not actively dragging.
*/
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pass = 'PASS271_R3';
const jsStart = '/* PASS271_R3_NORMAL_BROWSING_CLICK_SURFACE_REPAIR_START */';
const jsEnd = '/* PASS271_R3_NORMAL_BROWSING_CLICK_SURFACE_REPAIR_END */';
const cssStart = '/* PASS271_R3_NORMAL_BROWSING_CLICK_SURFACE_REPAIR_CSS_START */';
const cssEnd = '/* PASS271_R3_NORMAL_BROWSING_CLICK_SURFACE_REPAIR_CSS_END */';
const scriptName = 'verify:pass-271-r3-normal-browsing-click-surface-repair';
const scriptValue = 'node scripts/verify-pass271-r3-normal-browsing-click-surface-repair.mjs';

const skipDirs = new Set(['.git','node_modules','dist','release','release-msix','out','coverage','.vite','.next','build']);
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

const jsPatch = `${jsStart}
type Pass271R3SurfaceReport = {
  pass: 'PASS271-R3';
  status: 'PASS' | 'WARN';
  reason: string;
  activeWebviewCount: number;
  neutralizedOverlayCount: number;
  clickSurfaceCount: number;
  stageHasWebsiteBudget: boolean;
  dragActive: boolean;
  generatedAt: string;
};

type Pass271R3Window = Window & typeof globalThis & {
  __TAHAI_PASS271_R3_NORMAL_BROWSING_SURFACE__?: {
    repair: (reason?: string) => Pass271R3SurfaceReport;
    lastReport: () => Pass271R3SurfaceReport | null;
  };
  __TAHAI_PASS271_R3_NORMAL_BROWSING_SURFACE_REPORT__?: Pass271R3SurfaceReport;
};

let pass271R3Mounted = false;
let pass271R3Timer: number | undefined;
let pass271R3LastReport: Pass271R3SurfaceReport | null = null;

function pass271R3IsElementVisible(element: Element): boolean {
  const html = element as HTMLElement;
  if (html.hidden || html.getAttribute('aria-hidden') === 'true') return false;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') !== 0;
}

function pass271R3Stage(): HTMLElement | null {
  return document.getElementById('webview-stage') as HTMLElement | null;
}

function pass271R3DragActive(): boolean {
  return document.body.classList.contains('mission-tab-dragging') || document.body.classList.contains('pass271-r3-drag-active');
}

function pass271R3NormalizeActiveWebview(view: HTMLElement): void {
  view.style.position = 'absolute';
  view.style.setProperty('inset', '0');
  view.style.width = '100%';
  view.style.height = '100%';
  view.style.minWidth = '0';
  view.style.minHeight = '0';
  view.style.margin = '0';
  view.style.opacity = '1';
  view.style.visibility = 'visible';
  view.style.pointerEvents = 'auto';
  view.style.zIndex = '1';
  view.style.transform = 'none';
  view.style.display = 'flex';
  view.removeAttribute('hidden');
  view.setAttribute('data-pass271-r3-active-webview', 'true');
}

function pass271R3IsDragDropOverlay(element: HTMLElement): boolean {
  const haystack = [element.id, String(element.className || ''), Object.keys(element.dataset || {}).join(' '), element.getAttribute('aria-label') || '', element.textContent || ''].join(' ').toLowerCase();
  if (haystack.includes('internal tahai drags only')) return true;
  if (element.classList.contains('mission-pane-drop-zones') || element.classList.contains('mission-pane-drop-zone')) return true;
  if (element.classList.contains('pass81-non-pane-drop-guard')) return true;
  if (!/(drop|drag)/i.test(haystack)) return false;
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  const z = Number.parseInt(style.zIndex || '0', 10);
  const largeOverlay = rect.width >= Math.max(320, window.innerWidth * 0.42) && rect.height >= Math.max(180, window.innerHeight * 0.28);
  const positioned = style.position === 'absolute' || style.position === 'fixed' || style.position === 'sticky';
  return largeOverlay && positioned && (Number.isFinite(z) ? z >= 2 : true);
}

function pass271R3NeutralizeIdleDragOverlays(reason: string): number {
  const activeDrag = pass271R3DragActive();
  let neutralized = 0;
  const selectors = [
    '.mission-pane-drop-zones',
    '.mission-pane-drop-zone',
    '.pass81-non-pane-drop-guard',
    '[data-pass271-r3-neutralized]',
    '[class*="drop" i]',
    '[class*="drag" i]',
    '[data-pass81-non-pane-drop-surface]'
  ].join(',');
  document.querySelectorAll<HTMLElement>(selectors).forEach((element) => {
    if (!pass271R3IsElementVisible(element)) return;
    if (!pass271R3IsDragDropOverlay(element)) return;
    if (!activeDrag) {
      if (element.dataset.pass271R3OriginalPointerEvents === undefined) element.dataset.pass271R3OriginalPointerEvents = element.style.pointerEvents || '';
      element.style.pointerEvents = 'none';
      element.dataset.pass271R3Neutralized = 'idle-click-through';
      element.dataset.pass271R3NeutralizedReason = reason;
      neutralized += 1;
    } else if (element.dataset.pass271R3Neutralized === 'idle-click-through') {
      element.style.pointerEvents = element.dataset.pass271R3OriginalPointerEvents || '';
      delete element.dataset.pass271R3Neutralized;
      delete element.dataset.pass271R3NeutralizedReason;
    }
  });
  return neutralized;
}

function pass271R3ProtectClickSurfaces(): number {
  const clickSelectors = [
    '.toolbar', '.toolbar *', '.topbar button', '.topbar .tab', '.topbar .tab *', '.new-tab-control',
    '#address', '#address-form', '#statusbar', '#statusbar *', 'dialog', 'dialog *',
    '#devops-tools-panel:not([hidden])', '#it-tools-panel:not([hidden])', '#ops-hub:not([hidden])'
  ].join(',');
  let count = 0;
  document.querySelectorAll<HTMLElement>(clickSelectors).forEach((element) => {
    element.style.setProperty('-webkit-app-region', 'no-drag');
    element.dataset.pass271R3ClickSurface = 'true';
    count += 1;
  });
  return count;
}

function pass271R3RepairNormalBrowsingSurface(reason = 'manual'): Pass271R3SurfaceReport {
  const stage = pass271R3Stage();
  let activeWebviewCount = 0;
  if (stage) {
    stage.dataset.pass271R3NormalBrowsingSurface = 'managed';
    stage.style.position = 'relative';
    stage.style.minWidth = '0';
    stage.style.minHeight = '0';
    stage.style.overflow = 'hidden';
    stage.style.pointerEvents = 'auto';
    stage.style.setProperty('-webkit-app-region', 'no-drag');
    const activeViews = Array.from(stage.querySelectorAll<HTMLElement>('.browser-view.active, webview.active, webview.browser-view.active'));
    activeViews.forEach((view) => {
      pass271R3NormalizeActiveWebview(view);
      activeWebviewCount += 1;
    });
    stage.querySelectorAll<HTMLElement>('.browser-view:not(.active), webview.browser-view:not(.active)').forEach((view) => {
      if (!view.closest('[data-pass257-pane-managed="true"]')) view.style.pointerEvents = 'none';
    });
  }
  const neutralizedOverlayCount = pass271R3NeutralizeIdleDragOverlays(reason);
  const clickSurfaceCount = pass271R3ProtectClickSurfaces();
  const stageRect = stage?.getBoundingClientRect();
  const stageHasWebsiteBudget = Boolean(stageRect && stageRect.width >= 360 && stageRect.height >= 240);
  const status: 'PASS' | 'WARN' = stageHasWebsiteBudget && clickSurfaceCount > 0 ? 'PASS' : 'WARN';
  const report: Pass271R3SurfaceReport = {
    pass: 'PASS271-R3',
    status,
    reason,
    activeWebviewCount,
    neutralizedOverlayCount,
    clickSurfaceCount,
    stageHasWebsiteBudget,
    dragActive: pass271R3DragActive(),
    generatedAt: new Date().toISOString()
  };
  pass271R3LastReport = report;
  const tahaiWindow = window as Pass271R3Window;
  tahaiWindow.__TAHAI_PASS271_R3_NORMAL_BROWSING_SURFACE_REPORT__ = report;
  document.documentElement.setAttribute('data-pass271-r3-normal-browsing-surface', status.toLowerCase());
  document.body.dataset.pass271R3NormalBrowsingSurface = status.toLowerCase();
  document.body.dataset.pass271R3NeutralizedOverlayCount = String(neutralizedOverlayCount);
  document.body.dataset.pass271R3ActiveWebviewCount = String(activeWebviewCount);
  document.body.dataset.pass271R3ClickSurfaceCount = String(clickSurfaceCount);
  document.body.dataset.pass271R3StageHasWebsiteBudget = String(stageHasWebsiteBudget);
  return report;
}

function pass271R3Schedule(reason = 'scheduled'): void {
  if (pass271R3Timer) window.clearTimeout(pass271R3Timer);
  pass271R3Timer = window.setTimeout(() => {
    pass271R3Timer = undefined;
    pass271R3RepairNormalBrowsingSurface(reason);
  }, 35);
}

function pass271R3SetDragActive(active: boolean, reason: string): void {
  document.body.classList.toggle('pass271-r3-drag-active', active);
  document.body.dataset.pass271R3LastDragState = active ? 'active:' + reason : 'idle:' + reason;
  pass271R3Schedule(reason);
}

function pass271R3Mount(): void {
  if (pass271R3Mounted) return;
  pass271R3Mounted = true;
  document.body.dataset.pass271R3NormalBrowsingClickSurfaceRepairMounted = 'true';
  document.addEventListener('dragstart', () => pass271R3SetDragActive(true, 'dragstart'), true);
  document.addEventListener('dragenter', () => pass271R3SetDragActive(true, 'dragenter'), true);
  document.addEventListener('dragend', () => pass271R3SetDragActive(false, 'dragend'), true);
  document.addEventListener('drop', () => pass271R3SetDragActive(false, 'drop'), true);
  document.addEventListener('dragleave', (event) => {
    if (event.target === document || event.target === document.documentElement || event.target === document.body) pass271R3SetDragActive(false, 'dragleave-root');
  }, true);
  window.addEventListener('resize', () => pass271R3Schedule('resize'));
  window.addEventListener('focus', () => pass271R3Schedule('focus'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pass271R3Schedule('visibility'); });
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass271R3Schedule('mutation'));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class','style','hidden','aria-hidden','data-pane-id','data-pass271-r3-neutralized'] });
  }
  const tahaiWindow = window as Pass271R3Window;
  tahaiWindow.__TAHAI_PASS271_R3_NORMAL_BROWSING_SURFACE__ = {
    repair: pass271R3RepairNormalBrowsingSurface,
    lastReport: () => pass271R3LastReport
  };
  pass271R3Schedule('mount');
  window.setTimeout(() => pass271R3RepairNormalBrowsingSurface('settle-250'), 250);
  window.setTimeout(() => pass271R3RepairNormalBrowsingSurface('settle-1000'), 1000);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pass271R3Mount, { once: true }); else pass271R3Mount();
${jsEnd}`;

const cssPatch = `${cssStart}
/* PASS271-R3: normal browsing must remain a clickable website, not a drag/drop overlay. */
.app-shell,
.toolbar,
.toolbar *,
.statusbar,
.statusbar *,
dialog,
dialog *,
#webview-stage,
#webview-stage * {
  -webkit-app-region: no-drag !important;
}

.topbar {
  -webkit-app-region: drag;
}
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

#webview-stage::before,
#webview-stage::after,
body:not(.mission-tab-dragging):not(.pass271-r3-drag-active) .mission-pane-drop-zones::before,
body:not(.mission-tab-dragging):not(.pass271-r3-drag-active) .mission-pane-drop-zones::after,
body:not(.mission-tab-dragging):not(.pass271-r3-drag-active) .mission-pane-drop-zone::before,
body:not(.mission-tab-dragging):not(.pass271-r3-drag-active) .mission-pane-drop-zone::after,
body:not(.mission-tab-dragging):not(.pass271-r3-drag-active) [data-pass81-non-pane-drop-surface="true"]::before,
body:not(.mission-tab-dragging):not(.pass271-r3-drag-active) [data-pass81-non-pane-drop-surface="true"]::after,
body:not(.mission-tab-dragging):not(.pass271-r3-drag-active) .pass81-non-pane-drop-guard::before,
body:not(.mission-tab-dragging):not(.pass271-r3-drag-active) .pass81-non-pane-drop-guard::after {
  content: "" !important;
  display: none !important;
  visibility: hidden !important;
  pointer-events: none !important;
}

#webview-stage > .browser-view.active,
#webview-stage > webview.browser-view.active,
#webview-stage webview.browser-view.active,
#webview-stage webview.active {
  display: flex !important;
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
  z-index: 1 !important;
  background: #fff !important;
}

#webview-stage > .browser-view:not(.active),
#webview-stage > webview.browser-view:not(.active) {
  pointer-events: none !important;
}

/* Drop targets are visual/interactive only during a real internal drag. Idle drop layers must never block website clicks. */
body:not(.mission-tab-dragging):not(.pass271-r3-drag-active) .mission-pane-drop-zones,
body:not(.mission-tab-dragging):not(.pass271-r3-drag-active) .mission-pane-drop-zone,
body:not(.mission-tab-dragging):not(.pass271-r3-drag-active) [data-pass271-r3-neutralized="idle-click-through"] {
  pointer-events: none !important;
}

body.mission-tab-dragging .mission-pane-drop-zones,
body.pass271-r3-drag-active .mission-pane-drop-zones,
body.mission-tab-dragging .mission-pane-drop-zone,
body.pass271-r3-drag-active .mission-pane-drop-zone {
  pointer-events: auto !important;
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
#tabs button,
#new-tab {
  pointer-events: auto !important;
}

[data-pass271-r3-click-surface="true"] {
  pointer-events: auto !important;
}

body[data-pass271-r3-stage-has-website-budget="false"] #webview-stage {
  min-height: clamp(320px, 60vh, 820px) !important;
}
${cssEnd}`;

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
function insertBlock(file, start, end, block, anchor) {
  let text = readText(file);
  const replaced = replaceBlock(text, start, end, block);
  if (replaced !== null) { writeText(file, replaced); return { file: rel(file), changed: replaced !== text, mode: 'replaced' }; }
  if (anchor && text.includes(anchor)) text = text.replace(anchor, anchor + '\n\n' + block);
  else text = text.trimEnd() + '\n\n' + block + '\n';
  writeText(file, text);
  return { file: rel(file), changed: true, mode: 'inserted' };
}

const packageResult = ensurePackageScript();
const rendererFile = findRendererFile();
if (!rendererFile) {
  console.error(pass + '_APPLY=FAIL');
  console.error('Could not locate renderer source with webview-stage.');
  process.exit(1);
}
const cssFile = findCssFile();
const jsResult = insertBlock(rendererFile, jsStart, jsEnd, jsPatch, '/* PASS271_R2_VERIFIER_WINDOWS_PATH_REPAIR_END */');
const cssResult = insertBlock(cssFile, cssStart, cssEnd, cssPatch, '/* PASS270_RESTORED_MAXIMIZED_SMALL_WINDOW_VISUAL_SOAK_CSS_END */');

const reportDir = path.join(root, 'release-candidate', 'generated');
fs.mkdirSync(reportDir, { recursive: true });
const report = {
  pass,
  appliedAt: new Date().toISOString(),
  packageResult,
  renderer: jsResult,
  css: cssResult,
  releasePosture: 'STORE_NOT_SUBMITTED_GA_NOT_CLAIMED_SIGNED_RELEASE_NOT_CLAIMED',
  fixes: [
    'browser chrome forced no-drag/clickable outside titlebar',
    'normal active webview forced visible and full-stage',
    'idle Mission drag/drop overlays forced click-through',
    'INTERNAL TAHAI DRAGS ONLY pseudo/overlay labels suppressed outside active drag',
    'website budget evidence attributes added for runtime inspection'
  ]
};
writeText(path.join(reportDir, 'pass271-r3-normal-browsing-click-surface-repair-apply-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(pass + '_APPLY=PASS');
console.log(pass + '_RENDERER_TARGET=' + jsResult.file);
console.log(pass + '_CSS_TARGET=' + cssResult.file);
console.log(pass + '_PACKAGE_SCRIPT=' + (packageResult.changed ? 'updated' : 'already-present'));
console.log(pass + '_REPORT=' + rel(path.join(reportDir, 'pass271-r3-normal-browsing-click-surface-repair-apply-report.json')));
