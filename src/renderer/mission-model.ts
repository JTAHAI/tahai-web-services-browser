import type {
  MissionEvidenceEntry,
  MissionEvidenceKind,
  MissionLayout,
  MissionLayoutType,
  MissionRunbook,
  MissionRunbookStepState,
  MissionState,
  MissionTabRole,
  MissionTimelineEvent,
  MissionType
} from '../shared/mission-types';
import { missionVisiblePaneIdsForLayout, repairMissionStateInvariants } from '../shared/mission-state-invariants';
import {
  MISSION_LAYOUT_TYPES,
  MISSION_RUNBOOK_STEP_STATES,
  MISSION_TAB_ROLES,
  MISSION_TYPES
} from '../shared/mission-types';

export type MissionRecipeLike = {
  label: string;
  note: string;
  profileName: string;
  urls: string[];
  missionType?: MissionType;
  missionLayout?: MissionLayoutType;
  missionPrimaryAction?: string;
  missionStopCondition?: string;
  missionRunbookSteps?: string[];
  missionEvidencePrompts?: string[];
  missionPhase?: 'devops' | 'it' | 'general';
  cockpitProvider?: string;
};

export const missionTypes: MissionType[] = [...MISSION_TYPES];
export const missionTabRoles: MissionTabRole[] = [...MISSION_TAB_ROLES];
export const missionLayouts: MissionLayoutType[] = MISSION_LAYOUT_TYPES.filter((layout) => layout !== 'command');
export const missionRunbookStepStates: MissionRunbookStepState[] = [...MISSION_RUNBOOK_STEP_STATES];
export const missionPaneIds = ['pane-1', 'pane-2', 'pane-3', 'pane-4'] as const;

export function missionUuid(): string {
  const cryptoRef = window.crypto as Crypto | undefined;
  if (cryptoRef?.randomUUID) return cryptoRef.randomUUID();
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (char) => (Number(char) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(char) / 4).toString(16));
}

export function normalizeMissionName(value: string, fallback = 'Untitled mission'): string {
  const cleaned = value.trim().replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').slice(0, 96);
  return cleaned || fallback;
}

export function missionRoleLabel(role: MissionTabRole): string {
  return role.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

export function missionLayoutLabel(layout: MissionLayoutType): string {
  if (layout === 'split-horizontal') return '2-Up Split';
  if (layout === 'split-vertical') return '2-Up Stack';
  if (layout === 'triple' || layout === 'triple-bottom') return '3-Up Bottom Wide';
  if (layout === 'triple-top') return '3-Up Top Wide';
  if (layout === 'triple-left') return '3-Up Left Tall';
  if (layout === 'triple-right') return '3-Up Right Tall';
  if (layout === 'quad') return '4-Up Quad Ops';
  if (layout === 'focus') return 'Focus Pane';
  return '1-Up Normal';
}

export function missionDefaultRole(url: string): MissionTabRole {
  const lower = url.toLowerCase();
  if (lower.includes('github') || lower.includes('actions') || lower.includes('log')) return 'logs';
  if (lower.includes('docs') || lower.includes('learn.microsoft') || lower.includes('developer.mozilla')) return 'docs';
  if (lower.includes('status') || lower.includes('monitor')) return 'monitoring';
  if (lower.includes('ticket') || lower.includes('jira') || lower.includes('zendesk')) return 'ticket';
  if (lower.includes('cloudflare') || lower.includes('console') || lower.includes('portal.azure') || lower.includes('admin.microsoft')) return 'primary-console';
  return 'live-target';
}

export function visibleMissionPaneIds(layout: MissionLayoutType, activePaneId = 'pane-1'): string[] {
  return missionVisiblePaneIdsForLayout(layout, activePaneId);
}

export function defaultRunbookStepLabels(type: MissionType): string[] {
  if (type === 'deployment') return ['Confirm change scope and owner', 'Capture pre-change state', 'Execute deployment step', 'Run smoke validation', 'Record rollback result or closure note'];
  if (type === 'incident') return ['Declare impact and severity', 'Capture current symptoms', 'Assign mitigation owner', 'Validate recovery signal', 'Record customer/internal update'];
  if (type === 'migration') return ['Confirm source and target state', 'Capture backup/export evidence', 'Apply migration change', 'Validate live target and DNS/TLS', 'Record rollback path and closeout'];
  if (type === 'admin') return ['Confirm authorized admin scope', 'Capture starting configuration', 'Apply requested change', 'Validate affected service', 'Document final state'];
  if (type === 'documentation') return ['Collect source references', 'Draft/update runbook', 'Review security-sensitive terms', 'Publish or stage handoff', 'Log next documentation owner'];
  return ['Define mission objective', 'Capture starting context', 'Perform work step', 'Validate result', 'Document closeout'];
}

export function createMissionRunbook(type: MissionType, objectiveSeed = ''): MissionRunbook {
  return {
    objective: objectiveSeed || 'Define the operational outcome before closing this mission.',
    rollback: 'Stop, roll back, or escalate if validation fails, permissions are unclear, or secret-bearing material appears.',
    steps: defaultRunbookStepLabels(type).map((label) => ({ stepId: missionUuid(), label, state: 'todo' as MissionRunbookStepState, evidenceNote: '' }))
  };
}

export function createMissionRunbookFromRecipe(recipe: MissionRecipeLike): MissionRunbook {
  const type = recipe.missionType || 'generic';
  const labels = recipe.missionRunbookSteps?.length ? recipe.missionRunbookSteps : defaultRunbookStepLabels(type);
  return {
    objective: recipe.missionPrimaryAction || recipe.note || 'Define the operational outcome before closing this mission.',
    rollback: recipe.missionStopCondition || 'Stop, roll back, or escalate if validation fails, permissions are unclear, or secret-bearing material appears.',
    steps: labels.slice(0, 12).map((label) => ({ stepId: missionUuid(), label: label.slice(0, 220), state: 'todo' as MissionRunbookStepState, evidenceNote: '' }))
  };
}

export function recipePhaseLabel(recipe: MissionRecipeLike): string {
  if (recipe.missionPhase === 'devops') return 'DevOps';
  if (recipe.missionPhase === 'it') return 'IT';
  return 'General';
}

export function recipeEvidenceNote(recipe: MissionRecipeLike): string {
  if (!recipe.missionEvidencePrompts?.length) return '';
  return 'Evidence prompts: ' + recipe.missionEvidencePrompts.slice(0, 6).join('; ');
}

export function recipeProviderLabel(recipe: MissionRecipeLike): string {
  const provider = recipe.cockpitProvider || 'generic';
  if (provider === 'aws') return 'AWS';
  if (provider === 'cloudflare') return 'Cloudflare';
  if (provider === 'github') return 'GitHub';
  if (provider === 'vercel') return 'Vercel';
  if (provider === 'firebase') return 'Firebase';
  if (provider === 'incident') return 'Incident';
  if (provider === 'm365') return 'M365';
  if (provider === 'azure') return 'Azure';
  return 'Ops';
}

export function recipeBlueprintMarkdown(recipe: MissionRecipeLike, md: (value: string) => string): string {
  const urls = recipe.urls.map((url) => '- ' + md(url)).join('\n');
  const runbook = (recipe.missionRunbookSteps || defaultRunbookStepLabels(recipe.missionType || 'generic')).map((step, index) => `${index + 1}. ${md(step)}`).join('\n');
  const evidence = (recipe.missionEvidencePrompts || []).map((item) => '- ' + md(item)).join('\n') || '- _No recipe evidence prompts._';
  return `# ${md(recipe.label)} Blueprint\n\n` +
    `| Field | Value |\n| --- | --- |\n` +
    `| Provider | ${md(recipeProviderLabel(recipe))} |\n` +
    `| Phase | ${md(recipePhaseLabel(recipe))} |\n` +
    `| Layout | ${md(missionLayoutLabel(recipe.missionLayout || 'single'))} |\n` +
    `| Profile | ${md(recipe.profileName)} |\n` +
    `| Primary action | ${md(recipe.missionPrimaryAction || recipe.note)} |\n` +
    `| Stop condition | ${md(recipe.missionStopCondition || 'Stop if ownership, scope, permission, or rollback is unclear.')} |\n\n` +
    `## Launch surfaces\n\n${urls}\n\n` +
    `## Runbook\n\n${runbook}\n\n` +
    `## Evidence prompts\n\n${evidence}\n`;
}

export function ensureMissionRunbook(mission: MissionState): MissionRunbook {
  if (!mission.runbook) mission.runbook = createMissionRunbook(mission.missionType);
  if (!Array.isArray(mission.runbook.steps)) mission.runbook.steps = [];
  return mission.runbook;
}

export function ensureMissionEvidence(mission: MissionState): MissionEvidenceEntry[] {
  if (!Array.isArray(mission.evidence)) mission.evidence = [];
  return mission.evidence;
}

export function missionEvidenceKindLabel(kind: MissionEvidenceKind): string {
  return kind.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

export function createEmptyMission(input: { name: string; missionType: MissionType; createdDetail?: string; createdTitle?: string }): MissionState {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    missionId: missionUuid(),
    name: normalizeMissionName(input.name),
    missionType: input.missionType,
    mode: 'local-only',
    createdAt: now,
    updatedAt: now,
    tabs: [],
    layout: { type: 'single', activePaneId: 'pane-1', panes: [] },
    notes: [],
    runbook: createMissionRunbook(input.missionType),
    evidence: [],
    timeline: [{ eventId: missionUuid(), kind: 'created', createdAt: now, title: input.createdTitle || 'Mission created', detail: input.createdDetail || 'Local-only Mission Tabs model initialized.' }],
    links: { itDocs: null, psa: null }
  };
}

export function cloneMissionForDuplicate(source: MissionState, name: string): MissionState {
  const now = new Date().toISOString();
  const tabIdMap = new Map<string, string>();
  const tabs = source.tabs.map((tab) => {
    const nextId = missionUuid();
    tabIdMap.set(tab.tabId, nextId);
    return { ...tab, tabId: nextId };
  });
  const mission: MissionState = {
    ...source,
    missionId: missionUuid(),
    name: normalizeMissionName(name, source.name + ' copy'),
    createdAt: now,
    updatedAt: now,
    tabs,
    layout: { ...source.layout, panes: source.layout.panes.map((pane) => ({ ...pane, tabId: tabIdMap.get(pane.tabId) || pane.tabId })) },
    runbook: { ...ensureMissionRunbook(source), steps: ensureMissionRunbook(source).steps.map((step) => ({ ...step, stepId: missionUuid() })) },
    notes: [...source.notes],
    evidence: (source.evidence || []).map((entry) => ({ ...entry, eventId: missionUuid(), sourceTabId: entry.sourceTabId ? tabIdMap.get(entry.sourceTabId) : undefined })),
    timeline: []
  };
  mission.timeline.unshift({ eventId: missionUuid(), kind: 'mission-duplicated', createdAt: now, title: 'Mission duplicated', detail: 'Created from ' + source.name + '.' });
  return mission;
}

export function appendMissionTimelineEvent(mission: MissionState, kind: MissionTimelineEvent['kind'], title: string, detail: string): void {
  mission.timeline.unshift({ eventId: missionUuid(), kind, createdAt: new Date().toISOString(), title, detail });
  mission.timeline = mission.timeline.slice(0, 160);
  mission.updatedAt = new Date().toISOString();
}

export function syncMissionLayoutPanesForMission(mission: MissionState): void {
  repairMissionStateInvariants(mission);
}

export function missionExportMarkdown(currentMission: MissionState | undefined, md: (value: string) => string): string {
  if (!currentMission) return '';
  const runbook = ensureMissionRunbook(currentMission);
  const rows = currentMission.tabs.map((tab) => '| ' + tab.role + ' | ' + md(tab.title) + ' | ' + md(tab.url) + ' | ' + md(tab.paneId) + ' |').join('\n') || '| _No mission tabs captured._ |  |  |  |';
  const checklist = runbook.steps.map((step) => '- [' + (step.state === 'done' ? 'x' : ' ') + '] ' + md(step.label) + ' — ' + md(step.state)).join('\n') || '- _No runbook checklist steps._';
  const notes = currentMission.notes.map((note) => '- ' + md(note)).join('\n') || '- _No local notes yet._';
  const evidenceRows = ensureMissionEvidence(currentMission).map((entry) => '| ' + md(missionEvidenceKindLabel(entry.kind)) + ' | ' + md(entry.title) + ' | ' + md(entry.url || 'n/a') + ' | ' + md(entry.paneId || 'n/a') + ' | ' + md(entry.createdAt) + ' |').join('\n') || '| _No mission evidence pinned._ |  |  |  |  |';
  const timeline = currentMission.timeline.map((event) => '- ' + md(event.createdAt) + ' — ' + md(event.kind) + ' — ' + md(event.title) + (event.detail ? ' — ' + md(event.detail) : '')).join('\n') || '- _No timeline yet._';
  return '# TAHAI Mission Packet — ' + md(currentMission.name) + '\n\n' +
    '> Local-only Mission Control export preview. Review through Ops Guard before sharing or syncing. IT Docs/PSA writeback stays disabled until an authorized server-side contract is active.\n\n' +
    '| Field | Value |\n| --- | --- |\n' +
    '| Mission type | ' + md(currentMission.missionType) + ' |\n' +
    '| Mode | ' + md(currentMission.mode) + ' |\n' +
    '| Layout | ' + md(currentMission.layout.type) + ' |\n' +
    '| Active pane | ' + md(currentMission.layout.activePaneId) + ' |\n\n' +
    '## Tabs\n\n| Role | Title | URL | Pane |\n| --- | --- | --- | --- |\n' + rows + '\n\n' +
    '## Runbook Rail\n\nObjective: ' + md(runbook.objective || 'Not set') + '\n\nRollback / stop condition: ' + md(runbook.rollback || 'Not set') + '\n\n' + checklist + '\n\n' +
    '## Local Notes\n\n' + notes + '\n\n' +
    '## Mission Evidence\n\n| Kind | Title | URL | Pane | Captured |\n| --- | --- | --- | --- | --- |\n' + evidenceRows + '\n\n' +
    '## Timeline\n\n' + timeline + '\n';
}
