export const ENTERPRISE_SUPPORT_BUNDLE_PASS = 'PASS160' as const;
export const ENTERPRISE_SUPPORT_BUNDLE_SCHEMA_VERSION = 1 as const;
export const ENTERPRISE_SUPPORT_BUNDLE_CONTRACT_ID = 'enterprise-support-bundle-v1' as const;
export const MAX_ENTERPRISE_SUPPORT_BUNDLE_FIELD_CHARS = 4000;
export const MAX_ENTERPRISE_SUPPORT_BUNDLE_LOG_LINES = 80;

export type EnterpriseSupportBundleMode = 'preview' | 'copy' | 'save';
export type EnterpriseSupportBundleSensitivity = 'public-safe' | 'internal-redacted' | 'blocked-secret';
export type EnterpriseSupportBundleSectionId =
  | 'versionTruth'
  | 'policyTruth'
  | 'installTruth'
  | 'runtimeTruth'
  | 'profileTruth'
  | 'missionTruth'
  | 'privacyTruth'
  | 'provenanceTruth'
  | 'logTruth';

export type EnterpriseSupportBundleSection = {
  id: EnterpriseSupportBundleSectionId;
  label: string;
  sensitivity: EnterpriseSupportBundleSensitivity;
  lines: string[];
};

export type EnterpriseSupportBundleManifest = {
  schemaVersion: typeof ENTERPRISE_SUPPORT_BUNDLE_SCHEMA_VERSION;
  pass: typeof ENTERPRISE_SUPPORT_BUNDLE_PASS;
  contractId: typeof ENTERPRISE_SUPPORT_BUNDLE_CONTRACT_ID;
  createdAt: string;
  product: string;
  version: string;
  releasePass: string;
  releaseChannel: string;
  bundleMode: EnterpriseSupportBundleMode;
  redactionApplied: true;
  localPathsRedacted: true;
  secretsRedacted: true;
  rawCookiesIncluded: false;
  rawTokensIncluded: false;
  rawBrowserProfilesIncluded: false;
  rawMissionFilesIncluded: false;
  sections: EnterpriseSupportBundleSection[];
  blockedFromEnterpriseGAClaims: string[];
};

export type EnterpriseSupportBundleResult = {
  ok: boolean;
  canceled: boolean;
  savedLabel: string;
  markdown: string;
  manifest: EnterpriseSupportBundleManifest;
  error: string;
};

export const ENTERPRISE_SUPPORT_BUNDLE_REQUIRED_SECTIONS: readonly EnterpriseSupportBundleSectionId[] = Object.freeze([
  'versionTruth',
  'policyTruth',
  'installTruth',
  'runtimeTruth',
  'profileTruth',
  'missionTruth',
  'privacyTruth',
  'provenanceTruth',
  'logTruth'
]);

const CONTROL_AND_BIDI = /[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g;
const WINDOWS_PATH = /[A-Za-z]:\\(?:[^\s\\/:*?"<>|]+\\?)+/g;
const POSIX_HOME_PATH = /\/(?:home|Users)\/[^\s/]+(?:\/[^\s]*)*/g;
const SECRET_PATTERNS: ReadonlyArray<[RegExp, string]> = Object.freeze([
  [/Authorization:\s*Bearer\s+[A-Za-z0-9._\-]+/gi, 'Authorization: Bearer [REDACTED]'],
  [/\bBearer\s+[A-Za-z0-9._\-]{16,}/gi, 'Bearer [REDACTED]'],
  [/\b(?:access|refresh|id)_token\b\s*[:=]\s*[^\s,;]+/gi, 'token=[REDACTED]'],
  [/\b(?:api[_-]?key|client[_-]?secret|password)\b\s*[:=]\s*[^\s,;]+/gi, 'secret=[REDACTED]'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[REDACTED PRIVATE KEY]'],
  [/\bghp_[A-Za-z0-9_]{20,}\b/g, 'ghp_[REDACTED]'],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, 'github_pat_[REDACTED]'],
  [/\bAKIA[0-9A-Z]{16}\b/g, 'AKIA[REDACTED]'],
  [/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g, '[REDACTED_JWT]']
]);

export function sanitizeEnterpriseSupportBundleText(value: unknown, maxChars = MAX_ENTERPRISE_SUPPORT_BUNDLE_FIELD_CHARS): string {
  let text = String(value ?? '').replace(CONTROL_AND_BIDI, ' ').trim().slice(0, maxChars);
  text = text.replace(WINDOWS_PATH, '[REDACTED_LOCAL_PATH]');
  text = text.replace(POSIX_HOME_PATH, '[REDACTED_LOCAL_PATH]');
  for (const [pattern, replacement] of SECRET_PATTERNS) text = text.replace(pattern, replacement);
  return text;
}

export function sanitizeEnterpriseSupportBundleLines(lines: unknown[]): string[] {
  return lines
    .map((line) => sanitizeEnterpriseSupportBundleText(line, MAX_ENTERPRISE_SUPPORT_BUNDLE_FIELD_CHARS))
    .filter(Boolean)
    .slice(0, MAX_ENTERPRISE_SUPPORT_BUNDLE_LOG_LINES);
}

export function enterpriseSupportBundleSection(
  id: EnterpriseSupportBundleSectionId,
  label: string,
  sensitivity: EnterpriseSupportBundleSensitivity,
  lines: unknown[]
): EnterpriseSupportBundleSection {
  return {
    id,
    label: sanitizeEnterpriseSupportBundleText(label, 160),
    sensitivity,
    lines: sanitizeEnterpriseSupportBundleLines(lines)
  };
}

export function enterpriseSupportBundleMarkdown(manifest: EnterpriseSupportBundleManifest): string {
  const header = [
    `# TAHAI Enterprise Support Bundle`,
    ``,
    `| Field | Value |`,
    `|---|---|`,
    `| Pass | ${ENTERPRISE_SUPPORT_BUNDLE_PASS} |`,
    `| Contract | ${ENTERPRISE_SUPPORT_BUNDLE_CONTRACT_ID} |`,
    `| Product | ${sanitizeEnterpriseSupportBundleText(manifest.product, 160)} |`,
    `| Version | ${sanitizeEnterpriseSupportBundleText(manifest.version, 80)} |`,
    `| Release pass | ${sanitizeEnterpriseSupportBundleText(manifest.releasePass, 80)} |`,
    `| Release channel | ${sanitizeEnterpriseSupportBundleText(manifest.releaseChannel, 80)} |`,
    `| Created | ${sanitizeEnterpriseSupportBundleText(manifest.createdAt, 80)} |`,
    `| Redaction applied | yes |`,
    `| Local paths redacted | yes |`,
    `| Raw cookies/tokens/profiles/mission files | no |`
  ];

  const sections = manifest.sections.flatMap((section) => [
    ``,
    `## ${sanitizeEnterpriseSupportBundleText(section.label, 160)}`,
    ``,
    `Sensitivity: ${section.sensitivity}`,
    ``,
    ...section.lines.map((line) => `- ${sanitizeEnterpriseSupportBundleText(line)}`)
  ]);

  const blockers = [
    ``,
    `## Enterprise GA truth`,
    ``,
    ...manifest.blockedFromEnterpriseGAClaims.map((line) => `- ${sanitizeEnterpriseSupportBundleText(line)}`)
  ];

  return [...header, ...sections, ...blockers, ''].join('\n');
}

export function enterpriseSupportBundleSummary(manifest: EnterpriseSupportBundleManifest): string[] {
  return [
    `pass=${manifest.pass}`,
    `contract=${manifest.contractId}`,
    `sections=${manifest.sections.length}`,
    'redactionApplied=true',
    'localPathsRedacted=true',
    'rawCookiesIncluded=false',
    'rawTokensIncluded=false',
    'rawBrowserProfilesIncluded=false',
    'rawMissionFilesIncluded=false'
  ];
}
