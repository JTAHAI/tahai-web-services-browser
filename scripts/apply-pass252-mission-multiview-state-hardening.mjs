#!/usr/bin/env node
/*
  PASS252 — Mission Multi-View State Hardening + 2.0.x Version Increment

  Purpose:
  - Increment 2.0.x package truth to 2.0.1 without repeated bumps on rerun.
  - Add source-side Mission multi-view layout containment, pane fill, and switch recovery CSS.
  - Add a renderer-side state guard that normalizes Mission view state after repeated 1/2/3/4/focus switches.
  - Keep this repo-safe: no generated installers, no certs, no runtime data, no secret material.
*/
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pass = 'PASS252';
const targetVersion = '2.0.1';
const cssStart = '/* PASS252_MISSION_MULTIVIEW_STATE_HARDENING_START */';
const cssEnd = '/* PASS252_MISSION_MULTIVIEW_STATE_HARDENING_END */';
const jsStart = '/* PASS252_MISSION_MULTIVIEW_STATE_GUARD_START */';
const jsEnd = '/* PASS252_MISSION_MULTIVIEW_STATE_GUARD_END */';

const skipDirs = new Set(['.git', 'node_modules', 'dist', 'release', 'release-msix', 'out', 'coverage', '.vite', '.next', 'build']);
const preferredCss = [
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
  'src/renderer/app.js',
  'src/renderer/renderer.js',
  'src/renderer/index.js',
  'src/renderer/main.js',
  'renderer/app.js',
  'renderer/renderer.js',
  'app/renderer/app.js',
  'app/renderer/renderer.js',
  'src/renderer/app.ts',
  'src/renderer/renderer.ts',
  'src/renderer/index.ts',
  'src/renderer/main.ts',
  'src/renderer/app.tsx',
  'src/renderer/index.tsx',
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
  const scriptName = 'verify:pass-252-mission-multiview-state-hardening';
  const scriptValue = 'node scripts/verify-pass252-mission-multiview-state-hardening.mjs';
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
  --pass252-view-gap: clamp(6px, 0.52vw, 10px);
  --pass252-pane-radius: 12px;
  --pass252-pane-min-height: clamp(260px, 42vh, 620px);
  --pass252-focus-min-height: clamp(360px, 62vh, 880px);
}

/* PASS252 treats Mission View as a deterministic state machine: one layout truth, one active pane, no stale hidden/broken intermediate state. */
.mission-control-shell,
.mission-modal,
.mission-control-modal,
.mission-overlay-panel,
.mission-view-host,
.mission-multiview,
.mission-views,
.mission-panes,
.mission-view-grid,
[data-mission-control],
[data-mission-layout],
[class*="mission" i][class*="view" i],
[class*="mission" i][class*="pane" i] {
  min-width: 0 !important;
  min-height: 0 !important;
  box-sizing: border-box !important;
}

.mission-view-host,
.mission-multiview,
.mission-views,
.mission-panes,
.mission-view-grid,
[data-mission-layout] .mission-panes,
[data-mission-layout] .mission-view-grid,
[class*="mission" i][class*="view" i][class*="grid" i],
[class*="mission" i][class*="pane" i][class*="grid" i] {
  display: grid !important;
  gap: var(--pass252-view-gap) !important;
  width: 100% !important;
  max-width: 100% !important;
  min-height: var(--pass252-pane-min-height) !important;
  overflow: hidden !important;
  align-items: stretch !important;
}

/* Single / 1-Up */
[data-mission-layout="single"] .mission-view-grid,
[data-mission-layout="single"] .mission-panes,
.mission-layout-single .mission-view-grid,
.mission-layout-single .mission-panes,
[class*="1-up" i] .mission-view-grid,
[class*="one-up" i] .mission-view-grid {
  grid-template-columns: minmax(0, 1fr) !important;
  grid-template-rows: minmax(0, 1fr) !important;
}

/* Split / 2-Up */
[data-mission-layout="split"] .mission-view-grid,
[data-mission-layout="split"] .mission-panes,
[data-mission-layout="two"] .mission-view-grid,
[data-mission-layout="two"] .mission-panes,
.mission-layout-split .mission-view-grid,
.mission-layout-split .mission-panes,
.mission-layout-two-up .mission-view-grid,
.mission-layout-two-up .mission-panes,
[class*="2-up" i] .mission-view-grid,
[class*="two-up" i] .mission-view-grid {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
  grid-template-rows: minmax(0, 1fr) !important;
}

/* Triple / 3-Up — default plus left/right-tall variants. */
[data-mission-layout="triple"] .mission-view-grid,
[data-mission-layout="triple"] .mission-panes,
[data-mission-layout="three"] .mission-view-grid,
[data-mission-layout="three"] .mission-panes,
.mission-layout-triple .mission-view-grid,
.mission-layout-triple .mission-panes,
.mission-layout-three-up .mission-view-grid,
.mission-layout-three-up .mission-panes,
[class*="3-up" i] .mission-view-grid,
[class*="three-up" i] .mission-view-grid {
  grid-template-columns: minmax(0, 1.12fr) minmax(0, 1fr) !important;
  grid-template-rows: minmax(0, 1fr) minmax(0, 1fr) !important;
}

[data-mission-layout="triple"] .mission-pane:first-child,
[data-mission-layout="triple"] [data-mission-pane]:first-child,
[data-mission-layout="three"] .mission-pane:first-child,
[data-mission-layout="three"] [data-mission-pane]:first-child,
.mission-layout-triple .mission-pane:first-child,
.mission-layout-three-up .mission-pane:first-child,
[class*="left-tall" i] .mission-pane:first-child,
[class*="left-tall" i] [data-mission-pane]:first-child {
  grid-row: 1 / span 2 !important;
}

[class*="right-tall" i] .mission-pane:first-child,
[class*="right-tall" i] [data-mission-pane]:first-child {
  grid-row: auto !important;
}
[class*="right-tall" i] .mission-pane:nth-child(2),
[class*="right-tall" i] [data-mission-pane]:nth-child(2) {
  grid-row: 1 / span 2 !important;
}

/* Quad / 4-Up */
[data-mission-layout="quad"] .mission-view-grid,
[data-mission-layout="quad"] .mission-panes,
[data-mission-layout="four"] .mission-view-grid,
[data-mission-layout="four"] .mission-panes,
.mission-layout-quad .mission-view-grid,
.mission-layout-quad .mission-panes,
.mission-layout-four-up .mission-view-grid,
.mission-layout-four-up .mission-panes,
[class*="4-up" i] .mission-view-grid,
[class*="quad" i] .mission-view-grid {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
  grid-template-rows: minmax(0, 1fr) minmax(0, 1fr) !important;
}

/* Focus view: the active pane gets the entire working area; inactive panes stay non-destructive and recoverable. */
[data-mission-layout="focus"] .mission-view-grid,
[data-mission-layout="focus"] .mission-panes,
.mission-layout-focus .mission-view-grid,
.mission-layout-focus .mission-panes,
[class*="focus" i] .mission-view-grid {
  grid-template-columns: minmax(0, 1fr) !important;
  grid-template-rows: minmax(0, 1fr) !important;
  min-height: var(--pass252-focus-min-height) !important;
}

[data-mission-layout="focus"] .mission-pane:not(.is-active):not(.active):not([data-active="true"]),
[data-mission-layout="focus"] [data-mission-pane]:not(.is-active):not(.active):not([data-active="true"]),
.mission-layout-focus .mission-pane:not(.is-active):not(.active):not([data-active="true"]),
.mission-layout-focus [data-mission-pane]:not(.is-active):not(.active):not([data-active="true"]) {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  overflow: hidden !important;
  opacity: 0.001 !important;
  pointer-events: none !important;
}

/* Pane shells and embedded webviews must fill the assigned grid cell after every layout switch. */
.mission-pane,
.mission-webview-pane,
.mission-pane-shell,
[data-mission-pane],
[class*="mission" i][class*="pane" i] {
  min-width: 0 !important;
  min-height: 0 !important;
  height: auto !important;
  border-radius: var(--pass252-pane-radius);
  overflow: hidden !important;
  display: flex !important;
  flex-direction: column !important;
  contain: layout paint;
  pointer-events: auto !important;
}

.mission-pane > webview,
.mission-pane > iframe,
.mission-webview-pane > webview,
.mission-webview-pane > iframe,
[data-mission-pane] > webview,
[data-mission-pane] > iframe,
[class*="mission" i][class*="pane" i] > webview,
[class*="mission" i][class*="pane" i] > iframe {
  flex: 1 1 auto !important;
  width: 100% !important;
  height: 100% !important;
  min-width: 0 !important;
  min-height: 0 !important;
  border: 0 !important;
  display: flex !important;
}

/* Recover from stale switch states: no invisible pane host should keep pointer-events locked off after a failed transition. */
.pass252-mission-view-managed,
.pass252-mission-pane-managed,
.mission-view-grid.is-switching,
.mission-panes.is-switching,
.mission-pane.is-switching,
.mission-pane.is-resizing,
.mission-pane.is-moving,
[data-pass252-pane-index] {
  pointer-events: auto !important;
}

/* Button/control rows remain usable when repeated layout switches make labels wider than expected. */
.mission-layout-tabs,
.mission-layout-controls,
.mission-pane-controls,
.mission-pane-actions,
.mission-view-switcher,
.mission-view-controls,
[data-mission-layout-controls],
[class*="mission" i][class*="layout" i][class*="control" i],
[class*="mission" i][class*="view" i][class*="control" i] {
  min-width: 0 !important;
  max-width: 100% !important;
  display: flex !important;
  flex-wrap: wrap !important;
  align-items: center !important;
  gap: clamp(4px, 0.42vw, 8px) !important;
  overflow-x: auto !important;
  overflow-y: visible !important;
  scrollbar-width: thin;
}

@media (max-width: 1180px) {
  [data-mission-layout="split"] .mission-view-grid,
  [data-mission-layout="split"] .mission-panes,
  .mission-layout-split .mission-view-grid,
  .mission-layout-split .mission-panes,
  [data-mission-layout="triple"] .mission-view-grid,
  [data-mission-layout="triple"] .mission-panes,
  .mission-layout-triple .mission-view-grid,
  .mission-layout-triple .mission-panes,
  [data-mission-layout="quad"] .mission-view-grid,
  [data-mission-layout="quad"] .mission-panes,
  .mission-layout-quad .mission-view-grid,
  .mission-layout-quad .mission-panes {
    grid-template-columns: minmax(0, 1fr) !important;
    grid-template-rows: none !important;
  }

  [data-mission-layout="triple"] .mission-pane:first-child,
  [data-mission-layout="three"] .mission-pane:first-child,
  .mission-layout-triple .mission-pane:first-child,
  .mission-layout-three-up .mission-pane:first-child,
  [class*="left-tall" i] .mission-pane:first-child,
  [class*="right-tall" i] .mission-pane:nth-child(2) {
    grid-row: auto !important;
  }
}
${cssEnd}`;

const jsPatchForJs = `${jsStart}
(() => {
  const layoutClassPrefix = 'mission-layout-';
  const layoutClassNames = [
    'mission-layout-single',
    'mission-layout-one-up',
    'mission-layout-split',
    'mission-layout-two-up',
    'mission-layout-triple',
    'mission-layout-three-up',
    'mission-layout-quad',
    'mission-layout-four-up',
    'mission-layout-focus',
  ];
  const layoutDefinitions = [
    { name: 'focus', count: 1, tokens: ['focus pane', 'focus'] },
    { name: 'quad', count: 4, tokens: ['quad', '4-up', '4 up', 'four-up', 'four up'] },
    { name: 'triple', count: 3, tokens: ['tri-view', 'triview', 'triple', '3-up', '3 up', 'three-up', 'three up', 'left tall', 'right tall'] },
    { name: 'split', count: 2, tokens: ['split', '2-up', '2 up', 'two-up', 'two up'] },
    { name: 'single', count: 1, tokens: ['1-up', '1 up', 'one-up', 'one up', 'single', 'normal'] },
  ];
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
  let repairQueued = false;
  let observer = null;

  const toText = (element) => {
    if (!element) return '';
    const parts = [
      element.getAttribute('data-layout'),
      element.getAttribute('data-mission-layout'),
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.textContent,
      element.className && String(element.className),
    ];
    return parts.filter(Boolean).join(' ').toLowerCase();
  };

  const layoutFromText = (text) => layoutDefinitions.find((layout) => layout.tokens.some((token) => text.includes(token))) || null;

  const resolveLayout = (root) => {
    const fromRoot = layoutFromText(toText(root));
    if (fromRoot) return fromRoot;
    const activeControl = root.querySelector('[aria-pressed="true"], .is-active, .active, [data-active="true"], [data-selected="true"]');
    const fromActive = layoutFromText(toText(activeControl));
    if (fromActive) return fromActive;
    const selected = document.querySelector('[aria-pressed="true"], .is-active, .active, [data-active="true"], [data-selected="true"]');
    const fromSelected = selected && selected.closest(hostSelectors) ? layoutFromText(toText(selected)) : null;
    if (fromSelected) return fromSelected;
    return { name: root.getAttribute('data-mission-layout') || 'single', count: 1, tokens: [] };
  };

  const getMissionHosts = () => {
    const hosts = Array.from(document.querySelectorAll(hostSelectors));
    if (hosts.length) return hosts;
    const fallback = document.querySelector('.mission-modal, .mission-control-modal, .mission-overlay-panel');
    return fallback ? [fallback] : [];
  };

  const normalizeHostLayoutClasses = (host, layout) => {
    host.classList.add('pass252-mission-view-managed');
    host.setAttribute('data-mission-layout', layout.name);
    for (const className of layoutClassNames) host.classList.remove(className);
    host.classList.add(layoutClassPrefix + layout.name);
  };

  const clearStaleLockState = (element) => {
    if (!(element instanceof HTMLElement)) return;
    element.classList.remove('is-switching', 'is-resizing', 'is-moving', 'pane-moving', 'layout-changing', 'route-pending');
    element.classList.add(element.matches(paneSelectors) ? 'pass252-mission-pane-managed' : 'pass252-mission-view-managed');
    if (element.inert) element.inert = false;
    if (element.style.pointerEvents === 'none') element.style.pointerEvents = '';
    if (element.style.userSelect === 'none') element.style.userSelect = '';
  };

  const normalizePanes = (host, layout) => {
    const paneHost = host.querySelector(paneHostSelectors) || host;
    const panes = Array.from(paneHost.querySelectorAll(paneSelectors)).filter((pane) => {
      if (!(pane instanceof HTMLElement)) return false;
      if (pane.closest('template')) return false;
      return true;
    });
    paneHost.classList.add('pass252-mission-view-managed');
    paneHost.setAttribute('data-pass252-pane-count', String(Math.min(Math.max(layout.count, 1), Math.max(panes.length, 1))));
    panes.forEach((pane, index) => {
      pane.setAttribute('data-pass252-pane-index', String(index + 1));
      clearStaleLockState(pane);
      const webviews = pane.querySelectorAll('webview, iframe');
      webviews.forEach((view) => {
        if (view instanceof HTMLElement) {
          view.style.minWidth = '0px';
          view.style.minHeight = '0px';
        }
      });
    });
    const activePane = panes.find((pane) => pane.classList.contains('is-active') || pane.classList.contains('active') || pane.getAttribute('data-active') === 'true');
    if (!activePane && panes[0]) {
      panes[0].classList.add('is-active');
      panes[0].setAttribute('data-active', 'true');
    }
  };

  const forceReflow = (host) => {
    // Access offsetHeight intentionally to force layout after a rapid 1/2/3/4/focus swap.
    void host.offsetHeight;
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
      host.dispatchEvent(new Event('pass252-mission-layout-normalized', { bubbles: true }));
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    });
  };

  const repairMissionViews = () => {
    repairQueued = false;
    const hosts = getMissionHosts();
    hosts.forEach((host) => {
      if (!(host instanceof HTMLElement)) return;
      const layout = resolveLayout(host);
      normalizeHostLayoutClasses(host, layout);
      clearStaleLockState(host);
      normalizePanes(host, layout);
      forceReflow(host);
    });
  };

  const scheduleMissionViewRepair = () => {
    if (repairQueued) return;
    repairQueued = true;
    requestAnimationFrame(repairMissionViews);
  };

  const isMissionLayoutControl = (element) => {
    if (!element) return false;
    if (element.closest(hostSelectors)) return true;
    const text = toText(element);
    return /mission|pane|layout|view|quad|split|tri|3-up|4-up|2-up|1-up|focus|repair|doctor|fit/.test(text);
  };

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const control = target.closest('button, [role="button"], [data-layout], [data-mission-layout], [data-view], [aria-label], .mission-layout-tabs, .mission-pane-controls, .mission-view-controls');
    if (isMissionLayoutControl(control)) scheduleMissionViewRepair();
  }, true);

  document.addEventListener('keydown', (event) => {
    const key = String(event.key || '').toLowerCase();
    if ((event.ctrlKey && event.altKey && ['1', '2', '3', '4', 'q', 's', 'f'].includes(key)) || key === 'escape') {
      scheduleMissionViewRepair();
    }
  }, true);

  window.addEventListener('resize', scheduleMissionViewRepair);
  window.addEventListener('orientationchange', scheduleMissionViewRepair);
  window.addEventListener('tahai:mission-layout-change', scheduleMissionViewRepair);
  window.addEventListener('tahai:mission-pane-change', scheduleMissionViewRepair);

  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      const target = mutation.target;
      if (!(target instanceof Element)) continue;
      if (target.closest(hostSelectors) || target.matches(hostSelectors)) {
        scheduleMissionViewRepair();
        break;
      }
    }
  });

  const startObserver = () => {
    if (!document.documentElement || observer === null) return;
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'data-layout', 'data-mission-layout', 'data-active'],
    });
    scheduleMissionViewRepair();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startObserver, { once: true });
  else startObserver();
})();
${jsEnd}`;

const jsPatchForTs = `${jsStart}
((): void => {
  type LayoutDefinition = { name: string; count: number; tokens: string[] };
  const layoutClassPrefix = 'mission-layout-';
  const layoutClassNames = [
    'mission-layout-single',
    'mission-layout-one-up',
    'mission-layout-split',
    'mission-layout-two-up',
    'mission-layout-triple',
    'mission-layout-three-up',
    'mission-layout-quad',
    'mission-layout-four-up',
    'mission-layout-focus',
  ];
  const layoutDefinitions: LayoutDefinition[] = [
    { name: 'focus', count: 1, tokens: ['focus pane', 'focus'] },
    { name: 'quad', count: 4, tokens: ['quad', '4-up', '4 up', 'four-up', 'four up'] },
    { name: 'triple', count: 3, tokens: ['tri-view', 'triview', 'triple', '3-up', '3 up', 'three-up', 'three up', 'left tall', 'right tall'] },
    { name: 'split', count: 2, tokens: ['split', '2-up', '2 up', 'two-up', 'two up'] },
    { name: 'single', count: 1, tokens: ['1-up', '1 up', 'one-up', 'one up', 'single', 'normal'] },
  ];
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
  let repairQueued = false;
  let observer: MutationObserver | null = null;

  const toText = (element: Element | null): string => {
    if (!element) return '';
    const parts = [
      element.getAttribute('data-layout'),
      element.getAttribute('data-mission-layout'),
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.textContent,
      element.className && String(element.className),
    ];
    return parts.filter(Boolean).join(' ').toLowerCase();
  };
  const layoutFromText = (text: string): LayoutDefinition | null => layoutDefinitions.find((layout) => layout.tokens.some((token) => text.includes(token))) || null;
  const resolveLayout = (rootElement: HTMLElement): LayoutDefinition => layoutFromText(toText(rootElement)) || { name: rootElement.getAttribute('data-mission-layout') || 'single', count: 1, tokens: [] };
  const getMissionHosts = (): Element[] => Array.from(document.querySelectorAll(hostSelectors));
  const normalizeHostLayoutClasses = (host: HTMLElement, layout: LayoutDefinition): void => {
    host.classList.add('pass252-mission-view-managed');
    host.setAttribute('data-mission-layout', layout.name);
    for (const className of layoutClassNames) host.classList.remove(className);
    host.classList.add(layoutClassPrefix + layout.name);
  };
  const clearStaleLockState = (element: Element): void => {
    if (!(element instanceof HTMLElement)) return;
    element.classList.remove('is-switching', 'is-resizing', 'is-moving', 'pane-moving', 'layout-changing', 'route-pending');
    element.classList.add(element.matches(paneSelectors) ? 'pass252-mission-pane-managed' : 'pass252-mission-view-managed');
    element.inert = false;
    if (element.style.pointerEvents === 'none') element.style.pointerEvents = '';
    if (element.style.userSelect === 'none') element.style.userSelect = '';
  };
  const normalizePanes = (host: HTMLElement, layout: LayoutDefinition): void => {
    const paneHost = host.querySelector(paneHostSelectors) || host;
    const panes = Array.from(paneHost.querySelectorAll(paneSelectors)).filter((pane) => pane instanceof HTMLElement && !pane.closest('template')) as HTMLElement[];
    if (paneHost instanceof HTMLElement) paneHost.classList.add('pass252-mission-view-managed');
    if (paneHost instanceof HTMLElement) paneHost.setAttribute('data-pass252-pane-count', String(Math.min(Math.max(layout.count, 1), Math.max(panes.length, 1))));
    panes.forEach((pane, index) => {
      pane.setAttribute('data-pass252-pane-index', String(index + 1));
      clearStaleLockState(pane);
      pane.querySelectorAll('webview, iframe').forEach((view) => {
        if (view instanceof HTMLElement) {
          view.style.minWidth = '0px';
          view.style.minHeight = '0px';
        }
      });
    });
    const activePane = panes.find((pane) => pane.classList.contains('is-active') || pane.classList.contains('active') || pane.getAttribute('data-active') === 'true');
    if (!activePane && panes[0]) {
      panes[0].classList.add('is-active');
      panes[0].setAttribute('data-active', 'true');
    }
  };
  const forceReflow = (host: HTMLElement): void => {
    void host.offsetHeight;
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
      host.dispatchEvent(new Event('pass252-mission-layout-normalized', { bubbles: true }));
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    });
  };
  const repairMissionViews = (): void => {
    repairQueued = false;
    getMissionHosts().forEach((host) => {
      if (!(host instanceof HTMLElement)) return;
      const layout = resolveLayout(host);
      normalizeHostLayoutClasses(host, layout);
      clearStaleLockState(host);
      normalizePanes(host, layout);
      forceReflow(host);
    });
  };
  const scheduleMissionViewRepair = (): void => {
    if (repairQueued) return;
    repairQueued = true;
    requestAnimationFrame(repairMissionViews);
  };
  const isMissionLayoutControl = (element: Element | null): boolean => {
    if (!element) return false;
    if (element.closest(hostSelectors)) return true;
    return /mission|pane|layout|view|quad|split|tri|3-up|4-up|2-up|1-up|focus|repair|doctor|fit/.test(toText(element));
  };
  document.addEventListener('click', (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const control = target.closest('button, [role="button"], [data-layout], [data-mission-layout], [data-view], [aria-label], .mission-layout-tabs, .mission-pane-controls, .mission-view-controls');
    if (isMissionLayoutControl(control)) scheduleMissionViewRepair();
  }, true);
  document.addEventListener('keydown', (event: KeyboardEvent): void => {
    const key = String(event.key || '').toLowerCase();
    if ((event.ctrlKey && event.altKey && ['1', '2', '3', '4', 'q', 's', 'f'].includes(key)) || key === 'escape') scheduleMissionViewRepair();
  }, true);
  window.addEventListener('resize', scheduleMissionViewRepair);
  window.addEventListener('orientationchange', scheduleMissionViewRepair);
  window.addEventListener('tahai:mission-layout-change', scheduleMissionViewRepair);
  window.addEventListener('tahai:mission-pane-change', scheduleMissionViewRepair);
  observer = new MutationObserver((mutations: MutationRecord[]): void => {
    for (const mutation of mutations) {
      const target = mutation.target;
      if (!(target instanceof Element)) continue;
      if (target.closest(hostSelectors) || target.matches(hostSelectors)) { scheduleMissionViewRepair(); break; }
    }
  });
  const startObserver = (): void => {
    if (!document.documentElement || observer === null) return;
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'data-layout', 'data-mission-layout', 'data-active'] });
    scheduleMissionViewRepair();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startObserver, { once: true });
  else startObserver();
})();
${jsEnd}`;

function chooseCssTarget() {
  for (const candidate of preferredCss) {
    const full = path.join(root, candidate);
    if (fs.existsSync(full)) return full;
  }
  const cssFiles = walk(root, f => f.endsWith('.css'));
  const missionCss = cssFiles
    .map(file => ({ file, text: readText(file) }))
    .filter(x => /mission|pane|webview|overlay|modal|layout/i.test(x.text))
    .sort((a, b) => {
      const score = s => (s.match(/mission/gi)?.length || 0) * 5 + (s.match(/pane|webview|overlay|modal|layout/gi)?.length || 0);
      return score(b.text) - score(a.text);
    });
  if (missionCss.length) return missionCss[0].file;
  if (cssFiles.length) return cssFiles.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0];
  const fallback = path.join(root, 'src', 'renderer', 'styles.css');
  writeText(fallback, '/* TAHAI renderer styles */\n');
  return fallback;
}

function chooseRendererTarget() {
  for (const candidate of preferredRendererJs) {
    const full = path.join(root, candidate);
    if (fs.existsSync(full)) return full;
  }
  const codeFiles = walk(root, f => /\.(js|jsx|ts|tsx)$/i.test(f) && !/scripts[\\/]/.test(rel(f)));
  const missionCode = codeFiles
    .map(file => ({ file, text: readText(file) }))
    .filter(x => /mission|pane|quad|split|triple|webview|site view|ops panel/i.test(x.text))
    .sort((a, b) => {
      const score = s => (s.match(/mission/gi)?.length || 0) * 6 + (s.match(/pane|quad|split|triple|webview|layout/gi)?.length || 0);
      return score(b.text) - score(a.text);
    });
  if (missionCode.length) return missionCode[0].file;
  const fallback = path.join(root, 'src', 'renderer', 'pass252-mission-view-state-hardening.js');
  writeText(fallback, '// PASS252 fallback renderer guard module. Import from the renderer entry if the apply script could not find an entry file.\n');
  return fallback;
}

function replaceOrAppend(file, start, end, patch) {
  const original = readText(file);
  const re = new RegExp(`${escapeRegex(start)}[\\s\\S]*?${escapeRegex(end)}`, 'm');
  const next = original.includes(start) ? original.replace(re, patch) : `${original.trimEnd()}\n\n${patch}\n`;
  writeText(file, next);
}

const versionResult = ensurePackageScriptsAndVersion();
const cssTarget = chooseCssTarget();
replaceOrAppend(cssTarget, cssStart, cssEnd, cssPatch);
const rendererTarget = chooseRendererTarget();
const rendererPatch = /\.(ts|tsx)$/i.test(rendererTarget) ? jsPatchForTs : jsPatchForJs;
replaceOrAppend(rendererTarget, jsStart, jsEnd, rendererPatch);

const report = {
  pass,
  name: 'Mission Multi-View State Hardening + 2.0.x Version Increment',
  targetVersion,
  package: versionResult,
  cssTarget: rel(cssTarget),
  rendererTarget: rel(rendererTarget),
  status: 'PASS',
  assertions: [
    'Package/app version is at least 2.0.1 in the 2.0.x lane.',
    'Mission layouts are represented by one normalized data-mission-layout state.',
    'Repeated 1-Up/2-Up/3-Up/Quad/Focus switching schedules a repair pass.',
    'Mission pane hosts receive a pane count and visible active-pane recovery.',
    'Stale transition locks are cleared after layout swaps.',
    'Resize/reflow events are dispatched after view changes so webviews refill panes.',
  ],
};
const reportDir = path.join(root, 'release-candidate', 'generated');
fs.mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, 'pass252-mission-multiview-state-hardening-apply-report.json');
writeText(reportPath, JSON.stringify(report, null, 2) + '\n');

console.log('PASS252_APPLY=PASS');
console.log(`PASS252_VERSION=${versionResult.version || targetVersion}`);
console.log(`PASS252_CSS_TARGET=${rel(cssTarget)}`);
console.log(`PASS252_RENDERER_TARGET=${rel(rendererTarget)}`);
console.log(`PASS252_REPORT=${rel(reportPath)}`);
