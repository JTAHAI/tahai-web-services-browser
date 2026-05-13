#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const fail = (message) => { console.error(`PASS142_ELECTRON_SECURITY_FINAL_AUDIT=FAIL ${message}`); process.exit(1); };
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));
const need = (condition, message) => { if (!condition) fail(message); };

const requiredFiles = [
  'src/shared/electron-security-contract.ts',
  'src/main/main.ts',
  'src/main/runtime-security.ts',
  'src/main/safe-open-external.ts',
  'src/preload/preload.ts',
  'src/renderer/app.ts',
  'docs/electron-security-final-audit-pass142.md',
  'PASS_142_ELECTRON_SECURITY_FINAL_AUDIT_SUMMARY.md'
];
for (const rel of requiredFiles) need(exists(rel), `missing required PASS142 file: ${rel}`);

const pkg = JSON.parse(read('package.json'));
need(pkg.version === '1.8.30', 'PASS142 must not bump version');
need(pkg.scripts?.['verify:pass-142-electron-security-final-audit'] === 'node scripts/verify-pass-142-electron-security-final-audit.mjs', 'package.json missing PASS142 verifier script');
need(String(pkg.scripts?.['verify:release-blockers'] || '').includes('verify:pass-142-electron-security-final-audit'), 'release blockers must include PASS142 verifier');

const contract = read('src/shared/electron-security-contract.ts');
for (const token of [
  "TAHAI_ELECTRON_SECURITY_PASS = 'PASS142'",
  'TAHAI_REQUIRED_BROWSER_WINDOW_WEB_PREFERENCES',
  'contextIsolation: true',
  'nodeIntegration: false',
  'sandbox: true',
  'webSecurity: true',
  'allowRunningInsecureContent: false',
  'TAHAI_REQUIRED_WEBVIEW_WEBPREFERENCES',
  'TAHAI_BLOCKED_RUNTIME_PROTOCOLS',
  'TAHAI_TRUSTED_IPC_CHANNELS',
  'TAHAI_TRUSTED_RENDERER_EVENT_CHANNELS',
  'normalizeTahaiWebviewPreferences',
  'electronSecuritySummary'
]) need(contract.includes(token), `electron security contract missing ${token}`);

const trustedIpc = Array.from(contract.matchAll(/'tahai-browser:[a-z0-9:-]+'/g)).map((m) => m[0].slice(1, -1));
const trustedInvoke = new Set(trustedIpc.filter((channel) => !['tahai-browser:open-in-tab','tahai-browser:menu-command','tahai-browser:toggle-devtools','tahai-browser:download-state','tahai-browser:pass188-input-boundary'].includes(channel)));
const trustedEvents = new Set(['tahai-browser:open-in-tab','tahai-browser:menu-command','tahai-browser:toggle-devtools','tahai-browser:download-state','tahai-browser:pass188-input-boundary']);

const main = read('src/main/main.ts');
for (const token of [
  'TAHAI_REQUIRED_BROWSER_WINDOW_WEB_PREFERENCES',
  '...TAHAI_REQUIRED_BROWSER_WINDOW_WEB_PREFERENCES',
  'assertTrustedIpcChannel',
  'isTrustedTahaiIpcChannel',
  'sendTrustedRendererEvent',
  'isTrustedTahaiRendererEventChannel',
  'setWindowOpenHandler',
  'normalizeSafeExternalWindowUrl(url)',
  'will-navigate',
  'assertTrustedShellOrigin'
]) need(main.includes(token), `main process missing PASS142 guard token: ${token}`);

const ipcHandles = Array.from(main.matchAll(/ipcMain\.handle\('([^']+)'/g)).map((m) => m[1]);
need(ipcHandles.length >= 25, 'expected existing IPC handler surface to be audited');
for (const channel of ipcHandles) {
  need(trustedInvoke.has(channel), `IPC handler not present in trusted contract: ${channel}`);
  need(main.includes(`assertTrustedIpcChannel('${channel}');`), `IPC handler lacks registration assertion: ${channel}`);
}
for (const channel of trustedInvoke) need(ipcHandles.includes(channel), `trusted IPC channel has no handler: ${channel}`);

const preload = read('src/preload/preload.ts');
need(preload.includes('contextBridge.exposeInMainWorld'), 'preload must use contextBridge');
need(!/contextBridge\.exposeInMainWorld\([^)]*ipcRenderer/s.test(preload), 'preload appears to expose raw ipcRenderer');
need(!/ipcRenderer\.send\(/.test(preload), 'preload must not expose send-style IPC');
const invoked = Array.from(preload.matchAll(/ipcRenderer\.invoke\('([^']+)'/g)).map((m) => m[1]);
for (const channel of invoked) need(trustedInvoke.has(channel), `preload invokes untrusted channel: ${channel}`);

const eventSubs = Array.from(preload.matchAll(/ipcRenderer\.on\('([^']+)'/g)).map((m) => m[1]);
for (const channel of eventSubs) need(trustedEvents.has(channel), `preload subscribes to untrusted event channel: ${channel}`);

const runtime = read('src/main/runtime-security.ts');
for (const token of ['TAHAI_BLOCKED_RUNTIME_PROTOCOLS', 'setPermissionRequestHandler', 'setPermissionCheckHandler', 'webRequest.onBeforeRequest', 'webRequest.onBeforeSendHeaders', 'isTrustedTahaiRendererEventChannel']) {
  need(runtime.includes(token), `runtime security missing ${token}`);
}

const safeOpen = read('src/main/safe-open-external.ts');
need(safeOpen.includes('sanitizeExternalNavigationUrl'), 'safe-open wrapper must sanitize external URLs');
need(safeOpen.includes('shell.openExternal(safeUrl)'), 'safe-open wrapper must be the only direct shell.openExternal call');

const sourceFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (/\.(ts|tsx|js|mjs|html|css)$/.test(entry.name)) sourceFiles.push(full);
  }
}
walk(path.join(root, 'src'));
const sourceJoined = sourceFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
for (const [pattern, message] of [
  [/nodeIntegration\s*:\s*true|nodeIntegration=yes/i, 'nodeIntegration enabled'],
  [/contextIsolation\s*:\s*false|contextIsolation=no/i, 'contextIsolation disabled'],
  [/sandbox\s*:\s*false|sandbox=no/i, 'sandbox disabled'],
  [/webSecurity\s*:\s*false/i, 'webSecurity disabled'],
  [/allowRunningInsecureContent\s*:\s*true/i, 'allowRunningInsecureContent enabled'],
  [/enableRemoteModule\s*:\s*true/i, 'enableRemoteModule enabled'],
  [/allowpopups\s*=\s*['\"]true/i, 'webview popups enabled']
]) need(!pattern.test(sourceJoined), message);

const shellOpenHits = sourceFiles.filter((file) => fs.readFileSync(file, 'utf8').includes('shell.openExternal'))
  .map((file) => path.relative(root, file).replaceAll('\\', '/'));
need(shellOpenHits.length === 1 && shellOpenHits[0] === 'src/main/safe-open-external.ts', `shell.openExternal outside safe wrapper: ${shellOpenHits.join(', ')}`);

const hardcodedWebContentsSend = Array.from(main.matchAll(/webContents\.send\('([^']+)'/g)).map((m) => m[1]);
need(hardcodedWebContentsSend.length === 0, `main must route renderer events through PASS142 helpers, found: ${hardcodedWebContentsSend.join(', ')}`);

const renderer = read('src/renderer/app.ts');
for (const token of ['TAHAI_REQUIRED_WEBVIEW_WEBPREFERENCES', 'normalizeTahaiWebviewPreferences', 'pass153PopupBoundary', 'browserNavigationSafeUrl(event.url)']) {
  need(renderer.includes(token), `renderer webview hardening missing ${token}`);
}
need(!renderer.includes("contextIsolation=yes,nodeIntegration=no,sandbox=yes,spellcheck=yes,devTools=yes'"), 'renderer should consume the shared webview security contract, not duplicate literals');

for (const forbidden of ['psa:direct-fetch', 'secret:get', 'cookie:get-all', 'auth:get-token', 'read-file-any', 'write-file-any', 'save-any-path', 'load-any-path', 'open-url-anywhere', 'run-command']) {
  need(!sourceJoined.includes(forbidden), `forbidden channel token present in source: ${forbidden}`);
}

const docs = `${read('docs/electron-security-final-audit-pass142.md')}\n${read('PASS_142_ELECTRON_SECURITY_FINAL_AUDIT_SUMMARY.md')}`;
for (const token of ['PASS142', 'contextIsolation', 'nodeIntegration', 'sandbox', 'IPC allowlist', 'safeOpenExternal', 'webview', 'blocked protocols']) {
  need(docs.includes(token), `PASS142 docs missing ${token}`);
}

console.log('PASS142_ELECTRON_SECURITY_FINAL_AUDIT=PASS');
process.exit(0);
