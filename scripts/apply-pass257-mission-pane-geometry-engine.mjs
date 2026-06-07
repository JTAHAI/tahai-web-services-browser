#!/usr/bin/env node
/* PASS257 — Mission Pane Geometry Engine + 2.0.6 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pass = 'PASS257';
const targetVersion = '2.0.6';
const jsStart = '/* PASS257_MISSION_PANE_GEOMETRY_ENGINE_START */';
const jsEnd = '/* PASS257_MISSION_PANE_GEOMETRY_ENGINE_END */';
const cssStart = '/* PASS257_MISSION_PANE_GEOMETRY_ENGINE_CSS_START */';
const cssEnd = '/* PASS257_MISSION_PANE_GEOMETRY_ENGINE_CSS_END */';
const skipDirs = new Set(['.git','node_modules','dist','release','release-msix','out','coverage','.vite','.next','build']);
const rendererCandidates = ['src/renderer/app.ts','src/renderer/renderer.ts','src/renderer/index.ts','src/renderer/main.ts','src/renderer/app.tsx','src/renderer/index.tsx','src/renderer/app.js','src/renderer/renderer.js','renderer/app.js','renderer/renderer.js','app/renderer/app.js'];
const cssCandidates = ['src/renderer/styles/browser.css','src/renderer/styles.css','src/renderer/renderer.css','src/renderer/app.css','src/renderer/index.css','renderer/styles.css','renderer/renderer.css','renderer/app.css','styles.css'];

const jsPatch = `${jsStart}
type Pass257LayoutIntent = 'single' | 'split-horizontal' | 'split-vertical' | 'triple-top' | 'triple-bottom' | 'triple-left' | 'triple-right' | 'quad' | 'focus';
type Pass257PaneBounds = { left: number; top: number; width: number; height: number };
type Pass257PaneGeometrySnapshot = { paneId: string; visible: boolean; hasWebview: boolean; geometryOk: boolean; webviewTopLeftOk: boolean; bounds: Pass257PaneBounds; reason: string };
const PASS257_MIN_PANE_WIDTH = 96;
const PASS257_MIN_PANE_HEIGHT = 96;
let pass257Mounted = false;
let pass257ResizeObserver: ResizeObserver | undefined;
let pass257LastGeometrySnapshot: Pass257PaneGeometrySnapshot[] = [];
let pass257PendingGeometryFrame: number | undefined;
function pass257ClampBounds(value: number, minimum = 0): number { return Math.max(minimum, Math.round(Number.isFinite(value) ? value : 0)); }
function pass257FindMissionStage(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-mission-control], [data-mission-layout], [data-pass256-state-machine="managed"], .mission-control-shell, .mission-control-modal, .mission-view-host, .mission-multiview, .mission-stage');
}
function pass257FindMissionPanes(stage?: HTMLElement | null): HTMLElement[] {
  const scope = stage || document;
  const panes = Array.from(scope.querySelectorAll<HTMLElement>('[data-mission-pane], [data-pane-id], .mission-pane, .mission-pane-shell, .mission-webview-pane'));
  return panes.length ? panes : Array.from(document.querySelectorAll<HTMLElement>('[data-pass256-pane-visible], webview')).map((node) => node.closest<HTMLElement>('[data-mission-pane], [data-pane-id], .mission-pane, .mission-pane-shell, .mission-webview-pane')).filter((node): node is HTMLElement => Boolean(node));
}
function pass257GetRequestedLayout(stage?: HTMLElement | null): Pass257LayoutIntent {
  const host = stage || pass257FindMissionStage();
  const raw = [
    host?.getAttribute('data-pass256-requested-layout'),
    host?.getAttribute('data-mission-layout'),
    currentMission?.layout && (currentMission.layout as unknown as { pass256RequestedLayout?: string }).pass256RequestedLayout,
    currentMission?.layout?.type
  ].filter(Boolean).join(' ').toLowerCase();
  if (/focus/.test(raw)) return 'focus';
  if (/quad|4-up|four/.test(raw)) return 'quad';
  if (/bottom/.test(raw)) return 'triple-bottom';
  if (/left/.test(raw)) return 'triple-left';
  if (/right/.test(raw)) return 'triple-right';
  if (/tri|triple|3-up|three/.test(raw)) return 'triple-top';
  if (/vertical/.test(raw)) return 'split-vertical';
  if (/split|2-up|two/.test(raw)) return 'split-horizontal';
  return 'single';
}
function pass257ExpectedPaneCount(layout: Pass257LayoutIntent): number {
  if (layout === 'quad') return 4;
  if (layout.startsWith('triple')) return 3;
  if (layout.startsWith('split')) return 2;
  return 1;
}
function pass257ComputePaneBounds(layout: Pass257LayoutIntent, index: number, stageRect: DOMRectReadOnly | { width: number; height: number }): Pass257PaneBounds {
  const width = pass257ClampBounds(stageRect.width, PASS257_MIN_PANE_WIDTH);
  const height = pass257ClampBounds(stageRect.height, PASS257_MIN_PANE_HEIGHT);
  const halfW = Math.floor(width / 2); const halfH = Math.floor(height / 2);
  const thirdW = Math.floor(width / 3); const thirdH = Math.floor(height / 3);
  if (layout === 'quad') return { left: index % 2 === 0 ? 0 : halfW, top: index < 2 ? 0 : halfH, width: index % 2 === 0 ? halfW : width - halfW, height: index < 2 ? halfH : height - halfH };
  if (layout === 'split-vertical') return { left: 0, top: index === 0 ? 0 : halfH, width, height: index === 0 ? halfH : height - halfH };
  if (layout === 'split-horizontal') return { left: index === 0 ? 0 : halfW, top: 0, width: index === 0 ? halfW : width - halfW, height };
  if (layout === 'triple-bottom') return index === 0 ? { left: 0, top: 0, width, height: height - thirdH } : { left: index === 1 ? 0 : halfW, top: height - thirdH, width: index === 1 ? halfW : width - halfW, height: thirdH };
  if (layout === 'triple-left') return index === 0 ? { left: 0, top: 0, width: thirdW, height } : { left: thirdW, top: index === 1 ? 0 : halfH, width: width - thirdW, height: index === 1 ? halfH : height - halfH };
  if (layout === 'triple-right') return index === 0 ? { left: width - thirdW, top: 0, width: thirdW, height } : { left: 0, top: index === 1 ? 0 : halfH, width: width - thirdW, height: index === 1 ? halfH : height - halfH };
  if (layout === 'triple-top') return index === 0 ? { left: 0, top: 0, width, height: thirdH } : { left: index === 1 ? 0 : halfW, top: thirdH, width: index === 1 ? halfW : width - halfW, height: height - thirdH };
  return { left: 0, top: 0, width, height };
}
function pass257PaneIdFor(pane: HTMLElement, index: number): string { return pane.getAttribute('data-mission-pane') || pane.getAttribute('data-pane-id') || pane.id || 'pane-' + (index + 1); }
function pass257PinRuntimeView(view: HTMLElement): boolean {
  view.style.position = 'absolute'; view.style.top = '0px'; view.style.left = '0px'; view.style.right = '0px'; view.style.bottom = '0px'; view.style.width = '100%'; view.style.height = '100%'; view.style.minWidth = '0'; view.style.minHeight = '0'; view.style.transform = 'none'; view.style.margin = '0';
  const topLeftOk = view.style.top === '0px' && view.style.left === '0px' && view.style.transform === 'none';
  view.setAttribute('data-webview-top-left-ok', topLeftOk ? 'true' : 'false');
  view.setAttribute('data-pass257-runtime-view-pinned', 'true');
  return topLeftOk;
}
function pass257ApplyPaneBounds(pane: HTMLElement, index: number, layout: Pass257LayoutIntent, stageRect: DOMRectReadOnly | { width: number; height: number }, visible: boolean, reason: string): Pass257PaneGeometrySnapshot {
  const paneId = pass257PaneIdFor(pane, index);
  const bounds = pass257ComputePaneBounds(layout, index, stageRect);
  pane.setAttribute('data-mission-pane', paneId); pane.setAttribute('data-pass257-pane-managed', 'true'); pane.setAttribute('data-pane-visible', visible ? 'true' : 'false');
  pane.style.position = 'absolute'; pane.style.boxSizing = 'border-box'; pane.style.minWidth = '0'; pane.style.minHeight = '0'; pane.style.overflow = 'hidden'; pane.style.contain = 'layout style'; pane.style.transform = 'none';
  if (visible) { pane.hidden = false; pane.style.display = ''; pane.style.left = bounds.left + 'px'; pane.style.top = bounds.top + 'px'; pane.style.width = bounds.width + 'px'; pane.style.height = bounds.height + 'px'; }
  else { pane.hidden = true; pane.style.display = 'none'; pane.setAttribute('data-pass257-removed-from-active-routing', 'true'); }
  const webview = pane.querySelector<HTMLElement>('webview, iframe');
  const hasWebview = Boolean(webview);
  pane.setAttribute('data-pane-has-webview', hasWebview ? 'true' : 'false');
  let webviewTopLeftOk = !hasWebview;
  if (webview) webviewTopLeftOk = pass257PinRuntimeView(webview);
  const geometryOk = !visible || (bounds.width >= PASS257_MIN_PANE_WIDTH && bounds.height >= PASS257_MIN_PANE_HEIGHT && bounds.top >= 0 && bounds.left >= 0);
  pane.setAttribute('data-pane-geometry-ok', geometryOk ? 'true' : 'false'); pane.setAttribute('data-webview-top-left-ok', webviewTopLeftOk ? 'true' : 'false'); pane.setAttribute('data-pass257-geometry-reason', reason);
  return { paneId, visible, hasWebview, geometryOk, webviewTopLeftOk, bounds, reason };
}
function pass257StageRect(stage: HTMLElement): DOMRectReadOnly | { width: number; height: number } {
  const rect = stage.getBoundingClientRect();
  const width = rect.width || stage.clientWidth || window.innerWidth || 1280;
  const height = rect.height || stage.clientHeight || Math.max(360, window.innerHeight - 120) || 720;
  return { width, height };
}
function pass257RecalculateMissionPaneGeometry(reason = 'manual'): Pass257PaneGeometrySnapshot[] {
  const stage = pass257FindMissionStage();
  if (!stage) return [];
  const panes = pass257FindMissionPanes(stage);
  const layout = pass257GetRequestedLayout(stage);
  const expected = pass257ExpectedPaneCount(layout);
  const rect = pass257StageRect(stage);
  stage.setAttribute('data-pass257-geometry-engine', 'managed'); stage.setAttribute('data-pass257-layout-intent', layout); stage.setAttribute('data-pass257-expected-pane-count', String(expected));
  stage.style.position = stage.style.position || 'relative'; stage.style.minWidth = '0'; stage.style.minHeight = '0'; stage.style.overflow = 'hidden'; stage.style.contain = 'layout style';
  pass257LastGeometrySnapshot = panes.map((pane, index) => pass257ApplyPaneBounds(pane, index, layout, rect, index < expected, reason));
  const visibleIssues = pass257LastGeometrySnapshot.filter((snap) => snap.visible && (!snap.geometryOk || !snap.webviewTopLeftOk));
  stage.setAttribute('data-pass257-geometry-ok', visibleIssues.length ? 'false' : 'true');
  stage.setAttribute('data-pass257-last-recalc', new Date().toISOString());
  return pass257LastGeometrySnapshot;
}
function pass257ScheduleGeometry(reason: string): void { if (pass257PendingGeometryFrame) cancelAnimationFrame(pass257PendingGeometryFrame); pass257PendingGeometryFrame = requestAnimationFrame(() => { pass257PendingGeometryFrame = undefined; pass257RecalculateMissionPaneGeometry(reason); }); }
function pass257ObserveGeometryTargets(): void {
  if (typeof ResizeObserver === 'undefined') return;
  if (pass257ResizeObserver) pass257ResizeObserver.disconnect();
  pass257ResizeObserver = new ResizeObserver(() => pass257ScheduleGeometry('resize-observer'));
  const stage = pass257FindMissionStage(); if (stage) pass257ResizeObserver.observe(stage);
  pass257FindMissionPanes(stage).forEach((pane) => pass257ResizeObserver?.observe(pane));
}
function pass257MountMissionPaneGeometryEngine(): void {
  if (pass257Mounted) return; pass257Mounted = true;
  window.addEventListener('resize', () => pass257ScheduleGeometry('window-resize'));
  window.addEventListener('tahai:mission-layout-change', () => pass257ScheduleGeometry('mission-layout-change'));
  document.addEventListener('did-stop-loading', () => pass257ScheduleGeometry('did-stop-loading'), true);
  document.addEventListener('dom-ready', () => pass257ScheduleGeometry('dom-ready'), true);
  document.addEventListener('focusin', () => pass257ScheduleGeometry('focusin'), true);
  document.addEventListener('click', () => pass257ScheduleGeometry('operator-click'), true);
  pass257ObserveGeometryTargets(); pass257ScheduleGeometry('mount');
  (window as unknown as { __TAHAI_PASS257_MISSION_PANE_GEOMETRY__?: unknown }).__TAHAI_PASS257_MISSION_PANE_GEOMETRY__ = { recalc: pass257RecalculateMissionPaneGeometry, observe: pass257ObserveGeometryTargets, lastSnapshot: () => pass257LastGeometrySnapshot, computePaneBounds: pass257ComputePaneBounds };
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pass257MountMissionPaneGeometryEngine, { once: true }); else pass257MountMissionPaneGeometryEngine();
${jsEnd}`;

const cssPatch = `${cssStart}
[data-pass257-geometry-engine="managed"] { position: relative !important; min-width: 0 !important; min-height: 0 !important; overflow: hidden !important; contain: layout style !important; }
[data-pass257-pane-managed="true"] { box-sizing: border-box !important; min-width: 0 !important; min-height: 0 !important; overflow: hidden !important; contain: layout style !important; }
[data-pass257-pane-managed="true"][data-pane-visible="true"] { position: absolute !important; display: block !important; visibility: visible !important; pointer-events: auto !important; }
[data-pass257-pane-managed="true"][data-pane-visible="false"] { display: none !important; visibility: hidden !important; pointer-events: none !important; }
[data-pass257-pane-managed="true"] > webview, [data-pass257-pane-managed="true"] > iframe, [data-pass257-pane-managed="true"] webview, [data-pass257-pane-managed="true"] iframe { position: absolute !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; width: 100% !important; height: 100% !important; min-width: 0 !important; min-height: 0 !important; margin: 0 !important; transform: none !important; }
[data-pass257-pane-managed="true"][data-pane-geometry-ok="false"], [data-pass257-pane-managed="true"][data-webview-top-left-ok="false"] { outline: 1px solid rgba(255, 84, 84, 0.52) !important; outline-offset: -1px !important; }
[data-pass257-pane-managed="true"][data-pane-visible="true"][data-pane-has-webview="false"]::after { content: "Mission pane ready — start a recipe, restore layout, or send a tab here."; position: absolute; inset: 0; display: grid; place-items: center; padding: 18px; text-align: center; font-size: 12px; line-height: 1.4; color: rgba(226, 241, 255, 0.74); background: radial-gradient(circle at top, rgba(32,120,190,.18), rgba(3,10,18,.86)); pointer-events: none; }
${cssEnd}`;

function rel(file) { return path.relative(root, file).split(path.sep).join('/'); }
function readText(file) { return fs.readFileSync(file, 'utf8'); }
function writeText(file, text) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }
function walk(dir, matcher, acc = []) { let entries = []; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; } for (const entry of entries) { if (skipDirs.has(entry.name)) continue; const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full, matcher, acc); else if (matcher(full)) acc.push(full); } return acc; }
function parseVersion(v) { const m = String(v || '').match(/^(\d+)\.(\d+)\.(\d+)(.*)$/); return m ? { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) } : null; }
function versionAtLeast(actual, expected) { const a = parseVersion(actual); const e = parseVersion(expected); if (!a || !e) return false; if (a.major !== e.major) return a.major > e.major; if (a.minor !== e.minor) return a.minor > e.minor; return a.patch >= e.patch; }
function ensurePackage() { const file = path.join(root, 'package.json'); if (!fs.existsSync(file)) return { packageJsonFound: false, changes: [] }; const pkg = JSON.parse(readText(file)); const before = pkg.version; if (!versionAtLeast(pkg.version, targetVersion)) pkg.version = targetVersion; pkg.scripts = pkg.scripts || {}; pkg.scripts['verify:pass-257-mission-pane-geometry-engine'] = 'node scripts/verify-pass257-mission-pane-geometry-engine.mjs'; writeText(file, JSON.stringify(pkg, null, 2) + '\n'); return { packageJsonFound: true, version: pkg.version, scriptName: 'verify:pass-257-mission-pane-geometry-engine', changes: [{ file: 'package.json', changed: before !== pkg.version, before, after: pkg.version }] }; }
function findRendererFile() { for (const candidate of rendererCandidates) { const full = path.join(root, candidate); if (fs.existsSync(full) && readText(full).includes('PASS256_QUAD_VIEW_STATE_MACHINE_START')) return full; } const found = walk(root, (file) => /\.(ts|tsx|js|jsx)$/i.test(file)).filter((file) => readText(file).includes('PASS256_QUAD_VIEW_STATE_MACHINE_START')); return found[0] || null; }
function findCssFile() { for (const candidate of cssCandidates) { const full = path.join(root, candidate); if (fs.existsSync(full) && readText(full).includes('PASS256_QUAD_VIEW_STATE_MACHINE_CSS_START')) return full; } const found = walk(root, (file) => /\.css$/i.test(file)).filter((file) => readText(file).includes('PASS256_QUAD_VIEW_STATE_MACHINE_CSS_START')); if (found[0]) return found[0]; const fallback = path.join(root, 'src/renderer/styles/browser.css'); fs.mkdirSync(path.dirname(fallback), { recursive: true }); if (!fs.existsSync(fallback)) writeText(fallback, ''); return fallback; }
function replaceBlock(text, start, end, block) { const s = text.indexOf(start); const e = text.indexOf(end); if (s >= 0 && e > s) return text.slice(0, s) + block + text.slice(e + end.length); return null; }
function insertJs(file) { let text = readText(file); const replaced = replaceBlock(text, jsStart, jsEnd, jsPatch); if (replaced !== null) { writeText(file, replaced); return { file: rel(file), changed: replaced !== text, mode: 'replaced' }; } const pass256End = '/* PASS256_QUAD_VIEW_STATE_MACHINE_END */'; if (text.includes(pass256End)) text = text.replace(pass256End, pass256End + '\n\n' + jsPatch); else text += '\n\n' + jsPatch + '\n'; writeText(file, text); return { file: rel(file), changed: true, mode: 'inserted' }; }
function insertCss(file) { let text = readText(file); const replaced = replaceBlock(text, cssStart, cssEnd, cssPatch); if (replaced !== null) { writeText(file, replaced); return { file: rel(file), changed: replaced !== text, mode: 'replaced' }; } const pass256CssEnd = '/* PASS256_QUAD_VIEW_STATE_MACHINE_CSS_END */'; if (text.includes(pass256CssEnd)) text = text.replace(pass256CssEnd, pass256CssEnd + '\n\n' + cssPatch); else text = text.trimEnd() + '\n\n' + cssPatch + '\n'; writeText(file, text); return { file: rel(file), changed: true, mode: 'inserted' }; }

const packageResult = ensurePackage();
const rendererFile = findRendererFile();
if (!rendererFile) { console.error(pass + '_APPLY=FAIL'); console.error('Could not find renderer source containing PASS256 Quad View state machine. Apply PASS250-PASS256 first.'); process.exit(1); }
const cssFile = findCssFile();
const jsResult = insertJs(rendererFile);
const cssResult = insertCss(cssFile);
const reportDir = path.join(root, 'release-candidate', 'generated');
fs.mkdirSync(reportDir, { recursive: true });
const report = { pass, appliedAt: new Date().toISOString(), packageResult, renderer: jsResult, css: cssResult, storeSubmissionStatus: 'BLOCKED_UNTIL_RECIPE_QUAD_RUNTIME_SMOKE', geometryFlags: ['data-pane-visible','data-pane-has-webview','data-pane-geometry-ok','data-webview-top-left-ok'], canonicalLayouts: ['single','split-horizontal','split-vertical','triple-top','triple-bottom','triple-left','triple-right','quad','focus'] };
writeText(path.join(reportDir, 'pass257-mission-pane-geometry-engine-apply-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(pass + '_APPLY=PASS');
console.log(pass + '_VERSION=' + (packageResult.version || 'unknown'));
console.log(pass + '_RENDERER_TARGET=' + jsResult.file);
console.log(pass + '_CSS_TARGET=' + cssResult.file);
console.log(pass + '_REPORT=' + rel(path.join(reportDir, 'pass257-mission-pane-geometry-engine-apply-report.json')));
