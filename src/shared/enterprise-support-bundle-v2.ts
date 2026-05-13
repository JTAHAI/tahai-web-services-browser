import {
  PASS226_ENTERPRISE_SUPPORT_BUNDLE_V2_CONTRACT,
  PASS226_SUPPORT_BUNDLE_FORBIDDEN_FIELD_POLICIES,
  PASS226_SUPPORT_BUNDLE_REQUIRED_SECTIONS,
  type Pass226SupportBundleProfile,
  type Pass226SupportBundleSectionKey
} from './enterprise-support-bundle-v2-contract';

export interface Pass226SupportBundleInputSection {
  key: Pass226SupportBundleSectionKey;
  payload: unknown;
}

export interface Pass226SupportBundleRedactionFinding {
  sectionKey: string;
  path: string;
  classification: 'redact' | 'block';
  reason: string;
}

export interface Pass226SupportBundleManifest {
  schemaVersion: 2;
  passId: typeof PASS226_ENTERPRISE_SUPPORT_BUNDLE_V2_CONTRACT.id;
  profile: Pass226SupportBundleProfile;
  generatedAt: string;
  sections: Record<string, unknown>;
  redactionReport: {
    redactedCount: number;
    blockedCount: number;
    classes: string[];
    rawSecretMaterialIncluded: false;
  };
  proofBoundary: {
    sourceSideContractOnly: boolean;
    installedWindowsSmokeClaimed: false;
    installedLinuxSmokeClaimed: false;
    gaReadinessClaimed: false;
    notes: string[];
  };
}

export interface Pass226SupportBundleValidation {
  ok: boolean;
  missingSections: string[];
  blockedFindings: Pass226SupportBundleRedactionFinding[];
  redactedFindings: Pass226SupportBundleRedactionFinding[];
  errors: string[];
}

const BLOCKING_SECRET_VALUE_PATTERNS: ReadonlyArray<{ regex: RegExp; reason: string }> = [
  { regex: /\bBearer\s+[A-Za-z0-9._~+\-/]+=*/i, reason: 'bearer-token' },
  { regex: /\b(?:Authorization|Cookie|Set-Cookie)\s*:/i, reason: 'auth-or-cookie-header' },
  { regex: /-----BEGIN\s+(?:RSA\s+|EC\s+|OPENSSH\s+)?PRIVATE KEY-----/i, reason: 'private-key-block' },
  { regex: /\bghp_[A-Za-z0-9_]{20,}\b/i, reason: 'github-token' },
  { regex: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/i, reason: 'github-token' },
  { regex: /\bAKIA[0-9A-Z]{16}\b/, reason: 'aws-access-key-id' },
  { regex: /\b(?:access_token|refresh_token|client_secret|id_token|x-api-key|api_key)\b\s*[:=]/i, reason: 'secret-field-value' }
];

const REDACT_VALUE_PATTERNS: ReadonlyArray<{ regex: RegExp; replacement: string; reason: string }> = [
  { regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, replacement: '[redacted-email]', reason: 'email' },
  { regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, replacement: '[redacted-ipv4]', reason: 'ipv4' },
  { regex: /\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{1,4}\b/gi, replacement: '[redacted-ipv6]', reason: 'ipv6' },
  { regex: /(?:[A-Za-z]:\\Users\\|\/home\/|\/Users\/)[^\\/\s]+/g, replacement: '[redacted-user-path]', reason: 'user-path' }
];

export function pass226GetEnterpriseSupportBundleV2Contract() {
  return PASS226_ENTERPRISE_SUPPORT_BUNDLE_V2_CONTRACT;
}

export function pass226GetRequiredSupportBundleSections() {
  return PASS226_SUPPORT_BUNDLE_REQUIRED_SECTIONS;
}

export function pass226IsForbiddenSupportBundleKey(candidateKey: string): boolean {
  const normalized = candidateKey.toLowerCase().replace(/[\s.-]+/g, '_');
  return PASS226_SUPPORT_BUNDLE_FORBIDDEN_FIELD_POLICIES.some((policy) => normalized.includes(policy.key.replace(/[\s.-]+/g, '_')));
}

export function pass226ClassifySupportBundleField(candidateKey: string): 'safe' | 'redact' | 'block' {
  const normalized = candidateKey.toLowerCase().replace(/[\s.-]+/g, '_');
  const policy = PASS226_SUPPORT_BUNDLE_FORBIDDEN_FIELD_POLICIES.find((item) => normalized.includes(item.key.replace(/[\s.-]+/g, '_')));
  return policy?.classification ?? 'safe';
}

export function pass226RedactSupportBundleString(value: string): { value: string; findings: Pass226SupportBundleRedactionFinding[] } {
  const findings: Pass226SupportBundleRedactionFinding[] = [];
  let redacted = value;

  for (const pattern of BLOCKING_SECRET_VALUE_PATTERNS) {
    if (pattern.regex.test(value)) {
      findings.push({
        sectionKey: 'unknown',
        path: '$',
        classification: 'block',
        reason: pattern.reason
      });
    }
  }

  for (const pattern of REDACT_VALUE_PATTERNS) {
    if (pattern.regex.test(redacted)) {
      findings.push({
        sectionKey: 'unknown',
        path: '$',
        classification: 'redact',
        reason: pattern.reason
      });
      redacted = redacted.replace(pattern.regex, pattern.replacement);
    }
  }

  return { value: redacted, findings };
}

function sanitizeUnknown(value: unknown, sectionKey: string, path: string, findings: Pass226SupportBundleRedactionFinding[]): unknown {
  if (value == null) return value;

  if (typeof value === 'string') {
    const result = pass226RedactSupportBundleString(value);
    for (const finding of result.findings) findings.push({ ...finding, sectionKey, path });
    return result.value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') return value;

  if (Array.isArray(value)) {
    return value.slice(0, 200).map((item, index) => sanitizeUnknown(item, sectionKey, `${path}[${index}]`, findings));
  }

  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>).slice(0, 200)) {
      const classification = pass226ClassifySupportBundleField(key);
      if (classification === 'block') {
        findings.push({ sectionKey, path: `${path}.${key}`, classification: 'block', reason: `forbidden-field:${key}` });
        output[key] = '[blocked-secret-field]';
        continue;
      }
      if (classification === 'redact') {
        findings.push({ sectionKey, path: `${path}.${key}`, classification: 'redact', reason: `redacted-field:${key}` });
        output[key] = '[redacted-field]';
        continue;
      }
      output[key] = sanitizeUnknown(nested, sectionKey, `${path}.${key}`, findings);
    }
    return output;
  }

  return '[unsupported-diagnostic-value]';
}

export function pass226SanitizeSupportBundleSections(sections: ReadonlyArray<Pass226SupportBundleInputSection>) {
  const findings: Pass226SupportBundleRedactionFinding[] = [];
  const sanitized: Record<string, unknown> = {};

  for (const section of sections) {
    sanitized[section.key] = sanitizeUnknown(section.payload, section.key, '$', findings);
  }

  return {
    sections: sanitized,
    findings
  };
}

export function pass226ValidateSupportBundleSections(sections: ReadonlyArray<Pass226SupportBundleInputSection>): Pass226SupportBundleValidation {
  const keys = new Set(sections.map((section) => section.key));
  const missingSections = PASS226_SUPPORT_BUNDLE_REQUIRED_SECTIONS
    .filter((section) => !keys.has(section.key))
    .map((section) => section.key);

  const sanitized = pass226SanitizeSupportBundleSections(sections);
  const blockedFindings = sanitized.findings.filter((finding) => finding.classification === 'block');
  const redactedFindings = sanitized.findings.filter((finding) => finding.classification === 'redact');
  const errors = [
    ...missingSections.map((key) => `missing-support-bundle-section:${key}`),
    ...blockedFindings.map((finding) => `blocked-secret:${finding.sectionKey}:${finding.path}:${finding.reason}`)
  ];

  return {
    ok: errors.length === 0,
    missingSections,
    blockedFindings,
    redactedFindings,
    errors
  };
}

export function pass226BuildSupportBundleManifest(
  sections: ReadonlyArray<Pass226SupportBundleInputSection>,
  profile: Pass226SupportBundleProfile = PASS226_ENTERPRISE_SUPPORT_BUNDLE_V2_CONTRACT.defaultProfile
): Pass226SupportBundleManifest {
  const sanitized = pass226SanitizeSupportBundleSections(sections);
  const redactedCount = sanitized.findings.filter((finding) => finding.classification === 'redact').length;
  const blockedCount = sanitized.findings.filter((finding) => finding.classification === 'block').length;
  const classes = Array.from(new Set(sanitized.findings.map((finding) => finding.reason))).sort();

  return {
    schemaVersion: 2,
    passId: PASS226_ENTERPRISE_SUPPORT_BUNDLE_V2_CONTRACT.id,
    profile,
    generatedAt: new Date().toISOString(),
    sections: sanitized.sections,
    redactionReport: {
      redactedCount,
      blockedCount,
      classes,
      rawSecretMaterialIncluded: false
    },
    proofBoundary: {
      sourceSideContractOnly: true,
      installedWindowsSmokeClaimed: false,
      installedLinuxSmokeClaimed: false,
      gaReadinessClaimed: false,
      notes: [
        'PASS226 adds the source-side support bundle contract and redaction helpers.',
        'One-click installed-app export still requires runtime wiring and installed Windows/Linux smoke proof.',
        'Support bundles must remain redacted by default and must not claim GA readiness.'
      ]
    }
  };
}

export function pass226SummarizeSupportBundleValidation(sections: ReadonlyArray<Pass226SupportBundleInputSection>): string {
  const validation = pass226ValidateSupportBundleSections(sections);
  if (validation.ok) return 'PASS226 Enterprise Support Bundle v2 sections are complete and no blocked secrets were detected.';
  return `PASS226 Enterprise Support Bundle v2 blocked: ${validation.errors.join(', ')}`;
}
