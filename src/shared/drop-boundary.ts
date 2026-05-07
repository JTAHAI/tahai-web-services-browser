export const PASS99_DROP_BOUNDARY = 'PASS99_DROP_BOUNDARY';

export const TAH_BROWSER_TAB_DRAG_MIME = 'application/x-tahai-browser-tab-id';
export const TAH_MISSION_TAB_DRAG_MIME = 'application/x-tahai-mission-tab-id';
export const TAH_INTERNAL_DRAG_SENTINEL_MIME = 'application/x-tahai-internal-drag-v1';
export const MAX_INTERNAL_DRAG_ID_CHARS = 128;

const INTERNAL_DRAG_TYPES = new Set([
  TAH_BROWSER_TAB_DRAG_MIME,
  TAH_MISSION_TAB_DRAG_MIME,
  TAH_INTERNAL_DRAG_SENTINEL_MIME
]);
const EXTERNAL_DROP_TYPES = new Set(['Files', 'text/uri-list', 'text/html']);
const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f]/g;
const INTERNAL_ID_RE = /^[a-z0-9][a-z0-9_.:-]{0,127}$/i;

export type TahaiDropKind = 'browser-tab' | 'mission-tab';
export type TahaiDropBoundaryDecision = {
  ok: boolean;
  kind: TahaiDropKind | '';
  id: string;
  reason: string;
  blockedExternal: boolean;
  types: string[];
};

export type MinimalDataTransfer = {
  types?: readonly string[] | DOMStringList;
  files?: { length: number } | null;
  getData?: (format: string) => string;
  setData?: (format: string, data: string) => void;
  clearData?: (format?: string) => void;
  effectAllowed?: string;
  dropEffect?: string;
};

function transferTypes(dataTransfer: MinimalDataTransfer | null | undefined): string[] {
  const raw = dataTransfer?.types;
  if (!raw) return [];
  try {
    return Array.from(raw as Iterable<string>).map((type) => String(type));
  } catch {
    const list = raw as DOMStringList;
    const output: string[] = [];
    for (let index = 0; index < (list.length || 0); index += 1) output.push(String(list.item(index) || ''));
    return output.filter(Boolean);
  }
}

function normalizeInternalDragId(value: unknown): string {
  const clean = String(value ?? '').replace(CONTROL_CHARS_RE, '').trim().slice(0, MAX_INTERNAL_DRAG_ID_CHARS);
  return INTERNAL_ID_RE.test(clean) ? clean : '';
}

function readDragData(dataTransfer: MinimalDataTransfer | null | undefined, type: string): string {
  try {
    return dataTransfer?.getData?.(type) || '';
  } catch {
    return '';
  }
}

export function writeTahaiInternalDragPayload(dataTransfer: MinimalDataTransfer | null | undefined, type: typeof TAH_BROWSER_TAB_DRAG_MIME | typeof TAH_MISSION_TAB_DRAG_MIME, id: string): boolean {
  const cleanId = normalizeInternalDragId(id);
  if (!dataTransfer || !dataTransfer.setData || !cleanId) return false;
  dataTransfer.effectAllowed = 'move';
  dataTransfer.setData(TAH_INTERNAL_DRAG_SENTINEL_MIME, PASS99_DROP_BOUNDARY);
  dataTransfer.setData(type, cleanId);
  // Keep text/plain non-sensitive so dragging a browser tab to a text editor or remote page does not leak its URL.
  dataTransfer.setData('text/plain', 'TAHAI internal Mission drag');
  return true;
}

export function evaluateTahaiInternalDrop(dataTransfer: MinimalDataTransfer | null | undefined, allowedKinds: readonly TahaiDropKind[]): TahaiDropBoundaryDecision {
  const types = transferTypes(dataTransfer);
  const allowed = new Set(allowedKinds);
  const fileCount = Number(dataTransfer?.files?.length || 0);
  const hasExternalPayload = fileCount > 0 || types.some((type) => EXTERNAL_DROP_TYPES.has(type));
  const hasInternalPayload = types.some((type) => INTERNAL_DRAG_TYPES.has(type));

  if (!dataTransfer) {
    return { ok: false, kind: '', id: '', reason: 'Drop has no dataTransfer payload.', blockedExternal: false, types };
  }
  if (hasExternalPayload && !hasInternalPayload) {
    return { ok: false, kind: '', id: '', reason: 'External file, HTML, or URL drops are not Mission pane targets.', blockedExternal: true, types };
  }

  if (allowed.has('browser-tab')) {
    const id = normalizeInternalDragId(readDragData(dataTransfer, TAH_BROWSER_TAB_DRAG_MIME));
    if (id) return { ok: true, kind: 'browser-tab', id, reason: 'Internal browser-tab Mission drop accepted.', blockedExternal: false, types };
  }
  if (allowed.has('mission-tab')) {
    const id = normalizeInternalDragId(readDragData(dataTransfer, TAH_MISSION_TAB_DRAG_MIME));
    if (id) return { ok: true, kind: 'mission-tab', id, reason: 'Internal mission-tab drop accepted.', blockedExternal: false, types };
  }

  if (hasInternalPayload) {
    return { ok: false, kind: '', id: '', reason: 'Internal Mission drop payload was missing or invalid.', blockedExternal: false, types };
  }

  return { ok: false, kind: '', id: '', reason: 'Only TAHAI internal Mission tab drags are accepted here.', blockedExternal: hasExternalPayload, types };
}

export function isExternalDropPayload(dataTransfer: MinimalDataTransfer | null | undefined): boolean {
  const types = transferTypes(dataTransfer);
  const fileCount = Number(dataTransfer?.files?.length || 0);
  const hasInternalPayload = types.some((type) => INTERNAL_DRAG_TYPES.has(type));
  return !hasInternalPayload && (fileCount > 0 || types.some((type) => EXTERNAL_DROP_TYPES.has(type) || type === 'text/plain'));
}

export function clearBlockedDropPayload(dataTransfer: MinimalDataTransfer | null | undefined): void {
  try { dataTransfer?.clearData?.(); } catch { /* noop: browsers may deny clearData during some drag phases */ }
  if (dataTransfer) dataTransfer.dropEffect = 'none';
}
