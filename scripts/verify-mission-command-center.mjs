#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const root = process.cwd();
const fail = (message) => {
  console.error(`TAHAI_BROWSER_MISSION_COMMAND_CENTER_VERIFY_FAIL=${message}`);
  process.exit(1);
};
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));

for (const rel of [
  'src/renderer/app.ts',
  'src/renderer/styles/browser.css',
  'docs/mission-command-center-pass-04.md'
]) {
  if (!exists(rel)) fail(`missing ${rel}`);
}

const pkg = JSON.parse(read('package.json').replace(/^\uFEFF/, ''));
if (pkg.scripts?.['verify:mission-command-center'] !== 'node scripts/verify-mission-command-center.mjs') {
  fail('package.json missing verify:mission-command-center script');
}
if (!getReleaseBlockersContract(pkg).includes('verify:mission-command-center')) {
  fail('verify:release-blockers does not include verify:mission-command-center');
}

const app = read('src/renderer/app.ts');
for (const token of [
  'type CommandPalettePhase',
  'target?: string',
  'phase?: CommandPalettePhase',
  'commandActionSearchText',
  'commandActionMeta',
  'sendActiveTabToMissionPane',
  'focusMissionPaneFromCommand',
  'Send Active Tab to',
  'Focus ${paneLabel}',
  'Mission Routing',
  'Mission View',
  'Target:'
]) {
  if (!app.includes(token)) fail(`app.ts missing token: ${token}`);
}

for (const forbidden of ['psa:direct-fetch', 'secret:get', 'cookie:get-all', 'auth:get-token', 'shell.openExternal(']) {
  if (app.includes(forbidden)) fail(`app.ts contains forbidden token: ${forbidden}`);
}

const css = read('src/renderer/styles/browser.css');
for (const token of ['.command-row .command-target', '.command-row.phase-devops', '.command-row.phase-mission']) {
  if (!css.includes(token)) fail(`browser.css missing token: ${token}`);
}

console.log('TAHAI_BROWSER_MISSION_COMMAND_CENTER_VERIFY=OK');
process.exit(0);
