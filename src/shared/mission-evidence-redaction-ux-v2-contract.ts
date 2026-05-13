import type { MissionEvidenceExportProfile } from './mission-types';
import { REDACTION_RULES, scanAndRedact, type RedactionFinding } from './redaction';

export const PASS203_EVIDENCE_REDACTION_UX_V2_PASS = 'PASS203 — Evidence Redaction UX v2';
export const MISSION_EVIDENCE_REDACTION_UX_V2_CONTRACT_ID = 'mission-evidence-redaction-ux-v2';
export const MISSION_EVIDENCE_REDACTION_UX_V2_SCHEMA_VERSION = 2;

export const MISSION_EVIDENCE_REDACTION_UX_V2_DEFAULT_PROFILE: MissionEvidenceExportProfile = 'sanitized-handoff';

export const MISSION_EVIDENCE_REDACTION_UX_V2_BLOCKED_CLASSES = [
  'Private key block',
  'Authorization header',
  'Cookie header',
  'Bearer token',
  'GitHub token',
  'OpenAI-style API key',
  'Slack token',
  'Google API key',
  'AWS access key',
  'AWS secret access key assignment',
  'Secret assignment',
  'Sensitive URL query value'
] as const;

export const MISSION_EVIDENCE_REDACTION_UX_V2_WARN_CLASSES = [
  'JWT-looking string',
  'Email address',
  'IPv4 address',
  'IPv6 address',
  'Twelve-digit cloud account ID',
  'UUID identifier'
] as const;

export type MissionEvidenceRedactionUxV2DefaultAction =
  | 'redact-by-default'
  | 'warn-and-redact'
  | 'blocked-from-unredacted-export';

export type MissionEvidenceRedactionUxV2Finding = RedactionFinding & {
  id: string;
  defaultAction: MissionEvidenceRedactionUxV2DefaultAction;
  exportAction: string;
  explanation: string;
  blockedFromUnredactedExport: boolean;
};

export type MissionEvidenceRedactionUxV2Review = {
  pass: typeof PASS203_EVIDENCE_REDACTION_UX_V2_PASS;
  contractId: typeof MISSION_EVIDENCE_REDACTION_UX_V2_CONTRACT_ID;
  schemaVersion: typeof MISSION_EVIDENCE_REDACTION_UX_V2_SCHEMA_VERSION;
  profile: MissionEvidenceExportProfile;
  profileMode: string;
  findingCount: number;
  highRiskCount: number;
  blockedClassCount: number;
  findings: MissionEvidenceRedactionUxV2Finding[];
  defaultSummary: string;
  safeStatus: string;
};

export type MissionEvidenceRedactionUxV2Guardrails = {
  explainsDetections: true;
  defaultRedactionsVisible: true;
  blockedPrivateKeyAndTokenClassesVisible: true;
  internalVsSanitizedProfileDifferencesVisible: true;
  noScaryUnexplainedFailures: true;
  redactedPacketStillAllowed: true;
  noRawSecretEcho: true;
  noConnectorWrites: true;
};

export const MISSION_EVIDENCE_REDACTION_UX_V2_GUARDRAILS: MissionEvidenceRedactionUxV2Guardrails = {
  explainsDetections: true,
  defaultRedactionsVisible: true,
  blockedPrivateKeyAndTokenClassesVisible: true,
  internalVsSanitizedProfileDifferencesVisible: true,
  noScaryUnexplainedFailures: true,
  redactedPacketStillAllowed: true,
  noRawSecretEcho: true,
  noConnectorWrites: true
};

export function missionEvidenceRedactionUxV2ProfileMode(profile: MissionEvidenceExportProfile): string {
  if (profile === 'internal') return 'Internal profile keeps fuller operational context, but secret-like classes are still redacted by default before copy/save.';
  if (profile === 'itdocs-sync') return 'IT Docs sync profile stays browser-side here; redacted packet only, then server authorization must happen outside this repo.';
  if (profile === 'psa-ticket-note') return 'PSA ticket-note profile produces a short redacted summary; any writeback must route through IT Docs later.';
  if (profile === 'incident-packet') return 'Incident packet profile preserves timeline and evidence structure while default-redacting high-risk classes.';
  if (profile === 'change-record') return 'Change record profile preserves before/after and rollback context while default-redacting high-risk classes.';
  return 'Sanitized handoff is the default shareable profile; identifiers and secret-like values are redacted by default.';
}

export function missionEvidenceRedactionUxV2Explanation(label: string): string {
  if (label === 'Private key block') return 'Private key material should never be shared in evidence packets; the redacted packet can proceed without echoing the key.';
  if (label === 'Authorization header' || label === 'Cookie header') return 'Authentication headers can grant account/session access, so they are removed from evidence output.';
  if (label.includes('token') || label.includes('API key') || label.includes('access key') || label.includes('Secret')) return 'Credential-like values are redacted by default and blocked from unredacted handoff/export paths.';
  if (label === 'Sensitive URL query value') return 'Sensitive query parameters are replaced so URLs can still be useful without exposing the credential value.';
  if (label === 'JWT-looking string') return 'JWT-looking values may contain identity or claims; they are redacted unless reviewed in a strictly internal context.';
  if (label === 'Email address') return 'Email addresses can identify people or customers, so shareable profiles redact them by default.';
  if (label === 'IPv4 address' || label === 'IPv6 address') return 'IP addresses can identify infrastructure, tenants, or customers; shareable profiles redact them by default.';
  if (label === 'Twelve-digit cloud account ID') return 'Cloud account identifiers are operational identifiers and should not be included in public/vendor handoffs by default.';
  if (label === 'UUID identifier') return 'UUIDs may be tenant, ticket, org, or object identifiers; shareable profiles redact them by default.';
  return 'This value matched the evidence redaction policy and was handled before copy/save.';
}

export function missionEvidenceRedactionUxV2DefaultAction(label: string, severity: RedactionFinding['severity']): MissionEvidenceRedactionUxV2DefaultAction {
  if ((MISSION_EVIDENCE_REDACTION_UX_V2_BLOCKED_CLASSES as readonly string[]).includes(label)) return 'blocked-from-unredacted-export';
  return severity === 'high' ? 'redact-by-default' : 'warn-and-redact';
}

export function missionEvidenceRedactionUxV2ExportAction(profile: MissionEvidenceExportProfile, label: string, severity: RedactionFinding['severity']): string {
  const action = missionEvidenceRedactionUxV2DefaultAction(label, severity);
  if (action === 'blocked-from-unredacted-export') return 'Blocked from unredacted export; safe redacted packet may still be copied or saved.';
  if (profile === 'internal') return 'Shown as a warning in the internal profile; redacted output remains the default copy/save path.';
  return 'Redacted in the selected export profile before copy/save.';
}

export function missionEvidenceRedactionUxV2GuardrailSummary(): string {
  return 'explains-detections=' + String(MISSION_EVIDENCE_REDACTION_UX_V2_GUARDRAILS.explainsDetections)
    + ' · default-redactions=' + String(MISSION_EVIDENCE_REDACTION_UX_V2_GUARDRAILS.defaultRedactionsVisible)
    + ' · blocked-key-token-classes=' + String(MISSION_EVIDENCE_REDACTION_UX_V2_GUARDRAILS.blockedPrivateKeyAndTokenClassesVisible)
    + ' · profile-differences=' + String(MISSION_EVIDENCE_REDACTION_UX_V2_GUARDRAILS.internalVsSanitizedProfileDifferencesVisible)
    + ' · friendly-failures=' + String(MISSION_EVIDENCE_REDACTION_UX_V2_GUARDRAILS.noScaryUnexplainedFailures);
}

export function missionEvidenceRedactionUxV2Review(input: unknown, profile: MissionEvidenceExportProfile = MISSION_EVIDENCE_REDACTION_UX_V2_DEFAULT_PROFILE): MissionEvidenceRedactionUxV2Review {
  const raw = String(input ?? '');
  const scan = scanAndRedact(raw);
  const findings = REDACTION_RULES.map((rule) => {
    const matches = raw.match(rule.pattern) || [];
    if (!matches.length) return undefined;
    const label = String(rule.label);
    const defaultAction = missionEvidenceRedactionUxV2DefaultAction(label, rule.severity);
    return {
      id: rule.id,
      label,
      count: matches.length,
      severity: rule.severity,
      defaultAction,
      exportAction: missionEvidenceRedactionUxV2ExportAction(profile, label, rule.severity),
      explanation: missionEvidenceRedactionUxV2Explanation(label),
      blockedFromUnredactedExport: defaultAction === 'blocked-from-unredacted-export'
    } satisfies MissionEvidenceRedactionUxV2Finding;
  }).filter(Boolean) as MissionEvidenceRedactionUxV2Finding[];
  const blockedClassCount = findings.filter((finding) => finding.blockedFromUnredactedExport).reduce((sum, finding) => sum + finding.count, 0);
  const defaultSummary = findings.length
    ? `${scan.findingCount} value(s) across ${findings.length} class(es) were handled before copy/save.`
    : 'No redaction findings detected in the current packet preview.';
  const safeStatus = findings.length
    ? `Redaction preview ready — ${defaultSummary} ${blockedClassCount ? `${blockedClassCount} high-risk value(s) are blocked from unredacted export.` : 'No high-risk blocked class remains unhandled.'}`
    : 'Redaction preview clean — no secret-like values detected.';
  return {
    pass: PASS203_EVIDENCE_REDACTION_UX_V2_PASS,
    contractId: MISSION_EVIDENCE_REDACTION_UX_V2_CONTRACT_ID,
    schemaVersion: MISSION_EVIDENCE_REDACTION_UX_V2_SCHEMA_VERSION,
    profile,
    profileMode: missionEvidenceRedactionUxV2ProfileMode(profile),
    findingCount: scan.findingCount,
    highRiskCount: scan.highRiskCount,
    blockedClassCount,
    findings,
    defaultSummary,
    safeStatus
  };
}
