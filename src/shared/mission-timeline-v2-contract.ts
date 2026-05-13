import type { MissionTimelineEvent } from './mission-types';
import { scanAndRedact } from './redaction';

export const PASS201_MISSION_TIMELINE_V2_PASS = 'PASS201 — Mission Timeline v2 UX';
export const MISSION_TIMELINE_V2_CONTRACT_ID = 'mission-timeline-v2';
export const MISSION_TIMELINE_V2_SCHEMA_VERSION = 2;

export const MISSION_TIMELINE_V2_FILTERS = [
  'all',
  'mission',
  'tabs',
  'layout',
  'pane',
  'runbook',
  'evidence',
  'tools',
  'export'
] as const;

export const MISSION_TIMELINE_V2_SURFACES = [
  'mission-control',
  'browser-tabs',
  'mission-layout',
  'active-pane-routing',
  'runbook-rail',
  'evidence-pack',
  'operator-tools',
  'export-preview',
  'local-store'
] as const;

export type MissionTimelineV2Filter = typeof MISSION_TIMELINE_V2_FILTERS[number];
export type MissionTimelineV2Surface = typeof MISSION_TIMELINE_V2_SURFACES[number];

export type MissionTimelineV2KindModel = {
  kind: MissionTimelineEvent['kind'];
  filter: Exclude<MissionTimelineV2Filter, 'all'>;
  surface: MissionTimelineV2Surface;
  label: string;
  visualTone: 'mission' | 'tab' | 'layout' | 'pane' | 'runbook' | 'evidence' | 'tool' | 'export';
  exportSafe: boolean;
};

export type MissionTimelineV2Guardrails = {
  localOnly: boolean;
  browserSideOnly: boolean;
  exportSafeSummariesOnly: boolean;
  redactionBeforeExport: boolean;
  noSecretBearingPayloads: boolean;
  noCookieCapture: boolean;
  noConnectorWrites: boolean;
  noPsaWriteback: boolean;
  noItDocsWriteWithoutServerAuthorization: boolean;
  boundedEventList: boolean;
};

export type MissionTimelineV2Diagnostics = {
  eventCount: number;
  filterCount: number;
  exportSafeCount: number;
  unsafeSummaryCount: number;
  latestOperatorTimestamp: string;
  surfaces: MissionTimelineV2Surface[];
  diagnosticsLabel: string;
};

export const MISSION_TIMELINE_V2_GUARDRAILS: MissionTimelineV2Guardrails = {
  localOnly: true,
  browserSideOnly: true,
  exportSafeSummariesOnly: true,
  redactionBeforeExport: true,
  noSecretBearingPayloads: true,
  noCookieCapture: true,
  noConnectorWrites: true,
  noPsaWriteback: true,
  noItDocsWriteWithoutServerAuthorization: true,
  boundedEventList: true
};

const KIND_MODELS: MissionTimelineV2KindModel[] = [
  { kind: 'created', filter: 'mission', surface: 'mission-control', label: 'Mission', visualTone: 'mission', exportSafe: true },
  { kind: 'mission-renamed', filter: 'mission', surface: 'mission-control', label: 'Mission', visualTone: 'mission', exportSafe: true },
  { kind: 'mission-duplicated', filter: 'mission', surface: 'local-store', label: 'Mission', visualTone: 'mission', exportSafe: true },
  { kind: 'mission-deleted', filter: 'mission', surface: 'local-store', label: 'Mission', visualTone: 'mission', exportSafe: true },
  { kind: 'saved', filter: 'mission', surface: 'local-store', label: 'Saved', visualTone: 'mission', exportSafe: true },
  { kind: 'restored', filter: 'mission', surface: 'local-store', label: 'Restored', visualTone: 'mission', exportSafe: true },
  { kind: 'tab-added', filter: 'tabs', surface: 'browser-tabs', label: 'Tab added', visualTone: 'tab', exportSafe: true },
  { kind: 'tab-removed', filter: 'tabs', surface: 'browser-tabs', label: 'Tab removed', visualTone: 'tab', exportSafe: true },
  { kind: 'tab-role-set', filter: 'tabs', surface: 'browser-tabs', label: 'Tab role', visualTone: 'tab', exportSafe: true },
  { kind: 'layout-set', filter: 'layout', surface: 'mission-layout', label: 'Layout', visualTone: 'layout', exportSafe: true },
  { kind: 'pane-focused', filter: 'pane', surface: 'active-pane-routing', label: 'Pane focus', visualTone: 'pane', exportSafe: true },
  { kind: 'note', filter: 'runbook', surface: 'runbook-rail', label: 'Note', visualTone: 'runbook', exportSafe: true },
  { kind: 'runbook-updated', filter: 'runbook', surface: 'runbook-rail', label: 'Runbook', visualTone: 'runbook', exportSafe: true },
  { kind: 'checklist-added', filter: 'runbook', surface: 'runbook-rail', label: 'Checklist', visualTone: 'runbook', exportSafe: true },
  { kind: 'checklist-updated', filter: 'runbook', surface: 'runbook-rail', label: 'Checklist', visualTone: 'runbook', exportSafe: true },
  { kind: 'evidence-added', filter: 'evidence', surface: 'evidence-pack', label: 'Evidence', visualTone: 'evidence', exportSafe: true },
  { kind: 'tool-run', filter: 'tools', surface: 'operator-tools', label: 'Tool run', visualTone: 'tool', exportSafe: true },
  { kind: 'exported', filter: 'export', surface: 'export-preview', label: 'Export', visualTone: 'export', exportSafe: true }
];

const DEFAULT_MODEL: MissionTimelineV2KindModel = {
  kind: 'note',
  filter: 'mission',
  surface: 'mission-control',
  label: 'Mission event',
  visualTone: 'mission',
  exportSafe: true
};

function compactTimelineText(value: unknown, max = 240): string {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function missionTimelineV2KindModel(kind: MissionTimelineEvent['kind']): MissionTimelineV2KindModel {
  return KIND_MODELS.find((model) => model.kind === kind) || DEFAULT_MODEL;
}

export function missionTimelineV2SafeSummary(event: Pick<MissionTimelineEvent, 'kind' | 'title' | 'detail'>): string {
  const model = missionTimelineV2KindModel(event.kind);
  const raw = [model.label, event.title, event.detail].map((part) => compactTimelineText(part, 180)).filter(Boolean).join(' · ');
  const redacted = scanAndRedact(raw || model.label).redacted;
  return compactTimelineText(redacted, 260) || model.label;
}

export function missionTimelineV2IsExportSafe(event: Pick<MissionTimelineEvent, 'kind' | 'title' | 'detail' | 'exportSafeSummary'>): boolean {
  const summary = missionTimelineV2SafeSummary(event);
  const explicit = compactTimelineText(event.exportSafeSummary, 260);
  return summary.length > 0 && (!explicit || scanAndRedact(explicit).redacted === explicit);
}

export function missionTimelineV2Diagnostics(events: MissionTimelineEvent[]): MissionTimelineV2Diagnostics {
  const safeEvents = events.slice(0, 160);
  const surfaces = Array.from(new Set(safeEvents.map((event) => missionTimelineV2KindModel(event.kind).surface)));
  const exportSafeCount = safeEvents.filter(missionTimelineV2IsExportSafe).length;
  const unsafeSummaryCount = safeEvents.length - exportSafeCount;
  const latestOperatorTimestamp = safeEvents[0]?.createdAt || '';
  return {
    eventCount: safeEvents.length,
    filterCount: MISSION_TIMELINE_V2_FILTERS.length,
    exportSafeCount,
    unsafeSummaryCount,
    latestOperatorTimestamp,
    surfaces,
    diagnosticsLabel: `${safeEvents.length} event(s) · ${surfaces.length} surface(s) · ${exportSafeCount} export-safe summary row(s)`
  };
}

export function missionTimelineV2FilterEvents(events: MissionTimelineEvent[], filter: MissionTimelineV2Filter): MissionTimelineEvent[] {
  if (filter === 'all') return events;
  return events.filter((event) => missionTimelineV2KindModel(event.kind).filter === filter);
}

export function missionTimelineV2GuardrailSummary(): string {
  return 'local-only=' + String(MISSION_TIMELINE_V2_GUARDRAILS.localOnly) +
    ' · browser-side-only=' + String(MISSION_TIMELINE_V2_GUARDRAILS.browserSideOnly) +
    ' · export-safe-summaries-only=' + String(MISSION_TIMELINE_V2_GUARDRAILS.exportSafeSummariesOnly) +
    ' · bounded-events=' + String(MISSION_TIMELINE_V2_GUARDRAILS.boundedEventList);
}
