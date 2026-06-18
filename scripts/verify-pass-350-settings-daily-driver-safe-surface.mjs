#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const evidencePath = path.join(root, 'release-candidate', 'generated', 'pass350-settings-daily-driver-safe-surface-report.json');
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
const settings = includesAll('src/main/settings.ts', 'settings-contract-fields', [
  'openExternalLinksInNewTab',
  'launchToMaximized',
  'confirmBeforeClosingMultipleTabs',
  'openExternalLinksInNewTab: true',
  'launchToMaximized: false',
  'confirmBeforeClosingMultipleTabs: false',
  'cleanBoolean(rawUi.openExternalLinksInNewTab',
  'cleanBoolean(rawUi.launchToMaximized',
  'cleanBoolean(rawUi.confirmBeforeClosingMultipleTabs'
]);

includesAll('src/preload/preload.ts', 'preload-settings-type', [
  'openExternalLinksInNewTab: boolean;',
  'launchToMaximized: boolean;',
  'confirmBeforeClosingMultipleTabs: boolean;'
]);

includesAll('src/renderer/renderer-shell-lifecycle.ts', 'renderer-fallback-settings', [
  'openExternalLinksInNewTab: true',
  'launchToMaximized: false',
  'confirmBeforeClosingMultipleTabs: false'
]);

includesAll('src/shared/enterprise-admin-policy-contract.ts', 'managed-policy-lock-surface', [
  'openExternalLinksInNewTab?: boolean;',
  'launchToMaximized?: boolean;',
  'confirmBeforeClosingMultipleTabs?: boolean;',
  "'showStatusBar', 'openExternalLinksInNewTab', 'allowPopupsAsTabs', 'launchToMaximized', 'confirmBeforeClosingMultipleTabs'"
]);

includesAll('src/renderer/index.html', 'settings-ui-controls', [
  'data-pass350-settings-daily-driver-safe-surface="true"',
  'setting-open-external-in-tab',
  'setting-launch-maximized',
  'setting-confirm-close-multi-tab',
  'Keep safe external handoffs inside new TAHAI tabs',
  'Launch maximized next time',
  'Confirm before closing when multiple tabs are open'
]);

includesAll('src/renderer/styles/browser.css', 'loaded-stylesheet-pass350-contract', [
  'PASS350 settings daily-driver safe surface'
]);

const renderer = includesAll('src/renderer/app.ts', 'renderer-settings-owner', [
  "const settingOpenExternalInTab = document.getElementById('setting-open-external-in-tab')",
  "const settingLaunchMaximized = document.getElementById('setting-launch-maximized')",
  "const settingConfirmCloseMultiTab = document.getElementById('setting-confirm-close-multi-tab')",
  'settingOpenExternalInTab.checked = settings.ui?.openExternalLinksInNewTab !== false;',
  'settingLaunchMaximized.checked = settings.ui?.launchToMaximized === true;',
  'settingConfirmCloseMultiTab.checked = settings.ui?.confirmBeforeClosingMultipleTabs === true;',
  'openExternalLinksInNewTab: settingOpenExternalInTab.checked,',
  'launchToMaximized: settingLaunchMaximized.checked,',
  'confirmBeforeClosingMultipleTabs: settingConfirmCloseMultiTab.checked',
  "case 'ui.openExternalLinksInNewTab': return typeof locked?.ui?.openExternalLinksInNewTab === 'boolean';",
  "case 'ui.launchToMaximized': return typeof locked?.ui?.launchToMaximized === 'boolean';",
  "case 'ui.confirmBeforeClosingMultipleTabs': return typeof locked?.ui?.confirmBeforeClosingMultipleTabs === 'boolean';",
  "pass349MarkManagedSetting(settingOpenExternalInTab, pass349ManagedSettingLocked('ui.openExternalLinksInNewTab'));",
  "pass349MarkManagedSetting(settingLaunchMaximized, pass349ManagedSettingLocked('ui.launchToMaximized'));",
  "pass349MarkManagedSetting(settingConfirmCloseMultiTab, pass349ManagedSettingLocked('ui.confirmBeforeClosingMultipleTabs'));",
  "showSettingsResult(launchModeChanged ? 'Settings saved. Launch mode applies on next start.' : 'Settings saved.');"
]);

need(
  'renderer-safe-external-routing',
  renderer.includes("if (settings?.ui?.openExternalLinksInNewTab !== false && /^https?:/i.test(url)) {")
    && renderer.includes("document.body.dataset.pass343LastBrowserKitAction = 'open-external:tab';")
    && renderer.includes("setStatus('Opened active page in a new TAHAI tab', url);")
    && renderer.includes('const tabId = createTab(url);'),
  'Browser Kit open-external action should honor the safe in-app handoff toggle before shell.openExternal is considered.'
);

need(
  'renderer-close-tab-confirmation',
  renderer.includes("settings?.ui?.confirmBeforeClosingMultipleTabs === true")
    && renderer.includes('window.confirm(`Close "${tab.title}"?')
    && renderer.includes("document.body.dataset.pass350LastMultiTabClosePrompt = approved ? 'accepted' : 'dismissed';"),
  'Interactive multi-tab close confirmation should be optional, bounded to the browser tab owner, and observable.'
);

const main = includesAll('src/main/main.ts', 'main-launch-maximized-owner', [
  'const startupSettings = readBrowserSettings();',
  'if (startupSettings.ui.launchToMaximized) {',
  'window.maximize();',
  "ipcMain.handle('tahai-browser:open-external', async (event, url: string) => { assertTrustedBrowserShellIpc(event); return safeOpenExternal(url); });"
]);

need(
  'package-script-present',
  pkg.scripts['verify:pass-350-settings-daily-driver-safe-surface'] === 'node scripts/verify-pass-350-settings-daily-driver-safe-surface.mjs',
  'package.json should expose PASS350.'
);

const pass347Idx = blockers.indexOf('verify:pass-347-browser-tab-daily-driver-and-profile-dialog-stability');
const pass350Idx = blockers.indexOf('verify:pass-350-settings-daily-driver-safe-surface');
const buildIdx = blockers.lastIndexOf('npm run build');
need('release-blockers-include-pass350', pass350Idx >= 0, 'PASS350 should be part of the active release-blocker contract.');
need('release-blockers-order-pass350', pass347Idx >= 0 && pass350Idx > pass347Idx && buildIdx > pass350Idx, 'PASS350 should run after PASS347 and before the final build/runtime lanes.');

includesAll('docs/qa/PASS350-SETTINGS-DAILY-DRIVER-SAFE-SURFACE.md', 'qa-doc-present', [
  'PASS350',
  'Settings Daily-Driver Safe Surface',
  'launch maximized',
  'confirm before closing',
  'safe external handoff',
  'without weakening security'
]);

need('no-unsafe-allowpopups-added', !/allowpopups\s*=?\s*["']?true/i.test(`${read('src/main/main.ts')}\n${read('src/renderer/app.ts')}`), 'No unsafe allowpopups behavior should be introduced.');
need('no-node-in-remote-content-added', !/nodeIntegration\s*:\s*true|contextIsolation\s*:\s*false|webSecurity\s*:\s*false/i.test(`${main}\n${settings}`), 'No Node/webSecurity regression should be introduced.');
need('no-raw-ipc-exposure-added', !/contextBridge\.exposeInMainWorld\([^)]*ipcRenderer/s.test(read('src/preload/preload.ts')), 'Preload must not expose raw ipcRenderer.');

const ok = results.every((entry) => entry.ok);
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, JSON.stringify({
  pass: 'PASS350',
  ok,
  generatedAt: new Date().toISOString(),
  results,
}, null, 2));

if (!ok) {
  console.error('PASS350_VERIFY_RESULT=FAIL');
  console.error(`PASS350_REPORT=${path.relative(root, evidencePath).replace(/\\/g, '/')}`);
  process.exit(1);
}

console.log('PASS350_VERIFY_RESULT=PASS');
console.log(`PASS350_REPORT=${path.relative(root, evidencePath).replace(/\\/g, '/')}`);
