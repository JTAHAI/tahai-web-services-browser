#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const evidencePath = path.join(root, 'release-candidate', 'generated', 'pass351-daily-driver-surface-and-workbench-toggle-report.json');
const results = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, '');
}

function json(file) {
  return JSON.parse(read(file));
}

function record(id, ok, detail) {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${detail ? ` - ${detail}` : ''}`);
}

function need(id, condition, detail) {
  record(id, Boolean(condition), detail);
}

function includesAll(file, id, tokens) {
  const text = read(file);
  const missing = tokens.filter((token) => !text.includes(token));
  record(id, missing.length === 0, missing.length ? `${file} missing ${missing.join(', ')}` : file);
  return text;
}

const pkg = json('package.json');
const blockers = getReleaseBlockersContract(pkg);

includesAll('src/main/settings.ts', 'settings-surface-fields', [
  'surfaceMode: BrowserSurfaceMode;',
  'showWorkbenchTools: boolean;',
  "surfaceMode: 'tahai-workbench'",
  'showWorkbenchTools: true',
  'function cleanSurfaceMode(value: unknown): BrowserSurfaceMode',
  'surfaceMode: cleanSurfaceMode(rawUi.surfaceMode),',
  'showWorkbenchTools: cleanBoolean(rawUi.showWorkbenchTools, DEFAULT_BROWSER_SETTINGS.ui.showWorkbenchTools)'
]);

includesAll('src/preload/preload.ts', 'preload-surface-fields', [
  "surfaceMode: 'tahai-workbench' | 'daily-driver';",
  'showWorkbenchTools: boolean;'
]);

includesAll('src/renderer/renderer-shell-lifecycle.ts', 'renderer-fallback-surface-fields', [
  "surfaceMode: 'tahai-workbench'",
  'showWorkbenchTools: true'
]);

includesAll('src/shared/enterprise-admin-policy-contract.ts', 'managed-policy-surface-locks', [
  "surfaceMode?: 'tahai-workbench' | 'daily-driver';",
  'showWorkbenchTools?: boolean;',
  "'showStatusBar', 'openExternalLinksInNewTab', 'allowPopupsAsTabs', 'launchToMaximized', 'confirmBeforeClosingMultipleTabs', 'showWorkbenchTools'",
  "cleanEnum(ui.surfaceMode, ['tahai-workbench', 'daily-driver'] as const, 'tahai-workbench')",
  "if (typeof ui.surfaceMode === 'string') cleanUi.surfaceMode = surfaceMode;"
]);

includesAll('src/renderer/index.html', 'settings-ui-pass351', [
  'data-pass351-daily-driver-surface-toggle="true"',
  'setting-surface-mode',
  'setting-show-workbench-tools',
  'Daily-driver mode hides TAHAI branding from the shell chrome.'
]);

includesAll('src/renderer/styles/browser.css', 'loaded-stylesheet-pass351-contract', [
  'PASS351 daily-driver surface toggle',
  'body[data-pass351-browser-surface-mode="daily-driver"] .topbar .brand',
  'body[data-pass351-browser-surface-mode="daily-driver"] .topbar'
]);

includesAll('src/renderer/responsive-toolbar.ts', 'responsive-toolbar-pass351-owner', [
  "const PASS351_BROWSER_SURFACE_MODE_CHANGE_EVENT = 'tahai:browser-surface-mode-change';",
  'function pass351OverflowItemVisible(item: ManagedItem): boolean',
  ".filter((item) => pass351OverflowItemVisible(item))",
  "document.addEventListener(PASS351_BROWSER_SURFACE_MODE_CHANGE_EVENT, () => scheduleRelayout(0));"
]);

const renderer = includesAll('src/renderer/app.ts', 'renderer-pass351-surface-owner', [
  "const settingSurfaceMode = document.getElementById('setting-surface-mode') as HTMLSelectElement;",
  "const settingShowWorkbenchTools = document.getElementById('setting-show-workbench-tools') as HTMLInputElement;",
  "const PASS351_BROWSER_SURFACE_MODE_CHANGE_EVENT = 'tahai:browser-surface-mode-change';",
  'function pass351PreferredNewTabUrl(): string {',
  'document.body.dataset.pass351BrowserSurfaceMode = surfaceMode;',
  "document.body.dataset.pass351WorkbenchChrome = showWorkbenchChrome ? 'visible' : 'hidden';",
  "pass351SetSurfaceHidden(brandBlock, surfaceMode === 'daily-driver');",
  "pass351SetSurfaceHidden(devopsToolsFlyout, !showWorkbenchChrome);",
  "pass351SetSurfaceHidden(itToolsFlyout, !showWorkbenchChrome);",
  "pass351SetSurfaceHidden(missionControlButton, !showWorkbenchChrome);",
  'document.dispatchEvent(new CustomEvent(PASS351_BROWSER_SURFACE_MODE_CHANGE_EVENT, {',
  "pass341ScheduleNormalBrowserAndFeatureClickabilityCloseout('pass351-browser-surface-mode');",
  "settingSurfaceMode.value = settings.ui?.surfaceMode === 'daily-driver' ? 'daily-driver' : 'tahai-workbench';",
  'settingShowWorkbenchTools.checked = settings.ui?.showWorkbenchTools !== false;',
  "surfaceMode: settingSurfaceMode.value === 'daily-driver' ? 'daily-driver' : 'tahai-workbench',",
  'showWorkbenchTools: settingShowWorkbenchTools.checked',
  "case 'ui.surfaceMode': return typeof locked?.ui?.surfaceMode === 'string';",
  "case 'ui.showWorkbenchTools': return typeof locked?.ui?.showWorkbenchTools === 'boolean';",
  "pass349MarkManagedSetting(settingSurfaceMode, pass349ManagedSettingLocked('ui.surfaceMode'));",
  "pass349MarkManagedSetting(settingShowWorkbenchTools, pass349ManagedSettingLocked('ui.showWorkbenchTools'));"
]);

need(
  'new-tab-prefers-daily-driver-url',
  renderer.includes("if (settings?.startup === 'launchpad') return pass351PreferredNewTabUrl();")
    && renderer.includes("if (command === 'new-tab') createTab(pass351PreferredNewTabUrl());")
    && renderer.includes("newTabButton.addEventListener('click', () => { closeToolMenus(undefined, false); createTab(pass351PreferredNewTabUrl()); });")
    && renderer.includes("if (event.ctrlKey && event.key.toLowerCase() === 't') { event.preventDefault(); createTab(pass351PreferredNewTabUrl()); }"),
  'Daily-driver mode should route startup and new-tab creation through the preferred unbranded tab target.'
);

need(
  'package-script-present',
  pkg.scripts['verify:pass-351-daily-driver-surface-and-workbench-toggle'] === 'node scripts/verify-pass-351-daily-driver-surface-and-workbench-toggle.mjs',
  'package.json should expose PASS351.'
);

const pass350Idx = blockers.indexOf('verify:pass-350-settings-daily-driver-safe-surface');
const pass351Idx = blockers.indexOf('verify:pass-351-daily-driver-surface-and-workbench-toggle');
const buildIdx = blockers.lastIndexOf('npm run build');
need('release-blockers-include-pass351', pass351Idx >= 0, 'PASS351 should be part of the active release-blocker contract.');
need('release-blockers-order-pass351', pass350Idx >= 0 && pass351Idx > pass350Idx && buildIdx > pass351Idx, 'PASS351 should run after PASS350 and before the final build/runtime lanes.');

includesAll('docs/qa/PASS351-DAILY-DRIVER-SURFACE-AND-WORKBENCH-TOGGLE.md', 'qa-doc-pass351', [
  'PASS351',
  'Daily-Driver Surface And Workbench Toggle',
  'hide TAHAI branding',
  'workbench buttons',
  'preferred new tab'
]);

need('no-unsafe-allowpopups-added', !/allowpopups\s*=?\s*["']?true/i.test(`${read('src/main/main.ts')}\n${read('src/renderer/app.ts')}`), 'No unsafe allowpopups behavior should be introduced.');
need('no-node-in-remote-content-added', !/nodeIntegration\s*:\s*true|contextIsolation\s*:\s*false|webSecurity\s*:\s*false/i.test(`${read('src/main/main.ts')}\n${read('src/main/settings.ts')}`), 'No Node/webSecurity regression should be introduced.');
need('no-raw-ipc-exposure-added', !/contextBridge\.exposeInMainWorld\([^)]*ipcRenderer/s.test(read('src/preload/preload.ts')), 'Preload must not expose raw ipcRenderer.');

const ok = results.every((entry) => entry.ok);
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, JSON.stringify({
  pass: 'PASS351',
  ok,
  generatedAt: new Date().toISOString(),
  results
}, null, 2));

if (!ok) {
  console.error('PASS351_VERIFY_RESULT=FAIL');
  console.error(`PASS351_REPORT=${path.relative(root, evidencePath).replace(/\\/g, '/')}`);
  process.exit(1);
}

console.log('PASS351_VERIFY_RESULT=PASS');
console.log(`PASS351_REPORT=${path.relative(root, evidencePath).replace(/\\/g, '/')}`);
