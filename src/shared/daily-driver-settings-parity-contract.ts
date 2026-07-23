/**
 * PASS320 — Daily Driver Settings Parity Shell
 *
 * Contract for the settings IA that makes TAHAI Browser credible against Chrome/Edge.
 * Defines all settings sections, their implementation status, and profile-aware overrides.
 * No stale pass chatter, no fake claims, no broken buttons.
 */

import type { BrowserProfileUxConfig } from './browser-profile-ux-model';
import { isSurfaceVisible } from './browser-profile-ux-model';

export const PASS320_SETTINGS_PARITY_PASS = 'PASS320';
export const SETTINGS_PARITY_CONTRACT_ID = 'daily-driver-settings-parity-shell-v1';

// ─── Settings Section ─────────────────────────────────────────────────────────

export const SETTINGS_SECTION_IDS = [
  'profiles',
  'search-engine',
  'startup',
  'appearance',
  'tabs',
  'privacy-security',
  'site-permissions',
  'downloads',
  'languages',
  'accessibility',
  'system-performance',
  'reset-settings',
  'about',
  'enterprise-policy',
  'ops-mission-control',
  'ui-customization',
] as const;

export type SettingsSectionId = typeof SETTINGS_SECTION_IDS[number];

export type SettingsSectionStatus = 'implemented' | 'partial' | 'coming-soon';

export type SettingsSection = {
  id: SettingsSectionId;
  title: string;
  description: string;
  status: SettingsSectionStatus;
  profileVisible: boolean;
  /** True if this section should show in the profile's settings nav. */
  showInNav: (config: BrowserProfileUxConfig) => boolean;
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: 'profiles',
    title: 'Profiles',
    description: 'Create and manage browser profiles. Each profile has its own browsing data, UI layout, and tool access.',
    status: 'implemented',
    profileVisible: true,
    showInNav: () => true,
  },
  {
    id: 'search-engine',
    title: 'Search Engine',
    description: 'Choose your default search engine for the address bar.',
    status: 'implemented',
    profileVisible: true,
    showInNav: () => true,
  },
  {
    id: 'startup',
    title: 'Startup',
    description: 'Choose what happens when TAHAI Browser starts.',
    status: 'implemented',
    profileVisible: true,
    showInNav: () => true,
  },
  {
    id: 'appearance',
    title: 'Appearance',
    description: 'Customize the browser theme, fonts, and visual density.',
    status: 'partial',
    profileVisible: true,
    showInNav: () => true,
  },
  {
    id: 'tabs',
    title: 'Tabs',
    description: 'Configure tab behavior, grouping, and pinning options.',
    status: 'partial',
    profileVisible: true,
    showInNav: () => true,
  },
  {
    id: 'privacy-security',
    title: 'Privacy and Security',
    description: 'Control cookies, tracking, referrer policy, and browsing data.',
    status: 'implemented',
    profileVisible: true,
    showInNav: () => true,
  },
  {
    id: 'site-permissions',
    title: 'Site Permissions',
    description: 'Control what sites can access: camera, microphone, location, notifications, clipboard.',
    status: 'implemented',
    profileVisible: true,
    showInNav: () => true,
  },
  {
    id: 'downloads',
    title: 'Downloads',
    description: 'Set your default download location and download behavior.',
    status: 'implemented',
    profileVisible: true,
    showInNav: () => true,
  },
  {
    id: 'languages',
    title: 'Languages',
    description: 'Configure spell check and language preferences.',
    status: 'coming-soon',
    profileVisible: true,
    showInNav: () => true,
  },
  {
    id: 'accessibility',
    title: 'Accessibility',
    description: 'Zoom level, high-contrast mode, and assistive technology settings.',
    status: 'partial',
    profileVisible: true,
    showInNav: () => true,
  },
  {
    id: 'system-performance',
    title: 'System & Performance',
    description: 'Hardware acceleration, memory usage, and performance settings.',
    status: 'partial',
    profileVisible: true,
    showInNav: () => true,
  },
  {
    id: 'reset-settings',
    title: 'Reset Settings',
    description: 'Reset this profile\'s settings to defaults. This does not delete your browsing data.',
    status: 'implemented',
    profileVisible: true,
    showInNav: () => true,
  },
  {
    id: 'about',
    title: 'About TAHAI Browser',
    description: 'Version information, release channel, signing status, and update policy.',
    status: 'implemented',
    profileVisible: true,
    showInNav: () => true,
  },
  {
    id: 'enterprise-policy',
    title: 'Advanced / Enterprise Policy',
    description: 'View which settings are managed by your organization. Enterprise-managed settings cannot be changed here.',
    status: 'implemented',
    profileVisible: true,
    showInNav: (config) => isSurfaceVisible(config, 'policy-diagnostics') || config.itToolsEnabled,
  },
  {
    id: 'ops-mission-control',
    title: 'Ops Mode / Mission Control',
    description: 'Configure operator mode behavior, mission layouts, evidence, and runbook settings.',
    status: 'implemented',
    profileVisible: true,
    showInNav: (config) => config.missionControlEnabled,
  },
  {
    id: 'ui-customization',
    title: 'UI Customization',
    description: 'Choose your browser personality: profile kind, visible surfaces, toolbar layout, and new-tab content.',
    status: 'implemented',
    profileVisible: true,
    showInNav: () => true,
  },
];

export function settingsSectionsForProfile(config: BrowserProfileUxConfig): SettingsSection[] {
  return SETTINGS_SECTIONS.filter(s => s.showInNav(config));
}

export function settingsSectionById(id: SettingsSectionId): SettingsSection | undefined {
  return SETTINGS_SECTIONS.find(s => s.id === id);
}

export function settingsParitySummary(config: BrowserProfileUxConfig): string {
  const visible = settingsSectionsForProfile(config);
  const implemented = visible.filter(s => s.status === 'implemented');
  const partial = visible.filter(s => s.status === 'partial');
  const comingSoon = visible.filter(s => s.status === 'coming-soon');
  return `${PASS320_SETTINGS_PARITY_PASS} ${SETTINGS_PARITY_CONTRACT_ID}: sections=${visible.length}; implemented=${implemented.length}; partial=${partial.length}; comingSoon=${comingSoon.length}`;
}
