#!/usr/bin/env node
import fs from 'node:fs';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';
function read(path){return fs.readFileSync(path,'utf8');}
function fail(message){console.error(`PASS97 verification failed: ${message}`);process.exit(1);}
function need(condition,message){if(!condition)fail(message);}
function includes(path,needles){const text=read(path);for(const needle of needles)need(text.includes(needle),`${path} missing ${needle}`);return text;}

const boundary=includes('src/shared/local-path-boundary.ts',[
  'PASS97_LOCAL_PATH_BOUNDARY',
  'localFilesystemHandoffLabel',
  'scrubLocalPathText',
  'Filesystem path hidden',
  '[LOCAL_PATH_HIDDEN]'
]);
need(boundary.includes('\\b[A-Za-z]:\\\\') || boundary.includes('[A-Za-z]:\\\\'), 'boundary must scrub Windows drive paths');
need(boundary.includes('Users') && boundary.includes('home') && boundary.includes('mnt'), 'boundary must scrub Unix/WSL style paths');

const types=includes('src/shared/mission-types.ts',[
  'savedLabel?: string;',
  'path?: never;'
]);
need(!/path\??:\s*string/.test(types),'mission result types must not expose string path fields');

const preload=includes('src/preload/preload.ts',[
  'userDataLabel: string;',
  'settingsLabel: string;',
  'storageLabel: string;',
  'savedLabel: string;',
  'path?: never;'
]);
need(!/userDataPath:\s*string/.test(preload),'preload config must not expose userDataPath');
need(!/settingsPath:\s*string/.test(preload),'preload config must not expose settingsPath');
need(!/export type DevOpsCaptureSaveResult = \{[\s\S]*path:\s*string;[\s\S]*\};/.test(preload),'DevOps save result must not expose path:string');

const main=includes('src/main/main.ts',[
  "import { localFilesystemHandoffLabel } from '../shared/local-path-boundary'",
  "settingsLabel: localFilesystemHandoffLabel('browser-config')",
  "userDataLabel: localFilesystemHandoffLabel('browser-config')",
  "savedLabel: localFilesystemHandoffLabel('devops-capture')"
]);
need(!/userDataPath:\s*app\.getPath\('userData'\)/.test(main),'main config must not return userDataPath');
need(!/settingsPath:\s*getSettingsPath\(\)/.test(main),'main config must not return settingsPath');
need(!/return \{ saved:\s*true, canceled:\s*false, path:\s*result\.filePath/.test(main),'DevOps save IPC must not return selected filePath');
need(!/setStatus\([^\n]*result\.path/.test(read('src/renderer/app.ts')),'renderer status must not use result.path for save status');
need(!/`Saved[^`]*\$\{result\.path\}/.test(read('src/renderer/app.ts')),'renderer must not render result.path in save messages');

const missionStore=includes('src/main/mission-store.ts',[
  "import { localFilesystemHandoffLabel } from '../shared/local-path-boundary'",
  "savedLabel: localFilesystemHandoffLabel('mission-store')",
  "savedLabel: localFilesystemHandoffLabel('mission-export')"
]);
need(!/path:\s*missionFilePath/.test(missionStore),'loadMission must not return missionFilePath');
need(!/path:\s*filePath/.test(missionStore),'saveMission must not return mission filePath');
need(!/path:\s*saveResult\.filePath/.test(missionStore),'saveMissionExport must not return selected export path');

const profiles=includes('src/main/profile-manager.ts',[
  "import { localFilesystemHandoffLabel } from '../shared/local-path-boundary'",
  'storageLabel: string;',
  'path?: never;',
  "storageLabel: localFilesystemHandoffLabel('profile-store')"
]);
need(!/path:\s*profilesPath\(\)/.test(profiles),'profile state must not return local profilesPath');

includes('src/renderer/index.html',[
  'data-pass97-local-path-boundary="true"',
  'Mission, profile, and evidence saves show safe labels instead of local paths.',
  'local file paths'
]);
includes('src/renderer/styles/browser.css',[
  'PASS97 local filesystem path disclosure boundary',
  'Local paths stay hidden'
]);
const pkg=JSON.parse(read('package.json'));
need(pkg.scripts['verify:pass-97-local-path-disclosure-boundary']==='node scripts/verify-pass-97-local-path-disclosure-boundary.mjs','package.json missing PASS97 verifier script');
need(getReleaseBlockersContract(pkg).includes('verify:pass-97-local-path-disclosure-boundary'),'release blockers missing PASS97 verifier');
console.log('PASS97 local path disclosure boundary verification passed.');
