import { evaluateBrowserNavigationUrl } from './navigation-boundary';

export const ENTERPRISE_ADMIN_POLICY_PASS = 'PASS154';
export const ENTERPRISE_ADMIN_POLICY_SCHEMA_VERSION = 1;
export const ENTERPRISE_ADMIN_POLICY_CONTRACT_ID = 'enterprise-admin-policy-framework-v1';
export const MAX_ENTERPRISE_ADMIN_POLICY_BYTES = 128 * 1024;
export const MAX_ENTERPRISE_ADMIN_POLICY_ARRAY_ITEMS = 128;
export const MAX_ENTERPRISE_ADMIN_POLICY_STRING_CHARS = 512;
export const MAX_ENTERPRISE_ADMIN_POLICY_URL_CHARS = 2048;

export const ENTERPRISE_ADMIN_POLICY_MANAGED_PATHS = {
  windows: '%ProgramData%\\TAHAI\\Web Services Browser\\managed-policy.json',
  linux: '/etc/opt/tahai-browser/managed-policy.json',
  macos: '/Library/Application Support/TAHAI Web Services Browser/managed-policy.json',
  environmentOverride: 'TAHAI_BROWSER_MANAGED_POLICY_FILE'
} as const;

export const ENTERPRISE_ADMIN_POLICY_TOOL_IDS = [
  'dns-lookup',
  'tls-summary',
  'headers-check',
  'redirect-check',
  'json-yaml-viewer',
  'jwt-decoder',
  'cidr-calculator',
  'curl-builder',
  'endpoint-smoke-check',
  'checksum-verifier',
  'mission-export',
  'evidence-export',
  'support-bundle',
  'devtools'
] as const;

export type EnterpriseAdminPolicyToolId = typeof ENTERPRISE_ADMIN_POLICY_TOOL_IDS[number];
export type EnterprisePolicySourceKind = 'none' | 'environment-file' | 'windows-programdata' | 'linux-etc' | 'macos-library' | 'app-bundled-default';
export type EnterprisePolicyExportMode = 'allowed' | 'sanitized-only' | 'disabled';
export type EnterprisePolicyUpdateChannel = 'manual-release' | 'locked-manual-release' | 'disabled';

export type EnterpriseAdminLockedSettings = {
  homeUrl?: string;
  startup?: 'home' | 'launchpad';
  searchProvider?: 'google' | 'duckduckgo' | 'bing';
  permissions?: {
    allowClipboardRead?: boolean;
    allowMedia?: boolean;
    allowGeolocation?: boolean;
    allowNotifications?: boolean;
  };
  downloads?: {
    askEveryTime?: boolean;
    defaultDirectory?: string;
  };
  ui?: {
    showStatusBar?: boolean;
    openExternalLinksInNewTab?: boolean;
  };
  privacy?: {
    sendDoNotTrack?: boolean;
    blockThirdPartyCookies?: boolean;
    reduceCrossSiteReferrers?: boolean;
    clearProfileDataOnExit?: boolean;
  };
};

export type EnterpriseAdminPolicyInput = {
  schemaVersion?: unknown;
  policyId?: unknown;
  policyName?: unknown;
  managedBy?: unknown;
  lockedSettings?: unknown;
  disabledTools?: unknown;
  allowedProtocols?: unknown;
  blockedProtocols?: unknown;
  allowedDomains?: unknown;
  blockedDomains?: unknown;
  downloads?: unknown;
  missionExport?: unknown;
  evidenceExport?: unknown;
  supportBundle?: unknown;
  update?: unknown;
};

export type EnterpriseAdminPolicy = {
  schemaVersion: 1;
  policyId: string;
  policyName: string;
  managedBy: string;
  lockedSettings: EnterpriseAdminLockedSettings;
  disabledTools: EnterpriseAdminPolicyToolId[];
  allowedProtocols: string[];
  blockedProtocols: string[];
  allowedDomains: string[];
  blockedDomains: string[];
  downloads: {
    askEveryTimeLocked?: boolean;
    allowedDirectories: string[];
    blockExternalHttpDownloads: boolean;
  };
  missionExport: {
    mode: EnterprisePolicyExportMode;
    requireRedactionPreview: boolean;
  };
  evidenceExport: {
    mode: EnterprisePolicyExportMode;
    requireRedactionPreview: boolean;
  };
  supportBundle: {
    mode: EnterprisePolicyExportMode;
    includePolicyTruth: boolean;
  };
  update: {
    channel: EnterprisePolicyUpdateChannel;
    allowSilentAutoUpdate: false;
  };
};

export type EnterpriseAdminPolicyState = {
  pass: typeof ENTERPRISE_ADMIN_POLICY_PASS;
  contractId: typeof ENTERPRISE_ADMIN_POLICY_CONTRACT_ID;
  schemaVersion: 1;
  managed: boolean;
  sourceKind: EnterprisePolicySourceKind;
  sourceLabel: string;
  loadedAt: string;
  errors: string[];
  warnings: string[];
  policy: EnterpriseAdminPolicy;
};

const CONTROL_AND_BIDI = /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g;
const DOMAIN_LABEL = /^(\*\.)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const PROTOCOL_TOKEN = /^[a-z][a-z0-9+.-]*:$/i;
const SAFE_POLICY_ID = /^[a-z0-9][a-z0-9._:-]{0,96}$/i;
const SECRETISH_POLICY_TEXT = /(?:bearer\s+|authorization\s*:|cookie\s*:|set-cookie\s*:|refresh[_-]?token|access[_-]?token|client[_-]?secret|api[_-]?key|BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY)/i;

export function defaultEnterpriseAdminPolicy(): EnterpriseAdminPolicy {
  return {
    schemaVersion: ENTERPRISE_ADMIN_POLICY_SCHEMA_VERSION,
    policyId: 'local-default',
    policyName: 'Local default policy',
    managedBy: 'local-user',
    lockedSettings: {},
    disabledTools: [],
    allowedProtocols: ['https:', 'http:'],
    blockedProtocols: ['javascript:', 'data:', 'vbscript:', 'file:'],
    allowedDomains: [],
    blockedDomains: [],
    downloads: {
      allowedDirectories: [],
      blockExternalHttpDownloads: true
    },
    missionExport: {
      mode: 'allowed',
      requireRedactionPreview: true
    },
    evidenceExport: {
      mode: 'sanitized-only',
      requireRedactionPreview: true
    },
    supportBundle: {
      mode: 'sanitized-only',
      includePolicyTruth: true
    },
    update: {
      channel: 'manual-release',
      allowSilentAutoUpdate: false
    }
  };
}

function plainRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function cleanString(value: unknown, maxChars = MAX_ENTERPRISE_ADMIN_POLICY_STRING_CHARS): string {
  return String(value ?? '').replace(CONTROL_AND_BIDI, '').trim().slice(0, maxChars);
}

function cleanPolicyId(value: unknown, fallback: string): string {
  const cleaned = cleanString(value, 98).toLowerCase();
  return SAFE_POLICY_ID.test(cleaned) && !SECRETISH_POLICY_TEXT.test(cleaned) ? cleaned : fallback;
}

function cleanBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function cleanOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function cleanEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? value as T : fallback;
}

function cleanStringArray(value: unknown, validate: (item: string) => boolean, lower = true): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value.slice(0, MAX_ENTERPRISE_ADMIN_POLICY_ARRAY_ITEMS)) {
    const cleanedRaw = cleanString(item, MAX_ENTERPRISE_ADMIN_POLICY_STRING_CHARS);
    if (!cleanedRaw || SECRETISH_POLICY_TEXT.test(cleanedRaw)) continue;
    const cleaned = lower ? cleanedRaw.toLowerCase() : cleanedRaw;
    if (!validate(cleaned) || seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned);
  }
  return out;
}

function cleanProtocolArray(value: unknown): string[] {
  return cleanStringArray(value, (item) => PROTOCOL_TOKEN.test(item));
}

function cleanDomainArray(value: unknown): string[] {
  return cleanStringArray(value, (item) => DOMAIN_LABEL.test(item));
}

function cleanDirectoryArray(value: unknown): string[] {
  return cleanStringArray(value, (item) => item.length <= MAX_ENTERPRISE_ADMIN_POLICY_STRING_CHARS && !/[<>"|?*]/.test(item), false);
}

function cleanToolIds(value: unknown): EnterpriseAdminPolicyToolId[] {
  const allowed = new Set<string>(ENTERPRISE_ADMIN_POLICY_TOOL_IDS);
  return cleanStringArray(value, (item) => allowed.has(item)) as EnterpriseAdminPolicyToolId[];
}

function cleanOptionalHomeUrl(value: unknown): string | undefined {
  const raw = cleanString(value, MAX_ENTERPRISE_ADMIN_POLICY_URL_CHARS);
  if (!raw) return undefined;
  const decision = evaluateBrowserNavigationUrl(raw, []);
  if (!decision.ok || !decision.url) return undefined;
  try {
    const parsed = new URL(decision.url);
    return parsed.protocol === 'https:' || (parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname.toLowerCase())) ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

function cleanLockedSettings(value: unknown): EnterpriseAdminLockedSettings {
  const raw = plainRecord(value);
  const permissions = plainRecord(raw.permissions);
  const downloads = plainRecord(raw.downloads);
  const ui = plainRecord(raw.ui);
  const privacy = plainRecord(raw.privacy);
  const locked: EnterpriseAdminLockedSettings = {};
  const homeUrl = cleanOptionalHomeUrl(raw.homeUrl);
  if (homeUrl) locked.homeUrl = homeUrl;
  if (raw.startup === 'home' || raw.startup === 'launchpad') locked.startup = raw.startup;
  if (raw.searchProvider === 'google' || raw.searchProvider === 'duckduckgo' || raw.searchProvider === 'bing') locked.searchProvider = raw.searchProvider;
  const cleanPermissions: NonNullable<EnterpriseAdminLockedSettings['permissions']> = {};
  for (const key of ['allowClipboardRead', 'allowMedia', 'allowGeolocation', 'allowNotifications'] as const) {
    const next = cleanOptionalBoolean(permissions[key]);
    if (typeof next === 'boolean') cleanPermissions[key] = next;
  }
  if (Object.keys(cleanPermissions).length) locked.permissions = cleanPermissions;
  const cleanDownloads: NonNullable<EnterpriseAdminLockedSettings['downloads']> = {};
  const askEveryTime = cleanOptionalBoolean(downloads.askEveryTime);
  if (typeof askEveryTime === 'boolean') cleanDownloads.askEveryTime = askEveryTime;
  const defaultDirectory = cleanString(downloads.defaultDirectory, MAX_ENTERPRISE_ADMIN_POLICY_STRING_CHARS);
  if (defaultDirectory && !SECRETISH_POLICY_TEXT.test(defaultDirectory)) cleanDownloads.defaultDirectory = defaultDirectory;
  if (Object.keys(cleanDownloads).length) locked.downloads = cleanDownloads;
  const cleanUi: NonNullable<EnterpriseAdminLockedSettings['ui']> = {};
  for (const key of ['showStatusBar', 'openExternalLinksInNewTab'] as const) {
    const next = cleanOptionalBoolean(ui[key]);
    if (typeof next === 'boolean') cleanUi[key] = next;
  }
  if (Object.keys(cleanUi).length) locked.ui = cleanUi;
  const cleanPrivacy: NonNullable<EnterpriseAdminLockedSettings['privacy']> = {};
  for (const key of ['sendDoNotTrack', 'blockThirdPartyCookies', 'reduceCrossSiteReferrers', 'clearProfileDataOnExit'] as const) {
    const next = cleanOptionalBoolean(privacy[key]);
    if (typeof next === 'boolean') cleanPrivacy[key] = next;
  }
  if (Object.keys(cleanPrivacy).length) locked.privacy = cleanPrivacy;
  return locked;
}

function cleanExportPolicy(value: unknown, fallback: EnterprisePolicyExportMode): { mode: EnterprisePolicyExportMode; requireRedactionPreview: boolean } {
  const raw = plainRecord(value);
  return {
    mode: cleanEnum(raw.mode, ['allowed', 'sanitized-only', 'disabled'] as const, fallback),
    requireRedactionPreview: cleanBoolean(raw.requireRedactionPreview, true)
  };
}

export function sanitizeEnterpriseAdminPolicy(value: unknown): EnterpriseAdminPolicy {
  const defaults = defaultEnterpriseAdminPolicy();
  const raw = plainRecord(value) as EnterpriseAdminPolicyInput;
  const downloads = plainRecord(raw.downloads);
  const supportBundleRaw = plainRecord(raw.supportBundle);
  const update = plainRecord(raw.update);
  return {
    schemaVersion: ENTERPRISE_ADMIN_POLICY_SCHEMA_VERSION,
    policyId: cleanPolicyId(raw.policyId, defaults.policyId),
    policyName: cleanString(raw.policyName, 120) || defaults.policyName,
    managedBy: cleanString(raw.managedBy, 120) || defaults.managedBy,
    lockedSettings: cleanLockedSettings(raw.lockedSettings),
    disabledTools: cleanToolIds(raw.disabledTools),
    allowedProtocols: cleanProtocolArray(raw.allowedProtocols).length ? cleanProtocolArray(raw.allowedProtocols) : defaults.allowedProtocols,
    blockedProtocols: Array.from(new Set([...defaults.blockedProtocols, ...cleanProtocolArray(raw.blockedProtocols)])),
    allowedDomains: cleanDomainArray(raw.allowedDomains),
    blockedDomains: cleanDomainArray(raw.blockedDomains),
    downloads: {
      askEveryTimeLocked: cleanOptionalBoolean(downloads.askEveryTimeLocked),
      allowedDirectories: cleanDirectoryArray(downloads.allowedDirectories),
      blockExternalHttpDownloads: cleanBoolean(downloads.blockExternalHttpDownloads, defaults.downloads.blockExternalHttpDownloads)
    },
    missionExport: cleanExportPolicy(raw.missionExport, defaults.missionExport.mode),
    evidenceExport: cleanExportPolicy(raw.evidenceExport, defaults.evidenceExport.mode),
    supportBundle: {
      ...cleanExportPolicy(raw.supportBundle, defaults.supportBundle.mode),
      includePolicyTruth: cleanBoolean(supportBundleRaw.includePolicyTruth, defaults.supportBundle.includePolicyTruth)
    },
    update: {
      channel: cleanEnum(update.channel, ['manual-release', 'locked-manual-release', 'disabled'] as const, defaults.update.channel),
      allowSilentAutoUpdate: false
    }
  };
}

export function applyEnterpriseAdminPolicyToSettings<T extends { [key: string]: unknown }>(settings: T, policy: EnterpriseAdminPolicy): T {
  const locked = policy.lockedSettings;
  const merged: Record<string, unknown> = { ...settings };
  for (const key of ['homeUrl', 'startup', 'searchProvider'] as const) {
    if (locked[key] !== undefined) merged[key] = locked[key];
  }
  for (const section of ['permissions', 'downloads', 'ui', 'privacy'] as const) {
    if (locked[section]) merged[section] = { ...(plainRecord(merged[section])), ...locked[section] };
  }
  if (typeof policy.downloads.askEveryTimeLocked === 'boolean') {
    merged.downloads = { ...(plainRecord(merged.downloads)), askEveryTime: policy.downloads.askEveryTimeLocked };
  }
  return merged as T;
}

export function enterpriseAdminPolicyForRenderer(state: EnterpriseAdminPolicyState): EnterpriseAdminPolicyState {
  return {
    ...state,
    sourceLabel: state.managed ? state.sourceLabel : 'local-default',
    errors: state.errors.map((error) => cleanString(error, 240)),
    warnings: state.warnings.map((warning) => cleanString(warning, 240)),
    policy: sanitizeEnterpriseAdminPolicy(state.policy)
  };
}

export function shouldRejectEnterpriseAdminPolicyFile(sizeBytes: number): boolean {
  return !Number.isFinite(sizeBytes) || sizeBytes < 0 || sizeBytes > MAX_ENTERPRISE_ADMIN_POLICY_BYTES;
}

export function enterpriseAdminPolicySummary(state: EnterpriseAdminPolicyState): string {
  const policy = state.policy;
  return `${ENTERPRISE_ADMIN_POLICY_PASS} ${ENTERPRISE_ADMIN_POLICY_CONTRACT_ID}: managed=${state.managed}; source=${state.sourceKind}; lockedSettings=${Object.keys(policy.lockedSettings).length}; disabledTools=${policy.disabledTools.length}; missionExport=${policy.missionExport.mode}; evidenceExport=${policy.evidenceExport.mode}; update=${policy.update.channel}; silentAutoUpdate=${policy.update.allowSilentAutoUpdate ? 'true' : 'false'}`;
}
