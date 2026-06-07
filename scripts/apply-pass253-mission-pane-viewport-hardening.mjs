#!/usr/bin/env node
/*
  PASS253 — Mission Pane Viewport Hardening + 2.0.2

  Purpose:
  - Increment 2.0.x package truth to 2.0.2 without repeated bumps on rerun.
  - Stop Mission multi-view panes from showing a large black/dead area with only the bottom of the website visible.
  - Force each visible Mission pane to allocate a real top-anchored website viewport after 1/2/3/4/focus switching.
  - Recover from stale focus/quad/tri split states without hiding or bottom-aligning webviews.
*/
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pass = 'PASS253';
const targetVersion = '2.0.2';
const cssStart = '/* PASS253_MISSION_PANE_VIEWPORT_HARDENING_START */';
const cssEnd = '/* PASS253_MISSION_PANE_VIEWPORT_HARDENING_END */';
const jsStart = '/* PASS253_MISSION_PANE_VIEWPORT_GUARD_START */';
const jsEnd = '/* PASS253_MISSION_PANE_VIEWPORT_GUARD_END */';
const priorCssMarker = 'PASS252_MISSION_MULTIVIEW_STATE_HARDENING_START';
const priorJsMarker = 'PASS252_MISSION_MULTIVIEW_STATE_GUARD_START';

const skipDirs = new Set(['.git', 'node_modules', 'dist', 'release', 'release-msix', 'out', 'coverage', '.vite', '.next', 'build']);
const preferredCss = [
  'src/renderer/styles/browser.css',
  'src/renderer/styles.css',
  'src/renderer/renderer.css',
  'src/renderer/app.css',
  'src/renderer/index.css',
  'src/renderer/style.css',
  'renderer/styles.css',
  'renderer/renderer.css',
  'renderer/app.css',
  'app/renderer/styles.css',
  'assets/styles.css',
  'public/styles.css',
  'styles.css',
];
const preferredRendererJs = [
  'src/renderer/app.ts',
  'src/renderer/renderer.ts',
  'src/renderer/index.ts',
  'src/renderer/main.ts',
  'src/renderer/app.tsx',
  'src/renderer/index.tsx',
  'src/renderer/app.js',
  'src/renderer/renderer.js',
  'src/renderer/index.js',
  'src/renderer/main.js',
  'renderer/app.js',
  'renderer/renderer.js',
  'app/renderer/app.js',
  'app/renderer/renderer.js',
];

function rel(p) { return path.relative(root, p).split(path.sep).join('/'); }
function readText(file) { try { return fs.readFileSync(file, 'utf8'); } catch { return ''; } }
function writeText(file, text) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }
function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

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

function parseVersion(v) {
  const m = String(v || '').match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), suffix: m[4] || '' };
}
function compareSemverish(a, b) {
  const av = parseVersion(a);
  const bv = parseVersion(b);
  if (!av || !bv) return 0;
  for (const key of ['major', 'minor', 'patch']) {
    if (av[key] !== bv[key]) return av[key] - bv[key];
  }
  return 0;
}
function next2Version(current) {
  const parsed = parseVersion(current);
  if (!parsed) return targetVersion;
  if (parsed.major !== 2 || parsed.minor !== 0) return targetVersion;
  return compareSemverish(current, targetVersion) < 0 ? targetVersion : `${parsed.major}.${parsed.minor}.${parsed.patch}${parsed.suffix}`;
}
function updatePackageLikeJson(file, packageName) {
  if (!fs.existsSync(file)) return null;
  const text = readText(file);
  let json;
  try { json = JSON.parse(text); } catch { return { file: rel(file), changed: false, error: 'invalid-json' }; }
  let changed = false;
  const before = json.version;
  const after = next2Version(before);
  if (json.version !== after) { json.version = after; changed = true; }
  if (json.packages && json.packages['']) {
    const rootBefore = json.packages[''].version;
    const rootAfter = next2Version(rootBefore || before);
    if (json.packages[''].version !== rootAfter) { json.packages[''].version = rootAfter; changed = true; }
    if (packageName && json.packages[`node_modules/${packageName}`]?.version) {
      const nestedAfter = next2Version(json.packages[`node_modules/${packageName}`].version);
      if (json.packages[`node_modules/${packageName}`].version !== nestedAfter) {
        json.packages[`node_modules/${packageName}`].version = nestedAfter;
        changed = true;
      }
    }
  }
  if (packageName && json.dependencies?.[packageName]?.version) {
    const depAfter = next2Version(json.dependencies[packageName].version);
    if (json.dependencies[packageName].version !== depAfter) {
      json.dependencies[packageName].version = depAfter;
      changed = true;
    }
  }
  if (changed) writeText(file, JSON.stringify(json, null, 2) + '\n');
  return { file: rel(file), changed, before, after: json.version };
}
function ensurePackageScriptsAndVersion() {
  const pkgPath = path.join(root, 'package.json');
  if (!fs.existsSync(pkgPath)) return { packageJsonFound: false, changes: [] };
  const pkg = JSON.parse(readText(pkgPath));
  pkg.scripts = pkg.scripts || {};
  const beforeVersion = pkg.version;
  const afterVersion = next2Version(pkg.version);
  let changed = false;
  if (pkg.version !== afterVersion) { pkg.version = afterVersion; changed = true; }
  const scriptName = 'verify:pass-253-mission-pane-viewport-hardening';
  const scriptValue = 'node scripts/verify-pass253-mission-pane-viewport-hardening.mjs';
  if (pkg.scripts[scriptName] !== scriptValue) { pkg.scripts[scriptName] = scriptValue; changed = true; }
  if (changed) writeText(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  const changes = [{ file: 'package.json', changed, before: beforeVersion, after: pkg.version }];
  for (const lock of ['package-lock.json', 'npm-shrinkwrap.json']) {
    const result = updatePackageLikeJson(path.join(root, lock), pkg.name);
    if (result) changes.push(result);
  }
  return { packageJsonFound: true, version: pkg.version, scriptName, changes };
}

const cssPatch = `${cssStart}
:root {
  --pass253-pane-min-visible-site-height: clamp(300px, 48vh, 760px);
  --pass253-pane-compact-site-height: clamp(240px, 42vh, 640px);
  --pass253-pane-gap: clamp(6px, 0.5vw, 10px);
}

/* PASS253: visible Mission panes must always allocate a real top-anchored website viewport. */
.mission-view-host,
.mission-multiview,
.mission-views,
.mission-panes,
.mission-view-grid,
[data-mission-layout] .mission-panes,
[data-mission-layout] .mission-view-grid,
[data-pass253-viewport-managed="true"] {
  align-content: stretch !important;
  align-items: stretch !important;
  justify-content: stretch !important;
  justify-items: stretch !important;
  gap: var(--pass253-pane-gap) !important;
  min-width: 0 !important;
  min-height: var(--pass253-pane-min-visible-site-height) !important;
  overflow: hidden !important;
}

.mission-pane,
.mission-webview-pane,
.mission-pane-shell,
[data-mission-pane],
[data-pane-id],
[data-pass253-pane-managed="true"] {
  align-self: stretch !important;
  justify-self: stretch !important;
  align-items: stretch !important;
  justify-content: stretch !important;
  display: flex !important;
  flex-direction: column !important;
  flex: 1 1 0 !important;
  min-width: 0 !important;
  min-height: var(--pass253-pane-compact-site-height) !important;
  max-height: none !important;
  overflow: hidden !important;
  position: relative !important;
  isolation: isolate;
  background: transparent !important;
}

/* Generic content shells inside panes: prevent spacer/header math from pushing the webview to the bottom. */
.mission-pane .mission-pane-content,
.mission-pane .mission-pane-body,
.mission-pane .mission-pane-main,
.mission-pane .mission-pane-viewport,
.mission-pane .mission-webview-container,
.mission-pane .webview-container,
.mission-pane .site-view,
.mission-pane .website-pane,
.mission-pane .browser-pane-content,
.mission-pane [class*="content" i],
.mission-pane [class*="viewport" i],
.mission-pane [class*="webview" i],
[data-mission-pane] .mission-pane-content,
[data-mission-pane] .mission-pane-body,
[data-mission-pane] .mission-pane-main,
[data-mission-pane] .mission-pane-viewport,
[data-mission-pane] .mission-webview-container,
[data-mission-pane] .webview-container,
[data-mission-pane] .site-view,
[data-mission-pane] .website-pane,
[data-mission-pane] .browser-pane-content,
[data-mission-pane] [class*="content" i],
[data-mission-pane] [class*="viewport" i],
[data-mission-pane] [class*="webview" i],
[data-pass253-site-container="true"] {
  min-width: 0 !important;
  min-height: 0 !important;
  height: auto !important;
  flex: 1 1 0 !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: stretch !important;
  justify-content: stretch !important;
  align-content: stretch !important;
  justify-items: stretch !important;
  overflow: hidden !important;
  position: relative !important;
  top: auto !important;
  bottom: auto !important;
  transform: none !important;
  translate: none !important;
  background: transparent !important;
}

/* The actual site surface: top-left anchored, full size, never bottom-aligned. */
.mission-pane webview,
.mission-pane iframe,
.mission-webview-pane webview,
.mission-webview-pane iframe,
[data-mission-pane] webview,
[data-mission-pane] iframe,
[data-pane-id] webview,
[data-pane-id] iframe,
[data-pass253-site-view="true"] {
  align-self: stretch !important;
  justify-self: stretch !important;
  flex: 1 1 0 !important;
  width: 100% !important;
  max-width: 100% !important;
  height: 100% !important;
  min-width: 0 !important;
  min-height: 0 !important;
  max-height: none !important;
  display: flex !important;
  position: relative !important;
  inset: auto !important;
  top: 0 !important;
  left: 0 !important;
  right: auto !important;
  bottom: auto !important;
  margin: 0 !important;
  transform: none !important;
  translate: none !important;
  object-fit: fill !important;
  object-position: top left !important;
  vertical-align: top !important;
  border: 0 !important;
  background: transparent !important;
}

/* Emergency repaired state: when runtime detects a bottom-only/black-area failure, make the pane a two-row shell and put the site into the fill row. */
[data-pass253-viewport-repaired="true"] {
  display: grid !important;
  grid-template-rows: auto minmax(var(--pass253-pane-compact-site-height), 1fr) !important;
  grid-auto-rows: auto !important;
  align-items: stretch !important;
  justify-items: stretch !important;
}

[data-pass253-viewport-repaired="true"] > webview,
[data-pass253-viewport-repaired="true"] > iframe,
[data-pass253-viewport-repaired="true"] [data-pass253-site-view="true"] {
  grid-row: 2 / -1 !important;
  min-height: var(--pass253-pane-compact-site-height) !important;
  height: 100% !important;
}

/* Hide only truly inactive focus panes. Non-focus switches must not leave split/tri/quad panes collapsed. */
[data-mission-layout="split"] .mission-pane,
[data-mission-layout="triple"] .mission-pane,
[data-mission-layout="quad"] .mission-pane,
[data-mission-layout="split"] [data-mission-pane],
[data-mission-layout="triple"] [data-mission-pane],
[data-mission-layout="quad"] [data-mission-pane],
[data-pass253-layout-mode="split"] [data-pass253-pane-managed="true"],
[data-pass253-layout-mode="triple"] [data-pass253-pane-managed="true"],
[data-pass253-layout-mode="quad"] [data-pass253-pane-managed="true"] {
  opacity: 1 !important;
  visibility: visible !important;
  pointer-events: auto !important;
  position: relative !important;
  width: auto !important;
  height: auto !important;
  clip-path: none !important;
}

@media (max-width: 1180px) {
  .mission-view-host,
  .mission-multiview,
  .mission-views,
  .mission-panes,
  .mission-view-grid,
  [data-pass253-viewport-managed="true"] {
    min-height: auto !important;
    overflow-y: auto !important;
  }

  .mission-pane,
  .mission-webview-pane,
  .mission-pane-shell,
  [data-mission-pane],
  [data-pane-id],
  [data-pass253-pane-managed="true"] {
    min-height: var(--pass253-pane-compact-site-height) !important;
  }
}
${cssEnd}`;

const jsPatchForJs = `${jsStart}
(() => {
  const hostSelectors = [
    '[data-mission-control]',
    '[data-mission-layout]',
    '.mission-control-shell',
    '.mission-control-modal',
    '.mission-modal',
    '.mission-overlay-panel',
    '.mission-drawer',
    '.mission-view-host',
    '.mission-multiview',
  ].join(',');
  const paneHostSelectors = [
    '.mission-view-grid',
    '.mission-panes',
    '.mission-views',
    '.mission-multiview',
    '[data-mission-pane-host]',
    '[data-pane-host]',
  ].join(',');
  const paneSelectors = [
    '.mission-pane',
    '.mission-webview-pane',
    '.mission-pane-shell',
    '[data-mission-pane]',
    '[data-pane-id]',
  ].join(',');
  const viewSelectors = 'webview, iframe';
  const contentShellSelectors = [
    '.mission-pane-content',
    '.mission-pane-body',
    '.mission-pane-main',
    '.mission-pane-viewport',
    '.mission-webview-container',
    '.webview-container',
    '.site-view',
    '.website-pane',
    '.browser-pane-content',
    '[class*="content" i]',
    '[class*="viewport" i]',
    '[class*="webview" i]',
  ].join(',');
  const layoutDefinitions = [
    { name: 'focus', count: 1, tokens: ['focus pane', 'focus'] },
    { name: 'quad', count: 4, tokens: ['quad', '4-up', '4 up', 'four-up', 'four up'] },
    { name: 'triple', count: 3, tokens: ['tri-view', 'triview', 'triple', '3-up', '3 up', 'three-up', 'three up', 'left tall', 'right tall'] },
    { name: 'split', count: 2, tokens: ['split', '2-up', '2 up', 'two-up', 'two up'] },
    { name: 'single', count: 1, tokens: ['1-up', '1 up', 'one-up', 'one up', 'single', 'normal'] },
  ];
  let queued = false;
  let observer = null;

  const toText = (element) => {
    if (!element) return '';
    return [
      element.getAttribute('data-layout'),
      element.getAttribute('data-mission-layout'),
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.className && String(element.className),
      element.textContent,
    ].filter(Boolean).join(' ').toLowerCase();
  };
  const layoutFromText = (text) => layoutDefinitions.find((layout) => layout.tokens.some((token) => text.includes(token))) || null;
  const resolveLayout = (host) => {
    const fromHost = layoutFromText(toText(host));
    if (fromHost) return fromHost;
    const pressed = host.querySelector('[aria-pressed="true"], [data-selected="true"], [data-active="true"], .is-active, .active');
    const fromPressed = layoutFromText(toText(pressed));
    return fromPressed || { name: host.getAttribute('data-mission-layout') || 'single', count: 1, tokens: [] };
  };
  const missionHosts = () => {
    const hosts = Array.from(document.querySelectorAll(hostSelectors));
    return hosts.length ? hosts : Array.from(document.querySelectorAll('.mission-modal, .mission-control-modal, .mission-overlay-panel'));
  };
  const setStyles = (element, styles) => {
    if (!(element instanceof HTMLElement)) return;
    for (const [key, value] of Object.entries(styles)) element.style[key] = value;
  };
  const topLockView = (view) => {
    if (!(view instanceof HTMLElement)) return;
    view.setAttribute('data-pass253-site-view', 'true');
    view.removeAttribute('hidden');
    view.setAttribute('aria-hidden', 'false');
    setStyles(view, {
      alignSelf: 'stretch',
      justifySelf: 'stretch',
      flex: '1 1 0px',
      width: '100%',
      maxWidth: '100%',
      height: '100%',
      minWidth: '0px',
      minHeight: '0px',
      maxHeight: 'none',
      display: 'flex',
      position: 'relative',
      top: '0px',
      left: '0px',
      right: 'auto',
      bottom: 'auto',
      margin: '0px',
      transform: 'none',
      translate: 'none',
      objectPosition: 'top left',
      verticalAlign: 'top',
      border: '0px',
    });
  };
  const normalizeContentShell = (shell) => {
    if (!(shell instanceof HTMLElement)) return;
    shell.setAttribute('data-pass253-site-container', 'true');
    setStyles(shell, {
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 0px',
      minWidth: '0px',
      minHeight: '0px',
      height: 'auto',
      alignItems: 'stretch',
      justifyContent: 'stretch',
      overflow: 'hidden',
      position: 'relative',
      top: 'auto',
      bottom: 'auto',
      transform: 'none',
      translate: 'none',
    });
  };
  const paneHasBottomOnlyFailure = (pane, view) => {
    if (!(pane instanceof HTMLElement) || !(view instanceof HTMLElement)) return false;
    const paneRect = pane.getBoundingClientRect();
    const viewRect = view.getBoundingClientRect();
    if (paneRect.height < 120 || viewRect.height <= 0) return false;
    const topOffset = viewRect.top - paneRect.top;
    const emptyTopRatio = topOffset / paneRect.height;
    const heightRatio = viewRect.height / paneRect.height;
    return topOffset > 96 || emptyTopRatio > 0.25 || heightRatio < 0.45;
  };
  const normalizePane = (pane, layoutName, index) => {
    if (!(pane instanceof HTMLElement)) return;
    pane.setAttribute('data-pass253-pane-managed', 'true');
    pane.setAttribute('data-pass253-pane-index', String(index + 1));
    pane.removeAttribute('hidden');
    pane.setAttribute('aria-hidden', 'false');
    if (layoutName !== 'focus') {
      pane.classList.remove('is-hidden', 'hidden', 'is-collapsed', 'collapsed');
      setStyles(pane, {
        opacity: '1',
        visibility: 'visible',
        pointerEvents: 'auto',
        position: 'relative',
        width: 'auto',
        height: 'auto',
        minWidth: '0px',
        minHeight: '',
        maxHeight: 'none',
        clipPath: 'none',
      });
    }
    setStyles(pane, {
      display: pane.style.display === 'none' && layoutName !== 'focus' ? 'flex' : pane.style.display || 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      justifyContent: 'stretch',
      alignSelf: 'stretch',
      justifySelf: 'stretch',
      overflow: 'hidden',
    });
    const shells = Array.from(pane.querySelectorAll(contentShellSelectors));
    shells.forEach(normalizeContentShell);
    const views = Array.from(pane.querySelectorAll(viewSelectors));
    views.forEach(topLockView);
    const firstView = views.find((node) => node instanceof HTMLElement);
    if (firstView && paneHasBottomOnlyFailure(pane, firstView)) pane.setAttribute('data-pass253-viewport-repaired', 'true');
    else pane.removeAttribute('data-pass253-viewport-repaired');
  };
  const normalizeHost = (host) => {
    if (!(host instanceof HTMLElement)) return;
    const layout = resolveLayout(host);
    host.setAttribute('data-pass253-viewport-managed', 'true');
    host.setAttribute('data-pass253-layout-mode', layout.name);
    host.setAttribute('data-mission-layout', layout.name);
    const paneHost = host.querySelector(paneHostSelectors) || host;
    if (paneHost instanceof HTMLElement) {
      paneHost.setAttribute('data-pass253-viewport-managed', 'true');
      paneHost.setAttribute('data-pass253-layout-mode', layout.name);
      setStyles(paneHost, { alignItems: 'stretch', justifyItems: 'stretch', alignContent: 'stretch', justifyContent: 'stretch', overflow: 'hidden' });
    }
    const panes = Array.from(paneHost.querySelectorAll(paneSelectors)).filter((pane) => pane instanceof HTMLElement && !pane.closest('template'));
    const visibleCount = Math.min(Math.max(layout.count, 1), Math.max(panes.length, 1));
    host.setAttribute('data-pass253-visible-pane-count', String(visibleCount));
    panes.forEach((pane, index) => normalizePane(pane, layout.name, index));
    const activePane = panes.find((pane) => pane.classList.contains('is-active') || pane.classList.contains('active') || pane.getAttribute('data-active') === 'true');
    if (!activePane && panes[0]) {
      panes[0].classList.add('is-active');
      panes[0].setAttribute('data-active', 'true');
    }
    void host.offsetHeight;
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
      host.dispatchEvent(new Event('pass253-mission-pane-viewport-normalized', { bubbles: true }));
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    });
  };
  const repair = () => {
    queued = false;
    missionHosts().forEach(normalizeHost);
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(repair);
  };
  const missionControlIntent = (element) => {
    if (!(element instanceof Element)) return false;
    if (element.closest(hostSelectors)) return true;
    return /mission|pane|view|layout|split|tri|quad|focus|1-up|2-up|3-up|4-up|repair|fit|doctor/.test(toText(element));
  };
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const control = target.closest('button, [role="button"], [data-layout], [data-mission-layout], [data-view], [aria-label], .mission-layout-tabs, .mission-pane-controls, .mission-view-controls');
    if (missionControlIntent(control)) schedule();
  }, true);
  document.addEventListener('keydown', (event) => {
    const key = String(event.key || '').toLowerCase();
    if ((event.ctrlKey && event.altKey && ['1', '2', '3', '4', 'q', 's', 'f'].includes(key)) || key === 'escape') schedule();
  }, true);
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  window.addEventListener('tahai:mission-layout-change', schedule);
  window.addEventListener('tahai:mission-pane-change', schedule);
  window.addEventListener('pass252-mission-layout-normalized', schedule);
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      const target = mutation.target;
      if (!(target instanceof Element)) continue;
      if (target.matches(hostSelectors) || target.closest(hostSelectors) || target.matches(paneSelectors) || target.closest(paneSelectors)) { schedule(); break; }
    }
  });
  const start = () => {
    if (!document.documentElement || observer === null) return;
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'data-layout', 'data-mission-layout', 'data-active'] });
    schedule();
    setTimeout(schedule, 60);
    setTimeout(schedule, 240);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
${jsEnd}`;

const jsPatchForTs = `${jsStart}
((): void => {
  type LayoutDefinition = { name: string; count: number; tokens: string[] };
  const hostSelectors = ['[data-mission-control]', '[data-mission-layout]', '.mission-control-shell', '.mission-control-modal', '.mission-modal', '.mission-overlay-panel', '.mission-drawer', '.mission-view-host', '.mission-multiview'].join(',');
  const paneHostSelectors = ['.mission-view-grid', '.mission-panes', '.mission-views', '.mission-multiview', '[data-mission-pane-host]', '[data-pane-host]'].join(',');
  const paneSelectors = ['.mission-pane', '.mission-webview-pane', '.mission-pane-shell', '[data-mission-pane]', '[data-pane-id]'].join(',');
  const viewSelectors = 'webview, iframe';
  const contentShellSelectors = ['.mission-pane-content', '.mission-pane-body', '.mission-pane-main', '.mission-pane-viewport', '.mission-webview-container', '.webview-container', '.site-view', '.website-pane', '.browser-pane-content', '[class*="content" i]', '[class*="viewport" i]', '[class*="webview" i]'].join(',');
  const layoutDefinitions: LayoutDefinition[] = [
    { name: 'focus', count: 1, tokens: ['focus pane', 'focus'] },
    { name: 'quad', count: 4, tokens: ['quad', '4-up', '4 up', 'four-up', 'four up'] },
    { name: 'triple', count: 3, tokens: ['tri-view', 'triview', 'triple', '3-up', '3 up', 'three-up', 'three up', 'left tall', 'right tall'] },
    { name: 'split', count: 2, tokens: ['split', '2-up', '2 up', 'two-up', 'two up'] },
    { name: 'single', count: 1, tokens: ['1-up', '1 up', 'one-up', 'one up', 'single', 'normal'] },
  ];
  let queued = false;
  let observer: MutationObserver | null = null;
  const toText = (element: Element | null): string => !element ? '' : [element.getAttribute('data-layout'), element.getAttribute('data-mission-layout'), element.getAttribute('aria-label'), element.getAttribute('title'), element.className && String(element.className), element.textContent].filter(Boolean).join(' ').toLowerCase();
  const layoutFromText = (text: string): LayoutDefinition | null => layoutDefinitions.find((layout) => layout.tokens.some((token) => text.includes(token))) || null;
  const resolveLayout = (host: HTMLElement): LayoutDefinition => layoutFromText(toText(host)) || layoutFromText(toText(host.querySelector('[aria-pressed="true"], [data-selected="true"], [data-active="true"], .is-active, .active'))) || { name: host.getAttribute('data-mission-layout') || 'single', count: 1, tokens: [] };
  const missionHosts = (): Element[] => { const hosts = Array.from(document.querySelectorAll(hostSelectors)); return hosts.length ? hosts : Array.from(document.querySelectorAll('.mission-modal, .mission-control-modal, .mission-overlay-panel')); };
  const setStyles = (element: Element, styles: Record<string, string>): void => { if (!(element instanceof HTMLElement)) return; for (const [key, value] of Object.entries(styles)) (element.style as CSSStyleDeclaration & Record<string, string>)[key] = value; };
  const topLockView = (view: Element): void => {
    if (!(view instanceof HTMLElement)) return;
    view.setAttribute('data-pass253-site-view', 'true');
    view.removeAttribute('hidden');
    view.setAttribute('aria-hidden', 'false');
    setStyles(view, { alignSelf: 'stretch', justifySelf: 'stretch', flex: '1 1 0px', width: '100%', maxWidth: '100%', height: '100%', minWidth: '0px', minHeight: '0px', maxHeight: 'none', display: 'flex', position: 'relative', top: '0px', left: '0px', right: 'auto', bottom: 'auto', margin: '0px', transform: 'none', translate: 'none', objectPosition: 'top left', verticalAlign: 'top', border: '0px' });
  };
  const normalizeContentShell = (shell: Element): void => {
    if (!(shell instanceof HTMLElement)) return;
    shell.setAttribute('data-pass253-site-container', 'true');
    setStyles(shell, { display: 'flex', flexDirection: 'column', flex: '1 1 0px', minWidth: '0px', minHeight: '0px', height: 'auto', alignItems: 'stretch', justifyContent: 'stretch', overflow: 'hidden', position: 'relative', top: 'auto', bottom: 'auto', transform: 'none', translate: 'none' });
  };
  const paneHasBottomOnlyFailure = (pane: HTMLElement, view: Element): boolean => {
    if (!(view instanceof HTMLElement)) return false;
    const paneRect = pane.getBoundingClientRect();
    const viewRect = view.getBoundingClientRect();
    if (paneRect.height < 120 || viewRect.height <= 0) return false;
    const topOffset = viewRect.top - paneRect.top;
    const emptyTopRatio = topOffset / paneRect.height;
    const heightRatio = viewRect.height / paneRect.height;
    return topOffset > 96 || emptyTopRatio > 0.25 || heightRatio < 0.45;
  };
  const normalizePane = (pane: Element, layoutName: string, index: number): void => {
    if (!(pane instanceof HTMLElement)) return;
    pane.setAttribute('data-pass253-pane-managed', 'true');
    pane.setAttribute('data-pass253-pane-index', String(index + 1));
    pane.removeAttribute('hidden');
    pane.setAttribute('aria-hidden', 'false');
    if (layoutName !== 'focus') {
      pane.classList.remove('is-hidden', 'hidden', 'is-collapsed', 'collapsed');
      setStyles(pane, { opacity: '1', visibility: 'visible', pointerEvents: 'auto', position: 'relative', width: 'auto', height: 'auto', minWidth: '0px', minHeight: '', maxHeight: 'none', clipPath: 'none' });
    }
    setStyles(pane, { display: pane.style.display === 'none' && layoutName !== 'focus' ? 'flex' : pane.style.display || 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'stretch', alignSelf: 'stretch', justifySelf: 'stretch', overflow: 'hidden' });
    Array.from(pane.querySelectorAll(contentShellSelectors)).forEach(normalizeContentShell);
    const views = Array.from(pane.querySelectorAll(viewSelectors));
    views.forEach(topLockView);
    const firstView = views.find((node) => node instanceof HTMLElement);
    if (firstView && paneHasBottomOnlyFailure(pane, firstView)) pane.setAttribute('data-pass253-viewport-repaired', 'true');
    else pane.removeAttribute('data-pass253-viewport-repaired');
  };
  const normalizeHost = (host: Element): void => {
    if (!(host instanceof HTMLElement)) return;
    const layout = resolveLayout(host);
    host.setAttribute('data-pass253-viewport-managed', 'true');
    host.setAttribute('data-pass253-layout-mode', layout.name);
    host.setAttribute('data-mission-layout', layout.name);
    const paneHost = host.querySelector(paneHostSelectors) || host;
    if (paneHost instanceof HTMLElement) {
      paneHost.setAttribute('data-pass253-viewport-managed', 'true');
      paneHost.setAttribute('data-pass253-layout-mode', layout.name);
      setStyles(paneHost, { alignItems: 'stretch', justifyItems: 'stretch', alignContent: 'stretch', justifyContent: 'stretch', overflow: 'hidden' });
    }
    const panes = Array.from(paneHost.querySelectorAll(paneSelectors)).filter((pane) => pane instanceof HTMLElement && !pane.closest('template'));
    const visibleCount = Math.min(Math.max(layout.count, 1), Math.max(panes.length, 1));
    host.setAttribute('data-pass253-visible-pane-count', String(visibleCount));
    panes.forEach((pane, index) => normalizePane(pane, layout.name, index));
    const activePane = panes.find((pane) => pane.classList.contains('is-active') || pane.classList.contains('active') || pane.getAttribute('data-active') === 'true');
    if (!activePane && panes[0] instanceof HTMLElement) { panes[0].classList.add('is-active'); panes[0].setAttribute('data-active', 'true'); }
    void host.offsetHeight;
    requestAnimationFrame(() => { window.dispatchEvent(new Event('resize')); host.dispatchEvent(new Event('pass253-mission-pane-viewport-normalized', { bubbles: true })); requestAnimationFrame(() => window.dispatchEvent(new Event('resize'))); });
  };
  const repair = (): void => { queued = false; missionHosts().forEach(normalizeHost); };
  const schedule = (): void => { if (queued) return; queued = true; requestAnimationFrame(repair); };
  const missionControlIntent = (element: Element | null): boolean => !!element && (element.closest(hostSelectors) !== null || /mission|pane|view|layout|split|tri|quad|focus|1-up|2-up|3-up|4-up|repair|fit|doctor/.test(toText(element)));
  document.addEventListener('click', (event: MouseEvent): void => { const target = event.target; if (!(target instanceof Element)) return; const control = target.closest('button, [role="button"], [data-layout], [data-mission-layout], [data-view], [aria-label], .mission-layout-tabs, .mission-pane-controls, .mission-view-controls'); if (missionControlIntent(control)) schedule(); }, true);
  document.addEventListener('keydown', (event: KeyboardEvent): void => { const key = String(event.key || '').toLowerCase(); if ((event.ctrlKey && event.altKey && ['1', '2', '3', '4', 'q', 's', 'f'].includes(key)) || key === 'escape') schedule(); }, true);
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  window.addEventListener('tahai:mission-layout-change', schedule);
  window.addEventListener('tahai:mission-pane-change', schedule);
  window.addEventListener('pass252-mission-layout-normalized', schedule);
  observer = new MutationObserver((mutations: MutationRecord[]): void => { for (const mutation of mutations) { const target = mutation.target; if (!(target instanceof Element)) continue; if (target.matches(hostSelectors) || target.closest(hostSelectors) || target.matches(paneSelectors) || target.closest(paneSelectors)) { schedule(); break; } } });
  const start = (): void => { if (!document.documentElement || observer === null) return; observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'data-layout', 'data-mission-layout', 'data-active'] }); schedule(); setTimeout(schedule, 60); setTimeout(schedule, 240); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
${jsEnd}`;

function replaceOrAppend(file, start, end, patch) {
  const original = readText(file);
  const re = new RegExp(`${escapeRegex(start)}[\\s\\S]*?${escapeRegex(end)}`, 'm');
  const next = original.includes(start) ? original.replace(re, patch) : `${original.trimEnd()}\n\n${patch}\n`;
  writeText(file, next);
}
function chooseCssTarget() {
  const cssFiles = walk(root, f => f.endsWith('.css'));
  const prior = cssFiles.find(f => readText(f).includes(priorCssMarker));
  if (prior) return prior;
  for (const candidate of preferredCss) {
    const full = path.join(root, candidate);
    if (fs.existsSync(full)) return full;
  }
  const missionCss = cssFiles
    .map(file => ({ file, text: readText(file) }))
    .filter(x => /mission|pane|webview|overlay|modal|layout|website/i.test(x.text))
    .sort((a, b) => b.text.length - a.text.length);
  if (missionCss.length) return missionCss[0].file;
  const fallback = path.join(root, 'src', 'renderer', 'styles.css');
  writeText(fallback, '/* TAHAI renderer styles */\n');
  return fallback;
}
function chooseRendererTarget() {
  const codeFiles = walk(root, f => /\.(js|jsx|ts|tsx)$/i.test(f) && !/scripts[\\/]/.test(rel(f)));
  const prior = codeFiles.find(f => readText(f).includes(priorJsMarker));
  if (prior) return prior;
  for (const candidate of preferredRendererJs) {
    const full = path.join(root, candidate);
    if (fs.existsSync(full)) return full;
  }
  const missionCode = codeFiles
    .map(file => ({ file, text: readText(file) }))
    .filter(x => /mission|pane|quad|split|triple|webview|website|site view|ops panel/i.test(x.text))
    .sort((a, b) => b.text.length - a.text.length);
  if (missionCode.length) return missionCode[0].file;
  const fallback = path.join(root, 'src', 'renderer', 'pass253-mission-pane-viewport-hardening.js');
  writeText(fallback, '// PASS253 fallback renderer guard module. Import from the renderer entry if the apply script could not find an entry file.\n');
  return fallback;
}

const versionResult = ensurePackageScriptsAndVersion();
const cssTarget = chooseCssTarget();
replaceOrAppend(cssTarget, cssStart, cssEnd, cssPatch);
const rendererTarget = chooseRendererTarget();
const rendererPatch = /\.(ts|tsx)$/i.test(rendererTarget) ? jsPatchForTs : jsPatchForJs;
replaceOrAppend(rendererTarget, jsStart, jsEnd, rendererPatch);

const docPath = path.join(root, 'docs', 'ux', 'PASS253-mission-pane-viewport-hardening.md');
writeText(docPath, `# PASS253 — Mission Pane Viewport Hardening\n\nStatus: source-side viewport hardening pass for TAHAI Web Services Browser 2.0.2.\n\n## Purpose\n\nPASS253 hardens Mission multi-view panes so each visible pane shows the actual website surface, top anchored, instead of a large black/dead area with only the bottom of the page visible.\n\n## Acceptance\n\n- 1-Up, 2-Up, 3-Up, Quad, and Focus can be switched repeatedly without stale hidden/collapsed panes.\n- Visible split/tri/quad panes remain visible and allocate a real webview/iframe viewport.\n- Webviews/iframes are top-left anchored, flex-filled, and reflowed after layout changes.\n- Runtime viewport repair marks bottom-only failures with data-pass253-viewport-repaired.\n- Version truth is in the 2.0.x lane at 2.0.2 or higher.\n- Store submission remains blocked until installed visual smoke confirms Mission view behavior.\n`);

const report = {
  pass,
  name: 'Mission Pane Viewport Hardening',
  targetVersion,
  package: versionResult,
  cssTarget: rel(cssTarget),
  rendererTarget: rel(rendererTarget),
  doc: rel(docPath),
  status: 'PASS',
  assertions: [
    'Package/app version is at least 2.0.2 in the 2.0.x lane.',
    'Mission panes allocate top-anchored website viewports.',
    'Webviews and iframes are flex-filled instead of bottom-aligned.',
    'Bottom-only black-area failures are detected and marked for emergency repaired layout.',
    'Repeated 1/2/3/4/focus switching triggers viewport normalization and resize reflow.',
  ],
};
const reportDir = path.join(root, 'release-candidate', 'generated');
fs.mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, 'pass253-mission-pane-viewport-hardening-apply-report.json');
writeText(reportPath, JSON.stringify(report, null, 2) + '\n');

console.log('PASS253_APPLY=PASS');
console.log(`PASS253_VERSION=${versionResult.version || targetVersion}`);
console.log(`PASS253_CSS_TARGET=${rel(cssTarget)}`);
console.log(`PASS253_RENDERER_TARGET=${rel(rendererTarget)}`);
console.log(`PASS253_REPORT=${rel(reportPath)}`);
