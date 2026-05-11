import type { MissionLayoutType, MissionTabRole, MissionType } from './mission-types';
import type { AdminConsoleEvidenceProfile, AdminConsoleBrowserProfileKind } from './admin-console-profiles-contract';

export const MISSION_RECIPE_LIBRARY_PASS = 'PASS156';
export const MISSION_RECIPE_LIBRARY_CONTRACT_ID = 'mission-recipe-library-v1';
export const MISSION_RECIPE_LIBRARY_SCHEMA_VERSION = 1;
export const MISSION_RECIPE_LIBRARY_REQUIRED_COUNT = 10;
export const MISSION_RECIPE_LIBRARY_MAX_URLS = 4;

export type MissionRecipeLibraryId =
  | 'library-dns-migration'
  | 'library-m365-user-offboarding'
  | 'library-firewall-change'
  | 'library-production-deployment'
  | 'library-certificate-renewal'
  | 'library-incident-triage'
  | 'library-github-actions-release'
  | 'library-cloudflare-cutover'
  | 'library-new-workstation-admin-setup'
  | 'library-vendor-support-handoff';

export type MissionRecipeLibraryCategory = 'network' | 'identity' | 'security' | 'devops' | 'incident' | 'endpoint' | 'support';
export type MissionRecipeLibraryPhase = 'devops' | 'it' | 'general';
export type MissionRecipeLibraryProvider = 'aws' | 'azure' | 'm365' | 'cloudflare' | 'github' | 'vercel' | 'firebase' | 'incident' | 'generic';

export type MissionRecipeLibraryEntry = {
  schemaVersion: typeof MISSION_RECIPE_LIBRARY_SCHEMA_VERSION;
  id: MissionRecipeLibraryId;
  label: string;
  group: 'Mission Recipe Library';
  category: MissionRecipeLibraryCategory;
  profileKind: AdminConsoleBrowserProfileKind;
  profileName: string;
  urls: readonly string[];
  note: string;
  missionType: MissionType;
  missionLayout: MissionLayoutType;
  missionRoles: readonly MissionTabRole[];
  missionPhase: MissionRecipeLibraryPhase;
  missionPrimaryAction: string;
  missionStopCondition: string;
  missionRunbookSteps: readonly string[];
  missionEvidencePrompts: readonly string[];
  cockpitProvider: MissionRecipeLibraryProvider;
  operatorShortcut?: string;
  evidenceProfile: AdminConsoleEvidenceProfile;
  policyTags: readonly string[];
  requiresServerConnector: false;
  storesSecrets: false;
  directPsaApiAllowed: false;
};

export type MissionRecipeLibraryLaunchRecipe = {
  id: string;
  label: string;
  group: string;
  profileKind: AdminConsoleBrowserProfileKind;
  profileName: string;
  urls: string[];
  note: string;
  missionType: MissionType;
  missionLayout: MissionLayoutType;
  missionRoles: MissionTabRole[];
  missionPhase: MissionRecipeLibraryPhase;
  missionPrimaryAction: string;
  missionStopCondition: string;
  missionRunbookSteps: string[];
  missionEvidencePrompts: string[];
  cockpitProvider: MissionRecipeLibraryProvider;
  operatorShortcut?: string;
  evidenceProfile: AdminConsoleEvidenceProfile;
  policyTags: string[];
  missionRecipeLibraryId: MissionRecipeLibraryId;
};

function recipe(
  input: Omit<MissionRecipeLibraryEntry, 'schemaVersion' | 'group' | 'requiresServerConnector' | 'storesSecrets' | 'directPsaApiAllowed'>
): MissionRecipeLibraryEntry {
  return {
    schemaVersion: MISSION_RECIPE_LIBRARY_SCHEMA_VERSION,
    group: 'Mission Recipe Library',
    requiresServerConnector: false,
    storesSecrets: false,
    directPsaApiAllowed: false,
    ...input
  };
}

export const MISSION_RECIPE_LIBRARY: readonly MissionRecipeLibraryEntry[] = [
  recipe({
    id: 'library-dns-migration',
    label: 'DNS Migration',
    category: 'network',
    profileKind: 'work',
    profileName: 'DNS Migration Mission',
    urls: ['https://dash.cloudflare.com', 'https://www.whatsmydns.net', 'https://www.iana.org/whois', 'https://developers.cloudflare.com/dns/'],
    note: 'Move or change DNS with provider console, propagation checks, authority lookup, and DNS docs in one governed Mission.',
    missionType: 'migration',
    missionLayout: 'quad',
    missionRoles: ['primary-console', 'monitoring', 'docs', 'docs'],
    missionPhase: 'devops',
    missionPrimaryAction: 'Perform a DNS migration with before/after state, propagation validation, and rollback record notes.',
    missionStopCondition: 'Stop if authoritative nameservers, current records, TTL plan, registrar access, or rollback records are unclear.',
    missionRunbookSteps: ['Capture current zone, registrar, nameserver, and TTL state', 'Confirm target provider, changed records, and rollback records', 'Apply one bounded DNS or nameserver change', 'Validate propagation, authoritative lookup, HTTP, and TLS behavior', 'Export before/after change record with redaction preview'],
    missionEvidencePrompts: ['Before DNS state', 'Changed records', 'Propagation result', 'HTTP/TLS validation'],
    cockpitProvider: 'cloudflare',
    operatorShortcut: 'Ctrl+Alt+Shift+D',
    evidenceProfile: 'change-record',
    policyTags: ['dns', 'migration', 'registrar', 'nameserver', 'change-record']
  }),
  recipe({
    id: 'library-m365-user-offboarding',
    label: 'Microsoft 365 User Offboarding',
    category: 'identity',
    profileKind: 'microsoft',
    profileName: 'M365 User Offboarding',
    urls: ['https://admin.microsoft.com', 'https://entra.microsoft.com', 'https://security.microsoft.com', 'https://learn.microsoft.com/microsoft-365/admin/add-users/remove-former-employee'],
    note: 'Offboard a Microsoft 365 user with admin center, Entra, security portal, and vendor guidance visible together.',
    missionType: 'admin',
    missionLayout: 'quad',
    missionRoles: ['primary-console', 'vendor-portal', 'monitoring', 'docs'],
    missionPhase: 'it',
    missionPrimaryAction: 'Disable access and preserve handoff evidence without storing credentials, tokens, or confidential HR details in mission state.',
    missionStopCondition: 'Stop if approval, identity match, mailbox/data handling, legal hold, device state, or ownership transfer is unclear.',
    missionRunbookSteps: ['Confirm approved request, user identity, and effective time', 'Capture current account, groups, mailbox, and device state at a display-safe level', 'Block sign-in and revoke sessions according to policy', 'Transfer ownership, mailbox access, MFA/device handling, and group cleanup according to policy', 'Record validation and sanitized handoff evidence'],
    missionEvidencePrompts: ['Approval/reference', 'Identity match display', 'Access blocked validation', 'Mailbox/data handoff status'],
    cockpitProvider: 'm365',
    evidenceProfile: 'sanitized-handoff',
    policyTags: ['m365', 'entra', 'offboarding', 'identity-admin', 'sanitized-handoff']
  }),
  recipe({
    id: 'library-firewall-change',
    label: 'Firewall Change',
    category: 'security',
    profileKind: 'client',
    profileName: 'Firewall Change Mission',
    urls: ['https://docs.tahaiportal.com', 'https://support.fortinet.com', 'https://support.paloaltonetworks.com', 'https://www.cisco.com/c/en/us/support/index.html'],
    note: 'Run a firewall or VPN change with runbook, vendor support, and validation lanes while keeping credentials/config exports outside source.',
    missionType: 'admin',
    missionLayout: 'quad',
    missionRoles: ['runbook', 'vendor-portal', 'vendor-portal', 'vendor-portal'],
    missionPhase: 'it',
    missionPrimaryAction: 'Execute a bounded firewall/VPN change with maintenance window, rollback path, and validation evidence.',
    missionStopCondition: 'Stop if maintenance window, affected site/users, config backup/export reference, approval owner, or rollback command path is unclear.',
    missionRunbookSteps: ['Confirm approved change, site, affected users, and maintenance window', 'Capture backup/export reference without storing secret-bearing config in the repo', 'Apply one bounded rule, NAT, VPN, routing, or policy change', 'Validate connectivity, access, logs, and monitoring from affected paths', 'Record rollback path and sanitized handoff'],
    missionEvidencePrompts: ['Change approval/reference', 'Config backup/export reference', 'Connectivity validation', 'Rollback owner/path'],
    cockpitProvider: 'generic',
    evidenceProfile: 'sanitized-handoff',
    policyTags: ['firewall', 'vpn', 'network-change', 'rollback', 'support-handoff']
  }),
  recipe({
    id: 'library-production-deployment',
    label: 'Production Deployment',
    category: 'devops',
    profileKind: 'work',
    profileName: 'Production Deployment Mission',
    urls: ['https://github.com', 'https://vercel.com/dashboard', 'https://www.vercel-status.com', 'https://docs.tahaiportal.com'],
    note: 'Ship a production deployment with source, provider, status, and runbook/evidence lanes in Quad View.',
    missionType: 'deployment',
    missionLayout: 'quad',
    missionRoles: ['logs', 'primary-console', 'monitoring', 'runbook'],
    missionPhase: 'devops',
    missionPrimaryAction: 'Deploy a production change with live build/deploy signal, smoke validation, and closeout evidence.',
    missionStopCondition: 'Stop if branch, commit, environment, approval, rollback owner, smoke target, or customer impact is unclear.',
    missionRunbookSteps: ['Confirm release scope, branch, commit, environment, and rollback decision maker', 'Capture pre-deploy baseline and expected validation targets', 'Run deployment while watching CI/CD and provider logs', 'Validate health, smoke checks, routes, and user-visible target', 'Pin evidence and export change record'],
    missionEvidencePrompts: ['Commit/release reference', 'Deployment provider result', 'Smoke-test target/result', 'Rollback decision'],
    cockpitProvider: 'vercel',
    operatorShortcut: 'Ctrl+Alt+Shift+P',
    evidenceProfile: 'change-record',
    policyTags: ['production', 'deployment', 'ci-cd', 'smoke-test', 'change-record']
  }),
  recipe({
    id: 'library-certificate-renewal',
    label: 'Certificate Renewal',
    category: 'network',
    profileKind: 'work',
    profileName: 'Certificate Renewal Mission',
    urls: ['https://dash.cloudflare.com', 'https://www.ssllabs.com/ssltest/', 'https://crt.sh', 'https://developers.cloudflare.com/ssl/'],
    note: 'Renew or validate certificates with certificate inventory, provider console, TLS test, and SSL docs together.',
    missionType: 'migration',
    missionLayout: 'quad',
    missionRoles: ['primary-console', 'monitoring', 'docs', 'docs'],
    missionPhase: 'it',
    missionPrimaryAction: 'Complete a certificate renewal or cutover with expiry, chain, SAN, and live TLS validation evidence.',
    missionStopCondition: 'Stop if hostname coverage, private key handling, certificate chain, renewal authority, or rollback path is unclear.',
    missionRunbookSteps: ['Confirm hostname/SAN coverage and renewal authority', 'Capture current certificate expiry and chain summary', 'Renew, upload, or switch certificate according to provider policy', 'Validate TLS chain, hostname match, expiry, and HTTP behavior', 'Record before/after TLS evidence and rollback path'],
    missionEvidencePrompts: ['Before certificate expiry', 'Renewed certificate/SAN summary', 'TLS validation result', 'Rollback provider/path'],
    cockpitProvider: 'cloudflare',
    evidenceProfile: 'change-record',
    policyTags: ['certificate', 'tls', 'ssl', 'renewal', 'change-record']
  }),
  recipe({
    id: 'library-incident-triage',
    label: 'Incident Triage',
    category: 'incident',
    profileKind: 'work',
    profileName: 'Incident Triage Mission',
    urls: ['https://www.cloudflarestatus.com', 'https://www.githubstatus.com', 'https://status.aws.amazon.com', 'https://docs.tahaiportal.com'],
    note: 'Triage an incident with service status, vendor status, runbook, and evidence lanes without auto-posting to external systems.',
    missionType: 'incident',
    missionLayout: 'quad',
    missionRoles: ['monitoring', 'monitoring', 'monitoring', 'runbook'],
    missionPhase: 'it',
    missionPrimaryAction: 'Establish impact, compare internal and vendor signals, assign mitigation owner, and capture a clean incident packet.',
    missionStopCondition: 'Stop if severity, customer impact, affected service, mitigation owner, or communications owner is unclear.',
    missionRunbookSteps: ['Declare symptoms, impact, severity, and start time', 'Capture internal signal and vendor/provider status', 'Assign investigation and mitigation owners', 'Validate mitigation or recovery signal', 'Export incident packet and next update time'],
    missionEvidencePrompts: ['Impact/severity', 'Provider status', 'Mitigation owner', 'Recovery validation'],
    cockpitProvider: 'incident',
    operatorShortcut: 'Ctrl+Alt+Shift+I',
    evidenceProfile: 'incident-packet',
    policyTags: ['incident', 'triage', 'status', 'mitigation', 'incident-packet']
  }),
  recipe({
    id: 'library-github-actions-release',
    label: 'GitHub Actions Release',
    category: 'devops',
    profileKind: 'work',
    profileName: 'GitHub Actions Release Mission',
    urls: ['https://github.com', 'https://www.githubstatus.com', 'https://docs.github.com/actions', 'https://docs.tahaiportal.com'],
    note: 'Run a GitHub Actions release with workflow logs, GitHub status, Actions docs, and runbook/evidence together.',
    missionType: 'deployment',
    missionLayout: 'quad',
    missionRoles: ['logs', 'monitoring', 'docs', 'runbook'],
    missionPhase: 'devops',
    missionPrimaryAction: 'Monitor workflow execution and release closeout with commit, environment, artifact, and validation evidence.',
    missionStopCondition: 'Stop if workflow permissions, environment approval, branch protection, target environment, or artifact retention is unclear.',
    missionRunbookSteps: ['Open target repository and workflow run', 'Confirm branch, commit, environment, and approval state', 'Watch logs and failed steps', 'Capture artifact, release, and deployment references', 'Document rerun, fix, rollback, or closeout'],
    missionEvidencePrompts: ['Repository/workflow', 'Commit SHA', 'Artifact/deploy reference', 'Final success/failure'],
    cockpitProvider: 'github',
    evidenceProfile: 'change-record',
    policyTags: ['github', 'actions', 'release', 'artifact', 'ci-cd']
  }),
  recipe({
    id: 'library-cloudflare-cutover',
    label: 'Cloudflare Cutover',
    category: 'network',
    profileKind: 'work',
    profileName: 'Cloudflare Cutover Mission',
    urls: ['https://dash.cloudflare.com', 'https://www.cloudflarestatus.com', 'https://developers.cloudflare.com', 'https://www.whatsmydns.net'],
    note: 'Cut over DNS, Pages, redirects, WAF, or cache with Cloudflare console, status, docs, and propagation visible.',
    missionType: 'migration',
    missionLayout: 'quad',
    missionRoles: ['primary-console', 'monitoring', 'docs', 'monitoring'],
    missionPhase: 'devops',
    missionPrimaryAction: 'Perform a Cloudflare cutover with explicit before/after state, live validation, and rollback records.',
    missionStopCondition: 'Stop if zone ownership, SSL mode, cache/WAF impact, nameserver state, or rollback record owner is unclear.',
    missionRunbookSteps: ['Capture current Cloudflare zone/app and affected route state', 'Confirm cutover class, TTL/cache/WAF impact, and rollback records', 'Apply one bounded Cloudflare cutover step', 'Validate DNS, TLS, redirects, headers, cache, and live route', 'Export change record with before/after evidence'],
    missionEvidencePrompts: ['Before zone/app state', 'Cutover step', 'Live route validation', 'Rollback records'],
    cockpitProvider: 'cloudflare',
    evidenceProfile: 'change-record',
    policyTags: ['cloudflare', 'cutover', 'dns', 'waf', 'pages']
  }),
  recipe({
    id: 'library-new-workstation-admin-setup',
    label: 'New Workstation / Admin Setup',
    category: 'endpoint',
    profileKind: 'client',
    profileName: 'Workstation Admin Setup Mission',
    urls: ['https://admin.microsoft.com', 'https://entra.microsoft.com', 'https://docs.tahaiportal.com', 'https://learn.microsoft.com/mem/intune/'],
    note: 'Set up a workstation or admin account with identity, device management, documentation, and handoff lanes.',
    missionType: 'admin',
    missionLayout: 'quad',
    missionRoles: ['primary-console', 'vendor-portal', 'runbook', 'docs'],
    missionPhase: 'it',
    missionPrimaryAction: 'Prepare device/admin access with least privilege, enrollment, baseline checks, and evidence handoff.',
    missionStopCondition: 'Stop if owner, role scope, device identity, enrollment policy, MFA state, or support handoff path is unclear.',
    missionRunbookSteps: ['Confirm user/device owner and approved admin role scope', 'Create or verify account/device identity and MFA state', 'Enroll or validate device management and baseline policy', 'Validate access to required portals/apps without storing credentials', 'Export setup handoff and remaining actions'],
    missionEvidencePrompts: ['Owner/request reference', 'Role/device baseline', 'MFA/enrollment validation', 'Handoff items'],
    cockpitProvider: 'm365',
    evidenceProfile: 'sanitized-handoff',
    policyTags: ['workstation', 'endpoint', 'intune', 'least-privilege', 'admin-setup']
  }),
  recipe({
    id: 'library-vendor-support-handoff',
    label: 'Vendor Support Handoff',
    category: 'support',
    profileKind: 'client',
    profileName: 'Vendor Support Handoff Mission',
    urls: ['https://docs.tahaiportal.com', 'https://support.microsoft.com', 'https://support.cloudflare.com', 'https://support.github.com'],
    note: 'Create a vendor-safe support packet with docs, vendor support portals, and sanitized evidence instead of raw secrets or private case data.',
    missionType: 'support',
    missionLayout: 'quad',
    missionRoles: ['runbook', 'vendor-portal', 'vendor-portal', 'vendor-portal'],
    missionPhase: 'it',
    missionPrimaryAction: 'Prepare an evidence-backed vendor handoff that explains impact, repro, environment, and safe attachments.',
    missionStopCondition: 'Stop if customer authorization, sensitive data treatment, affected environment, reproduction steps, or escalation owner is unclear.',
    missionRunbookSteps: ['Confirm authorization, affected environment, and escalation owner', 'Capture sanitized symptoms, timestamps, and reproduction steps', 'Collect vendor-safe logs/screenshots without tokens, cookies, private keys, or customer secrets', 'Draft support summary and requested outcome', 'Export sanitized handoff packet'],
    missionEvidencePrompts: ['Impact summary', 'Reproduction steps', 'Sanitized evidence references', 'Requested vendor action'],
    cockpitProvider: 'generic',
    evidenceProfile: 'sanitized-handoff',
    policyTags: ['vendor-support', 'handoff', 'sanitized-evidence', 'support', 'no-secrets']
  })
] as const;

export function missionRecipeLibraryIds(): MissionRecipeLibraryId[] {
  return MISSION_RECIPE_LIBRARY.map((entry) => entry.id);
}

export function getMissionRecipeLibraryEntry(id: string): MissionRecipeLibraryEntry | undefined {
  return MISSION_RECIPE_LIBRARY.find((entry) => entry.id === id);
}

export function missionRecipeLibraryToLaunchRecipe(entry: MissionRecipeLibraryEntry): MissionRecipeLibraryLaunchRecipe {
  return {
    id: entry.id,
    label: entry.label,
    group: entry.group,
    profileKind: entry.profileKind,
    profileName: entry.profileName,
    urls: entry.urls.slice(0, MISSION_RECIPE_LIBRARY_MAX_URLS),
    note: entry.note,
    missionType: entry.missionType,
    missionLayout: entry.missionLayout,
    missionRoles: [...entry.missionRoles],
    missionPhase: entry.missionPhase,
    missionPrimaryAction: entry.missionPrimaryAction,
    missionStopCondition: entry.missionStopCondition,
    missionRunbookSteps: [...entry.missionRunbookSteps],
    missionEvidencePrompts: [...entry.missionEvidencePrompts],
    cockpitProvider: entry.cockpitProvider,
    operatorShortcut: entry.operatorShortcut,
    evidenceProfile: entry.evidenceProfile,
    policyTags: [...entry.policyTags],
    missionRecipeLibraryId: entry.id
  };
}

export function missionRecipeLibrarySummary(): string {
  const counts = MISSION_RECIPE_LIBRARY.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.category] = (acc[entry.category] || 0) + 1;
    return acc;
  }, {});
  return [
    `${MISSION_RECIPE_LIBRARY_PASS} ${MISSION_RECIPE_LIBRARY_CONTRACT_ID}`,
    `recipes=${MISSION_RECIPE_LIBRARY.length}`,
    `required=${MISSION_RECIPE_LIBRARY_REQUIRED_COUNT}`,
    `network=${counts.network || 0}`,
    `identity=${counts.identity || 0}`,
    `security=${counts.security || 0}`,
    `devops=${counts.devops || 0}`,
    `incident=${counts.incident || 0}`,
    `endpoint=${counts.endpoint || 0}`,
    `support=${counts.support || 0}`,
    'storesSecrets=false',
    'directPsaApiAllowed=false'
  ].join('; ');
}
