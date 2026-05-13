export const PASS226_ENTERPRISE_SUPPORT_BUNDLE_V2_ID = 'pass226-enterprise-support-bundle-v2';
export const PASS226_ENTERPRISE_SUPPORT_BUNDLE_V2_VERSION = '1.0.0';

export type Pass226SupportBundleProfile =
  | 'redacted-support'
  | 'internal-diagnostics'
  | 'public-triage';

export type Pass226SupportBundleSectionKey =
  | 'app-version'
  | 'os-runtime'
  | 'package-type'
  | 'policy-truth'
  | 'install-truth'
  | 'recent-non-secret-errors'
  | 'mission-diagnostics'
  | 'browser-settings'
  | 'redaction-report'
  | 'local-data-inventory'
  | 'build-provenance-summary'
  | 'manual-proof-boundary';

export type Pass226SupportBundleProofKind =
  | 'source-contract'
  | 'runtime-diagnostics'
  | 'installed-windows-smoke'
  | 'installed-linux-smoke'
  | 'manual-attestation';

export type Pass226SupportBundleRedactionMode =
  | 'required'
  | 'default-redacted'
  | 'metadata-only'
  | 'blocked-if-secret-detected';

export interface Pass226SupportBundleSectionContract {
  key: Pass226SupportBundleSectionKey;
  required: true;
  redactionMode: Pass226SupportBundleRedactionMode;
  proofKind: Pass226SupportBundleProofKind;
  safeDescription: string;
  forbiddenValues: ReadonlyArray<string>;
}

export interface Pass226SupportBundleFieldPolicy {
  key: string;
  classification: 'safe' | 'redact' | 'block';
  reason: string;
}

export const PASS226_SUPPORT_BUNDLE_REQUIRED_SECTIONS: ReadonlyArray<Pass226SupportBundleSectionContract> = [
  {
    key: 'app-version',
    required: true,
    redactionMode: 'metadata-only',
    proofKind: 'runtime-diagnostics',
    safeDescription: 'Application name, app version, Electron/Chromium/Node runtime versions, and build channel truth.',
    forbiddenValues: ['token', 'cookie', 'authorization', 'customer-url']
  },
  {
    key: 'os-runtime',
    required: true,
    redactionMode: 'metadata-only',
    proofKind: 'runtime-diagnostics',
    safeDescription: 'OS platform, architecture, release, locale/timezone class, memory class, and display class without usernames or host secrets.',
    forbiddenValues: ['username', 'home-directory', 'machine-guid', 'ip-address']
  },
  {
    key: 'package-type',
    required: true,
    redactionMode: 'metadata-only',
    proofKind: 'runtime-diagnostics',
    safeDescription: 'Installed package lane such as dev, portable, nsis, msi, appimage, rpm, deb, msix, or unknown.',
    forbiddenValues: ['signing-key', 'certificate-private-key', 'store-credential']
  },
  {
    key: 'policy-truth',
    required: true,
    redactionMode: 'default-redacted',
    proofKind: 'runtime-diagnostics',
    safeDescription: 'Managed policy source, schema version, locked-setting count, disabled-tool count, and effective support-bundle policy.',
    forbiddenValues: ['policy-secret', 'tenant-secret', 'raw-registry-export', 'admin-password']
  },
  {
    key: 'install-truth',
    required: true,
    redactionMode: 'metadata-only',
    proofKind: 'runtime-diagnostics',
    safeDescription: 'Install path class, user-data path class, package identity, update-channel truth, signing status truth, and install/uninstall proof boundary.',
    forbiddenValues: ['full-user-path', 'username', 'private-certificate', 'pfx', 'p12']
  },
  {
    key: 'recent-non-secret-errors',
    required: true,
    redactionMode: 'blocked-if-secret-detected',
    proofKind: 'runtime-diagnostics',
    safeDescription: 'Recent application errors after redaction, stack category, component, timestamp, and non-secret message summary.',
    forbiddenValues: ['authorization-header', 'cookie-header', 'bearer-token', 'api-key', 'private-key']
  },
  {
    key: 'mission-diagnostics',
    required: true,
    redactionMode: 'default-redacted',
    proofKind: 'runtime-diagnostics',
    safeDescription: 'Mission count, active mission type, pane/layout summary, evidence counts, blocked states, and no secret-bearing mission content.',
    forbiddenValues: ['mission-note-raw-text', 'webview-html', 'auth-header', 'raw-url-query-secret', 'ticket-secret']
  },
  {
    key: 'browser-settings',
    required: true,
    redactionMode: 'default-redacted',
    proofKind: 'runtime-diagnostics',
    safeDescription: 'Safe browser preferences, feature flags, disabled controls, and user-facing settings without browsing history or credential material.',
    forbiddenValues: ['password', 'cookie', 'history-dump', 'session-storage', 'local-storage-dump']
  },
  {
    key: 'redaction-report',
    required: true,
    redactionMode: 'required',
    proofKind: 'runtime-diagnostics',
    safeDescription: 'Counts and classes of redacted or blocked values, with no raw matched secret material.',
    forbiddenValues: ['raw-secret-match', 'token-preview', 'full-cookie', 'private-key-block']
  },
  {
    key: 'local-data-inventory',
    required: true,
    redactionMode: 'metadata-only',
    proofKind: 'runtime-diagnostics',
    safeDescription: 'Safe inventory of local storage classes and approximate sizes, not file contents or user-specific absolute paths.',
    forbiddenValues: ['file-content', 'full-home-path', 'browser-cache-dump', 'indexeddb-dump']
  },
  {
    key: 'build-provenance-summary',
    required: true,
    redactionMode: 'metadata-only',
    proofKind: 'source-contract',
    safeDescription: 'Source commit if available, package hash references if generated, SBOM/provenance presence, and unsigned-preview truth.',
    forbiddenValues: ['signing-secret', 'github-token', 'ci-secret', 'certificate-private-key']
  },
  {
    key: 'manual-proof-boundary',
    required: true,
    redactionMode: 'metadata-only',
    proofKind: 'manual-attestation',
    safeDescription: 'Explicit list of what the support bundle cannot prove without installed Windows/Linux runtime smoke.',
    forbiddenValues: ['false-installed-smoke-success', 'false-ga-claim', 'false-signed-claim']
  }
] as const;

export const PASS226_SUPPORT_BUNDLE_FORBIDDEN_FIELD_POLICIES: ReadonlyArray<Pass226SupportBundleFieldPolicy> = [
  { key: 'authorization', classification: 'block', reason: 'Authorization headers must never be included in support bundles.' },
  { key: 'cookie', classification: 'block', reason: 'Cookie and Set-Cookie headers must never be included in support bundles.' },
  { key: 'set-cookie', classification: 'block', reason: 'Cookie and Set-Cookie headers must never be included in support bundles.' },
  { key: 'access_token', classification: 'block', reason: 'OAuth access tokens must never be included in support bundles.' },
  { key: 'refresh_token', classification: 'block', reason: 'OAuth refresh tokens must never be included in support bundles.' },
  { key: 'id_token', classification: 'block', reason: 'OIDC ID tokens must never be included in support bundles.' },
  { key: 'client_secret', classification: 'block', reason: 'Client secrets are server-side only and never support-bundle safe.' },
  { key: 'x-api-key', classification: 'block', reason: 'API keys must never be included in support bundles.' },
  { key: 'api_key', classification: 'block', reason: 'API keys must never be included in support bundles.' },
  { key: 'psa_api_key', classification: 'block', reason: 'PSA credentials are forbidden in browser state and support bundles.' },
  { key: 'aws_secret_access_key', classification: 'block', reason: 'Cloud credentials must never be included in support bundles.' },
  { key: 'private_key', classification: 'block', reason: 'Private key material blocks support bundle export.' },
  { key: 'password', classification: 'redact', reason: 'Password-like values must be redacted or omitted.' },
  { key: 'username', classification: 'redact', reason: 'Usernames should be redacted from path and OS diagnostics.' },
  { key: 'email', classification: 'redact', reason: 'Email addresses should be redacted from public/support profile output.' },
  { key: 'ip_address', classification: 'redact', reason: 'IP addresses should be redacted unless an internal diagnostic export explicitly allows them.' },
  { key: 'machine_id', classification: 'redact', reason: 'Machine identifiers are not needed for ordinary support triage.' }
] as const;

export const PASS226_ENTERPRISE_SUPPORT_BUNDLE_V2_CONTRACT = Object.freeze({
  id: PASS226_ENTERPRISE_SUPPORT_BUNDLE_V2_ID,
  version: PASS226_ENTERPRISE_SUPPORT_BUNDLE_V2_VERSION,
  defaultProfile: 'redacted-support' as Pass226SupportBundleProfile,
  profiles: ['redacted-support', 'internal-diagnostics', 'public-triage'] as ReadonlyArray<Pass226SupportBundleProfile>,
  sections: PASS226_SUPPORT_BUNDLE_REQUIRED_SECTIONS,
  forbiddenFieldPolicies: PASS226_SUPPORT_BUNDLE_FORBIDDEN_FIELD_POLICIES,
  invariants: Object.freeze({
    redactedByDefault: true,
    noRawTokensOrCookies: true,
    noAuthorizationHeaders: true,
    noPrivateKeysOrSigningSecrets: true,
    noMissionRawNoteDump: true,
    noBrowsingHistoryDump: true,
    policyTruthRequired: true,
    installTruthRequired: true,
    packageTypeRequired: true,
    recentErrorsMustBeNonSecret: true,
    supportBundleGenerationRequiresUserAction: true,
    supportBundleExportUsesAppOwnedTempOrUserSelectedPath: true,
    redactionReportMustContainCountsOnly: true,
    manualRuntimeProofRequiredForOneClickExport: true,
    supportBundleDoesNotClaimInstalledSmokeSuccess: true,
    supportBundleDoesNotClaimGAReadiness: true
  })
});
