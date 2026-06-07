#!/usr/bin/env node
/* PASS259 — Mission Control UX Final Flagship Polish + 2.0.8 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pass = 'PASS259';
const targetVersion = '2.0.8';
const jsStart = '/* PASS259_MISSION_CONTROL_UX_FINAL_FLAGSHIP_POLISH_START */';
const jsEnd = '/* PASS259_MISSION_CONTROL_UX_FINAL_FLAGSHIP_POLISH_END */';
const cssStart = '/* PASS259_MISSION_CONTROL_UX_FINAL_FLAGSHIP_POLISH_CSS_START */';
const cssEnd = '/* PASS259_MISSION_CONTROL_UX_FINAL_FLAGSHIP_POLISH_CSS_END */';
const skipDirs = new Set(['.git','node_modules','dist','release','release-msix','out','coverage','.vite','.next','build']);
const rendererCandidates = ['src/renderer/app.ts','src/renderer/renderer.ts','src/renderer/index.ts','src/renderer/main.ts','src/renderer/app.tsx','src/renderer/index.tsx','src/renderer/app.js','src/renderer/renderer.js','renderer/app.js','renderer/renderer.js','app/renderer/app.js'];
const cssCandidates = ['src/renderer/styles/browser.css','src/renderer/styles.css','src/renderer/renderer.css','src/renderer/app.css','src/renderer/index.css','renderer/styles.css','renderer/renderer.css','renderer/app.css','styles.css'];
const windowBudgetPath = path.join(root, 'tests', 'runtime', 'pass259-mission-control-window-budget-fixtures.json');

const windowBudgetFixtures = {
  schemaVersion: 1,
  pass: 'PASS259',
  name: 'Mission Control UX Final Flagship Polish window budget fixtures',
  minimumWebsiteBudget: { width: 360, height: 260, ratio: 0.52 },
  windows: [
    { id: 'small-restored', width: 1024, height: 720, chromeReserveHeight: 172, sideRailReserveWidth: 256 },
    { id: 'restored-laptop', width: 1366, height: 768, chromeReserveHeight: 156, sideRailReserveWidth: 288 },
    { id: 'maximized-1080p', width: 1920, height: 1080, chromeReserveHeight: 164, sideRailReserveWidth: 320 },
    { id: 'wide-operator', width: 2560, height: 1440, chromeReserveHeight: 172, sideRailReserveWidth: 360 }
  ],
  requiredRecipeCardSections: ['what-opens', 'layout', 'runbook', 'evidence', 'recovery', 'policy-locks'],
  requiredUxFlags: ['data-pass259-card-polished', 'data-pass259-useful-empty-pane', 'data-pass259-active-pane-clear', 'data-pass259-focus-restore-ready', 'data-pass259-website-budget-ok']
};

const jsPatch = "/* PASS259_MISSION_CONTROL_UX_FINAL_FLAGSHIP_POLISH_START */\n(function pass259MissionControlUxFinalFlagshipPolish(): void {\n  type Pass259WebsiteBudget = { width: number; height: number; ratio: number; ok: boolean };\n  type Pass259FocusRestore = { currentLayout: string; previousLayout: string; activePaneId: string; ready: boolean };\n  type Pass259MissionControlUxReport = {\n    pass: 'PASS259';\n    status: 'PASS' | 'WARN';\n    reason: string;\n    cardCount: number;\n    polishedCards: number;\n    paneCount: number;\n    placeholders: number;\n    activePaneId: string | null;\n    focusRestore: Pass259FocusRestore;\n    websiteBudget: Pass259WebsiteBudget;\n    requiredSections: string[];\n    generatedAt: string;\n  };\n  type Pass259Window = Window & typeof globalThis & {\n    __TAHAI_PASS259_MISSION_CONTROL_UX_REPORT__?: Pass259MissionControlUxReport;\n    __TAHAI_PASS259_MISSION_CONTROL_UX__?: unknown;\n  };\n\n  const PASS259_CARD_SECTIONS: string[] = ['what-opens','layout','runbook','evidence','recovery','policy-locks'];\n  const PASS259_MIN_WEBSITE_BUDGET: Pass259WebsiteBudget = { width: 360, height: 260, ratio: 0.52, ok: true };\n  const PASS259_LAYOUT_LABELS: Record<string, string> = {\n    single: '1-Up',\n    'split-horizontal': '2-Up Split',\n    'split-vertical': '2-Up Vertical',\n    'triple-top': '3-Up Top',\n    'triple-bottom': '3-Up Bottom',\n    'triple-left': '3-Up Left',\n    'triple-right': '3-Up Right',\n    quad: 'Quad View',\n    focus: 'Focus Pane'\n  };\n  let pass259LastFocusedPane: string | null = null;\n  let pass259PreviousLayout: string | null = null;\n  let pass259LastReport: Pass259MissionControlUxReport | null = null;\n\n  function pass259Escape(value: unknown): string {\n    const escaped: Record<string, string> = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', \"'\":'&#39;' };\n    return String(value == null ? '' : value).replace(/[&<>\"']/g, (ch: string): string => escaped[ch] || ch);\n  }\n\n  function pass259FindStage(): HTMLElement | null {\n    return document.querySelector<HTMLElement>('[data-mission-control], [data-mission-layout], [data-pass256-state-machine=\"managed\"], [data-pass257-geometry-engine=\"managed\"], .mission-control-shell, .mission-control-modal, .mission-view-host, .mission-multiview, .mission-stage');\n  }\n\n  function pass259FindRecipeCards(): HTMLElement[] {\n    return Array.from(document.querySelectorAll<HTMLElement>('[data-mission-recipe-id], [data-recipe-id], .mission-recipe-card, .recipe-card')).filter((card): card is HTMLElement => card instanceof HTMLElement);\n  }\n\n  function pass259FindPanes(stage: HTMLElement | null): HTMLElement[] {\n    const scope: ParentNode = stage || document;\n    return Array.from(scope.querySelectorAll<HTMLElement>('[data-mission-pane], [data-pane-id], .mission-pane, .mission-pane-shell, .mission-webview-pane')).filter((pane): pane is HTMLElement => pane instanceof HTMLElement);\n  }\n\n  function pass259PaneTitle(pane: HTMLElement, index: number): string {\n    return pane.getAttribute('data-pane-title') || pane.getAttribute('aria-label') || pane.querySelector<HTMLElement>('[data-pane-title], .pane-title, .mission-pane-title')?.textContent?.trim() || 'Mission Pane ' + (index + 1);\n  }\n\n  function pass259PaneHasRuntimeContent(pane: HTMLElement): boolean {\n    const hasRuntime = Boolean(pane.querySelector('webview, iframe')) || pane.getAttribute('data-pane-has-webview') === 'true';\n    const hasPlaceholder = Boolean(pane.querySelector('[data-pass259-useful-empty-pane]'));\n    const hasText = (pane.textContent || '').trim().length > 24;\n    return hasRuntime || hasPlaceholder || hasText;\n  }\n\n  function pass259EnsureUsefulEmptyPane(pane: HTMLElement, index: number, reason?: string): boolean {\n    if (pass259PaneHasRuntimeContent(pane)) return false;\n    const placeholder = document.createElement('section');\n    placeholder.className = 'pass259-empty-pane-placeholder';\n    placeholder.setAttribute('data-pass259-useful-empty-pane', 'true');\n    placeholder.setAttribute('role', 'region');\n    placeholder.setAttribute('aria-label', 'Useful empty mission pane placeholder');\n    const title = pass259PaneTitle(pane, index);\n    placeholder.innerHTML = '<div class=\"pass259-empty-pane-kicker\">Ready pane</div>' +\n      '<h3>' + pass259Escape(title) + '</h3>' +\n      '<p>No runtime page is attached to this pane yet. Use a recipe, send the active tab here, open local runbook/evidence, or focus another pane.</p>' +\n      '<div class=\"pass259-empty-pane-actions\" aria-label=\"Empty pane next actions\">Runbook • Evidence • Launchpad</div>';\n    pane.appendChild(placeholder);\n    pane.setAttribute('data-pass259-useful-empty-pane', 'true');\n    pane.setAttribute('data-pass259-empty-pane-reason', reason || 'no-runtime-content');\n    return true;\n  }\n\n  function pass259GetRecipeField(card: HTMLElement, keys: string[], fallback: string | ((title: string) => string)): string {\n    for (const key of keys) {\n      const attr = card.getAttribute('data-' + key) || card.getAttribute('data-pass259-' + key);\n      if (attr) return attr;\n    }\n    const title = card.querySelector<HTMLElement>('h1,h2,h3,h4,[data-recipe-title],.recipe-title')?.textContent?.trim() || card.getAttribute('data-mission-recipe-id') || card.getAttribute('data-recipe-id') || 'Mission Recipe';\n    return typeof fallback === 'function' ? fallback(title) : fallback;\n  }\n\n  function pass259BuildRecipeSections(card: HTMLElement): { opens: string; layout: string; runbook: string; evidence: string; recovery: string; policy: string } {\n    const opens = pass259GetRecipeField(card, ['what-opens','opens'], (title: string) => title + ' workspace panes');\n    const layout = pass259GetRecipeField(card, ['layout','recommended-layout'], () => PASS259_LAYOUT_LABELS[card.getAttribute('data-layout') || ''] || 'Recommended Mission layout');\n    const runbook = pass259GetRecipeField(card, ['runbook','objective'], 'Guided objective, checklist, validation steps, and rollback trigger.');\n    const evidence = pass259GetRecipeField(card, ['evidence','evidence-prompts'], 'URL/title/timestamp, pane metadata, notes, and export preview.');\n    const recovery = pass259GetRecipeField(card, ['recovery','rollback'], 'If a preflight or post-assert fails, recover safely and keep local mission state.');\n    const policy = pass259GetRecipeField(card, ['policy-locks','policy'], 'No secrets, no direct PSA/API calls, redaction preview required.');\n    return { opens, layout, runbook, evidence, recovery, policy };\n  }\n\n  function pass259PolishRecipeCard(card: HTMLElement): boolean {\n    if (!(card instanceof HTMLElement)) return false;\n    if (card.querySelector('[data-pass259-card-sections]')) {\n      card.setAttribute('data-pass259-card-polished', 'true');\n      return false;\n    }\n    const sections = pass259BuildRecipeSections(card);\n    const wrap = document.createElement('div');\n    wrap.className = 'pass259-recipe-card-sections';\n    wrap.setAttribute('data-pass259-card-sections', 'true');\n    wrap.innerHTML = [\n      ['what-opens', 'What opens', sections.opens],\n      ['layout', 'Layout', sections.layout],\n      ['runbook', 'Runbook', sections.runbook],\n      ['evidence', 'Evidence', sections.evidence],\n      ['recovery', 'Recovery', sections.recovery],\n      ['policy-locks', 'Policy locks', sections.policy]\n    ].map((row: string[]): string => '<section data-pass259-card-section=\"' + row[0] + '\"><strong>' + row[1] + '</strong><span>' + pass259Escape(row[2]) + '</span></section>').join('');\n    card.appendChild(wrap);\n    card.setAttribute('data-pass259-card-polished', 'true');\n    card.setAttribute('data-pass259-card-section-count', String(PASS259_CARD_SECTIONS.length));\n    return true;\n  }\n\n  function pass259MarkActivePane(stage: HTMLElement | null): HTMLElement | null {\n    const panes = pass259FindPanes(stage);\n    if (!panes.length) return null;\n    const active = panes.find((pane: HTMLElement) => pane.getAttribute('data-active') === 'true' || pane.getAttribute('data-active-pane') === 'true' || pane.classList.contains('active') || pane.classList.contains('is-active')) || panes.find((pane: HTMLElement) => pane.getAttribute('data-pane-visible') !== 'false' && !pane.hidden) || panes[0];\n    panes.forEach((pane: HTMLElement, index: number) => {\n      const isActive = pane === active;\n      pane.setAttribute('data-pass259-active-pane-clear', isActive ? 'true' : 'false');\n      pane.setAttribute('aria-current', isActive ? 'true' : 'false');\n      if (!pane.id) pane.id = 'mission-pane-' + (index + 1);\n      if (isActive) pass259LastFocusedPane = pane.getAttribute('data-mission-pane') || pane.getAttribute('data-pane-id') || pane.id;\n    });\n    stage?.setAttribute('data-pass259-active-pane-id', pass259LastFocusedPane || 'pane-1');\n    return active;\n  }\n\n  function pass259TrackFocusRestore(stage: HTMLElement | null): Pass259FocusRestore {\n    const currentLayout = stage?.getAttribute('data-pass257-layout-intent') || stage?.getAttribute('data-pass256-requested-layout') || stage?.getAttribute('data-mission-layout') || 'single';\n    const isFocus = /focus/i.test(currentLayout);\n    if (!isFocus && currentLayout) pass259PreviousLayout = currentLayout;\n    stage?.setAttribute('data-pass259-focus-restore-ready', pass259PreviousLayout && pass259LastFocusedPane ? 'true' : 'false');\n    stage?.setAttribute('data-pass259-focus-restore-layout', pass259PreviousLayout || 'single');\n    stage?.setAttribute('data-pass259-focus-restore-pane', pass259LastFocusedPane || 'pane-1');\n    return { currentLayout, previousLayout: pass259PreviousLayout || 'single', activePaneId: pass259LastFocusedPane || 'pane-1', ready: Boolean(pass259PreviousLayout && pass259LastFocusedPane) };\n  }\n\n  function pass259ComputeWebsiteBudget(stage: HTMLElement | null): Pass259WebsiteBudget {\n    const rect = stage?.getBoundingClientRect ? stage.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };\n    const width = Math.round(rect.width || window.innerWidth || 0);\n    const height = Math.round(rect.height || Math.max(0, window.innerHeight - 140) || 0);\n    const viewportArea = Math.max(1, (window.innerWidth || width || 1) * (window.innerHeight || height || 1));\n    const ratio = Math.round((Math.max(1, width * height) / viewportArea) * 100) / 100;\n    const ok = width >= PASS259_MIN_WEBSITE_BUDGET.width && height >= PASS259_MIN_WEBSITE_BUDGET.height && ratio >= PASS259_MIN_WEBSITE_BUDGET.ratio;\n    stage?.setAttribute('data-pass259-website-budget-ok', ok ? 'true' : 'false');\n    stage?.setAttribute('data-pass259-website-budget-width', String(width));\n    stage?.setAttribute('data-pass259-website-budget-height', String(height));\n    stage?.setAttribute('data-pass259-website-budget-ratio', String(ratio));\n    return { width, height, ratio, ok };\n  }\n\n  function pass259ShowStartConfirmation(stage: HTMLElement | null, recipeId: string): boolean {\n    if (!stage) return false;\n    let status = stage.querySelector<HTMLElement>('[data-pass259-start-confirmation]');\n    if (!status) {\n      status = document.createElement('div');\n      status.className = 'pass259-start-confirmation';\n      status.setAttribute('data-pass259-start-confirmation', 'true');\n      status.setAttribute('role', 'status');\n      status.setAttribute('aria-live', 'polite');\n      stage.prepend(status);\n    }\n    status.textContent = 'Mission Control ready' + (recipeId ? ': ' + recipeId : '') + ' — panes hydrated, active pane marked, export preview prepared.';\n    stage.setAttribute('data-pass259-start-visible-confirmation', 'true');\n    return true;\n  }\n\n  function pass259PolishMissionControl(reason = 'manual'): Pass259MissionControlUxReport {\n    const stage = pass259FindStage();\n    const cards = pass259FindRecipeCards();\n    const polishedCards = cards.reduce((count: number, card: HTMLElement): number => count + (pass259PolishRecipeCard(card) ? 1 : 0), 0);\n    const panes = pass259FindPanes(stage);\n    let placeholders = 0;\n    panes.forEach((pane: HTMLElement, index: number) => { if (pass259EnsureUsefulEmptyPane(pane, index, reason)) placeholders += 1; });\n    const activePane = pass259MarkActivePane(stage);\n    const focusRestore = pass259TrackFocusRestore(stage);\n    const budget = pass259ComputeWebsiteBudget(stage);\n    if (stage && (cards.length || panes.length)) pass259ShowStartConfirmation(stage, stage.getAttribute('data-selected-recipe-id') || stage.getAttribute('data-recipe-id') || '');\n    const report: Pass259MissionControlUxReport = { pass: 'PASS259', status: budget.ok && (!panes.length || Boolean(activePane)) ? 'PASS' : 'WARN', reason: reason || 'manual', cardCount: cards.length, polishedCards, paneCount: panes.length, placeholders, activePaneId: pass259LastFocusedPane || null, focusRestore, websiteBudget: budget, requiredSections: PASS259_CARD_SECTIONS.slice(), generatedAt: new Date().toISOString() };\n    pass259LastReport = report;\n    document.documentElement.setAttribute('data-pass259-mission-control-ux-polish', report.status.toLowerCase());\n    document.documentElement.setAttribute('data-pass259-card-section-contract', PASS259_CARD_SECTIONS.join(','));\n    (window as Pass259Window).__TAHAI_PASS259_MISSION_CONTROL_UX_REPORT__ = report;\n    return report;\n  }\n\n  function pass259InstallEventHooks(): void {\n    document.addEventListener('click', (event: MouseEvent) => {\n      const target = event.target instanceof Element ? event.target.closest('[data-mission-recipe-id], [data-recipe-id], .mission-recipe-card, .recipe-card, [data-mission-pane], [data-pane-id], .mission-pane') : null;\n      if (target) window.requestAnimationFrame(() => { pass259PolishMissionControl('click'); });\n    }, true);\n    document.addEventListener('focusin', (event: FocusEvent) => {\n      const pane = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-mission-pane], [data-pane-id], .mission-pane') : null;\n      if (pane) {\n        pass259LastFocusedPane = pane.getAttribute('data-mission-pane') || pane.getAttribute('data-pane-id') || pane.id || pass259LastFocusedPane;\n        window.requestAnimationFrame(() => { pass259PolishMissionControl('focus'); });\n      }\n    }, true);\n    window.addEventListener('resize', () => { window.requestAnimationFrame(() => { pass259PolishMissionControl('resize'); }); }, { passive: true });\n  }\n\n  function pass259Mount(): void {\n    pass259InstallEventHooks();\n    pass259PolishMissionControl('mount');\n    (window as Pass259Window).__TAHAI_PASS259_MISSION_CONTROL_UX__ = { cardSections: PASS259_CARD_SECTIONS.slice(), minimumWebsiteBudget: Object.assign({}, PASS259_MIN_WEBSITE_BUDGET), polish: pass259PolishMissionControl, report: () => pass259LastReport };\n  }\n\n  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pass259Mount, { once: true }); else pass259Mount();\n})();\n/* PASS259_MISSION_CONTROL_UX_FINAL_FLAGSHIP_POLISH_END */";

const cssPatch = `${cssStart}
:root {
  --pass259-pane-accent: rgba(79, 209, 197, 0.78);
  --pass259-panel-bg: rgba(8, 12, 22, 0.82);
  --pass259-panel-border: rgba(148, 163, 184, 0.32);
}
[data-pass259-card-polished="true"], .mission-recipe-card[data-pass259-card-polished="true"], .recipe-card[data-pass259-card-polished="true"] {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}
.pass259-recipe-card-sections {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
  gap: 0.5rem;
  min-width: 0;
}
.pass259-recipe-card-sections section {
  min-width: 0;
  border: 1px solid var(--pass259-panel-border);
  border-radius: 0.75rem;
  padding: 0.55rem 0.65rem;
  background: rgba(15, 23, 42, 0.52);
}
.pass259-recipe-card-sections strong {
  display: block;
  font-size: 0.72rem;
  line-height: 1.1;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  opacity: 0.82;
  margin-bottom: 0.22rem;
}
.pass259-recipe-card-sections span {
  display: block;
  font-size: 0.82rem;
  line-height: 1.25;
  overflow-wrap: anywhere;
}
[data-pass259-active-pane-clear="true"] {
  outline: 2px solid var(--pass259-pane-accent);
  outline-offset: -2px;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.16), 0 0 0 1px rgba(79,209,197,0.28);
}
.pass259-empty-pane-placeholder {
  position: absolute;
  inset: 0;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 0.45rem;
  padding: 1rem;
  min-width: 0;
  min-height: 0;
  text-align: center;
  color: inherit;
  background: radial-gradient(circle at 50% 18%, rgba(79,209,197,0.10), transparent 42%), rgba(2, 6, 23, 0.48);
  border: 1px dashed rgba(148,163,184,0.38);
  border-radius: 0.9rem;
  overflow: hidden;
}
.pass259-empty-pane-placeholder h3 {
  margin: 0;
  max-width: 38rem;
  font-size: clamp(1rem, 1.5vw, 1.35rem);
}
.pass259-empty-pane-placeholder p {
  margin: 0;
  max-width: 42rem;
  font-size: 0.9rem;
  line-height: 1.35;
  opacity: 0.86;
}
.pass259-empty-pane-kicker, .pass259-empty-pane-actions {
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.72;
}
.pass259-start-confirmation {
  position: absolute;
  z-index: 12;
  top: 0.65rem;
  left: 50%;
  transform: translateX(-50%);
  max-width: min(56rem, calc(100% - 2rem));
  padding: 0.55rem 0.8rem;
  border: 1px solid rgba(79, 209, 197, 0.34);
  border-radius: 999px;
  background: var(--pass259-panel-bg);
  backdrop-filter: blur(10px);
  font-size: 0.84rem;
  line-height: 1.25;
  pointer-events: none;
}
[data-pass259-website-budget-ok="false"] .pass259-start-confirmation {
  border-color: rgba(251, 191, 36, 0.46);
}
@media (max-width: 1100px) {
  .pass259-recipe-card-sections { grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr)); }
  .pass259-recipe-card-sections span { font-size: 0.78rem; }
  .pass259-start-confirmation { top: 0.4rem; font-size: 0.78rem; }
}
${cssEnd}`;

function rel(file) { return path.relative(root, file).split(path.sep).join('/'); }
function readText(file) { return fs.readFileSync(file, 'utf8'); }
function writeText(file, text) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }
function walk(dir, matcher, acc = []) { let entries = []; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; } for (const entry of entries) { if (skipDirs.has(entry.name)) continue; const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full, matcher, acc); else if (matcher(full)) acc.push(full); } return acc; }
function parseVersion(v) { const m = String(v || '').match(/^(\d+)\.(\d+)\.(\d+)(.*)$/); return m ? { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) } : null; }
function versionAtLeast(actual, expected) { const a = parseVersion(actual); const e = parseVersion(expected); if (!a || !e) return false; if (a.major !== e.major) return a.major > e.major; if (a.minor !== e.minor) return a.minor > e.minor; return a.patch >= e.patch; }
function ensurePackage() { const file = path.join(root, 'package.json'); if (!fs.existsSync(file)) return { packageJsonFound: false, changes: [] }; const pkg = JSON.parse(readText(file)); const before = pkg.version; if (!versionAtLeast(pkg.version, targetVersion)) pkg.version = targetVersion; pkg.scripts = pkg.scripts || {}; pkg.scripts['verify:pass-259-mission-control-ux-final-polish'] = 'node scripts/verify-pass259-mission-control-ux-final-polish.mjs'; writeText(file, JSON.stringify(pkg, null, 2) + '\n'); return { packageJsonFound: true, version: pkg.version, scriptName: 'verify:pass-259-mission-control-ux-final-polish', changes: [{ file: 'package.json', changed: before !== pkg.version, before, after: pkg.version }] }; }
function findRendererFile() { for (const candidate of rendererCandidates) { const full = path.join(root, candidate); if (fs.existsSync(full) && readText(full).includes('PASS258_RECIPE_QUAD_RUNTIME_E2E_HARNESS_START')) return full; } const found = walk(root, (file) => /\.(ts|tsx|js|jsx)$/i.test(file)).filter((file) => readText(file).includes('PASS258_RECIPE_QUAD_RUNTIME_E2E_HARNESS_START')); return found[0] || null; }
function findCssFile() { for (const candidate of cssCandidates) { const full = path.join(root, candidate); if (fs.existsSync(full)) return full; } const found = walk(root, (file) => /\.(css|scss)$/i.test(file)); if (found[0]) return found[0]; const created = path.join(root, 'src', 'renderer', 'styles', 'pass259-mission-control-ux.css'); writeText(created, ''); return created; }
function replaceBlock(text, start, end, block) { const s = text.indexOf(start); const e = text.indexOf(end); if (s >= 0 && e > s) return text.slice(0, s) + block + text.slice(e + end.length); return null; }
function insertBlock(file, start, end, block, afterMarker) { let text = readText(file); const replaced = replaceBlock(text, start, end, block); if (replaced !== null) { writeText(file, replaced); return { file: rel(file), changed: replaced !== text, mode: 'replaced' }; } if (afterMarker && text.includes(afterMarker)) text = text.replace(afterMarker, afterMarker + '\n\n' + block); else text += '\n\n' + block + '\n'; writeText(file, text); return { file: rel(file), changed: true, mode: 'inserted' }; }

const packageResult = ensurePackage();
writeText(windowBudgetPath, JSON.stringify(windowBudgetFixtures, null, 2) + '\n');
const rendererFile = findRendererFile();
if (!rendererFile) { console.error(pass + '_APPLY=FAIL'); console.error('Could not find renderer source containing PASS258 Recipe + Quad Runtime E2E Harness. Apply PASS250-PASS258 first.'); process.exit(1); }
const cssFile = findCssFile();
const jsResult = insertBlock(rendererFile, jsStart, jsEnd, jsPatch, '/* PASS258_RECIPE_QUAD_RUNTIME_E2E_HARNESS_END */');
const cssResult = insertBlock(cssFile, cssStart, cssEnd, cssPatch, '/* PASS257_MISSION_PANE_GEOMETRY_ENGINE_CSS_END */');
const reportDir = path.join(root, 'release-candidate', 'generated');
fs.mkdirSync(reportDir, { recursive: true });
const report = { pass, appliedAt: new Date().toISOString(), packageResult, renderer: jsResult, css: cssResult, windowBudgetFixtures: rel(windowBudgetPath), storeSubmissionStatus: 'BLOCKED_UNTIL_INSTALLED_RECIPE_QUAD_RUNTIME_SMOKE', hardScope: 'Browser-side only. No IT Docs backend. No PSA connector. No direct PSA API calls. No secrets.', uxFlags: windowBudgetFixtures.requiredUxFlags, cardSections: windowBudgetFixtures.requiredRecipeCardSections };
writeText(path.join(reportDir, 'pass259-mission-control-ux-final-flagship-polish-apply-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(pass + '_APPLY=PASS');
console.log(pass + '_VERSION=' + (packageResult.version || 'unknown'));
console.log(pass + '_RENDERER_TARGET=' + jsResult.file);
console.log(pass + '_CSS_TARGET=' + cssResult.file);
console.log(pass + '_WINDOW_BUDGET_FIXTURES=' + rel(windowBudgetPath));
console.log(pass + '_REPORT=' + rel(path.join(reportDir, 'pass259-mission-control-ux-final-flagship-polish-apply-report.json')));
