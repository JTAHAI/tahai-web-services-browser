/**
 * PASS325 — Enterprise Managed Policy Locks for Profile UI
 *
 * Extends the existing enterprise admin policy with profile UI lock controls.
 * Policy precedence: Enterprise managed policy > local profile config > app defaults.
 *
 * No fake ADMX claim is made here — ADMX generation is a future extension point.
 */

import type { BrowserProfileKindUx, BrowserProfileUxConfig, BrowserProfileUxPolicyLocks, EnabledToolGroup, VisibleSurface } from './browser-profile-ux-model';
import { BROWSER_PROFILE_KINDS, ENABLED_TOOL_GROUPS, VISIBLE_SURFACES, defaultProfileUxConfig, sanitizeProfileUxConfig } from './browser-profile-ux-model';

export const PASS325_ENTERPRISE_POLICY_PASS = 'PASS325';
export const ENTERPRISE_POLICY_PROFILE_UI_CONTRACT_ID = 'enterprise-managed-policy-profile-ui-locks-v1';
export const ENTERPRISE_POLICY_PROFILE_UI_SCHEMA_VERSION = 1;

// ─── Policy Lock Fields ───────────────────────────────────────────────────────

export const ENTERPRISE_PROFILE_POLICY_KEYS: Array<keyof BrowserProfileUxPolicyLocks> = [
  'allowedProfileKinds',
  'defaultProfileKind',
  'lockedVisibleSurfaces',
  'disabledVisibleSurfaces',
  'lockedToolGroups',
  'disabledToolGroups',
  'allowCustomProfiles',
  'allowOpsMode',
  'allowMissionExports',
  'allowEvidenceCapture',
  'allowSupportBundle',
  'allowDevOpsTools',
  'allowITTools',
  'allowAdminConsoleProfiles',
  'allowProfileSwitching',
  'allowUserUiCustomization',
];

// ─── Policy Diagnostic Item ───────────────────────────────────────────────────

export type PolicyDiagnosticItem = {
  field: string;
  lockedValue: unknown;
  lockedBy: 'enterprise-policy' | 'profile-default';
  description: string;
};

export type ProfileUiPolicyDiagnosticsState = {
  pass: typeof PASS325_ENTERPRISE_POLICY_PASS;
  contractId: typeof ENTERPRISE_POLICY_PROFILE_UI_CONTRACT_ID;
  managed: boolean;
  policySource: string;
  locks: BrowserProfileUxPolicyLocks;
  diagnosticItems: PolicyDiagnosticItem[];
  allowUserCustomization: boolean;
  allowProfileSwitching: boolean;
};

// ─── Policy Sanitizer ─────────────────────────────────────────────────────────

const SECRETISH = /(?:bearer\s+|authorization\s*:|cookie\s*:|access[_-]?token|client[_-]?secret|api[_-]?key)/i;

function cleanBoolean(value: unknown, fallback: boolean | undefined): boolean | undefined {
  return typeof value === 'boolean' ? value : fallback;
}

function cleanProfileKinds(value: unknown): BrowserProfileKindUx[] {
  if (!Array.isArray(value)) return [];
  return value.filter(k => BROWSER_PROFILE_KINDS.includes(k)) as BrowserProfileKindUx[];
}

function cleanSurfaces(value: unknown): VisibleSurface[] {
  if (!Array.isArray(value)) return [];
  return value.filter(s => VISIBLE_SURFACES.includes(s)) as VisibleSurface[];
}

function cleanToolGroups(value: unknown): EnabledToolGroup[] {
  if (!Array.isArray(value)) return [];
  return value.filter(g => ENABLED_TOOL_GROUPS.includes(g)) as EnabledToolGroup[];
}

export function sanitizeProfileUxPolicyLocks(value: unknown): BrowserProfileUxPolicyLocks {
  if (!value || typeof value !== 'object') return {};
  const raw = value as Record<string, unknown>;
  const json = JSON.stringify(raw);
  if (SECRETISH.test(json)) return {};

  const locks: BrowserProfileUxPolicyLocks = {};
  const kinds = cleanProfileKinds(raw.allowedProfileKinds);
  if (kinds.length > 0) locks.allowedProfileKinds = kinds;
  const defaultKind = BROWSER_PROFILE_KINDS.includes(raw.defaultProfileKind as BrowserProfileKindUx)
    ? raw.defaultProfileKind as BrowserProfileKindUx : undefined;
  if (defaultKind) locks.defaultProfileKind = defaultKind;
  const lockedSurfaces = cleanSurfaces(raw.lockedVisibleSurfaces);
  if (lockedSurfaces.length > 0) locks.lockedVisibleSurfaces = lockedSurfaces;
  const disabledSurfaces = cleanSurfaces(raw.disabledVisibleSurfaces);
  if (disabledSurfaces.length > 0) locks.disabledVisibleSurfaces = disabledSurfaces;
  const lockedGroups = cleanToolGroups(raw.lockedToolGroups);
  if (lockedGroups.length > 0) locks.lockedToolGroups = lockedGroups;
  const disabledGroups = cleanToolGroups(raw.disabledToolGroups);
  if (disabledGroups.length > 0) locks.disabledToolGroups = disabledGroups;

  for (const boolKey of ['allowCustomProfiles', 'allowOpsMode', 'allowMissionExports', 'allowEvidenceCapture',
    'allowSupportBundle', 'allowDevOpsTools', 'allowITTools', 'allowAdminConsoleProfiles',
    'allowProfileSwitching', 'allowUserUiCustomization'] as const) {
    const v = cleanBoolean(raw[boolKey], undefined);
    if (v !== undefined) locks[boolKey] = v;
  }
  return locks;
}

// ─── Policy Application ───────────────────────────────────────────────────────

/**
 * Apply enterprise policy locks to a profile UX config.
 * Policy precedence (highest to lowest): enterprise managed policy > local profile config > app defaults.
 * Policy overrides local config for any locked field.
 */
export function applyProfileUxPolicyLocksToConfig(
  config: BrowserProfileUxConfig,
  locks: BrowserProfileUxPolicyLocks
): BrowserProfileUxConfig {
  if (Object.keys(locks).length === 0) return config;

  let patched = { ...config };
  const lockedFields: string[] = [...config.enterprisePolicyLockedFields];

  // Force default profile kind
  if (locks.defaultProfileKind && locks.defaultProfileKind !== config.profileKind) {
    patched = { ...defaultProfileUxConfig(locks.defaultProfileKind), enterprisePolicyLockedFields: [] };
    lockedFields.push('profileKind');
  }

  // Disable ops mode
  if (locks.allowOpsMode === false) {
    patched.missionControlEnabled = false;
    patched.visibleSurfaces = patched.visibleSurfaces.filter(s => s !== 'ops-mode' && s !== 'mission-control' && s !== 'mission-recipes');
    lockedFields.push('missionControlEnabled');
  }

  // Disable evidence
  if (locks.allowEvidenceCapture === false) {
    patched.evidenceEnabled = false;
    patched.visibleSurfaces = patched.visibleSurfaces.filter(s => s !== 'evidence-pack');
    lockedFields.push('evidenceEnabled');
  }

  // Disable support bundle
  if (locks.allowSupportBundle === false) {
    patched.supportBundleEnabled = false;
    patched.visibleSurfaces = patched.visibleSurfaces.filter(s => s !== 'support-bundle');
    lockedFields.push('supportBundleEnabled');
  }

  // Disable devops tools
  if (locks.allowDevOpsTools === false) {
    patched.devOpsToolsEnabled = false;
    patched.visibleSurfaces = patched.visibleSurfaces.filter(s => s !== 'devops-tools');
    patched.enabledToolGroups = patched.enabledToolGroups.filter(g => g !== 'devops');
    lockedFields.push('devOpsToolsEnabled');
  }

  // Disable IT tools
  if (locks.allowITTools === false) {
    patched.itToolsEnabled = false;
    patched.visibleSurfaces = patched.visibleSurfaces.filter(s => s !== 'it-tools');
    lockedFields.push('itToolsEnabled');
  }

  // Disable admin console profiles
  if (locks.allowAdminConsoleProfiles === false) {
    patched.adminProfilesEnabled = false;
    patched.visibleSurfaces = patched.visibleSurfaces.filter(s => s !== 'admin-console-profiles');
    lockedFields.push('adminProfilesEnabled');
  }

  // Disable UI customization
  if (locks.allowUserUiCustomization === false) {
    lockedFields.push('toolbarLayout', 'newTabLayout', 'visibleSurfaces', 'enabledToolGroups');
  }

  // Apply disabled surfaces
  if (locks.disabledVisibleSurfaces && locks.disabledVisibleSurfaces.length > 0) {
    const disabled = new Set(locks.disabledVisibleSurfaces);
    patched.visibleSurfaces = patched.visibleSurfaces.filter(s => !disabled.has(s));
    lockedFields.push('visibleSurfaces');
  }

  // Apply disabled tool groups
  if (locks.disabledToolGroups && locks.disabledToolGroups.length > 0) {
    const disabled = new Set(locks.disabledToolGroups);
    patched.enabledToolGroups = patched.enabledToolGroups.filter(g => !disabled.has(g));
    lockedFields.push('enabledToolGroups');
  }

  // Lock custom profiles
  if (locks.allowCustomProfiles === false && patched.profileKind === 'custom') {
    patched = { ...defaultProfileUxConfig('personal'), enterprisePolicyLockedFields: [] };
    lockedFields.push('profileKind');
  }

  return sanitizeProfileUxConfig({
    ...patched,
    enterprisePolicyLockedFields: [...new Set(lockedFields)],
  });
}

// ─── Diagnostics ─────────────────────────────────────────────────────────────

export function buildProfileUiPolicyDiagnostics(
  locks: BrowserProfileUxPolicyLocks,
  managed: boolean,
  policySource: string
): ProfileUiPolicyDiagnosticsState {
  const items: PolicyDiagnosticItem[] = [];
  const lockedBy = managed ? 'enterprise-policy' as const : 'profile-default' as const;

  if (locks.defaultProfileKind) items.push({ field: 'defaultProfileKind', lockedValue: locks.defaultProfileKind, lockedBy, description: `Profile kind is locked to ${locks.defaultProfileKind}.` });
  if (locks.allowedProfileKinds) items.push({ field: 'allowedProfileKinds', lockedValue: locks.allowedProfileKinds, lockedBy, description: `Only these profile kinds are allowed: ${locks.allowedProfileKinds.join(', ')}.` });
  if (locks.allowOpsMode === false) items.push({ field: 'allowOpsMode', lockedValue: false, lockedBy, description: 'Ops Mode is disabled by policy.' });
  if (locks.allowEvidenceCapture === false) items.push({ field: 'allowEvidenceCapture', lockedValue: false, lockedBy, description: 'Evidence capture is disabled by policy.' });
  if (locks.allowMissionExports === false) items.push({ field: 'allowMissionExports', lockedValue: false, lockedBy, description: 'Mission exports are disabled by policy.' });
  if (locks.allowSupportBundle === false) items.push({ field: 'allowSupportBundle', lockedValue: false, lockedBy, description: 'Support bundle is disabled by policy.' });
  if (locks.allowDevOpsTools === false) items.push({ field: 'allowDevOpsTools', lockedValue: false, lockedBy, description: 'DevOps tools are disabled by policy.' });
  if (locks.allowITTools === false) items.push({ field: 'allowITTools', lockedValue: false, lockedBy, description: 'IT tools are disabled by policy.' });
  if (locks.allowAdminConsoleProfiles === false) items.push({ field: 'allowAdminConsoleProfiles', lockedValue: false, lockedBy, description: 'Admin Console Profiles are disabled by policy.' });
  if (locks.allowProfileSwitching === false) items.push({ field: 'allowProfileSwitching', lockedValue: false, lockedBy, description: 'Profile switching is disabled by policy.' });
  if (locks.allowUserUiCustomization === false) items.push({ field: 'allowUserUiCustomization', lockedValue: false, lockedBy, description: 'UI customization is disabled by policy.' });
  if (locks.allowCustomProfiles === false) items.push({ field: 'allowCustomProfiles', lockedValue: false, lockedBy, description: 'Custom profile creation is disabled by policy.' });
  if (locks.disabledVisibleSurfaces?.length) items.push({ field: 'disabledVisibleSurfaces', lockedValue: locks.disabledVisibleSurfaces, lockedBy, description: `These surfaces are disabled by policy: ${locks.disabledVisibleSurfaces.join(', ')}.` });
  if (locks.disabledToolGroups?.length) items.push({ field: 'disabledToolGroups', lockedValue: locks.disabledToolGroups, lockedBy, description: `These tool groups are disabled by policy: ${locks.disabledToolGroups.join(', ')}.` });

  return {
    pass: PASS325_ENTERPRISE_POLICY_PASS,
    contractId: ENTERPRISE_POLICY_PROFILE_UI_CONTRACT_ID,
    managed,
    policySource,
    locks,
    diagnosticItems: items,
    allowUserCustomization: locks.allowUserUiCustomization !== false,
    allowProfileSwitching: locks.allowProfileSwitching !== false,
  };
}

export function enterprisePolicyProfileUiSummary(state: ProfileUiPolicyDiagnosticsState): string {
  return `${PASS325_ENTERPRISE_POLICY_PASS} ${ENTERPRISE_POLICY_PROFILE_UI_CONTRACT_ID}: managed=${state.managed}; locks=${state.diagnosticItems.length}; allowCustomization=${state.allowUserCustomization}; allowSwitching=${state.allowProfileSwitching}`;
}
