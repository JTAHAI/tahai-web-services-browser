import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
const fail = (message) => {
  console.error(`PASS49_MISSION_RESTORE_SAFETY_FAIL=${message}`);
  process.exit(1);
};

for (const file of [
  'src/renderer/app.ts',
  'src/renderer/styles/mission-control.css',
  'package.json',
  'package-lock.json'
]) {
  if (!exists(file)) fail(`missing ${file}`);
}

const appTs = read('src/renderer/app.ts');
const css = read('src/renderer/styles/mission-control.css');
const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));

if (!/^1\.8\.(2[3-9]|[3-9][0-9])$/.test(pkg.version)) fail('package version must remain at or after 1.8.23');
if (lock.version !== pkg.version || lock.packages?.['']?.version !== pkg.version) fail('package-lock version does not match package version');
if (pkg.scripts?.['verify:pass-49-mission-restore-safety'] !== 'node scripts/verify-pass-49-mission-restore-safety.mjs') fail('verify script missing from package.json');

for (const token of [
  "type MissionRestoreMode = 'preview' | 'append' | 'replace'",
  'requestMissionRestoreMode',
  'restoreMissionTabsIntoBrowser',
  'chooseAndRestoreMissionById',
  'Open alongside current tabs',
  'Replace current tabs',
  'Mission tabs opened alongside the current browsing context',
  'Mission tabs replaced the current browser window after explicit confirmation'
]) {
  if (!appTs.includes(token)) fail(`app.ts missing restore-safety token: ${token}`);
}

if (!/if \(mode === 'replace'\) closeAllTabsForProfileSwitch\(\);/.test(appTs)) fail('replace mode must be the only restore path that closes current tabs');
if (appTs.includes('loadMissionById(button.dataset.restoreMissionId, true)')) fail('saved mission restore still uses boolean destructive restore');
if (!appTs.includes("loadMissionById(button.dataset.loadMissionId, 'preview')")) fail('mission preview load action not wired');
if (!appTs.includes('void chooseAndRestoreMissionById(button.dataset.restoreMissionId)')) fail('restore action not wired to safe chooser');

for (const token of [
  'mission-restore-dialog',
  'mission-restore-options',
  'recommended',
  'danger',
  'mission-restore-button'
]) {
  if (!css.includes(token)) fail(`mission restore CSS missing ${token}`);
}

console.log('PASS49_MISSION_RESTORE_SAFETY_OK=1');
