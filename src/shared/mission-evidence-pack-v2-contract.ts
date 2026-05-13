import type { MissionEvidenceEntry, MissionEvidenceExportProfile, MissionState } from './mission-types';

export const PASS202_MISSION_EVIDENCE_PACK_V2_PASS = 'PASS202 — Evidence Pack v2 UX';
export const MISSION_EVIDENCE_PACK_V2_CONTRACT_ID = 'mission-evidence-pack-v2';
export const MISSION_EVIDENCE_PACK_V2_SCHEMA_VERSION = 2;

export const MISSION_EVIDENCE_PACK_V2_CAPTURE_SCOPES = [
  'active-pane',
  'all-panes',
  'tool-output',
  'recipe-prompt',
  'manual-note'
] as const;

export type MissionEvidencePackV2CaptureScope = typeof MISSION_EVIDENCE_PACK_V2_CAPTURE_SCOPES[number];

export type MissionEvidencePackV2Guardrails = {
  localOnly: true;
  browserSideOnly: true;
  explicitCaptureOnly: true;
  activePaneScopeRequired: true;
  allPaneCaptureUsesSummariesOnly: true;
  urlTitleTimeMetadataRequired: true;
  notesRedactionScanned: true;
  exportProfileVisible: true;
  clearSuccessErrorStates: true;
  noCookieCapture: true;
  noCredentialCapture: true;
  noRequestBodyCapture: true;
  noResponseBodyCapture: true;
  noBrowserStorageCapture: true;
  redactionBeforeExport: true;
  noConnectorWrites: true;
};

export const MISSION_EVIDENCE_PACK_V2_GUARDRAILS: MissionEvidencePackV2Guardrails = {
  localOnly: true,
  browserSideOnly: true,
  explicitCaptureOnly: true,
  activePaneScopeRequired: true,
  allPaneCaptureUsesSummariesOnly: true,
  urlTitleTimeMetadataRequired: true,
  notesRedactionScanned: true,
  exportProfileVisible: true,
  clearSuccessErrorStates: true,
  noCookieCapture: true,
  noCredentialCapture: true,
  noRequestBodyCapture: true,
  noResponseBodyCapture: true,
  noBrowserStorageCapture: true,
  redactionBeforeExport: true,
  noConnectorWrites: true
};

export const MISSION_EVIDENCE_PACK_V2_PROFILE_LABELS: Record<MissionEvidenceExportProfile, string> = {
  internal: 'Internal Markdown',
  'sanitized-handoff': 'Sanitized Handoff',
  'incident-packet': 'Incident Packet',
  'change-record': 'Change Record',
  'itdocs-sync': 'IT Docs Sync',
  'psa-ticket-note': 'PSA Ticket Note'
};

export const MISSION_EVIDENCE_PACK_V2_PROFILE_DETAILS: Record<MissionEvidenceExportProfile, string> = {
  internal: 'Local working copy; warnings remain visible before sharing.',
  'sanitized-handoff': 'Default coworker/vendor/client-safe handoff with sensitive values redacted.',
  'incident-packet': 'Incident-focused packet with timeline, evidence, validation, and owner review.',
  'change-record': 'Change/deployment/migration proof with before-after validation and rollback prompts.',
  'itdocs-sync': 'Browser-side packet only; IT Docs writes remain server-authorized outside this repo.',
  'psa-ticket-note': 'Short ticket note contract only; PSA writeback must route through IT Docs later.'
};

export type MissionEvidencePackV2Diagnostics = {
  pass: typeof PASS202_MISSION_EVIDENCE_PACK_V2_PASS;
  contractId: typeof MISSION_EVIDENCE_PACK_V2_CONTRACT_ID;
  schemaVersion: typeof MISSION_EVIDENCE_PACK_V2_SCHEMA_VERSION;
  evidenceCount: number;
  activePaneCount: number;
  allPaneCount: number;
  toolOutputCount: number;
  noteCount: number;
  screenshotCount: number;
  exportProfile: MissionEvidenceExportProfile;
  lastCapturedAt: string;
  hasUrlTitleTimeMetadata: boolean;
  diagnosticsLabel: string;
};

export function missionEvidencePackV2GuardrailSummary(): string {
  return 'local-only=' + String(MISSION_EVIDENCE_PACK_V2_GUARDRAILS.localOnly)
    + ' · explicit-capture=' + String(MISSION_EVIDENCE_PACK_V2_GUARDRAILS.explicitCaptureOnly)
    + ' · active/all-pane-scoped=' + String(MISSION_EVIDENCE_PACK_V2_GUARDRAILS.activePaneScopeRequired)
    + ' · summaries-only=' + String(MISSION_EVIDENCE_PACK_V2_GUARDRAILS.allPaneCaptureUsesSummariesOnly)
    + ' · redaction-before-export=' + String(MISSION_EVIDENCE_PACK_V2_GUARDRAILS.redactionBeforeExport);
}

export function missionEvidencePackV2ProfileLabel(profile: MissionEvidenceExportProfile): string {
  return MISSION_EVIDENCE_PACK_V2_PROFILE_LABELS[profile] || MISSION_EVIDENCE_PACK_V2_PROFILE_LABELS['sanitized-handoff'];
}

export function missionEvidencePackV2ProfileDetail(profile: MissionEvidenceExportProfile): string {
  return MISSION_EVIDENCE_PACK_V2_PROFILE_DETAILS[profile] || MISSION_EVIDENCE_PACK_V2_PROFILE_DETAILS['sanitized-handoff'];
}

export function missionEvidencePackV2CaptureScope(entry: MissionEvidenceEntry): MissionEvidencePackV2CaptureScope {
  const value = entry.metadata?.captureScope;
  return typeof value === 'string' && (MISSION_EVIDENCE_PACK_V2_CAPTURE_SCOPES as readonly string[]).includes(value)
    ? value as MissionEvidencePackV2CaptureScope
    : entry.kind === 'tool-output'
      ? 'tool-output'
      : entry.kind === 'checklist'
        ? 'recipe-prompt'
        : 'active-pane';
}

export function missionEvidencePackV2EntryHasMetadata(entry: MissionEvidenceEntry): boolean {
  return Boolean(entry.title && entry.createdAt && (entry.url || entry.paneId || entry.metadata?.captureScope));
}

export function missionEvidencePackV2Diagnostics(mission: MissionState | null | undefined): MissionEvidencePackV2Diagnostics {
  const entries = Array.isArray(mission?.evidence) ? mission.evidence : [];
  const activePaneCount = entries.filter((entry) => missionEvidencePackV2CaptureScope(entry) === 'active-pane').length;
  const allPaneCount = entries.filter((entry) => missionEvidencePackV2CaptureScope(entry) === 'all-panes').length;
  const toolOutputCount = entries.filter((entry) => missionEvidencePackV2CaptureScope(entry) === 'tool-output').length;
  const noteCount = entries.filter((entry) => entry.kind === 'note').length;
  const screenshotCount = entries.filter((entry) => entry.kind === 'screenshot').length;
  const sorted = [...entries].sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));
  const exportProfile = mission?.runbook?.exportProfile || 'sanitized-handoff';
  const hasUrlTitleTimeMetadata = entries.every(missionEvidencePackV2EntryHasMetadata);
  const diagnosticsLabel = entries.length
    ? `${entries.length} evidence item(s) · ${activePaneCount} active-pane · ${allPaneCount} all-pane · ${missionEvidencePackV2ProfileLabel(exportProfile)}`
    : `No evidence captured · ${missionEvidencePackV2ProfileLabel(exportProfile)}`;
  return {
    pass: PASS202_MISSION_EVIDENCE_PACK_V2_PASS,
    contractId: MISSION_EVIDENCE_PACK_V2_CONTRACT_ID,
    schemaVersion: MISSION_EVIDENCE_PACK_V2_SCHEMA_VERSION,
    evidenceCount: entries.length,
    activePaneCount,
    allPaneCount,
    toolOutputCount,
    noteCount,
    screenshotCount,
    exportProfile,
    lastCapturedAt: sorted[0]?.createdAt || '',
    hasUrlTitleTimeMetadata,
    diagnosticsLabel
  };
}

export function missionEvidencePackV2Status(kind: 'success' | 'error' | 'empty', detail: string): string {
  if (kind === 'success') return `Evidence Pack v2 captured: ${detail}`;
  if (kind === 'error') return `Evidence Pack v2 blocked: ${detail}`;
  return `Evidence Pack v2 ready: ${detail}`;
}
