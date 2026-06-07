#!/usr/bin/env node
import fs from 'node:fs';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';
const app = fs.readFileSync('src/renderer/app.ts', 'utf8');
const css = fs.readFileSync('src/renderer/styles/browser.css', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const failures = [];
const need = (name, ok) => { if (!ok) failures.push(name); };
need('script registered', pkg.scripts?.['verify:pass-76-mission-view-direct-controls-health'] === 'node scripts/verify-pass-76-mission-view-direct-controls-health.mjs');
need('release blockers include pass76', getReleaseBlockersContract(pkg).includes('verify:pass-76-mission-view-direct-controls-health'));
need('direct move layer function', app.includes('function pass76EnsureMissionPaneMoveLayer') && app.includes('pass76-mission-pane-move-layer'));
need('direct move handle function', app.includes('function pass76MoveHandleForPane') && app.includes('pass76-mission-pane-direct-move'));
need('autosize off in pane bounds', app.includes("guest.setAttribute('autosize', 'off')"));
need('removed minmax attr trap', app.includes("guest.removeAttribute('minheight')") && app.includes("guest.removeAttribute('maxheight')"));
need('resize nudge', app.includes('function pass76NudgeWebviewGuestResize') && app.includes('pass76ResizeNudge'));
need('health check', app.includes('function pass76RunMissionPaneHealthCheck') && app.includes('pass76PaneHealthSignature'));
need('repair loop', app.includes('function pass76StartMissionPaneRepairLoop') && app.includes('pass76MissionPaneRepairLoopToken'));
need('direct controls class', app.includes('pass76-mission-view-direct-controls'));
need('CSS direct layer', css.includes('PASS76 Mission View direct controls') && css.includes('.pass76-mission-pane-move-layer'));
need('CSS clickable direct move', css.includes('pointer-events: auto !important') && css.includes('.pass76-mission-pane-direct-move.mission-pane-drag-handle'));
if (failures.length) { console.error('PASS76_MISSION_VIEW_DIRECT_CONTROLS_HEALTH_FAIL=' + failures.join(';')); process.exit(1); }
console.log('PASS76_MISSION_VIEW_DIRECT_CONTROLS_HEALTH=OK');
