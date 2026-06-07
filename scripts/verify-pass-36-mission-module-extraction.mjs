#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { getReleaseBlockersContract } from './lib/release-blockers-contract.mjs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const app = readFileSync('src/renderer/app.ts', 'utf8');
const model = readFileSync('src/renderer/mission-model.ts', 'utf8');
const shared = readFileSync('src/shared/mission-types.ts', 'utf8');

function versionAtLeast(actual, floor) {
  const a = String(actual || '').split('.').map((n) => Number(n) || 0);
  const b = String(floor || '').split('.').map((n) => Number(n) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return true;
}

const requiredModelTokens = [
  'export const missionTypes',
  'export const missionTabRoles',
  'export const missionLayouts',
  'export const missionPaneIds',
  'export function createEmptyMission',
  'export function cloneMissionForDuplicate',
  'export function appendMissionTimelineEvent',
  'export function syncMissionLayoutPanesForMission',
  'export function missionExportMarkdown',
  "from '../shared/mission-types'"
];

const forbiddenAppTokens = [
  "type MissionType = 'deployment'",
  "type MissionTabRole = 'primary-console'",
  'function cloneMissionForDuplicate(source: MissionState',
  'function defaultRunbookStepLabels(type: MissionType)',
  'function createMissionRunbook(type: MissionType',
  'function recipeBlueprintMarkdown(recipe: LaunchRecipe): string'
];

const failures = [];
for (const token of requiredModelTokens) if (!model.includes(token)) failures.push('mission-model token missing: ' + token);
for (const token of forbiddenAppTokens) if (app.includes(token)) failures.push('renderer app still owns extracted mission token: ' + token);
if (!app.includes("from './mission-model'")) failures.push('renderer app does not import extracted mission model');
if (!app.includes('createEmptyMission({')) failures.push('renderer app does not use extracted createEmptyMission factory');
if (!app.includes('cloneMissionForDuplicateModel(result.mission, name)')) failures.push('renderer app does not use extracted mission duplicate helper');
if (!app.includes('buildMissionExportMarkdown(currentMission, md)')) failures.push('renderer app does not delegate mission export markdown');
if (!shared.includes('export type MissionState')) failures.push('shared mission state type missing');
if (!versionAtLeast(pkg.version, '1.8.13')) failures.push('package version expected >= 1.8.13, found ' + pkg.version);
if (!pkg.scripts?.['verify:pass-36-mission-module-extraction']) failures.push('package script missing: verify:pass-36-mission-module-extraction');
if (!getReleaseBlockersContract(pkg).includes('verify:pass-36-mission-module-extraction')) failures.push('pass36 verifier is not wired into release blockers');

if (failures.length) {
  console.error('PASS36_MISSION_MODULE_EXTRACTION_OK=0');
  for (const failure of failures) console.error(' - ' + failure);
  process.exit(1);
}
console.log('PASS36_MISSION_MODULE_EXTRACTION_OK=1');
