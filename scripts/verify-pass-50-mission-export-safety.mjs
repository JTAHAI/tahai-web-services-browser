import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
const fail = (message) => {
  console.error(`PASS50_MISSION_EXPORT_SAFETY_FAIL=${message}`);
  process.exit(1);
};

for (const file of [
  'src/main/mission-store.ts',
  'src/main/main.ts',
  'src/preload/preload.ts',
  'src/renderer/app.ts',
  'src/renderer/index.html',
  'src/renderer/styles/mission-control.css',
  'src/shared/mission-types.ts',
  'package.json',
  'package-lock.json'
]) {
  if (!exists(file)) fail(`missing ${file}`);
}

const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));
if (!/^1\.8\.(2[4-9]|[3-9][0-9])$/.test(pkg.version)) fail('package version must remain at or after 1.8.24');
if (lock.version !== pkg.version || lock.packages?.['']?.version !== pkg.version) fail('package-lock version does not match package version');
if (pkg.scripts?.['verify:pass-50-mission-export-safety'] !== 'node scripts/verify-pass-50-mission-export-safety.mjs') fail('verify script missing from package.json');

const missionTypes = read('src/shared/mission-types.ts');
for (const token of ['MissionExportResult', 'redactedMarkdown', 'findings', 'highRiskCount']) {
  if (!missionTypes.includes(token)) fail(`MissionExportResult missing ${token}`);
}

const store = read('src/main/mission-store.ts');
for (const token of ['previewMissionExport', 'copyMissionExport', 'saveMissionExport', 'buildMissionEvidencePack', 'scanAndRedact', 'Save Redacted Packet', 'clipboard.writeText']) {
  if (!store.includes(token)) fail(`mission-store missing ${token}`);
}
if (!/fs\.writeFileSync\(saveResult\.filePath, result\.redactedMarkdown, 'utf8'\)/.test(store)) fail('saveMissionExport must write the redacted packet only');

const main = read('src/main/main.ts');
for (const channel of ['preview-mission-export', 'copy-mission-export', 'save-mission-export']) {
  if (!main.includes(`tahai-browser:${channel}`)) fail(`main IPC missing ${channel}`);
}
for (const channel of ['list-missions', 'load-mission', 'save-mission', 'delete-mission', 'preview-mission-export', 'copy-mission-export', 'save-mission-export']) {
  const re = new RegExp(`ipcMain\\.handle\\('tahai-browser:${channel}'[\\s\\S]{0,180}assertTrustedBrowserShellIpc\\(event\\)`);
  if (!re.test(main)) fail(`mission IPC channel lacks trusted-shell assertion: ${channel}`);
}

const preload = read('src/preload/preload.ts');
for (const token of ['previewMissionExport', 'copyMissionExport', 'saveMissionExport', 'MissionApiExportResult']) {
  if (!preload.includes(token)) fail(`preload missing ${token}`);
}

const globalTypes = read('src/renderer/global.d.ts');
for (const token of ['previewMissionExport', 'copyMissionExport', 'saveMissionExport', 'MissionApiExportResult']) {
  if (!globalTypes.includes(token)) fail(`global typing missing ${token}`);
}

const html = read('src/renderer/index.html');
for (const token of ['mission-copy-export', 'mission-save-export', 'Validated redacted packet']) {
  if (!html.includes(token)) fail(`renderer HTML missing ${token}`);
}

const app = read('src/renderer/app.ts');
for (const token of ['copyMissionExportPacket', 'saveMissionExportPacket', 'scanAndRedact(rawMarkdown).redacted', 'missionCopyExportButton.addEventListener', 'missionSaveExportButton.addEventListener']) {
  if (!app.includes(token)) fail(`renderer app missing ${token}`);
}

const css = read('src/renderer/styles/mission-control.css');
for (const token of ['PASS 50', 'mission-export-actions', 'mission-export-section #mission-export-preview']) {
  if (!css.includes(token)) fail(`CSS missing ${token}`);
}

console.log('PASS50_MISSION_EXPORT_SAFETY_OK=1');

process.exit(0);
