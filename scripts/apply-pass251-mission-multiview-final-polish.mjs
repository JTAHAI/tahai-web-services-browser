#!/usr/bin/env node
/*
  PASS251 — Mission Multi-View Final Polish
  Applies source-side CSS/layout hardening for Mission Control modal and pane/webview layouts.
  No generated artifacts, no installer outputs, no runtime DOM injection.
*/
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const markerStart = '/* PASS251_MISSION_MULTIVIEW_FINAL_POLISH_START */';
const markerEnd = '/* PASS251_MISSION_MULTIVIEW_FINAL_POLISH_END */';

const skipDirs = new Set(['.git', 'node_modules', 'dist', 'release', 'release-msix', 'out', 'coverage', '.vite', '.next']);
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

const cssPatch = `${markerStart}
:root {
  --pass251-mission-gap: clamp(6px, 0.55vw, 10px);
  --pass251-mission-compact-gap: clamp(4px, 0.4vw, 8px);
  --pass251-mission-control-min: 0px;
}

/* Keep Mission Control overlays centered, contained, and scrollable at restored, maximized, and ultrawide sizes. */
.mission-modal,
.mission-control-modal,
.mission-dialog,
.mission-overlay-panel,
.mission-drawer,
.mission-control-shell,
[class*="mission" i][class*="modal" i],
[class*="mission" i][class*="dialog" i],
[class*="mission" i][class*="overlay" i] {
  max-width: min(96vw, 1640px) !important;
  max-height: min(88vh, 980px) !important;
  min-width: min(92vw, 860px);
  min-height: 0 !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
  display: flex !important;
  flex-direction: column !important;
}

/* The modal body owns vertical scroll. Individual dense rails own their own horizontal overflow. */
.mission-modal-body,
.mission-control-body,
.mission-panel-body,
.mission-content,
[class*="mission" i][class*="body" i],
[class*="mission" i][class*="content" i] {
  min-height: 0 !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  overscroll-behavior: contain;
  box-sizing: border-box !important;
}

/* Stop layout tabs, active pane controls, and repair/doctor buttons from colliding. */
.mission-layout-tabs,
.mission-layout-controls,
.mission-layout-actions,
.mission-pane-controls,
.mission-pane-actions,
.mission-action-row,
.mission-toolbar-row,
.mission-tabs-toolbar,
.mission-control-toolbar,
[class*="mission" i][class*="toolbar" i],
[class*="mission" i][class*="controls" i],
[class*="mission" i][class*="actions" i] {
  min-width: 0 !important;
  max-width: 100% !important;
  display: flex !important;
  flex-wrap: wrap !important;
  align-items: center !important;
  gap: var(--pass251-mission-compact-gap) !important;
  overflow-x: auto !important;
  overflow-y: visible !important;
  scrollbar-width: thin;
  box-sizing: border-box !important;
}

/* Prevent individual action buttons/chips from becoming illegible while still allowing wrapping. */
.mission-layout-tabs > *,
.mission-layout-controls > *,
.mission-layout-actions > *,
.mission-pane-controls > *,
.mission-pane-actions > *,
.mission-action-row > *,
.mission-toolbar-row > *,
.mission-tabs-toolbar > *,
.mission-control-toolbar > *,
[class*="mission" i][class*="toolbar" i] > *,
[class*="mission" i][class*="controls" i] > *,
[class*="mission" i][class*="actions" i] > * {
  flex: 0 0 auto;
  max-width: 100%;
  white-space: nowrap;
}

/* Dense panes and cards must shrink inside flex/grid parents instead of forcing overlap. */
.mission-grid,
.mission-summary-grid,
.mission-cards,
.mission-card-grid,
.mission-pane-map,
.mission-pane-grid,
.mission-layout-map,
.mission-rail-grid,
.mission-control-grid,
[class*="mission" i][class*="grid" i],
[class*="mission" i][class*="cards" i] {
  min-width: 0 !important;
  min-height: 0 !important;
  max-width: 100% !important;
  gap: var(--pass251-mission-gap) !important;
  box-sizing: border-box !important;
}

.mission-card,
.mission-summary-card,
.mission-pane-card,
.mission-recipe-card,
.mission-runbook-card,
.mission-evidence-card,
.mission-timeline-card,
[class*="mission" i][class*="card" i] {
  min-width: 0 !important;
  max-width: 100% !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
}

/* Pane operation area: force a clean stacked model with enough vertical budget. */
.mission-pane-operator,
.mission-pane-routing,
.mission-pane-repair,
.mission-pane-doctor,
.mission-pane-transfer,
[class*="mission" i][class*="pane" i][class*="operator" i],
[class*="mission" i][class*="pane" i][class*="routing" i],
[class*="mission" i][class*="pane" i][class*="repair" i],
[class*="mission" i][class*="pane" i][class*="doctor" i],
[class*="mission" i][class*="pane" i][class*="transfer" i] {
  min-width: 0 !important;
  max-width: 100% !important;
  display: flex !important;
  flex-wrap: wrap !important;
  gap: var(--pass251-mission-compact-gap) !important;
  align-items: center !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
}

/* Labels, selects, and move/swap rows should wrap cleanly instead of pushing buttons under cards. */
.mission-pane-transfer select,
.mission-pane-routing select,
[class*="mission" i][class*="pane" i] select,
[class*="mission" i][class*="transfer" i] select,
[class*="mission" i][class*="routing" i] select {
  min-width: min(100%, 220px) !important;
  max-width: 100% !important;
}

/* Mission pane/webview surface: the content surface gets the budget, not the chrome/chips. */
.mission-view,
.mission-views,
.mission-viewport,
.mission-view-grid,
.mission-panes,
.mission-pane-shell,
.mission-pane,
.mission-webview-pane,
.pane-shell,
.pane,
[class*="mission" i][class*="view" i],
[class*="mission" i][class*="pane" i] {
  min-width: 0 !important;
  min-height: 0 !important;
  box-sizing: border-box !important;
}

.mission-view-grid,
.mission-panes,
.mission-pane-grid,
[class*="mission" i][class*="view" i][class*="grid" i],
[class*="mission" i][class*="pane" i][class*="grid" i] {
  display: grid;
  gap: var(--pass251-mission-gap) !important;
  overflow: hidden !important;
}

.mission-pane-shell,
.mission-pane,
.mission-webview-pane,
[class*="mission" i][class*="pane" i] {
  display: flex;
  flex-direction: column;
  overflow: hidden !important;
}

.mission-pane iframe,
.mission-pane webview,
.mission-webview-pane iframe,
.mission-webview-pane webview,
.pane iframe,
.pane webview,
[class*="mission" i][class*="pane" i] iframe,
[class*="mission" i][class*="pane" i] webview,
[class*="mission" i][class*="view" i] iframe,
[class*="mission" i][class*="view" i] webview {
  flex: 1 1 auto !important;
  width: 100% !important;
  height: 100% !important;
  min-width: 0 !important;
  min-height: 0 !important;
  display: flex !important;
  overflow: hidden !important;
}

/* The active pane marker should remain visible without stealing content budget. */
.mission-pane.is-active,
.mission-pane.active,
.mission-webview-pane.is-active,
.mission-webview-pane.active,
[class*="mission" i][class*="pane" i].is-active,
[class*="mission" i][class*="pane" i].active {
  outline-offset: -2px;
}

/* At restored widths, make the modal favor clean vertical flow over dense side-by-side squeezing. */
@media (max-width: 1180px) {
  .mission-modal,
  .mission-control-modal,
  .mission-dialog,
  .mission-overlay-panel,
  .mission-drawer,
  .mission-control-shell,
  [class*="mission" i][class*="modal" i],
  [class*="mission" i][class*="dialog" i],
  [class*="mission" i][class*="overlay" i] {
    min-width: 0 !important;
    width: min(98vw, 980px) !important;
    max-height: 90vh !important;
  }

  .mission-grid,
  .mission-summary-grid,
  .mission-card-grid,
  .mission-rail-grid,
  .mission-control-grid,
  [class*="mission" i][class*="grid" i] {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 820px) {
  .mission-layout-tabs,
  .mission-layout-controls,
  .mission-layout-actions,
  .mission-pane-controls,
  .mission-pane-actions,
  .mission-action-row,
  .mission-toolbar-row,
  .mission-tabs-toolbar,
  .mission-control-toolbar,
  [class*="mission" i][class*="toolbar" i],
  [class*="mission" i][class*="controls" i],
  [class*="mission" i][class*="actions" i] {
    flex-wrap: nowrap !important;
    overflow-x: auto !important;
    padding-bottom: 3px;
  }
}
${markerEnd}`;

function rel(p) { return path.relative(root, p).split(path.sep).join('/'); }

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

function readText(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
}

function ensurePackageScripts() {
  const pkgPath = path.join(root, 'package.json');
  if (!fs.existsSync(pkgPath)) return false;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['verify:pass-251-mission-multiview-final-polish'] = 'node scripts/verify-pass251-mission-multiview-final-polish.mjs';
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  return true;
}

function chooseCssTarget() {
  for (const candidate of preferredCss) {
    const full = path.join(root, candidate);
    if (fs.existsSync(full)) return full;
  }
  const cssFiles = walk(root, f => f.endsWith('.css'));
  const missionCss = cssFiles
    .map(f => ({ file: f, text: readText(f) }))
    .filter(x => /mission|pane|webview|overlay|modal/i.test(x.text))
    .sort((a, b) => {
      const score = s => (s.match(/mission/gi)?.length || 0) * 5 + (s.match(/pane|webview|overlay|modal/gi)?.length || 0);
      return score(b.text) - score(a.text);
    });
  if (missionCss.length) return missionCss[0].file;
  const anyCss = cssFiles.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);
  if (anyCss.length) return anyCss[0];
  const fallback = path.join(root, 'src', 'renderer', 'styles.css');
  fs.mkdirSync(path.dirname(fallback), { recursive: true });
  fs.writeFileSync(fallback, '/* TAHAI renderer styles */\n');
  return fallback;
}

function appendCssPatch(target) {
  const original = readText(target);
  const cleaned = original.includes(markerStart)
    ? original.replace(new RegExp(`${markerStart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${markerEnd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm'), cssPatch)
    : `${original.trimEnd()}\n\n${cssPatch}\n`;
  fs.writeFileSync(target, cleaned);
}

function copyDocsAndVerifier() {
  const overlayRoot = path.resolve(new URL('.', import.meta.url).pathname, '..');
  // No-op when files are already overlaid. This exists so the apply command can be rerun safely.
}

const cssTarget = chooseCssTarget();
appendCssPatch(cssTarget);
const pkgPatched = ensurePackageScripts();
copyDocsAndVerifier();

const report = {
  pass: 'PASS251',
  name: 'Mission Multi-View Final Polish',
  cssTarget: rel(cssTarget),
  packageJsonPatched: pkgPatched,
  status: 'PASS',
  notes: [
    'Mission modal overflow is source-side CSS contained.',
    'Mission toolbar/control rows wrap or horizontally scroll instead of overlapping.',
    'Mission pane/webview surfaces are forced to min-height:0/flex-fill semantics.',
    'Restored-width Mission grids collapse to one column rather than clipping controls.',
  ],
};

const reportDir = path.join(root, 'release-candidate', 'generated');
fs.mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, 'pass251-mission-multiview-final-polish-apply-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');

console.log('PASS251_APPLY=PASS');
console.log(`PASS251_CSS_TARGET=${report.cssTarget}`);
console.log(`PASS251_PACKAGE_JSON_PATCHED=${pkgPatched ? '1' : '0'}`);
console.log(`PASS251_REPORT=${rel(reportPath)}`);
