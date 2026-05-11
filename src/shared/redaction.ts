import { MISSION_REDACTION_CLASSES, TAHAI_MISSION_REDACTION_PASS } from './mission-redaction-contract';

export type RedactionFinding = {
  label: string;
  count: number;
  severity: 'warn' | 'high';
};

export type RedactionRule = {
  id: string;
  label: typeof MISSION_REDACTION_CLASSES[number] | string;
  severity: RedactionFinding['severity'];
  pattern: RegExp;
  replacement: string;
};

export type RedactionScanResult = {
  redacted: string;
  findings: RedactionFinding[];
  findingCount: number;
  highRiskCount: number;
};

export const REDACTION_ENGINE_PASS = TAHAI_MISSION_REDACTION_PASS;

export const REDACTION_RULES: RedactionRule[] = [
  { id: 'authorization-header', label: 'Authorization header', severity: 'high', pattern: /\bAuthorization\s*:\s*[^\n\r]+/gi, replacement: 'Authorization: [REDACTED]' },
  { id: 'cookie-header', label: 'Cookie header', severity: 'high', pattern: /\b(Set-)?Cookie\s*:\s*[^\n\r]+/gi, replacement: '$1Cookie: [REDACTED]' },
  { id: 'bearer-token', label: 'Bearer token', severity: 'high', pattern: /\bBearer\s+[A-Za-z0-9._~+\/=:-]{16,}/gi, replacement: 'Bearer [REDACTED]' },
  { id: 'github-token', label: 'GitHub token', severity: 'high', pattern: /\b(?:ghp|github_pat|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/g, replacement: '[REDACTED_GITHUB_TOKEN]' },
  { id: 'provider-api-key', label: 'OpenAI-style API key', severity: 'high', pattern: /\bsk-[A-Za-z0-9][A-Za-z0-9_-]{18,}\b/g, replacement: '[REDACTED_PROVIDER_API_KEY]' },
  { id: 'slack-token', label: 'Slack token', severity: 'high', pattern: /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/g, replacement: '[REDACTED_SLACK_TOKEN]' },
  { id: 'google-api-key', label: 'Google API key', severity: 'high', pattern: /\bAIza[0-9A-Za-z\-_]{25,}\b/g, replacement: '[REDACTED_GOOGLE_API_KEY]' },
  { id: 'aws-access-key', label: 'AWS access key', severity: 'high', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, replacement: '[REDACTED_AWS_ACCESS_KEY]' },
  { id: 'aws-secret-access-key-assignment', label: 'AWS secret access key assignment', severity: 'high', pattern: /\b(?:aws_)?secret[_-]?access[_-]?key\b\s*[:=]\s*["']?[A-Za-z0-9/+]{32,}["']?/gi, replacement: 'AWS_SECRET_ACCESS_KEY=[REDACTED]' },
  { id: 'secret-assignment', label: 'Secret assignment', severity: 'high', pattern: /\b(?:api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|id[_-]?token|password|passwd|pwd|secret|session[_-]?id)\b\s*[:=]\s*["']?[^\s"'`|]{8,}/gi, replacement: '[REDACTED_SECRET_ASSIGNMENT]' },
  { id: 'sensitive-url-query-value', label: 'Sensitive URL query value', severity: 'high', pattern: /([?&](?:access_token|id_token|refresh_token|client_secret|api_key|key|password|secret|session|sig|signature|token|code)=)[^&#\s|)]+/gi, replacement: '$1[REDACTED]' },
  { id: 'jwt-looking-string', label: 'JWT-looking string', severity: 'warn', pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, replacement: '[REDACTED_JWT]' },
  { id: 'private-key-block', label: 'Private key block', severity: 'high', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, replacement: '[REDACTED_PRIVATE_KEY]' },
  { id: 'email-address', label: 'Email address', severity: 'warn', pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: '[REDACTED_EMAIL]' },
  { id: 'ipv4-address', label: 'IPv4 address', severity: 'warn', pattern: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g, replacement: '[REDACTED_IP]' },
  { id: 'ipv6-address', label: 'IPv6 address', severity: 'warn', pattern: /\b(?:[A-F0-9]{1,4}:){2,7}[A-F0-9]{1,4}\b/gi, replacement: '[REDACTED_IP]' },
  { id: 'cloud-account-id', label: 'Twelve-digit cloud account ID', severity: 'warn', pattern: /\b\d{12}\b/g, replacement: '[REDACTED_ACCOUNT_ID]' },
  { id: 'uuid-identifier', label: 'UUID identifier', severity: 'warn', pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, replacement: '[REDACTED_UUID]' }
];

export function scanAndRedact(input: string): RedactionScanResult {
  let redacted = String(input ?? '');
  const findings: RedactionFinding[] = [];
  for (const rule of REDACTION_RULES) {
    const matches = redacted.match(rule.pattern) || [];
    if (!matches.length) continue;
    findings.push({ label: rule.label, count: matches.length, severity: rule.severity });
    redacted = redacted.replace(rule.pattern, rule.replacement);
  }
  const highRiskCount = findings.filter((finding) => finding.severity === 'high').reduce((sum, finding) => sum + finding.count, 0);
  return { redacted, findings, findingCount: findings.reduce((sum, finding) => sum + finding.count, 0), highRiskCount };
}

export function redactForMissionStorage(value: unknown, max = 4000): string {
  return scanAndRedact(String(value ?? '').slice(0, max)).redacted;
}

export function redactForMissionExport(value: unknown): string {
  return scanAndRedact(String(value ?? '')).redacted;
}

export function hasHighRiskRedaction(value: unknown): boolean {
  return scanAndRedact(String(value ?? '')).highRiskCount > 0;
}
