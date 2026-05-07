import type { MissionEvidenceExportProfile } from './mission-types';
import { scanAndRedact } from './redaction';

const SENSITIVE_QUERY_KEYS = /^(?:access_token|auth|authorization|bearer|client_secret|code|cookie|id_token|key|password|refresh_token|secret|session|sig|signature|state|token|x-api-key|api_key)$/i;
const REDACT_QUERY_KEYS_FOR_SANITIZED = /^(?:account|accountid|acct|email|login|org|orgid|tenant|tenantid|user|userid)$/i;
const MAX_EXPORT_TEXT = 20000;

export type EvidenceSafetyProfile = MissionEvidenceExportProfile | 'change-bundle' | 'operational-handoff';

function profileRedactsIdentifiers(profile: EvidenceSafetyProfile): boolean {
  return profile !== 'internal';
}

export function sanitizeEvidenceUrl(value: unknown, profile: EvidenceSafetyProfile = 'sanitized-handoff'): string {
  const raw = String(value ?? '').trim();
  if (!raw || raw.length > 2048) return '';
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return '';
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
  parsed.username = '';
  parsed.password = '';
  parsed.hash = '';
  for (const key of Array.from(parsed.searchParams.keys())) {
    if (SENSITIVE_QUERY_KEYS.test(key)) {
      parsed.searchParams.set(key, '[REDACTED]');
    } else if (profileRedactsIdentifiers(profile) && REDACT_QUERY_KEYS_FOR_SANITIZED.test(key)) {
      parsed.searchParams.set(key, '[REDACTED]');
    }
  }
  return parsed.toString();
}

export function normalizeEvidenceText(value: unknown, max = MAX_EXPORT_TEXT): string {
  return String(value ?? '')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .slice(0, max)
    .trim();
}

export function evidenceMarkdownCell(value: unknown, profile: EvidenceSafetyProfile = 'sanitized-handoff'): string {
  const normalized = normalizeEvidenceText(value, 4000);
  const redacted = profile === 'internal' ? scanAndRedact(normalized).redacted : scanAndRedact(normalized).redacted;
  return redacted
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\|/g, '\\|')
    .replace(/\n{3,}/g, '\n\n');
}

export function sanitizeEvidenceMarkdown(markdown: unknown, profile: EvidenceSafetyProfile = 'sanitized-handoff'): { markdown: string; findingCount: number; highRiskCount: number } {
  const normalized = normalizeEvidenceText(markdown, MAX_EXPORT_TEXT * 4);
  const scan = scanAndRedact(normalized);
  let safe = scan.redacted.replace(/\u0000/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  safe = safe.replace(/\bhttps?:\/\/[^\s<>)\]]+/gi, (match) => sanitizeEvidenceUrl(match, profile) || '[REDACTED_URL]');

  if (profileRedactsIdentifiers(profile)) {
    safe = safe
      .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[REDACTED_IP]')
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, '[REDACTED_UUID]')
      .replace(/\b\d{12}\b/g, '[REDACTED_ACCOUNT_ID]');
  }

  return { markdown: safe.trim(), findingCount: scan.findings.reduce((sum, finding) => sum + finding.count, 0), highRiskCount: scan.highRiskCount };
}
