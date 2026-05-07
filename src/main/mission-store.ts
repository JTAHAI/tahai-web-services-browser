import { app, BrowserWindow, clipboard, dialog } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { validateMission } from '../shared/mission-validators';
import { scanAndRedact } from '../shared/redaction';
import { buildMissionEvidencePack } from '../shared/evidence-pack';
import { localFilesystemHandoffLabel } from '../shared/local-path-boundary';
import type { MissionDeleteResult, MissionExportResult, MissionListResult, MissionLoadResult, MissionSaveResult, MissionState } from '../shared/mission-types';

const SAFE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_LISTED_MISSIONS = 80;

function missionExportSlug(value: string): string {
  return String(value || 'mission')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'mission';
}

function defaultMissionExportPath(mission: MissionState): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(app.getPath('documents'), `tahai-mission-packet-${missionExportSlug(mission.name)}-${stamp}.md`);
}

function missionExportResult(input: unknown): MissionExportResult {
  const result = validateMission(input);
  if (!result.ok || !result.mission) return { ok: false, error: result.error || 'Mission validation failed.' };
  const packet = buildMissionEvidencePack(result.mission, { profile: 'sanitized-handoff' });
  const scan = scanAndRedact(packet.redactedMarkdown);
  return {
    ok: true,
    markdown: packet.markdown,
    redactedMarkdown: `${packet.redactedMarkdown.trim()}\n`,
    findings: scan.findings,
    highRiskCount: Math.max(packet.highRiskCount, scan.highRiskCount)
  };
}

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
    return mission ? { ok: true, mission, savedLabel: localFilesystemHandoffLabel('mission-store') } : { ok: false, error: 'Mission not found.' };
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
    return { ok: true, mission, savedLabel: localFilesystemHandoffLabel('mission-store') };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unable to save mission.' };
  }
}

export function missionMarkdown(mission: MissionState): string {
  return buildMissionEvidencePack(mission, { profile: 'sanitized-handoff' }).redactedMarkdown;
}

export function previewMissionExport(input: unknown): MissionExportResult {
  return missionExportResult(input);
}

export function copyMissionExport(input: unknown): MissionExportResult {
  const result = missionExportResult(input);
  if (!result.ok || !result.redactedMarkdown) return result;
  clipboard.writeText(result.redactedMarkdown);
  return result;
}

export async function saveMissionExport(input: unknown): Promise<MissionExportResult> {
  const result = missionExportResult(input);
  if (!result.ok || !result.redactedMarkdown) return result;
  const missionResult = validateMission(input);
  if (!missionResult.ok || !missionResult.mission) return { ok: false, error: missionResult.error || 'Mission validation failed.' };
  const owner = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  const options: Electron.SaveDialogOptions = {
    title: 'Save TAHAI Mission packet',
    defaultPath: defaultMissionExportPath(missionResult.mission),
    buttonLabel: 'Save Redacted Packet',
    filters: [{ name: 'Markdown', extensions: ['md'] }, { name: 'Text', extensions: ['txt'] }]
  };
  const saveResult = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options);
  if (saveResult.canceled || !saveResult.filePath) return { ...result, ok: false, error: 'Mission export canceled.' };
  fs.writeFileSync(saveResult.filePath, result.redactedMarkdown, 'utf8');
  return { ...result, savedLabel: localFilesystemHandoffLabel('mission-export') };
}

export function exportMissionMarkdown(input: unknown): MissionExportResult {
  return previewMissionExport(input);
}
