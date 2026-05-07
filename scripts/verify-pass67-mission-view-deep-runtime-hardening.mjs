#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checks = [];
function read(relPath) {
  const filePath = path.join(root, relPath);
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
}
function requireToken(file, token, label = token) {
  const text = read(file);
  if (!text.includes(token)) checks.push(`${file} missing ${label}`);
}
function forbidToken(file, token, label = token) {
  const text = read(file);
  if (text.includes(token)) checks.push(`${file} still contains forbidden ${label}`);
}

requireToken('src/renderer/app.ts', 'PASS 67 Mission View deep runtime hardening');
requireToken('src/renderer/app.ts', 'pass67BaseSyncMissionLayoutPanesForMission');
requireToken('src/renderer/app.ts', 'pass67StableLayoutSupportsEmptyPanes');
requireToken('src/renderer/app.ts', 'pass67EnsureVisibleLayoutPanes');
requireToken('src/renderer/app.ts', 'pass67MissionPaneAtViewportPoint');
requireToken('src/renderer/app.ts', 'pass67ArmOrSwapMissionPane');
requireToken('src/renderer/app.ts', 'pass67MissionLayoutDropPreserverMounted');
requireToken('src/renderer/app.ts', 'pass67RestoreStableLayoutAfterDrop');
requireToken('src/renderer/app.ts', 'pass67-triview-variant-row');
requireToken('src/renderer/app.ts', 'window.addEventListener(\'keydown\', handler, true)');
requireToken('src/renderer/app.ts', 'pass67MissionPaneKeyboardHandlersMounted');
requireToken('src/renderer/app.ts', 'pass67SuppressMissionPaneHandleClickUntil');
requireToken('src/renderer/app.ts', 'pass67PointIsInsideRect');
requireToken('src/renderer/app.ts', 'root.hidden = !mission');
requireToken('src/renderer/styles/browser.css', 'PASS 67 Mission View deep runtime hardening');
requireToken('src/renderer/styles/browser.css', '#pass63-triview-upgrade-controls.pass67-triview-variant-row');
requireToken('src/renderer/styles/browser.css', '.pass67-mission-pane-swap-armed');
requireToken('src/renderer/styles/browser.css', '@media (max-width: 1100px), (max-height: 720px)');
requireToken('src/renderer/styles/browser.css', 'grid-auto-rows:minmax(180px,42vh)');
requireToken('package.json', 'verify:pass-67-mission-view-deep-runtime-hardening');
forbidToken('src/renderer/app.ts', "'layout-changed'", 'layout-changed single-quoted event literal');
forbidToken('src/renderer/app.ts', '"layout-changed"', 'layout-changed double-quoted event literal');
forbidToken('src/renderer/app.ts', 'handle.type = \'button\'', 'HTMLElement handle.type assignment');
forbidToken('src/renderer/app.ts', 'handle.type = "button"', 'HTMLElement handle.type assignment');

if (checks.length) {
  for (const check of checks) console.error(`PASS67_MISSION_VIEW_DEEP_HARDENING_ERROR=${check}`);
  process.exit(1);
}
console.log('PASS67_MISSION_VIEW_DEEP_HARDENING=OK');
