import type { MissionLayout, MissionLayoutType, MissionPaneAssignment, MissionState, MissionTabRef } from './mission-types';

export type MissionStateInvariantIssue = {
  code: 'active-pane-hidden' | 'duplicate-pane-assignment' | 'duplicate-tab-assignment' | 'pane-tab-mismatch' | 'pane-role-mismatch' | 'layout-pane-canonicalization-needed';
  severity: 'repair' | 'block';
  detail: string;
};

const PANE_IDS = ['pane-1', 'pane-2', 'pane-3', 'pane-4'] as const;
type PaneId = typeof PANE_IDS[number];

export function normalizeMissionInvariantPaneId(value: unknown): PaneId {
  return PANE_IDS.includes(value as PaneId) ? value as PaneId : 'pane-1';
}

export function missionVisiblePaneIdsForLayout(layout: MissionLayoutType, activePaneId = 'pane-1'): string[] {
  const active = normalizeMissionInvariantPaneId(activePaneId);
  switch (layout) {
    case 'quad': return ['pane-1', 'pane-2', 'pane-3', 'pane-4'];
    case 'triple':
    case 'triple-top':
    case 'triple-bottom':
    case 'triple-left':
    case 'triple-right': return ['pane-1', 'pane-2', 'pane-3'];
    case 'split-horizontal':
    case 'split-vertical': return ['pane-1', 'pane-2'];
    case 'focus': return [active];
    case 'single':
    case 'command':
    default: return ['pane-1'];
  }
}

export function missionLayoutForPaneId(paneId: string, current: MissionLayoutType = 'single'): MissionLayoutType {
  const pane = normalizeMissionInvariantPaneId(paneId);
  const visible = missionVisiblePaneIdsForLayout(current, pane);
  if (visible.includes(pane)) return current;
  if (pane === 'pane-4') return 'quad';
  if (pane === 'pane-3') return 'triple';
  if (pane === 'pane-2') return 'split-horizontal';
  return 'single';
}

export function canonicalPanesFromTabs(tabs: MissionTabRef[]): MissionPaneAssignment[] {
  const panes: MissionPaneAssignment[] = [];
  const usedTabs = new Set<string>();
  for (const paneId of PANE_IDS) {
    const tab = tabs.find((candidate) => candidate.paneId === paneId && !usedTabs.has(candidate.tabId));
    if (!tab) continue;
    usedTabs.add(tab.tabId);
    panes.push({ paneId, role: tab.role, tabId: tab.tabId });
  }
  return panes;
}

export function missionStateInvariantIssues(mission: MissionState): MissionStateInvariantIssue[] {
  const issues: MissionStateInvariantIssue[] = [];
  const visible = missionVisiblePaneIdsForLayout(mission.layout.type, mission.layout.activePaneId);
  if (!visible.includes(mission.layout.activePaneId)) issues.push({ code: 'active-pane-hidden', severity: 'repair', detail: `${mission.layout.activePaneId} is hidden in ${mission.layout.type}.` });
  const paneSeen = new Set<string>();
  const tabSeen = new Set<string>();
  for (const pane of mission.layout.panes || []) {
    if (paneSeen.has(pane.paneId)) issues.push({ code: 'duplicate-pane-assignment', severity: 'block', detail: `${pane.paneId} appears more than once.` });
    if (tabSeen.has(pane.tabId)) issues.push({ code: 'duplicate-tab-assignment', severity: 'block', detail: `${pane.tabId} is assigned to more than one pane.` });
    paneSeen.add(pane.paneId);
    tabSeen.add(pane.tabId);
    const tab = mission.tabs.find((candidate) => candidate.tabId === pane.tabId);
    if (!tab || tab.paneId !== pane.paneId) issues.push({ code: 'pane-tab-mismatch', severity: 'block', detail: `${pane.paneId} does not match its mission tab.` });
    if (tab && tab.role !== pane.role) issues.push({ code: 'pane-role-mismatch', severity: 'repair', detail: `${pane.paneId} role drifted from ${tab.role}.` });
  }
  const canonical = canonicalPanesFromTabs(mission.tabs);
  const actual = JSON.stringify((mission.layout.panes || []).map((pane) => [pane.paneId, pane.role, pane.tabId]));
  const expected = JSON.stringify(canonical.map((pane) => [pane.paneId, pane.role, pane.tabId]));
  if (actual !== expected) issues.push({ code: 'layout-pane-canonicalization-needed', severity: 'repair', detail: 'Mission layout panes differ from mission tab assignments.' });
  return issues;
}

export function repairMissionLayoutInvariants(layout: MissionLayout, tabs: MissionTabRef[]): { layout: MissionLayout; issues: MissionStateInvariantIssue[] } {
  const mission = { schemaVersion: 1, missionId: '00000000-0000-4000-8000-000000000000', name: 'layout', missionType: 'generic', mode: 'local-only', createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(), tabs, layout, notes: [], runbook: { objective: '', rollback: '', steps: [] }, evidence: [], timeline: [], links: { itDocs: null, psa: null } } as MissionState;
  const issues = missionStateInvariantIssues(mission);
  if (issues.some((issue) => issue.severity === 'block')) return { layout, issues };
  const nextActive = missionVisiblePaneIdsForLayout(layout.type, layout.activePaneId).includes(layout.activePaneId) ? normalizeMissionInvariantPaneId(layout.activePaneId) : normalizeMissionInvariantPaneId(missionVisiblePaneIdsForLayout(layout.type, layout.activePaneId)[0]);
  return { layout: { type: layout.type, activePaneId: nextActive, panes: canonicalPanesFromTabs(tabs) }, issues };
}

export function repairMissionStateInvariants(mission: MissionState): MissionStateInvariantIssue[] {
  const issues = missionStateInvariantIssues(mission);
  if (issues.some((issue) => issue.severity === 'block')) return issues;
  const repaired = repairMissionLayoutInvariants(mission.layout, mission.tabs);
  mission.layout = repaired.layout;
  return issues;
}
