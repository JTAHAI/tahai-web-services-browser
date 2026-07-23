/**
 * PASS324 — Command Center Profile-Aware Power Surface
 *
 * Profile-aware command center contract.
 * Commands are filtered by active profile. Hidden/disabled commands show clean reasons.
 * No hidden-surface command opens a forbidden overlay.
 */

import type { BrowserProfileUxConfig, CommandCenterCategory } from './browser-profile-ux-model';
import { isCommandCenterCategoryEnabled, isSurfaceVisible, isToolGroupEnabled, isProfileFieldLocked } from './browser-profile-ux-model';

export const PASS324_COMMAND_CENTER_PASS = 'PASS324';
export const PROFILE_COMMAND_CENTER_CONTRACT_ID = 'profile-aware-command-center-v1';

// ─── Command Definition ───────────────────────────────────────────────────────

export type CommandTargetScope = 'active-tab' | 'active-pane' | 'mission' | 'profile' | 'browser' | 'settings';

export type CommandAvailability = 'available' | 'disabled-by-profile' | 'disabled-by-policy' | 'requires-confirmation';

export type ProfileAwareCommand = {
  id: string;
  label: string;
  description: string;
  category: CommandCenterCategory;
  targetScope: CommandTargetScope;
  requiredSurface: string | null;
  requiredToolGroup: string | null;
  isDestructive: boolean;
  shortcut: string | null;
};

export type ProfileAwareCommandState = ProfileAwareCommand & {
  availability: CommandAvailability;
  disabledReason: string;
  showInSearch: boolean;
};

// ─── Command Registry ─────────────────────────────────────────────────────────

export const PROFILE_COMMAND_REGISTRY: ProfileAwareCommand[] = [
  // Daily Browsing
  { id: 'navigate-home', label: 'Go Home', description: 'Navigate to the home page.', category: 'daily-browsing', targetScope: 'active-tab', requiredSurface: 'home', requiredToolGroup: null, isDestructive: false, shortcut: 'Alt+Home' },
  { id: 'new-tab', label: 'New Tab', description: 'Open a new tab.', category: 'daily-browsing', targetScope: 'active-tab', requiredSurface: 'daily-driver-new-tab', requiredToolGroup: null, isDestructive: false, shortcut: 'Ctrl+T' },
  { id: 'close-tab', label: 'Close Tab', description: 'Close the active tab.', category: 'daily-browsing', targetScope: 'active-tab', requiredSurface: null, requiredToolGroup: null, isDestructive: false, shortcut: 'Ctrl+W' },
  { id: 'reload', label: 'Reload Page', description: 'Reload the current page.', category: 'daily-browsing', targetScope: 'active-tab', requiredSurface: null, requiredToolGroup: null, isDestructive: false, shortcut: 'Ctrl+R' },
  { id: 'navigate-back', label: 'Back', description: 'Navigate back.', category: 'daily-browsing', targetScope: 'active-tab', requiredSurface: null, requiredToolGroup: null, isDestructive: false, shortcut: 'Alt+Left' },
  { id: 'navigate-forward', label: 'Forward', description: 'Navigate forward.', category: 'daily-browsing', targetScope: 'active-tab', requiredSurface: null, requiredToolGroup: null, isDestructive: false, shortcut: 'Alt+Right' },
  { id: 'focus-address', label: 'Focus Address Bar', description: 'Focus the address bar.', category: 'daily-browsing', targetScope: 'active-tab', requiredSurface: null, requiredToolGroup: null, isDestructive: false, shortcut: 'Ctrl+L' },
  { id: 'open-bookmarks', label: 'Open Bookmarks', description: 'View bookmarks.', category: 'daily-browsing', targetScope: 'browser', requiredSurface: 'bookmarks', requiredToolGroup: 'bookmarks', isDestructive: false, shortcut: null },
  { id: 'open-history', label: 'Open History', description: 'View browsing history.', category: 'daily-browsing', targetScope: 'browser', requiredSurface: 'history', requiredToolGroup: 'history', isDestructive: false, shortcut: 'Ctrl+H' },
  { id: 'open-downloads', label: 'Open Downloads', description: 'View downloads.', category: 'daily-browsing', targetScope: 'browser', requiredSurface: 'downloads', requiredToolGroup: 'downloads', isDestructive: false, shortcut: 'Ctrl+J' },

  // Tabs / Windows
  { id: 'pin-tab', label: 'Pin Tab', description: 'Pin the active tab.', category: 'tabs-windows', targetScope: 'active-tab', requiredSurface: null, requiredToolGroup: null, isDestructive: false, shortcut: null },
  { id: 'reopen-closed-tab', label: 'Reopen Closed Tab', description: 'Reopen the most recently closed tab.', category: 'tabs-windows', targetScope: 'browser', requiredSurface: null, requiredToolGroup: null, isDestructive: false, shortcut: 'Ctrl+Shift+T' },

  // Settings
  { id: 'open-settings', label: 'Open Settings', description: 'Open the browser settings.', category: 'settings', targetScope: 'browser', requiredSurface: 'settings', requiredToolGroup: null, isDestructive: false, shortcut: 'Ctrl+,' },
  { id: 'settings-privacy', label: 'Privacy Settings', description: 'Jump to privacy and security settings.', category: 'settings', targetScope: 'settings', requiredSurface: 'settings', requiredToolGroup: 'privacy', isDestructive: false, shortcut: null },
  { id: 'settings-downloads', label: 'Download Settings', description: 'Jump to download settings.', category: 'settings', targetScope: 'settings', requiredSurface: 'downloads', requiredToolGroup: 'downloads', isDestructive: false, shortcut: null },
  { id: 'settings-reset', label: 'Reset Settings', description: 'Reset this profile\'s settings to defaults.', category: 'settings', targetScope: 'settings', requiredSurface: 'settings', requiredToolGroup: null, isDestructive: true, shortcut: null },

  // Profiles
  { id: 'switch-profile', label: 'Switch Profile', description: 'Switch to a different browser profile.', category: 'profiles', targetScope: 'browser', requiredSurface: null, requiredToolGroup: null, isDestructive: false, shortcut: null },
  { id: 'new-profile', label: 'Create New Profile', description: 'Create a new browser profile.', category: 'profiles', targetScope: 'browser', requiredSurface: null, requiredToolGroup: null, isDestructive: false, shortcut: null },
  { id: 'manage-profiles', label: 'Manage Profiles', description: 'Open the profiles management page.', category: 'profiles', targetScope: 'settings', requiredSurface: 'settings', requiredToolGroup: null, isDestructive: false, shortcut: null },

  // UI Customization
  { id: 'toggle-ops-mode', label: 'Toggle Ops Mode', description: 'Switch between Daily Driver and Ops Mode.', category: 'ui-customization', targetScope: 'browser', requiredSurface: 'ops-mode', requiredToolGroup: 'mission', isDestructive: false, shortcut: null },
  { id: 'customize-profile-ui', label: 'Customize Profile UI', description: 'Open UI customization settings for this profile.', category: 'ui-customization', targetScope: 'settings', requiredSurface: 'settings', requiredToolGroup: null, isDestructive: false, shortcut: null },

  // IT Tools
  { id: 'dns-lookup', label: 'DNS Lookup', description: 'Run a DNS lookup for a domain.', category: 'it-tools', targetScope: 'active-tab', requiredSurface: 'it-tools', requiredToolGroup: 'dns', isDestructive: false, shortcut: null },
  { id: 'tls-check', label: 'TLS / Certificate Check', description: 'Check TLS certificate details for the active tab.', category: 'it-tools', targetScope: 'active-tab', requiredSurface: 'it-tools', requiredToolGroup: 'tls', isDestructive: false, shortcut: null },
  { id: 'headers-check', label: 'HTTP Headers', description: 'Inspect HTTP response headers.', category: 'it-tools', targetScope: 'active-tab', requiredSurface: 'it-tools', requiredToolGroup: 'headers', isDestructive: false, shortcut: null },
  { id: 'redirect-chain', label: 'Redirect Chain', description: 'Follow and audit the redirect chain.', category: 'it-tools', targetScope: 'active-tab', requiredSurface: 'it-tools', requiredToolGroup: 'redirects', isDestructive: false, shortcut: null },
  { id: 'endpoint-check', label: 'Endpoint Smoke Check', description: 'Check endpoint availability and response.', category: 'it-tools', targetScope: 'active-tab', requiredSurface: 'it-tools', requiredToolGroup: 'endpoint-smoke', isDestructive: false, shortcut: null },

  // DevOps Tools
  { id: 'json-viewer', label: 'JSON / YAML Viewer', description: 'View and format JSON or YAML.', category: 'devops-tools', targetScope: 'active-tab', requiredSurface: 'devops-tools', requiredToolGroup: 'json-yaml', isDestructive: false, shortcut: null },
  { id: 'jwt-decoder', label: 'JWT Decoder', description: 'Decode and inspect a JWT token.', category: 'devops-tools', targetScope: 'active-tab', requiredSurface: 'devops-tools', requiredToolGroup: 'jwt', isDestructive: false, shortcut: null },
  { id: 'cidr-calculator', label: 'CIDR Calculator', description: 'Calculate IP ranges and subnet masks.', category: 'devops-tools', targetScope: 'browser', requiredSurface: 'devops-tools', requiredToolGroup: 'cidr', isDestructive: false, shortcut: null },
  { id: 'checksum-verifier', label: 'Checksum Verifier', description: 'Verify file checksums (SHA-256, MD5).', category: 'devops-tools', targetScope: 'browser', requiredSurface: 'devops-tools', requiredToolGroup: 'checksum', isDestructive: false, shortcut: null },

  // Mission Control
  { id: 'open-mission-control', label: 'Open Mission Control', description: 'Open Mission Control.', category: 'mission-control', targetScope: 'browser', requiredSurface: 'mission-control', requiredToolGroup: 'mission', isDestructive: false, shortcut: null },
  { id: 'new-mission', label: 'New Mission', description: 'Create a new operator mission.', category: 'mission-control', targetScope: 'mission', requiredSurface: 'mission-control', requiredToolGroup: 'mission', isDestructive: false, shortcut: null },
  { id: 'mission-recipes', label: 'Mission Recipes', description: 'Browse and launch mission recipes.', category: 'mission-control', targetScope: 'browser', requiredSurface: 'mission-recipes', requiredToolGroup: 'mission', isDestructive: false, shortcut: null },

  // Evidence
  { id: 'capture-evidence', label: 'Capture Evidence', description: 'Capture evidence from the active page.', category: 'evidence', targetScope: 'active-tab', requiredSurface: 'evidence-pack', requiredToolGroup: 'evidence', isDestructive: false, shortcut: null },
  { id: 'export-evidence', label: 'Export Evidence Pack', description: 'Export redacted evidence to a file.', category: 'evidence', targetScope: 'mission', requiredSurface: 'evidence-pack', requiredToolGroup: 'evidence', isDestructive: false, shortcut: null },

  // Runbook
  { id: 'open-runbook', label: 'Open Runbook Rail', description: 'Open the runbook rail.', category: 'runbook', targetScope: 'browser', requiredSurface: 'runbook-rail', requiredToolGroup: 'mission', isDestructive: false, shortcut: null },

  // Admin Console Profiles
  { id: 'admin-console-profiles', label: 'Admin Console Profiles', description: 'Open the admin console profiles panel.', category: 'admin-console-profiles', targetScope: 'browser', requiredSurface: 'admin-console-profiles', requiredToolGroup: null, isDestructive: false, shortcut: null },

  // Support
  { id: 'support-bundle', label: 'Generate Support Bundle', description: 'Capture and export a sanitized support bundle.', category: 'support', targetScope: 'browser', requiredSurface: 'support-bundle', requiredToolGroup: 'support', isDestructive: false, shortcut: null },

  // Enterprise Policy
  { id: 'policy-diagnostics', label: 'Policy Diagnostics', description: 'View active enterprise policy locks and sources.', category: 'enterprise-policy', targetScope: 'settings', requiredSurface: 'policy-diagnostics', requiredToolGroup: 'enterprise-policy', isDestructive: false, shortcut: null },
];

// ─── Command State Resolution ─────────────────────────────────────────────────

export function resolveCommandState(cmd: ProfileAwareCommand, config: BrowserProfileUxConfig): ProfileAwareCommandState {
  const categoryEnabled = isCommandCenterCategoryEnabled(config, cmd.category);
  const surfaceVisible = cmd.requiredSurface === null || isSurfaceVisible(config, cmd.requiredSurface as Parameters<typeof isSurfaceVisible>[1]);
  const toolGroupEnabled = cmd.requiredToolGroup === null || isToolGroupEnabled(config, cmd.requiredToolGroup as Parameters<typeof isToolGroupEnabled>[1]);
  const lockedByPolicy = cmd.requiredSurface !== null && isProfileFieldLocked(config, 'visibleSurfaces');

  let availability: CommandAvailability;
  let disabledReason = '';

  if (lockedByPolicy && (!surfaceVisible || !toolGroupEnabled)) {
    availability = 'disabled-by-policy';
    disabledReason = 'Disabled by enterprise policy.';
  } else if (!surfaceVisible || !toolGroupEnabled || !categoryEnabled) {
    availability = 'disabled-by-profile';
    const missingWhat = !surfaceVisible ? `${cmd.requiredSurface} surface` : `${cmd.requiredToolGroup} tools`;
    disabledReason = `Disabled by profile setting (${config.profileKind}). Enable ${missingWhat} in Settings → UI Customization.`;
  } else if (cmd.isDestructive) {
    availability = 'requires-confirmation';
  } else {
    availability = 'available';
  }

  // Always show in search so users can discover disabled commands
  const showInSearch = true;

  return { ...cmd, availability, disabledReason, showInSearch };
}

/**
 * Returns all commands filtered and resolved for the active profile.
 */
export function getCommandsForProfile(config: BrowserProfileUxConfig): ProfileAwareCommandState[] {
  return PROFILE_COMMAND_REGISTRY.map(cmd => resolveCommandState(cmd, config));
}

/**
 * Returns only available commands for the active profile.
 */
export function getAvailableCommandsForProfile(config: BrowserProfileUxConfig): ProfileAwareCommandState[] {
  return getCommandsForProfile(config).filter(cmd => cmd.availability === 'available' || cmd.availability === 'requires-confirmation');
}

export function profileCommandCenterSummary(config: BrowserProfileUxConfig): string {
  const all = getCommandsForProfile(config);
  const available = all.filter(c => c.availability === 'available');
  const disabled = all.filter(c => c.availability !== 'available');
  return `${PASS324_COMMAND_CENTER_PASS} ${PROFILE_COMMAND_CENTER_CONTRACT_ID}: kind=${config.profileKind}; total=${all.length}; available=${available.length}; disabled=${disabled.length}`;
}
