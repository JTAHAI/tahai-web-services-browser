import type { MissionLayoutType, MissionState, MissionType } from './mission-types';

export type OperatorCommandCenterV2FamilyId = 'mission' | 'layout' | 'profiles' | 'evidence' | 'opstools' | 'kb-export';
export type OperatorCommandCenterV2Status = 'ready' | 'needs-mission' | 'needs-evidence' | 'reference-only';

export type OperatorCommandCenterV2Family = {
  id: OperatorCommandCenterV2FamilyId;
  label: string;
  searchHint: string;
  enabled: boolean;
  status: OperatorCommandCenterV2Status;
  disabledReason: string;
  examples: string[];
};

export type OperatorCommandCenterV2TargetScope = {
  hasMission: boolean;
  missionName: string;
  missionType: MissionType | 'none';
  layout: MissionLayoutType | 'none';
  activePaneId: string;
  tabCount: number;
  evidenceCount: number;
  blockedRunbookCount: number;
};

export type OperatorCommandCenterV2Report = {
  contractId: 'PASS204_OPERATOR_COMMAND_CENTER_V2';
  targetScope: OperatorCommandCenterV2TargetScope;
  families: OperatorCommandCenterV2Family[];
  quickFilters: Array<{ label: string; query: string; familyId: OperatorCommandCenterV2FamilyId }>;
  summary: string;
};

function cleanText(value: string | undefined, fallback: string, max = 140): string {
  const cleaned = String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
  return cleaned || fallback;
}

function blockedRunbookCount(mission: MissionState | undefined): number {
  return mission?.runbook?.steps?.filter((step) => step.state === 'blocked').length || 0;
}

function targetScopeForMission(mission: MissionState | undefined): OperatorCommandCenterV2TargetScope {
  return {
    hasMission: Boolean(mission),
    missionName: cleanText(mission?.name, 'No active mission'),
    missionType: mission?.missionType || 'none',
    layout: mission?.layout?.type || 'none',
    activePaneId: cleanText(mission?.layout?.activePaneId, 'active tab', 40),
    tabCount: mission?.tabs?.length || 0,
    evidenceCount: mission?.evidence?.length || 0,
    blockedRunbookCount: blockedRunbookCount(mission)
  };
}

function family(input: OperatorCommandCenterV2Family): OperatorCommandCenterV2Family {
  return input;
}

export function buildOperatorCommandCenterV2Report(mission: MissionState | undefined): OperatorCommandCenterV2Report {
  const targetScope = targetScopeForMission(mission);
  const hasMission = targetScope.hasMission;
  const hasEvidence = targetScope.evidenceCount > 0;

  const families: OperatorCommandCenterV2Family[] = [
    family({
      id: 'mission',
      label: 'Mission',
      searchHint: 'mission',
      enabled: true,
      status: 'ready',
      disabledReason: '',
      examples: ['Start mission', 'restore mission', 'rename mission', 'change mission type']
    }),
    family({
      id: 'layout',
      label: 'Layouts',
      searchHint: 'layout pane focus quad split',
      enabled: hasMission,
      status: hasMission ? 'ready' : 'needs-mission',
      disabledReason: hasMission ? '' : 'Create or restore a mission before switching mission layouts or targeting panes.',
      examples: ['Switch 1-Up/2-Up/3-Up/4-Up', 'focus pane', 'send active tab to pane']
    }),
    family({
      id: 'profiles',
      label: 'Profiles',
      searchHint: 'profile admin console aws azure m365 cloudflare github',
      enabled: true,
      status: 'ready',
      disabledReason: '',
      examples: ['Open profile', 'launch admin console profile', 'start profile workspace']
    }),
    family({
      id: 'evidence',
      label: 'Evidence',
      searchHint: 'capture evidence redaction handoff export',
      enabled: hasMission,
      status: hasMission ? (hasEvidence ? 'ready' : 'needs-evidence') : 'needs-mission',
      disabledReason: hasMission ? (hasEvidence ? '' : 'Capture or pin evidence before exporting a complete evidence packet.') : 'Create or restore a mission before mission evidence commands are complete.',
      examples: ['Capture active pane', 'capture all panes', 'redaction review', 'evidence export']
    }),
    family({
      id: 'opstools',
      label: 'OpsTools',
      searchHint: 'dns tls headers redirects jwt cidr curl smoke checksum',
      enabled: true,
      status: 'ready',
      disabledReason: '',
      examples: ['DNS lookup', 'TLS/cert summary', 'headers', 'endpoint smoke check']
    }),
    family({
      id: 'kb-export',
      label: 'KB + Export',
      searchHint: 'kb guide export handoff bundle it docs psa',
      enabled: true,
      status: hasMission ? 'ready' : 'reference-only',
      disabledReason: hasMission ? '' : 'KB remains available. Mission export and handoff commands need an active mission for target scope.',
      examples: ['Find KB article', 'export mission packet', 'build handoff', 'open Guide']
    })
  ];

  const quickFilters = families.map((entry) => ({ label: entry.label, query: entry.searchHint, familyId: entry.id }));
  const blockedText = targetScope.blockedRunbookCount ? ` · ${targetScope.blockedRunbookCount} blocked runbook item(s)` : '';
  const summary = hasMission
    ? `${targetScope.missionName} · ${targetScope.missionType} · ${targetScope.layout} · ${targetScope.tabCount} tab(s) · ${targetScope.evidenceCount} evidence item(s)${blockedText}`
    : 'No active mission · Mission-scoped commands will show disabled reasons until a mission is created or restored.';

  return {
    contractId: 'PASS204_OPERATOR_COMMAND_CENTER_V2',
    targetScope,
    families,
    quickFilters,
    summary
  };
}
