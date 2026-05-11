import type { MissionLayoutType, MissionTabRole, MissionType } from './mission-types';

export const ADMIN_CONSOLE_PROFILES_PASS = 'PASS155';
export const ADMIN_CONSOLE_PROFILES_CONTRACT_ID = 'admin-console-profiles-v1';
export const ADMIN_CONSOLE_PROFILES_SCHEMA_VERSION = 1;
export const ADMIN_CONSOLE_PROFILE_MAX_URLS = 4;

export type AdminConsoleProfileId =
  | 'microsoft365-entra-azure'
  | 'aws-console-operations'
  | 'google-workspace-gcp'
  | 'cloudflare-operations'
  | 'github-actions-release'
  | 'vercel-firebase-pages'
  | 'firewall-vpn-vendor'
  | 'registrar-dns'
  | 'itdocs-runbooks-evidence'
  | 'psa-ticket-reference';

export type AdminConsoleProvider =
  | 'm365'
  | 'azure'
  | 'aws'
  | 'google'
  | 'cloudflare'
  | 'github'
  | 'vercel'
  | 'firebase'
  | 'firewall-vpn'
  | 'registrar-dns'
  | 'itdocs'
  | 'psa-reference';

export type AdminConsoleProfileCategory = 'identity' | 'cloud' | 'devops' | 'network' | 'documentation' | 'ticket-reference';
export type AdminConsoleBrowserProfileKind = 'local' | 'google' | 'microsoft' | 'work' | 'client';
export type AdminConsoleEvidenceProfile = 'change-record' | 'incident-packet' | 'sanitized-handoff' | 'internal-markdown';

export type AdminConsoleProfile = {
  schemaVersion: typeof ADMIN_CONSOLE_PROFILES_SCHEMA_VERSION;
  id: AdminConsoleProfileId;
  label: string;
  shortLabel: string;
  provider: AdminConsoleProvider;
  category: AdminConsoleProfileCategory;
  browserProfileKind: AdminConsoleBrowserProfileKind;
  browserProfileName: string;
  launchUrls: readonly string[];
  missionType: MissionType;
  missionLayout: MissionLayoutType;
  missionRoles: readonly MissionTabRole[];
  primaryAction: string;
  stopCondition: string;
  runbookSteps: readonly string[];
  evidencePrompts: readonly string[];
  evidenceProfile: AdminConsoleEvidenceProfile;
  policyTags: readonly string[];
  requiresServerConnector: boolean;
  storesSecrets: false;
  directPsaApiAllowed: false;
};

export type AdminConsoleLaunchRecipe = {
  id: string;
  label: string;
  group: string;
  profileKind: AdminConsoleBrowserProfileKind;
  profileName: string;
  urls: string[];
  comingSoon?: boolean;
  note: string;
  missionType: MissionType;
  missionLayout: MissionLayoutType;
  missionRoles: MissionTabRole[];
  missionPhase: 'devops' | 'it' | 'general';
  missionPrimaryAction: string;
  missionStopCondition: string;
  missionRunbookSteps: string[];
  missionEvidencePrompts: string[];
  cockpitProvider: 'aws' | 'azure' | 'm365' | 'cloudflare' | 'github' | 'vercel' | 'firebase' | 'incident' | 'generic';
  operatorShortcut?: string;
  adminConsoleProfileId: AdminConsoleProfileId;
  evidenceProfile: AdminConsoleEvidenceProfile;
  policyTags: string[];
};

function profile(
  input: Omit<AdminConsoleProfile, 'schemaVersion' | 'storesSecrets' | 'directPsaApiAllowed'>
): AdminConsoleProfile {
  return {
    schemaVersion: ADMIN_CONSOLE_PROFILES_SCHEMA_VERSION,
    storesSecrets: false,
    directPsaApiAllowed: false,
    ...input
  };
}

export const ADMIN_CONSOLE_PROFILES: readonly AdminConsoleProfile[] = [
  profile({
    id: 'microsoft365-entra-azure',
    label: 'Microsoft 365 / Entra / Azure Admin',
    shortLabel: 'M365 / Entra / Azure',
    provider: 'm365',
    category: 'identity',
    browserProfileKind: 'microsoft',
    browserProfileName: 'M365 Entra Azure Admin',
    launchUrls: ['https://admin.microsoft.com', 'https://entra.microsoft.com', 'https://portal.azure.com', 'https://learn.microsoft.com/microsoft-365/'],
    missionType: 'admin',
    missionLayout: 'quad',
    missionRoles: ['primary-console', 'vendor-portal', 'monitoring', 'docs'],
    primaryAction: 'Run Microsoft tenant administration with admin center, Entra, Azure, and Microsoft Learn in one governed Mission workspace.',
    stopCondition: 'Stop if tenant identity, admin authorization, conditional-access blast radius, affected users/groups, or rollback owner is unclear.',
    runbookSteps: ['Confirm tenant and authorized admin role', 'Capture starting settings and affected users/groups', 'Apply one bounded M365, Entra, or Azure change', 'Validate sign-in, mail, policy, or service behavior', 'Export change record with redaction preview'],
    evidencePrompts: ['Tenant display name only', 'Affected users/groups', 'Before/after admin setting', 'Validation result'],
    evidenceProfile: 'change-record',
    policyTags: ['identity-admin', 'm365', 'entra', 'azure', 'conditional-access'],
    requiresServerConnector: false
  }),
  profile({
    id: 'aws-console-operations',
    label: 'AWS Console Operations',
    shortLabel: 'AWS Operations',
    provider: 'aws',
    category: 'cloud',
    browserProfileKind: 'work',
    browserProfileName: 'AWS Operations',
    launchUrls: ['https://console.aws.amazon.com', 'https://health.aws.amazon.com/health/status', 'https://status.aws.amazon.com', 'https://docs.aws.amazon.com'],
    missionType: 'deployment',
    missionLayout: 'quad',
    missionRoles: ['primary-console', 'monitoring', 'monitoring', 'docs'],
    primaryAction: 'Perform AWS operational changes with console, AWS Health, public status, and docs together.',
    stopCondition: 'Stop if account, region, IAM scope, backup/export state, or rollback path is unclear.',
    runbookSteps: ['Confirm AWS account and region display only', 'Capture current resource state', 'Apply the bounded change', 'Validate service health, endpoint, and logs', 'Record rollback path and evidence'],
    evidencePrompts: ['Account/region display only', 'Resource touched', 'Health/log validation', 'Rollback path'],
    evidenceProfile: 'change-record',
    policyTags: ['cloud-admin', 'aws', 'iam-scope', 'region-aware'],
    requiresServerConnector: false
  }),
  profile({
    id: 'google-workspace-gcp',
    label: 'Google Workspace / GCP Admin',
    shortLabel: 'Google Admin / GCP',
    provider: 'google',
    category: 'identity',
    browserProfileKind: 'google',
    browserProfileName: 'Google Workspace GCP',
    launchUrls: ['https://admin.google.com', 'https://console.cloud.google.com', 'https://status.cloud.google.com', 'https://support.google.com/a/'],
    missionType: 'admin',
    missionLayout: 'quad',
    missionRoles: ['primary-console', 'vendor-portal', 'monitoring', 'docs'],
    primaryAction: 'Manage Google Workspace and GCP with admin console, cloud console, service status, and docs in a single Mission.',
    stopCondition: 'Stop if tenant, admin role, affected account/service, or rollback route is unclear.',
    runbookSteps: ['Confirm Google tenant and admin scope', 'Capture before configuration', 'Apply one bounded admin or cloud change', 'Validate affected account/service behavior', 'Export sanitized closeout'],
    evidencePrompts: ['Tenant display name only', 'Account/service', 'Before/after setting', 'Validation result'],
    evidenceProfile: 'change-record',
    policyTags: ['google-admin', 'workspace', 'gcp', 'identity-admin'],
    requiresServerConnector: false
  }),
  profile({
    id: 'cloudflare-operations',
    label: 'Cloudflare DNS / WAF / Pages Operations',
    shortLabel: 'Cloudflare Ops',
    provider: 'cloudflare',
    category: 'network',
    browserProfileKind: 'work',
    browserProfileName: 'Cloudflare Operations',
    launchUrls: ['https://dash.cloudflare.com', 'https://www.cloudflarestatus.com', 'https://developers.cloudflare.com', 'https://docs.tahaiportal.com'],
    missionType: 'migration',
    missionLayout: 'quad',
    missionRoles: ['primary-console', 'monitoring', 'docs', 'runbook'],
    primaryAction: 'Run DNS, WAF, cache, redirect, or Pages changes with provider status, docs, and runbook/evidence lanes.',
    stopCondition: 'Stop if zone ownership, TTL, WAF impact, certificate impact, cache behavior, or rollback records are unclear.',
    runbookSteps: ['Capture current zone/app state', 'Confirm change class and rollback record', 'Apply one bounded Cloudflare change', 'Validate DNS, HTTP, TLS, headers, or Pages state', 'Pin before/after evidence'],
    evidencePrompts: ['Zone/app display', 'Before setting', 'After setting', 'DNS/TLS/header validation'],
    evidenceProfile: 'change-record',
    policyTags: ['dns', 'waf', 'cloudflare', 'pages', 'network-change'],
    requiresServerConnector: false
  }),
  profile({
    id: 'github-actions-release',
    label: 'GitHub / GitHub Actions Release',
    shortLabel: 'GitHub Actions',
    provider: 'github',
    category: 'devops',
    browserProfileKind: 'work',
    browserProfileName: 'GitHub Actions Release',
    launchUrls: ['https://github.com', 'https://githubstatus.com', 'https://docs.github.com/actions', 'https://docs.tahaiportal.com'],
    missionType: 'deployment',
    missionLayout: 'quad',
    missionRoles: ['logs', 'monitoring', 'docs', 'runbook'],
    primaryAction: 'Track repository, workflow, status, and release evidence without losing the runbook lane.',
    stopCondition: 'Stop if branch, environment approval, artifact retention, deployment target, or rollback status is unclear.',
    runbookSteps: ['Open target repository and workflow', 'Confirm branch, commit, and environment', 'Watch logs and failed steps', 'Capture artifact/deployment references', 'Document rerun, fix, rollback, or closeout'],
    evidencePrompts: ['Repository', 'Workflow run', 'Commit SHA', 'Failed step or final success'],
    evidenceProfile: 'change-record',
    policyTags: ['github', 'actions', 'release', 'ci-cd'],
    requiresServerConnector: false
  }),
  profile({
    id: 'vercel-firebase-pages',
    label: 'Vercel / Firebase / Cloudflare Pages Release',
    shortLabel: 'Static/App Release',
    provider: 'vercel',
    category: 'devops',
    browserProfileKind: 'work',
    browserProfileName: 'Vercel Firebase Pages',
    launchUrls: ['https://vercel.com/dashboard', 'https://console.firebase.google.com', 'https://dash.cloudflare.com', 'https://www.vercel-status.com'],
    missionType: 'deployment',
    missionLayout: 'quad',
    missionRoles: ['primary-console', 'vendor-portal', 'vendor-portal', 'monitoring'],
    primaryAction: 'Deploy or validate static/app releases across Vercel, Firebase, or Cloudflare Pages with status visible.',
    stopCondition: 'Stop if project, environment variables, production target, or rollback route is unclear.',
    runbookSteps: ['Confirm target project and environment', 'Capture current deployment/version', 'Deploy or promote build', 'Validate production URL and provider status', 'Export release evidence'],
    evidencePrompts: ['Project', 'Deployment/version', 'Production URL', 'Validation result'],
    evidenceProfile: 'change-record',
    policyTags: ['vercel', 'firebase', 'cloudflare-pages', 'release'],
    requiresServerConnector: false
  }),
  profile({
    id: 'firewall-vpn-vendor',
    label: 'Firewall / VPN / Vendor Portal Operations',
    shortLabel: 'Firewall / VPN Vendor',
    provider: 'firewall-vpn',
    category: 'network',
    browserProfileKind: 'client',
    browserProfileName: 'Firewall VPN Vendor',
    launchUrls: ['https://docs.tahaiportal.com', 'https://www.cisco.com/c/en/us/support/index.html', 'https://support.fortinet.com', 'https://support.paloaltonetworks.com'],
    missionType: 'admin',
    missionLayout: 'quad',
    missionRoles: ['runbook', 'vendor-portal', 'vendor-portal', 'vendor-portal'],
    primaryAction: 'Stage a vendor-safe network-admin workspace without embedding credentials or vendor secrets in source or mission files.',
    stopCondition: 'Stop if maintenance window, affected site, rollback config/export, or authorized change owner is unclear.',
    runbookSteps: ['Confirm maintenance window and authorized owner', 'Capture current config/export reference outside TAHAI source', 'Open vendor support/documentation portal', 'Apply bounded change only after rollback path is clear', 'Record validation and handoff'],
    evidencePrompts: ['Site/device display only', 'Config/export reference', 'Validation result', 'Rollback owner'],
    evidenceProfile: 'sanitized-handoff',
    policyTags: ['firewall', 'vpn', 'vendor-portal', 'network-admin'],
    requiresServerConnector: false
  }),
  profile({
    id: 'registrar-dns',
    label: 'Registrar / DNS Cutover',
    shortLabel: 'Registrar / DNS',
    provider: 'registrar-dns',
    category: 'network',
    browserProfileKind: 'work',
    browserProfileName: 'Registrar DNS',
    launchUrls: ['https://docs.tahaiportal.com', 'https://www.whatsmydns.net', 'https://www.iana.org/whois', 'https://developers.cloudflare.com/dns/'],
    missionType: 'migration',
    missionLayout: 'quad',
    missionRoles: ['runbook', 'monitoring', 'docs', 'docs'],
    primaryAction: 'Prepare registrar and DNS cutovers with propagation, authority lookup, docs, and handoff lane.',
    stopCondition: 'Stop if registrar access, authoritative nameservers, TTL plan, or rollback records are unclear.',
    runbookSteps: ['Capture existing registrar and nameserver state', 'Confirm TTL and rollback record plan', 'Apply registrar/DNS change', 'Validate propagation and authority', 'Export before/after change record'],
    evidencePrompts: ['Registrar display', 'Nameserver state', 'Propagation result', 'Rollback records'],
    evidenceProfile: 'change-record',
    policyTags: ['registrar', 'dns', 'cutover', 'nameserver'],
    requiresServerConnector: false
  }),
  profile({
    id: 'itdocs-runbooks-evidence',
    label: 'IT Docs / Runbooks / Evidence',
    shortLabel: 'IT Docs Evidence',
    provider: 'itdocs',
    category: 'documentation',
    browserProfileKind: 'work',
    browserProfileName: 'IT Docs Runbooks Evidence',
    launchUrls: ['https://docs.tahaiportal.com', 'https://tahaiportal.com', 'https://browser.tahai.net', 'https://docs.tahaiportal.com/kb/index.html'],
    missionType: 'documentation',
    missionLayout: 'quad',
    missionRoles: ['runbook', 'live-target', 'docs', 'evidence'],
    primaryAction: 'Open documentation, runbook, product context, and evidence lanes for operational handoff work.',
    stopCondition: 'Stop if org/project authorization, document target, or sensitive evidence treatment is unclear.',
    runbookSteps: ['Open IT Docs and authorized org/project', 'Collect source references', 'Draft or update operational note', 'Run redaction preview', 'Export or sync authorized evidence only'],
    evidencePrompts: ['Org/project display', 'Document target', 'Evidence note', 'Redaction state'],
    evidenceProfile: 'internal-markdown',
    policyTags: ['itdocs', 'runbook', 'evidence', 'documentation'],
    requiresServerConnector: false
  }),
  profile({
    id: 'psa-ticket-reference',
    label: 'PSA / Ticket Reference Lane',
    shortLabel: 'PSA Reference',
    provider: 'psa-reference',
    category: 'ticket-reference',
    browserProfileKind: 'client',
    browserProfileName: 'PSA Ticket Reference',
    launchUrls: ['https://docs.tahaiportal.com', 'https://tahaiportal.com'],
    missionType: 'support',
    missionLayout: 'split-horizontal',
    missionRoles: ['runbook', 'ticket'],
    primaryAction: 'Keep PSA/ticket context as a browser-side reference only until IT Docs authorizes server-side connector writeback.',
    stopCondition: 'No direct PSA API calls, no PSA tokens, no auto-writeback, and no browser-stored vendor credentials.',
    runbookSteps: ['Open local support context', 'Draft PSA-safe summary', 'Run redaction preview', 'Wait for IT Docs-authorized connector capability', 'Export sanitized handoff'],
    evidencePrompts: ['Ticket display key', 'Summary', 'Redaction state', 'Writeback capability'],
    evidenceProfile: 'sanitized-handoff',
    policyTags: ['psa-reference', 'ticket', 'server-side-connector-only'],
    requiresServerConnector: true
  })
] as const;

export function adminConsoleProfileIds(): AdminConsoleProfileId[] {
  return ADMIN_CONSOLE_PROFILES.map((profile) => profile.id);
}

export function getAdminConsoleProfile(id: string): AdminConsoleProfile | undefined {
  return ADMIN_CONSOLE_PROFILES.find((profile) => profile.id === id);
}

export function adminConsoleProviderToCockpitProvider(provider: AdminConsoleProvider): AdminConsoleLaunchRecipe['cockpitProvider'] {
  if (provider === 'aws') return 'aws';
  if (provider === 'azure') return 'azure';
  if (provider === 'm365') return 'm365';
  if (provider === 'cloudflare') return 'cloudflare';
  if (provider === 'github') return 'github';
  if (provider === 'vercel') return 'vercel';
  if (provider === 'firebase') return 'firebase';
  return 'generic';
}

export function adminConsoleCategoryToMissionPhase(category: AdminConsoleProfileCategory): AdminConsoleLaunchRecipe['missionPhase'] {
  if (category === 'devops' || category === 'cloud') return 'devops';
  if (category === 'identity' || category === 'network' || category === 'ticket-reference') return 'it';
  return 'general';
}

export function adminConsoleProfileToLaunchRecipe(profile: AdminConsoleProfile): AdminConsoleLaunchRecipe {
  return {
    id: `admin-profile-${profile.id}`,
    label: profile.shortLabel,
    group: 'Admin Console Profiles',
    profileKind: profile.browserProfileKind,
    profileName: profile.browserProfileName,
    urls: profile.launchUrls.slice(0, ADMIN_CONSOLE_PROFILE_MAX_URLS),
    comingSoon: profile.requiresServerConnector,
    note: `${profile.label}: ${profile.primaryAction}`,
    missionType: profile.missionType,
    missionLayout: profile.missionLayout,
    missionRoles: [...profile.missionRoles],
    missionPhase: adminConsoleCategoryToMissionPhase(profile.category),
    missionPrimaryAction: profile.primaryAction,
    missionStopCondition: profile.stopCondition,
    missionRunbookSteps: [...profile.runbookSteps],
    missionEvidencePrompts: [...profile.evidencePrompts],
    cockpitProvider: adminConsoleProviderToCockpitProvider(profile.provider),
    adminConsoleProfileId: profile.id,
    evidenceProfile: profile.evidenceProfile,
    policyTags: [...profile.policyTags]
  };
}

export function adminConsoleProfilesSummary(): string {
  const counts = ADMIN_CONSOLE_PROFILES.reduce<Record<string, number>>((acc, profile) => {
    acc[profile.category] = (acc[profile.category] || 0) + 1;
    return acc;
  }, {});
  return [
    `${ADMIN_CONSOLE_PROFILES_PASS} ${ADMIN_CONSOLE_PROFILES_CONTRACT_ID}`,
    `profiles=${ADMIN_CONSOLE_PROFILES.length}`,
    `identity=${counts.identity || 0}`,
    `cloud=${counts.cloud || 0}`,
    `devops=${counts.devops || 0}`,
    `network=${counts.network || 0}`,
    `documentation=${counts.documentation || 0}`,
    `ticket-reference=${counts['ticket-reference'] || 0}`,
    'storesSecrets=false',
    'directPsaApiAllowed=false'
  ].join('; ');
}
