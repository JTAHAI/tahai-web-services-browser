import { scanAndRedact } from './redaction';
import { sanitizeEvidenceUrl, type EvidenceSafetyProfile } from './evidence-safety';

const CONTROL_AND_BIDI = /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g;
const MAX_CAPTURE_TEXT = 500;
const MAX_CAPTURE_URL = 2048;

function compact(value: unknown, fallback = '', max = MAX_CAPTURE_TEXT): string {
  const raw = String(value ?? fallback)
    .replace(CONTROL_AND_BIDI, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!raw) return '';
  const redacted = scanAndRedact(raw).redacted.replace(/\s+/g, ' ').trim();
  return redacted.length > max ? `${redacted.slice(0, Math.max(0, max - 3))}...` : redacted;
}

export function sanitizeActiveCaptureText(value: unknown, fallback = '', max = 220): string {
  return compact(value, fallback, max);
}

export function sanitizeActiveCaptureUrl(value: unknown, fallback = '', profile: EvidenceSafetyProfile = 'operational-handoff'): string {
  const candidates = [value, fallback];
  for (const candidate of candidates) {
    const raw = String(candidate ?? '').replace(CONTROL_AND_BIDI, '').trim();
    if (!raw || raw.length > MAX_CAPTURE_URL) continue;
    const safe = sanitizeEvidenceUrl(raw, profile);
    if (safe) return safe;
  }
  return '';
}

export function sanitizeActiveCaptureOrigin(value: unknown, fallbackUrl = '', profile: EvidenceSafetyProfile = 'operational-handoff'): string {
  const direct = String(value ?? '').replace(CONTROL_AND_BIDI, '').trim();
  for (const candidate of [direct, fallbackUrl]) {
    if (!candidate) continue;
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
      parsed.username = '';
      parsed.password = '';
      parsed.pathname = '/';
      parsed.search = '';
      parsed.hash = '';
      const safe = sanitizeEvidenceUrl(parsed.toString(), profile);
      if (safe) return safe.replace(/\/$/, '');
    } catch {
      // Continue to fallback candidates.
    }
  }
  return '';
}

export function sanitizeActiveCapturePath(value: unknown, fallback = '/', max = 240): string {
  const raw = compact(value, fallback, max).split('?')[0].split('#')[0] || '/';
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return path
    .split('/')
    .map((segment) => {
      if (/^[A-Za-z0-9_-]{28,}$/.test(segment)) return '[redacted-id]';
      if (/^[0-9a-f]{24,}$/i.test(segment)) return '[redacted-hex]';
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(segment)) return '[redacted-uuid]';
      if (/^\d{9,}$/.test(segment)) return '[redacted-number]';
      return segment;
    })
    .join('/')
    .slice(0, max) || '/';
}

export function sanitizeActiveCaptureList(values: unknown, limit: number, itemMax = 220): string[] {
  if (!Array.isArray(values)) return [];
  const safe: string[] = [];
  const seen = new Set<string>();
  for (const item of values) {
    const text = sanitizeActiveCaptureText(item, '', itemMax);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    safe.push(text);
    if (safe.length >= limit) break;
  }
  return safe;
}

export function sanitizeActiveCaptureUrlList(values: unknown, limit: number, profile: EvidenceSafetyProfile = 'operational-handoff'): string[] {
  if (!Array.isArray(values)) return [];
  const safe: string[] = [];
  const seen = new Set<string>();
  for (const item of values) {
    const url = sanitizeActiveCaptureUrl(item, '', profile);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    safe.push(url);
    if (safe.length >= limit) break;
  }
  return safe;
}

export function sanitizeActiveCaptureLink(value: unknown, profile: EvidenceSafetyProfile = 'operational-handoff'): { text: string; href: string } | undefined {
  const link = value as { text?: unknown; href?: unknown } | undefined;
  const href = sanitizeActiveCaptureUrl(link?.href, '', profile);
  if (!href) return undefined;
  return { text: sanitizeActiveCaptureText(link?.text, 'link', 180) || 'link', href };
}

export function sanitizeActiveCaptureNumber(value: unknown, max = 1000000): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(max, Math.round(number)));
}
