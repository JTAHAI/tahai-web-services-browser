#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appRel = 'src/renderer/app.ts';
const cssRel = 'src/renderer/styles/browser.css';
const pkgRel = 'package.json';
const pass63Marker = 'PASS 63 Tri-view asymmetry and pane drag reorder';
const pass64Marker = 'PASS 64 Tri-view repair and pane drag hardening';
const pass65Marker = 'PASS 65 Tri-view DOM typing repair';

function fail(message) {
  console.error(`PASS64_APPLY_FAIL=${message}`);
  process.exit(1);
}

function full(relPath) {
  return path.join(root, relPath);
}

function exists(relPath) {
  return fs.existsSync(full(relPath));
}

function read(relPath) {
  const filePath = full(relPath);
  if (!fs.existsSync(filePath)) fail(`missing ${relPath}`);
  return fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
}

function write(relPath, text) {
  fs.writeFileSync(full(relPath), text.replace(/\r\n/g, '\n').replace(/\r/g, '\n'), 'utf8');
}

function writeIfChanged(relPath, next) {
  const before = exists(relPath) ? read(relPath) : '';
  if (before !== next) write(relPath, next);
  return before !== next;
}

function walkFiles(dir, predicate, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'release' || entry.name === '.git') continue;
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(entryPath, predicate, results);
    else if (predicate(entryPath)) results.push(entryPath);
  }
  return results;
}

function findClosingBrace(source, openIndex) {
  let depth = 0;
  let inString = '';
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = openIndex; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];
    if (inLineComment) { if (char === '\n') inLineComment = false; continue; }
    if (inBlockComment) { if (char === '*' && next === '/') { inBlockComment = false; i += 1; } continue; }
    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (char === '\\') { escaped = true; continue; }
      if (char === inString) inString = '';
      continue;
    }
    if (char === '/' && next === '/') { inLineComment = true; i += 1; continue; }
    if (char === '/' && next === '*') { inBlockComment = true; i += 1; continue; }
    if (char === '\'' || char === '"' || char === '`') { inString = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findNamedBlock(source, name) {
  const patterns = [
    { re: new RegExp(`(^|\\n)(\\s*(?:export\\s+)?function\\s+${name}\\s*\\()`, 'm'), kind: 'function' },
    { re: new RegExp(`(^|\\n)(\\s*(?:export\\s+)?(?:const|let|var)\\s+${name}\\s*=)`, 'm'), kind: 'variable' },
  ];
  for (const pattern of patterns) {
    const match = pattern.re.exec(source);
    if (!match) continue;
    const statementStart = match.index + (match[1] ? match[1].length : 0);
    const openIndex = source.indexOf('{', match.index + match[0].length);
    if (openIndex === -1) continue;
    const closeIndex = findClosingBrace(source, openIndex);
    if (closeIndex === -1) continue;
    let endIndex = closeIndex + 1;
    if (pattern.kind === 'variable') {
      while (/\s/.test(source[endIndex] || '')) endIndex += 1;
      if (source[endIndex] === ';') endIndex += 1;
    }
    return { startIndex: statementStart, endIndex };
  }
  return null;
}

function replaceNamedBlock(source, name, replacement) {
  const range = findNamedBlock(source, name);
  if (!range) return { source, changed: false };
  return { source: source.slice(0, range.startIndex) + replacement + source.slice(range.endIndex), changed: true };
}

function extendLayoutLiterals(source) {
  let next = source;
  const singleQuotedUnion = `'triple' | 'triple-top' | 'triple-bottom' | 'triple-left' | 'triple-right'`;
  const doubleQuotedUnion = `"triple" | "triple-top" | "triple-bottom" | "triple-left" | "triple-right"`;
  const singleQuotedList = `'triple', 'triple-top', 'triple-bottom', 'triple-left', 'triple-right'`;
  const doubleQuotedList = `"triple", "triple-top", "triple-bottom", "triple-left", "triple-right"`;
  next = next.replace(/'layout-changed'/g, `'layout-set'`).replace(/"layout-changed"/g, `"layout-set"`);
  next = next.replace(/'triple'\s*\|\s*'quad'/g, `${singleQuotedUnion} | 'quad'`);
  next = next.replace(/"triple"\s*\|\s*"quad"/g, `${doubleQuotedUnion} | "quad"`);
  next = next.replace(/'triple'\s*,\s*'quad'/g, `${singleQuotedList}, 'quad'`);
  next = next.replace(/"triple"\s*,\s*"quad"/g, `${doubleQuotedList}, "quad"`);
  next = next.replace(/case 'triple':\s*case 'quad':/g, `case 'triple':\n    case 'triple-top':\n    case 'triple-bottom':\n    case 'triple-left':\n    case 'triple-right':\n    case 'quad':`);
  next = next.replace(/case "triple":\s*case "quad":/g, `case "triple":\n    case "triple-top":\n    case "triple-bottom":\n    case "triple-left":\n    case "triple-right":\n    case "quad":`);
  next = next.replace(/if \(count === 3\) return 'triple';/g, `if (count === 3) return 'triple-bottom';`);
  next = next.replace(/if \(count === 3\) return "triple";/g, `if (count === 3) return "triple-bottom";`);
  return next;
}

function upsertPackageScripts(pkg) {
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['pass62:apply'] = pkg.scripts['pass62:apply'] || 'node scripts/apply-pass62-layout-event-type-fix.mjs';
  pkg.scripts['pass63:apply'] = 'node scripts/apply-pass63-triview-pane-reorder.mjs';
  pkg.scripts['pass64:apply'] = 'node scripts/apply-pass64-triview-repair-hardening.mjs';
  pkg.scripts['verify:pass-63-triview-pane-reorder'] = 'node scripts/verify-pass-63-triview-pane-reorder.mjs';
  pkg.scripts['verify:pass-64-triview-repair-hardening'] = 'node scripts/verify-pass-64-triview-repair-hardening.mjs';
  const blockers = String(pkg.scripts['verify:release-blockers'] || '');
  if (blockers) {
    const commands = blockers.split(/\s&&\s/).map((item) => item.trim()).filter(Boolean);
    for (const command of ['npm run verify:pass-63-triview-pane-reorder', 'npm run verify:pass-64-triview-repair-hardening']) {
      if (!commands.includes(command)) commands.splice(Math.max(commands.length - 1, 0), 0, command);
    }
    pkg.scripts['verify:release-blockers'] = [...new Set(commands)].join(' && ');
  }
}

let app = extendLayoutLiterals(read(appRel));
let css = read(cssRel);
const pkg = JSON.parse(read(pkgRel));

for (const required of ['currentMission', 'syncMissionLayoutPanesForMission', 'visibleMissionPaneIds', 'missionLayoutLabel', 'appendMissionTimelineEvent', 'renderMissionControl']) {
  if (!app.includes(required)) fail(`src/renderer/app.ts missing required Mission Control symbol: ${required}`);
}

// Repair the event-type mismatch in all likely source and patch files so build and future overlays cannot drift back.
const sourceAndPatchFiles = [
  ...walkFiles(path.join(root, 'src'), (filePath) => /\.(ts|tsx|js|mjs)$/.test(filePath)),
  ...['scripts/apply-pass59-mission-pane-close-polish.mjs', 'scripts/apply-pass62-layout-event-type-fix.mjs']
    .map((relPath) => full(relPath))
    .filter((filePath) => fs.existsSync(filePath)),
];
for (const filePath of sourceAndPatchFiles) {
  const before = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const after = extendLayoutLiterals(before);
  if (after !== before) fs.writeFileSync(filePath, after.replace(/\r\n/g, '\n').replace(/\r/g, '\n'), 'utf8');
}
app = extendLayoutLiterals(read(appRel));

const visibleReplacement = `function visibleMissionPaneIds(layoutType: MissionLayoutType, activePaneId = 'pane-1'): string[] {
  switch (layoutType) {
    case 'focus':
      return [activePaneId || 'pane-1'];
    case 'single':
      return ['pane-1'];
    case 'split-horizontal':
    case 'split-vertical':
      return ['pane-1', 'pane-2'];
    case 'triple':
    case 'triple-top':
    case 'triple-bottom':
    case 'triple-left':
    case 'triple-right':
      return ['pane-1', 'pane-2', 'pane-3'];
    case 'quad':
      return ['pane-1', 'pane-2', 'pane-3', 'pane-4'];
    default:
      return ['pane-1'];
  }
}`;
let replaced = replaceNamedBlock(app, 'visibleMissionPaneIds', visibleReplacement);
app = replaced.source;

const labelReplacement = `function missionLayoutLabel(layoutType: MissionLayoutType): string {
  switch (layoutType) {
    case 'single': return '1-Up';
    case 'split-horizontal': return '2-Up Horizontal';
    case 'split-vertical': return '2-Up Vertical';
    case 'triple': return '3-Up Bottom Wide';
    case 'triple-top': return '3-Up Top Wide';
    case 'triple-bottom': return '3-Up Bottom Wide';
    case 'triple-left': return '3-Up Left Tall';
    case 'triple-right': return '3-Up Right Tall';
    case 'quad': return '4-Up Quad';
    case 'focus': return 'Focus Pane';
    case 'command': return 'Command View';
    default: return 'Mission View';
  }
}`;
replaced = replaceNamedBlock(app, 'missionLayoutLabel', labelReplacement);
app = replaced.source;

const pass64Helpers = `

// ${pass63Marker}
// ${pass64Marker}: self-contained repair for PASS63 anchor drift, event-type drift, and handle-only pane drag reorder.
// ${pass65Marker}: button drag handles use TS-safe setAttribute/type narrowing.
type Pass63TripleLayoutType = 'triple-top' | 'triple-bottom' | 'triple-left' | 'triple-right';
const pass63TripleLayoutTypes: Pass63TripleLayoutType[] = ['triple-top', 'triple-bottom', 'triple-left', 'triple-right'];
const pass63ReorderableLayoutTypes = new Set<MissionLayoutType>([
  'split-horizontal',
  'split-vertical',
  'triple',
  'triple-top',
  'triple-bottom',
  'triple-left',
  'triple-right',
  'quad',
]);
let pass63MissionPaneDragMounted = false;
let pass63MissionPaneDragSource = '';
let pass63MissionLayoutUpgradeMounted = false;
let pass64MissionPaneRefreshScheduled = false;
let pass64MissionPaneObserverMounted = false;

function pass63CanonicalMissionLayoutType(layoutType: MissionLayoutType): MissionLayoutType {
  return layoutType === 'triple' ? 'triple-bottom' : layoutType;
}

function pass63MissionLayoutSupportsReorder(layoutType: MissionLayoutType): boolean {
  return pass63ReorderableLayoutTypes.has(layoutType);
}

function pass64VisiblePaneIdsForLayout(layoutType: MissionLayoutType, activePaneId = 'pane-1'): string[] {
  switch (layoutType) {
    case 'focus': return [activePaneId || 'pane-1'];
    case 'single': return ['pane-1'];
    case 'split-horizontal':
    case 'split-vertical': return ['pane-1', 'pane-2'];
    case 'triple':
    case 'triple-top':
    case 'triple-bottom':
    case 'triple-left':
    case 'triple-right': return ['pane-1', 'pane-2', 'pane-3'];
    case 'quad': return ['pane-1', 'pane-2', 'pane-3', 'pane-4'];
    default: return ['pane-1'];
  }
}

function pass63VisiblePaneIds(): string[] {
  const mission = currentMission as any;
  if (!mission) return [];
  return pass64VisiblePaneIdsForLayout(mission.layout.type, mission.layout.activePaneId).slice(0, 4);
}

function pass63PaneTabId(paneId: string): string {
  const mission = currentMission as any;
  if (!mission) return '';
  return mission.layout.panes.find((pane: any) => pane.paneId === paneId)?.tabId ||
    mission.tabs.find((tab: any) => tab.paneId === paneId)?.tabId ||
    '';
}

function pass63EnsureLayoutPane(paneId: string): any {
  const mission = currentMission as any;
  if (!mission) return { paneId };
  let pane = mission.layout.panes.find((candidate: any) => candidate.paneId === paneId);
  if (!pane) {
    pane = { paneId };
    mission.layout.panes.push(pane);
  }
  return pane;
}

function pass63PaneIdForTab(tabId: string): string {
  const mission = currentMission as any;
  if (!mission || !tabId) return '';
  return mission.layout.panes.find((pane: any) => pane.tabId === tabId)?.paneId ||
    mission.tabs.find((tab: any) => tab.tabId === tabId)?.paneId ||
    '';
}

function pass63SwapMissionPanes(sourcePaneId: string, targetPaneId: string): void {
  const mission = currentMission as any;
  if (!mission || !sourcePaneId || !targetPaneId || sourcePaneId === targetPaneId) return;
  const layoutType = mission.layout.type as MissionLayoutType;
  if (!pass63MissionLayoutSupportsReorder(layoutType)) return;
  syncMissionLayoutPanesForMission(mission);
  const visiblePaneIds = pass63VisiblePaneIds();
  if (!visiblePaneIds.includes(sourcePaneId) || !visiblePaneIds.includes(targetPaneId)) return;

  const previousActivePaneId = mission.layout.activePaneId || 'pane-1';
  const previousActiveTabId = pass63PaneTabId(previousActivePaneId);
  const sourcePane = pass63EnsureLayoutPane(sourcePaneId);
  const targetPane = pass63EnsureLayoutPane(targetPaneId);
  const sourceTabId = pass63PaneTabId(sourcePaneId);
  const targetTabId = pass63PaneTabId(targetPaneId);

  sourcePane.tabId = targetTabId || undefined;
  targetPane.tabId = sourceTabId || undefined;
  for (const tab of mission.tabs) {
    if (sourceTabId && tab.tabId === sourceTabId) tab.paneId = targetPaneId;
    else if (targetTabId && tab.tabId === targetTabId) tab.paneId = sourcePaneId;
  }

  const activePaneAfterDrop = previousActiveTabId ? pass63PaneIdForTab(previousActiveTabId) : '';
  mission.layout.activePaneId = activePaneAfterDrop || (previousActivePaneId === sourcePaneId ? targetPaneId : previousActivePaneId === targetPaneId ? sourcePaneId : previousActivePaneId);
  appendMissionTimelineEvent(
    mission,
    'layout-set',
    'Mission panes reordered',
    'Moved ' + sourcePaneId.replace('pane-', 'Pane ') + ' to ' + targetPaneId.replace('pane-', 'Pane ') + ' in ' + missionLayoutLabel(layoutType) + '.'
  );
  renderMissionControl();
  pass64ScheduleMissionPaneRefresh();
}

function pass63SetMissionLayout(layoutType: MissionLayoutType): void {
  const mission = currentMission as any;
  if (!mission) return;
  mission.layout.type = layoutType;
  if (!mission.layout.activePaneId) mission.layout.activePaneId = 'pane-1';
  syncMissionLayoutPanesForMission(mission);
  appendMissionTimelineEvent(mission, 'layout-set', 'Mission layout set', 'Switched Mission Control to ' + missionLayoutLabel(layoutType) + '.');
  renderMissionControl();
  pass64ScheduleMissionPaneRefresh();
}

function pass63PaneIdFromElement(element: Element | null): string {
  if (!(element instanceof HTMLElement)) return '';
  const dataset = element.dataset || {};
  const explicit = dataset.pass63MissionPaneId || dataset.missionPaneId || dataset.paneId || dataset.missionPane || element.getAttribute('data-pane') || '';
  if (/^pane-[1-4]$/.test(explicit)) return explicit;
  const classPane = String(element.className || '').match(/(?:^|\\s)(?:pane|mission-pane)-([1-4])(?:\\s|$)/);
  return classPane ? 'pane-' + classPane[1] : '';
}

function pass63MissionPaneElements(): HTMLElement[] {
  const seen = new Set<HTMLElement>();
  const result: HTMLElement[] = [];
  const selectors = [
    '[data-pass63-mission-pane-id]',
    '[data-mission-pane-id]',
    '[data-pane-id]',
    '[data-mission-pane]',
    '[data-pane]',
    '.mission-pane',
    '.mission-control-pane',
    '.mission-view-pane',
    '.mission-layout-pane',
  ];
  for (const selector of selectors) {
    document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
      if (seen.has(element)) return;
      const paneId = pass63PaneIdFromElement(element);
      if (!paneId) return;
      seen.add(element);
      result.push(element);
    });
  }
  return result;
}

function pass64MissionPaneContainer(elements: HTMLElement[]): HTMLElement | null {
  if (!elements.length) return null;
  const parentCounts = new Map<HTMLElement, number>();
  for (const element of elements) {
    const parent = element.parentElement;
    if (!parent) continue;
    parentCounts.set(parent, (parentCounts.get(parent) || 0) + 1);
  }
  let winner: HTMLElement | null = null;
  let count = 0;
  parentCounts.forEach((value, key) => {
    if (value > count) { winner = key; count = value; }
  });
  return winner;
}

function pass63RefreshMissionPaneDragTargets(): void {
  const mission = currentMission as any;
  const elements = pass63MissionPaneElements();
  if (!mission) {
    elements.forEach((element) => element.classList.remove('pass63-mission-pane-reorderable'));
    return;
  }
  const canonicalLayoutType = pass63CanonicalMissionLayoutType(mission.layout.type);
  const visiblePaneIds = new Set(pass63VisiblePaneIds());
  const container = pass64MissionPaneContainer(elements);
  if (container) {
    container.setAttribute('data-pass63-mission-layout', canonicalLayoutType);
    container.setAttribute('data-pass64-mission-layout', canonicalLayoutType);
    container.classList.add('pass63-mission-layout-grid');
  }
  for (const element of elements) {
    const paneId = pass63PaneIdFromElement(element);
    const isVisible = visiblePaneIds.has(paneId);
    const canReorder = isVisible && pass63MissionLayoutSupportsReorder(mission.layout.type);
    if (paneId) element.dataset.pass63MissionPaneId = paneId;
    element.classList.toggle('pass63-mission-pane-reorderable', canReorder);
    element.removeAttribute('draggable');
    let handle = element.querySelector<HTMLButtonElement>(':scope > .mission-pane-drag-handle');
    if (canReorder && !handle) {
      handle = document.createElement('button');
      handle.setAttribute('type', 'button');
      handle.className = 'mission-pane-drag-handle';
      handle.draggable = true;
      handle.dataset.pass63DragHandle = 'true';
      handle.title = 'Drag to reorder Mission panes';
      handle.setAttribute('aria-label', 'Drag to reorder Mission pane ' + paneId.replace('pane-', ''));
      handle.textContent = '↕ Drag pane';
      element.insertAdjacentElement('afterbegin', handle);
    } else if (handle) {
      handle.draggable = canReorder;
      handle.hidden = !canReorder;
    }
  }
}

function pass63ClosestMissionPane(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>('[data-pass63-mission-pane-id]');
}

function pass64ClosestDragHandle(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>('.mission-pane-drag-handle[data-pass63-drag-handle="true"]');
}

function pass63MountMissionPaneDragReorder(): void {
  if (pass63MissionPaneDragMounted) return;
  document.addEventListener('dragstart', (event) => {
    const handle = pass64ClosestDragHandle(event.target);
    if (!handle) return;
    const pane = pass63ClosestMissionPane(handle);
    const paneId = pass63PaneIdFromElement(pane);
    const mission = currentMission as any;
    if (!mission || !pane || !paneId || !pass63MissionLayoutSupportsReorder(mission.layout.type)) return;
    pass63MissionPaneDragSource = paneId;
    pane.classList.add('pass63-mission-pane-dragging');
    event.dataTransfer?.setData('application/x-tahai-mission-pane', paneId);
    event.dataTransfer?.setData('text/plain', paneId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  });
  document.addEventListener('dragover', (event) => {
    const pane = pass63ClosestMissionPane(event.target);
    const mission = currentMission as any;
    if (!mission || !pane || !pass63MissionPaneDragSource || !pass63MissionLayoutSupportsReorder(mission.layout.type)) return;
    const targetPaneId = pass63PaneIdFromElement(pane);
    if (!targetPaneId || targetPaneId === pass63MissionPaneDragSource) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    pane.classList.add('pass63-mission-pane-drop-target');
  });
  document.addEventListener('dragleave', (event) => {
    const pane = pass63ClosestMissionPane(event.target);
    pane?.classList.remove('pass63-mission-pane-drop-target');
  });
  document.addEventListener('drop', (event) => {
    const pane = pass63ClosestMissionPane(event.target);
    const targetPaneId = pass63PaneIdFromElement(pane);
    const sourcePaneId = event.dataTransfer?.getData('application/x-tahai-mission-pane') || pass63MissionPaneDragSource;
    document.querySelectorAll('.pass63-mission-pane-drop-target,.pass63-mission-pane-dragging').forEach((element) => element.classList.remove('pass63-mission-pane-drop-target', 'pass63-mission-pane-dragging'));
    pass63MissionPaneDragSource = '';
    const mission = currentMission as any;
    if (!mission || !targetPaneId || !sourcePaneId || sourcePaneId === targetPaneId || !pass63MissionLayoutSupportsReorder(mission.layout.type)) return;
    event.preventDefault();
    pass63SwapMissionPanes(sourcePaneId, targetPaneId);
  });
  document.addEventListener('dragend', () => {
    pass63MissionPaneDragSource = '';
    document.querySelectorAll('.pass63-mission-pane-drop-target,.pass63-mission-pane-dragging').forEach((element) => element.classList.remove('pass63-mission-pane-drop-target', 'pass63-mission-pane-dragging'));
  });
  pass63MissionPaneDragMounted = true;
}

function pass63RefreshTriViewUpgradeControls(): void {
  const root = document.getElementById('pass63-triview-upgrade-controls');
  if (!root) return;
  const mission = currentMission as any;
  const currentType = mission ? pass63CanonicalMissionLayoutType(mission.layout.type) : '';
  root.querySelectorAll<HTMLButtonElement>('[data-pass63-triple-layout]').forEach((button) => {
    const active = button.dataset.pass63TripleLayout === currentType;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function pass63MountTriViewUpgradeControls(): void {
  if (pass63MissionLayoutUpgradeMounted) return;
  const layoutHost = document.querySelector<HTMLElement>('[data-mission-layouts], .mission-layouts, .mission-control-layouts, .mission-layout-buttons, #mission-layouts');
  if (!layoutHost || document.getElementById('pass63-triview-upgrade-controls')) return;
  const panel = document.createElement('section');
  panel.id = 'pass63-triview-upgrade-controls';
  panel.className = 'pass63-triview-upgrade-controls';
  panel.innerHTML = '<div class="pass63-triview-header"><strong>Tri View upgrade</strong><span>Choose wide/tall 3-pane layouts. Drag panes by the handle in 2-Up, 3-Up, or 4-Up to reorder without losing active routing.</span></div><div class="pass63-triview-buttons" role="group" aria-label="Tri View layout variants"><button type="button" data-pass63-triple-layout="triple-top">Top wide</button><button type="button" data-pass63-triple-layout="triple-bottom">Bottom wide</button><button type="button" data-pass63-triple-layout="triple-left">Left tall</button><button type="button" data-pass63-triple-layout="triple-right">Right tall</button></div>';
  layoutHost.insertAdjacentElement('afterend', panel);
  panel.querySelectorAll<HTMLButtonElement>('[data-pass63-triple-layout]').forEach((button) => {
    button.addEventListener('click', () => {
      const layoutType = button.dataset.pass63TripleLayout as Pass63TripleLayoutType | undefined;
      if (!layoutType || !pass63TripleLayoutTypes.includes(layoutType)) return;
      pass63SetMissionLayout(layoutType as MissionLayoutType);
    });
  });
  pass63MissionLayoutUpgradeMounted = true;
  pass63RefreshTriViewUpgradeControls();
}

function pass64ScheduleMissionPaneRefresh(): void {
  if (pass64MissionPaneRefreshScheduled) return;
  pass64MissionPaneRefreshScheduled = true;
  window.requestAnimationFrame(() => {
    pass64MissionPaneRefreshScheduled = false;
    pass63MountMissionPaneDragReorder();
    pass63MountTriViewUpgradeControls();
    pass63RefreshTriViewUpgradeControls();
    pass63RefreshMissionPaneDragTargets();
  });
}

function pass64BootMissionPaneReorderHardening(): void {
  pass64ScheduleMissionPaneRefresh();
  if (!pass64MissionPaneObserverMounted && document.body && typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass64ScheduleMissionPaneRefresh());
    observer.observe(document.body, { childList: true, subtree: true });
    pass64MissionPaneObserverMounted = true;
  }
  window.setInterval(pass64ScheduleMissionPaneRefresh, 2000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', pass64BootMissionPaneReorderHardening, { once: true });
} else {
  pass64BootMissionPaneReorderHardening();
}
`;

if (!app.includes(pass64Marker)) {
  app = app.replace(/\n*\/\/ PASS 63 Tri-view asymmetry and pane drag reorder[\s\S]*?window\.setInterval\(\(\) => \{[\s\S]*?\}, 800\);\n*/m, '\n');
  app += pass64Helpers;
}

const cssBlock = `

/* ${pass63Marker} */
/* ${pass64Marker}: handle-only drag start, guarded drop targets, and asymmetric 3-Up layouts. */
.pass63-mission-layout-grid[data-pass63-mission-layout="triple"],
.pass63-mission-layout-grid[data-pass63-mission-layout="triple-bottom"],
.pass63-mission-layout-grid[data-pass63-mission-layout="triple-top"],
.pass63-mission-layout-grid[data-pass63-mission-layout="triple-left"],
.pass63-mission-layout-grid[data-pass63-mission-layout="triple-right"] {
  display:grid !important;
  gap:10px;
}
.pass63-mission-layout-grid[data-pass63-mission-layout="triple"],
.pass63-mission-layout-grid[data-pass63-mission-layout="triple-bottom"],
.pass63-mission-layout-grid[data-pass63-mission-layout="triple-top"] {
  grid-template-columns:minmax(0,1fr) minmax(0,1fr) !important;
  grid-template-rows:minmax(220px,1fr) minmax(220px,1fr) !important;
}
.pass63-mission-layout-grid[data-pass63-mission-layout="triple-left"],
.pass63-mission-layout-grid[data-pass63-mission-layout="triple-right"] {
  grid-template-columns:minmax(280px,1fr) minmax(280px,1fr) !important;
  grid-template-rows:minmax(0,1fr) minmax(0,1fr) !important;
}
.pass63-mission-layout-grid[data-pass63-mission-layout="triple-top"] > [data-pass63-mission-pane-id="pane-1"] { grid-column:1 / 3 !important; grid-row:1 !important; }
.pass63-mission-layout-grid[data-pass63-mission-layout="triple-top"] > [data-pass63-mission-pane-id="pane-2"] { grid-column:1 !important; grid-row:2 !important; }
.pass63-mission-layout-grid[data-pass63-mission-layout="triple-top"] > [data-pass63-mission-pane-id="pane-3"] { grid-column:2 !important; grid-row:2 !important; }
.pass63-mission-layout-grid[data-pass63-mission-layout="triple"] > [data-pass63-mission-pane-id="pane-1"],
.pass63-mission-layout-grid[data-pass63-mission-layout="triple-bottom"] > [data-pass63-mission-pane-id="pane-1"] { grid-column:1 !important; grid-row:1 !important; }
.pass63-mission-layout-grid[data-pass63-mission-layout="triple"] > [data-pass63-mission-pane-id="pane-2"],
.pass63-mission-layout-grid[data-pass63-mission-layout="triple-bottom"] > [data-pass63-mission-pane-id="pane-2"] { grid-column:2 !important; grid-row:1 !important; }
.pass63-mission-layout-grid[data-pass63-mission-layout="triple"] > [data-pass63-mission-pane-id="pane-3"],
.pass63-mission-layout-grid[data-pass63-mission-layout="triple-bottom"] > [data-pass63-mission-pane-id="pane-3"] { grid-column:1 / 3 !important; grid-row:2 !important; }
.pass63-mission-layout-grid[data-pass63-mission-layout="triple-left"] > [data-pass63-mission-pane-id="pane-1"] { grid-column:1 !important; grid-row:1 / 3 !important; }
.pass63-mission-layout-grid[data-pass63-mission-layout="triple-left"] > [data-pass63-mission-pane-id="pane-2"] { grid-column:2 !important; grid-row:1 !important; }
.pass63-mission-layout-grid[data-pass63-mission-layout="triple-left"] > [data-pass63-mission-pane-id="pane-3"] { grid-column:2 !important; grid-row:2 !important; }
.pass63-mission-layout-grid[data-pass63-mission-layout="triple-right"] > [data-pass63-mission-pane-id="pane-1"] { grid-column:1 !important; grid-row:1 !important; }
.pass63-mission-layout-grid[data-pass63-mission-layout="triple-right"] > [data-pass63-mission-pane-id="pane-2"] { grid-column:1 !important; grid-row:2 !important; }
.pass63-mission-layout-grid[data-pass63-mission-layout="triple-right"] > [data-pass63-mission-pane-id="pane-3"] { grid-column:2 !important; grid-row:1 / 3 !important; }
.pass63-mission-pane-reorderable { position:relative; }
.mission-pane-drag-handle {
  position:absolute;
  z-index:12;
  top:8px;
  right:10px;
  display:inline-flex;
  align-items:center;
  gap:6px;
  min-height:26px;
  padding:0 10px;
  border:1px solid rgba(119,219,255,.22);
  border-radius:999px;
  color:var(--text);
  background:rgba(3,16,26,.72);
  box-shadow:0 0 18px rgba(119,219,255,.10), inset 0 0 12px rgba(119,219,255,.06);
  backdrop-filter:blur(10px);
  cursor:grab;
  font-size:.68rem;
  font-weight:900;
  letter-spacing:.04em;
  text-transform:uppercase;
  opacity:.58;
  user-select:none;
}
.mission-pane-drag-handle:active { cursor:grabbing; }
.pass63-mission-pane-reorderable:hover > .mission-pane-drag-handle,
.mission-pane-drag-handle:focus-visible {
  opacity:1;
  border-color:rgba(119,219,255,.58);
  outline:none;
}
.pass63-mission-pane-dragging {
  opacity:.72;
  outline:2px solid rgba(119,219,255,.70);
  outline-offset:-2px;
}
.pass63-mission-pane-drop-target {
  outline:2px dashed rgba(255,199,95,.82);
  outline-offset:-5px;
  box-shadow:0 0 28px rgba(255,199,95,.14), inset 0 0 22px rgba(255,199,95,.08);
}
.pass63-triview-upgrade-controls {
  display:grid;
  gap:10px;
  margin:12px 0 0;
  padding:12px;
  border:1px solid rgba(119,219,255,.18);
  border-radius:16px;
  background:linear-gradient(180deg,rgba(119,219,255,.065),rgba(255,255,255,.024));
  box-shadow:inset 0 0 18px rgba(119,219,255,.045);
}
.pass63-triview-header { display:grid; gap:4px; }
.pass63-triview-header strong { color:var(--cyan); letter-spacing:.08em; text-transform:uppercase; font-size:.72rem; }
.pass63-triview-header span { color:var(--muted); font-size:.78rem; line-height:1.35; }
.pass63-triview-buttons { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
.pass63-triview-buttons button {
  min-height:34px;
  border:1px solid rgba(119,219,255,.20);
  border-radius:999px;
  padding:0 12px;
  color:var(--text);
  background:rgba(255,255,255,.045);
  cursor:pointer;
  font-weight:900;
}
.pass63-triview-buttons button:hover,
.pass63-triview-buttons button:focus-visible {
  border-color:rgba(119,219,255,.58);
  background:rgba(119,219,255,.12);
  outline:none;
}
.pass63-triview-buttons button.active {
  color:#03101a;
  border-color:rgba(119,219,255,.70);
  background:linear-gradient(180deg,var(--cyan),#2f8fff);
  box-shadow:0 0 18px rgba(119,219,255,.22);
}
`;

css = css.replace(/\n*\/\* PASS 63 Tri-view asymmetry and pane drag reorder \*\/[\s\S]*?(?=\n\/\* PASS|\n@media|\n\.[a-zA-Z0-9_-]+|\s*$)/m, '\n');
if (!css.includes(pass64Marker)) css += cssBlock;

upsertPackageScripts(pkg);

write(appRel, app);
write(cssRel, css);
write(pkgRel, JSON.stringify(pkg, null, 2) + '\n');

console.log('PASS64_APPLY_OK=event-type repair, asymmetric Tri View, and handle-only 2/3/4-pane drag reorder applied');
