#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const fail = (message) => { console.error(`TAHAI_BROWSER_MISSION_SECURITY_VERIFY_FAIL=${message}`); process.exit(1); };
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));

const required = [
  'src/shared/mission-types.ts',
  'src/shared/mission-validators.ts',
  'src/shared/redaction.ts',
  'src/main/mission-store.ts',
  'src/main/safe-open-external.ts',
  'scripts/verify-mission-tabs-security.mjs',
  'docs/mission-tabs-security-spec.md'
];
for (const rel of required) if (!exists(rel)) fail(`missing required Mission Control file: ${rel}`);

const pkg = JSON.parse(read('package.json'));
if (pkg.scripts?.['verify:mission-tabs-security'] !== 'node scripts/verify-mission-tabs-security.mjs') fail('package.json missing verify:mission-tabs-security script');

const missionTypes = read('src/shared/mission-types.ts');
for (const token of ['MISSION_SCHEMA_VERSION', 'MISSION_TYPES', 'MISSION_TAB_ROLES', 'MISSION_LAYOUT_TYPES', 'MISSION_MODES', 'MissionState', 'MissionTabRef']) {
  if (!missionTypes.includes(token)) fail(`mission-types missing ${token}`);
}
for (const forbidden of ['accessToken', 'refreshToken', 'clientSecret', 'apiKey', 'password', 'cookie']) {
  if (new RegExp(`\\b${forbidden}\\b`, 'i').test(missionTypes)) fail(`mission model includes forbidden secret-bearing field: ${forbidden}`);
}

const validators = read('src/shared/mission-validators.ts');
for (const token of ['javascript:', 'data:', 'vbscript:', 'file:', 'ftp:', 'Unsupported mission schema version', 'Mission contains a forbidden secret-bearing field']) {
  if (!validators.includes(token)) fail(`mission validator missing fail-closed check: ${token}`);
}
for (const token of ['isMissionType', 'isMissionTabRole', 'isMissionLayoutType', 'isMissionMode', 'sanitizeMissionUrl', 'validateMission']) {
  if (!validators.includes(`function ${token}`) && !validators.includes(`function ${token}`.replace('function ', 'export function '))) fail(`mission validator missing ${token}`);
}

const redaction = read('src/shared/redaction.ts');
for (const token of ['Authorization header', 'Cookie header', 'Bearer token', 'AWS access key', 'JWT-looking string', 'Private key block', 'scanAndRedact']) {
  if (!redaction.includes(token)) fail(`redaction scanner missing ${token}`);
}

const srcFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (/\.(ts|tsx|js|mjs|html|css)$/.test(entry.name)) srcFiles.push(full);
  }
}
walk(path.join(root, 'src'));
const sourceJoined = srcFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');

const forbiddenIpcFamilies = ['psa:direct-fetch', 'secret:get', 'cookie:get-all', 'auth:get-token', 'read-file-any', 'write-file-any', 'save-any-path', 'load-any-path', 'open-url-anywhere', 'run-command'];
for (const token of forbiddenIpcFamilies) if (sourceJoined.includes(token)) fail(`forbidden IPC token present: ${token}`);
if (/ipcRenderer\s*:\s*ipcRenderer/.test(read('src/preload/preload.ts'))) fail('preload exposes raw ipcRenderer');
if (/contextBridge\.exposeInMainWorld\([^)]*ipcRenderer/s.test(read('src/preload/preload.ts'))) fail('contextBridge appears to expose raw ipcRenderer');

const shellOpenHits = srcFiles.filter((file) => fs.readFileSync(file, 'utf8').includes('shell.openExternal'))
  .map((file) => path.relative(root, file).replaceAll('\\', '/'));
if (shellOpenHits.some((rel) => rel !== 'src/main/safe-open-external.ts')) fail(`shell.openExternal found outside safe wrapper: ${shellOpenHits.join(', ')}`);

if (/nodeIntegration\s*:\s*true/.test(sourceJoined) || /nodeIntegration=yes/i.test(sourceJoined)) fail('nodeIntegration enabled in source');
if (/contextIsolation\s*:\s*false/.test(sourceJoined) || /contextIsolation=no/i.test(sourceJoined)) fail('contextIsolation disabled in source');
if (/enableRemoteModule\s*:\s*true/.test(sourceJoined)) fail('enableRemoteModule enabled in source');
if (/webSecurity\s*:\s*false/.test(sourceJoined)) fail('webSecurity disabled in source');
if (/fetch\s*\(\s*['"]https?:\/\/[^'"]*(psa|connectwise|autotask|halo|syncro)/i.test(sourceJoined)) fail('direct PSA/vendor fetch appears in browser source');

const rendererHtml = read('src/renderer/index.html');
for (const id of ['mission-control-toggle', 'mission-dialog', 'mission-form', 'mission-tabs-list', 'mission-layouts', 'mission-export-preview']) {
  if (!rendererHtml.includes(`id="${id}"`)) fail(`Mission Control UI missing ${id}`);
}
const rendererApp = read('src/renderer/app.ts');
for (const token of ['setMissionLayout', 'missionRuntimeTabs', 'renderMissionLayout', 'saveCurrentMission', 'loadMissionById', 'Ctrl+Alt+M', 'Mission Control']) {
  if (!rendererApp.includes(token)) fail(`Mission Control renderer missing ${token}`);
}

const gitignore = read('.gitignore');
for (const pattern of ['dist/', 'release/', 'node_modules/', '.env', '*.pfx', '*.p12', '*.pem']) {
  if (!gitignore.includes(pattern)) fail(`.gitignore missing ${pattern}`);
}

console.log('TAHAI_BROWSER_MISSION_TABS_SECURITY_VERIFY=OK');
process.exit(0);
