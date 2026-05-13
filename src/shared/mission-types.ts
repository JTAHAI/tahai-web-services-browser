import type { PsaReferenceProvider } from './psa-reference-contract';
import type { RedactionFinding } from './redaction';

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
  'triple', 'triple-top', 'triple-bottom', 'triple-left', 'triple-right', 'quad',
  'focus',
  'command'
] as const;

export const MISSION_EVIDENCE_EXPORT_PROFILES = [
  'internal',
  'sanitized-handoff',
  'incident-packet',
  'change-record',
  'itdocs-sync',
  'psa-ticket-note'
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
export type MissionEvidenceExportProfile = typeof MISSION_EVIDENCE_EXPORT_PROFILES[number];

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

export type MissionTimelineEventKind =
  | 'created'
  | 'tab-added'
  | 'tab-removed'
  | 'tab-role-set'
  | 'layout-set'
  | 'pane-focused'
  | 'saved'
  | 'restored'
  | 'mission-renamed'
  | 'mission-duplicated'
  | 'mission-deleted'
  | 'note'
  | 'evidence-added'
  | 'tool-run'
  | 'exported'
  | 'runbook-updated'
  | 'checklist-added'
  | 'checklist-updated';

export type MissionTimelineEvent = {
  eventId: string;
  kind: MissionTimelineEventKind;
  createdAt: string;
  title: string;
  detail: string;
  surface?: string;
  paneId?: string;
  tabId?: string;
  exportSafeSummary?: string;
  operatorTime?: string;
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
  provider?: PsaReferenceProvider;
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

export type MissionRunbookSection = {
  sectionId: string;
  label: string;
  intent: string;
  required: boolean;
  state: MissionRunbookStepState;
  operatorNote: string;
  evidencePrompt: string;
};

export type MissionRunbookValidationStep = {
  stepId: string;
  label: string;
  state: MissionRunbookStepState;
  evidenceNote: string;
};

export type MissionRunbookRollbackCondition = {
  conditionId: string;
  label: string;
  active: boolean;
  owner: string;
  note: string;
};

export type MissionRunbookBlockedItem = {
  itemId: string;
  label: string;
  owner: string;
  status: 'open' | 'watching' | 'resolved';
  note: string;
  createdAt: string;
};

export type MissionRunbookOperatorTimestamp = {
  timestampId: string;
  label: string;
  value: string;
  note: string;
};

export type MissionRunbook = {
  objective: string;
  rollback: string;
  steps: MissionRunbookStep[];
  sections: MissionRunbookSection[];
  validationSteps: MissionRunbookValidationStep[];
  rollbackConditions: MissionRunbookRollbackCondition[];
  blockedItems: MissionRunbookBlockedItem[];
  operatorTimestamps: MissionRunbookOperatorTimestamp[];
  exportProfile: MissionEvidenceExportProfile;
  updatedAt: string;
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
  savedLabel?: string;
  path?: never;
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

export type MissionExportResult = {
  ok: boolean;
  markdown?: string;
  redactedMarkdown?: string;
  findings?: RedactionFinding[];
  highRiskCount?: number;
  redactionReview?: unknown;
  savedLabel?: string;
  path?: never;
  error?: string;
};
