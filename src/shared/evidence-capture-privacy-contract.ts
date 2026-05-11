import type { MissionEvidenceExportProfile } from './mission-types';
import { scanAndRedact, type RedactionFinding } from './redaction';

export const EVIDENCE_CAPTURE_PRIVACY_PASS = 'PASS157' as const;
export const EVIDENCE_CAPTURE_PRIVACY_CONTRACT_ID = 'evidence-capture-privacy-hardening-v1' as const;
export const EVIDENCE_CAPTURE_PRIVACY_SCHEMA_VERSION = 1 as const;

export type EvidenceCaptureOperation = 'preview' | 'copy' | 'save' | 'itdocs-sync' | 'psa-ticket-note';
export type EvidenceCapturePrivacyAction = 'allow' | 'preview-required' | 'block-sync';

export type EvidenceCapturePrivacyPolicy = {
  schemaVersion: typeof EVIDENCE_CAPTURE_PRIVACY_SCHEMA_VERSION;
  pass: typeof EVIDENCE_CAPTURE_PRIVACY_PASS;
  contractId: typeof EVIDENCE_CAPTURE_PRIVACY_CONTRACT_ID;
  defaultProfile: MissionEvidenceExportProfile;
  requirePreviewBeforeShare: true;
  blockHighRiskAutomaticSync: true;
  minimizeSensitiveDomainPaths: true;
  minimizeMetadataBeforeExport: true;
  stripCookiesAndAuthHeaders: true;
  storesSecrets: false;
  directPsaApiAllowed: false;
};

export type EvidenceCapturePrivacyReview = {
  action: EvidenceCapturePrivacyAction;
  requiresPreview: boolean;
  blockedForAutomaticSync: boolean;
  sensitiveDomain: boolean;
  host: string;
  findingCount: number;
  highRiskCount: number;
  findings: RedactionFinding[];
  warnings: string[];
};

export const EVIDENCE_CAPTURE_PRIVACY_POLICY: EvidenceCapturePrivacyPolicy = {
  schemaVersion: EVIDENCE_CAPTURE_PRIVACY_SCHEMA_VERSION,
  pass: EVIDENCE_CAPTURE_PRIVACY_PASS,
  contractId: EVIDENCE_CAPTURE_PRIVACY_CONTRACT_ID,
  defaultProfile: 'sanitized-handoff',
  requirePreviewBeforeShare: true,
  blockHighRiskAutomaticSync: true,
  minimizeSensitiveDomainPaths: true,
  minimizeMetadataBeforeExport: true,
  stripCookiesAndAuthHeaders: true,
  storesSecrets: false,
  directPsaApiAllowed: false
};

export const EVIDENCE_CAPTURE_PRIVACY_SENSITIVE_HOSTS: readonly string[] = [
  'admin.microsoft.com',
  'entra.microsoft.com',
  'portal.azure.com',
  'security.microsoft.com',
  'compliance.microsoft.com',
  'console.aws.amazon.com',
  'signin.aws.amazon.com',
  'admin.google.com',
  'console.cloud.google.com',
  'accounts.google.com',
  'dash.cloudflare.com',
  'github.com',
  'vercel.com',
  'firebase.google.com',
  'support.fortinet.com',
  'support.paloaltonetworks.com',
  'support.cisco.com',
  'docs.tahaiportal.com'
] as const;

// Explicitly guarded families: Authorization, Set-Cookie, client_secret, refresh_token, access_token, BEGIN PRIVATE KEY.
const SENSITIVE_METADATA_KEY_RE = /(?:authorization|cookie|set-cookie|token|secret|password|passwd|pwd|api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|id[_-]?token|session|csrf|xsrf|saml|assertion|private[_-]?key)/i;
const IDENTIFIER_PATH_SEGMENT_RE = /(?:^[A-Za-z0-9_-]{28,}$|^[0-9a-f]{24,}$|^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$|^\d{9,}$|^[^/@\s]+@[^/@\s]+\.[^/@\s]+$)/i;

export function evidenceCaptureHost(value: unknown): string {
  try {
    const parsed = new URL(String(value ?? '').trim());
    return parsed.hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function isSensitiveEvidenceCaptureHost(host: unknown): boolean {
  const normalized = String(host ?? '').toLowerCase();
  if (!normalized) return false;
  return EVIDENCE_CAPTURE_PRIVACY_SENSITIVE_HOSTS.some((sensitive) => normalized === sensitive || normalized.endsWith(`.${sensitive}`));
}

export function isSensitiveEvidenceCaptureUrl(value: unknown): boolean {
  return isSensitiveEvidenceCaptureHost(evidenceCaptureHost(value));
}

export function sanitizeSensitiveEvidencePath(pathname: unknown): string {
  const raw = String(pathname ?? '/').split('?')[0].split('#')[0] || '/';
  const normalized = raw.startsWith('/') ? raw : `/${raw}`;
  const safe = normalized
    .split('/')
    .map((segment) => {
      if (!segment) return '';
      const decoded = safeDecode(segment);
      return IDENTIFIER_PATH_SEGMENT_RE.test(decoded) ? '[redacted-id]' : segment;
    })
    .join('/');
  return safe || '/';
}

export function sanitizeEvidenceCaptureMetadata(metadata: unknown): Record<string, string> {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  const safe: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(metadata).slice(0, 20)) {
    const key = String(rawKey ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!key || SENSITIVE_METADATA_KEY_RE.test(key)) continue;
    const value = scanAndRedact(String(rawValue ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300)).redacted;
    if (!value || SENSITIVE_METADATA_KEY_RE.test(value)) continue;
    safe[key] = value;
  }
  return safe;
}

export function reviewEvidenceCapturePrivacy(input: {
  url?: unknown;
  title?: unknown;
  note?: unknown;
  metadata?: unknown;
  profile?: MissionEvidenceExportProfile;
  operation?: EvidenceCaptureOperation;
}): EvidenceCapturePrivacyReview {
  const operation = input.operation || 'preview';
  const profile = input.profile || EVIDENCE_CAPTURE_PRIVACY_POLICY.defaultProfile;
  const host = evidenceCaptureHost(input.url);
  const sensitiveDomain = isSensitiveEvidenceCaptureHost(host);
  const metadata = sanitizeEvidenceCaptureMetadata(input.metadata);
  const text = [input.url, input.title, input.note, ...Object.entries(metadata).flat()].map((value) => String(value ?? '')).join('\n');
  const scan = scanAndRedact(text);
  const highRiskSync = EVIDENCE_CAPTURE_PRIVACY_POLICY.blockHighRiskAutomaticSync && scan.highRiskCount > 0 && (operation === 'itdocs-sync' || operation === 'psa-ticket-note');
  const requiresPreview = EVIDENCE_CAPTURE_PRIVACY_POLICY.requirePreviewBeforeShare && operation !== 'preview';
  const warnings: string[] = [];
  if (requiresPreview) warnings.push('Redaction preview required before sharing, saving, IT Docs sync, or PSA ticket note generation.');
  if (sensitiveDomain) warnings.push('Sensitive admin-console domain detected; path identifiers and metadata are minimized before export.');
  if (scan.highRiskCount > 0) warnings.push('High-risk secret-like content detected and redacted before export.');
  if (profile !== 'internal') warnings.push('Shareable export profile redacts identifiers by default.');
  return {
    action: highRiskSync ? 'block-sync' : requiresPreview ? 'preview-required' : 'allow',
    requiresPreview,
    blockedForAutomaticSync: highRiskSync,
    sensitiveDomain,
    host,
    findingCount: scan.findingCount,
    highRiskCount: scan.highRiskCount,
    findings: scan.findings,
    warnings
  };
}

export function evidenceCapturePrivacySummary(): string {
  return [
    `${EVIDENCE_CAPTURE_PRIVACY_PASS} ${EVIDENCE_CAPTURE_PRIVACY_CONTRACT_ID}`,
    'Redaction preview is required before share/save/sync operations.',
    'High-risk findings block automatic IT Docs or PSA ticket-note sync until reviewed.',
    'Sensitive admin-console domains minimize path identifiers and metadata.',
    'Cookies, Authorization headers, tokens, passwords, private keys, and API keys are stripped before export.',
    'Browser-side PSA direct API calls remain forbidden.'
  ].join(' ');
}

function safeDecode(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}
