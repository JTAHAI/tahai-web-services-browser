import type { AdminConsoleEvidenceProfile } from './admin-console-profiles-contract';
import type { MissionEvidenceExportProfile, MissionLayoutType, MissionTabRole } from './mission-types';
import type { MissionRecipeLibraryId } from './mission-recipes-contract';
import { MISSION_RECIPE_LIBRARY } from './mission-recipes-contract';

export const PASS198_MISSION_RECIPE_LIBRARY_V2_PASS = 'PASS198';
export const PASS198_MISSION_RECIPE_LIBRARY_V2_VERSION = 'pass198-mission-recipe-library-v2';
export const MISSION_RECIPE_LIBRARY_V2_SCHEMA_VERSION = 2;
export const MISSION_RECIPE_LIBRARY_V2_REQUIRED_COUNT = 10;

export type MissionRecipeV2RiskTier = 'standard-change' | 'sensitive-admin' | 'incident-response' | 'release-critical';
export type MissionRecipeV2GateKind = 'approval' | 'identity' | 'scope' | 'rollback' | 'validation' | 'data-safety' | 'provider-health';
export type MissionRecipeV2ArtifactProfile = AdminConsoleEvidenceProfile | MissionEvidenceExportProfile;

export type MissionRecipeV2Gate = {
  kind: MissionRecipeV2GateKind;
  label: string;
  stopIfMissing: boolean;
};

export type MissionRecipeV2PaneIntent = {
  paneId: 'pane-1' | 'pane-2' | 'pane-3' | 'pane-4';
  role: MissionTabRole;
  intent: string;
};

export type MissionRecipeV2Template = {
  schemaVersion: typeof MISSION_RECIPE_LIBRARY_V2_SCHEMA_VERSION;
  id: MissionRecipeLibraryId;
  operatorIntent: string;
  riskTier: MissionRecipeV2RiskTier;
  defaultLayout: MissionLayoutType;
  preflightGates: readonly MissionRecipeV2Gate[];
  paneIntents: readonly MissionRecipeV2PaneIntent[];
  evidenceChecklist: readonly string[];
  recoveryActions: readonly string[];
  handoffSections: readonly string[];
  exportProfiles: readonly MissionRecipeV2ArtifactProfile[];
  policyLocks: readonly string[];
  localOnly: true;
  storesSecrets: false;
  directPsaApiAllowed: false;
  requiresHumanApproval: true;
};

function template(input: Omit<MissionRecipeV2Template, 'schemaVersion' | 'localOnly' | 'storesSecrets' | 'directPsaApiAllowed' | 'requiresHumanApproval'>): MissionRecipeV2Template {
  return {
    schemaVersion: MISSION_RECIPE_LIBRARY_V2_SCHEMA_VERSION,
    localOnly: true,
    storesSecrets: false,
    directPsaApiAllowed: false,
    requiresHumanApproval: true,
    ...input
  };
}

const changeGates = (scopeLabel: string): readonly MissionRecipeV2Gate[] => [
  { kind: 'approval', label: 'Approved request or change reference identified', stopIfMissing: true },
  { kind: 'scope', label: scopeLabel, stopIfMissing: true },
  { kind: 'rollback', label: 'Rollback owner and rollback path identified before change', stopIfMissing: true },
  { kind: 'validation', label: 'Before and after validation target defined', stopIfMissing: true }
] as const;

const adminGates = (scopeLabel: string): readonly MissionRecipeV2Gate[] => [
  { kind: 'approval', label: 'Administrative approval/reference identified', stopIfMissing: true },
  { kind: 'identity', label: 'Tenant, user, device, or account identity positively matched', stopIfMissing: true },
  { kind: 'scope', label: scopeLabel, stopIfMissing: true },
  { kind: 'data-safety', label: 'Sensitive data handling and handoff limits understood', stopIfMissing: true }
] as const;

const releaseRecovery = ['Pause additional changes', 'Restore known-good version or record rollback blocker', 'Capture validation result and next owner'] as const;
const adminRecovery = ['Stop administrative action', 'Preserve local notes only', 'Escalate to authorized owner before continuing'] as const;
const incidentRecovery = ['Freeze non-essential changes', 'Assign mitigation and communications owners', 'Capture current impact and next update time'] as const;

export const MISSION_RECIPE_LIBRARY_V2: readonly MissionRecipeV2Template[] = [
  template({
    id: 'library-dns-migration',
    operatorIntent: 'Move DNS with provider console, authoritative lookup, propagation proof, and rollback state visible before cutover.',
    riskTier: 'release-critical',
    defaultLayout: 'quad',
    preflightGates: changeGates('Zone, registrar, nameserver, TTL, and affected records are known'),
    paneIntents: [
      { paneId: 'pane-1', role: 'primary-console', intent: 'DNS provider console for the bounded change' },
      { paneId: 'pane-2', role: 'monitoring', intent: 'Propagation and resolver validation' },
      { paneId: 'pane-3', role: 'docs', intent: 'Authority lookup and public registry context' },
      { paneId: 'pane-4', role: 'runbook', intent: 'Rollback records, validation notes, and evidence prompts' }
    ],
    evidenceChecklist: ['Before zone and TTL state', 'Changed record or nameserver action', 'Authoritative and public resolver validation', 'Rollback record owner/path'],
    recoveryActions: releaseRecovery,
    handoffSections: ['Scope', 'Before state', 'Change applied', 'Validation', 'Rollback'],
    exportProfiles: ['change-record', 'sanitized-handoff'],
    policyLocks: ['https-only', 'no-secret-fields', 'manual-cutover-only']
  }),
  template({
    id: 'library-m365-user-offboarding',
    operatorIntent: 'Offboard a Microsoft 365 user with identity match, access block, session revocation, and data handoff gates.',
    riskTier: 'sensitive-admin',
    defaultLayout: 'quad',
    preflightGates: adminGates('Mailbox, group, license, device, and ownership scope are identified'),
    paneIntents: [
      { paneId: 'pane-1', role: 'primary-console', intent: 'Microsoft 365 admin action surface' },
      { paneId: 'pane-2', role: 'vendor-portal', intent: 'Entra identity and session state' },
      { paneId: 'pane-3', role: 'monitoring', intent: 'Security/admin signal and audit view' },
      { paneId: 'pane-4', role: 'docs', intent: 'Vendor guidance and internal handoff checklist' }
    ],
    evidenceChecklist: ['Approved request reference', 'User identity display match', 'Access block/session validation', 'Mailbox/data handoff status'],
    recoveryActions: adminRecovery,
    handoffSections: ['Approval', 'Identity match', 'Actions completed', 'Validation', 'Remaining access/data items'],
    exportProfiles: ['sanitized-handoff', 'internal'],
    policyLocks: ['no-confidential-hr-details', 'no-credential-storage', 'manual-admin-action-only']
  }),
  template({
    id: 'library-firewall-change',
    operatorIntent: 'Execute one bounded firewall/VPN change with backup reference, affected-path validation, and rollback owner.',
    riskTier: 'sensitive-admin',
    defaultLayout: 'quad',
    preflightGates: changeGates('Affected site, users, rule/NAT/VPN object, and maintenance window are known'),
    paneIntents: [
      { paneId: 'pane-1', role: 'runbook', intent: 'Change plan, maintenance window, and rollback notes' },
      { paneId: 'pane-2', role: 'vendor-portal', intent: 'Vendor/firewall support surface' },
      { paneId: 'pane-3', role: 'monitoring', intent: 'Connectivity or log validation target' },
      { paneId: 'pane-4', role: 'docs', intent: 'Vendor documentation or internal network notes' }
    ],
    evidenceChecklist: ['Change approval/reference', 'Backup/export reference without secret config', 'Affected path validation', 'Rollback owner and path'],
    recoveryActions: adminRecovery,
    handoffSections: ['Scope', 'Backup reference', 'Change applied', 'Validation', 'Rollback'],
    exportProfiles: ['sanitized-handoff', 'change-record'],
    policyLocks: ['no-raw-config-export', 'no-secret-attachments', 'maintenance-window-required']
  }),
  template({
    id: 'library-production-deployment',
    operatorIntent: 'Ship a production change with source, deployment provider, live status, smoke target, and rollback decision in one Mission.',
    riskTier: 'release-critical',
    defaultLayout: 'quad',
    preflightGates: changeGates('Branch, commit, environment, release owner, and production smoke target are known'),
    paneIntents: [
      { paneId: 'pane-1', role: 'logs', intent: 'CI/CD or build log signal' },
      { paneId: 'pane-2', role: 'primary-console', intent: 'Deployment provider console' },
      { paneId: 'pane-3', role: 'live-target', intent: 'Production or staging smoke target' },
      { paneId: 'pane-4', role: 'runbook', intent: 'Release checklist, evidence, and rollback notes' }
    ],
    evidenceChecklist: ['Commit/release reference', 'Deployment result', 'Smoke validation target/result', 'Rollback decision'],
    recoveryActions: releaseRecovery,
    handoffSections: ['Release scope', 'Deployment signal', 'Validation', 'Customer impact', 'Rollback/closeout'],
    exportProfiles: ['change-record', 'internal'],
    policyLocks: ['manual-release-only', 'smoke-target-required', 'rollback-owner-required']
  }),
  template({
    id: 'library-certificate-renewal',
    operatorIntent: 'Renew or validate certificates with before/after expiry, chain, hostname, TLS, and rollback proof.',
    riskTier: 'release-critical',
    defaultLayout: 'quad',
    preflightGates: changeGates('Domain, certificate source, expiry, SAN coverage, and provider path are known'),
    paneIntents: [
      { paneId: 'pane-1', role: 'primary-console', intent: 'Certificate or DNS provider console' },
      { paneId: 'pane-2', role: 'tool', intent: 'TLS/certificate validation tool' },
      { paneId: 'pane-3', role: 'monitoring', intent: 'Certificate transparency or public validation' },
      { paneId: 'pane-4', role: 'docs', intent: 'Provider SSL/TLS documentation and notes' }
    ],
    evidenceChecklist: ['Before expiry and SAN summary', 'Renewal or upload action', 'TLS chain/hostname validation', 'Rollback provider/path'],
    recoveryActions: releaseRecovery,
    handoffSections: ['Certificate scope', 'Before state', 'Renewal action', 'Validation', 'Rollback'],
    exportProfiles: ['change-record', 'sanitized-handoff'],
    policyLocks: ['no-private-key-export', 'hostname-validation-required', 'manual-renewal-only']
  }),
  template({
    id: 'library-incident-triage',
    operatorIntent: 'Establish incident impact, compare provider/internal signals, assign owners, and export an incident packet.',
    riskTier: 'incident-response',
    defaultLayout: 'quad',
    preflightGates: [
      { kind: 'scope', label: 'Affected service, customer/user impact, and severity are stated', stopIfMissing: true },
      { kind: 'provider-health', label: 'Internal signal and provider/dependency status are checked', stopIfMissing: true },
      { kind: 'approval', label: 'Incident owner and communications owner are assigned', stopIfMissing: true },
      { kind: 'validation', label: 'Recovery or mitigation validation target is defined', stopIfMissing: true }
    ],
    paneIntents: [
      { paneId: 'pane-1', role: 'monitoring', intent: 'Primary service/dependency status' },
      { paneId: 'pane-2', role: 'monitoring', intent: 'Secondary provider or platform status' },
      { paneId: 'pane-3', role: 'monitoring', intent: 'Internal signal or live target' },
      { paneId: 'pane-4', role: 'runbook', intent: 'Incident timeline, owners, mitigations, and evidence' }
    ],
    evidenceChecklist: ['Impact/severity statement', 'Provider/internal status', 'Mitigation owner/action', 'Recovery validation and next update time'],
    recoveryActions: incidentRecovery,
    handoffSections: ['Impact', 'Timeline', 'Signals', 'Mitigation', 'Next update'],
    exportProfiles: ['incident-packet', 'sanitized-handoff'],
    policyLocks: ['no-auto-posting', 'owner-required', 'timestamp-required']
  }),
  template({
    id: 'library-github-actions-release',
    operatorIntent: 'Run a GitHub Actions release with workflow log truth, commit/artifact reference, and release closeout evidence.',
    riskTier: 'release-critical',
    defaultLayout: 'quad',
    preflightGates: changeGates('Repository, branch, workflow, environment approval, and artifact retention are known'),
    paneIntents: [
      { paneId: 'pane-1', role: 'logs', intent: 'GitHub Actions workflow logs' },
      { paneId: 'pane-2', role: 'monitoring', intent: 'GitHub service status' },
      { paneId: 'pane-3', role: 'docs', intent: 'Actions/release documentation' },
      { paneId: 'pane-4', role: 'runbook', intent: 'Release checklist and evidence prompts' }
    ],
    evidenceChecklist: ['Repository/workflow', 'Commit SHA or release tag', 'Artifact/deploy reference', 'Final success/failure and next action'],
    recoveryActions: releaseRecovery,
    handoffSections: ['Repository', 'Workflow result', 'Artifact/release', 'Validation', 'Closeout'],
    exportProfiles: ['change-record', 'internal'],
    policyLocks: ['manual-workflow-only', 'artifact-reference-required', 'branch-protection-check']
  }),
  template({
    id: 'library-cloudflare-cutover',
    operatorIntent: 'Cut over Cloudflare DNS, Pages, redirects, WAF, or cache with before/after state and live route proof.',
    riskTier: 'release-critical',
    defaultLayout: 'quad',
    preflightGates: changeGates('Zone, SSL mode, cache/WAF impact, nameserver state, and affected routes are known'),
    paneIntents: [
      { paneId: 'pane-1', role: 'primary-console', intent: 'Cloudflare zone/app console' },
      { paneId: 'pane-2', role: 'monitoring', intent: 'Cloudflare status and route validation' },
      { paneId: 'pane-3', role: 'docs', intent: 'Cloudflare product docs' },
      { paneId: 'pane-4', role: 'tool', intent: 'DNS/TLS/redirect/header validation' }
    ],
    evidenceChecklist: ['Before zone/app state', 'Cutover action', 'Live route/DNS/TLS/header validation', 'Rollback records'],
    recoveryActions: releaseRecovery,
    handoffSections: ['Cutover scope', 'Before state', 'Action', 'Validation', 'Rollback'],
    exportProfiles: ['change-record', 'sanitized-handoff'],
    policyLocks: ['manual-cutover-only', 'rollback-record-required', 'live-route-validation-required']
  }),
  template({
    id: 'library-new-workstation-admin-setup',
    operatorIntent: 'Prepare a workstation or admin account with owner, role scope, enrollment, MFA, and support handoff proof.',
    riskTier: 'sensitive-admin',
    defaultLayout: 'quad',
    preflightGates: adminGates('Owner, role scope, device identity, enrollment policy, and MFA state are known'),
    paneIntents: [
      { paneId: 'pane-1', role: 'primary-console', intent: 'Identity/admin console' },
      { paneId: 'pane-2', role: 'vendor-portal', intent: 'Device management/enrollment surface' },
      { paneId: 'pane-3', role: 'runbook', intent: 'Setup checklist and handoff notes' },
      { paneId: 'pane-4', role: 'docs', intent: 'Vendor setup documentation' }
    ],
    evidenceChecklist: ['Owner/request reference', 'Role/device baseline', 'MFA/enrollment validation', 'Support handoff items'],
    recoveryActions: adminRecovery,
    handoffSections: ['Request', 'Identity/device', 'Enrollment', 'Validation', 'Handoff'],
    exportProfiles: ['sanitized-handoff', 'internal'],
    policyLocks: ['least-privilege-required', 'mfa-check-required', 'no-password-storage']
  }),
  template({
    id: 'library-vendor-support-handoff',
    operatorIntent: 'Create a vendor-safe support packet with impact, repro, environment, sanitized evidence, and requested outcome.',
    riskTier: 'standard-change',
    defaultLayout: 'quad',
    preflightGates: [
      { kind: 'approval', label: 'Customer/internal authorization to contact vendor is identified', stopIfMissing: true },
      { kind: 'scope', label: 'Affected environment, service, and reproduction path are defined', stopIfMissing: true },
      { kind: 'data-safety', label: 'Sensitive data, screenshots, logs, and attachments are reviewed before handoff', stopIfMissing: true },
      { kind: 'validation', label: 'Requested vendor action and success criteria are stated', stopIfMissing: true }
    ],
    paneIntents: [
      { paneId: 'pane-1', role: 'runbook', intent: 'Support summary and evidence checklist' },
      { paneId: 'pane-2', role: 'vendor-portal', intent: 'Primary vendor support portal' },
      { paneId: 'pane-3', role: 'docs', intent: 'Vendor docs or known issue reference' },
      { paneId: 'pane-4', role: 'evidence', intent: 'Sanitized proof bundle outline' }
    ],
    evidenceChecklist: ['Impact summary', 'Reproduction steps', 'Sanitized evidence references', 'Requested vendor action'],
    recoveryActions: ['Remove unsafe attachments', 'Use sanitized handoff profile', 'Escalate approval if sensitive data is required'],
    handoffSections: ['Impact', 'Environment', 'Reproduction', 'Evidence', 'Request'],
    exportProfiles: ['sanitized-handoff'],
    policyLocks: ['sanitized-export-default', 'no-secret-attachments', 'manual-send-only']
  })
] as const;

export function missionRecipeLibraryV2Ids(): MissionRecipeLibraryId[] {
  return MISSION_RECIPE_LIBRARY_V2.map((entry) => entry.id);
}

export function getMissionRecipeLibraryV2Entry(id: string | undefined): MissionRecipeV2Template | undefined {
  if (!id) return undefined;
  return MISSION_RECIPE_LIBRARY_V2.find((entry) => entry.id === id);
}

export function missionRecipeLibraryV2ForRecipe(id: string | undefined): MissionRecipeV2Template | undefined {
  return getMissionRecipeLibraryV2Entry(id);
}

export function missionRecipeLibraryV2Coverage(): { recipeCount: number; v2Count: number; missing: MissionRecipeLibraryId[] } {
  const v2 = new Set(missionRecipeLibraryV2Ids());
  const missing = MISSION_RECIPE_LIBRARY.map((entry) => entry.id).filter((id) => !v2.has(id));
  return { recipeCount: MISSION_RECIPE_LIBRARY.length, v2Count: MISSION_RECIPE_LIBRARY_V2.length, missing };
}

export function missionRecipeLibraryV2Summary(): string {
  const coverage = missionRecipeLibraryV2Coverage();
  const releaseCritical = MISSION_RECIPE_LIBRARY_V2.filter((entry) => entry.riskTier === 'release-critical').length;
  const sensitiveAdmin = MISSION_RECIPE_LIBRARY_V2.filter((entry) => entry.riskTier === 'sensitive-admin').length;
  const incident = MISSION_RECIPE_LIBRARY_V2.filter((entry) => entry.riskTier === 'incident-response').length;
  return [
    `${PASS198_MISSION_RECIPE_LIBRARY_V2_PASS} ${PASS198_MISSION_RECIPE_LIBRARY_V2_VERSION}`,
    `recipes=${coverage.recipeCount}`,
    `v2=${coverage.v2Count}`,
    `required=${MISSION_RECIPE_LIBRARY_V2_REQUIRED_COUNT}`,
    `missing=${coverage.missing.length}`,
    `releaseCritical=${releaseCritical}`,
    `sensitiveAdmin=${sensitiveAdmin}`,
    `incident=${incident}`,
    'localOnly=true',
    'requiresHumanApproval=true',
    'storesSecrets=false',
    'directPsaApiAllowed=false'
  ].join('; ');
}
