#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appRel = 'src/renderer/app.ts';
const cssRel = 'src/renderer/styles/browser.css';
const pkgRel = 'package.json';
const marker = 'PASS 66 Mission View pane runtime repair';
const pass65Marker = 'PASS 65 Tri-view DOM typing repair';

function fail(message) {
  console.error(`PASS66_APPLY_FAIL=${message}`);
  process.exit(1);
}
const full = (relPath) => path.join(root, relPath);
const exists = (relPath) => fs.existsSync(full(relPath));
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
function upsertAfter(source, anchor, insertion) {
  if (source.includes(insertion.trim().slice(0, 80))) return source;
  const index = source.indexOf(anchor);
  if (index === -1) return source + '\n' + insertion;
  return source.slice(0, index + anchor.length) + insertion + source.slice(index + anchor.length);
}

function repairDomHandleTyping(source) {
  return source
    .replace(/querySelector<HTMLElement>\((['"]):scope > \.mission-pane-drag-handle\1\)/g, 'querySelector<HTMLButtonElement>($1:scope > .mission-pane-drag-handle$1)')
    .replace(/\bhandle\.type\s*=\s*(['"])button\1\s*;/g, "handle.setAttribute('type', 'button');")
    .replace(/(['"])layout-changed\1/g, '$1layout-set$1');
}

let app = repairDomHandleTyping(read(appRel));
let css = read(cssRel);
const pkg = JSON.parse(read(pkgRel));

for (const required of ['currentMission', 'renderMissionControl', 'syncMissionLayoutPanesForMission']) {
  if (!app.includes(required)) fail(`src/renderer/app.ts missing required Mission symbol: ${required}`);
}
if (!app.includes('pass63MountMissionPaneDragReorder')) {
  fail('PASS64/PASS63 pane reorder helper is not present; apply PASS64/PASS65 first, then PASS66');
}

const pass66State = `
// ${marker}: runtime-safe Mission View targeting, pointer drag fallback, and Ctrl+Alt pane focus.
let pass66MissionPanePointerDragSource = '';
let pass66MissionPanePointerDragging = false;
let pass66MissionPaneKeyboardMounted = false;
`;
if (!app.includes('pass66MissionPanePointerDragSource')) {
  app = upsertAfter(app, "let pass64MissionPaneObserverMounted = false;", pass66State);
}

const pass66ConfigSurfaceFunction = `function pass66IsInsideMissionControlConfigSurface(element: HTMLElement): boolean {
  return Boolean(element.closest([
    '#mission-control',
    '.mission-control-modal',
    '.mission-control-drawer',
    '.mission-tabs-modal',
    '.mission-tabs-shell',
    '.mission-setup',
    '.mission-recipes',
    '.mission-recipe-list',
    '.mission-runbook',
    '.runbook-rail',
    '.mission-tabs-list',
    '.mission-tab-list',
    '.mission-evidence',
    '.mission-evidence-list',
    '.pass63-triview-upgrade-controls',
  ].join(',')));
}`;

const pass66ActualPaneFunction = `function pass66IsActualMissionViewPane(element: HTMLElement): boolean {
  const paneId = pass63PaneIdFromElement(element);
  if (!/^pane-[1-4]$/.test(paneId)) return false;
  if (pass66IsInsideMissionControlConfigSurface(element)) return false;
  if (element.matches('button,a,input,select,textarea,[role="button"],[contenteditable="true"]')) return false;
  if (element.querySelector('.mission-recipe-card,.mission-tab-row,.mission-evidence-item,.runbook-step,.checklist-step')) return false;

  const className = String(element.className || '').toLowerCase();
  const explicitPane = element.hasAttribute('data-pass63-mission-pane-id') ||
    element.hasAttribute('data-mission-pane-id') ||
    element.hasAttribute('data-pane-id') ||
    element.hasAttribute('data-mission-pane') ||
    element.hasAttribute('data-pane');
  const looksLikeViewPane = /(^|\\s)(site-view-pane|mission-view-pane|mission-browser-pane|browser-view-pane|webview-pane|quad-pane|split-pane|view-pane|pane-frame)(\\s|$)/.test(className);
  const hasHostedContent = Boolean(element.querySelector('webview,iframe,.webview,.browser-view,.site-view-webview,.mission-webview'));
  return explicitPane || looksLikeViewPane || hasHostedContent;
}`;

let pass66ConfigReplace = replaceNamedBlock(app, 'pass66IsInsideMissionControlConfigSurface', pass66ConfigSurfaceFunction);
app = pass66ConfigReplace.source;
let pass66ActualReplace = replaceNamedBlock(app, 'pass66IsActualMissionViewPane', pass66ActualPaneFunction);
app = pass66ActualReplace.source;
if (!pass66ConfigReplace.changed || !pass66ActualReplace.changed) {
  const insertionPoint = app.indexOf('function pass63PaneIdFromElement');
  const helpers = pass66ConfigSurfaceFunction + '\n\n' + pass66ActualPaneFunction + '\n\n';
  if (!pass66ConfigReplace.changed && !pass66ActualReplace.changed) {
    app = insertionPoint >= 0 ? app.slice(0, insertionPoint) + helpers + app.slice(insertionPoint) : app + '\n' + helpers;
  } else if (!pass66ConfigReplace.changed) {
    app = insertionPoint >= 0 ? app.slice(0, insertionPoint) + pass66ConfigSurfaceFunction + '\n\n' + app.slice(insertionPoint) : app + '\n' + pass66ConfigSurfaceFunction + '\n';
  } else if (!pass66ActualReplace.changed) {
    app = insertionPoint >= 0 ? app.slice(0, insertionPoint) + pass66ActualPaneFunction + '\n\n' + app.slice(insertionPoint) : app + '\n' + pass66ActualPaneFunction + '\n';
  }
}

const paneElementsReplacement = `function pass63MissionPaneElements(): HTMLElement[] {
  const seen = new Set<HTMLElement>();
  const result: HTMLElement[] = [];
  const selectors = [
    '[data-pass63-mission-pane-id]',
    '[data-mission-view-pane-id]',
    '[data-site-view-pane-id]',
    '[data-mission-pane-id]',
    '[data-pane-id]',
    '[data-mission-pane]',
    '[data-pane]',
    '.site-view-pane',
    '.mission-view-pane',
    '.mission-browser-pane',
    '.browser-view-pane',
    '.webview-pane',
    '.split-pane',
    '.quad-pane',
    '.view-pane',
    '.pane-frame',
  ];
  for (const selector of selectors) {
    document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
      if (seen.has(element)) return;
      const paneId = pass63PaneIdFromElement(element);
      if (!paneId) return;
      if (!pass66IsActualMissionViewPane(element)) return;
      seen.add(element);
      result.push(element);
    });
  }
  return result;
}`;
let replaced = replaceNamedBlock(app, 'pass63MissionPaneElements', paneElementsReplacement);
if (!replaced.changed) fail('could not replace pass63MissionPaneElements');
app = replaced.source;

const containerReplacement = `function pass64MissionPaneContainer(elements: HTMLElement[]): HTMLElement | null {
  if (elements.length < 2) return null;
  const parentCounts = new Map<HTMLElement, number>();
  for (const element of elements) {
    const parent = element.parentElement;
    if (!parent || pass66IsInsideMissionControlConfigSurface(parent)) continue;
    parentCounts.set(parent, (parentCounts.get(parent) || 0) + 1);
  }
  let winner: HTMLElement | null = null;
  let count = 0;
  parentCounts.forEach((value, key) => {
    if (value > count) { winner = key; count = value; }
  });
  return count >= 2 ? winner : null;
}`;
replaced = replaceNamedBlock(app, 'pass64MissionPaneContainer', containerReplacement);
if (!replaced.changed) fail('could not replace pass64MissionPaneContainer');
app = replaced.source;

const refreshReplacement = `function pass63RefreshMissionPaneDragTargets(): void {
  const mission = currentMission as any;
  const elements = pass63MissionPaneElements();
  document.querySelectorAll<HTMLElement>('.pass63-mission-layout-grid').forEach((candidate) => {
    if (!candidate.classList.contains('pass66-mission-view-pane-grid')) {
      candidate.classList.remove('pass63-mission-layout-grid');
      candidate.removeAttribute('data-pass63-mission-layout');
      candidate.removeAttribute('data-pass64-mission-layout');
    }
  });
  document.querySelectorAll<HTMLElement>('[data-pass63-mission-pane-id]').forEach((candidate) => {
    if (!elements.includes(candidate)) {
      candidate.classList.remove('pass63-mission-pane-reorderable', 'pass63-mission-pane-dragging', 'pass63-mission-pane-drop-target');
      candidate.querySelector(':scope > .mission-pane-drag-handle')?.remove();
    }
  });
  if (!mission) {
    elements.forEach((element) => element.classList.remove('pass63-mission-pane-reorderable'));
    return;
  }
  const canonicalLayoutType = pass63CanonicalMissionLayoutType(mission.layout.type);
  const visiblePaneIds = new Set(pass63VisiblePaneIds());
  const container = pass64MissionPaneContainer(elements);
  document.querySelectorAll<HTMLElement>('.pass66-mission-view-pane-grid').forEach((candidate) => {
    if (candidate !== container) {
      candidate.classList.remove('pass66-mission-view-pane-grid', 'pass63-mission-layout-grid');
      candidate.removeAttribute('data-pass63-mission-layout');
      candidate.removeAttribute('data-pass64-mission-layout');
    }
  });
  if (container) {
    container.setAttribute('data-pass63-mission-layout', canonicalLayoutType);
    container.setAttribute('data-pass64-mission-layout', canonicalLayoutType);
    container.classList.add('pass63-mission-layout-grid', 'pass66-mission-view-pane-grid');
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
      handle.dataset.pass63DragHandle = 'true';
      handle.setAttribute('type', 'button');
    }
  }
}`;
replaced = replaceNamedBlock(app, 'pass63RefreshMissionPaneDragTargets', refreshReplacement);
if (!replaced.changed) fail('could not replace pass63RefreshMissionPaneDragTargets');
app = replaced.source;

const closestHandleReplacement = `function pass64ClosestDragHandle(target: EventTarget | null): HTMLButtonElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLButtonElement>('.mission-pane-drag-handle[data-pass63-drag-handle="true"]');
}`;
app = replaceNamedBlock(app, 'pass64ClosestDragHandle', closestHandleReplacement).source;

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
  document.addEventListener('pointerdown', (event) => {
    const handle = pass64ClosestDragHandle(event.target);
    if (!handle || event.button !== 0) return;
    const pane = pass63ClosestMissionPane(handle);
    const paneId = pass63PaneIdFromElement(pane);
    const mission = currentMission as any;
    if (!mission || !pane || !paneId || !pass63MissionLayoutSupportsReorder(mission.layout.type)) return;
    pass66MissionPanePointerDragSource = paneId;
    pass66MissionPanePointerDragging = true;
    pane.classList.add('pass63-mission-pane-dragging');
    document.body.classList.add('pass66-mission-pane-pointer-dragging');
    handle.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }, true);
  document.addEventListener('pointermove', (event) => {
    if (!pass66MissionPanePointerDragging || !pass66MissionPanePointerDragSource) return;
    document.querySelectorAll('.pass63-mission-pane-drop-target').forEach((element) => element.classList.remove('pass63-mission-pane-drop-target'));
    const pane = pass63ClosestMissionPane(document.elementFromPoint(event.clientX, event.clientY));
    const targetPaneId = pass63PaneIdFromElement(pane);
    if (pane && targetPaneId && targetPaneId !== pass66MissionPanePointerDragSource) {
      pane.classList.add('pass63-mission-pane-drop-target');
    }
    event.preventDefault();
  }, true);
  document.addEventListener('pointerup', (event) => {
    if (!pass66MissionPanePointerDragging) return;
    const sourcePaneId = pass66MissionPanePointerDragSource;
    const pane = pass63ClosestMissionPane(document.elementFromPoint(event.clientX, event.clientY));
    const targetPaneId = pass63PaneIdFromElement(pane);
    pass66MissionPanePointerDragging = false;
    pass66MissionPanePointerDragSource = '';
    document.body.classList.remove('pass66-mission-pane-pointer-dragging');
    document.querySelectorAll('.pass63-mission-pane-drop-target,.pass63-mission-pane-dragging').forEach((element) => element.classList.remove('pass63-mission-pane-drop-target', 'pass63-mission-pane-dragging'));
    const mission = currentMission as any;
    if (!mission || !sourcePaneId || !targetPaneId || sourcePaneId === targetPaneId || !pass63MissionLayoutSupportsReorder(mission.layout.type)) return;
    event.preventDefault();
    event.stopPropagation();
    pass63SwapMissionPanes(sourcePaneId, targetPaneId);
  }, true);
  document.addEventListener('pointercancel', () => {
    pass66MissionPanePointerDragging = false;
    pass66MissionPanePointerDragSource = '';
    document.body.classList.remove('pass66-mission-pane-pointer-dragging');
    document.querySelectorAll('.pass63-mission-pane-drop-target,.pass63-mission-pane-dragging').forEach((element) => element.classList.remove('pass63-mission-pane-drop-target', 'pass63-mission-pane-dragging'));
  }, true);
  pass63MissionPaneDragMounted = true;
}`;
replaced = replaceNamedBlock(app, 'pass63MountMissionPaneDragReorder', dragReplacement);
if (!replaced.changed) fail('could not replace pass63MountMissionPaneDragReorder');
app = replaced.source;

const controlsReplacement = `function pass63MountTriViewUpgradeControls(): void {
  const layoutHost = document.querySelector<HTMLElement>('[data-mission-layouts], .mission-layouts, .mission-control-layouts, .mission-layout-buttons, #mission-layouts');
  if (!layoutHost) return;
  let panel = document.getElementById('pass63-triview-upgrade-controls') as HTMLElement | null;
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'pass63-triview-upgrade-controls';
    panel.className = 'pass63-triview-upgrade-controls pass66-triview-upgrade-controls';
    panel.innerHTML = '<div class="pass63-triview-header"><strong>Tri View</strong><span>Choose 3-pane wide/tall layouts.</span></div><div class="pass63-triview-buttons" role="group" aria-label="Tri View layout variants"><button type="button" data-pass63-triple-layout="triple-top">Top wide</button><button type="button" data-pass63-triple-layout="triple-bottom">Bottom wide</button><button type="button" data-pass63-triple-layout="triple-left">Left tall</button><button type="button" data-pass63-triple-layout="triple-right">Right tall</button></div>';
  }
  panel.classList.add('pass66-triview-upgrade-controls');
  if (panel.parentElement !== layoutHost) layoutHost.appendChild(panel);
  if (!pass63MissionLayoutUpgradeMounted) {
    panel.querySelectorAll<HTMLButtonElement>('[data-pass63-triple-layout]').forEach((button) => {
      button.addEventListener('click', () => {
        const layoutType = button.dataset.pass63TripleLayout as Pass63TripleLayoutType | undefined;
        if (!layoutType || !pass63TripleLayoutTypes.includes(layoutType)) return;
        pass63SetMissionLayout(layoutType as MissionLayoutType);
      });
    });
    pass63MissionLayoutUpgradeMounted = true;
  }
  pass63RefreshTriViewUpgradeControls();
}`;
replaced = replaceNamedBlock(app, 'pass63MountTriViewUpgradeControls', controlsReplacement);
if (!replaced.changed) fail('could not replace pass63MountTriViewUpgradeControls');
app = replaced.source;

const pass66FocusPaneFunction = `function pass66FocusMissionPaneByNumber(paneNumber: number): void {
  const mission = currentMission as any;
  if (!mission || paneNumber < 1 || paneNumber > 4) return;
  const paneId = 'pane-' + paneNumber;
  const visiblePaneIds = pass63VisiblePaneIds();
  if (!visiblePaneIds.includes(paneId)) return;
  mission.layout.activePaneId = paneId;
  const tabId = pass63PaneTabId(paneId);
  if (tabId && Array.isArray(mission.tabs)) {
    mission.tabs.forEach((tab: any) => { tab.active = tab.tabId === tabId; });
  }
  appendMissionTimelineEvent(mission, 'layout-set', 'Mission pane focused', 'Focused ' + paneId.replace('pane-', 'Pane ') + ' with Ctrl+Alt+' + paneNumber + '.');
  renderMissionControl();
  pass64ScheduleMissionPaneRefresh();
}`;

const pass66KeyboardFunction = `function pass66MountMissionPaneKeyboardShortcuts(): void {
  if (pass66MissionPaneKeyboardMounted) return;
  document.addEventListener('keydown', (event) => {
    if (!event.ctrlKey || !event.altKey || event.shiftKey || event.metaKey) return;
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
  }, true);
  pass66MissionPaneKeyboardMounted = true;
}`;

let pass66FocusReplace = replaceNamedBlock(app, 'pass66FocusMissionPaneByNumber', pass66FocusPaneFunction);
app = pass66FocusReplace.source;
let pass66KeyboardReplace = replaceNamedBlock(app, 'pass66MountMissionPaneKeyboardShortcuts', pass66KeyboardFunction);
app = pass66KeyboardReplace.source;
if (!pass66FocusReplace.changed || !pass66KeyboardReplace.changed) {
  const keyboardHelpers = (!pass66FocusReplace.changed ? pass66FocusPaneFunction + '\n\n' : '') + (!pass66KeyboardReplace.changed ? pass66KeyboardFunction + '\n\n' : '');
  app = app.replace(/function pass64ScheduleMissionPaneRefresh\(\): void \{/, keyboardHelpers + 'function pass64ScheduleMissionPaneRefresh(): void {');
}

const bootReplacement = `function pass64BootMissionPaneReorderHardening(): void {
  pass64ScheduleMissionPaneRefresh();
  pass66MountMissionPaneKeyboardShortcuts();
  if (!pass64MissionPaneObserverMounted && document.body && typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => pass64ScheduleMissionPaneRefresh());
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-pane-id', 'data-mission-pane-id', 'data-pass63-mission-pane-id'] });
    pass64MissionPaneObserverMounted = true;
  }
}`;
replaced = replaceNamedBlock(app, 'pass64BootMissionPaneReorderHardening', bootReplacement);
if (!replaced.changed) fail('could not replace pass64BootMissionPaneReorderHardening');
app = replaced.source;

if (!app.includes(marker)) {
  app = app.replace('// PASS 64 Tri-view repair and pane drag hardening', `// ${marker}\n// PASS 64 Tri-view repair and pane drag hardening`);
}
if (!app.includes(pass65Marker)) {
  app = app.replace('// PASS 64 Tri-view repair and pane drag hardening', `// ${pass65Marker}: retained strict DOM-safe drag-handle typing.\n// PASS 64 Tri-view repair and pane drag hardening`);
}
app = repairDomHandleTyping(app);

// Confine the previous PASS64 grid CSS to real Mission View pane grids only.
css = css.replace(/\.pass63-mission-layout-grid\[data-pass63-mission-layout=/g, '.pass66-mission-view-pane-grid.pass63-mission-layout-grid[data-pass63-mission-layout=');
css = css.replace(/\.pass63-mission-layout-grid\[data-pass64-mission-layout=/g, '.pass66-mission-view-pane-grid.pass63-mission-layout-grid[data-pass64-mission-layout=');
css = css.replace(/\.pass66-mission-view-pane-grid\.pass66-mission-view-pane-grid/g, '.pass66-mission-view-pane-grid');

const pass66Css = `

/* ${marker}: keep Mission Control config panels out of pane-grid CSS and make drag/focus controls reliable. */
.pass66-mission-view-pane-grid.pass63-mission-layout-grid {
  contain:layout paint;
}
body.pass66-mission-pane-pointer-dragging,
body.pass66-mission-pane-pointer-dragging * {
  cursor:grabbing !important;
  user-select:none !important;
}
body.pass66-mission-pane-pointer-dragging webview,
body.pass66-mission-pane-pointer-dragging iframe {
  pointer-events:none !important;
}
.pass66-triview-upgrade-controls.pass63-triview-upgrade-controls {
  display:inline-flex !important;
  align-items:center;
  gap:8px;
  margin:0 0 0 8px !important;
  padding:0 !important;
  border:0 !important;
  background:transparent !important;
  box-shadow:none !important;
  min-height:0 !important;
  max-width:100%;
}
.pass66-triview-upgrade-controls .pass63-triview-header {
  display:none !important;
}
.pass66-triview-upgrade-controls .pass63-triview-buttons {
  display:inline-flex !important;
  flex-wrap:wrap;
  gap:6px;
}
.pass66-triview-upgrade-controls .pass63-triview-buttons button {
  min-height:30px !important;
  padding:0 10px !important;
  font-size:.72rem !important;
}
.mission-recipes .mission-pane-drag-handle,
.runbook-rail .mission-pane-drag-handle,
.mission-tabs-list .mission-pane-drag-handle,
.mission-evidence .mission-pane-drag-handle {
  display:none !important;
}
`;
if (!css.includes(marker)) css += pass66Css;

pkg.scripts = pkg.scripts || {};
pkg.scripts['pass66:apply'] = 'node scripts/apply-pass66-mission-view-pane-runtime-repair.mjs';
pkg.scripts['verify:pass-66-mission-view-pane-runtime-repair'] = 'node scripts/verify-pass-66-mission-view-pane-runtime-repair.mjs';
const blockers = String(pkg.scripts['verify:release-blockers'] || '');
if (blockers && !blockers.includes('verify:pass-66-mission-view-pane-runtime-repair')) {
  const commands = blockers.split(/\s&&\s/).map((item) => item.trim()).filter(Boolean);
  const verifyCommand = 'npm run verify:pass-66-mission-view-pane-runtime-repair';
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

console.log('PASS66_APPLY_OK=Mission View pane targeting repaired, recipes protected, pointer drag fallback enabled, Ctrl+Alt+1..4 pane focus enabled');
