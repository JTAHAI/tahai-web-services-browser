export const TAHAI_MISSION_REDACTION_PASS = 'PASS143';

export const MISSION_REDACTION_STORAGE_POLICY = {
  missionJsonIsUntrusted: true,
  rejectSecretBearingKeys: true,
  redactTextBeforePersistence: true,
  stripUrlCredentials: true,
  stripUrlFragments: true,
  redactSensitiveUrlQueryValues: true,
  exportRedactedMarkdownOnly: true
} as const;

export const MISSION_REDACTION_EXPORT_PROFILES = [
  'sanitized-handoff',
  'incident-packet',
  'change-record',
  'itdocs-sync',
  'psa-ticket-note'
] as const;

export const MISSION_REDACTION_SECRET_KEY_TOKENS = [
  'authorization',
  'bearer',
  'cookie',
  'token',
  'accessToken',
  'refreshToken',
  'idToken',
  'client_secret',
  'api_key',
  'password',
  'passwd',
  'secret',
  'privateKey',
  'session'
] as const;

export const MISSION_REDACTION_CLASSES = [
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
  'Sensitive URL query value',
  'JWT-looking string',
  'Private key block',
  'Email address',
  'IPv4 address',
  'IPv6 address',
  'Twelve-digit cloud account ID',
  'UUID identifier'
] as const;

export const MISSION_REDACTION_BLOCKED_PROTOCOLS = [
  'javascript:',
  'data:',
  'vbscript:',
  'file:',
  'ftp:'
] as const;

export function missionRedactionPolicySummary(): string {
  return [
    TAHAI_MISSION_REDACTION_PASS,
    'Mission files are untrusted input.',
    'Secret-bearing keys are rejected before persistence.',
    'Mission titles, notes, runbook text, evidence text, and metadata are redacted before save/export.',
    'Mission URLs strip credentials/fragments and redact sensitive query values.',
    'Mission copy/save export writes redacted Markdown only.'
  ].join(' ');
}
