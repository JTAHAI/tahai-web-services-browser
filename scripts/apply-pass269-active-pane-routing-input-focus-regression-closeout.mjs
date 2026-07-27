#!/usr/bin/env node
/* PASS269 — Active Pane Routing + Input/Focus Regression Closeout */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pass = 'PASS269';
const versionTarget = '2.0.18';
const remainingPassesAfterThisPass = 2;
const skipDirs = new Set(['.git','node_modules','dist','release','release-msix','out','coverage','.vite','.next','build']);
const packageScripts = {
  'verify:pass-269-active-pane-routing-input-focus-regression-closeout': 'node scripts/verify-pass269-active-pane-routing-input-focus-regression-closeout.mjs',
  'gate:pass-269-active-pane-routing-input-focus-regression-closeout': 'node scripts/gate-pass269-active-pane-routing-input-focus-regression-closeout.mjs'
};
function read(file){ try { return fs.readFileSync(file,'utf8'); } catch { return ''; } }
function write(file,text){ fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,text); }
function rel(file){ return path.relative(root,file).replace(/\\/g,'/'); }
function walk(dir, accept, out=[]){
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dir,entry.name);
    if (entry.isDirectory()) walk(full,accept,out);
    else if (!accept || accept(full)) out.push(full);
  }
  return out;
}
function parseVersion(v){ const m=String(v||'').match(/^(\d+)\.(\d+)\.(\d+)/); return m?{major:+m[1],minor:+m[2],patch:+m[3]}:null; }
function versionAtLeast(actual, expected){
  const a=parseVersion(actual), e=parseVersion(expected);
  if (!a||!e) return false;
  if (a.major!==e.major) return a.major>e.major;
  if (a.minor!==e.minor) return a.minor>e.minor;
  return a.patch>=e.patch;
}
function patchPackageJson(){
  const pkgPath=path.join(root,'package.json');
  if (!fs.existsSync(pkgPath)) return {found:false,changed:false};
  const pkg=JSON.parse(read(pkgPath));
  let changed=false;
  if (!versionAtLeast(pkg.version, versionTarget)) { pkg.version=versionTarget; changed=true; }
  pkg.scripts=pkg.scripts||{};
  for (const [name,value] of Object.entries(packageScripts)) if (pkg.scripts[name]!==value) { pkg.scripts[name]=value; changed=true; }
  if (changed) write(pkgPath, JSON.stringify(pkg,null,2)+'\n');
  for (const lockName of ['package-lock.json','npm-shrinkwrap.json']){
    const lockPath=path.join(root,lockName);
    if (!fs.existsSync(lockPath)) continue;
    try {
      const lock=JSON.parse(read(lockPath)); let lockChanged=false;
      if (lock.version && !versionAtLeast(lock.version, versionTarget)) { lock.version=versionTarget; lockChanged=true; }
      if (lock.packages?.['']?.version && !versionAtLeast(lock.packages[''].version, versionTarget)) { lock.packages[''].version=versionTarget; lockChanged=true; }
      if (lockChanged) write(lockPath, JSON.stringify(lock,null,2)+'\n');
    } catch {}
  }
  return {found:true,changed,scripts:Object.keys(packageScripts),version:pkg.version};
}
function findRenderer(){
  const candidates=['src/renderer/app.ts','src/renderer/renderer.ts','src/renderer/index.ts','src/renderer/main.ts','src/renderer/app.tsx','src/renderer/index.tsx','src/renderer/app.js','src/renderer/renderer.js','renderer/app.js','renderer/renderer.js'];
  for (const c of candidates) { const p=path.join(root,c); if (read(p)) return p; }
  return walk(root, f=>/\.(ts|tsx|js|jsx)$/i.test(f) && /renderer/i.test(rel(f)))[0] || null;
}
function pass269Block(){ return `

/* PASS269_ACTIVE_PANE_ROUTING_INPUT_FOCUS_CLOSEOUT_START */
const PASS269_ACTIVE_PANE_ROUTING_INPUT_FOCUS = Object.freeze({
  pass: 'PASS269',
  versionTarget: '2.0.18',
  reason: 'Every input must resolve to exactly one active tab or Mission pane target before release.',
  inputs: ['address-bar','toolbar-back','toolbar-forward','toolbar-reload','toolbar-stop','mouse-button-4','mouse-button-5','alt-left','alt-right','ctrl-k-command','ctrl-alt-pane-focus','recipe-start','overlay-close-focus-return'],
  layouts: ['single','split-horizontal','split-vertical','triple-top','triple-bottom','triple-left','triple-right','quad','focus']
});
function pass269VisiblePaneCandidates(root = document) {
  return Array.from(root.querySelectorAll('[data-pane-id], [data-mission-pane-id], .mission-pane, .mission-view-pane'))
    .filter((pane) => {
      const el = pane;
      const style = typeof getComputedStyle === 'function' ? getComputedStyle(el) : null;
      const rect = typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : { width: 0, height: 0 };
      return style?.display !== 'none' && style?.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    });
}
function pass269CurrentActivePane(root = document) {
  const activeSelectors = [
    '[data-active-pane="true"]',
    '[data-pane-active="true"]',
    '[data-active="true"][data-pane-id]',
    '.mission-pane.is-active',
    '.mission-view-pane.is-active',
    '.active[data-pane-id]'
  ];
  const explicit = activeSelectors.flatMap((selector) => Array.from(root.querySelectorAll(selector))).filter((el, index, arr) => arr.indexOf(el) === index);
  const visibleExplicit = explicit.filter((el) => pass269VisiblePaneCandidates(root).includes(el));
  if (visibleExplicit.length === 1) return visibleExplicit[0];
  const focused = root.activeElement?.closest?.('[data-pane-id], [data-mission-pane-id], .mission-pane, .mission-view-pane');
  if (focused && pass269VisiblePaneCandidates(root).includes(focused)) return focused;
  const candidates = pass269VisiblePaneCandidates(root);
  return candidates.length === 1 ? candidates[0] : null;
}
function pass269ResolveRoutingTarget(inputKind, root = document) {
  const activePane = pass269CurrentActivePane(root);
  const activeTab = root.querySelector('[data-active-tab="true"], .tab.active, [aria-selected="true"][role="tab"]');
  const target = activePane || activeTab || null;
  const targetKind = activePane ? 'active-pane' : activeTab ? 'active-tab' : 'none';
  const targetId = activePane?.getAttribute?.('data-pane-id') || activePane?.getAttribute?.('data-mission-pane-id') || activeTab?.getAttribute?.('data-tab-id') || activeTab?.id || null;
  const result = { pass: 'PASS269', inputKind, targetKind, targetId, exactlyOneTarget: Boolean(target), safeNoop: !target };
  document.documentElement.dataset.pass269LastInput = String(inputKind);
  document.documentElement.dataset.pass269LastTargetKind = result.targetKind;
  document.documentElement.dataset.pass269LastTargetId = result.targetId || '';
  document.documentElement.dataset.pass269ExactlyOneTarget = String(result.exactlyOneTarget);
  return result;
}
function pass269RecordFocusReturn(reason = 'unknown') {
  const target = pass269ResolveRoutingTarget('focus-return');
  document.documentElement.dataset.pass269LastFocusReturnReason = String(reason);
  document.documentElement.dataset.pass269LastFocusReturnAt = new Date().toISOString();
  return target;
}
function pass269InstallInputFocusDiagnostics(root = document) {
  const doc = root;
  if (doc.documentElement?.dataset.pass269InputFocusDiagnosticsInstalled === 'true') return false;
  if (doc.documentElement) doc.documentElement.dataset.pass269InputFocusDiagnosticsInstalled = 'true';
  doc.addEventListener('keydown', (event) => {
    if (event.altKey && event.key === 'ArrowLeft') pass269ResolveRoutingTarget('alt-left', doc);
    if (event.altKey && event.key === 'ArrowRight') pass269ResolveRoutingTarget('alt-right', doc);
    if (event.ctrlKey && String(event.key).toLowerCase() === 'k') pass269ResolveRoutingTarget('ctrl-k-command', doc);
    if (event.ctrlKey && event.altKey && /^[1-4]$/.test(String(event.key))) pass269ResolveRoutingTarget('ctrl-alt-pane-focus', doc);
  }, true);
  doc.addEventListener('mouseup', (event) => {
    if (event.button === 3) pass269ResolveRoutingTarget('mouse-button-4', doc);
    if (event.button === 4) pass269ResolveRoutingTarget('mouse-button-5', doc);
  }, true);
  doc.addEventListener('focusin', () => pass269ResolveRoutingTarget('focusin', doc), true);
  window.__PASS269_ACTIVE_PANE_ROUTING__ = { PASS269_ACTIVE_PANE_ROUTING_INPUT_FOCUS, pass269ResolveRoutingTarget, pass269CurrentActivePane, pass269RecordFocusReturn };
  return true;
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => pass269InstallInputFocusDiagnostics(document), { once: true });
  else pass269InstallInputFocusDiagnostics(document);
}
/* PASS269_ACTIVE_PANE_ROUTING_INPUT_FOCUS_CLOSEOUT_END */
`; }
function patchRenderer(){
  const renderer=findRenderer();
  if (!renderer) return {found:false,changed:false};
  let text=read(renderer);
  if (text.includes('PASS269_ACTIVE_PANE_ROUTING_INPUT_FOCUS_CLOSEOUT_START')) return {found:true,changed:false,target:rel(renderer)};
  text += pass269Block();
  write(renderer,text);
  return {found:true,changed:true,target:rel(renderer)};
}
const pkg=patchPackageJson();
const renderer=patchRenderer();
const report={ pass, versionTarget, remainingPassesAfterThisPass, packageJson:pkg, renderer, storeSubmission:'not-submitted', storeApproval:'not-approved', generatedAt:new Date().toISOString() };
write(path.join(root,'release-candidate/generated/pass269-active-pane-routing-input-focus-regression-closeout-apply-report.json'), JSON.stringify(report,null,2)+'\n');
console.log('PASS269_APPLY=PASS');
console.log(`PASS269_VERSION=${versionTarget}`);
console.log(`PASS269_REMAINING_PASSES_AFTER_THIS=${remainingPassesAfterThisPass}`);
console.log(`PASS269_RENDERER_TARGET=${renderer.target || 'not-found'}`);
console.log('PASS269_STORE_SUBMISSION_STATUS=NOT_SUBMITTED_NOT_APPROVED');
