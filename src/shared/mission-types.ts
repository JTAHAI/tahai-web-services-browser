export const MISSION_SCHEMA_VERSION = 1;

export const MISSION_TYPES = [
  'deployment',
  'incident',
  'support',
  'documentation',
  'migration',
  'audit',
  'admin',
  'development',
  'security-review',
  'generic'
] as const;

export const MISSION_TAB_ROLES = [
  'primary-console',
  'logs',
  'docs',
  'runbook',
  'ticket',
  'monitoring',
  'evidence',
  'live-target',
  'vendor-portal',
  'tool'
] as const;

export const MISSION_LAYOUT_TYPES = [
  'single',
  'split-horizontal',
  'split-vertical',
  'triple',
  'quad',
  'focus',
  'command'
] as const;

export const MISSION_RUNBOOK_STEP_STATES = [
  'todo',
  'doing',
  'done',
  'blocked'
] as const;

export const MISSION_MODES = [
  'local-only',
  'signed-in',
  'org-selected',
  'itdocs-linked',
  'psa-available',
  'psa-linked',
  'offline',
  'session-expired',
  'permission-denied'
] as const;

export type MissionType = typeof MISSION_TYPES[number];
export type MissionTabRole = typeof MISSION_TAB_ROLES[number];
export type MissionLayoutType = typeof MISSION_LAYOUT_TYPES[number];
export type MissionRunbookStepState = typeof MISSION_RUNBOOK_STEP_STATES[number];
export type MissionMode = typeof MISSION_MODES[number];

export type MissionTabRef = {
  tabId: string;
  role: MissionTabRole;
  url: string;
  title: string;
  pinned: boolean;
  paneId: string;
};

export type MissionPaneAssignment = {
  paneId: string;
  role: MissionTabRole;
  tabId: string;
};

export type MissionLayout = {
  type: MissionLayoutType;
  activePaneId: string;
  panes: MissionPaneAssignment[];
};

export type MissionTimelineEvent = {
  eventId: string;
  kind: 'created' | 'tab-added' | 'tab-role-set' | 'layout-set' | 'saved' | 'restored' | 'mission-renamed' | 'mission-duplicated' | 'mission-deleted' | 'note' | 'evidence-added' | 'exported' | 'runbook-updated' | 'checklist-added' | 'checklist-updated';
  createdAt: string;
  title: string;
  detail: string;
};

export type MissionItDocsLinks = {
  orgId?: string;
  orgName?: string;
  projectId?: string;
  runbookId?: string;
  evidencePackId?: string;
  deepLink?: string;
};

export type MissionPsaLinks = {
  provider?: string;
  ticketId?: string;
  ticketDisplayKey?: string;
  ticketTitle?: string;
  ticketDeepLink?: string;
  status?: string;
};

export type MissionLinks = {
  itDocs: MissionItDocsLinks | null;
  psa: MissionPsaLinks | null;
};

export type MissionRunbookStep = {
  stepId: string;
  label: string;
  state: MissionRunbookStepState;
  evidenceNote: string;
};

export type MissionRunbook = {
  objective: string;
  rollback: string;
  steps: MissionRunbookStep[];
};

export type MissionEvidenceKind = 'url' | 'screenshot' | 'note' | 'header-summary' | 'tls-summary' | 'dns-summary' | 'tool-output' | 'checklist' | 'export';

export type MissionEvidenceEntry = {
  eventId: string;
  kind: MissionEvidenceKind;
  title: string;
  url: string;
  sourceTabId?: string;
  paneId?: string;
  createdAt: string;
  operatorNote: string;
  metadata: Record<string, string>;
};

export type MissionState = {
  schemaVersion: number;
  missionId: string;
  name: string;
  missionType: MissionType;
  mode: MissionMode;
  createdAt: string;
  updatedAt: string;
  tabs: MissionTabRef[];
  layout: MissionLayout;
  notes: string[];
  runbook: MissionRunbook;
  evidence: MissionEvidenceEntry[];
  timeline: MissionTimelineEvent[];
  links: MissionLinks;
};

export type MissionCreateInput = {
  name: string;
  missionType: MissionType;
};

export type MissionSaveResult = {
  ok: boolean;
  mission?: MissionState;
  error?: string;
  path?: string;
};

export type MissionListResult = {
  ok: boolean;
  missions: MissionState[];
  error?: string;
};

export type MissionLoadResult = MissionSaveResult;

export type MissionDeleteResult = {
  ok: boolean;
  deletedMissionId?: string;
  error?: string;
};
