import fs from 'node:fs';
import path from 'node:path';

const appRoot = process.cwd();
const fail = (message) => { console.error(`TAHAI_BROWSER_PRODUCTION_CONFIG=FAILED: ${message}`); process.exit(1); };
const read = (rel) => fs.readFileSync(path.join(appRoot, rel), 'utf8');
const json = (rel) => JSON.parse(read(rel));

const pkg = json('package.json');
const prefs = json('browser/preferences/master-preferences.json');
if (pkg.productName !== 'TAHAI Web Services Browser') fail('package productName mismatch');
if (pkg.homepage !== 'https://browser.tahai.net') fail('package homepage mismatch');
if (prefs.homepage && !String(prefs.homepage).startsWith('https://')) fail('preferences homepage must be HTTPS when set');
if (pkg.build?.appId !== 'com.tahai.webservices.browser') fail('package build appId mismatch');

const main = read('src/main/main.ts');
const runtime = read('src/main/runtime-security.ts');
const preload = read('src/preload/preload.ts');
const builder = read('electron-builder.yml');
const renderer = read('src/renderer/app.ts');
const settingsSource = read('src/main/settings.ts');
const requiredMain = ['contextIsolation: true','nodeIntegration: false','sandbox: true',"app.setPath('userData'",'requestSingleInstanceLock'];
for (const token of requiredMain) if (!main.includes(token)) fail(`main hardening token missing: ${token}`);
for (const token of ['setPermissionRequestHandler', 'will-download', 'onBeforeRequest', 'clearStorageData']) {
  if (!runtime.includes(token) && !main.includes(token)) fail(`runtime control missing: ${token}`);
}
for (const token of ['contextBridge.exposeInMainWorld', 'updateSettings', 'clearBrowsingData']) {
  if (!preload.includes(token)) fail(`preload bridge token missing: ${token}`);
}
for (const token of ['isUnsafeLocalUrl', 'normalizeTarget', 'settings-dialog']) {
  if (!renderer.includes(token)) fail(`renderer safety token missing: ${token}`);
}
for (const token of ['appId: com.tahai.webservices.browser', 'asar: true', 'compression: maximum', 'publish: null']) {
  if (!builder.includes(token)) fail(`electron-builder release token missing: ${token}`);
}
for (const token of ['plainRecord(value: unknown)', 'const rawPermissions = plainRecord(raw.permissions)', 'const rawDownloads = plainRecord(raw.downloads)', 'const rawUi = plainRecord(raw.ui)']) {
  if (!settingsSource.includes(token)) fail(`settings sanitizer token missing: ${token}`);
}
console.log('TAHAI_BROWSER_PRODUCTION_CONFIG=OK');
