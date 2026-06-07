#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';
const root = process.cwd();
const app = fs.readFileSync(path.join(root, 'src', 'renderer', 'app.ts'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src', 'renderer', 'styles', 'browser.css'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
function fail(message) { console.error(`PASS71_MISSION_VIEW_PANE_SHELL_ISOLATION_FAIL=${message}`); process.exit(1); }
function mustInclude(text, token, message) { if (!text.includes(token)) fail(message || `missing-${token}`); }
mustInclude(app, 'ensureMissionPaneShell', 'missing-pane-shell-factory');
mustInclude(app, 'restoreWebviewsToStageRoot', 'missing-normal-mode-webview-restore');
mustInclude(app, 'shell.appendChild(runtimeTab.webview)', 'webview-not-mounted-inside-shell');
mustInclude(app, "element.closest('.mission-pane-heads,.mission-pane-head-cell,.mission-pane-head,.mission-pane-drop-zones,.mission-pane-drop-zone')", 'head-drop-overlays-not-rejected-as-panes');
mustInclude(app, "shell.className = 'mission-pane-shell mission-view-pane pane-'", 'missing-mission-pane-shell-class');
mustInclude(app, 'shell.dataset.pass63MissionPaneId = paneId', 'shell-missing-pass63-pane-id');
mustInclude(app, 'pass64ScheduleMissionPaneRefresh();', 'pane-refresh-not-scheduled-after-shell-layout');
mustInclude(css, 'PASS71 Mission View pane-shell isolation', 'missing-pass71-css-marker');
mustInclude(css, '.webview-stage.mission-layout > webview.browser-view', 'direct-webviews-not-hidden-in-mission-mode');
mustInclude(css, '.webview-stage.mission-layout .mission-pane-shell > webview.browser-view', 'missing-shell-webview-selector');
mustInclude(css, 'display: inline-flex !important', 'hosted-webview-not-inline-flex');
mustInclude(css, 'webview.browser-view::before', 'webview-pseudo-elements-not-disabled');
mustInclude(css, 'content: none !important', 'webview-pseudo-content-not-cleared');
mustInclude(css, '.mission-pane-shell::before', 'pane-label-not-moved-to-shell');
mustInclude(css, 'backdrop-filter: none !important', 'pane-head-drag-backdrop-blur-not-cleared');
mustInclude(css, '.webview-stage.mission-layout-triple-bottom .mission-pane-shell[data-pane-id="pane-3"]', 'shell-triple-bottom-layout-missing');
mustInclude(css, '.webview-stage.mission-layout-triple-left .mission-pane-shell[data-pane-id="pane-1"]', 'shell-triple-left-layout-missing');
const shellWebviewBlock = css.match(/\.webview-stage\.mission-layout \.mission-pane-shell > webview\.browser-view,[\s\S]*?\n}/)?.[0] || '';
if (!shellWebviewBlock) fail('missing-shell-webview-block');
for (const forbidden of ['filter: blur', 'transform: scale', 'opacity: .', 'opacity: 0.', 'backdrop-filter']) if (shellWebviewBlock.includes(forbidden)) fail(`forbidden-webview-compositor-style-${forbidden.replace(/[^a-z0-9]+/gi, '-')}`);
if (pkg.scripts['verify:pass-71-mission-view-pane-shell-isolation'] !== 'node scripts/verify-pass-71-mission-view-pane-shell-isolation.mjs') fail('package-script-not-registered');
if (!getReleaseBlockersContract(pkg).includes('verify:pass-71-mission-view-pane-shell-isolation')) fail('release-blockers-not-wired');
console.log('PASS71_MISSION_VIEW_PANE_SHELL_ISOLATION=OK');
