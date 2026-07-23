/**
 * PASS318 — Profile Switcher + First-Run Browser Type Choice
 *
 * Shared contract for profile switching UX:
 * - First-run profile type selection
 * - Profile switcher state
 * - Active profile UX config binding
 * - Safe profile switch without exposing secrets
 */

import type { BrowserProfileKindUx, BrowserProfileUxConfig } from './browser-profile-ux-model';
import { BROWSER_PROFILE_KINDS, BROWSER_PROFILE_KIND_LABELS, BROWSER_PROFILE_KIND_DESCRIPTIONS, defaultProfileUxConfig } from './browser-profile-ux-model';

export const PASS318_PROFILE_SWITCHER_PASS = 'PASS318';
export const PROFILE_SWITCHER_CONTRACT_ID = 'profile-switcher-first-run-v1';
export const PROFILE_SWITCHER_SCHEMA_VERSION = 1;

// ─── First-Run Choice ─────────────────────────────────────────────────────────

export type FirstRunProfileChoice = {
  kind: BrowserProfileKindUx;
  label: string;
  description: string;
  icon: string;
  defaultModeLabel: string;
};

export const FIRST_RUN_PROFILE_CHOICES: FirstRunProfileChoice[] = BROWSER_PROFILE_KINDS.map(kind => ({
  kind,
  label: BROWSER_PROFILE_KIND_LABELS[kind],
  description: BROWSER_PROFILE_KIND_DESCRIPTIONS[kind],
  icon: profileKindIcon(kind),
  defaultModeLabel: defaultProfileUxConfig(kind).defaultMode === 'ops-mode' ? 'Operator Mode default' : 'Daily Driver default',
}));

function profileKindIcon(kind: BrowserProfileKindUx): string {
  switch (kind) {
    case 'personal': return '🏠';
    case 'it-admin': return '🔧';
    case 'devops': return '⚙️';
    case 'msp-support': return '🎟️';
    case 'security-incident': return '🔒';
    case 'minimal-privacy': return '🛡️';
    case 'custom': return '✏️';
    default: return '🌐';
  }
}

// ─── Profile Switcher State ───────────────────────────────────────────────────

export type ProfileSwitcherEntry = {
  profileId: string;
  profileName: string;
  profileColor: string;
  uxKind: BrowserProfileKindUx;
  uxKindLabel: string;
  isActive: boolean;
  requiresRestartToSwitch: false;
};

export type ProfileSwitcherState = {
  pass: typeof PASS318_PROFILE_SWITCHER_PASS;
  contractId: typeof PROFILE_SWITCHER_CONTRACT_ID;
  entries: ProfileSwitcherEntry[];
  activeProfileId: string;
  activeUxConfig: BrowserProfileUxConfig;
  policyAllowsSwitching: boolean;
  policyAllowsCustomProfiles: boolean;
};

// ─── First-Run State ──────────────────────────────────────────────────────────

export type FirstRunProfileState = {
  pass: typeof PASS318_PROFILE_SWITCHER_PASS;
  contractId: typeof PROFILE_SWITCHER_CONTRACT_ID;
  schemaVersion: typeof PROFILE_SWITCHER_SCHEMA_VERSION;
  completed: boolean;
  chosenKind: BrowserProfileKindUx | null;
  completedAt: string | null;
  /** Guard: no session data, no cookies, no credentials in this state. */
  guardrails: {
    noSessionData: true;
    noCredentials: true;
    noCookies: true;
    profileUxOnly: true;
  };
};

export function defaultFirstRunProfileState(): FirstRunProfileState {
  return {
    pass: PASS318_PROFILE_SWITCHER_PASS,
    contractId: PROFILE_SWITCHER_CONTRACT_ID,
    schemaVersion: PROFILE_SWITCHER_SCHEMA_VERSION,
    completed: false,
    chosenKind: null,
    completedAt: null,
    guardrails: {
      noSessionData: true,
      noCredentials: true,
      noCookies: true,
      profileUxOnly: true,
    },
  };
}

export function completeFirstRunProfileState(kind: BrowserProfileKindUx): FirstRunProfileState {
  const valid = BROWSER_PROFILE_KINDS.includes(kind as BrowserProfileKindUx);
  return {
    ...defaultFirstRunProfileState(),
    completed: true,
    chosenKind: valid ? kind : 'personal',
    completedAt: new Date().toISOString(),
  };
}

export function cleanFirstRunProfileState(value: unknown): FirstRunProfileState {
  if (!value || typeof value !== 'object') return defaultFirstRunProfileState();
  const raw = value as Record<string, unknown>;
  if (!raw.completed) return defaultFirstRunProfileState();
  const kind = BROWSER_PROFILE_KINDS.includes(raw.chosenKind as BrowserProfileKindUx)
    ? raw.chosenKind as BrowserProfileKindUx
    : 'personal';
  return completeFirstRunProfileState(kind);
}

// ─── Profile Switcher Helpers ─────────────────────────────────────────────────

export function profileSwitcherSummary(state: ProfileSwitcherState): string {
  return `${PASS318_PROFILE_SWITCHER_PASS} ${PROFILE_SWITCHER_CONTRACT_ID}: entries=${state.entries.length}; active=${state.activeProfileId}; kind=${state.activeUxConfig.profileKind}; allowSwitching=${state.policyAllowsSwitching}`;
}

/**
 * Whether switching from one profile to another requires a restart.
 * In the current implementation: never requires restart (profile UX switches in-renderer).
 * Session partitioning changes require restart — but UX config does not.
 */
export function profileSwitchRequiresRestart(
  fromProfileId: string,
  toProfileId: string
): { requiresRestart: boolean; reason: string } {
  if (fromProfileId === toProfileId) {
    return { requiresRestart: false, reason: 'Same profile' };
  }
  // UX config changes are applied immediately in-renderer.
  // Changing the Electron session partition (for cookies/auth isolation) requires restart.
  return {
    requiresRestart: true,
    reason: 'Switching browser profiles requires a restart to apply the new session partition. Your current session data will be preserved.',
  };
}
