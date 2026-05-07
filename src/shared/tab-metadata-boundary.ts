import { scanAndRedact } from './redaction';
import { sanitizeEvidenceUrl, type EvidenceSafetyProfile } from './evidence-safety';
import { evaluateBrowserNavigationUrl } from './navigation-boundary';

export const PASS104_TAB_METADATA_BOUNDARY = true;
export const MAX_TAB_METADATA_TEXT_CHARS = 180;
export const MAX_STATUS_METADATA_TEXT_CHARS = 360;

const CONTROL_AND_BIDI_RE = /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g;
const COLLAPSE_SPACE_RE = /\s+/g;

function compactMetadataText(value: unknown, fallback: string, max: number): string {
  const raw = String(value ?? '')
    .replace(CONTROL_AND_BIDI_RE, ' ')
    .replace(COLLAPSE_SPACE_RE, ' ')
    .trim();
  const candidate = raw || fallback;
  const redacted = scanAndRedact(candidate).redacted
    .replace(CONTROL_AND_BIDI_RE, ' ')
    .replace(COLLAPSE_SPACE_RE, ' ')
    .trim();
  const safe = redacted || fallback || 'Untitled';
  if (safe.length <= max) return safe;
  return `${safe.slice(0, Math.max(0, max - 3)).trimEnd()}...`;
}

export function sanitizeTabMetadataTitle(value: unknown, fallback = 'New tab', max = MAX_TAB_METADATA_TEXT_CHARS): string {
  return compactMetadataText(value, fallback, max);
}

export function sanitizeRemotePageTitle(value: unknown, fallback = 'New tab'): string {
  return sanitizeTabMetadataTitle(value, fallback, MAX_TAB_METADATA_TEXT_CHARS);
}

export function sanitizeStatusMetadataText(value: unknown, fallback = '', max = MAX_STATUS_METADATA_TEXT_CHARS): string {
  return compactMetadataText(value, fallback, max);
}

export function sanitizeTabMetadataUrl(value: unknown, trustedLocalUrls: readonly string[] = [], profile: EvidenceSafetyProfile = 'operational-handoff'): string {
  const decision = evaluateBrowserNavigationUrl(value, trustedLocalUrls);
  if (!decision.ok) return '';
  if (decision.kind === 'trusted-local') return decision.url;
  if (decision.kind !== 'remote') return '';
  return sanitizeEvidenceUrl(decision.url, profile);
}

export function sanitizeTabMetadataRecord(input: Record<string, unknown> | undefined, maxEntries = 24): Record<string, string> {
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(input || {}).slice(0, maxEntries)) {
    const safeKey = sanitizeTabMetadataTitle(key, 'metadata', 80);
    const safeValue = sanitizeStatusMetadataText(value, '', 500);
    if (!safeKey || !safeValue) continue;
    safe[safeKey] = safeValue;
  }
  return safe;
}
