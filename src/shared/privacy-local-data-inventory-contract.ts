export const PASS220_PRIVACY_LOCAL_DATA_INVENTORY_ID = 'PASS220_PRIVACY_LOCAL_DATA_INVENTORY' as const;
export const PASS220_PRIVACY_LOCAL_DATA_INVENTORY_VERSION = 1 as const;

export type Pass220DataSensitivity =
  | 'public'
  | 'local-operational'
  | 'user-content'
  | 'sensitive-operational'
  | 'secret-prohibited';

export type Pass220RetentionMode =
  | 'session-only'
  | 'until-user-clears'
  | 'until-mission-deleted'
  | 'until-export-deleted'
  | 'explicit-user-export-only'
  | 'not-stored';

export type Pass220DataSurfaceId =
  | 'app-settings'
  | 'browser-session-cache'
  | 'mission-json'
  | 'mission-evidence-files'
  | 'mission-export-artifacts'
  | 'downloads-artifact-shelf'
  | 'support-bundle'
  | 'runtime-logs'
  | 'policy-diagnostics'
  | 'crash-recovery-state'
  | 'itdocs-display-cache'
  | 'psa-reference-cache'
  | 'webview-remote-content-storage';

export type Pass220StorageClass =
  | 'electron-user-data'
  | 'electron-cache'
  | 'app-owned-mission-directory'
  | 'app-owned-evidence-directory'
  | 'app-owned-log-directory'
  | 'user-selected-export-path'
  | 'user-selected-download-path'
  | 'managed-policy-path'
  | 'not-written-by-browser';

export type Pass220RedactionRequirement =
  | 'none'
  | 'scan-before-export'
  | 'redact-by-default'
  | 'block-private-keys-and-tokens'
  | 'display-safe-only';

export interface Pass220DataSurfaceInventoryItem {
  readonly id: Pass220DataSurfaceId;
  readonly label: string;
  readonly storageClass: Pass220StorageClass;
  readonly containsUserContent: boolean;
  readonly sensitivity: Pass220DataSensitivity;
  readonly retention: Pass220RetentionMode;
  readonly redaction: Pass220RedactionRequirement;
  readonly userVisible: boolean;
  readonly exportable: boolean;
  readonly supportBundleAllowed: boolean;
  readonly clearableByUser: boolean;
  readonly prohibitedFields: readonly string[];
  readonly allowedFields: readonly string[];
  readonly releaseBlocker: boolean;
}

export const PASS220_PROHIBITED_LOCAL_DATA_FIELDS = [
  'access_token',
  'refresh_token',
  'id_token',
  'Authorization',
  'Cookie',
  'Set-Cookie',
  'BEGIN PRIVATE KEY',
  'BEGIN RSA PRIVATE KEY',
  'AWS_SECRET_ACCESS_KEY',
  'AZURE_CLIENT_SECRET',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'PSA_API_KEY',
  'providerApiSecret',
  'rawSessionCookie',
  'rawAuthHeader'
] as const;

export const PASS220_ALLOWED_SUPPORT_BUNDLE_FIELDS = [
  'appVersion',
  'osVersion',
  'packageType',
  'installTruth',
  'policyTruth',
  'nonSecretErrorSummary',
  'missionDiagnosticsSummary',
  'redactionReport',
  'verifierResults',
  'timestamp'
] as const;

export const PASS220_PRIVACY_LOCAL_DATA_SURFACES: readonly Pass220DataSurfaceInventoryItem[] = [
  {
    id: 'app-settings',
    label: 'Application settings and UI preferences',
    storageClass: 'electron-user-data',
    containsUserContent: false,
    sensitivity: 'local-operational',
    retention: 'until-user-clears',
    redaction: 'none',
    userVisible: true,
    exportable: false,
    supportBundleAllowed: true,
    clearableByUser: true,
    prohibitedFields: [...PASS220_PROHIBITED_LOCAL_DATA_FIELDS],
    allowedFields: ['theme', 'zoom', 'homeUrl', 'permissionToggles', 'toolbarLayout'],
    releaseBlocker: true
  },
  {
    id: 'browser-session-cache',
    label: 'Chromium cache, storage, and session internals',
    storageClass: 'electron-cache',
    containsUserContent: true,
    sensitivity: 'sensitive-operational',
    retention: 'until-user-clears',
    redaction: 'display-safe-only',
    userVisible: true,
    exportable: false,
    supportBundleAllowed: false,
    clearableByUser: true,
    prohibitedFields: [...PASS220_PROHIBITED_LOCAL_DATA_FIELDS, 'localStorageDump', 'indexedDbDump'],
    allowedFields: ['cacheSizeSummary', 'sessionRestoreAvailable'],
    releaseBlocker: true
  },
  {
    id: 'mission-json',
    label: 'Local Mission Control mission files',
    storageClass: 'app-owned-mission-directory',
    containsUserContent: true,
    sensitivity: 'user-content',
    retention: 'until-mission-deleted',
    redaction: 'scan-before-export',
    userVisible: true,
    exportable: true,
    supportBundleAllowed: false,
    clearableByUser: true,
    prohibitedFields: [...PASS220_PROHIBITED_LOCAL_DATA_FIELDS, 'psaToken', 'itDocsToken'],
    allowedFields: ['missionId', 'name', 'missionType', 'layout', 'tabs', 'notes', 'timeline', 'displayRefs'],
    releaseBlocker: true
  },
  {
    id: 'mission-evidence-files',
    label: 'Evidence captures and metadata',
    storageClass: 'app-owned-evidence-directory',
    containsUserContent: true,
    sensitivity: 'sensitive-operational',
    retention: 'until-mission-deleted',
    redaction: 'redact-by-default',
    userVisible: true,
    exportable: true,
    supportBundleAllowed: false,
    clearableByUser: true,
    prohibitedFields: [...PASS220_PROHIBITED_LOCAL_DATA_FIELDS, 'rawCookieHeader', 'rawAuthorizationHeader'],
    allowedFields: ['url', 'title', 'createdAt', 'paneId', 'tabId', 'safeMetadata', 'redactionReport'],
    releaseBlocker: true
  },
  {
    id: 'mission-export-artifacts',
    label: 'Mission handoff exports and evidence packets',
    storageClass: 'user-selected-export-path',
    containsUserContent: true,
    sensitivity: 'sensitive-operational',
    retention: 'explicit-user-export-only',
    redaction: 'block-private-keys-and-tokens',
    userVisible: true,
    exportable: true,
    supportBundleAllowed: false,
    clearableByUser: false,
    prohibitedFields: [...PASS220_PROHIBITED_LOCAL_DATA_FIELDS],
    allowedFields: ['sanitizedMarkdown', 'sanitizedHtml', 'manifest', 'checksum', 'redactionReport'],
    releaseBlocker: true
  },
  {
    id: 'downloads-artifact-shelf',
    label: 'Download and artifact shelf display records',
    storageClass: 'user-selected-download-path',
    containsUserContent: true,
    sensitivity: 'local-operational',
    retention: 'until-user-clears',
    redaction: 'display-safe-only',
    userVisible: true,
    exportable: false,
    supportBundleAllowed: true,
    clearableByUser: true,
    prohibitedFields: [...PASS220_PROHIBITED_LOCAL_DATA_FIELDS, 'fullLocalPathInRenderer'],
    allowedFields: ['fileName', 'sourceOrigin', 'riskState', 'createdAt', 'checksumWhenAvailable'],
    releaseBlocker: true
  },
  {
    id: 'support-bundle',
    label: 'Redacted support bundle',
    storageClass: 'user-selected-export-path',
    containsUserContent: false,
    sensitivity: 'local-operational',
    retention: 'explicit-user-export-only',
    redaction: 'redact-by-default',
    userVisible: true,
    exportable: true,
    supportBundleAllowed: true,
    clearableByUser: false,
    prohibitedFields: [...PASS220_PROHIBITED_LOCAL_DATA_FIELDS, 'rawMissionNotes', 'screenshots', 'fullUrlWithQuery'],
    allowedFields: [...PASS220_ALLOWED_SUPPORT_BUNDLE_FIELDS],
    releaseBlocker: true
  },
  {
    id: 'runtime-logs',
    label: 'Runtime logs and non-secret diagnostics',
    storageClass: 'app-owned-log-directory',
    containsUserContent: false,
    sensitivity: 'local-operational',
    retention: 'until-user-clears',
    redaction: 'redact-by-default',
    userVisible: true,
    exportable: true,
    supportBundleAllowed: true,
    clearableByUser: true,
    prohibitedFields: [...PASS220_PROHIBITED_LOCAL_DATA_FIELDS, 'rawUrlQuery', 'rawPostBody'],
    allowedFields: ['level', 'code', 'message', 'timestamp', 'safeContext'],
    releaseBlocker: true
  },
  {
    id: 'policy-diagnostics',
    label: 'Managed policy truth diagnostics',
    storageClass: 'managed-policy-path',
    containsUserContent: false,
    sensitivity: 'local-operational',
    retention: 'until-user-clears',
    redaction: 'none',
    userVisible: true,
    exportable: true,
    supportBundleAllowed: true,
    clearableByUser: false,
    prohibitedFields: [...PASS220_PROHIBITED_LOCAL_DATA_FIELDS],
    allowedFields: ['source', 'schemaVersion', 'lockedSettings', 'disabledTools', 'findingCodes'],
    releaseBlocker: true
  },
  {
    id: 'crash-recovery-state',
    label: 'Crash recovery and session durability state',
    storageClass: 'electron-user-data',
    containsUserContent: true,
    sensitivity: 'sensitive-operational',
    retention: 'until-user-clears',
    redaction: 'scan-before-export',
    userVisible: true,
    exportable: false,
    supportBundleAllowed: false,
    clearableByUser: true,
    prohibitedFields: [...PASS220_PROHIBITED_LOCAL_DATA_FIELDS, 'rawPageContent', 'rawFormValues'],
    allowedFields: ['tabUrls', 'missionIds', 'layoutType', 'activePaneId', 'timestamp'],
    releaseBlocker: true
  },
  {
    id: 'itdocs-display-cache',
    label: 'IT Docs display-only reference cache',
    storageClass: 'electron-user-data',
    containsUserContent: false,
    sensitivity: 'local-operational',
    retention: 'until-user-clears',
    redaction: 'display-safe-only',
    userVisible: true,
    exportable: false,
    supportBundleAllowed: false,
    clearableByUser: true,
    prohibitedFields: [...PASS220_PROHIBITED_LOCAL_DATA_FIELDS, 'cognitoToken', 'oauthRefreshToken'],
    allowedFields: ['orgName', 'projectName', 'runbookTitle', 'deepLinkOrigin'],
    releaseBlocker: true
  },
  {
    id: 'psa-reference-cache',
    label: 'PSA display-only ticket reference cache',
    storageClass: 'electron-user-data',
    containsUserContent: false,
    sensitivity: 'local-operational',
    retention: 'until-user-clears',
    redaction: 'display-safe-only',
    userVisible: true,
    exportable: false,
    supportBundleAllowed: false,
    clearableByUser: true,
    prohibitedFields: [...PASS220_PROHIBITED_LOCAL_DATA_FIELDS, 'psaClientSecret', 'psaAccessToken'],
    allowedFields: ['provider', 'ticketDisplayKey', 'ticketTitle', 'ticketDeepLinkOrigin', 'status'],
    releaseBlocker: true
  },
  {
    id: 'webview-remote-content-storage',
    label: 'Remote webview content storage owned by Chromium session',
    storageClass: 'not-written-by-browser',
    containsUserContent: true,
    sensitivity: 'sensitive-operational',
    retention: 'until-user-clears',
    redaction: 'display-safe-only',
    userVisible: true,
    exportable: false,
    supportBundleAllowed: false,
    clearableByUser: true,
    prohibitedFields: [...PASS220_PROHIBITED_LOCAL_DATA_FIELDS, 'cookieJarExport', 'localStorageExport'],
    allowedFields: ['originSummary', 'storageAvailableSummary'],
    releaseBlocker: true
  }
] as const;

export const PASS220_PRIVACY_BOUNDARY = Object.freeze({
  sourceSideInventoryOnly: true,
  noInstalledAppSmokeClaim: true,
  noSigningClaim: true,
  noStoreApprovalClaim: true,
  noPublicGaClaim: true,
  noItDocsBackend: true,
  noPsaConnector: true,
  noDirectPsaApiCalls: true,
  noProviderSecrets: true,
  rendererMustNotReceiveFullLocalPaths: true,
  supportBundleMustBeRedacted: true,
  missionExportsRequirePreview: true
});
