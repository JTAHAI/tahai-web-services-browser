import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { validateMission } from '../shared/mission-validators';
import { scanAndRedact } from '../shared/redaction';
import type { MissionDeleteResult, MissionListResult, MissionLoadResult, MissionSaveResult, MissionState } from '../shared/mission-types';

const SAFE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_LISTED_MISSIONS = 80;

function missionsDirectory(): string {
  return path.join(app.getPath('userData'), 'missions');
}

function missionFilePath(missionId: string): string {
  if (!SAFE_ID_RE.test(missionId)) throw new Error('Invalid mission ID.');
  return path.join(missionsDirectory(), `${missionId}.json`);
}

function ensureMissionDirectory(): void {
  fs.mkdirSync(missionsDirectory(), { recursive: true });
}

function readMissionFile(filePath: string): MissionState | undefined {
  const raw = fs.readFileSync(filePath, 'utf8');
  const result = validateMission(JSON.parse(raw));
  if (!result.ok || !result.mission) throw new Error(result.error || 'Mission validation failed.');
  return result.mission;
}

export function listMissions(): MissionListResult {
  try {
    ensureMissionDirectory();
    const missions = fs.readdirSync(missionsDirectory(), { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => path.join(missionsDirectory(), entry.name))
      .map((filePath) => {
        try { return readMissionFile(filePath); } catch { return undefined; }
      })
      .filter(Boolean) as MissionState[];
    missions.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    return { ok: true, missions: missions.slice(0, MAX_LISTED_MISSIONS) };
  } catch (error) {
    return { ok: false, missions: [], error: error instanceof Error ? error.message : 'Unable to list missions.' };
  }
}

export function loadMission(missionId: string): MissionLoadResult {
  try {
    const mission = readMissionFile(missionFilePath(missionId));
    return mission ? { ok: true, mission, path: missionFilePath(missionId) } : { ok: false, error: 'Mission not found.' };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unable to load mission.' };
  }
}

export function deleteMission(missionId: string): MissionDeleteResult {
  try {
    const filePath = missionFilePath(missionId);
    if (!fs.existsSync(filePath)) return { ok: false, error: 'Mission not found.' };
    fs.unlinkSync(filePath);
    return { ok: true, deletedMissionId: missionId };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unable to delete mission.' };
  }
}

export function saveMission(input: unknown): MissionSaveResult {
  const result = validateMission(input);
  if (!result.ok || !result.mission) return { ok: false, error: result.error || 'Mission validation failed.' };
  try {
    ensureMissionDirectory();
    const mission = { ...result.mission, updatedAt: new Date().toISOString() };
    const filePath = missionFilePath(mission.missionId);
    fs.writeFileSync(filePath, `${JSON.stringify(mission, null, 2)}\n`, 'utf8');
    return { ok: true, mission, path: filePath };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unable to save mission.' };
  }
}

function mdCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ').trim();
}

export function missionMarkdown(mission: MissionState): string {
  const rows = mission.tabs.map((tab) => '| ' + tab.role + ' | ' + mdCell(tab.title) + ' | ' + mdCell(tab.url) + ' | ' + tab.paneId + ' |').join('\n') || '| _No tabs captured_ |  |  |  |';
  const timeline = mission.timeline.map((event) => '- ' + event.createdAt + ' — ' + event.kind + ' — ' + mdCell(event.title) + (event.detail ? ' — ' + mdCell(event.detail) : '')).join('\n') || '- _No mission timeline yet._';
  const notes = mission.notes.map((note) => '- ' + mdCell(note)).join('\n') || '- _No local notes._';
  const runbook = mission.runbook || { objective: '', rollback: '', steps: [] };
  const runbookSteps = runbook.steps.map((step) => '- [' + (step.state === 'done' ? 'x' : ' ') + '] ' + mdCell(step.label) + ' — ' + step.state + (step.evidenceNote ? ' — ' + mdCell(step.evidenceNote) : '')).join('\n') || '- _No runbook checklist steps._';
  const evidenceRows = (mission.evidence || []).map((entry) => '| ' + mdCell(entry.kind) + ' | ' + mdCell(entry.title) + ' | ' + mdCell(entry.url || 'n/a') + ' | ' + mdCell(entry.paneId || 'n/a') + ' | ' + mdCell(entry.createdAt) + ' |').join('\n') || '| _No mission evidence pinned_ |  |  |  |  |';
  return '# TAHAI Mission Packet — ' + mdCell(mission.name) + '\n\n' +
    '> Local-only browser-side mission export. This packet contains URLs, titles, role labels, local notes, runbook checklist state, and timeline metadata only. It must be reviewed before sharing or syncing to TAHAI IT Docs. PSA writeback must route through IT Docs server-side connectors.\n\n' +
    '| Field | Value |\n| --- | --- |\n' +
    '| Mission ID | ' + mission.missionId + ' |\n' +
    '| Mission type | ' + mission.missionType + ' |\n' +
    '| Mode | ' + mission.mode + ' |\n' +
    '| Layout | ' + mission.layout.type + ' / active ' + mission.layout.activePaneId + ' |\n' +
    '| Updated | ' + mission.updatedAt + ' |\n\n' +
    '## Tabs\n\n| Role | Title | URL | Pane |\n| --- | --- | --- | --- |\n' + rows + '\n\n' +
    '## Runbook Rail\n\n' +
    'Objective: ' + mdCell(runbook.objective || 'Not set') + '\n\n' +
    'Rollback / stop condition: ' + mdCell(runbook.rollback || 'Not set') + '\n\n' +
    runbookSteps + '\n\n' +
    '## Local notes\n\n' + notes + '\n\n' +
    '## Mission Evidence\n\n| Kind | Title | URL | Pane | Captured |\n| --- | --- | --- | --- | --- |\n' + evidenceRows + '\n\n' +
    '## Timeline\n\n' + timeline + '\n';
}

export function exportMissionMarkdown(input: unknown): MissionSaveResult {
  const result = validateMission(input);
  if (!result.ok || !result.mission) return { ok: false, error: result.error || 'Mission validation failed.' };
  const markdown = missionMarkdown(result.mission);
  const scan = scanAndRedact(markdown);
  if (scan.highRiskCount > 0) return { ok: false, error: 'Mission export contains high-risk secret-like content. Run Ops Guard/redaction before export.' };
  return { ok: true, mission: result.mission };
}
