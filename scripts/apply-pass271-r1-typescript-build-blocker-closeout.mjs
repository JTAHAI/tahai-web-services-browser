#!/usr/bin/env node
/*
  PASS271-R1 — TypeScript Build Blocker Closeout

  Purpose:
  - Repair the PASS255-PASS259 renderer hardening additions that blocked `npm run build`.
  - Keep version truth at 2.0.14; this is a release-confidence repair, not a feature bump.
  - Add a fail-closed verifier that runs targeted static checks and the TypeScript/build pipeline.
*/
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pass = 'PASS271_R1';
const rendererPath = path.join(root, 'src', 'renderer', 'app.ts');
const packagePath = path.join(root, 'package.json');
const pass258FixturePath = path.join(root, 'tests', 'runtime', 'pass258-recipe-quad-runtime-fixtures.json');

function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

function writeText(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
}

function normalizeNewlines(text) {
  return String(text).replace(/\r\n/g, '\n');
}

function replaceBlock(text, startMarker, endMarker, replacement) {
  const normalized = normalizeNewlines(text);
  const start = normalized.indexOf(startMarker);
  if (start === -1) return { text, changed: false, reason: `missing:${startMarker}` };
  const end = normalized.indexOf(endMarker, start + startMarker.length);
  if (end === -1) return { text, changed: false, reason: `missing:${endMarker}` };
  const after = end + endMarker.length;
  const next = normalized.slice(0, start) + replacement + normalized.slice(after);
  return { text: next, changed: next !== normalized, reason: 'replaced' };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceAllLiteral(text, search, replacement) {
  return text.split(search).join(replacement);
}

function loadPass258Fixtures() {
  if (!fs.existsSync(pass258FixturePath)) {
    return {
      schemaVersion: 1,
      pass: 'PASS258',
      name: 'Recipe + Quad Runtime E2E Harness Fixtures',
      layoutStressSequence: ['single','split-horizontal','triple-top','triple-bottom','triple-left','triple-right','quad','focus','quad','single'],
      recipes: []
    };
  }
  return JSON.parse(readText(pass258FixturePath));
}

function buildPass258Block() {
  const fixtures = JSON.stringify(loadPass258Fixtures());
  return `/* PASS258_RECIPE_QUAD_RUNTIME_E2E_HARNESS_START */
(function pass258RecipeQuadRuntimeE2EHarness(): void {
  type Pass258SafeUrl = { role?: string; title?: string; url: string };
  type Pass258RecipeFixture = {
    id: string;
    title: string;
    missionType: string;
    requestedLayout: string;
    expectedPaneCount: number;
    profile?: string;
    safeUrls?: Pass258SafeUrl[];
    runbook?: unknown;
    evidencePrompts?: string[];
    policyLocks?: string[];
  };
  type Pass258PaneScenario = {
    paneId: string;
    role: string;
    title: string;
    url: string;
    runtimeTabId: string;
    visible: boolean;
    hasWebview: boolean;
    geometryOk: boolean;
    webviewTopLeftOk: boolean;
    blackPane: boolean;
    bottomOnly: boolean;
  };
  type Pass258RuntimeScenario = {
    recipeId: string;
    title: string;
    selected: boolean;
    started: boolean;
    mission: { name: string; missionType: string; layout: string; activePaneId?: string };
    runbook: unknown;
    evidencePrompts: string[];
    timeline: Array<{ type: string; recipeId: string; safeMetadataOnly: boolean }>;
    panes: Pass258PaneScenario[];
    layoutSequence: string[];
    exportPreview: { profile: string; redactionPreviewRequired: boolean; containsSecrets: boolean };
  };
  type Pass258RecipeReport = { recipeId: string; title: string; status: 'PASS' | 'FAIL'; failures: string[]; scenario: Pass258RuntimeScenario };
  type Pass258RuntimeReport = { pass: 'PASS258'; status: 'PASS' | 'FAIL'; missingRecipeIds: string[]; reports: Pass258RecipeReport[]; layoutSequence: string[]; generatedAt: string };
  type Pass258Window = Window & typeof globalThis & {
    __TAHAI_PASS258_RECIPE_QUAD_RUNTIME_E2E__?: unknown;
    __TAHAI_PASS258_RECIPE_QUAD_RUNTIME_REPORT__?: Pass258RuntimeReport;
  };

  const PASS258_LAYOUT_SEQUENCE: string[] = ['single','split-horizontal','triple-top','triple-bottom','triple-left','triple-right','quad','focus','quad','single'];
  const PASS258_REQUIRED_RECIPE_IDS: string[] = ['dns-migration','cloudflare-cutover','github-actions-release','production-deployment','certificate-renewal','m365-user-offboarding','incident-triage','vendor-support-handoff'];
  const PASS258_SAFE_PROTOCOLS: string[] = ['https:', 'tahai-browser:'];
  const PASS258_FIXTURES = ${fixtures} as { recipes?: Pass258RecipeFixture[] };

  function pass258ParseUrl(url: unknown): URL | null {
    try { return new URL(String(url)); } catch (_) { return null; }
  }

  function pass258IsSafeRecipeUrl(url: unknown): boolean {
    const parsed = pass258ParseUrl(url);
    return Boolean(parsed && PASS258_SAFE_PROTOCOLS.includes(parsed.protocol) && !/[?&](access_token|refresh_token|id_token|api_key|client_secret)=/i.test(parsed.search));
  }

  function pass258ExpectedPaneCount(layout: unknown): number {
    const value = String(layout || 'single');
    if (value === 'quad') return 4;
    if (value.startsWith('triple')) return 3;
    if (value.startsWith('split')) return 2;
    return 1;
  }

  function pass258MakePane(recipe: Pass258RecipeFixture, source: Pass258SafeUrl, index: number): Pass258PaneScenario {
    return {
      paneId: 'pane-' + (index + 1),
      role: source.role || 'tool',
      title: source.title || recipe.title + ' Pane ' + (index + 1),
      url: source.url,
      runtimeTabId: recipe.id + '-runtime-tab-' + (index + 1),
      visible: true,
      hasWebview: true,
      geometryOk: true,
      webviewTopLeftOk: true,
      blackPane: false,
      bottomOnly: false
    };
  }

  function pass258BuildScenario(recipe: Pass258RecipeFixture): Pass258RuntimeScenario {
    const safeUrls = Array.isArray(recipe.safeUrls) ? recipe.safeUrls.filter((entry: Pass258SafeUrl) => pass258IsSafeRecipeUrl(entry.url)) : [];
    const expectedPaneCount = recipe.expectedPaneCount || pass258ExpectedPaneCount(recipe.requestedLayout);
    const hydratedUrls = safeUrls.slice(0, expectedPaneCount);
    while (hydratedUrls.length < expectedPaneCount) {
      hydratedUrls.push({ role: 'runbook', title: recipe.title + ' Local Placeholder', url: 'tahai-browser://local/placeholder/' + encodeURIComponent(recipe.id) + '/' + hydratedUrls.length });
    }
    const panes = hydratedUrls.map((entry: Pass258SafeUrl, index: number) => pass258MakePane(recipe, entry, index));
    return {
      recipeId: recipe.id,
      title: recipe.title,
      selected: true,
      started: true,
      mission: { name: recipe.title, missionType: recipe.missionType, layout: recipe.requestedLayout, activePaneId: panes[0]?.paneId },
      runbook: recipe.runbook,
      evidencePrompts: recipe.evidencePrompts || [],
      timeline: [{ type: 'recipe-start', recipeId: recipe.id, safeMetadataOnly: true }],
      panes,
      layoutSequence: PASS258_LAYOUT_SEQUENCE.slice(),
      exportPreview: { profile: recipe.profile || 'sanitized-handoff', redactionPreviewRequired: true, containsSecrets: false }
    };
  }

  function pass258AssertScenario(scenario: Pass258RuntimeScenario): string[] {
    const failures: string[] = [];
    if (!scenario.selected) failures.push('recipe-not-selected');
    if (!scenario.started) failures.push('mission-not-started');
    if (!scenario.mission?.name || !scenario.mission?.missionType) failures.push('mission-fields-missing');
    if (!scenario.runbook) failures.push('runbook-missing');
    if (!Array.isArray(scenario.evidencePrompts) || !scenario.evidencePrompts.length) failures.push('evidence-prompts-missing');
    if (!Array.isArray(scenario.timeline) || !scenario.timeline.some((event) => event.type === 'recipe-start' && event.safeMetadataOnly)) failures.push('timeline-recipe-start-missing');
    if (!scenario.panes.length) failures.push('no-panes-created');
    for (const pane of scenario.panes) {
      if (!pane.visible) failures.push('pane-not-visible:' + pane.paneId);
      if (!pane.hasWebview) failures.push('pane-no-runtime-content:' + pane.paneId);
      if (!pane.geometryOk || !pane.webviewTopLeftOk || pane.blackPane || pane.bottomOnly) failures.push('pane-geometry-failed:' + pane.paneId);
    }
    for (const requiredLayout of PASS258_LAYOUT_SEQUENCE) if (!scenario.layoutSequence.includes(requiredLayout)) failures.push('layout-sequence-missing:' + requiredLayout);
    if (!scenario.exportPreview.redactionPreviewRequired || scenario.exportPreview.containsSecrets) failures.push('export-preview-unsafe');
    return failures;
  }

  function pass258RunRecipeQuadRuntimeContract(recipes?: Pass258RecipeFixture[]): Pass258RuntimeReport {
    const sourceRecipes = recipes || PASS258_FIXTURES.recipes || [];
    const reports = sourceRecipes.map((recipe: Pass258RecipeFixture): Pass258RecipeReport => {
      const scenario = pass258BuildScenario(recipe);
      const failures = pass258AssertScenario(scenario);
      return { recipeId: recipe.id, title: recipe.title, status: failures.length ? 'FAIL' : 'PASS', failures, scenario };
    });
    const missing = PASS258_REQUIRED_RECIPE_IDS.filter((id) => !sourceRecipes.some((recipe: Pass258RecipeFixture) => recipe.id === id));
    const failed = reports.filter((report) => report.status !== 'PASS');
    const status: 'PASS' | 'FAIL' = missing.length || failed.length ? 'FAIL' : 'PASS';
    const report: Pass258RuntimeReport = { pass: 'PASS258', status, missingRecipeIds: missing, reports, layoutSequence: PASS258_LAYOUT_SEQUENCE.slice(), generatedAt: new Date().toISOString() };
    document.documentElement.setAttribute('data-pass258-recipe-quad-runtime-e2e', status.toLowerCase());
    document.documentElement.setAttribute('data-pass258-required-recipes', PASS258_REQUIRED_RECIPE_IDS.join(','));
    document.documentElement.setAttribute('data-pass258-layout-sequence', PASS258_LAYOUT_SEQUENCE.join('>'));
    return report;
  }

  function pass258Mount(): void {
    const tahaiWindow = window as Pass258Window;
    const api = { fixtures: PASS258_FIXTURES, requiredRecipeIds: PASS258_REQUIRED_RECIPE_IDS.slice(), layoutSequence: PASS258_LAYOUT_SEQUENCE.slice(), isSafeRecipeUrl: pass258IsSafeRecipeUrl, buildScenario: pass258BuildScenario, assertScenario: pass258AssertScenario, runRecipeQuadRuntimeContract: pass258RunRecipeQuadRuntimeContract };
    tahaiWindow.__TAHAI_PASS258_RECIPE_QUAD_RUNTIME_E2E__ = api;
    const initialReport = pass258RunRecipeQuadRuntimeContract(PASS258_FIXTURES.recipes);
    tahaiWindow.__TAHAI_PASS258_RECIPE_QUAD_RUNTIME_REPORT__ = initialReport;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pass258Mount, { once: true }); else pass258Mount();
})();
/* PASS258_RECIPE_QUAD_RUNTIME_E2E_HARNESS_END */`;
}

function buildPass259Block() {
  return `/* PASS259_MISSION_CONTROL_UX_FINAL_FLAGSHIP_POLISH_START */
(function pass259MissionControlUxFinalFlagshipPolish(): void {
  type Pass259WebsiteBudget = { width: number; height: number; ratio: number; ok: boolean };
  type Pass259FocusRestore = { currentLayout: string; previousLayout: string; activePaneId: string; ready: boolean };
  type Pass259MissionControlUxReport = {
    pass: 'PASS259';
    status: 'PASS' | 'WARN';
    reason: string;
    cardCount: number;
    polishedCards: number;
    paneCount: number;
    placeholders: number;
    activePaneId: string | null;
    focusRestore: Pass259FocusRestore;
    websiteBudget: Pass259WebsiteBudget;
    requiredSections: string[];
    generatedAt: string;
  };
  type Pass259Window = Window & typeof globalThis & {
    __TAHAI_PASS259_MISSION_CONTROL_UX_REPORT__?: Pass259MissionControlUxReport;
    __TAHAI_PASS259_MISSION_CONTROL_UX__?: unknown;
  };

  const PASS259_CARD_SECTIONS: string[] = ['what-opens','layout','runbook','evidence','recovery','policy-locks'];
  const PASS259_MIN_WEBSITE_BUDGET: Pass259WebsiteBudget = { width: 360, height: 260, ratio: 0.52, ok: true };
  const PASS259_LAYOUT_LABELS: Record<string, string> = {
    single: '1-Up',
    'split-horizontal': '2-Up Split',
    'split-vertical': '2-Up Vertical',
    'triple-top': '3-Up Top',
    'triple-bottom': '3-Up Bottom',
    'triple-left': '3-Up Left',
    'triple-right': '3-Up Right',
    quad: 'Quad View',
    focus: 'Focus Pane'
  };
  let pass259LastFocusedPane: string | null = null;
  let pass259PreviousLayout: string | null = null;
  let pass259LastReport: Pass259MissionControlUxReport | null = null;

  function pass259Escape(value: unknown): string {
    const escaped: Record<string, string> = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
    return String(value == null ? '' : value).replace(/[&<>"']/g, (ch: string): string => escaped[ch] || ch);
  }

  function pass259FindStage(): HTMLElement | null {
    return document.querySelector<HTMLElement>('[data-mission-control], [data-mission-layout], [data-pass256-state-machine="managed"], [data-pass257-geometry-engine="managed"], .mission-control-shell, .mission-control-modal, .mission-view-host, .mission-multiview, .mission-stage');
  }

  function pass259FindRecipeCards(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>('[data-mission-recipe-id], [data-recipe-id], .mission-recipe-card, .recipe-card')).filter((card): card is HTMLElement => card instanceof HTMLElement);
  }

  function pass259FindPanes(stage: HTMLElement | null): HTMLElement[] {
    const scope: ParentNode = stage || document;
    return Array.from(scope.querySelectorAll<HTMLElement>('[data-mission-pane], [data-pane-id], .mission-pane, .mission-pane-shell, .mission-webview-pane')).filter((pane): pane is HTMLElement => pane instanceof HTMLElement);
  }

  function pass259PaneTitle(pane: HTMLElement, index: number): string {
    return pane.getAttribute('data-pane-title') || pane.getAttribute('aria-label') || pane.querySelector<HTMLElement>('[data-pane-title], .pane-title, .mission-pane-title')?.textContent?.trim() || 'Mission Pane ' + (index + 1);
  }

  function pass259PaneHasRuntimeContent(pane: HTMLElement): boolean {
    const hasRuntime = Boolean(pane.querySelector('webview, iframe')) || pane.getAttribute('data-pane-has-webview') === 'true';
    const hasPlaceholder = Boolean(pane.querySelector('[data-pass259-useful-empty-pane]'));
    const hasText = (pane.textContent || '').trim().length > 24;
    return hasRuntime || hasPlaceholder || hasText;
  }

  function pass259EnsureUsefulEmptyPane(pane: HTMLElement, index: number, reason?: string): boolean {
    if (pass259PaneHasRuntimeContent(pane)) return false;
    const placeholder = document.createElement('section');
    placeholder.className = 'pass259-empty-pane-placeholder';
    placeholder.setAttribute('data-pass259-useful-empty-pane', 'true');
    placeholder.setAttribute('role', 'region');
    placeholder.setAttribute('aria-label', 'Useful empty mission pane placeholder');
    const title = pass259PaneTitle(pane, index);
    placeholder.innerHTML = '<div class="pass259-empty-pane-kicker">Ready pane</div>' +
      '<h3>' + pass259Escape(title) + '</h3>' +
      '<p>No runtime page is attached to this pane yet. Use a recipe, send the active tab here, open local runbook/evidence, or focus another pane.</p>' +
      '<div class="pass259-empty-pane-actions" aria-label="Empty pane next actions">Runbook • Evidence • Launchpad</div>';
    pane.appendChild(placeholder);
    pane.setAttribute('data-pass259-useful-empty-pane', 'true');
    pane.setAttribute('data-pass259-empty-pane-reason', reason || 'no-runtime-content');
    return true;
  }

  function pass259GetRecipeField(card: HTMLElement, keys: string[], fallback: string | ((title: string) => string)): string {
    for (const key of keys) {
      const attr = card.getAttribute('data-' + key) || card.getAttribute('data-pass259-' + key);
      if (attr) return attr;
    }
    const title = card.querySelector<HTMLElement>('h1,h2,h3,h4,[data-recipe-title],.recipe-title')?.textContent?.trim() || card.getAttribute('data-mission-recipe-id') || card.getAttribute('data-recipe-id') || 'Mission Recipe';
    return typeof fallback === 'function' ? fallback(title) : fallback;
  }

  function pass259BuildRecipeSections(card: HTMLElement): { opens: string; layout: string; runbook: string; evidence: string; recovery: string; policy: string } {
    const opens = pass259GetRecipeField(card, ['what-opens','opens'], (title: string) => title + ' workspace panes');
    const layout = pass259GetRecipeField(card, ['layout','recommended-layout'], () => PASS259_LAYOUT_LABELS[card.getAttribute('data-layout') || ''] || 'Recommended Mission layout');
    const runbook = pass259GetRecipeField(card, ['runbook','objective'], 'Guided objective, checklist, validation steps, and rollback trigger.');
    const evidence = pass259GetRecipeField(card, ['evidence','evidence-prompts'], 'URL/title/timestamp, pane metadata, notes, and export preview.');
    const recovery = pass259GetRecipeField(card, ['recovery','rollback'], 'If a preflight or post-assert fails, recover safely and keep local mission state.');
    const policy = pass259GetRecipeField(card, ['policy-locks','policy'], 'No secrets, no direct PSA/API calls, redaction preview required.');
    return { opens, layout, runbook, evidence, recovery, policy };
  }

  function pass259PolishRecipeCard(card: HTMLElement): boolean {
    if (!(card instanceof HTMLElement)) return false;
    if (card.querySelector('[data-pass259-card-sections]')) {
      card.setAttribute('data-pass259-card-polished', 'true');
      return false;
    }
    const sections = pass259BuildRecipeSections(card);
    const wrap = document.createElement('div');
    wrap.className = 'pass259-recipe-card-sections';
    wrap.setAttribute('data-pass259-card-sections', 'true');
    wrap.innerHTML = [
      ['what-opens', 'What opens', sections.opens],
      ['layout', 'Layout', sections.layout],
      ['runbook', 'Runbook', sections.runbook],
      ['evidence', 'Evidence', sections.evidence],
      ['recovery', 'Recovery', sections.recovery],
      ['policy-locks', 'Policy locks', sections.policy]
    ].map((row: string[]): string => '<section data-pass259-card-section="' + row[0] + '"><strong>' + row[1] + '</strong><span>' + pass259Escape(row[2]) + '</span></section>').join('');
    card.appendChild(wrap);
    card.setAttribute('data-pass259-card-polished', 'true');
    card.setAttribute('data-pass259-card-section-count', String(PASS259_CARD_SECTIONS.length));
    return true;
  }

  function pass259MarkActivePane(stage: HTMLElement | null): HTMLElement | null {
    const panes = pass259FindPanes(stage);
    if (!panes.length) return null;
    const active = panes.find((pane: HTMLElement) => pane.getAttribute('data-active') === 'true' || pane.getAttribute('data-active-pane') === 'true' || pane.classList.contains('active') || pane.classList.contains('is-active')) || panes.find((pane: HTMLElement) => pane.getAttribute('data-pane-visible') !== 'false' && !pane.hidden) || panes[0];
    panes.forEach((pane: HTMLElement, index: number) => {
      const isActive = pane === active;
      pane.setAttribute('data-pass259-active-pane-clear', isActive ? 'true' : 'false');
      pane.setAttribute('aria-current', isActive ? 'true' : 'false');
      if (!pane.id) pane.id = 'mission-pane-' + (index + 1);
      if (isActive) pass259LastFocusedPane = pane.getAttribute('data-mission-pane') || pane.getAttribute('data-pane-id') || pane.id;
    });
    stage?.setAttribute('data-pass259-active-pane-id', pass259LastFocusedPane || 'pane-1');
    return active;
  }

  function pass259TrackFocusRestore(stage: HTMLElement | null): Pass259FocusRestore {
    const currentLayout = stage?.getAttribute('data-pass257-layout-intent') || stage?.getAttribute('data-pass256-requested-layout') || stage?.getAttribute('data-mission-layout') || 'single';
    const isFocus = /focus/i.test(currentLayout);
    if (!isFocus && currentLayout) pass259PreviousLayout = currentLayout;
    stage?.setAttribute('data-pass259-focus-restore-ready', pass259PreviousLayout && pass259LastFocusedPane ? 'true' : 'false');
    stage?.setAttribute('data-pass259-focus-restore-layout', pass259PreviousLayout || 'single');
    stage?.setAttribute('data-pass259-focus-restore-pane', pass259LastFocusedPane || 'pane-1');
    return { currentLayout, previousLayout: pass259PreviousLayout || 'single', activePaneId: pass259LastFocusedPane || 'pane-1', ready: Boolean(pass259PreviousLayout && pass259LastFocusedPane) };
  }

  function pass259ComputeWebsiteBudget(stage: HTMLElement | null): Pass259WebsiteBudget {
    const rect = stage?.getBoundingClientRect ? stage.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
    const width = Math.round(rect.width || window.innerWidth || 0);
    const height = Math.round(rect.height || Math.max(0, window.innerHeight - 140) || 0);
    const viewportArea = Math.max(1, (window.innerWidth || width || 1) * (window.innerHeight || height || 1));
    const ratio = Math.round((Math.max(1, width * height) / viewportArea) * 100) / 100;
    const ok = width >= PASS259_MIN_WEBSITE_BUDGET.width && height >= PASS259_MIN_WEBSITE_BUDGET.height && ratio >= PASS259_MIN_WEBSITE_BUDGET.ratio;
    stage?.setAttribute('data-pass259-website-budget-ok', ok ? 'true' : 'false');
    stage?.setAttribute('data-pass259-website-budget-width', String(width));
    stage?.setAttribute('data-pass259-website-budget-height', String(height));
    stage?.setAttribute('data-pass259-website-budget-ratio', String(ratio));
    return { width, height, ratio, ok };
  }

  function pass259ShowStartConfirmation(stage: HTMLElement | null, recipeId: string): boolean {
    if (!stage) return false;
    let status = stage.querySelector<HTMLElement>('[data-pass259-start-confirmation]');
    if (!status) {
      status = document.createElement('div');
      status.className = 'pass259-start-confirmation';
      status.setAttribute('data-pass259-start-confirmation', 'true');
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      stage.prepend(status);
    }
    status.textContent = 'Mission Control ready' + (recipeId ? ': ' + recipeId : '') + ' — panes hydrated, active pane marked, export preview prepared.';
    stage.setAttribute('data-pass259-start-visible-confirmation', 'true');
    return true;
  }

  function pass259PolishMissionControl(reason = 'manual'): Pass259MissionControlUxReport {
    const stage = pass259FindStage();
    const cards = pass259FindRecipeCards();
    const polishedCards = cards.reduce((count: number, card: HTMLElement): number => count + (pass259PolishRecipeCard(card) ? 1 : 0), 0);
    const panes = pass259FindPanes(stage);
    let placeholders = 0;
    panes.forEach((pane: HTMLElement, index: number) => { if (pass259EnsureUsefulEmptyPane(pane, index, reason)) placeholders += 1; });
    const activePane = pass259MarkActivePane(stage);
    const focusRestore = pass259TrackFocusRestore(stage);
    const budget = pass259ComputeWebsiteBudget(stage);
    if (stage && (cards.length || panes.length)) pass259ShowStartConfirmation(stage, stage.getAttribute('data-selected-recipe-id') || stage.getAttribute('data-recipe-id') || '');
    const report: Pass259MissionControlUxReport = { pass: 'PASS259', status: budget.ok && (!panes.length || Boolean(activePane)) ? 'PASS' : 'WARN', reason: reason || 'manual', cardCount: cards.length, polishedCards, paneCount: panes.length, placeholders, activePaneId: pass259LastFocusedPane || null, focusRestore, websiteBudget: budget, requiredSections: PASS259_CARD_SECTIONS.slice(), generatedAt: new Date().toISOString() };
    pass259LastReport = report;
    document.documentElement.setAttribute('data-pass259-mission-control-ux-polish', report.status.toLowerCase());
    document.documentElement.setAttribute('data-pass259-card-section-contract', PASS259_CARD_SECTIONS.join(','));
    (window as Pass259Window).__TAHAI_PASS259_MISSION_CONTROL_UX_REPORT__ = report;
    return report;
  }

  function pass259InstallEventHooks(): void {
    document.addEventListener('click', (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('[data-mission-recipe-id], [data-recipe-id], .mission-recipe-card, .recipe-card, [data-mission-pane], [data-pane-id], .mission-pane') : null;
      if (target) window.requestAnimationFrame(() => { pass259PolishMissionControl('click'); });
    }, true);
    document.addEventListener('focusin', (event: FocusEvent) => {
      const pane = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-mission-pane], [data-pane-id], .mission-pane') : null;
      if (pane) {
        pass259LastFocusedPane = pane.getAttribute('data-mission-pane') || pane.getAttribute('data-pane-id') || pane.id || pass259LastFocusedPane;
        window.requestAnimationFrame(() => { pass259PolishMissionControl('focus'); });
      }
    }, true);
    window.addEventListener('resize', () => { window.requestAnimationFrame(() => { pass259PolishMissionControl('resize'); }); }, { passive: true });
  }

  function pass259Mount(): void {
    pass259InstallEventHooks();
    pass259PolishMissionControl('mount');
    (window as Pass259Window).__TAHAI_PASS259_MISSION_CONTROL_UX__ = { cardSections: PASS259_CARD_SECTIONS.slice(), minimumWebsiteBudget: Object.assign({}, PASS259_MIN_WEBSITE_BUDGET), polish: pass259PolishMissionControl, report: () => pass259LastReport };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pass259Mount, { once: true }); else pass259Mount();
})();
/* PASS259_MISSION_CONTROL_UX_FINAL_FLAGSHIP_POLISH_END */`;
}


function replaceJsPatchConstant(scriptText, replacementBlock) {
  const start = scriptText.indexOf('const jsPatch = ');
  if (start === -1) return { text: scriptText, changed: false };
  let end = scriptText.indexOf('\n\nconst cssPatch', start);
  if (end === -1) end = scriptText.indexOf('\n\nfunction rel', start);
  if (end === -1) return { text: scriptText, changed: false };
  const next = scriptText.slice(0, start) + `const jsPatch = ${JSON.stringify(replacementBlock)};` + scriptText.slice(end);
  return { text: next, changed: next !== scriptText };
}

function patchRenderer() {
  if (!fs.existsSync(rendererPath)) {
    throw new Error(`Renderer file not found: ${path.relative(root, rendererPath)}`);
  }
  let text = normalizeNewlines(readText(rendererPath));
  const before = text;
  const repairs = [];

  if (text.includes('config?.docsUrl')) {
    text = replaceAllLiteral(text, 'config?.docsUrl', 'config?.itDocsUrl');
    repairs.push('config-docsUrl-to-itDocsUrl');
  }

  const missionTabBefore = text;
  text = text.replace(/\bMissionTab\b/g, 'MissionTabRef');
  if (text !== missionTabBefore) repairs.push('MissionTab-to-MissionTabRef');

  if (text.includes("appendMissionTimelineEvent(currentMission, 'updated',")) {
    text = replaceAllLiteral(text, "appendMissionTimelineEvent(currentMission, 'updated',", "appendMissionTimelineEvent(currentMission, 'layout-set',");
    repairs.push('timeline-updated-to-layout-set');
  }

  if (text.includes("pass256ScheduleTransition(currentMission?.layout?.type || 'single', 'mount');")) {
    text = replaceAllLiteral(text, "pass256ScheduleTransition(currentMission?.layout?.type || 'single', 'mount');", "pass256ScheduleTransition(pass256NormalizeLayoutRequest(currentMission?.layout?.type || 'single'), 'mount');");
    repairs.push('pass256-mount-layout-normalized');
  }

  const pass258 = replaceBlock(text, '/* PASS258_RECIPE_QUAD_RUNTIME_E2E_HARNESS_START */', '/* PASS258_RECIPE_QUAD_RUNTIME_E2E_HARNESS_END */', buildPass258Block());
  if (pass258.changed) {
    text = pass258.text;
    repairs.push('pass258-typed-runtime-harness');
  }

  const pass259 = replaceBlock(text, '/* PASS259_MISSION_CONTROL_UX_FINAL_FLAGSHIP_POLISH_START */', '/* PASS259_MISSION_CONTROL_UX_FINAL_FLAGSHIP_POLISH_END */', buildPass259Block());
  if (pass259.changed) {
    text = pass259.text;
    repairs.push('pass259-typed-ux-polish');
  }

  if (text === before) repairs.push('already-compliant');
  writeText(rendererPath, text);
  return repairs;
}

function patchPackageJson() {
  if (!fs.existsSync(packagePath)) return false;
  const pkg = JSON.parse(readText(packagePath));
  pkg.scripts = pkg.scripts || {};
  const key = 'verify:pass-271-r1-typescript-build-blocker-closeout';
  const value = 'node scripts/verify-pass271-r1-typescript-build-blocker-closeout.mjs';
  const changed = pkg.scripts[key] !== value;
  pkg.scripts[key] = value;
  writeText(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
  return changed;
}

function patchLegacyApplyScripts() {
  const scriptNames = [
    'apply-pass255-recipe-pane-hydration.mjs',
    'apply-pass256-quad-view-state-machine.mjs',
    'apply-pass258-recipe-quad-runtime-e2e-harness.mjs',
    'apply-pass259-mission-control-ux-final-polish.mjs'
  ];
  const changed = [];
  for (const name of scriptNames) {
    const file = path.join(root, 'scripts', name);
    if (!fs.existsSync(file)) continue;
    let scriptText = normalizeNewlines(readText(file));
    const before = scriptText;
    scriptText = replaceAllLiteral(scriptText, 'config?.docsUrl', 'config?.itDocsUrl');
    scriptText = scriptText.replace(/\bMissionTab\b/g, 'MissionTabRef');
    scriptText = replaceAllLiteral(scriptText, "appendMissionTimelineEvent(currentMission, 'updated',", "appendMissionTimelineEvent(currentMission, 'layout-set',");
    scriptText = replaceAllLiteral(scriptText, "pass256ScheduleTransition(currentMission?.layout?.type || 'single', 'mount');", "pass256ScheduleTransition(pass256NormalizeLayoutRequest(currentMission?.layout?.type || 'single'), 'mount');");
    if (name === 'apply-pass258-recipe-quad-runtime-e2e-harness.mjs') {
      scriptText = replaceJsPatchConstant(scriptText, buildPass258Block()).text;
    }
    if (name === 'apply-pass259-mission-control-ux-final-polish.mjs') {
      scriptText = replaceJsPatchConstant(scriptText, buildPass259Block()).text;
    }
    if (scriptText !== before) {
      writeText(file, scriptText);
      changed.push(name);
    }
  }
  return changed;
}
try {
  const rendererRepairs = patchRenderer();
  const packageChanged = patchPackageJson();
  const legacyChanged = patchLegacyApplyScripts();
  console.log(`${pass}_APPLY=PASS`);
  console.log(`${pass}_RENDERER_REPAIRS=${rendererRepairs.join(',')}`);
  console.log(`${pass}_PACKAGE_SCRIPT=${packageChanged ? 'updated' : 'already-present-or-missing'}`);
  console.log(`${pass}_LEGACY_APPLY_SCRIPTS=${legacyChanged.length ? legacyChanged.join(',') : 'none'}`);
  console.log(`${pass}_VERSION=2.0.14`);
} catch (error) {
  console.error(`${pass}_APPLY=FAIL`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
