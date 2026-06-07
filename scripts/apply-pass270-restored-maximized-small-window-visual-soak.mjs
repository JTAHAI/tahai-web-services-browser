#!/usr/bin/env node
/* PASS270 — Restored/Maximized/Small-Window Visual Soak */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pass = 'PASS270';
const versionTarget = '2.0.14';
const remainingPassesAfterThisPass = 1;
const skipDirs = new Set(['.git','node_modules','dist','release','release-msix','out','coverage','.vite','.next','build']);
const packageScripts = {
  'verify:pass-270-restored-maximized-small-window-visual-soak': 'node scripts/verify-pass270-restored-maximized-small-window-visual-soak.mjs',
  'gate:pass-270-restored-maximized-small-window-visual-soak': 'node scripts/gate-pass270-restored-maximized-small-window-visual-soak.mjs'
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
function findCss(){
  const candidates=['src/renderer/styles.css','src/renderer/app.css','src/renderer/style.css','src/renderer/index.css','src/styles.css','renderer/styles.css','renderer/app.css'];
  for (const c of candidates) { const p=path.join(root,c); if (read(p)) return p; }
  const all=walk(root, f=>/\.(css|scss)$/i.test(f));
  return all.find(f=>/renderer|src/i.test(rel(f))) || all[0] || path.join(root,'src/renderer/pass270-visual-soak.css');
}
function pass270RendererBlock(){ return `

/* PASS270_RESTORED_MAXIMIZED_SMALL_WINDOW_VISUAL_SOAK_START */
const PASS270_VISUAL_SOAK = Object.freeze({
  pass: 'PASS270',
  versionTarget: '2.0.14',
  reason: 'Release-confidence visual soak for restored, maximized, small laptop, 1080p, and wide windows.',
  profiles: ['restored-compact-1280x720','small-laptop-1366x768','1080p-1920x1080','wide-2560x1440','maximized-available-screen'],
  surfaces: ['mission-control','mission-recipes','mission-cards','split-view','tri-view','quad-view','focus-pane','webview-panes','runbook-rail','evidence-pack','command-center','more-tools','devops-tools','it-tools','settings','kb-guide'],
  minimumWebsiteBudgetPx: 360
});
function pass270UniqueElements(selectors, root = document) {
  const out = [];
  for (const selector of selectors) {
    try {
      for (const el of Array.from(root.querySelectorAll(selector))) if (!out.includes(el)) out.push(el);
    } catch {}
  }
  return out;
}
function pass270Visible(el) {
  if (!el || typeof el.getBoundingClientRect !== 'function') return false;
  const style = typeof getComputedStyle === 'function' ? getComputedStyle(el) : null;
  const rect = el.getBoundingClientRect();
  return style?.display !== 'none' && style?.visibility !== 'hidden' && Number(style?.opacity ?? '1') !== 0 && rect.width > 0 && rect.height > 0;
}
function pass270Rect(el) {
  const r = el.getBoundingClientRect();
  return { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom), width: Math.round(r.width), height: Math.round(r.height) };
}
function pass270RectsOverlap(a, b, tolerance = 2) {
  return a.left < b.right - tolerance && a.right > b.left + tolerance && a.top < b.bottom - tolerance && a.bottom > b.top + tolerance;
}
function pass270FindOverlaps(elements) {
  const visible = elements.filter(pass270Visible);
  const overlaps = [];
  for (let i = 0; i < visible.length; i += 1) {
    for (let j = i + 1; j < visible.length; j += 1) {
      const a = pass270Rect(visible[i]);
      const b = pass270Rect(visible[j]);
      if (pass270RectsOverlap(a, b)) overlaps.push({ a: visible[i].id || visible[i].className || visible[i].tagName, b: visible[j].id || visible[j].className || visible[j].tagName, aRect: a, bRect: b });
    }
  }
  return overlaps;
}
function pass270CheckScrollableCards(cards) {
  const failures = [];
  for (const card of cards.filter(pass270Visible)) {
    const style = typeof getComputedStyle === 'function' ? getComputedStyle(card) : null;
    const clipped = card.scrollHeight > card.clientHeight + 2 && !['auto','scroll','overlay'].includes(String(style?.overflowY || '').toLowerCase());
    const tooShort = card.getBoundingClientRect().height < 64;
    if (clipped || tooShort) failures.push({ id: card.id || card.className || card.tagName, clipped, tooShort, clientHeight: card.clientHeight, scrollHeight: card.scrollHeight, overflowY: style?.overflowY || '' });
  }
  return failures;
}
function pass270CheckClippedButtons(buttons) {
  const failures = [];
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  for (const button of buttons.filter(pass270Visible)) {
    const r = pass270Rect(button);
    if (r.width < 24 || r.height < 20 || r.left < 0 || r.top < 0 || r.right > viewportWidth + 1 || r.bottom > viewportHeight + 1) failures.push({ id: button.id || button.textContent?.trim()?.slice(0,48) || button.className || button.tagName, rect: r });
  }
  return failures;
}
function pass270WebsiteBudget(root = document) {
  const selectors = ['[data-website-pane]','[data-content-pane]','[data-browser-content]','[data-webview-stage]','[data-mission-stage]','.browser-content','.content-pane','.webview-stage','.mission-stage','main'];
  const candidates = pass270UniqueElements(selectors, root).filter(pass270Visible).map((el) => ({ el, rect: pass270Rect(el) })).sort((a,b) => b.rect.height - a.rect.height);
  const best = candidates[0];
  const budgetPx = best?.rect.height || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const ratio = viewportHeight ? budgetPx / viewportHeight : 0;
  return { budgetPx, ratio: Number(ratio.toFixed(3)), selectorFound: Boolean(best), rect: best?.rect || null, ok: budgetPx >= PASS270_VISUAL_SOAK.minimumWebsiteBudgetPx && ratio >= 0.32 };
}
function pass270CheckWebviews(root = document) {
  const panes = pass270UniqueElements(['[data-pane-id]','[data-mission-pane-id]','.mission-pane','.mission-view-pane','.pane'], root).filter(pass270Visible);
  const webviews = pass270UniqueElements(['webview','[data-webview]','iframe[data-webview]','.webview'], root).filter(pass270Visible);
  const paneFailures = [];
  for (const pane of panes) {
    const paneRect = pass270Rect(pane);
    const webview = pane.querySelector?.('webview,[data-webview],iframe[data-webview],.webview');
    if (!webview || !pass270Visible(webview)) {
      const placeholder = pane.querySelector?.('[data-empty-pane-placeholder],.empty-pane,.pane-placeholder,[data-local-placeholder]');
      if (!placeholder || !pass270Visible(placeholder)) paneFailures.push({ pane: pane.id || pane.getAttribute?.('data-pane-id') || pane.className || pane.tagName, reason: 'no-visible-webview-or-placeholder', paneRect });
      continue;
    }
    const wr = pass270Rect(webview);
    const bottomOnly = wr.top > paneRect.top + Math.max(80, paneRect.height * 0.25);
    const sliver = wr.height < Math.max(180, paneRect.height * 0.45);
    if (bottomOnly || sliver || wr.width < Math.max(240, paneRect.width * 0.5)) paneFailures.push({ pane: pane.id || pane.getAttribute?.('data-pane-id') || pane.className || pane.tagName, reason: 'bad-webview-geometry', paneRect, webviewRect: wr, bottomOnly, sliver });
  }
  return { paneFailures, visiblePaneCount: panes.length, visibleWebviewCount: webviews.length };
}
function pass270ActivePaneHealth(root = document) {
  const active = pass270UniqueElements(['[data-active-pane="true"]','[data-pane-active="true"]','[data-active="true"][data-pane-id]','.mission-pane.is-active','.mission-view-pane.is-active','.active[data-pane-id]'], root).filter(pass270Visible);
  const panes = pass270UniqueElements(['[data-pane-id]','[data-mission-pane-id]','.mission-pane','.mission-view-pane'], root).filter(pass270Visible);
  const ok = panes.length === 0 || active.length === 1 || panes.length === 1;
  return { ok, visiblePaneCount: panes.length, activePaneCount: active.length, activePaneId: active[0]?.getAttribute?.('data-pane-id') || active[0]?.getAttribute?.('data-mission-pane-id') || active[0]?.id || null };
}
function pass270RunVisualSoak(root = document) {
  const missionCards = pass270UniqueElements(['[data-mission-card]','[data-recipe-card]','.mission-card','.recipe-card','.mission-recipe-card'], root);
  const recipeButtons = pass270UniqueElements(['[data-recipe-action]','[data-start-recipe]','.recipe-card button','.mission-recipe-card button','button[data-action*="recipe"]'], root);
  const cards = pass270UniqueElements(['[data-mission-card]','[data-recipe-card]','[data-tool-card]','.mission-card','.recipe-card','.tool-card','.card'], root);
  const overlays = pass270UniqueElements(['[data-overlay-open="true"]','[data-overlay]','.overlay.open','.modal.open','.drawer.open','.command-center.open','.more-tools.open','.settings-panel.open','.kb-panel.open'], root).filter(pass270Visible);
  const clippedSurfaces = pass270UniqueElements(['[data-command-center]','[data-more-tools]','[data-mission-panel]','[data-settings-panel]','[data-kb-panel]','.command-center','.more-tools','.mission-panel','.settings-panel','.kb-panel'], root);
  const websiteBudget = pass270WebsiteBudget(root);
  const webviewHealth = pass270CheckWebviews(root);
  const activePane = pass270ActivePaneHealth(root);
  const report = {
    pass: 'PASS270',
    versionTarget: '2.0.14',
    viewport: { width: window.innerWidth || 0, height: window.innerHeight || 0, screenAvailWidth: window.screen?.availWidth || 0, screenAvailHeight: window.screen?.availHeight || 0 },
    websiteBudget,
    missionCardOverlaps: pass270FindOverlaps(missionCards),
    overlayOverlaps: pass270FindOverlaps(overlays),
    unscrollableCards: pass270CheckScrollableCards(cards),
    clippedRecipeButtons: pass270CheckClippedButtons(recipeButtons),
    clippedControlSurfaces: pass270CheckClippedButtons(clippedSurfaces),
    webviewHealth,
    activePane,
    storeSubmission: 'not-submitted',
    storeApproval: 'not-approved',
    publicGaClaim: false
  };
  report.ok = websiteBudget.ok && report.missionCardOverlaps.length === 0 && report.overlayOverlaps.length === 0 && report.unscrollableCards.length === 0 && report.clippedRecipeButtons.length === 0 && report.clippedControlSurfaces.length === 0 && webviewHealth.paneFailures.length === 0 && activePane.ok;
  if (document.documentElement) {
    document.documentElement.dataset.pass270VisualSoakInstalled = 'true';
    document.documentElement.dataset.pass270VisualSoakLastOk = String(report.ok);
    document.documentElement.dataset.pass270WebsiteBudgetOk = String(websiteBudget.ok);
    document.documentElement.dataset.pass270NoMissionCardOverlap = String(report.missionCardOverlaps.length === 0);
    document.documentElement.dataset.pass270NoOverlayCollision = String(report.overlayOverlaps.length === 0);
    document.documentElement.dataset.pass270NoUnscrollableCards = String(report.unscrollableCards.length === 0);
    document.documentElement.dataset.pass270NoClippedRecipeButtons = String(report.clippedRecipeButtons.length === 0);
    document.documentElement.dataset.pass270NoBadWebviewPane = String(webviewHealth.paneFailures.length === 0);
    document.documentElement.dataset.pass270NoOrphanedActivePane = String(activePane.ok);
  }
  return report;
}
function pass270InstallVisualSoak(root = document) {
  if (root.documentElement?.dataset.pass270VisualSoakInstalled === 'true') return false;
  const run = () => pass270RunVisualSoak(root);
  window.__PASS270_VISUAL_SOAK__ = { PASS270_VISUAL_SOAK, pass270RunVisualSoak, pass270WebsiteBudget, pass270CheckWebviews, pass270ActivePaneHealth };
  run();
  window.addEventListener('resize', () => window.requestAnimationFrame(run), { passive: true });
  root.addEventListener('transitionend', () => window.requestAnimationFrame(run), true);
  root.addEventListener('click', () => window.requestAnimationFrame(run), true);
  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(() => window.requestAnimationFrame(run));
    for (const el of pass270UniqueElements(['body','main','[data-webview-stage]','[data-mission-stage]','.mission-stage','.webview-stage','.browser-content'], root)) observer.observe(el);
  }
  return true;
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => pass270InstallVisualSoak(document), { once: true });
  else pass270InstallVisualSoak(document);
}
/* PASS270_RESTORED_MAXIMIZED_SMALL_WINDOW_VISUAL_SOAK_END */
`; }
function pass270CssBlock(){ return `

/* PASS270_RESTORED_MAXIMIZED_SMALL_WINDOW_VISUAL_SOAK_CSS_START */
:root {
  --pass270-min-website-budget: 360px;
  --pass270-min-pane-budget: 220px;
}
html[data-pass270-visual-soak-installed="true"] body,
html[data-pass270-visual-soak-installed="true"] #root,
html[data-pass270-visual-soak-installed="true"] .app-shell,
html[data-pass270-visual-soak-installed="true"] .browser-shell {
  min-width: 0;
  min-height: 0;
}
[data-browser-content],
[data-content-pane],
[data-website-pane],
[data-webview-stage],
[data-mission-stage],
.browser-content,
.content-pane,
.webview-stage,
.mission-stage {
  min-width: 0;
  min-height: var(--pass270-min-website-budget);
  overflow: hidden;
  contain: layout size;
}
[data-pane-id],
[data-mission-pane-id],
.mission-pane,
.mission-view-pane,
.pane {
  min-width: 0;
  min-height: var(--pass270-min-pane-budget);
  overflow: hidden;
  position: relative;
}
[data-pane-id] > webview,
[data-mission-pane-id] > webview,
.mission-pane > webview,
.mission-view-pane > webview,
.webview-stage webview,
[data-webview-stage] webview,
webview[data-pane-webview] {
  display: block;
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  transform: none;
}
[data-mission-card],
[data-recipe-card],
[data-tool-card],
.mission-card,
.recipe-card,
.mission-recipe-card,
.tool-card,
.card {
  min-width: 0;
  overflow: auto;
  overflow-wrap: anywhere;
  max-height: min(72vh, 760px);
}
[data-recipe-card] button,
.mission-recipe-card button,
.recipe-card button,
[data-recipe-action],
[data-start-recipe] {
  min-height: 32px;
  max-width: 100%;
  white-space: normal;
}
[data-overlay],
[data-command-center],
[data-more-tools],
[data-mission-panel],
[data-settings-panel],
[data-kb-panel],
.overlay,
.command-center,
.more-tools,
.mission-panel,
.settings-panel,
.kb-panel {
  max-width: calc(100vw - 24px);
  max-height: calc(100vh - 24px);
  overflow: auto;
  overscroll-behavior: contain;
}
@media (max-width: 1366px), (max-height: 768px) {
  :root {
    --pass270-min-website-budget: 320px;
    --pass270-min-pane-budget: 180px;
  }
  [data-mission-card],
  [data-recipe-card],
  [data-tool-card],
  .mission-card,
  .recipe-card,
  .mission-recipe-card,
  .tool-card,
  .card {
    max-height: min(68vh, 620px);
  }
}
/* PASS270_RESTORED_MAXIMIZED_SMALL_WINDOW_VISUAL_SOAK_CSS_END */
`; }
function patchRenderer(){
  const renderer=findRenderer();
  if (!renderer) return {found:false,changed:false};
  let text=read(renderer);
  if (text.includes('PASS270_RESTORED_MAXIMIZED_SMALL_WINDOW_VISUAL_SOAK_START')) return {found:true,changed:false,target:rel(renderer)};
  text += pass270RendererBlock();
  write(renderer,text);
  return {found:true,changed:true,target:rel(renderer)};
}
function patchCss(){
  const css=findCss();
  let text=read(css);
  if (text.includes('PASS270_RESTORED_MAXIMIZED_SMALL_WINDOW_VISUAL_SOAK_CSS_START')) return {found:Boolean(text),changed:false,target:rel(css)};
  text += pass270CssBlock();
  write(css,text);
  return {found:true,changed:true,target:rel(css)};
}
const pkg=patchPackageJson();
const renderer=patchRenderer();
const css=patchCss();
const report={ pass, versionTarget, remainingPassesAfterThisPass, packageJson:pkg, renderer, css, storeSubmission:'not-submitted', storeApproval:'not-approved', publicGaClaim:false, signedReleaseClaim:false, generatedAt:new Date().toISOString() };
write(path.join(root,'release-candidate/generated/pass270-restored-maximized-small-window-visual-soak-apply-report.json'), JSON.stringify(report,null,2)+'\n');
console.log('PASS270_APPLY=PASS');
console.log(`PASS270_VERSION=${versionTarget}`);
console.log(`PASS270_REMAINING_PASSES_AFTER_THIS=${remainingPassesAfterThisPass}`);
console.log(`PASS270_RENDERER_TARGET=${renderer.target || 'not-found'}`);
console.log(`PASS270_CSS_TARGET=${css.target || 'not-found'}`);
console.log('PASS270_STORE_SUBMISSION_STATUS=NOT_SUBMITTED_NOT_APPROVED');
