#!/usr/bin/env node
/*
  PASS255 — Recipe-to-Pane Hydration Hardening + 2.0.4

  Purpose:
  - Increment 2.0.x package truth to 2.0.4 without repeated bumps on rerun.
  - Make recipe launch hydrate every visible Mission pane with a mission tab, runtime tab, role, title, URL, and fallback.
  - Prevent Quad/Tri/Split recipes from launching into blank/orphaned panes.
*/
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pass = 'PASS255';
const targetVersion = '2.0.4';
const jsStart = '/* PASS255_RECIPE_PANE_HYDRATION_START */';
const jsEnd = '/* PASS255_RECIPE_PANE_HYDRATION_END */';
const cssStart = '/* PASS255_RECIPE_PANE_HYDRATION_CSS_START */';
const cssEnd = '/* PASS255_RECIPE_PANE_HYDRATION_CSS_END */';
const jsPatch = "/* PASS255_RECIPE_PANE_HYDRATION_START */\ntype Pass255PaneBlueprint = {\n  paneId: string;\n  index: number;\n  role: MissionTabRole;\n  url: string;\n  title: string;\n  source: 'recipe' | 'fallback';\n};\n\ntype Pass255HydrationReport = {\n  recipeId: string;\n  layoutType: MissionLayoutType;\n  requiredPaneCount: number;\n  expectedPaneIds: string[];\n  missionExists: boolean;\n  tabsBefore: number;\n  tabsAfter: number;\n  runtimeMapped: number;\n  visiblePaneCount: number;\n  geometryOk: boolean;\n  repairs: string[];\n  issues: string[];\n};\n\nlet pass255RecipePaneHydrationMounted = false;\nlet pass255RecipePaneHydrationTimer: number | undefined;\n\nfunction pass255RequiredPaneCount(layoutType: MissionLayoutType | undefined): number {\n  const layout = String(layoutType || 'single').toLowerCase();\n  if (layout === 'quad') return 4;\n  if (layout.includes('triple')) return 3;\n  if (layout.includes('split')) return 2;\n  return 1;\n}\n\nfunction pass255RecipeById(recipeId: string): LaunchRecipe | undefined {\n  return premiumLaunchRecipes.find((candidate) => candidate.id === recipeId);\n}\n\nfunction pass255SafeRecipeUrls(recipe: LaunchRecipe): string[] {\n  const plan = pass90BuildRecipeLaunchPlan(recipe, 'mission');\n  if (!plan.allowed) return [];\n  return plan.urls.slice(0, 4).map((url) => normalizeTarget(url));\n}\n\nfunction pass255FallbackUrlForPane(recipe: LaunchRecipe, role: MissionTabRole, index: number): string {\n  const safeUrls = pass255SafeRecipeUrls(recipe);\n  if (safeUrls[index]) return safeUrls[index];\n  if (role === 'docs' || role === 'runbook') return normalizeTarget(config?.itDocsUrl || config?.homeUrl || 'https://tahaiportal.com');\n  if (role === 'evidence' || role === 'tool') return normalizeTarget(config?.newTabUrl || config?.homeUrl || 'https://tahaiportal.com');\n  if (safeUrls[0]) return safeUrls[0];\n  return normalizeTarget(config?.newTabUrl || config?.homeUrl || 'https://tahaiportal.com');\n}\n\nfunction pass255PaneTitleForRole(recipe: LaunchRecipe, role: MissionTabRole, index: number, url: string, source: 'recipe' | 'fallback'): string {\n  if (source === 'fallback') {\n    if (role === 'runbook') return `${recipe.label} Runbook`;\n    if (role === 'evidence') return `${recipe.label} Evidence`;\n    if (role === 'tool') return `${recipe.label} Tooling`;\n  }\n  const base = titleFromUrl(url) || missionRoleLabel(role) || `Pane ${index + 1}`;\n  return base;\n}\n\nfunction pass255BuildRecipePaneBlueprint(recipe: LaunchRecipe): Pass255PaneBlueprint[] {\n  const layoutType = recipe.missionLayout || 'single';\n  const requiredPaneCount = pass255RequiredPaneCount(layoutType);\n  const paneIds = missionVisiblePaneIds(layoutType).slice(0, requiredPaneCount);\n  const safeUrls = pass255SafeRecipeUrls(recipe);\n  const roleFallbacks: MissionTabRole[] = ['primary-console', 'logs', 'live-target', 'runbook'];\n  const blueprint: Pass255PaneBlueprint[] = [];\n  for (let index = 0; index < requiredPaneCount; index += 1) {\n    const paneId = paneIds[index] || missionPaneIds[index] || `pane-${index + 1}`;\n    const role = recipe.missionRoles?.[index] || roleFallbacks[index] || missionDefaultRole(safeUrls[index] || '');\n    const source = safeUrls[index] ? 'recipe' : 'fallback';\n    const url = source === 'recipe' ? safeUrls[index] : pass255FallbackUrlForPane(recipe, role, index);\n    blueprint.push({\n      paneId,\n      index,\n      role,\n      url,\n      title: pass255PaneTitleForRole(recipe, role, index, url, source),\n      source,\n    });\n  }\n  return blueprint;\n}\n\nfunction pass255FindMissionTabForPane(paneId: string): MissionTabRef | undefined {\n  return currentMission?.tabs.find((tab) => tab.paneId === paneId);\n}\n\nfunction pass255EnsureMissionTabRuntimeMapping(tab: MissionTabRef, paneId: string, report: Pass255HydrationReport): string {\n  let runtimeTabId = missionRuntimeTabs.get(tab.tabId) || '';\n  if (!runtimeTabId || !tabs.has(runtimeTabId)) {\n    runtimeTabId = createTab(normalizeTarget(tab.url));\n    missionRuntimeTabs.set(tab.tabId, runtimeTabId);\n    report.repairs.push(`runtime-tab-created:${paneId}`);\n  }\n  const runtimeTab = tabs.get(runtimeTabId);\n  if (runtimeTab) {\n    runtimeTab.missionPaneId = paneId;\n    runtimeTab.url = normalizeTarget(runtimeTab.url || tab.url);\n    runtimeTab.title = runtimeTab.title || tab.title || titleFromUrl(runtimeTab.url);\n  }\n  return runtimeTabId;\n}\n\nfunction pass255EnsureLayoutPaneRecord(pane: Pass255PaneBlueprint, tab: MissionTabRef, report: Pass255HydrationReport): void {\n  if (!currentMission) return;\n  if (!Array.isArray(currentMission.layout.panes)) currentMission.layout.panes = [];\n  const existing = currentMission.layout.panes.find((candidate) => candidate.paneId === pane.paneId);\n  if (existing) {\n    if (existing.tabId !== tab.tabId) {\n      existing.tabId = tab.tabId;\n      report.repairs.push(`layout-pane-tab-linked:${pane.paneId}`);\n    }\n    if (existing.role !== pane.role) existing.role = pane.role;\n    return;\n  }\n  currentMission.layout.panes.push({ paneId: pane.paneId, role: pane.role, tabId: tab.tabId });\n  report.repairs.push(`layout-pane-added:${pane.paneId}`);\n}\n\nfunction pass255EnsureMissionPaneFromBlueprint(pane: Pass255PaneBlueprint, report: Pass255HydrationReport): void {\n  if (!currentMission) return;\n  let tab = pass255FindMissionTabForPane(pane.paneId);\n  if (!tab) {\n    tab = {\n      tabId: missionUuid(),\n      role: pane.role,\n      url: pane.url,\n      title: pane.title,\n      pinned: false,\n      paneId: pane.paneId,\n    };\n    currentMission.tabs.push(tab);\n    report.repairs.push(`mission-tab-added:${pane.paneId}`);\n  } else {\n    if (!tab.url || tab.url === 'about:blank') {\n      tab.url = pane.url;\n      report.repairs.push(`blank-url-repaired:${pane.paneId}`);\n    }\n    if (!tab.title) tab.title = pane.title;\n    if (!tab.role) tab.role = pane.role;\n    tab.paneId = pane.paneId;\n  }\n  pass255EnsureMissionTabRuntimeMapping(tab, pane.paneId, report);\n  pass255EnsureLayoutPaneRecord(pane, tab, report);\n}\n\nfunction pass255EnsureRecipeRunbookEvidence(recipe: LaunchRecipe, report: Pass255HydrationReport): void {\n  if (!currentMission) return;\n  const now = new Date().toISOString();\n  if (!currentMission.runbook || !Array.isArray(currentMission.runbook.steps) || !currentMission.runbook.steps.length) {\n    currentMission.runbook = createMissionRunbookFromRecipe(recipe);\n    report.repairs.push('runbook-created');\n  }\n  if (!Array.isArray(currentMission.evidence)) currentMission.evidence = [];\n  if (!currentMission.evidence.length && Array.isArray(recipe.missionEvidencePrompts) && recipe.missionEvidencePrompts.length) {\n    currentMission.evidence = recipe.missionEvidencePrompts.map((prompt) => ({\n      eventId: missionUuid(),\n      kind: 'checklist' as MissionEvidenceKind,\n      title: prompt,\n      url: pass255SafeRecipeUrls(recipe)[0] || '',\n      createdAt: now,\n      operatorNote: 'Recipe evidence prompt. Replace with captured proof before export.',\n      metadata: { source: 'pass255-recipe-pane-hydration' },\n    }));\n    report.repairs.push('evidence-prompts-created');\n  }\n  if (!Array.isArray(currentMission.timeline)) currentMission.timeline = [];\n  if (!currentMission.timeline.some((event) => /recipe.*hydrated|hydrated.*recipe|recipe.*pane/i.test(`${event.title} ${event.detail || ''}`))) {\n    appendMissionTimelineEvent(currentMission, 'layout-set', 'Mission recipe panes hydrated', `${recipe.label} pane map verified for ${currentMission.layout.type}.`);\n    report.repairs.push('timeline-hydration-event');\n  }\n}\n\nfunction pass255MarkPaneElementHealth(element: HTMLElement, paneId: string): boolean {\n  const rect = element.getBoundingClientRect();\n  const embedded = element.querySelector('webview, iframe, .webview, .mission-webview, .site-view, browserview') as HTMLElement | null;\n  const visible = rect.width > 24 && rect.height > 24 && element.offsetParent !== null;\n  element.dataset.pass255PaneVisible = String(visible);\n  element.dataset.pass255PaneId = paneId;\n  element.dataset.pass255PaneGeometryOk = String(rect.width > 120 && rect.height > 90);\n  if (embedded) {\n    embedded.dataset.pass255WebviewTopLeftOk = 'true';\n    embedded.style.top = '0';\n    embedded.style.left = '0';\n    embedded.style.right = '0';\n    embedded.style.bottom = '0';\n    embedded.style.width = '100%';\n    embedded.style.height = '100%';\n    embedded.style.minWidth = '0';\n    embedded.style.minHeight = '0';\n    embedded.style.transform = 'none';\n    element.dataset.pass255PaneHasWebview = 'true';\n  } else {\n    element.dataset.pass255PaneHasWebview = 'false';\n  }\n  return visible && rect.width > 120 && rect.height > 90;\n}\n\nfunction pass255AssertVisiblePaneHealth(expectedPaneIds: string[], report: Pass255HydrationReport): boolean {\n  let ok = true;\n  let visibleCount = 0;\n  for (const paneId of expectedPaneIds) {\n    const selector = `[data-pane-id=\"${paneId}\"], [data-mission-pane-id=\"${paneId}\"], [data-pass252-pane-id=\"${paneId}\"], [data-pass255-pane-id=\"${paneId}\"], .mission-pane-${paneId}, #${paneId}`;\n    const element = document.querySelector(selector) as HTMLElement | null;\n    if (!element) {\n      report.issues.push(`pane-element-missing:${paneId}`);\n      ok = false;\n      continue;\n    }\n    if (pass255MarkPaneElementHealth(element, paneId)) visibleCount += 1;\n    else {\n      report.issues.push(`pane-geometry-needs-review:${paneId}`);\n      ok = false;\n    }\n  }\n  report.visiblePaneCount = visibleCount;\n  report.geometryOk = ok && visibleCount >= Math.min(expectedPaneIds.length, report.requiredPaneCount);\n  document.body.dataset.pass255VisiblePaneCount = String(visibleCount);\n  document.body.dataset.pass255ExpectedPaneCount = String(report.requiredPaneCount);\n  document.body.dataset.pass255PaneGeometryOk = String(report.geometryOk);\n  return report.geometryOk;\n}\n\nasync function pass255HydrateCurrentMissionFromRecipe(recipe: LaunchRecipe, source = 'manual'): Promise<Pass255HydrationReport> {\n  const layoutType = (currentMission?.layout?.type || recipe.missionLayout || 'single') as MissionLayoutType;\n  const blueprint = pass255BuildRecipePaneBlueprint(recipe);\n  const expectedPaneIds = blueprint.map((pane) => pane.paneId);\n  const report: Pass255HydrationReport = {\n    recipeId: recipe.id,\n    layoutType,\n    requiredPaneCount: blueprint.length,\n    expectedPaneIds,\n    missionExists: Boolean(currentMission),\n    tabsBefore: currentMission?.tabs?.length || 0,\n    tabsAfter: currentMission?.tabs?.length || 0,\n    runtimeMapped: 0,\n    visiblePaneCount: 0,\n    geometryOk: false,\n    repairs: [],\n    issues: [],\n  };\n  if (!currentMission) {\n    report.issues.push('mission-missing');\n    document.body.dataset.pass255RecipeHydrationStatus = 'mission-missing';\n    return report;\n  }\n  currentMission.layout.type = layoutType;\n  currentMission.layout.activePaneId = expectedPaneIds.includes(currentMission.layout.activePaneId) ? currentMission.layout.activePaneId : expectedPaneIds[0];\n  currentMission.tabs = currentMission.tabs.filter((tab) => !tab.paneId || expectedPaneIds.includes(tab.paneId) || currentMission?.layout?.type === 'single');\n  for (const pane of blueprint) pass255EnsureMissionPaneFromBlueprint(pane, report);\n  pass255EnsureRecipeRunbookEvidence(recipe, report);\n  syncMissionLayoutPanes();\n  for (const tab of currentMission.tabs) {\n    if (tab.paneId && expectedPaneIds.includes(tab.paneId) && missionRuntimeTabs.get(tab.tabId) && tabs.has(missionRuntimeTabs.get(tab.tabId) || '')) {\n      report.runtimeMapped += 1;\n    }\n  }\n  report.tabsAfter = currentMission.tabs.length;\n  renderMissionControl();\n  renderMissionLayout();\n  pass74ScheduleMissionPaneRelayoutRetries('pass255-recipe-pane-hydration');\n  document.dispatchEvent(new CustomEvent('mission-layout-change', { detail: { source: 'pass255', reason: source, recipeId: recipe.id, layout: layoutType } }));\n  window.dispatchEvent(new Event('resize'));\n  window.setTimeout(() => pass255AssertVisiblePaneHealth(expectedPaneIds, report), 60);\n  window.setTimeout(() => pass255AssertVisiblePaneHealth(expectedPaneIds, report), 180);\n  await window.tahaiBrowser.saveMission(currentMission);\n  document.body.dataset.pass255RecipeHydrationStatus = report.issues.length ? 'repaired-or-needs-review' : 'ok';\n  document.body.dataset.pass255LastRecipeHydrationReport = JSON.stringify({\n    recipeId: report.recipeId,\n    layoutType: report.layoutType,\n    requiredPaneCount: report.requiredPaneCount,\n    tabsBefore: report.tabsBefore,\n    tabsAfter: report.tabsAfter,\n    runtimeMapped: report.runtimeMapped,\n    repairs: report.repairs,\n    issues: report.issues,\n  });\n  setStatus('Recipe panes hydrated', `${recipe.label}: ${report.runtimeMapped}/${report.requiredPaneCount} runtime pane(s) mapped.`);\n  return report;\n}\n\nfunction pass255HydrateSelectedRecipe(reason = 'selected'): void {\n  const recipeId = document.body.dataset.pass254SelectedMissionRecipe || document.body.dataset.pass255SelectedMissionRecipe || '';\n  const recipe = recipeId ? pass255RecipeById(recipeId) : undefined;\n  if (!recipe || !currentMission) return;\n  if (pass255RecipePaneHydrationTimer) window.clearTimeout(pass255RecipePaneHydrationTimer);\n  pass255RecipePaneHydrationTimer = window.setTimeout(() => {\n    void pass255HydrateCurrentMissionFromRecipe(recipe, reason);\n  }, 35);\n}\n\nfunction pass255MountRecipePaneHydration(): void {\n  if (pass255RecipePaneHydrationMounted) return;\n  pass255RecipePaneHydrationMounted = true;\n  document.body.dataset.pass255RecipePaneHydrationMounted = 'true';\n  document.addEventListener('mission-layout-change', () => pass255HydrateSelectedRecipe('mission-layout-change'));\n  window.addEventListener('resize', () => pass255HydrateSelectedRecipe('resize'));\n  document.addEventListener('click', (event) => {\n    const target = event.target as Element | null;\n    const start = target?.closest?.('[data-pass254-start-mission-recipe-id], [data-start-mission-recipe-id]') as HTMLElement | null;\n    if (start) {\n      const recipeId = start.dataset.pass254StartMissionRecipeId || start.dataset.startMissionRecipeId || '';\n      if (recipeId) document.body.dataset.pass255SelectedMissionRecipe = recipeId;\n    }\n  }, true);\n  window.setTimeout(() => pass255HydrateSelectedRecipe('mount'), 0);\n}\n/* PASS255_RECIPE_PANE_HYDRATION_END */";
const cssPatch = "/* PASS255_RECIPE_PANE_HYDRATION_CSS_START */\n[data-pass255-pane-visible=\"true\"],\n[data-pass255-pane-geometry-ok=\"true\"] {\n  min-width: 0;\n  min-height: 0;\n}\n\n[data-pass255-pane-has-webview=\"true\"] {\n  position: relative;\n  overflow: hidden;\n  background: #05070d;\n}\n\n[data-pass255-pane-has-webview=\"true\"] webview,\n[data-pass255-pane-has-webview=\"true\"] iframe,\n[data-pass255-pane-has-webview=\"true\"] .webview,\n[data-pass255-pane-has-webview=\"true\"] .mission-webview,\n[data-pass255-pane-has-webview=\"true\"] .site-view {\n  position: absolute !important;\n  inset: 0 !important;\n  width: 100% !important;\n  height: 100% !important;\n  min-width: 0 !important;\n  min-height: 0 !important;\n  transform: none !important;\n  object-fit: fill;\n}\n\n[data-pass255-pane-has-webview=\"false\"]::after {\n  content: \"Mission pane ready\";\n  position: absolute;\n  inset: auto 0.75rem 0.75rem 0.75rem;\n  padding: 0.45rem 0.55rem;\n  border: 1px solid rgba(90, 214, 255, 0.2);\n  border-radius: 10px;\n  color: rgba(235, 246, 255, 0.82);\n  background: rgba(5, 7, 13, 0.74);\n  pointer-events: none;\n}\n\nbody[data-pass255-pane-geometry-ok=\"false\"] .mission-control,\nbody[data-pass255-recipe-hydration-status=\"repaired-or-needs-review\"] .mission-control {\n  --pass255-pane-repair-ring: 0 0 0 1px rgba(90, 214, 255, 0.22) inset;\n}\n\n.pass255-hydration-summary {\n  display: grid;\n  grid-template-columns: repeat(4, minmax(0, 1fr));\n  gap: 0.5rem;\n  margin-top: 0.6rem;\n}\n\n.pass255-hydration-summary > * {\n  min-width: 0;\n  padding: 0.55rem;\n  border-radius: 12px;\n  border: 1px solid rgba(255, 255, 255, 0.08);\n  background: rgba(255, 255, 255, 0.055);\n}\n\n@media (max-width: 980px) {\n  .pass255-hydration-summary {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n  }\n}\n\n@media (max-width: 620px) {\n  .pass255-hydration-summary {\n    grid-template-columns: minmax(0, 1fr);\n  }\n}\n/* PASS255_RECIPE_PANE_HYDRATION_CSS_END */";

const skipDirs = new Set(['.git', 'node_modules', 'dist', 'release', 'release-msix', 'out', 'coverage', '.vite', '.next', 'build']);
const preferredRenderer = [
  'src/renderer/app.ts', 'src/renderer/renderer.ts', 'src/renderer/index.ts', 'src/renderer/main.ts',
  'src/renderer/app.tsx', 'src/renderer/index.tsx', 'src/renderer/app.js', 'src/renderer/renderer.js',
  'src/renderer/index.js', 'src/renderer/main.js', 'renderer/app.js', 'renderer/renderer.js',
  'app/renderer/app.js', 'app/renderer/renderer.js',
];
const preferredCss = [
  'src/renderer/styles/browser.css', 'src/renderer/styles.css', 'src/renderer/renderer.css', 'src/renderer/app.css',
  'src/renderer/index.css', 'src/renderer/style.css', 'renderer/styles.css', 'renderer/renderer.css',
  'renderer/app.css', 'app/renderer/styles.css', 'assets/styles.css', 'public/styles.css', 'styles.css',
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
  const av = parseVersion(a); const bv = parseVersion(b);
  if (!av || !bv) return 0;
  for (const key of ['major', 'minor', 'patch']) if (av[key] !== bv[key]) return av[key] - bv[key];
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
    const rootAfter = next2Version(json.packages[''].version || before);
    if (json.packages[''].version !== rootAfter) { json.packages[''].version = rootAfter; changed = true; }
    if (packageName && json.packages[`node_modules/${packageName}`]?.version) {
      const nestedAfter = next2Version(json.packages[`node_modules/${packageName}`].version);
      if (json.packages[`node_modules/${packageName}`].version !== nestedAfter) { json.packages[`node_modules/${packageName}`].version = nestedAfter; changed = true; }
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
  const scriptName = 'verify:pass-255-recipe-pane-hydration';
  const scriptValue = 'node scripts/verify-pass255-recipe-pane-hydration.mjs';
  if (pkg.scripts[scriptName] !== scriptValue) { pkg.scripts[scriptName] = scriptValue; changed = true; }
  if (changed) writeText(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  const changes = [{ file: 'package.json', changed, before: beforeVersion, after: pkg.version }];
  for (const lock of ['package-lock.json', 'npm-shrinkwrap.json']) {
    const result = updatePackageLikeJson(path.join(root, lock), pkg.name);
    if (result) changes.push(result);
  }
  return { packageJsonFound: true, version: pkg.version, scriptName, changes };
}
function findRendererFile() {
  for (const candidate of preferredRenderer) {
    const full = path.join(root, candidate);
    if (fs.existsSync(full) && /PASS254_MISSION_RECIPE_CLICK_CONTRACT_START|startMissionFromRecipe|renderMissionRecipes|premiumLaunchRecipes/.test(readText(full))) return full;
  }
  const found = walk(root, (file) => /\.(ts|tsx|js|jsx)$/i.test(file))
    .filter((file) => /PASS254_MISSION_RECIPE_CLICK_CONTRACT_START|startMissionFromRecipe|renderMissionRecipes|premiumLaunchRecipes/.test(readText(file)));
  return found[0] || null;
}
function findCssFile() {
  for (const candidate of preferredCss) {
    const full = path.join(root, candidate);
    if (fs.existsSync(full)) return full;
  }
  const found = walk(root, (file) => /\.css$/i.test(file)).filter((file) => /mission|browser|renderer|app|style/i.test(readText(file)) || /browser|renderer|app|style/i.test(path.basename(file)));
  return found[0] || path.join(root, 'src/renderer/styles/browser.css');
}
function replaceBlock(text, start, end, block) {
  const re = new RegExp(`${escapeRegex(start)}[\\s\\S]*?${escapeRegex(end)}`);
  if (re.test(text)) return text.replace(re, block);
  return null;
}
function insertJsPatch(file) {
  let text = readText(file);
  const replaced = replaceBlock(text, jsStart, jsEnd, jsPatch);
  if (replaced !== null) { writeText(file, replaced); return { file: rel(file), changed: replaced !== text, mode: 'replaced' }; }
  const pass254End = '/* PASS254_MISSION_RECIPE_CLICK_CONTRACT_END */';
  if (text.includes(pass254End)) text = text.replace(pass254End, `${pass254End}\n\n${jsPatch}`);
  else text += '\n\n' + jsPatch + '\n';
  text = wirePass255IntoRenderer(text);
  writeText(file, text);
  return { file: rel(file), changed: true, mode: 'inserted' };
}
function wirePass255IntoRenderer(text) {
  if (text.includes("pass255HydrateCurrentMissionFromRecipe(recipe, 'pass254-start')")) return text;
  const needle = 'const report = pass254AssertRecipeHydrated(recipe, true);';
  if (text.includes(needle)) {
    text = text.replace(needle, `await pass255HydrateCurrentMissionFromRecipe(recipe, 'pass254-start');\n  ${needle}`);
  }
  if (text.includes('pass254MountMissionRecipeClickContract();') && !text.includes('pass255MountRecipePaneHydration();')) {
    text = text.replace(/pass254MountMissionRecipeClickContract\(\);/g, 'pass254MountMissionRecipeClickContract(); pass255MountRecipePaneHydration();');
  }
  if (!text.includes('pass255MountRecipePaneHydration();')) {
    text += "\nif (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', pass255MountRecipePaneHydration, { once: true }); } else { pass255MountRecipePaneHydration(); }\n";
  }
  return text;
}
function insertCssPatch(file) {
  let text = readText(file);
  const replaced = replaceBlock(text, cssStart, cssEnd, cssPatch);
  if (replaced !== null) { writeText(file, replaced); return { file: rel(file), changed: replaced !== text, mode: 'replaced' }; }
  text = text.trimEnd() + '\n\n' + cssPatch + '\n';
  writeText(file, text);
  return { file: rel(file), changed: true, mode: 'inserted' };
}

const packageResult = ensurePackageScriptsAndVersion();
const rendererFile = findRendererFile();
if (!rendererFile) {
  console.error(`${pass}_APPLY=FAIL`);
  console.error('Could not find renderer source containing Mission Recipe logic. Apply PASS254 first.');
  process.exit(1);
}
const cssFile = findCssFile();
const jsResult = insertJsPatch(rendererFile);
const cssResult = insertCssPatch(cssFile);
const reportDir = path.join(root, 'release-candidate', 'generated');
fs.mkdirSync(reportDir, { recursive: true });
const report = {
  pass,
  appliedAt: new Date().toISOString(),
  packageResult,
  renderer: jsResult,
  css: cssResult,
  storeSubmissionStatus: 'BLOCKED_UNTIL_RECIPE_QUAD_RUNTIME_SMOKE',
};
writeText(path.join(reportDir, 'pass255-recipe-pane-hydration-apply-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`${pass}_APPLY=PASS`);
console.log(`${pass}_VERSION=${packageResult.version || 'unknown'}`);
console.log(`${pass}_RENDERER_TARGET=${jsResult.file}`);
console.log(`${pass}_CSS_TARGET=${cssResult.file}`);
console.log(`${pass}_REPORT=${rel(path.join(reportDir, 'pass255-recipe-pane-hydration-apply-report.json'))}`);
