#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const fail = (message) => { console.error(`TAHAI_BROWSER_MISSION_TABS_UX_VERIFY_FAIL=${message}`); process.exit(1); };
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));

for (const rel of ['src/renderer/app.ts', 'src/main/mission-store.ts', 'src/preload/preload.ts', 'src/renderer/global.d.ts', 'src/renderer/styles/browser.css', 'docs/mission-tabs-ux-pass-07.md']) {
  if (!exists(rel)) fail(`missing ${rel}`);
}

const app = read('src/renderer/app.ts');
for (const token of [
  'renameCurrentMission',
  'normalizeMissionName',
  'duplicateMissionById',
  'deleteMissionById',
  'toggleMissionFocusPane',
  'moveMissionTabToPane',
  'toggleMissionTabPin',
  'removeMissionTab',
  'missionTabsListDragTabId',
  'data-drag-mission-tab',
  'data-pin-mission-tab',
  'data-remove-mission-tab',
  'Mission tab order changed',
  'Rename Current Mission'
]) {
  if (!app.includes(token)) fail(`app.ts missing token: ${token}`);
}
if (app.includes('window.prompt(') || app.includes('prompt(')) fail('native prompt usage returned');

const mainStore = read('src/main/mission-store.ts');
for (const token of ['export function deleteMission', 'missionFilePath(missionId)', 'fs.unlinkSync(filePath)']) {
  if (!mainStore.includes(token)) fail(`mission-store missing token: ${token}`);
}

const preload = read('src/preload/preload.ts');
if (!preload.includes('deleteMission: (missionId: string)')) fail('preload missing deleteMission API');

const globals = read('src/renderer/global.d.ts');
if (!globals.includes('deleteMission: (missionId: string)')) fail('renderer globals missing deleteMission API');

const css = read('src/renderer/styles/browser.css');
for (const token of ['.mission-tab-row.dragging', '.mission-tab-row.drag-over', '.mission-saved-actions']) {
  if (!css.includes(token)) fail(`browser.css missing token: ${token}`);
}

console.log('TAHAI_BROWSER_MISSION_TABS_UX_VERIFY=OK');
process.exit(0);
