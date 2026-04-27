import fs from 'node:fs';
import path from 'node:path';

const appRoot = process.cwd();
const repoRoot = path.resolve(appRoot, '..');
const fail = (message) => { console.error(`TAHAI_BROWSER_PRODUCTION_CONFIG=FAILED: ${message}`); process.exit(1); };
const read = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');
const json = (rel) => JSON.parse(read(rel));

const pkg = json('app/package.json');
const manifest = json('release-plan/release-manifest.template.json');
const prefs = json('browser/preferences/master-preferences.json');
for (const [name, value] of Object.entries({ packageName: pkg.productName, manifestProduct: manifest.product })) {
  if (value !== 'TAHAI Web Services Browser') fail(`${name} mismatch`);
}
if (pkg.homepage !== 'https://tahaiportal.com') fail('package homepage mismatch');
if (manifest.defaultHome !== 'https://tahaiportal.com') fail('manifest defaultHome mismatch');
if (prefs.homepage !== 'https://tahaiportal.com') fail('preferences homepage mismatch');
if (pkg.version !== manifest.version) fail('package/release manifest version mismatch');

const main = read('app/src/main/main.ts');
const runtime = read('app/src/main/runtime-security.ts');
const preload = read('app/src/preload/preload.ts');
const builder = read('app/electron-builder.yml');
const renderer = read('app/src/renderer/app.ts');
const settingsSource = read('app/src/main/settings.ts');
const requiredMain = ['contextIsolation: true','nodeIntegration: false','sandbox: true',"app.setPath('userData'",'requestSingleInstanceLock','https://tahaiportal.com'];
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
for (const token of ['asar: true', 'compression: maximum', 'publish: null']) {
  if (!builder.includes(token)) fail(`electron-builder release token missing: ${token}`);
}
for (const token of ['plainRecord(value: unknown)', 'const rawPermissions = plainRecord(raw.permissions)', 'const rawDownloads = plainRecord(raw.downloads)', 'const rawUi = plainRecord(raw.ui)']) {
  if (!settingsSource.includes(token)) fail(`settings sanitizer token missing: ${token}`);
}
console.log('TAHAI_BROWSER_PRODUCTION_CONFIG=OK');
