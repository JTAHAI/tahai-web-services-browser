export type RedactionFinding = {
  label: string;
  count: number;
  severity: 'warn' | 'high';
};

const REDACTION_RULES: Array<{ label: string; severity: RedactionFinding['severity']; pattern: RegExp; replacement: string }> = [
  { label: 'Authorization header', severity: 'high', pattern: /\bAuthorization\s*:\s*[^\n\r]+/gi, replacement: 'Authorization: [REDACTED]' },
  { label: 'Cookie header', severity: 'high', pattern: /\b(Set-)?Cookie\s*:\s*[^\n\r]+/gi, replacement: '$1Cookie: [REDACTED]' },
  { label: 'Bearer token', severity: 'high', pattern: /\bBearer\s+[A-Za-z0-9._~+\/=:-]{16,}/gi, replacement: 'Bearer [REDACTED]' },
  { label: 'GitHub token', severity: 'high', pattern: /\b(?:ghp|github_pat|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/g, replacement: '[REDACTED_GITHUB_TOKEN]' },
  { label: 'OpenAI-style API key', severity: 'high', pattern: /\bsk-[A-Za-z0-9][A-Za-z0-9_-]{18,}\b/g, replacement: '[REDACTED_PROVIDER_API_KEY]' },
  { label: 'Slack token', severity: 'high', pattern: /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/g, replacement: '[REDACTED_SLACK_TOKEN]' },
  { label: 'Google API key', severity: 'high', pattern: /\bAIza[0-9A-Za-z\-_]{25,}\b/g, replacement: '[REDACTED_GOOGLE_API_KEY]' },
  { label: 'AWS access key', severity: 'high', pattern: /\bAKIA[0-9A-Z]{16}\b/g, replacement: '[REDACTED_AWS_ACCESS_KEY]' },
  { label: 'AWS secret access key assignment', severity: 'high', pattern: /\b(?:aws_)?secret[_-]?access[_-]?key\b\s*[:=]\s*["']?[A-Za-z0-9/+]{32,}["']?/gi, replacement: 'AWS_SECRET_ACCESS_KEY=[REDACTED]' },
  { label: 'Secret assignment', severity: 'high', pattern: /\b(?:api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|id[_-]?token|password|passwd|pwd|secret)\b\s*[:=]\s*["']?[^\s"'`|]{8,}/gi, replacement: '[REDACTED_SECRET_ASSIGNMENT]' },
  { label: 'Sensitive URL query value', severity: 'high', pattern: /([?&](?:access_token|id_token|refresh_token|client_secret|api_key|key|password|secret|session|sig|signature|token|code)=)[^&#\s|)]+/gi, replacement: '$1[REDACTED]' },
  { label: 'JWT-looking string', severity: 'warn', pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, replacement: '[REDACTED_JWT]' },
  { label: 'Private key block', severity: 'high', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, replacement: '[REDACTED_PRIVATE_KEY]' },
  { label: 'Email address', severity: 'warn', pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: '[REDACTED_EMAIL]' },
  { label: 'IPv4 address', severity: 'warn', pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, replacement: '[REDACTED_IP]' },
  { label: 'IPv6 address', severity: 'warn', pattern: /\b(?:[A-F0-9]{1,4}:){2,7}[A-F0-9]{1,4}\b/gi, replacement: '[REDACTED_IP]' }
];

export function scanAndRedact(input: string): { redacted: string; findings: RedactionFinding[]; highRiskCount: number } {
  let redacted = String(input ?? '');
  const findings: RedactionFinding[] = [];
  for (const rule of REDACTION_RULES) {
    const matches = redacted.match(rule.pattern) || [];
    if (!matches.length) continue;
    findings.push({ label: rule.label, count: matches.length, severity: rule.severity });
    redacted = redacted.replace(rule.pattern, rule.replacement);
  }
  return { redacted, findings, highRiskCount: findings.filter((finding) => finding.severity === 'high').reduce((sum, finding) => sum + finding.count, 0) };
}
