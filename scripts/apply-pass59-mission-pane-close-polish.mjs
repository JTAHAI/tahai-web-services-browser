#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appPath = path.join(root, 'src/renderer/app.ts');
const cssPath = path.join(root, 'src/renderer/styles/browser.css');
const pkgPath = path.join(root, 'package.json');

function fail(message) {
  console.error(`PASS59_APPLY_FAIL=${message}`);
  process.exit(1);
}

function read(relPath) {
  const fullPath = path.join(root, relPath);
  if (!fs.existsSync(fullPath)) fail(`missing ${relPath}`);
  return fs.readFileSync(fullPath, 'utf8').replace(/^\uFEFF/, '');
}

function write(relPath, text) {
  fs.writeFileSync(path.join(root, relPath), text.replace(/\r\n/g, '\n').replace(/\r/g, '\n'), 'utf8');
}

function findFunctionBodyRange(source, functionName) {
  const signature = new RegExp(`function\\s+${functionName}\\s*\\(([^)]*)\\)\\s*[:\\w\\s<>,|\\[\\]{}.'\"?-]*\\s*\\{`, 'm');
  const match = signature.exec(source);
  if (!match) return null;
  const openIndex = source.indexOf('{', match.index + match[0].lastIndexOf('{') - 1);
  let depth = 0;
  let inString = '';
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = openIndex; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];
    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (char === '*' && next === '/') { inBlockComment = false; i += 1; }
      continue;
    }
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
      if (depth === 0) {
        return { signatureStart: match.index, openIndex, closeIndex: i, args: match[1] };
      }
    }
  }
  return null;
}

function upsertPackageScript(pkg) {
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['verify:pass-59-mission-pane-close-polish'] = 'node scripts/verify-pass-59-mission-pane-close-polish.mjs';
  const releaseBlockers = String(pkg.scripts['verify:release-blockers'] || '');
  if (releaseBlockers && !releaseBlockers.includes('verify:pass-59-mission-pane-close-polish')) {
    pkg.scripts['verify:release-blockers'] = releaseBlockers.replace(/\s&&\s+npm run build\s*$/, ' && npm run verify:pass-59-mission-pane-close-polish && npm run build');
    if (!pkg.scripts['verify:release-blockers'].includes('verify:pass-59-mission-pane-close-polish')) {
      pkg.scripts['verify:release-blockers'] = `${releaseBlockers} && npm run verify:pass-59-mission-pane-close-polish`;
    }
  }
}

let app = read('src/renderer/app.ts');
let css = read('src/renderer/styles/browser.css');
const pkg = JSON.parse(read('package.json'));

if (!app.includes('function removeMissionTab')) fail('src/renderer/app.ts missing removeMissionTab function');
if (!app.includes('currentMission')) fail('src/renderer/app.ts missing currentMission state');
if (!app.includes('missionLayoutsEl')) fail('src/renderer/app.ts missing missionLayoutsEl');
if (!app.includes('syncMissionLayoutPanesForMission')) fail('src/renderer/app.ts missing syncMissionLayoutPanesForMission');

const pass59Helpers = `
// PASS 59 Mission pane close polish: configurable pane-close refactor behavior.
type MissionPaneCloseBehavior = 'auto-refactor' | 'leave-blank';
const missionPaneCloseBehaviorStorageKey = 'tahai.browser.missionPaneCloseBehavior';
let missionPaneClosePreferenceMounted = false;

function missionPaneCloseBehavior(): MissionPaneCloseBehavior {
  try {
    const stored = window.localStorage.getItem(missionPaneCloseBehaviorStorageKey);
    if (stored === 'leave-blank') return 'leave-blank';
  } catch {
    // localStorage can be unavailable in some hardened renderer states; default safe UX still applies.
  }
  return 'auto-refactor';
}

function setMissionPaneCloseBehavior(value: MissionPaneCloseBehavior): void {
  try {
    window.localStorage.setItem(missionPaneCloseBehaviorStorageKey, value);
  } catch {
    // Non-fatal; keep in-memory behavior default.
  }
  refreshMissionPaneCloseControls();
}

function pass59VisibleAssignedMissionPanes(): Array<{ paneId: string; tabId: string }> {
  if (!currentMission) return [];
  syncMissionLayoutPanesForMission(currentMission);
  const visible = new Set(visibleMissionPaneIds(currentMission.layout.type, currentMission.layout.activePaneId));
  return currentMission.layout.panes
    .filter((pane) => visible.has(pane.paneId) && Boolean(pane.tabId))
    .map((pane) => ({ paneId: pane.paneId, tabId: pane.tabId }));
}

function pass59MissionPaneTabId(paneId: string): string {
  if (!currentMission) return '';
  return currentMission.layout.panes.find((pane) => pane.paneId === paneId)?.tabId ||
    currentMission.tabs.find((tab) => tab.paneId === paneId)?.tabId ||
    '';
}

function pass59LayoutForAssignedPaneCount(count: number, fallback: MissionLayoutType): MissionLayoutType {
  if (count <= 1) return 'focus';
  if (count === 2) return fallback === 'split-vertical' ? 'split-vertical' : 'split-horizontal';
  if (count === 3) return 'triple-bottom';
  return 'quad';
}

function refactorMissionLayoutAfterPaneClose(closedPaneId = ''): void {
  if (!currentMission || missionPaneCloseBehavior() !== 'auto-refactor') return;
  syncMissionLayoutPanesForMission(currentMission);
  const assigned = pass59VisibleAssignedMissionPanes();
  const previousLayout = currentMission.layout.type;
  const nextActivePane = assigned[0]?.paneId || currentMission.layout.activePaneId || 'pane-1';
  const nextLayout = pass59LayoutForAssignedPaneCount(assigned.length, previousLayout);
  currentMission.layout.type = nextLayout;
  currentMission.layout.activePaneId = nextActivePane;
  syncMissionLayoutPanesForMission(currentMission);
  appendMissionTimelineEvent(
    currentMission,
    'layout-set',
    'Mission pane closed',
    closedPaneId
      ? 'Closed ' + closedPaneId + ' and refactored Mission Control to ' + missionLayoutLabel(nextLayout) + '.'
      : 'Closed pane and refactored Mission Control to ' + missionLayoutLabel(nextLayout) + '.'
  );
}

function closeMissionPaneById(paneId: string): void {
  const tabId = pass59MissionPaneTabId(paneId);
  if (!tabId) return;
  removeMissionTab(tabId);
  refactorMissionLayoutAfterPaneClose(paneId);
  refreshMissionPaneCloseControls();
}

function closeActiveMissionPane(): void {
  if (!currentMission) return;
  const activePaneId = currentMission.layout.activePaneId || 'pane-1';
  closeMissionPaneById(activePaneId);
}

function refreshMissionPaneCloseControls(): void {
  const root = document.getElementById('mission-pane-close-preferences');
  if (!root) return;
  const behavior = missionPaneCloseBehavior();
  root.querySelectorAll<HTMLButtonElement>('[data-mission-pane-close-behavior]').forEach((button) => {
    const active = button.dataset.missionPaneCloseBehavior === behavior;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const list = root.querySelector<HTMLElement>('[data-mission-pane-close-list]');
  if (!list) return;
  list.replaceChildren();
  const panes = pass59VisibleAssignedMissionPanes();
  if (!currentMission || panes.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'mission-pane-close-empty';
    empty.textContent = 'No active Mission panes to close.';
    list.append(empty);
    return;
  }
  for (const pane of panes) {
    const tab = currentMission.tabs.find((candidate) => candidate.tabId === pane.tabId);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mission-pane-close-button';
    button.dataset.closeMissionPane = pane.paneId;
    button.title = 'Close ' + pane.paneId + (tab?.title ? ': ' + tab.title : '');
    button.textContent = '× ' + pane.paneId.replace('pane-', 'Pane ');
    button.addEventListener('click', () => closeMissionPaneById(pane.paneId));
    list.append(button);
  }
}

function mountMissionPaneClosePreferenceControl(): void {
  if (missionPaneClosePreferenceMounted || !missionLayoutsEl) return;
  const panel = document.createElement('section');
  panel.id = 'mission-pane-close-preferences';
  panel.className = 'mission-pane-close-preferences';
  panel.innerHTML = '<div class="mission-pane-close-header"><strong>Pane close behavior</strong><span>Close active Mission panes without hunting through the tab list.</span></div><div class="mission-pane-close-mode" role="group" aria-label="Mission pane close behavior"><button type="button" data-mission-pane-close-behavior="auto-refactor">Auto-refactor</button><button type="button" data-mission-pane-close-behavior="leave-blank">Leave blank panes</button><button type="button" data-close-active-mission-pane>Close active pane</button></div><div class="mission-pane-close-list" data-mission-pane-close-list></div>';
  missionLayoutsEl.insertAdjacentElement('afterend', panel);
  panel.querySelectorAll<HTMLButtonElement>('[data-mission-pane-close-behavior]').forEach((button) => {
    button.addEventListener('click', () => {
      const value = button.dataset.missionPaneCloseBehavior === 'leave-blank' ? 'leave-blank' : 'auto-refactor';
      setMissionPaneCloseBehavior(value);
    });
  });
  panel.querySelector<HTMLButtonElement>('[data-close-active-mission-pane]')?.addEventListener('click', closeActiveMissionPane);
  missionPaneClosePreferenceMounted = true;
  refreshMissionPaneCloseControls();
}

window.setInterval(() => {
  mountMissionPaneClosePreferenceControl();
  refreshMissionPaneCloseControls();
}, 1200);
`;

if (!app.includes('PASS 59 Mission pane close polish')) {
  const removeRange = findFunctionBodyRange(app, 'removeMissionTab');
  if (!removeRange) fail('could not locate removeMissionTab function body');
  app = app.slice(0, removeRange.signatureStart) + pass59Helpers + '\n' + app.slice(removeRange.signatureStart);
}

if (!app.includes('refactorMissionLayoutAfterPaneClose(pass59ClosedPaneId);')) {
  const removeRange = findFunctionBodyRange(app, 'removeMissionTab');
  if (!removeRange) fail('could not locate removeMissionTab function body after helper insertion');
  const firstArg = removeRange.args.split(',')[0]?.trim().replace(/[:=].*$/, '').trim();
  if (!firstArg) fail('could not infer removeMissionTab first argument name');
  const afterOpen = removeRange.openIndex + 1;
  const topInsert = `\n  const pass59ClosedPaneId = currentMission?.tabs.find((tab) => tab.tabId === ${firstArg})?.paneId || '';`;
  app = app.slice(0, afterOpen) + topInsert + app.slice(afterOpen);
  const refreshedRange = findFunctionBodyRange(app, 'removeMissionTab');
  if (!refreshedRange) fail('could not refresh removeMissionTab body after top insertion');
  const bottomInsert = `\n  refactorMissionLayoutAfterPaneClose(pass59ClosedPaneId);\n  refreshMissionPaneCloseControls();\n`;
  app = app.slice(0, refreshedRange.closeIndex) + bottomInsert + app.slice(refreshedRange.closeIndex);
}

const cssBlock = `

/* PASS 59 Mission pane close polish */
.mission-pane-close-preferences {
  display:grid;
  gap:10px;
  margin:12px 0 0;
  padding:12px;
  border:1px solid rgba(119,219,255,.18);
  border-radius:16px;
  background:linear-gradient(180deg,rgba(119,219,255,.07),rgba(255,255,255,.025));
  box-shadow:inset 0 0 18px rgba(119,219,255,.045);
}
.mission-pane-close-header { display:grid; gap:4px; }
.mission-pane-close-header strong { color:var(--cyan); letter-spacing:.08em; text-transform:uppercase; font-size:.72rem; }
.mission-pane-close-header span { color:var(--muted); font-size:.78rem; line-height:1.35; }
.mission-pane-close-mode,.mission-pane-close-list { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
.mission-pane-close-mode button,.mission-pane-close-button {
  min-height:34px;
  border:1px solid rgba(119,219,255,.20);
  border-radius:999px;
  padding:0 12px;
  color:var(--text);
  background:rgba(255,255,255,.045);
  cursor:pointer;
  font-weight:800;
}
.mission-pane-close-mode button:hover,.mission-pane-close-button:hover,
.mission-pane-close-mode button:focus-visible,.mission-pane-close-button:focus-visible {
  border-color:rgba(119,219,255,.58);
  background:rgba(119,219,255,.12);
  outline:none;
}
.mission-pane-close-mode button.active {
  color:#03101a;
  border-color:rgba(119,219,255,.70);
  background:linear-gradient(180deg,var(--cyan),#2f8fff);
  box-shadow:0 0 18px rgba(119,219,255,.22);
}
.mission-pane-close-button {
  border-color:rgba(255,106,106,.34);
  background:rgba(255,106,106,.08);
}
.mission-pane-close-empty { color:var(--muted); font-size:.78rem; }
[data-remove-mission-tab] {
  min-width:34px;
  min-height:34px;
  border-radius:999px;
  font-size:1rem;
  font-weight:900;
}
`;

if (!css.includes('PASS 59 Mission pane close polish')) css += cssBlock;

upsertPackageScript(pkg);

write('src/renderer/app.ts', app);
write('src/renderer/styles/browser.css', css);
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

console.log('PASS59_APPLY_OK=mission pane close polish applied');
