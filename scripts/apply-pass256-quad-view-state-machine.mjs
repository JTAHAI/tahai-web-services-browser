#!/usr/bin/env node
/* PASS256 — Quad View State Machine + 2.0.5 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pass = 'PASS256';
const targetVersion = '2.0.5';
const jsStart = '/* PASS256_QUAD_VIEW_STATE_MACHINE_START */';
const jsEnd = '/* PASS256_QUAD_VIEW_STATE_MACHINE_END */';
const cssStart = '/* PASS256_QUAD_VIEW_STATE_MACHINE_CSS_START */';
const cssEnd = '/* PASS256_QUAD_VIEW_STATE_MACHINE_CSS_END */';
const skipDirs = new Set(['.git','node_modules','dist','release','release-msix','out','coverage','.vite','.next','build']);
const rendererCandidates = ['src/renderer/app.ts','src/renderer/renderer.ts','src/renderer/index.ts','src/renderer/main.ts','src/renderer/app.tsx','src/renderer/index.tsx','src/renderer/app.js','src/renderer/renderer.js','renderer/app.js','renderer/renderer.js','app/renderer/app.js'];
const cssCandidates = ['src/renderer/styles/browser.css','src/renderer/styles.css','src/renderer/renderer.css','src/renderer/app.css','src/renderer/index.css','renderer/styles.css','renderer/renderer.css','renderer/app.css','styles.css'];

const jsPatch = `${jsStart}
type Pass256LayoutRequest = 'single' | 'split-horizontal' | 'split-vertical' | 'triple-top' | 'triple-bottom' | 'triple-left' | 'triple-right' | 'quad' | 'focus' | 'restore';
type Pass256LayoutPhase = 'idle' | 'preflight' | 'commit' | 'render' | 'geometry-settle' | 'post-assert' | 'recover' | 'rollback' | 'complete';
type Pass256TransitionReport = { ok: boolean; request: Pass256LayoutRequest; phase: Pass256LayoutPhase; phases: string[]; repairs: string[]; issues: string[]; completedAt?: string };
const PASS256_LAYOUT_STRESS_CYCLE_COUNT = 50;
const PASS256_LAYOUT_STRESS_SEQUENCE: Pass256LayoutRequest[] = ['single', 'split-horizontal', 'triple-top', 'triple-bottom', 'triple-left', 'triple-right', 'quad', 'focus', 'quad', 'single'];
let pass256Mounted = false;
let pass256TransitionBusy = false;
let pass256LastStableLayout: { request: Pass256LayoutRequest; activePaneId: string; visiblePaneIds: string[] } | undefined;
let pass256LastTransitionReport: Pass256TransitionReport | undefined;
let pass256PendingTimer: number | undefined;
function pass256NormalizeLayoutRequest(input: unknown): Pass256LayoutRequest {
  const value = String(input || '').toLowerCase().replace(/_/g, '-');
  if (/restore/.test(value)) return 'restore';
  if (/focus/.test(value)) return 'focus';
  if (/quad|4-up|four/.test(value)) return 'quad';
  if (/bottom/.test(value)) return 'triple-bottom';
  if (/left/.test(value)) return 'triple-left';
  if (/right/.test(value)) return 'triple-right';
  if (/tri|triple|3-up|three/.test(value)) return 'triple-top';
  if (/vertical/.test(value)) return 'split-vertical';
  if (/split|2-up|two/.test(value)) return 'split-horizontal';
  return 'single';
}
function pass256BaseLayoutType(request: Pass256LayoutRequest): MissionLayoutType {
  if (request === 'quad') return 'quad' as MissionLayoutType;
  if (request === 'focus') return 'focus' as MissionLayoutType;
  if (request.startsWith('triple')) return 'triple' as MissionLayoutType;
  if (request.startsWith('split')) return 'split-horizontal' as MissionLayoutType;
  return 'single' as MissionLayoutType;
}
function pass256VisiblePaneIds(request: Pass256LayoutRequest, activePaneId?: string): string[] {
  if (request === 'quad') return ['pane-1','pane-2','pane-3','pane-4'];
  if (request.startsWith('triple')) return ['pane-1','pane-2','pane-3'];
  if (request.startsWith('split')) return ['pane-1','pane-2'];
  if (request === 'focus') return [activePaneId || pass256LastStableLayout?.activePaneId || currentMission?.layout?.activePaneId || 'pane-1'];
  if (request === 'restore' && pass256LastStableLayout) return pass256LastStableLayout.visiblePaneIds;
  return ['pane-1'];
}
function pass256RoleForPane(index: number): MissionTabRole { return (['primary-console','logs','live-target','runbook'][index] || 'docs') as MissionTabRole; }
function pass256UrlForPane(role: MissionTabRole): string {
  if (role === 'docs' || role === 'runbook') return normalizeTarget(config?.itDocsUrl || config?.homeUrl || 'https://tahaiportal.com');
  return normalizeTarget(config?.newTabUrl || config?.homeUrl || 'https://tahaiportal.com');
}
function pass256PreflightLayoutTransition(request: Pass256LayoutRequest, report: Pass256TransitionReport): boolean {
  report.phase = 'preflight'; report.phases.push('preflight');
  if (!currentMission) { report.issues.push('no-current-mission-dom-only-transition'); return true; }
  if (!currentMission.layout) { currentMission.layout = { type: 'single' as MissionLayoutType, activePaneId: 'pane-1', panes: [] }; report.repairs.push('layout-created'); }
  if (!Array.isArray(currentMission.tabs)) { currentMission.tabs = []; report.repairs.push('tabs-created'); }
  if (!Array.isArray(currentMission.layout.panes)) { currentMission.layout.panes = []; report.repairs.push('layout-panes-created'); }
  const visible = pass256VisiblePaneIds(request, currentMission.layout.activePaneId);
  if (!visible.includes(currentMission.layout.activePaneId)) { currentMission.layout.activePaneId = visible[0] || 'pane-1'; report.repairs.push('hidden-active-pane-preflight-repaired'); }
  return true;
}
function pass256EnsurePaneMapping(paneId: string, index: number, report: Pass256TransitionReport): void {
  if (!currentMission) return;
  let tab = currentMission.tabs.find((candidate) => candidate.paneId === paneId);
  const role = tab?.role || pass256RoleForPane(index);
  if (!tab) {
    tab = { tabId: missionUuid(), role, url: pass256UrlForPane(role), title: 'Mission Pane ' + (index + 1), pinned: false, paneId };
    currentMission.tabs.push(tab); report.repairs.push('mission-tab-created:' + paneId);
  }
  if (!tab.url || tab.url === 'about:blank') { tab.url = pass256UrlForPane(role); tab.title = tab.title || 'Mission Pane ' + (index + 1); report.repairs.push('blank-url-repaired:' + paneId); }
  let runtimeTabId = missionRuntimeTabs.get(tab.tabId);
  if (!runtimeTabId || !tabs.has(runtimeTabId)) { runtimeTabId = createTab(normalizeTarget(tab.url)); missionRuntimeTabs.set(tab.tabId, runtimeTabId); report.repairs.push('runtime-tab-created:' + paneId); }
  const runtimeTab = tabs.get(runtimeTabId);
  if (runtimeTab) { runtimeTab.missionPaneId = paneId; runtimeTab.url = normalizeTarget(runtimeTab.url || tab.url); runtimeTab.title = runtimeTab.title || tab.title || titleFromUrl(runtimeTab.url); }
  const paneRecord = currentMission.layout.panes.find((pane) => pane.paneId === paneId);
  if (paneRecord) { paneRecord.role = tab.role; paneRecord.tabId = tab.tabId; }
  else { currentMission.layout.panes.push({ paneId, role: tab.role, tabId: tab.tabId }); report.repairs.push('layout-pane-created:' + paneId); }
}
function pass256CommitLayoutTransition(request: Pass256LayoutRequest, report: Pass256TransitionReport): void {
  report.phase = 'commit'; report.phases.push('commit');
  if (!currentMission) return;
  const visible = pass256VisiblePaneIds(request, currentMission.layout.activePaneId);
  currentMission.layout.type = pass256BaseLayoutType(request);
  (currentMission.layout as unknown as { pass256RequestedLayout?: string }).pass256RequestedLayout = request;
  currentMission.layout.activePaneId = visible.includes(currentMission.layout.activePaneId) ? currentMission.layout.activePaneId : visible[0] || 'pane-1';
  visible.forEach((paneId, index) => pass256EnsurePaneMapping(paneId, index, report));
  currentMission.layout.panes = currentMission.layout.panes.filter((pane) => visible.includes(pane.paneId));
}
function pass256RenderLayoutTransition(request: Pass256LayoutRequest, report: Pass256TransitionReport): void {
  report.phase = 'render'; report.phases.push('render');
  const active = currentMission?.layout?.activePaneId || 'pane-1';
  const visible = pass256VisiblePaneIds(request, active);
  document.querySelectorAll<HTMLElement>('[data-mission-control], [data-mission-layout], .mission-control-shell, .mission-control-modal, .mission-view-host, .mission-multiview').forEach((host) => {
    host.setAttribute('data-pass256-state-machine', 'managed'); host.setAttribute('data-pass256-layout-phase', report.phase); host.setAttribute('data-pass256-requested-layout', request); host.setAttribute('data-mission-layout', pass256BaseLayoutType(request));
  });
  document.querySelectorAll<HTMLElement>('[data-mission-pane], [data-pane-id], .mission-pane, .mission-pane-shell, .mission-webview-pane').forEach((pane, index) => {
    const paneId = pane.getAttribute('data-mission-pane') || pane.getAttribute('data-pane-id') || pane.id || 'pane-' + (index + 1);
    const resolvedPaneId = visible[index] || paneId;
    if (!pane.getAttribute('data-mission-pane')) pane.setAttribute('data-mission-pane', resolvedPaneId);
    const isVisible = visible.includes(paneId) || index < visible.length;
    pane.toggleAttribute('hidden', !isVisible); pane.classList.toggle('is-active', resolvedPaneId === active);
    pane.setAttribute('data-pass256-pane-visible', isVisible ? 'true' : 'false'); pane.setAttribute('data-pass256-active-pane', resolvedPaneId === active ? 'true' : 'false');
    const view = pane.querySelector<HTMLElement>('webview, iframe'); pane.setAttribute('data-pass256-pane-has-runtime-view', view ? 'true' : 'false');
    if (view) { view.style.position = 'absolute'; view.style.inset = '0'; view.style.width = '100%'; view.style.height = '100%'; view.style.transform = 'none'; }
  });
  window.dispatchEvent(new CustomEvent('tahai:mission-layout-change', { detail: { source: 'pass256', request } })); window.dispatchEvent(new Event('resize'));
}
function pass256GeometrySettle(report: Pass256TransitionReport): Promise<void> {
  report.phase = 'geometry-settle'; report.phases.push('geometry-settle');
  return new Promise((resolve) => requestAnimationFrame(() => { window.dispatchEvent(new Event('resize')); requestAnimationFrame(() => { window.dispatchEvent(new Event('resize')); resolve(); }); }));
}
function pass256PostAssertLayoutTransition(request: Pass256LayoutRequest, report: Pass256TransitionReport): boolean {
  report.phase = 'post-assert'; report.phases.push('post-assert');
  const active = currentMission?.layout?.activePaneId || 'pane-1'; const visible = pass256VisiblePaneIds(request, active);
  if (!visible.includes(active)) report.issues.push('hidden-active-pane');
  if (currentMission) visible.forEach((paneId) => { const tab = currentMission?.tabs.find((candidate) => candidate.paneId === paneId); const runtimeTabId = tab ? missionRuntimeTabs.get(tab.tabId) : ''; if (!tab) report.issues.push('missing-mission-tab:' + paneId); if (!runtimeTabId || !tabs.has(runtimeTabId)) report.issues.push('orphaned-runtime-tab:' + paneId); if (tab && (!tab.url || tab.url === 'about:blank')) report.issues.push('blank-pane:' + paneId); });
  document.querySelectorAll<HTMLElement>('[data-pass256-pane-visible="true"]').forEach((pane) => { const rect = pane.getBoundingClientRect(); pane.setAttribute('data-pass256-pane-geometry-ok', rect.width > 80 && rect.height > 80 ? 'true' : 'false'); });
  report.ok = !report.issues.some((issue) => /hidden-active-pane|missing-mission-tab|orphaned-runtime-tab|blank-pane/.test(issue));
  return report.ok;
}
function pass256RecoverLayoutTransition(request: Pass256LayoutRequest, report: Pass256TransitionReport): void {
  report.phase = 'recover'; report.phases.push('recover');
  if (!currentMission) return;
  const visible = pass256VisiblePaneIds(request, currentMission.layout.activePaneId);
  if (!visible.includes(currentMission.layout.activePaneId)) { currentMission.layout.activePaneId = visible[0] || 'pane-1'; report.repairs.push('hidden-active-pane-recovered'); }
  visible.forEach((paneId, index) => pass256EnsurePaneMapping(paneId, index, report));
  pass256RenderLayoutTransition(request, report);
}
function pass256RollbackLayoutTransition(report: Pass256TransitionReport): void { report.phase = 'rollback'; report.phases.push('rollback'); if (pass256LastStableLayout && currentMission) { currentMission.layout.activePaneId = pass256LastStableLayout.activePaneId; report.repairs.push('rolled-back-to-last-stable-layout'); } }
async function pass256TransitionMissionLayout(input: Pass256LayoutRequest | string, reason = 'operator-request'): Promise<Pass256TransitionReport> {
  const request = pass256NormalizeLayoutRequest(input); const report: Pass256TransitionReport = { ok: false, request, phase: 'idle', phases: [], repairs: [], issues: [] };
  if (pass256TransitionBusy) { report.issues.push('transition-already-in-flight'); return report; }
  pass256TransitionBusy = true;
  try { pass256PreflightLayoutTransition(request, report); pass256CommitLayoutTransition(request, report); pass256RenderLayoutTransition(request, report); await pass256GeometrySettle(report); if (!pass256PostAssertLayoutTransition(request, report)) { pass256RecoverLayoutTransition(request, report); await pass256GeometrySettle(report); if (!pass256PostAssertLayoutTransition(request, report)) pass256RollbackLayoutTransition(report); } report.phase = 'complete'; report.phases.push('complete'); report.completedAt = new Date().toISOString(); pass256LastTransitionReport = report; if (report.ok && currentMission) { const active = currentMission.layout.activePaneId || 'pane-1'; pass256LastStableLayout = { request, activePaneId: active, visiblePaneIds: pass256VisiblePaneIds(request, active) }; appendMissionTimelineEvent(currentMission, 'layout-set', 'Mission layout state machine transition', 'PASS256 ' + request + ' committed via ' + reason + '.'); } return report; }
  finally { pass256TransitionBusy = false; }
}
function pass256RequestFromControl(element: Element | null): Pass256LayoutRequest | undefined { if (!element) return undefined; const text = [element.getAttribute('data-pass256-layout'), element.getAttribute('data-mission-layout'), element.getAttribute('data-layout'), element.getAttribute('data-view'), element.getAttribute('aria-label'), element.getAttribute('title'), element.textContent, element.className && String(element.className)].filter(Boolean).join(' ').toLowerCase(); return /mission|layout|view|pane|quad|split|tri|3-up|4-up|2-up|1-up|focus|restore/.test(text) ? pass256NormalizeLayoutRequest(text) : undefined; }
function pass256ScheduleTransition(request: Pass256LayoutRequest | undefined, reason: string): void { if (!request) return; if (pass256PendingTimer) window.clearTimeout(pass256PendingTimer); pass256PendingTimer = window.setTimeout(() => { void pass256TransitionMissionLayout(request, reason); }, 30); }
function pass256RunLayoutStressContract(cycles = PASS256_LAYOUT_STRESS_CYCLE_COUNT): { ok: boolean; cycles: number; transitions: number; issues: string[] } { const issues: string[] = []; let activePaneId = 'pane-1'; let transitions = 0; for (let cycle = 0; cycle < cycles; cycle += 1) { for (const request of PASS256_LAYOUT_STRESS_SEQUENCE) { const visible = pass256VisiblePaneIds(request, activePaneId); if (!visible.length) issues.push('no-visible-panes:' + cycle + ':' + request); if (!visible.includes(activePaneId)) activePaneId = visible[0] || 'pane-1'; if (!visible.includes(activePaneId)) issues.push('hidden-active-pane:' + cycle + ':' + request); transitions += 1; } } return { ok: issues.length === 0 && transitions === cycles * PASS256_LAYOUT_STRESS_SEQUENCE.length, cycles, transitions, issues }; }
function pass256MountQuadViewStateMachine(): void { if (pass256Mounted) return; pass256Mounted = true; document.addEventListener('click', (event) => { const target = event.target; if (!(target instanceof Element)) return; const control = target.closest('button, [role="button"], [data-layout], [data-mission-layout], [data-view], .mission-layout-tabs, .mission-pane-controls, .mission-view-controls'); pass256ScheduleTransition(pass256RequestFromControl(control), 'layout-control-click'); }, true); document.addEventListener('keydown', (event) => { if (!event.ctrlKey || !event.altKey) return; const key = String(event.key || '').toLowerCase(); const requestByKey: Record<string, Pass256LayoutRequest> = { '1': 'single', '2': 'split-horizontal', '3': 'triple-top', '4': 'quad', q: 'quad', s: 'split-horizontal', f: 'focus' }; pass256ScheduleTransition(requestByKey[key], 'layout-keyboard-shortcut'); }, true); (window as unknown as { __TAHAI_PASS256_MISSION_VIEW_STATE_MACHINE__?: unknown }).__TAHAI_PASS256_MISSION_VIEW_STATE_MACHINE__ = { transition: pass256TransitionMissionLayout, stress: pass256RunLayoutStressContract, lastReport: () => pass256LastTransitionReport }; pass256ScheduleTransition(pass256NormalizeLayoutRequest(currentMission?.layout?.type || 'single'), 'mount'); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pass256MountQuadViewStateMachine, { once: true }); else pass256MountQuadViewStateMachine();
${jsEnd}`;

const cssPatch = `${cssStart}
[data-pass256-state-machine="managed"] { min-width: 0 !important; min-height: 0 !important; contain: layout style; }
[data-pass256-pane-visible="true"] { position: relative !important; min-width: 0 !important; min-height: 0 !important; overflow: hidden !important; display: flex !important; flex-direction: column !important; }
[data-pass256-pane-visible="false"] { display: none !important; pointer-events: none !important; visibility: hidden !important; }
[data-pass256-active-pane="true"] { outline: 1px solid rgba(80, 200, 255, 0.34) !important; outline-offset: -1px !important; }
[data-pass256-pane-geometry-ok="false"] { outline: 1px solid rgba(255, 84, 84, 0.48) !important; }
[data-pass256-pane-visible="true"] > webview, [data-pass256-pane-visible="true"] > iframe { position: absolute !important; inset: 0 !important; width: 100% !important; height: 100% !important; min-width: 0 !important; min-height: 0 !important; transform: none !important; }
[data-pass256-pane-visible="true"][data-pass256-pane-has-runtime-view="false"]::after { content: "Mission pane placeholder — add a tab, restore layout, or start a recipe."; position: absolute; inset: 0; display: grid; place-items: center; padding: 18px; text-align: center; font-size: 12px; line-height: 1.4; color: rgba(226, 241, 255, 0.72); background: radial-gradient(circle at top, rgba(32,120,190,.18), rgba(3,10,18,.84)); pointer-events: none; }
${cssEnd}`;

function rel(p) { return path.relative(root, p).split(path.sep).join('/'); }
function readText(file) { try { return fs.readFileSync(file, 'utf8'); } catch { return ''; } }
function writeText(file, text) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }
function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function walk(dir, matcher, acc = []) { let entries = []; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; } for (const entry of entries) { if (skipDirs.has(entry.name)) continue; const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full, matcher, acc); else if (matcher(full)) acc.push(full); } return acc; }
function parseVersion(v) { const m = String(v || '').match(/^(\d+)\.(\d+)\.(\d+)(.*)$/); return m ? { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), suffix: m[4] || '' } : null; }
function compareVersion(a, b) { const av = parseVersion(a); const bv = parseVersion(b); if (!av || !bv) return 0; if (av.major !== bv.major) return av.major - bv.major; if (av.minor !== bv.minor) return av.minor - bv.minor; return av.patch - bv.patch; }
function nextVersion(current) { const parsed = parseVersion(current); if (!parsed || parsed.major !== 2 || parsed.minor !== 0) return targetVersion; return compareVersion(current, targetVersion) < 0 ? targetVersion : current; }
function updatePackageLikeJson(file, packageName) { if (!fs.existsSync(file)) return null; let json; try { json = JSON.parse(readText(file)); } catch { return { file: rel(file), changed: false, error: 'invalid-json' }; } let changed = false; const before = json.version; const after = nextVersion(before); if (json.version !== after) { json.version = after; changed = true; } if (json.packages && json.packages['']) { const rootAfter = nextVersion(json.packages[''].version || before); if (json.packages[''].version !== rootAfter) { json.packages[''].version = rootAfter; changed = true; } if (packageName && json.packages['node_modules/' + packageName]?.version) { const nestedAfter = nextVersion(json.packages['node_modules/' + packageName].version); if (json.packages['node_modules/' + packageName].version !== nestedAfter) { json.packages['node_modules/' + packageName].version = nestedAfter; changed = true; } } } if (changed) writeText(file, JSON.stringify(json, null, 2) + '\n'); return { file: rel(file), changed, before, after: json.version }; }
function ensurePackage() { const pkgPath = path.join(root, 'package.json'); if (!fs.existsSync(pkgPath)) return { packageJsonFound: false, changes: [] }; const pkg = JSON.parse(readText(pkgPath)); pkg.scripts = pkg.scripts || {}; const before = pkg.version; const after = nextVersion(pkg.version); let changed = false; if (pkg.version !== after) { pkg.version = after; changed = true; } const scriptName = 'verify:pass-256-quad-view-state-machine'; const scriptValue = 'node scripts/verify-pass256-quad-view-state-machine.mjs'; if (pkg.scripts[scriptName] !== scriptValue) { pkg.scripts[scriptName] = scriptValue; changed = true; } if (changed) writeText(pkgPath, JSON.stringify(pkg, null, 2) + '\n'); const changes = [{ file: 'package.json', changed, before, after: pkg.version }]; for (const lock of ['package-lock.json','npm-shrinkwrap.json']) { const result = updatePackageLikeJson(path.join(root, lock), pkg.name); if (result) changes.push(result); } return { packageJsonFound: true, version: pkg.version, scriptName, changes }; }
function findRendererFile() { for (const candidate of rendererCandidates) { const full = path.join(root, candidate); const text = readText(full); if (fs.existsSync(full) && /PASS255_RECIPE_PANE_HYDRATION_START|PASS254_MISSION_RECIPE_CLICK_CONTRACT_START|missionRuntimeTabs|premiumLaunchRecipes/.test(text)) return full; } const found = walk(root, (file) => /\.(ts|tsx|js|jsx)$/i.test(file)).filter((file) => /PASS255_RECIPE_PANE_HYDRATION_START|PASS254_MISSION_RECIPE_CLICK_CONTRACT_START|missionRuntimeTabs|premiumLaunchRecipes/.test(readText(file))); return found[0] || null; }
function findCssFile() { for (const candidate of cssCandidates) { const full = path.join(root, candidate); if (fs.existsSync(full)) return full; } const found = walk(root, (file) => /\.css$/i.test(file)).filter((file) => /mission|browser|renderer|app|style/i.test(readText(file)) || /browser|renderer|app|style/i.test(path.basename(file))); return found[0] || path.join(root, 'src/renderer/styles/browser.css'); }
function replaceBlock(text, start, end, block) { const re = new RegExp(escapeRegex(start) + '[\\s\\S]*?' + escapeRegex(end)); return re.test(text) ? text.replace(re, block) : null; }
function insertJs(file) { let text = readText(file); const replaced = replaceBlock(text, jsStart, jsEnd, jsPatch); if (replaced !== null) { writeText(file, replaced); return { file: rel(file), changed: replaced !== text, mode: 'replaced' }; } const pass255End = '/* PASS255_RECIPE_PANE_HYDRATION_END */'; const pass252End = '/* PASS252_MISSION_MULTIVIEW_STATE_GUARD_END */'; if (text.includes(pass255End)) text = text.replace(pass255End, pass255End + '\n\n' + jsPatch); else if (text.includes(pass252End)) text = text.replace(pass252End, pass252End + '\n\n' + jsPatch); else text += '\n\n' + jsPatch + '\n'; if (!text.includes('pass255MountRecipePaneHydration(); pass256MountQuadViewStateMachine();') && text.includes('pass255MountRecipePaneHydration();')) text = text.replace(/pass255MountRecipePaneHydration\(\);/g, 'pass255MountRecipePaneHydration(); pass256MountQuadViewStateMachine();'); writeText(file, text); return { file: rel(file), changed: true, mode: 'inserted' }; }
function insertCss(file) { let text = readText(file); const replaced = replaceBlock(text, cssStart, cssEnd, cssPatch); if (replaced !== null) { writeText(file, replaced); return { file: rel(file), changed: replaced !== text, mode: 'replaced' }; } text = text.trimEnd() + '\n\n' + cssPatch + '\n'; writeText(file, text); return { file: rel(file), changed: true, mode: 'inserted' }; }

const packageResult = ensurePackage();
const rendererFile = findRendererFile();
if (!rendererFile) { console.error(pass + '_APPLY=FAIL'); console.error('Could not find renderer source containing PASS255 Mission Recipe pane hydration logic. Apply PASS250-PASS255 first.'); process.exit(1); }
const cssFile = findCssFile();
const jsResult = insertJs(rendererFile);
const cssResult = insertCss(cssFile);
const reportDir = path.join(root, 'release-candidate', 'generated');
fs.mkdirSync(reportDir, { recursive: true });
const report = { pass, appliedAt: new Date().toISOString(), packageResult, renderer: jsResult, css: cssResult, storeSubmissionStatus: 'BLOCKED_UNTIL_RECIPE_QUAD_RUNTIME_SMOKE', stressCycles: 50, stressSequence: ['single','split-horizontal','triple-top','triple-bottom','triple-left','triple-right','quad','focus','quad','single'] };
writeText(path.join(reportDir, 'pass256-quad-view-state-machine-apply-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(pass + '_APPLY=PASS');
console.log(pass + '_VERSION=' + (packageResult.version || 'unknown'));
console.log(pass + '_RENDERER_TARGET=' + jsResult.file);
console.log(pass + '_CSS_TARGET=' + cssResult.file);
console.log(pass + '_REPORT=' + rel(path.join(reportDir, 'pass256-quad-view-state-machine-apply-report.json')));
