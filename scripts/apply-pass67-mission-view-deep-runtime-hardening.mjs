#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appRel = 'src/renderer/app.ts';
const cssRel = 'src/renderer/styles/browser.css';
const pkgRel = 'package.json';
const marker = 'PASS 67 Mission View deep runtime hardening';

function fail(message) {
  console.error(`PASS67_APPLY_FAIL=${message}`);
  process.exit(1);
}
const full = (relPath) => path.join(root, relPath);
function read(relPath) {
  const filePath = full(relPath);
  if (!fs.existsSync(filePath)) fail(`missing ${relPath}`);
  return fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
}
function write(relPath, text) {
  fs.writeFileSync(full(relPath), text.replace(/\r\n/g, '\n').replace(/\r/g, '\n'), 'utf8');
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
function insertBeforeNamedBlock(source, name, insertion) {
  if (source.includes(insertion.trim().slice(0, 90))) return source;
  const range = findNamedBlock(source, name);
  if (!range) return source + '\n' + insertion;
  return source.slice(0, range.startIndex) + insertion + '\n' + source.slice(range.startIndex);
}
function upsertAfter(source, anchor, insertion) {
  if (source.includes(insertion.trim().slice(0, 90))) return source;
  const index = source.indexOf(anchor);
  if (index === -1) return source + '\n' + insertion;
  return source.slice(0, index + anchor.length) + insertion + source.slice(index + anchor.length);
}

function normalizeKnownDrift(source) {
  return source
    .replace(/(['"])layout-changed\1/g, '$1layout-set$1')
    .replace(/querySelector<HTMLElement>\((['"]):scope > \\.mission-pane-drag-handle\1\)/g, 'querySelector<HTMLButtonElement>($1:scope > .mission-pane-drag-handle$1)')
    .replace(/\bhandle\.type\s*=\s*(['"])button\1\s*;/g, "handle.setAttribute('type', 'button');");
}

let app = normalizeKnownDrift(read(appRel));
let css = read(cssRel);
const pkg = JSON.parse(read(pkgRel));

for (const required of ['currentMission', 'renderMissionControl', 'syncMissionLayoutPanesForMission', 'pass63MountMissionPaneDragReorder', 'pass63SetMissionLayout']) {
  if (!app.includes(required)) fail(`src/renderer/app.ts missing required Mission symbol: ${required}`);
}
if (!app.includes('pass66MissionPanePointerDragging')) {
  fail('PASS66 runtime repair is not present; apply PASS66 before PASS67');
}

const pass67State = `
// ${marker}: responsive Mission Control, stable tab-drop layout, and resilient pane move fallback.
let pass67MissionPaneSwapArmedSource = '';
let pass67SuppressMissionPaneHandleClickUntil = 0;
let pass67MissionPanePointerStartX = 0;
let pass67MissionPanePointerStartY = 0;
let pass67MissionPanePointerMoved = false;
let pass67MissionLayoutBeforePotentialDrop = '';
let pass67MissionLayoutDropPreserverMounted = false;
let pass67MissionPaneKeyboardHandlersMounted = false;
`;
if (!app.includes('pass67MissionPaneSwapArmedSource')) {
  app = upsertAfter(app, "let pass66MissionPaneKeyboardMounted = false;", pass67State);
}

const syncRange = findNamedBlock(app, 'syncMissionLayoutPanesForMission');
if (!app.includes('pass67BaseSyncMissionLayoutPanesForMission')) {
  if (!syncRange) fail('could not locate syncMissionLayoutPanesForMission for PASS67 layout-preservation wrapper');
  const originalSyncBlock = app.slice(syncRange.startIndex, syncRange.endIndex);
  const renamedSyncBlock = originalSyncBlock.replace(/function\s+syncMissionLayoutPanesForMission\s*\(/, 'function pass67BaseSyncMissionLayoutPanesForMission(');
  const syncWrapper = `

function pass67StableLayoutSupportsEmptyPanes(layoutType: string): boolean {
  return ['split-horizontal', 'split-vertical', 'triple', 'triple-top', 'triple-bottom', 'triple-left', 'triple-right', 'quad', 'focus'].includes(layoutType);
}

function pass67VisiblePaneIdsForLayoutType(layoutType: string, activePaneId = 'pane-1'): string[] {
  switch (layoutType) {
    case 'focus': return [activePaneId || 'pane-1'];
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

function pass67EnsureVisibleLayoutPanes(mission: any, layoutType: string): void {
  if (!mission) return;
  if (!mission.layout) mission.layout = { type: layoutType || 'single', activePaneId: 'pane-1', panes: [] };
  if (!Array.isArray(mission.layout.panes)) mission.layout.panes = [];
  const visiblePaneIds = pass67VisiblePaneIdsForLayoutType(layoutType, mission.layout.activePaneId || 'pane-1');
  for (const paneId of visiblePaneIds) {
    if (!mission.layout.panes.some((pane: any) => pane?.paneId === paneId)) mission.layout.panes.push({ paneId });
  }
  if (!visiblePaneIds.includes(mission.layout.activePaneId)) mission.layout.activePaneId = visiblePaneIds[0] || 'pane-1';
}

function syncMissionLayoutPanesForMission(mission: any): void {
  const requestedLayoutType = String(mission?.layout?.type || '');
  const requestedActivePaneId = String(mission?.layout?.activePaneId || 'pane-1');
  pass67BaseSyncMissionLayoutPanesForMission(mission);
  if (mission?.layout && pass67StableLayoutSupportsEmptyPanes(requestedLayoutType)) {
    mission.layout.type = requestedLayoutType;
    mission.layout.activePaneId = requestedActivePaneId || mission.layout.activePaneId || 'pane-1';
    pass67EnsureVisibleLayoutPanes(mission, requestedLayoutType);
  }
}
`;
  app = app.slice(0, syncRange.startIndex) + renamedSyncBlock + syncWrapper + app.slice(syncRange.endIndex);
}

const pass63SetLayoutReplacement = `function pass63SetMissionLayout(layoutType: MissionLayoutType): void {
  const mission = currentMission as any;
  if (!mission || !mission.layout) {
    pass67RefreshTriViewUpgradeControlsSafe();
    return;
  }
  mission.layout.type = layoutType;
  if (!mission.layout.activePaneId) mission.layout.activePaneId = 'pane-1';
  pass67EnsureVisibleLayoutPanes(mission, String(layoutType));
  syncMissionLayoutPanesForMission(mission);
  mission.layout.type = layoutType;
  pass67EnsureVisibleLayoutPanes(mission, String(layoutType));
  appendMissionTimelineEvent(mission, 'layout-set', 'Mission layout set', 'Switched Mission Control to ' + missionLayoutLabel(layoutType) + '.');
  renderMissionControl();
  pass64ScheduleMissionPaneRefresh();
}`;
let replaced = replaceNamedBlock(app, 'pass63SetMissionLayout', pass63SetLayoutReplacement);
if (!replaced.changed) fail('could not replace pass63SetMissionLayout');
app = replaced.source;

const pass67Helpers = `
function pass67PointIsInsideRect(x: number, y: number, rect: DOMRect): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function pass67MissionPaneAtViewportPoint(x: number, y: number): HTMLElement | null {
  const direct = document.elementFromPoint(x, y);
  if (direct instanceof Element) {
    const closest = direct.closest<HTMLElement>('[data-pass63-mission-pane-id]');
    if (closest && pass66IsActualMissionViewPane(closest)) return closest;
  }
  const matches = pass63MissionPaneElements()
    .map((element) => ({ element, rect: element.getBoundingClientRect() }))
    .filter(({ rect }) => rect.width > 8 && rect.height > 8 && pass67PointIsInsideRect(x, y, rect));
  if (!matches.length) return null;
  matches.sort((a, b) => (a.rect.width * a.rect.height) - (b.rect.width * b.rect.height));
  return matches[0].element;
}

function pass67ClearMissionPaneSwapArmed(): void {
  pass67MissionPaneSwapArmedSource = '';
  document.querySelectorAll('.pass67-mission-pane-swap-armed').forEach((element) => element.classList.remove('pass67-mission-pane-swap-armed'));
}

function pass67ArmOrSwapMissionPane(paneId: string, pane: HTMLElement): void {
  const mission = currentMission as any;
  if (!mission || !paneId || !pass63MissionLayoutSupportsReorder(mission.layout.type)) return;
  if (!pass67MissionPaneSwapArmedSource || pass67MissionPaneSwapArmedSource === paneId) {
    pass67ClearMissionPaneSwapArmed();
    pass67MissionPaneSwapArmedSource = paneId;
    pane.classList.add('pass67-mission-pane-swap-armed');
    return;
  }
  const sourcePaneId = pass67MissionPaneSwapArmedSource;
  pass67ClearMissionPaneSwapArmed();
  pass63SwapMissionPanes(sourcePaneId, paneId);
}

function pass67RefreshTriViewUpgradeControlsSafe(): void {
  const root = document.getElementById('pass63-triview-upgrade-controls') as HTMLElement | null;
  if (!root) return;
  const mission = currentMission as any;
  root.hidden = !mission;
  root.classList.add('pass67-triview-variant-row');
}

function pass67RememberLayoutBeforePotentialDrop(): void {
  const mission = currentMission as any;
  const layoutType = String(mission?.layout?.type || '');
  if (pass67StableLayoutSupportsEmptyPanes(layoutType)) pass67MissionLayoutBeforePotentialDrop = layoutType;
}

function pass67RestoreStableLayoutAfterDrop(): void {
  const before = pass67MissionLayoutBeforePotentialDrop;
  if (!before || !pass67StableLayoutSupportsEmptyPanes(before)) return;
  window.setTimeout(() => {
    const mission = currentMission as any;
    if (!mission?.layout) return;
    const currentType = String(mission.layout.type || '');
    const beforeCount = pass67VisiblePaneIdsForLayoutType(before, mission.layout.activePaneId || 'pane-1').length;
    const currentCount = pass67VisiblePaneIdsForLayoutType(currentType, mission.layout.activePaneId || 'pane-1').length;
    if (beforeCount > currentCount || (before.startsWith('triple') && currentType.startsWith('split'))) {
      mission.layout.type = before;
      pass67EnsureVisibleLayoutPanes(mission, before);
      renderMissionControl();
      pass64ScheduleMissionPaneRefresh();
    }
  }, 0);
}

function pass67MountMissionLayoutDropPreserver(): void {
  if (pass67MissionLayoutDropPreserverMounted) return;
  document.addEventListener('dragenter', pass67RememberLayoutBeforePotentialDrop, true);
  document.addEventListener('dragover', pass67RememberLayoutBeforePotentialDrop, true);
  document.addEventListener('drop', () => {
    pass67RememberLayoutBeforePotentialDrop();
    pass67RestoreStableLayoutAfterDrop();
  }, true);
  pass67MissionLayoutDropPreserverMounted = true;
}
`;
app = insertBeforeNamedBlock(app, 'pass63ClosestMissionPane', pass67Helpers);

const closestPaneReplacement = `function pass63ClosestMissionPane(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const closest = target.closest<HTMLElement>('[data-pass63-mission-pane-id]');
  return closest && pass66IsActualMissionViewPane(closest) ? closest : null;
}`;
replaced = replaceNamedBlock(app, 'pass63ClosestMissionPane', closestPaneReplacement);
if (!replaced.changed) fail('could not replace pass63ClosestMissionPane');
app = replaced.source;

const dragReplacement = `function pass63MountMissionPaneDragReorder(): void {
  if (pass63MissionPaneDragMounted) return;
  document.addEventListener('dragstart', (event) => {
    const handle = pass64ClosestDragHandle(event.target);
    if (!handle) return;
    const pane = pass63ClosestMissionPane(handle);
    const paneId = pass63PaneIdFromElement(pane);
    const mission = currentMission as any;
    if (!mission || !pane || !paneId || !pass63MissionLayoutSupportsReorder(mission.layout.type)) return;
    pass63MissionPaneDragSource = paneId;
    pass67MissionPanePointerMoved = false;
    pane.classList.add('pass63-mission-pane-dragging');
    event.dataTransfer?.setData('application/x-tahai-mission-pane', paneId);
    event.dataTransfer?.setData('text/plain', paneId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }, true);
  document.addEventListener('dragover', (event) => {
    const pane = pass67MissionPaneAtViewportPoint(event.clientX, event.clientY) || pass63ClosestMissionPane(event.target);
    const mission = currentMission as any;
    if (!mission || !pane || !pass63MissionPaneDragSource || !pass63MissionLayoutSupportsReorder(mission.layout.type)) return;
    const targetPaneId = pass63PaneIdFromElement(pane);
    if (!targetPaneId || targetPaneId === pass63MissionPaneDragSource) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.pass63-mission-pane-drop-target').forEach((element) => element.classList.remove('pass63-mission-pane-drop-target'));
    pane.classList.add('pass63-mission-pane-drop-target');
  }, true);
  document.addEventListener('dragleave', (event) => {
    const pane = pass63ClosestMissionPane(event.target);
    pane?.classList.remove('pass63-mission-pane-drop-target');
  }, true);
  document.addEventListener('drop', (event) => {
    const pane = pass67MissionPaneAtViewportPoint(event.clientX, event.clientY) || pass63ClosestMissionPane(event.target);
    const targetPaneId = pass63PaneIdFromElement(pane);
    const sourcePaneId = event.dataTransfer?.getData('application/x-tahai-mission-pane') || pass63MissionPaneDragSource;
    document.querySelectorAll('.pass63-mission-pane-drop-target,.pass63-mission-pane-dragging').forEach((element) => element.classList.remove('pass63-mission-pane-drop-target', 'pass63-mission-pane-dragging'));
    pass63MissionPaneDragSource = '';
    const mission = currentMission as any;
    if (!mission || !targetPaneId || !sourcePaneId || sourcePaneId === targetPaneId || !pass63MissionLayoutSupportsReorder(mission.layout.type)) return;
    event.preventDefault();
    pass67SuppressMissionPaneHandleClickUntil = Date.now() + 350;
    pass67ClearMissionPaneSwapArmed();
    pass63SwapMissionPanes(sourcePaneId, targetPaneId);
  }, true);
  document.addEventListener('dragend', () => {
    pass63MissionPaneDragSource = '';
    document.querySelectorAll('.pass63-mission-pane-drop-target,.pass63-mission-pane-dragging').forEach((element) => element.classList.remove('pass63-mission-pane-drop-target', 'pass63-mission-pane-dragging'));
  }, true);
  document.addEventListener('pointerdown', (event) => {
    const handle = pass64ClosestDragHandle(event.target);
    if (!handle || event.button !== 0) return;
    const pane = pass63ClosestMissionPane(handle);
    const paneId = pass63PaneIdFromElement(pane);
    const mission = currentMission as any;
    if (!mission || !pane || !paneId || !pass63MissionLayoutSupportsReorder(mission.layout.type)) return;
    pass66MissionPanePointerDragSource = paneId;
    pass66MissionPanePointerDragging = true;
    pass67MissionPanePointerMoved = false;
    pass67MissionPanePointerStartX = event.clientX;
    pass67MissionPanePointerStartY = event.clientY;
    pane.classList.add('pass63-mission-pane-dragging');
    document.body.classList.add('pass66-mission-pane-pointer-dragging');
    handle.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }, true);
  document.addEventListener('pointermove', (event) => {
    if (!pass66MissionPanePointerDragging || !pass66MissionPanePointerDragSource) return;
    if (Math.abs(event.clientX - pass67MissionPanePointerStartX) > 5 || Math.abs(event.clientY - pass67MissionPanePointerStartY) > 5) pass67MissionPanePointerMoved = true;
    document.querySelectorAll('.pass63-mission-pane-drop-target').forEach((element) => element.classList.remove('pass63-mission-pane-drop-target'));
    const pane = pass67MissionPaneAtViewportPoint(event.clientX, event.clientY);
    const targetPaneId = pass63PaneIdFromElement(pane);
    if (pane && targetPaneId && targetPaneId !== pass66MissionPanePointerDragSource) pane.classList.add('pass63-mission-pane-drop-target');
    event.preventDefault();
  }, true);
  document.addEventListener('pointerup', (event) => {
    if (!pass66MissionPanePointerDragging) return;
    const sourcePaneId = pass66MissionPanePointerDragSource;
    const pane = pass67MissionPaneAtViewportPoint(event.clientX, event.clientY);
    const targetPaneId = pass63PaneIdFromElement(pane);
    pass66MissionPanePointerDragging = false;
    pass66MissionPanePointerDragSource = '';
    document.body.classList.remove('pass66-mission-pane-pointer-dragging');
    document.querySelectorAll('.pass63-mission-pane-drop-target,.pass63-mission-pane-dragging').forEach((element) => element.classList.remove('pass63-mission-pane-drop-target', 'pass63-mission-pane-dragging'));
    const mission = currentMission as any;
    if (!mission || !sourcePaneId || !targetPaneId || sourcePaneId === targetPaneId || !pass63MissionLayoutSupportsReorder(mission.layout.type)) return;
    event.preventDefault();
    event.stopPropagation();
    pass67SuppressMissionPaneHandleClickUntil = Date.now() + 350;
    pass67ClearMissionPaneSwapArmed();
    pass63SwapMissionPanes(sourcePaneId, targetPaneId);
  }, true);
  document.addEventListener('pointercancel', () => {
    pass66MissionPanePointerDragging = false;
    pass66MissionPanePointerDragSource = '';
    pass67MissionPanePointerMoved = false;
    document.body.classList.remove('pass66-mission-pane-pointer-dragging');
    document.querySelectorAll('.pass63-mission-pane-drop-target,.pass63-mission-pane-dragging').forEach((element) => element.classList.remove('pass63-mission-pane-drop-target', 'pass63-mission-pane-dragging'));
  }, true);
  document.addEventListener('click', (event) => {
    const handle = pass64ClosestDragHandle(event.target);
    if (!handle) return;
    if (Date.now() < pass67SuppressMissionPaneHandleClickUntil || pass67MissionPanePointerMoved) {
      pass67MissionPanePointerMoved = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const pane = pass63ClosestMissionPane(handle);
    const paneId = pass63PaneIdFromElement(pane);
    if (!pane || !paneId) return;
    event.preventDefault();
    event.stopPropagation();
    pass67ArmOrSwapMissionPane(paneId, pane);
  }, true);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') pass67ClearMissionPaneSwapArmed();
  }, true);
  pass63MissionPaneDragMounted = true;
}`;
replaced = replaceNamedBlock(app, 'pass63MountMissionPaneDragReorder', dragReplacement);
if (!replaced.changed) fail('could not replace pass63MountMissionPaneDragReorder');
app = replaced.source;

const refreshControlsReplacement = `function pass63RefreshTriViewUpgradeControls(): void {
  const root = document.getElementById('pass63-triview-upgrade-controls') as HTMLElement | null;
  if (!root) return;
  const mission = currentMission as any;
  const currentType = mission ? pass63CanonicalMissionLayoutType(mission.layout.type) : '';
  root.hidden = !mission;
  root.classList.add('pass67-triview-variant-row');
  root.querySelectorAll<HTMLButtonElement>('[data-pass63-triple-layout]').forEach((button) => {
    const active = button.dataset.pass63TripleLayout === currentType;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}`;
replaced = replaceNamedBlock(app, 'pass63RefreshTriViewUpgradeControls', refreshControlsReplacement);
if (!replaced.changed) fail('could not replace pass63RefreshTriViewUpgradeControls');
app = replaced.source;

const mountControlsReplacement = `function pass63MountTriViewUpgradeControls(): void {
  const layoutHost = document.querySelector<HTMLElement>('[data-mission-layouts], .mission-layouts, .mission-control-layouts, .mission-layout-buttons, #mission-layouts');
  if (!layoutHost) return;
  let panel = document.getElementById('pass63-triview-upgrade-controls') as HTMLElement | null;
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'pass63-triview-upgrade-controls';
  }
  panel.className = 'pass63-triview-upgrade-controls pass66-triview-upgrade-controls pass67-triview-variant-row';
  if (panel.dataset.pass67Controls !== 'true') {
    panel.innerHTML = '<button type="button" data-pass63-triple-layout="triple-top" title="3-Up: one full-width pane on top">Top wide</button><button type="button" data-pass63-triple-layout="triple-bottom" title="3-Up: one full-width pane on bottom">Bottom wide</button><button type="button" data-pass63-triple-layout="triple-left" title="3-Up: one full-height pane on the left">Left tall</button><button type="button" data-pass63-triple-layout="triple-right" title="3-Up: one full-height pane on the right">Right tall</button>';
    panel.dataset.pass67Controls = 'true';
  }
  if (panel.parentElement !== layoutHost) layoutHost.appendChild(panel);
  panel.querySelectorAll<HTMLButtonElement>('[data-pass63-triple-layout]').forEach((button) => {
    if (button.dataset.pass67ClickMounted === 'true') return;
    button.dataset.pass67ClickMounted = 'true';
    button.addEventListener('click', () => {
      const layoutType = button.dataset.pass63TripleLayout as Pass63TripleLayoutType | undefined;
      if (!layoutType || !pass63TripleLayoutTypes.includes(layoutType)) return;
      pass63SetMissionLayout(layoutType as MissionLayoutType);
    });
  });
  pass63MissionLayoutUpgradeMounted = true;
  pass63RefreshTriViewUpgradeControls();
}`;
replaced = replaceNamedBlock(app, 'pass63MountTriViewUpgradeControls', mountControlsReplacement);
if (!replaced.changed) fail('could not replace pass63MountTriViewUpgradeControls');
app = replaced.source;

const focusPaneReplacement = `function pass66FocusMissionPaneByNumber(paneNumber: number): void {
  const mission = currentMission as any;
  if (!mission || paneNumber < 1 || paneNumber > 4) return;
  const paneId = 'pane-' + paneNumber;
  const visiblePaneIds = pass63VisiblePaneIds();
  if (!visiblePaneIds.includes(paneId)) return;
  mission.layout.activePaneId = paneId;
  pass67EnsureVisibleLayoutPanes(mission, String(mission.layout.type || 'single'));
  const tabId = pass63PaneTabId(paneId);
  if (tabId && Array.isArray(mission.tabs)) mission.tabs.forEach((tab: any) => { tab.active = tab.tabId === tabId; });
  appendMissionTimelineEvent(mission, 'layout-set', 'Mission pane focused', 'Focused ' + paneId.replace('pane-', 'Pane ') + ' with Ctrl+Alt+' + paneNumber + '.');
  renderMissionControl();
  pass64ScheduleMissionPaneRefresh();
}`;
replaced = replaceNamedBlock(app, 'pass66FocusMissionPaneByNumber', focusPaneReplacement);
if (!replaced.changed) fail('could not replace pass66FocusMissionPaneByNumber');
app = replaced.source;

const keyboardReplacement = `function pass66MountMissionPaneKeyboardShortcuts(): void {
  if (pass67MissionPaneKeyboardHandlersMounted) return;
  const handler = (event: KeyboardEvent) => {
    if (event.defaultPrevented || !event.ctrlKey || !event.altKey || event.shiftKey || event.metaKey) return;
    const digit = event.code.match(/^(?:Digit|Numpad)([1-4])$/)?.[1] || '';
    if (!digit) return;
    const mission = currentMission as any;
    if (!mission) return;
    const paneNumber = Number(digit);
    const paneId = 'pane-' + paneNumber;
    if (!pass63VisiblePaneIds().includes(paneId)) return;
    event.preventDefault();
    event.stopPropagation();
    pass66FocusMissionPaneByNumber(paneNumber);
  };
  window.addEventListener('keydown', handler, true);
  document.addEventListener('keydown', handler, true);
  pass66MissionPaneKeyboardMounted = true;
  pass67MissionPaneKeyboardHandlersMounted = true;
}`;
replaced = replaceNamedBlock(app, 'pass66MountMissionPaneKeyboardShortcuts', keyboardReplacement);
if (!replaced.changed) fail('could not replace pass66MountMissionPaneKeyboardShortcuts');
app = replaced.source;

const bootReplacement = `function pass64BootMissionPaneReorderHardening(): void {
  pass64ScheduleMissionPaneRefresh();
  pass66MountMissionPaneKeyboardShortcuts();
  pass67MountMissionLayoutDropPreserver();
  if (!pass64MissionPaneObserverMounted && document.body && typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass64ScheduleMissionPaneRefresh());
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-pane-id', 'data-mission-pane-id', 'data-pass63-mission-pane-id', 'data-pass63-mission-layout', 'data-pass64-mission-layout'] });
    pass64MissionPaneObserverMounted = true;
  }
}`;
replaced = replaceNamedBlock(app, 'pass64BootMissionPaneReorderHardening', bootReplacement);
if (!replaced.changed) fail('could not replace pass64BootMissionPaneReorderHardening');
app = replaced.source;

app = normalizeKnownDrift(app);

const pass67Css = `

/* ${marker}: responsive panes, compact Tri View controls, and reliable pane-move fallback. */
#pass63-triview-upgrade-controls.pass67-triview-variant-row,
.pass67-triview-variant-row.pass63-triview-upgrade-controls {
  position:static !important;
  z-index:auto !important;
  display:inline-flex !important;
  flex:0 1 auto !important;
  align-items:center !important;
  justify-content:flex-start !important;
  gap:6px !important;
  width:auto !important;
  min-width:0 !important;
  max-width:100% !important;
  min-height:0 !important;
  height:auto !important;
  margin:0 0 0 8px !important;
  padding:0 !important;
  border:0 !important;
  border-radius:0 !important;
  background:transparent !important;
  box-shadow:none !important;
  overflow:visible !important;
  transform:none !important;
}
#pass63-triview-upgrade-controls.pass67-triview-variant-row[hidden] { display:none !important; }
#pass63-triview-upgrade-controls.pass67-triview-variant-row .pass63-triview-header { display:none !important; }
#pass63-triview-upgrade-controls.pass67-triview-variant-row button {
  flex:0 0 auto !important;
  min-height:28px !important;
  max-height:32px !important;
  padding:0 9px !important;
  border:1px solid rgba(119,219,255,.22) !important;
  border-radius:999px !important;
  color:var(--text) !important;
  background:rgba(255,255,255,.045) !important;
  font-size:.68rem !important;
  line-height:1 !important;
  font-weight:900 !important;
  letter-spacing:.01em !important;
  white-space:nowrap !important;
}
#pass63-triview-upgrade-controls.pass67-triview-variant-row button.active {
  color:#03101a !important;
  border-color:rgba(119,219,255,.70) !important;
  background:linear-gradient(180deg,var(--cyan),#2f8fff) !important;
}
.pass66-mission-view-pane-grid.pass63-mission-layout-grid {
  min-width:0 !important;
  min-height:0 !important;
  height:100% !important;
  overflow:hidden !important;
  align-items:stretch !important;
}
.pass66-mission-view-pane-grid.pass63-mission-layout-grid[data-pass63-mission-layout="triple"],
.pass66-mission-view-pane-grid.pass63-mission-layout-grid[data-pass63-mission-layout="triple-bottom"],
.pass66-mission-view-pane-grid.pass63-mission-layout-grid[data-pass63-mission-layout="triple-top"] {
  grid-template-columns:minmax(0,1fr) minmax(0,1fr) !important;
  grid-template-rows:minmax(0,1fr) minmax(0,1fr) !important;
}
.pass66-mission-view-pane-grid.pass63-mission-layout-grid[data-pass63-mission-layout="triple-left"],
.pass66-mission-view-pane-grid.pass63-mission-layout-grid[data-pass63-mission-layout="triple-right"] {
  grid-template-columns:minmax(0,1fr) minmax(0,1fr) !important;
  grid-template-rows:minmax(0,1fr) minmax(0,1fr) !important;
}
.pass66-mission-view-pane-grid.pass63-mission-layout-grid > [data-pass63-mission-pane-id] {
  min-width:0 !important;
  min-height:0 !important;
  overflow:hidden !important;
}
.pass67-mission-pane-swap-armed {
  outline:2px solid rgba(119,255,197,.90) !important;
  outline-offset:-4px !important;
  box-shadow:0 0 30px rgba(119,255,197,.18), inset 0 0 18px rgba(119,255,197,.10) !important;
}
.pass67-mission-pane-swap-armed > .mission-pane-drag-handle {
  opacity:1 !important;
  border-color:rgba(119,255,197,.80) !important;
  background:rgba(12,68,50,.82) !important;
}
.pass63-mission-pane-reorderable > .mission-pane-drag-handle {
  max-width:min(136px, calc(100% - 20px));
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
@media (max-width: 1100px), (max-height: 720px) {
  #pass63-triview-upgrade-controls.pass67-triview-variant-row {
    flex-basis:100% !important;
    margin:6px 0 0 0 !important;
    flex-wrap:wrap !important;
  }
  .pass66-mission-view-pane-grid.pass63-mission-layout-grid[data-pass63-mission-layout="triple"],
  .pass66-mission-view-pane-grid.pass63-mission-layout-grid[data-pass63-mission-layout="triple-bottom"],
  .pass66-mission-view-pane-grid.pass63-mission-layout-grid[data-pass63-mission-layout="triple-top"],
  .pass66-mission-view-pane-grid.pass63-mission-layout-grid[data-pass63-mission-layout="triple-left"],
  .pass66-mission-view-pane-grid.pass63-mission-layout-grid[data-pass63-mission-layout="triple-right"],
  .pass66-mission-view-pane-grid.pass63-mission-layout-grid[data-pass63-mission-layout="quad"] {
    grid-template-columns:minmax(0,1fr) !important;
    grid-auto-rows:minmax(180px,42vh) !important;
    overflow:auto !important;
  }
  .pass66-mission-view-pane-grid.pass63-mission-layout-grid[data-pass63-mission-layout="triple"] > [data-pass63-mission-pane-id],
  .pass66-mission-view-pane-grid.pass63-mission-layout-grid[data-pass63-mission-layout="triple-bottom"] > [data-pass63-mission-pane-id],
  .pass66-mission-view-pane-grid.pass63-mission-layout-grid[data-pass63-mission-layout="triple-top"] > [data-pass63-mission-pane-id],
  .pass66-mission-view-pane-grid.pass63-mission-layout-grid[data-pass63-mission-layout="triple-left"] > [data-pass63-mission-pane-id],
  .pass66-mission-view-pane-grid.pass63-mission-layout-grid[data-pass63-mission-layout="triple-right"] > [data-pass63-mission-pane-id],
  .pass66-mission-view-pane-grid.pass63-mission-layout-grid[data-pass63-mission-layout="quad"] > [data-pass63-mission-pane-id] {
    grid-column:1 !important;
    grid-row:auto !important;
    min-height:180px !important;
  }
}
`;
if (!css.includes(marker)) css += pass67Css;

pkg.scripts = pkg.scripts || {};
pkg.scripts['verify:pass-67-mission-view-deep-runtime-hardening'] = 'node scripts/verify-pass67-mission-view-deep-runtime-hardening.mjs';
const blockers = String(pkg.scripts['verify:release-blockers'] || '');
if (blockers && !blockers.includes('verify:pass-67-mission-view-deep-runtime-hardening')) {
  const commands = blockers.split(/\s&&\s/).map((item) => item.trim()).filter(Boolean);
  const verifyCommand = 'npm run verify:pass-67-mission-view-deep-runtime-hardening';
  const buildIndex = commands.findIndex((command) => /(^|\s)npm run build($|\s)/.test(command));
  if (!commands.includes(verifyCommand)) {
    if (buildIndex >= 0) commands.splice(buildIndex, 0, verifyCommand);
    else commands.push(verifyCommand);
  }
  pkg.scripts['verify:release-blockers'] = commands.join(' && ');
}

write(appRel, app);
write(cssRel, css);
write(pkgRel, JSON.stringify(pkg, null, 2) + '\n');
console.log('PASS67_APPLY_OK=Mission View deep runtime hardening applied: stable 3-Up drops, compact controls, responsive pane grids, robust drag/click pane reordering, and keyboard handler hardening');
