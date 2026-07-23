/**
 * PASS341 — Serious Settings Runtime Completion
 *
 * Settings contract for all sections.
 * Every control is either working, honestly disabled, or marked coming-soon.
 * No dead controls. No stale pass chatter. No unsupported ADMX/Store/signing claims.
 */

export const PASS341_SETTINGS_PASS = 'PASS341';
export const SERIOUS_SETTINGS_CONTRACT_ID = 'serious-settings-runtime-completion-v1';

export type SettingsControlStatus = 'implemented' | 'coming-soon' | 'blocked';

export type SettingsControlDef = {
  id: string;
  label: string;
  type: 'toggle' | 'select' | 'text' | 'button' | 'range' | 'display';
  status: SettingsControlStatus;
  section: string;
  blockedReason?: string;
  comingSoonNote?: string;
};

export const SETTINGS_CONTROLS: SettingsControlDef[] = [
  // Profiles
  { id: 'profile-switcher', label: 'Profile Switcher', type: 'button', status: 'implemented', section: 'profiles' },
  { id: 'new-profile', label: 'Create New Profile', type: 'button', status: 'implemented', section: 'profiles' },
  { id: 'delete-profile', label: 'Delete Profile', type: 'button', status: 'implemented', section: 'profiles' },
  { id: 'rename-profile', label: 'Rename Profile', type: 'button', status: 'implemented', section: 'profiles' },
  { id: 'profile-kind', label: 'Profile Kind / Preset', type: 'select', status: 'implemented', section: 'profiles' },
  { id: 'profile-color', label: 'Profile Color', type: 'text', status: 'implemented', section: 'profiles' },
  { id: 'switch-profile', label: 'Switch Active Profile', type: 'button', status: 'implemented', section: 'profiles' },
  { id: 'clear-profile-data', label: 'Clear Profile Data', type: 'button', status: 'implemented', section: 'profiles' },
  // UI Customization
  { id: 'default-mode', label: 'Default Startup Mode', type: 'select', status: 'implemented', section: 'ui-customization' },
  { id: 'toolbar-density', label: 'Toolbar Density', type: 'select', status: 'implemented', section: 'ui-customization' },
  { id: 'new-tab-layout', label: 'New Tab Layout', type: 'select', status: 'implemented', section: 'ui-customization' },
  { id: 'surface-visibility', label: 'Show/Hide Surfaces', type: 'toggle', status: 'implemented', section: 'ui-customization' },
  { id: 'bookmarks-bar', label: 'Bookmarks Bar Visibility', type: 'toggle', status: 'implemented', section: 'ui-customization' },
  { id: 'downloads-shelf', label: 'Downloads Shelf Visibility', type: 'toggle', status: 'implemented', section: 'ui-customization' },
  // Search Engine
  { id: 'search-engine', label: 'Default Search Engine', type: 'select', status: 'implemented', section: 'search-engine' },
  // Startup
  { id: 'startup-mode', label: 'Startup Behavior', type: 'select', status: 'implemented', section: 'startup' },
  { id: 'home-url', label: 'Home Page / New Tab URL', type: 'text', status: 'implemented', section: 'startup' },
  // Appearance
  { id: 'surface-mode', label: 'Surface Mode (Daily Driver / Workbench)', type: 'select', status: 'implemented', section: 'appearance' },
  { id: 'show-workbench-tools', label: 'Show Workbench Tools', type: 'toggle', status: 'implemented', section: 'appearance' },
  { id: 'status-bar', label: 'Show Status Bar', type: 'toggle', status: 'implemented', section: 'appearance' },
  { id: 'default-zoom', label: 'Default Zoom Level', type: 'range', status: 'implemented', section: 'appearance' },
  { id: 'launch-maximized', label: 'Launch Maximized', type: 'toggle', status: 'implemented', section: 'appearance' },
  { id: 'theme', label: 'Theme (Light/Dark)', type: 'select', status: 'coming-soon', comingSoonNote: 'Light theme not yet implemented. Dark theme is the current default.', section: 'appearance' },
  // Tabs
  { id: 'confirm-close-multi-tab', label: 'Confirm Before Closing Multiple Tabs', type: 'toggle', status: 'implemented', section: 'tabs' },
  { id: 'popups-as-tabs', label: 'Open Popups as Tabs', type: 'toggle', status: 'implemented', section: 'tabs' },
  { id: 'open-external-in-tab', label: 'Open External Links in New Tab', type: 'toggle', status: 'implemented', section: 'tabs' },
  // Privacy and Security
  { id: 'do-not-track', label: 'Send Do Not Track Request', type: 'toggle', status: 'implemented', section: 'privacy-security' },
  { id: 'block-third-party-cookies', label: 'Block Third-Party Cookies', type: 'toggle', status: 'implemented', section: 'privacy-security' },
  { id: 'reduce-referrers', label: 'Reduce Cross-Site Referrers', type: 'toggle', status: 'implemented', section: 'privacy-security' },
  { id: 'clear-on-exit', label: 'Clear Profile Data on Exit', type: 'toggle', status: 'implemented', section: 'privacy-security' },
  { id: 'clear-browsing-data', label: 'Clear Browsing Data', type: 'button', status: 'implemented', section: 'privacy-security' },
  // Site Permissions
  { id: 'allow-media', label: 'Camera / Microphone', type: 'toggle', status: 'implemented', section: 'site-permissions' },
  { id: 'allow-clipboard', label: 'Clipboard Read', type: 'toggle', status: 'implemented', section: 'site-permissions' },
  { id: 'allow-geolocation', label: 'Geolocation', type: 'toggle', status: 'implemented', section: 'site-permissions' },
  { id: 'allow-notifications', label: 'Notifications', type: 'toggle', status: 'implemented', section: 'site-permissions' },
  // Downloads
  { id: 'downloads-ask', label: 'Ask Where to Save Downloads', type: 'toggle', status: 'implemented', section: 'downloads' },
  { id: 'downloads-directory', label: 'Download Directory', type: 'button', status: 'implemented', section: 'downloads' },
  { id: 'block-insecure-downloads', label: 'Block Insecure Downloads', type: 'toggle', status: 'implemented', section: 'downloads' },
  // Languages
  { id: 'spell-check', label: 'Spell Check', type: 'display', status: 'coming-soon', comingSoonNote: 'Spell check configuration not yet implemented.', section: 'languages' },
  // Accessibility
  { id: 'zoom', label: 'Zoom Level', type: 'range', status: 'implemented', section: 'accessibility' },
  // System / Performance
  { id: 'hardware-acceleration', label: 'Hardware Acceleration', type: 'display', status: 'coming-soon', comingSoonNote: 'GPU/hardware acceleration toggle not yet exposed.', section: 'system-performance' },
  // Keyboard Shortcuts
  { id: 'keyboard-shortcuts', label: 'View Keyboard Shortcuts', type: 'button', status: 'implemented', section: 'keyboard-shortcuts' },
  // Reset Settings
  { id: 'reset-settings', label: 'Reset Settings to Defaults', type: 'button', status: 'implemented', section: 'reset-settings' },
  // About
  { id: 'version-display', label: 'Version / Build / Release Pass', type: 'display', status: 'implemented', section: 'about' },
  { id: 'release-channel', label: 'Release Channel', type: 'display', status: 'implemented', section: 'about' },
  { id: 'signing-status', label: 'Signing Status', type: 'display', status: 'implemented', section: 'about' },
  { id: 'update-channel', label: 'Update Channel / Policy', type: 'display', status: 'implemented', section: 'about' },
  { id: 'open-user-data', label: 'Open User Data Folder', type: 'button', status: 'implemented', section: 'about' },
  { id: 'import-settings', label: 'Import Settings File', type: 'button', status: 'implemented', section: 'about' },
  { id: 'export-settings', label: 'Export Settings File', type: 'button', status: 'implemented', section: 'about' },
  // Enterprise Policy
  { id: 'policy-source', label: 'Policy Source', type: 'display', status: 'implemented', section: 'enterprise-policy' },
  { id: 'policy-locks', label: 'Locked Fields', type: 'display', status: 'implemented', section: 'enterprise-policy' },
  { id: 'admx-note', label: 'ADMX Note', type: 'display', status: 'implemented', section: 'enterprise-policy' },
  // Ops / Mission Control
  { id: 'ops-mode-availability', label: 'Ops Mode Availability', type: 'toggle', status: 'implemented', section: 'ops-mission-control' },
  { id: 'mission-control', label: 'Mission Control Surface', type: 'toggle', status: 'implemented', section: 'ops-mission-control' },
  { id: 'evidence-pack', label: 'Evidence Pack Surface', type: 'toggle', status: 'implemented', section: 'ops-mission-control' },
  { id: 'runbook-rail', label: 'Runbook Rail Surface', type: 'toggle', status: 'implemented', section: 'ops-mission-control' },
];

export function settingsControlsForSection(section: string): SettingsControlDef[] {
  return SETTINGS_CONTROLS.filter(c => c.section === section);
}

export function seriousSettingsSummary(): string {
  const impl = SETTINGS_CONTROLS.filter(c => c.status === 'implemented').length;
  const cs = SETTINGS_CONTROLS.filter(c => c.status === 'coming-soon').length;
  const blocked = SETTINGS_CONTROLS.filter(c => c.status === 'blocked').length;
  return `${PASS341_SETTINGS_PASS} ${SERIOUS_SETTINGS_CONTRACT_ID}: controls=${SETTINGS_CONTROLS.length}; implemented=${impl}; comingSoon=${cs}; blocked=${blocked}`;
}
