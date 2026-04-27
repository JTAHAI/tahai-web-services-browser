export type RedactionFinding = {
  label: string;
  count: number;
  severity: 'warn' | 'high';
};

const REDACTION_RULES: Array<{ label: string; severity: RedactionFinding['severity']; pattern: RegExp; replacement: string }> = [
  { label: 'Authorization header', severity: 'high', pattern: /\bAuthorization\s*:\s*[^\n\r]+/gi, replacement: 'Authorization: [REDACTED]' },
  { label: 'Cookie header', severity: 'high', pattern: /\b(Set-)?Cookie\s*:\s*[^\n\r]+/gi, replacement: '$1Cookie: [REDACTED]' },
  { label: 'Bearer token', severity: 'high', pattern: /\bBearer\s+[A-Za-z0-9._~+\/=:-]{16,}/gi, replacement: 'Bearer [REDACTED]' },
  { label: 'GitHub token', severity: 'high', pattern: /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/g, replacement: '[REDACTED_GITHUB_TOKEN]' },
  { label: 'AWS access key', severity: 'high', pattern: /\bAKIA[0-9A-Z]{16}\b/g, replacement: '[REDACTED_AWS_ACCESS_KEY]' },
  { label: 'JWT-looking string', severity: 'warn', pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, replacement: '[REDACTED_JWT]' },
  { label: 'Private key block', severity: 'high', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, replacement: '[REDACTED_PRIVATE_KEY]' },
  { label: 'Email address', severity: 'warn', pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: '[REDACTED_EMAIL]' },
  { label: 'IPv4 address', severity: 'warn', pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, replacement: '[REDACTED_IP]' }
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
