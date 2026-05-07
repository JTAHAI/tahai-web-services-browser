#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const errors = [];
const read = (rel) => fs.existsSync(path.join(root, rel)) ? fs.readFileSync(path.join(root, rel), 'utf8').replace(/^\uFEFF/, '') : '';
const req = (rel, token) => { if (!read(rel).includes(token)) errors.push(`${rel} missing ${token}`); };
for (const token of ["if (count === 3) return 'triple-bottom'", 'PASS68 Mission View source-truth hardening', 'pass68MissionPaneClickSwapSource', 'pass68ArmOrSwapMissionPaneByClick', 'Mission pane move armed']) req('src/renderer/app.ts', token);
for (const token of ["layout === 'triple-top'", "layout === 'triple-bottom'", "return '3-Up Top Wide'", "return '3-Up Bottom Wide'"]) req('src/renderer/mission-model.ts', token);
for (const token of ['.webview-stage.mission-layout-triple-top', '.pass63-mission-pane-reorderable > .mission-pane-drag-handle', 'pointer-events: none', '.pass68-mission-pane-click-swap-source']) req('src/renderer/styles/browser.css', token);
const pkg = JSON.parse(read('package.json') || '{}');
if (!pkg.scripts?.['verify:pass-68-mission-view-source-truth-hardening']) errors.push('package.json missing PASS68 verifier script');
if (errors.length) { for (const error of errors) console.error(`PASS68_MISSION_VIEW_SOURCE_TRUTH_HARDENING_ERROR=${error}`); process.exit(1); }
console.log('PASS68_MISSION_VIEW_SOURCE_TRUTH_HARDENING=OK');
