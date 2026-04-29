import {
  MISSION_LAYOUT_TYPES,
  MISSION_MODES,
  MISSION_RUNBOOK_STEP_STATES,
  MISSION_SCHEMA_VERSION,
  MISSION_TAB_ROLES,
  MISSION_TYPES,
  type MissionEvidenceEntry,
  type MissionEvidenceKind,
  type MissionLayout,
  type MissionLayoutType,
  type MissionMode,
  type MissionPaneAssignment,
  type MissionRunbook,
  type MissionRunbookStep,
  type MissionRunbookStepState,
  type MissionState,
  type MissionTabRef,
  type MissionTabRole,
  type MissionTimelineEvent,
  type MissionType
} from './mission-types';

const MAX_MISSION_BYTES = 512 * 1024;
const MAX_MISSION_TABS = 32;
const MAX_MISSION_NOTES = 80;
const MAX_MISSION_TIMELINE = 160;
const MAX_MISSION_EVIDENCE = 80;
const MAX_MISSION_RUNBOOK_STEPS = 60;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PANE_RE = /^pane-[1-4]$/;
const ALLOWED_TOP_LEVEL = new Set(['schemaVersion', 'missionId', 'name', 'missionType', 'mode', 'createdAt', 'updatedAt', 'tabs', 'layout', 'notes', 'runbook', 'evidence', 'timeline', 'links']);
const FORBIDDEN_KEY_RE = /(token|secret|password|authorization|cookie|refresh|accessToken|refreshToken|client_secret|api[_-]?key)/i;
const BLOCKED_PROTOCOLS = new Set(['javascript:', 'data:', 'vbscript:', 'file:', 'ftp:']);

export type MissionValidationResult = {
  ok: boolean;
  mission?: MissionState;
  error?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanText(value: unknown, max = 180): string {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanIso(value: unknown): string {
  const raw = String(value ?? '').trim();
  const time = Number.isFinite(Date.parse(raw)) ? new Date(raw) : new Date();
  return time.toISOString();
}

function isOneOf<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

export function isMissionType(value: unknown): value is MissionType {
  return isOneOf(MISSION_TYPES, value);
}

export function isMissionTabRole(value: unknown): value is MissionTabRole {
  return isOneOf(MISSION_TAB_ROLES, value);
}

export function isMissionLayoutType(value: unknown): value is MissionLayoutType {
  return isOneOf(MISSION_LAYOUT_TYPES, value);
}

export function isMissionMode(value: unknown): value is MissionMode {
  return isOneOf(MISSION_MODES, value);
}

export function isMissionRunbookStepState(value: unknown): value is MissionRunbookStepState {
  return isOneOf(MISSION_RUNBOOK_STEP_STATES, value);
}

export function isMissionUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function isMissionPaneId(value: unknown): value is string {
  return typeof value === 'string' && PANE_RE.test(value);
}

export function sanitizeMissionUrl(value: unknown): string | undefined {
  const raw = String(value ?? '').trim();
  if (!raw || raw.length > 2048) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return undefined;
  }
  if (BLOCKED_PROTOCOLS.has(parsed.protocol)) return undefined;
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return undefined;
  if (parsed.username || parsed.password) return undefined;
  parsed.hash = '';
  return parsed.toString();
}

function hasForbiddenKey(value: unknown, path = ''): string | undefined {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = hasForbiddenKey(value[index], `${path}[${index}]`);
      if (found) return found;
    }
    return undefined;
  }
  if (!isRecord(value)) return undefined;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEY_RE.test(key)) return path ? `${path}.${key}` : key;
    const found = hasForbiddenKey(nested, path ? `${path}.${key}` : key);
    if (found) return found;
  }
  return undefined;
}

function validateTab(input: unknown): MissionTabRef | undefined {
  if (!isRecord(input)) return undefined;
  const tabId = input.tabId;
  const role = input.role;
  const url = sanitizeMissionUrl(input.url);
  const paneId = input.paneId;
  if (!isMissionUuid(tabId) || !isMissionTabRole(role) || !url || !isMissionPaneId(paneId)) return undefined;
  return {
    tabId,
    role,
    url,
    title: cleanText(input.title, 160) || new URL(url).hostname,
    pinned: Boolean(input.pinned),
    paneId
  };
}

function validatePane(input: unknown, tabs: MissionTabRef[]): MissionPaneAssignment | undefined {
  if (!isRecord(input)) return undefined;
  if (!isMissionPaneId(input.paneId) || !isMissionTabRole(input.role) || !isMissionUuid(input.tabId)) return undefined;
  if (!tabs.some((tab) => tab.tabId === input.tabId)) return undefined;
  return { paneId: input.paneId, role: input.role, tabId: input.tabId };
}

function validateLayout(input: unknown, tabs: MissionTabRef[]): MissionLayout | undefined {
  if (!isRecord(input)) return undefined;
  if (!isMissionLayoutType(input.type) || !isMissionPaneId(input.activePaneId)) return undefined;
  const panes = Array.isArray(input.panes) ? input.panes.map((pane) => validatePane(pane, tabs)).filter(Boolean) as MissionPaneAssignment[] : [];
  const uniquePanes = new Map<string, MissionPaneAssignment>();
  for (const pane of panes) uniquePanes.set(pane.paneId, pane);
  return { type: input.type, activePaneId: input.activePaneId, panes: Array.from(uniquePanes.values()).slice(0, 4) };
}

function validateRunbookStep(input: unknown): MissionRunbookStep | undefined {
  if (!isRecord(input) || !isMissionUuid(input.stepId) || !isMissionRunbookStepState(input.state)) return undefined;
  const label = cleanText(input.label, 220);
  if (!label) return undefined;
  return {
    stepId: input.stepId,
    label,
    state: input.state,
    evidenceNote: cleanText(input.evidenceNote, 500)
  };
}

function validateRunbook(input: unknown): MissionRunbook {
  const record = isRecord(input) ? input : {};
  const rawSteps = Array.isArray(record.steps) ? record.steps.slice(0, MAX_MISSION_RUNBOOK_STEPS) : [];
  const steps = rawSteps.map(validateRunbookStep).filter(Boolean) as MissionRunbookStep[];
  return {
    objective: cleanText(record.objective, 500),
    rollback: cleanText(record.rollback, 500),
    steps
  };
}


const MISSION_EVIDENCE_KINDS = ['url', 'screenshot', 'note', 'header-summary', 'tls-summary', 'dns-summary', 'tool-output', 'checklist', 'export'] as const;

function isMissionEvidenceKind(value: unknown): value is MissionEvidenceKind {
  return typeof value === 'string' && (MISSION_EVIDENCE_KINDS as readonly string[]).includes(value);
}

function validateEvidenceEntry(input: unknown, tabs: MissionTabRef[]): MissionEvidenceEntry | undefined {
  if (!isRecord(input) || !isMissionUuid(input.eventId) || !isMissionEvidenceKind(input.kind)) return undefined;
  const rawUrl = String(input.url ?? '').trim();
  const safeUrl = rawUrl ? sanitizeMissionUrl(rawUrl) : '';
  if (rawUrl && !safeUrl) return undefined;
  const sourceTabId = input.sourceTabId && isMissionUuid(input.sourceTabId) && tabs.some((tab) => tab.tabId === input.sourceTabId) ? input.sourceTabId : undefined;
  const paneId = input.paneId && isMissionPaneId(input.paneId) ? input.paneId : undefined;
  const metadata: Record<string, string> = {};
  if (isRecord(input.metadata)) {
    for (const [key, value] of Object.entries(input.metadata).slice(0, 20)) {
      const safeKey = cleanText(key, 60);
      if (!safeKey || FORBIDDEN_KEY_RE.test(safeKey)) continue;
      metadata[safeKey] = cleanText(value, 300);
    }
  }
  return {
    eventId: input.eventId,
    kind: input.kind,
    title: cleanText(input.title, 180) || 'Mission evidence',
    url: safeUrl || '',
    sourceTabId,
    paneId,
    createdAt: cleanIso(input.createdAt),
    operatorNote: cleanText(input.operatorNote, 1200),
    metadata
  };
}

function validateTimelineEvent(input: unknown): MissionTimelineEvent | undefined {
  if (!isRecord(input) || !isMissionUuid(input.eventId)) return undefined;
  const kind = String(input.kind || 'note');
  if (!['created', 'tab-added', 'tab-role-set', 'layout-set', 'saved', 'restored', 'mission-renamed', 'mission-duplicated', 'mission-deleted', 'note', 'evidence-added', 'exported', 'runbook-updated', 'checklist-added', 'checklist-updated'].includes(kind)) return undefined;
  return {
    eventId: input.eventId,
    kind: kind as MissionTimelineEvent['kind'],
    createdAt: cleanIso(input.createdAt),
    title: cleanText(input.title, 140),
    detail: cleanText(input.detail, 500)
  };
}

export function validateMission(input: unknown): MissionValidationResult {
  if (!isRecord(input)) return { ok: false, error: 'Mission payload must be an object.' };
  const serialized = JSON.stringify(input);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_MISSION_BYTES) return { ok: false, error: 'Mission file exceeds the safe local size limit.' };
  for (const key of Object.keys(input)) {
    if (!ALLOWED_TOP_LEVEL.has(key)) return { ok: false, error: `Mission contains an unknown top-level field: ${key}` };
  }
  const forbiddenKey = hasForbiddenKey(input);
  if (forbiddenKey) return { ok: false, error: `Mission contains a forbidden secret-bearing field: ${forbiddenKey}` };
  if (input.schemaVersion !== MISSION_SCHEMA_VERSION) return { ok: false, error: `Unsupported mission schema version: ${String(input.schemaVersion)}` };
  if (!isMissionUuid(input.missionId)) return { ok: false, error: 'Mission ID must be a UUID.' };
  if (!isMissionType(input.missionType)) return { ok: false, error: 'Mission type is not allowed.' };
  if (!isMissionMode(input.mode)) return { ok: false, error: 'Mission mode is not allowed.' };
  const tabs = Array.isArray(input.tabs) ? input.tabs.slice(0, MAX_MISSION_TABS).map(validateTab).filter(Boolean) as MissionTabRef[] : [];
  if (!Array.isArray(input.tabs)) return { ok: false, error: 'Mission tabs must be an array.' };
  if (input.tabs.length !== tabs.length) return { ok: false, error: 'Mission contains an invalid tab reference.' };
  const layout = validateLayout(input.layout, tabs);
  if (!layout) return { ok: false, error: 'Mission layout is invalid.' };
  const notes = Array.isArray(input.notes) ? input.notes.slice(0, MAX_MISSION_NOTES).map((note) => cleanText(note, 4000)).filter(Boolean) : [];
  const runbook = validateRunbook(input.runbook);
  const evidence = Array.isArray(input.evidence) ? input.evidence.slice(0, MAX_MISSION_EVIDENCE).map((entry) => validateEvidenceEntry(entry, tabs)).filter(Boolean) as MissionEvidenceEntry[] : [];
  if (Array.isArray(input.evidence) && input.evidence.length !== evidence.length) return { ok: false, error: 'Mission evidence contains an invalid entry.' };
  const timeline = Array.isArray(input.timeline) ? input.timeline.slice(0, MAX_MISSION_TIMELINE).map(validateTimelineEvent).filter(Boolean) as MissionTimelineEvent[] : [];
  if (Array.isArray(input.timeline) && input.timeline.length !== timeline.length) return { ok: false, error: 'Mission timeline contains an invalid event.' };
  const links = isRecord(input.links) ? input.links : {};
  return {
    ok: true,
    mission: {
      schemaVersion: MISSION_SCHEMA_VERSION,
      missionId: input.missionId,
      name: cleanText(input.name, 96) || 'Untitled mission',
      missionType: input.missionType,
      mode: input.mode,
      createdAt: cleanIso(input.createdAt),
      updatedAt: cleanIso(input.updatedAt),
      tabs,
      layout,
      notes,
      runbook,
      evidence,
      timeline,
      links: {
        itDocs: isRecord(links.itDocs) ? {
          orgId: cleanText(links.itDocs.orgId, 120) || undefined,
          orgName: cleanText(links.itDocs.orgName, 160) || undefined,
          projectId: cleanText(links.itDocs.projectId, 120) || undefined,
          runbookId: cleanText(links.itDocs.runbookId, 120) || undefined,
          evidencePackId: cleanText(links.itDocs.evidencePackId, 120) || undefined,
          deepLink: sanitizeMissionUrl(links.itDocs.deepLink) || undefined
        } : null,
        psa: isRecord(links.psa) ? {
          provider: cleanText(links.psa.provider, 40) || undefined,
          ticketId: cleanText(links.psa.ticketId, 120) || undefined,
          ticketDisplayKey: cleanText(links.psa.ticketDisplayKey, 80) || undefined,
          ticketTitle: cleanText(links.psa.ticketTitle, 180) || undefined,
          ticketDeepLink: sanitizeMissionUrl(links.psa.ticketDeepLink) || undefined,
          status: cleanText(links.psa.status, 80) || undefined
        } : null
      }
    }
  };
}
