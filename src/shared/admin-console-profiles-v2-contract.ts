import type { MissionLayoutType, MissionTabRole } from './mission-types';
import {
  ADMIN_CONSOLE_PROFILES,
  ADMIN_CONSOLE_PROFILE_MAX_URLS,
  type AdminConsoleLaunchRecipe,
  type AdminConsoleProfile,
  type AdminConsoleProfileId,
  adminConsoleProfileToLaunchRecipe
} from './admin-console-profiles-contract';

export const PASS199_ADMIN_CONSOLE_PROFILES_V2_PASS = 'PASS199';
export const ADMIN_CONSOLE_PROFILES_V2_CONTRACT_ID = 'admin-console-profiles-v2';
export const ADMIN_CONSOLE_PROFILES_V2_SCHEMA_VERSION = 2;
export const ADMIN_CONSOLE_PROFILES_V2_REQUIRED_COUNT = 10;

export type AdminConsoleProfileV2PaneId = 'pane-1' | 'pane-2' | 'pane-3' | 'pane-4';
export type AdminConsoleProfileV2LaunchSurface = 'ops-panel' | 'mission-control' | 'command-center';
export type AdminConsoleProfileV2ProviderIntentKind =
  | 'identity-tenant-admin'
  | 'cloud-operations'
  | 'devops-release'
  | 'dns-network-change'
  | 'vendor-admin-portal'
  | 'documentation-evidence'
  | 'ticket-reference-only';

export type AdminConsoleProfileV2PaneDefault = {
  paneId: AdminConsoleProfileV2PaneId;
  role: MissionTabRole;
  intent: string;
  required: boolean;
};

export type AdminConsoleProfileV2Guardrails = {
  localOnly: true;
  browserSideOnly: true;
  httpsOnly: true;
  noCredentialStorage: true;
  noTokenFields: true;
  noCookieCapture: true;
  directPsaApiAllowed: false;
  directProviderApiAllowed: false;
  requiresExplicitOperatorLaunch: true;
  serverConnectorRequired: boolean;
};

export type AdminConsoleProfileV2Diagnostics = {
  diagnosticId: string;
  launchSurface: 'enterprise-admin-console-profile';
  safeUrlCount: number;
  policyTagCount: number;
  missionLayoutDefault: MissionLayoutType;
  providerIntentKind: AdminConsoleProfileV2ProviderIntentKind;
  localOnlyGuardrailCount: number;
  disabledReason: string;
};

export type AdminConsoleProfileV2 = Omit<AdminConsoleProfile, 'schemaVersion'> & {
  schemaVersion: typeof ADMIN_CONSOLE_PROFILES_V2_SCHEMA_VERSION;
  contractId: typeof ADMIN_CONSOLE_PROFILES_V2_CONTRACT_ID;
  providerIntentKind: AdminConsoleProfileV2ProviderIntentKind;
  providerIntent: string;
  missionLayoutDefault: MissionLayoutType;
  paneDefaults: readonly AdminConsoleProfileV2PaneDefault[];
  guardrails: AdminConsoleProfileV2Guardrails;
  diagnostics: AdminConsoleProfileV2Diagnostics;
  launchSurfaces: readonly AdminConsoleProfileV2LaunchSurface[];
  profileLauncherKind: 'enterprise-admin-console-profile';
};

export type AdminConsoleProfileV2LaunchRecipe = AdminConsoleLaunchRecipe & {
  adminConsoleProfileVersion: typeof ADMIN_CONSOLE_PROFILES_V2_SCHEMA_VERSION;
  adminConsoleProviderIntentKind: AdminConsoleProfileV2ProviderIntentKind;
  adminConsoleProviderIntent: string;
  adminConsoleMissionLayoutDefault: MissionLayoutType;
  adminConsolePaneDefaults: AdminConsoleProfileV2PaneDefault[];
  adminConsoleGuardrails: AdminConsoleProfileV2Guardrails;
  adminConsoleDiagnostics: AdminConsoleProfileV2Diagnostics;
  profileLauncherKind: 'enterprise-admin-console-profile';
};

const providerIntentById: Record<AdminConsoleProfileId, { kind: AdminConsoleProfileV2ProviderIntentKind; intent: string }> = {
  'microsoft365-entra-azure': {
    kind: 'identity-tenant-admin',
    intent: 'Launch M365, Entra, Azure, and Microsoft guidance as one tenant-administration Mission with identity and rollback context visible.'
  },
  'aws-console-operations': {
    kind: 'cloud-operations',
    intent: 'Launch AWS console, health, status, and documentation as an account-and-region-aware operational Mission.'
  },
  'google-workspace-gcp': {
    kind: 'identity-tenant-admin',
    intent: 'Launch Google Workspace, GCP, status, and admin support lanes for tenant administration without storing credentials.'
  },
  'cloudflare-operations': {
    kind: 'dns-network-change',
    intent: 'Launch Cloudflare, provider status, docs, and runbook/evidence lanes for DNS, WAF, cache, redirect, or Pages changes.'
  },
  'github-actions-release': {
    kind: 'devops-release',
    intent: 'Launch GitHub, Actions docs, status, and runbook lanes for release tracking and handoff evidence.'
  },
  'vercel-firebase-pages': {
    kind: 'devops-release',
    intent: 'Launch Vercel, Firebase, Cloudflare Pages, and provider status as a static/app release Mission.'
  },
  'firewall-vpn-vendor': {
    kind: 'vendor-admin-portal',
    intent: 'Launch firewall, VPN, and vendor support lanes with maintenance-window and rollback guardrails visible.'
  },
  'registrar-dns': {
    kind: 'dns-network-change',
    intent: 'Launch registrar, propagation, authority lookup, and DNS documentation lanes for nameserver or DNS cutovers.'
  },
  'itdocs-runbooks-evidence': {
    kind: 'documentation-evidence',
    intent: 'Launch IT Docs, TAHAI Portal, browser KB, and evidence context for local documentation and authorized handoff work.'
  },
  'psa-ticket-reference': {
    kind: 'ticket-reference-only',
    intent: 'Launch PSA/ticket context as a browser-side reference only; writeback stays disabled until IT Docs authorizes a server-side connector.'
  }
};

const paneIntentByRole: Record<MissionTabRole, string> = {
  'primary-console': 'Primary administrative console for the selected provider profile.',
  logs: 'Log, workflow, or deployment signal lane.',
  docs: 'Provider documentation, support guidance, or internal KB lane.',
  runbook: 'Operator checklist, rollback, and evidence handoff lane.',
  ticket: 'Ticket or work-order context as display/reference only.',
  monitoring: 'Provider health, status, propagation, or validation lane.',
  evidence: 'Sanitized evidence and closeout summary lane.',
  'live-target': 'Live app, staging target, or service validation lane.',
  'vendor-portal': 'Vendor portal or support surface without stored credentials.',
  tool: 'Local-first diagnostic or validation tool lane.'
};

function paneDefaults(profile: AdminConsoleProfile): readonly AdminConsoleProfileV2PaneDefault[] {
  const roles = profile.missionRoles.slice(0, ADMIN_CONSOLE_PROFILE_MAX_URLS);
  return roles.map((role, index) => ({
    paneId: `pane-${index + 1}` as AdminConsoleProfileV2PaneId,
    role,
    intent: paneIntentByRole[role] || 'Provider profile pane.',
    required: index === 0 || profile.missionLayout === 'quad'
  }));
}

function guardrails(profile: AdminConsoleProfile): AdminConsoleProfileV2Guardrails {
  return {
    localOnly: true,
    browserSideOnly: true,
    httpsOnly: true,
    noCredentialStorage: true,
    noTokenFields: true,
    noCookieCapture: true,
    directPsaApiAllowed: false,
    directProviderApiAllowed: false,
    requiresExplicitOperatorLaunch: true,
    serverConnectorRequired: profile.requiresServerConnector
  };
}

function diagnostics(profile: AdminConsoleProfile, providerIntentKind: AdminConsoleProfileV2ProviderIntentKind): AdminConsoleProfileV2Diagnostics {
  const safeUrlCount = profile.launchUrls.filter((url) => url.startsWith('https://')).length;
  const localOnlyGuardrailCount = Object.values(guardrails(profile)).filter(Boolean).length;
  return {
    diagnosticId: `admin-profile-v2-${profile.id}`,
    launchSurface: 'enterprise-admin-console-profile',
    safeUrlCount,
    policyTagCount: profile.policyTags.length,
    missionLayoutDefault: profile.missionLayout,
    providerIntentKind,
    localOnlyGuardrailCount,
    disabledReason: profile.requiresServerConnector ? 'Requires IT Docs-authorized server-side connector before writeback; local reference launch remains guarded.' : 'Launchable as a local-only browser Mission profile.'
  };
}

function profileV2(profile: AdminConsoleProfile): AdminConsoleProfileV2 {
  const intent = providerIntentById[profile.id];
  return {
    ...profile,
    schemaVersion: ADMIN_CONSOLE_PROFILES_V2_SCHEMA_VERSION,
    contractId: ADMIN_CONSOLE_PROFILES_V2_CONTRACT_ID,
    providerIntentKind: intent.kind,
    providerIntent: intent.intent,
    missionLayoutDefault: profile.missionLayout,
    paneDefaults: paneDefaults(profile),
    guardrails: guardrails(profile),
    diagnostics: diagnostics(profile, intent.kind),
    launchSurfaces: ['ops-panel', 'mission-control', 'command-center'],
    profileLauncherKind: 'enterprise-admin-console-profile'
  };
}

export const ADMIN_CONSOLE_PROFILES_V2: readonly AdminConsoleProfileV2[] = ADMIN_CONSOLE_PROFILES.map(profileV2);

export function getAdminConsoleProfileV2(id: string | undefined): AdminConsoleProfileV2 | undefined {
  if (!id) return undefined;
  return ADMIN_CONSOLE_PROFILES_V2.find((profile) => profile.id === id);
}

export function adminConsoleProfileV2ForRecipe(recipeId: string | undefined): AdminConsoleProfileV2 | undefined {
  if (!recipeId) return undefined;
  const profileId = recipeId.startsWith('admin-profile-') ? recipeId.slice('admin-profile-'.length) : recipeId;
  return getAdminConsoleProfileV2(profileId);
}

export function adminConsoleProfileV2ToLaunchRecipe(profile: AdminConsoleProfileV2): AdminConsoleProfileV2LaunchRecipe {
  const recipe = adminConsoleProfileToLaunchRecipe({ ...profile, schemaVersion: 1 as const });
  return {
    ...recipe,
    adminConsoleProfileVersion: ADMIN_CONSOLE_PROFILES_V2_SCHEMA_VERSION,
    adminConsoleProviderIntentKind: profile.providerIntentKind,
    adminConsoleProviderIntent: profile.providerIntent,
    adminConsoleMissionLayoutDefault: profile.missionLayoutDefault,
    adminConsolePaneDefaults: [...profile.paneDefaults],
    adminConsoleGuardrails: profile.guardrails,
    adminConsoleDiagnostics: profile.diagnostics,
    profileLauncherKind: profile.profileLauncherKind
  };
}

export function adminConsoleProfilesV2Coverage(): { profileCount: number; v2Count: number; missing: AdminConsoleProfileId[] } {
  const v2 = new Set(ADMIN_CONSOLE_PROFILES_V2.map((profile) => profile.id));
  const missing = ADMIN_CONSOLE_PROFILES.map((profile) => profile.id).filter((id) => !v2.has(id));
  return { profileCount: ADMIN_CONSOLE_PROFILES.length, v2Count: ADMIN_CONSOLE_PROFILES_V2.length, missing };
}

export function adminConsoleProfilesV2DiagnosticsSummary(): string {
  const localOnly = ADMIN_CONSOLE_PROFILES_V2.filter((profile) => profile.guardrails.localOnly).length;
  const browserSideOnly = ADMIN_CONSOLE_PROFILES_V2.filter((profile) => profile.guardrails.browserSideOnly).length;
  const httpsOnly = ADMIN_CONSOLE_PROFILES_V2.filter((profile) => profile.guardrails.httpsOnly).length;
  const directPsaBlocked = ADMIN_CONSOLE_PROFILES_V2.filter((profile) => !profile.guardrails.directPsaApiAllowed).length;
  const connectorRequired = ADMIN_CONSOLE_PROFILES_V2.filter((profile) => profile.guardrails.serverConnectorRequired).length;
  return [
    `localOnly=${localOnly}`,
    `browserSideOnly=${browserSideOnly}`,
    `httpsOnly=${httpsOnly}`,
    `directPsaBlocked=${directPsaBlocked}`,
    `connectorRequired=${connectorRequired}`,
    `diagnostics=${ADMIN_CONSOLE_PROFILES_V2.length}`
  ].join('; ');
}

export function adminConsoleProfilesV2Summary(): string {
  const coverage = adminConsoleProfilesV2Coverage();
  const intentKinds = Array.from(new Set(ADMIN_CONSOLE_PROFILES_V2.map((profile) => profile.providerIntentKind))).sort();
  return [
    `${PASS199_ADMIN_CONSOLE_PROFILES_V2_PASS} ${ADMIN_CONSOLE_PROFILES_V2_CONTRACT_ID}`,
    `profiles=${coverage.profileCount}`,
    `v2=${coverage.v2Count}`,
    `required=${ADMIN_CONSOLE_PROFILES_V2_REQUIRED_COUNT}`,
    `missing=${coverage.missing.length}`,
    `intentKinds=${intentKinds.join(',')}`,
    adminConsoleProfilesV2DiagnosticsSummary(),
    'storesSecrets=false',
    'directPsaApiAllowed=false',
    'directProviderApiAllowed=false'
  ].join('; ');
}
