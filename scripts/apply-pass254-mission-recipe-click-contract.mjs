#!/usr/bin/env node
/*
  PASS254 — Mission Recipe Click Contract Hardening + 2.0.3

  Purpose:
  - Increment 2.0.x package truth to 2.0.3 without repeated bumps on rerun.
  - Make Mission Recipe cards selectable/startable through a delegated event contract.
  - Populate preview/runbook/evidence/layout/pane intent on selection.
  - Verify and repair recipe-start hydration so clicks cannot silently do nothing.
*/
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pass = 'PASS254';
const targetVersion = '2.0.3';
const jsStart = '/* PASS254_MISSION_RECIPE_CLICK_CONTRACT_START */';
const jsEnd = '/* PASS254_MISSION_RECIPE_CLICK_CONTRACT_END */';
const cssStart = '/* PASS254_MISSION_RECIPE_CLICK_CONTRACT_CSS_START */';
const cssEnd = '/* PASS254_MISSION_RECIPE_CLICK_CONTRACT_CSS_END */';
const priorMarker = 'PASS253_MISSION_PANE_VIEWPORT_GUARD_START';

const jsPatch = "/* PASS254_MISSION_RECIPE_CLICK_CONTRACT_START */\ntype Pass254RecipeHydrationReport = {\n  recipeId: string;\n  selected: boolean;\n  started: boolean;\n  missionExists: boolean;\n  missionTypeOk: boolean;\n  runbookOk: boolean;\n  evidenceOk: boolean;\n  timelineOk: boolean;\n  tabCount: number;\n  paneCount: number;\n  requiredPaneCount: number;\n  activePaneOk: boolean;\n  repairs: string[];\n  issues: string[];\n};\n\nlet pass254MissionRecipeClickContractMounted = false;\nlet pass254MissionRecipeObserver: MutationObserver | undefined;\nlet pass254SelectedRecipeId = '';\n\nfunction pass254RequiredPaneCount(layoutType: MissionLayoutType | undefined): number {\n  const layout = String(layoutType || 'single').toLowerCase();\n  if (layout === 'quad') return 4;\n  if (layout.includes('triple')) return 3;\n  if (layout.includes('split')) return 2;\n  if (layout === 'focus') return 1;\n  return 1;\n}\n\nfunction pass254MissionRecipeById(recipeId: string): LaunchRecipe | undefined {\n  return premiumLaunchRecipes.find((candidate) => candidate.id === recipeId);\n}\n\nfunction pass254RecipeIdFromElement(element: Element | null): string {\n  let cursor: Element | null = element;\n  while (cursor) {\n    const html = cursor as HTMLElement;\n    const candidate = html.dataset.pass254RecipeId || html.dataset.startMissionRecipeId || html.dataset.recipeId || html.dataset.pass90RecipeId || '';\n    if (candidate && pass254MissionRecipeById(candidate)) return candidate;\n    cursor = cursor.parentElement;\n  }\n  return '';\n}\n\nfunction pass254RecipeFromLooseCard(card: Element): LaunchRecipe | undefined {\n  const explicit = pass254RecipeIdFromElement(card);\n  if (explicit) return pass254MissionRecipeById(explicit);\n  const text = (card.textContent || '').toLowerCase().replace(/\\s+/g, ' ').trim();\n  if (!text) return undefined;\n  return premiumLaunchRecipes.find((recipe) => text.includes(recipe.label.toLowerCase())) ||\n    premiumLaunchRecipes.find((recipe) => text.includes(recipe.id.toLowerCase().replace(/-/g, ' ')));\n}\n\nfunction pass254SafeRecipeUrls(recipe: LaunchRecipe, mode: 'mission' | 'tabs' = 'mission'): string[] {\n  const plan = pass90BuildRecipeLaunchPlan(recipe, mode);\n  return plan.allowed ? plan.urls.slice(0, 4) : [];\n}\n\nfunction pass254MissionFallbackUrl(): string {\n  return config?.newTabUrl || config?.homeUrl || 'https://tahaiportal.com';\n}\n\nfunction pass254RecipeCardSummary(recipe: LaunchRecipe): string {\n  const plan = pass90BuildRecipeLaunchPlan(recipe, 'mission');\n  const runbookCount = Array.isArray(recipe.missionRunbookSteps) ? recipe.missionRunbookSteps.length : 0;\n  const evidenceCount = Array.isArray(recipe.missionEvidencePrompts) ? recipe.missionEvidencePrompts.length : 0;\n  const paneCount = pass254RequiredPaneCount(recipe.missionLayout || 'single');\n  return [\n    `${missionLayoutLabel(recipe.missionLayout || 'single')} \u00b7 ${paneCount} pane target`,\n    `${Math.min(plan.urls.length, 4)} safe URL(s)`,\n    `${runbookCount} runbook step(s)`,\n    `${evidenceCount} evidence prompt(s)`,\n    recipe.evidenceProfile ? `Export: ${recipe.evidenceProfile}` : 'Export: mission default',\n  ].join(' \u00b7 ');\n}\n\nfunction pass254EnsureRecipeCardActions(card: HTMLElement, recipe: LaunchRecipe): void {\n  card.dataset.pass254RecipeId = recipe.id;\n  if (!card.dataset.recipeId) card.dataset.recipeId = recipe.id;\n  card.classList.add('pass254-mission-recipe-card');\n  if (!card.getAttribute('role')) card.setAttribute('role', 'button');\n  if (!card.hasAttribute('tabindex')) card.tabIndex = 0;\n  card.setAttribute('aria-label', `Mission Recipe: ${recipe.label}. Press Enter to select, or use Start Mission.`);\n\n  let detail = card.querySelector('.pass254-recipe-contract-detail') as HTMLElement | null;\n  if (!detail) {\n    detail = document.createElement('div');\n    detail.className = 'pass254-recipe-contract-detail';\n    card.appendChild(detail);\n  }\n  detail.textContent = pass254RecipeCardSummary(recipe);\n\n  let actions = card.querySelector('.pass254-recipe-actions') as HTMLElement | null;\n  if (!actions) {\n    actions = document.createElement('div');\n    actions.className = 'pass254-recipe-actions';\n    const selectButton = document.createElement('button');\n    selectButton.type = 'button';\n    selectButton.className = 'pass254-recipe-select';\n    selectButton.dataset.pass254SelectMissionRecipeId = recipe.id;\n    selectButton.textContent = 'Select recipe';\n    const startButton = document.createElement('button');\n    startButton.type = 'button';\n    startButton.className = 'pass254-recipe-start primary';\n    startButton.dataset.pass254StartMissionRecipeId = recipe.id;\n    startButton.dataset.startMissionRecipeId = recipe.id;\n    startButton.textContent = 'Start Mission';\n    actions.append(selectButton, startButton);\n    card.appendChild(actions);\n  } else {\n    actions.querySelectorAll('button').forEach((button) => {\n      const htmlButton = button as HTMLButtonElement;\n      if (htmlButton.classList.contains('pass254-recipe-start') || /start/i.test(htmlButton.textContent || '')) {\n        htmlButton.dataset.pass254StartMissionRecipeId = recipe.id;\n        htmlButton.dataset.startMissionRecipeId = recipe.id;\n      }\n      if (htmlButton.classList.contains('pass254-recipe-select') || /select|preview/i.test(htmlButton.textContent || '')) {\n        htmlButton.dataset.pass254SelectMissionRecipeId = recipe.id;\n      }\n    });\n  }\n}\n\nfunction pass254RecipeCardsInContainer(): HTMLElement[] {\n  if (!missionRecipes) return [];\n  const candidates = Array.from(missionRecipes.querySelectorAll<HTMLElement>('[data-recipe-id], [data-start-mission-recipe-id], [data-pass254-recipe-id], [data-pass254-start-mission-recipe-id], .mission-recipe-card, .recipe-card, .launch-recipe-card, button'));\n  const cards: HTMLElement[] = [];\n  const seen = new Set<HTMLElement>();\n  for (const candidate of candidates) {\n    const recipe = pass254RecipeFromLooseCard(candidate);\n    if (!recipe) continue;\n    const card = (candidate.closest('.mission-recipe-card, .recipe-card, .launch-recipe-card, [data-recipe-id], [data-pass254-recipe-id]') as HTMLElement | null) || candidate;\n    if (seen.has(card)) continue;\n    seen.add(card);\n    cards.push(card);\n  }\n  return cards;\n}\n\nfunction pass254AnnotateMissionRecipeCards(reason = 'annotate'): void {\n  if (!missionRecipes) return;\n  let count = 0;\n  for (const card of pass254RecipeCardsInContainer()) {\n    const recipe = pass254RecipeFromLooseCard(card);\n    if (!recipe) continue;\n    pass254EnsureRecipeCardActions(card, recipe);\n    count += 1;\n  }\n  if (!count && premiumLaunchRecipes.length && missionRecipes.childElementCount === 0) {\n    missionRecipes.innerHTML = premiumLaunchRecipes.map((recipe) => {\n      const plan = pass90BuildRecipeLaunchPlan(recipe, 'mission');\n      const disabled = plan.allowed ? '' : ' aria-disabled=\"true\"';\n      return `<article class=\"mission-recipe-card pass254-mission-recipe-card\" data-recipe-id=\"${escapeHtml(recipe.id)}\" data-pass254-recipe-id=\"${escapeHtml(recipe.id)}\" tabindex=\"0\" role=\"button\"${disabled}>` +\n        `<strong>${escapeHtml(recipe.label)}</strong>` +\n        `<span>${escapeHtml(recipeProviderLabel(recipe))} \u00b7 ${escapeHtml(recipePhaseLabel(recipe))}</span>` +\n        `<p>${escapeHtml(recipe.missionPrimaryAction || recipe.note || 'Start a governed Mission Control workspace.')}</p>` +\n        `</article>`;\n    }).join('');\n    pass254AnnotateMissionRecipeCards('fallback-render');\n    return;\n  }\n  missionRecipes.dataset.pass254RecipeCardCount = String(count);\n  missionRecipes.dataset.pass254LastAnnotated = reason;\n  document.body.dataset.pass254MissionRecipeCardsAnnotated = String(count);\n}\n\nfunction pass254EnsureRecipePreviewHost(): HTMLElement | null {\n  if (!missionRecipes) return null;\n  let host = document.getElementById('pass254-mission-recipe-preview') as HTMLElement | null;\n  if (!host) {\n    host = document.createElement('section');\n    host.id = 'pass254-mission-recipe-preview';\n    host.className = 'pass254-mission-recipe-preview';\n    host.setAttribute('aria-live', 'polite');\n    missionRecipes.parentElement?.insertBefore(host, missionRecipes);\n  }\n  return host;\n}\n\nfunction pass254RecipePreviewMarkup(recipe: LaunchRecipe): string {\n  const plan = pass90BuildRecipeLaunchPlan(recipe, 'mission');\n  const paneCount = pass254RequiredPaneCount(recipe.missionLayout || 'single');\n  const roles = (recipe.missionRoles || []).slice(0, paneCount).map((role, index) => `Pane ${index + 1}: ${missionRoleLabel(role)}`);\n  const fallbackRunbookSteps = Array.isArray(defaultRunbookStepLabels) ? defaultRunbookStepLabels : ['Confirm scope', 'Open required consoles', 'Capture before/after evidence', 'Document rollback condition'];\n  const runbook = (recipe.missionRunbookSteps || fallbackRunbookSteps).slice(0, 8);\n  const evidence = (recipe.missionEvidencePrompts || []).slice(0, 8);\n  const policyTags = (recipe.policyTags || []).slice(0, 8);\n  return `<div class=\"pass254-preview-header\"><strong>${escapeHtml(recipe.label)}</strong><span>${escapeHtml(recipeProviderLabel(recipe))} \u00b7 ${escapeHtml(recipePhaseLabel(recipe))}</span></div>` +\n    `<div class=\"pass254-preview-grid\">` +\n    `<p><b>Mission type</b><span>${escapeHtml(recipe.missionType || 'generic')}</span></p>` +\n    `<p><b>Layout</b><span>${escapeHtml(missionLayoutLabel(recipe.missionLayout || 'single'))}</span></p>` +\n    `<p><b>Safe URLs</b><span>${Math.min(plan.urls.length, 4)} / ${Math.max(1, paneCount)} pane target</span></p>` +\n    `<p><b>Export</b><span>${escapeHtml(recipe.evidenceProfile || 'mission default')}</span></p>` +\n    `</div>` +\n    `<p class=\"pass254-preview-action\">${escapeHtml(recipe.missionPrimaryAction || recipe.note || 'Start this recipe to populate Mission Control.')}</p>` +\n    `<div class=\"pass254-preview-lists\">` +\n    `<div><b>Pane roles</b><ul>${(roles.length ? roles : ['Pane 1: Primary Console']).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>` +\n    `<div><b>Runbook</b><ul>${runbook.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>` +\n    `<div><b>Evidence</b><ul>${(evidence.length ? evidence : ['Capture URL/title/timestamp proof before export.']).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>` +\n    `<div><b>Policy tags</b><ul>${(policyTags.length ? policyTags : ['local-only', 'no-secrets']).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>` +\n    `</div>` +\n    `<div class=\"pass254-preview-actions\"><button type=\"button\" data-pass254-start-mission-recipe-id=\"${escapeHtml(recipe.id)}\" class=\"primary\">Start Mission</button></div>`;\n}\n\nfunction pass254SelectMissionRecipe(recipeId: string, reason = 'select'): boolean {\n  const recipe = pass254MissionRecipeById(recipeId);\n  if (!recipe) return false;\n  pass254SelectedRecipeId = recipe.id;\n  if (missionTypeSelect && recipe.missionType && missionTypes.includes(recipe.missionType)) {\n    missionTypeSelect.value = recipe.missionType;\n  }\n  pass254AnnotateMissionRecipeCards(reason);\n  for (const card of pass254RecipeCardsInContainer()) {\n    const cardRecipeId = pass254RecipeIdFromElement(card);\n    const selected = cardRecipeId === recipe.id;\n    card.classList.toggle('pass254-selected-recipe', selected);\n    card.setAttribute('aria-selected', String(selected));\n  }\n  const preview = pass254EnsureRecipePreviewHost();\n  if (preview) {\n    preview.dataset.pass254SelectedRecipeId = recipe.id;\n    preview.innerHTML = pass254RecipePreviewMarkup(recipe);\n  }\n  document.body.dataset.pass254SelectedMissionRecipe = recipe.id;\n  document.body.dataset.pass254MissionRecipeClickContract = 'selected';\n  setStatus('Mission recipe selected', `${recipe.label} \u00b7 ${pass254RecipeCardSummary(recipe)}`);\n  return true;\n}\n\nfunction pass254EnsureMissionPaneHydration(recipe: LaunchRecipe, report: Pass254RecipeHydrationReport): void {\n  if (!currentMission) return;\n  const now = new Date().toISOString();\n  if (!currentMission.runbook || !Array.isArray(currentMission.runbook.steps) || !currentMission.runbook.steps.length) {\n    currentMission.runbook = createMissionRunbookFromRecipe(recipe);\n    report.repairs.push('runbook');\n  }\n  if (!Array.isArray(currentMission.evidence)) currentMission.evidence = [];\n  if (!currentMission.evidence.length && Array.isArray(recipe.missionEvidencePrompts) && recipe.missionEvidencePrompts.length) {\n    currentMission.evidence = recipe.missionEvidencePrompts.map((prompt) => ({\n      eventId: missionUuid(),\n      kind: 'checklist' as MissionEvidenceKind,\n      title: prompt,\n      url: pass254SafeRecipeUrls(recipe, 'mission')[0] || '',\n      createdAt: now,\n      operatorNote: 'Recipe evidence prompt. Replace with captured proof before export.',\n      metadata: { source: 'pass254-recipe-hydration' },\n    }));\n    report.repairs.push('evidence');\n  }\n  if (!Array.isArray(currentMission.timeline)) currentMission.timeline = [];\n  if (!currentMission.timeline.some((event) => /recipe/i.test(`${event.title} ${event.detail || ''}`))) {\n    appendMissionTimelineEvent(currentMission, 'created', 'Mission recipe started', recipe.note || recipe.label);\n    report.repairs.push('timeline');\n  }\n  const requiredPaneCount = pass254RequiredPaneCount(currentMission.layout.type || recipe.missionLayout || 'single');\n  const visiblePanes = missionVisiblePaneIds(currentMission.layout.type || recipe.missionLayout || 'single').slice(0, requiredPaneCount);\n  const safeUrls = pass254SafeRecipeUrls(recipe, 'mission');\n  while (currentMission.tabs.length < requiredPaneCount) {\n    const index = currentMission.tabs.length;\n    const paneId = visiblePanes[index] || missionPaneIds[index] || 'pane-1';\n    const fallbackUrl = normalizeTarget(safeUrls[index] || pass254MissionFallbackUrl());\n    const runtimeTabId = createTab(fallbackUrl);\n    const runtimeTab = tabs.get(runtimeTabId);\n    if (runtimeTab) runtimeTab.missionPaneId = paneId;\n    const missionTabId = missionUuid();\n    currentMission.tabs.push({\n      tabId: missionTabId,\n      role: recipe.missionRoles?.[index] || missionDefaultRole(fallbackUrl),\n      url: fallbackUrl,\n      title: titleFromUrl(fallbackUrl),\n      pinned: false,\n      paneId,\n    });\n    missionRuntimeTabs.set(missionTabId, runtimeTabId);\n    report.repairs.push(`filled-pane-${paneId}`);\n  }\n  currentMission.layout.activePaneId = visiblePanes.includes(currentMission.layout.activePaneId) ? currentMission.layout.activePaneId : (visiblePanes[0] || 'pane-1');\n  syncMissionLayoutPanes();\n  renderMissionControl();\n  renderMissionLayout();\n  pass74ScheduleMissionPaneRelayoutRetries('pass254-recipe-hydration');\n  document.dispatchEvent(new CustomEvent('mission-layout-change', { detail: { source: 'pass254', recipeId: recipe.id, layout: currentMission.layout.type } }));\n  window.dispatchEvent(new Event('resize'));\n}\n\nfunction pass254AssertRecipeHydrated(recipe: LaunchRecipe, started: boolean): Pass254RecipeHydrationReport {\n  const report: Pass254RecipeHydrationReport = {\n    recipeId: recipe.id,\n    selected: pass254SelectedRecipeId === recipe.id,\n    started,\n    missionExists: Boolean(currentMission),\n    missionTypeOk: Boolean(currentMission && currentMission.missionType === (recipe.missionType || 'generic')),\n    runbookOk: Boolean(currentMission?.runbook && Array.isArray(currentMission.runbook.steps) && currentMission.runbook.steps.length > 0),\n    evidenceOk: Boolean(currentMission?.evidence && currentMission.evidence.length >= Math.min((recipe.missionEvidencePrompts || []).length, Math.max(1, (recipe.missionEvidencePrompts || []).length))),\n    timelineOk: Boolean(currentMission?.timeline?.some((event) => /recipe/i.test(`${event.title} ${event.detail || ''}`))),\n    tabCount: currentMission?.tabs?.length || 0,\n    paneCount: currentMission?.layout?.panes?.length || 0,\n    requiredPaneCount: pass254RequiredPaneCount(currentMission?.layout?.type || recipe.missionLayout || 'single'),\n    activePaneOk: Boolean(currentMission && missionVisiblePaneIds(currentMission.layout.type).includes(currentMission.layout.activePaneId)),\n    repairs: [],\n    issues: [],\n  };\n  if (!report.missionExists) report.issues.push('mission-missing');\n  if (!report.missionTypeOk) report.issues.push('mission-type-mismatch');\n  if (!report.runbookOk) report.issues.push('runbook-missing');\n  if (!report.timelineOk) report.issues.push('timeline-recipe-event-missing');\n  if (report.tabCount < report.requiredPaneCount) report.issues.push('pane-tab-underfilled');\n  if (!report.activePaneOk) report.issues.push('active-pane-not-visible');\n  if (currentMission && report.issues.length) {\n    pass254EnsureMissionPaneHydration(recipe, report);\n    report.tabCount = currentMission.tabs.length;\n    report.paneCount = currentMission.layout.panes.length;\n    report.activePaneOk = missionVisiblePaneIds(currentMission.layout.type).includes(currentMission.layout.activePaneId);\n    void window.tahaiBrowser.saveMission(currentMission);\n  }\n  document.body.dataset.pass254LastRecipeHydration = JSON.stringify({\n    recipeId: report.recipeId,\n    started: report.started,\n    issues: report.issues,\n    repairs: report.repairs,\n    tabCount: report.tabCount,\n    paneCount: report.paneCount,\n    requiredPaneCount: report.requiredPaneCount,\n  });\n  document.body.dataset.pass254MissionRecipeHydration = report.issues.length && !report.repairs.length ? 'needs-review' : 'ok';\n  return report;\n}\n\nasync function pass254StartMissionFromRecipe(recipeId: string): Promise<void> {\n  const recipe = pass254MissionRecipeById(recipeId);\n  if (!recipe) return;\n  pass254SelectMissionRecipe(recipe.id, 'start');\n  const plan = pass90BuildRecipeLaunchPlan(recipe, 'mission');\n  if (!plan.allowed) {\n    pass90BlockRecipeLaunch(plan);\n    return;\n  }\n  document.body.dataset.pass254MissionRecipeClickContract = 'starting';\n  await startMissionFromRecipe(recipe.id);\n  const report = pass254AssertRecipeHydrated(recipe, true);\n  const detail = report.repairs.length ? `Hydrated with ${report.repairs.length} repair(s).` : `Hydrated ${report.tabCount}/${report.requiredPaneCount} pane target(s).`;\n  setStatus('Mission recipe started', `${recipe.label} \u00b7 ${detail}`);\n}\n\nfunction pass254HandleMissionRecipeEvent(event: Event): void {\n  const target = event.target as Element | null;\n  if (!target) return;\n  const startElement = target.closest('[data-pass254-start-mission-recipe-id], [data-start-mission-recipe-id]') as HTMLElement | null;\n  if (startElement) {\n    const recipeId = startElement.dataset.pass254StartMissionRecipeId || startElement.dataset.startMissionRecipeId || pass254RecipeIdFromElement(startElement);\n    if (recipeId) {\n      event.preventDefault();\n      event.stopPropagation();\n      void pass254StartMissionFromRecipe(recipeId);\n      return;\n    }\n  }\n  const selectElement = target.closest('[data-pass254-select-mission-recipe-id]') as HTMLElement | null;\n  if (selectElement) {\n    const recipeId = selectElement.dataset.pass254SelectMissionRecipeId || pass254RecipeIdFromElement(selectElement);\n    if (recipeId) {\n      event.preventDefault();\n      event.stopPropagation();\n      pass254SelectMissionRecipe(recipeId, 'select-button');\n      return;\n    }\n  }\n  const recipeCard = target.closest('[data-pass254-recipe-id], [data-recipe-id], .mission-recipe-card, .recipe-card, .launch-recipe-card') as HTMLElement | null;\n  if (!recipeCard || (missionRecipes && !missionRecipes.contains(recipeCard))) return;\n  const recipeId = pass254RecipeIdFromElement(recipeCard);\n  if (!recipeId) return;\n  if (event.type === 'keydown') {\n    const key = (event as KeyboardEvent).key;\n    if (key !== 'Enter' && key !== ' ') return;\n    event.preventDefault();\n    event.stopPropagation();\n  }\n  pass254SelectMissionRecipe(recipeId, event.type);\n}\n\nfunction pass254MountMissionRecipeClickContract(): void {\n  if (pass254MissionRecipeClickContractMounted) return;\n  pass254MissionRecipeClickContractMounted = true;\n  document.body.dataset.pass254MissionRecipeClickContractMounted = 'true';\n  document.addEventListener('click', pass254HandleMissionRecipeEvent, true);\n  document.addEventListener('keydown', pass254HandleMissionRecipeEvent, true);\n  document.addEventListener('mission-layout-change', () => pass254AnnotateMissionRecipeCards('mission-layout-change'));\n  if (typeof MutationObserver !== 'undefined') {\n    pass254MissionRecipeObserver = new MutationObserver(() => pass254AnnotateMissionRecipeCards('mutation'));\n    pass254MissionRecipeObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class', 'data-recipe-id', 'data-start-mission-recipe-id'] });\n  }\n  window.setTimeout(() => pass254AnnotateMissionRecipeCards('mount'), 0);\n}\n/* PASS254_MISSION_RECIPE_CLICK_CONTRACT_END */";
const cssPatch = "/* PASS254_MISSION_RECIPE_CLICK_CONTRACT_CSS_START */\n.pass254-mission-recipe-card,\n.mission-recipe-card[data-pass254-recipe-id],\n.recipe-card[data-pass254-recipe-id],\n.launch-recipe-card[data-pass254-recipe-id] {\n  position: relative;\n  min-width: 0 !important;\n  cursor: pointer;\n  outline-offset: 3px;\n}\n\n.pass254-mission-recipe-card:focus-visible,\n.pass254-selected-recipe {\n  outline: 2px solid color-mix(in srgb, currentColor 70%, transparent);\n}\n\n.pass254-selected-recipe {\n  box-shadow: 0 0 0 1px color-mix(in srgb, currentColor 28%, transparent), 0 12px 34px rgba(0,0,0,0.25);\n}\n\n.pass254-recipe-contract-detail {\n  display: block;\n  margin-top: 0.45rem;\n  font-size: 0.78rem;\n  line-height: 1.35;\n  opacity: 0.82;\n}\n\n.pass254-recipe-actions,\n.pass254-preview-actions {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 0.45rem;\n  margin-top: 0.65rem;\n  min-width: 0;\n}\n\n.pass254-recipe-actions > button,\n.pass254-preview-actions > button {\n  white-space: nowrap;\n  min-width: max-content;\n}\n\n.pass254-mission-recipe-preview {\n  display: block;\n  border: 1px solid rgba(255,255,255,0.12);\n  border-radius: 16px;\n  padding: clamp(0.75rem, 1vw, 1rem);\n  margin: 0 0 clamp(0.75rem, 1vw, 1rem);\n  background: rgba(7, 12, 24, 0.72);\n  box-shadow: 0 16px 44px rgba(0,0,0,0.22);\n  overflow: hidden;\n}\n\n.pass254-preview-header,\n.pass254-preview-grid,\n.pass254-preview-lists {\n  display: grid;\n  gap: 0.65rem;\n  min-width: 0;\n}\n\n.pass254-preview-header {\n  grid-template-columns: minmax(0, 1fr) max-content;\n  align-items: baseline;\n}\n\n.pass254-preview-grid {\n  grid-template-columns: repeat(4, minmax(0, 1fr));\n  margin-top: 0.75rem;\n}\n\n.pass254-preview-grid p,\n.pass254-preview-lists > div {\n  min-width: 0;\n  margin: 0;\n  padding: 0.65rem;\n  border-radius: 12px;\n  background: rgba(255,255,255,0.055);\n}\n\n.pass254-preview-grid b,\n.pass254-preview-grid span {\n  display: block;\n}\n\n.pass254-preview-grid span {\n  opacity: 0.86;\n  margin-top: 0.18rem;\n}\n\n.pass254-preview-action {\n  margin: 0.75rem 0;\n  opacity: 0.9;\n}\n\n.pass254-preview-lists {\n  grid-template-columns: repeat(4, minmax(0, 1fr));\n}\n\n.pass254-preview-lists ul {\n  margin: 0.45rem 0 0;\n  padding-left: 1.05rem;\n}\n\n.pass254-preview-lists li {\n  margin: 0.18rem 0;\n  overflow-wrap: anywhere;\n}\n\n@media (max-width: 1180px) {\n  .pass254-preview-grid,\n  .pass254-preview-lists {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n  }\n}\n\n@media (max-width: 740px) {\n  .pass254-preview-header,\n  .pass254-preview-grid,\n  .pass254-preview-lists {\n    grid-template-columns: minmax(0, 1fr);\n  }\n}\n/* PASS254_MISSION_RECIPE_CLICK_CONTRACT_CSS_END */";

const skipDirs = new Set(['.git', 'node_modules', 'dist', 'release', 'release-msix', 'out', 'coverage', '.vite', '.next', 'build']);
const preferredRenderer = [
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
  const scriptName = 'verify:pass-254-mission-recipe-click-contract';
  const scriptValue = 'node scripts/verify-pass254-mission-recipe-click-contract.mjs';
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
    if (fs.existsSync(full)) return full;
  }
  const found = walk(root, (file) => /\.(ts|tsx|js|jsx)$/i.test(file) && /renderer|app|main|index/i.test(path.basename(file)))
    .map((file) => ({ file, text: readText(file) }))
    .filter(({ text }) => /startMissionFromRecipe|renderMissionRecipes|MISSION_RECIPE_LIBRARY|premiumLaunchRecipes/.test(text));
  return found[0]?.file || null;
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
  const insertionPoints = [
    'type BookmarkFolderMissionDetail',
    'function startMissionFromBookmarkFolder',
    'function pass63CanonicalMissionLayoutType',
  ];
  let inserted = false;
  for (const point of insertionPoints) {
    const index = text.indexOf(point);
    if (index > -1) {
      text = text.slice(0, index) + jsPatch + '\n\n' + text.slice(index);
      inserted = true;
      break;
    }
  }
  if (!inserted) text += '\n\n' + jsPatch + '\n';
  if (text.includes('pass90MountLaunchRecipeFailsafe();') && !text.includes('pass90MountLaunchRecipeFailsafe(); pass254MountMissionRecipeClickContract();')) {
    text = text.replace('pass90MountLaunchRecipeFailsafe();', 'pass90MountLaunchRecipeFailsafe(); pass254MountMissionRecipeClickContract();');
  } else if (!/pass254MountMissionRecipeClickContract\(\)/.test(text.replace(jsPatch, ''))) {
    text += '\nif (document.readyState === \'loading\') { document.addEventListener(\'DOMContentLoaded\', pass254MountMissionRecipeClickContract, { once: true }); } else { pass254MountMissionRecipeClickContract(); }\n';
  }
  writeText(file, text);
  return { file: rel(file), changed: true, mode: 'inserted' };
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
  console.error('Could not find renderer source containing Mission Recipe logic.');
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
  storeSubmissionStatus: 'BLOCKED_UNTIL_RECIPE_AND_QUAD_INSTALLED_SMOKE',
};
writeText(path.join(reportDir, 'pass254-mission-recipe-click-contract-apply-report.json'), JSON.stringify(report, null, 2) + '\n');

console.log(`${pass}_APPLY=PASS`);
console.log(`${pass}_VERSION=${packageResult.version || 'unknown'}`);
console.log(`${pass}_RENDERER_TARGET=${jsResult.file}`);
console.log(`${pass}_CSS_TARGET=${cssResult.file}`);
console.log(`${pass}_REPORT=${rel(path.join(reportDir, 'pass254-mission-recipe-click-contract-apply-report.json'))}`);
