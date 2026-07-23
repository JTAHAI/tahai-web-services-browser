/**
 * PASS319 — Configurable Toolbar / Surface Visibility
 *
 * Shared contract for per-profile toolbar and surface visibility configuration.
 * Controls which UI elements appear, which buttons show in the toolbar,
 * and how Command Center reacts to hidden/disabled surfaces.
 */

import type { BrowserProfileUxConfig, VisibleSurface, EnabledToolGroup } from './browser-profile-ux-model';
import { isSurfaceVisible, isToolGroupEnabled, isProfileFieldLocked } from './browser-profile-ux-model';

export const PASS319_CONFIGURABLE_TOOLBAR_PASS = 'PASS319';
export const CONFIGURABLE_TOOLBAR_CONTRACT_ID = 'configurable-toolbar-surface-visibility-v1';

// ─── Toolbar Button Visibility ────────────────────────────────────────────────

export type ToolbarButtonId =
  | 'back'
  | 'forward'
  | 'reload'
  | 'home'
  | 'address-bar'
  | 'new-tab'
  | 'ops-mode'
  | 'mission-control'
  | 'mission-recipes'
  | 'admin-console-profiles'
  | 'it-tools'
  | 'devops-tools'
  | 'evidence-pack'
  | 'downloads'
  | 'bookmarks'
  | 'command-center'
  | 'more-tools';

export type ToolbarButtonState = {
  id: ToolbarButtonId;
  visible: boolean;
  enabled: boolean;
  disabledReason: string;
  lockedByPolicy: boolean;
};

/** Core navigation buttons always visible regardless of profile. */
const ALWAYS_VISIBLE_BUTTONS = new Set<ToolbarButtonId>(['back', 'forward', 'reload', 'home', 'address-bar', 'new-tab', 'command-center', 'more-tools']);

/**
 * Compute toolbar button states for the active profile config.
 * Core navigation is never hidden. Operator buttons respect profile visibility.
 */
export function computeToolbarButtonStates(config: BrowserProfileUxConfig): ToolbarButtonState[] {
  function btn(id: ToolbarButtonId, surface: VisibleSurface | null, toolGroup: EnabledToolGroup | null, policyField: string | null): ToolbarButtonState {
    const alwaysOn = ALWAYS_VISIBLE_BUTTONS.has(id);
    const surfaceVisible = surface === null || isSurfaceVisible(config, surface);
    const groupEnabled = toolGroup === null || isToolGroupEnabled(config, toolGroup);
    const locked = policyField !== null && isProfileFieldLocked(config, policyField);
    const visible = alwaysOn || (surfaceVisible && groupEnabled);
    const disabledReason = !visible
      ? locked
        ? `Disabled by enterprise policy`
        : `Hidden by profile setting (${config.profileKind})`
      : '';
    return { id, visible, enabled: visible, disabledReason, lockedByPolicy: locked };
  }

  return [
    btn('back', null, null, null),
    btn('forward', null, null, null),
    btn('reload', null, null, null),
    btn('home', 'home', 'browsing', null),
    btn('address-bar', null, null, null),
    btn('new-tab', 'daily-driver-new-tab', 'browsing', null),
    btn('ops-mode', 'ops-mode', 'mission', 'missionControlEnabled'),
    btn('mission-control', 'mission-control', 'mission', 'missionControlEnabled'),
    btn('mission-recipes', 'mission-recipes', 'mission', 'missionControlEnabled'),
    btn('admin-console-profiles', 'admin-console-profiles', 'it-admin', 'adminProfilesEnabled'),
    btn('it-tools', 'it-tools', 'it-admin', 'itToolsEnabled'),
    btn('devops-tools', 'devops-tools', 'devops', 'devOpsToolsEnabled'),
    btn('evidence-pack', 'evidence-pack', 'evidence', 'evidenceEnabled'),
    btn('downloads', 'downloads', 'downloads', null),
    btn('bookmarks', 'bookmarks', 'bookmarks', null),
    btn('command-center', 'command-center', null, null),
    btn('more-tools', null, null, null),
  ];
}

/**
 * Returns the reason a surface is hidden, or empty string if visible.
 */
export function surfaceHiddenReason(config: BrowserProfileUxConfig, surface: VisibleSurface): string {
  if (isSurfaceVisible(config, surface)) return '';
  if (isProfileFieldLocked(config, 'visibleSurfaces')) return 'Disabled by enterprise policy';
  return `Hidden by ${config.profileKind === 'personal' ? 'Personal Daily Driver' : config.profileKind} profile`;
}

/**
 * Keyboard shortcut disabled reason for a hidden surface.
 */
export function shortcutDisabledReason(config: BrowserProfileUxConfig, surface: VisibleSurface): string {
  const reason = surfaceHiddenReason(config, surface);
  if (!reason) return '';
  return `${reason}. Enable it in Settings → UI Customization.`;
}

/**
 * CSS class names to apply to the app shell based on profile config.
 * These classes control which surface containers appear/disappear.
 */
export function profileUxCssClasses(config: BrowserProfileUxConfig): string[] {
  const classes: string[] = [];
  classes.push(`profile-kind-${config.profileKind}`);
  classes.push(`toolbar-${config.toolbarLayout}`);
  if (!config.missionControlEnabled) classes.push('mission-hidden');
  if (!config.evidenceEnabled) classes.push('evidence-hidden');
  if (!config.runbookEnabled) classes.push('runbook-hidden');
  if (!config.adminProfilesEnabled) classes.push('admin-profiles-hidden');
  if (!config.devOpsToolsEnabled) classes.push('devops-hidden');
  if (!config.itToolsEnabled) classes.push('it-tools-hidden');
  if (!config.downloadsShelfEnabled) classes.push('downloads-shelf-hidden');
  if (!config.supportBundleEnabled) classes.push('support-bundle-hidden');
  if (!isSurfaceVisible(config, 'ops-mode')) classes.push('ops-mode-hidden');
  if (config.defaultMode === 'daily-driver') classes.push('daily-driver-mode');
  if (config.defaultMode === 'ops-mode') classes.push('ops-mode-default');
  return classes;
}

// ─── Profile UI Customization Settings ───────────────────────────────────────

export type ProfileUiCustomizationSettings = {
  profileKind: BrowserProfileUxConfig['profileKind'];
  defaultMode: BrowserProfileUxConfig['defaultMode'];
  toolbarLayout: BrowserProfileUxConfig['toolbarLayout'];
  newTabLayout: BrowserProfileUxConfig['newTabLayout'];
  missionControlEnabled: boolean;
  evidenceEnabled: boolean;
  runbookEnabled: boolean;
  adminProfilesEnabled: boolean;
  devOpsToolsEnabled: boolean;
  itToolsEnabled: boolean;
  downloadsShelfEnabled: boolean;
  supportBundleEnabled: boolean;
  visibleSurfaces: VisibleSurface[];
  enabledToolGroups: EnabledToolGroup[];
  commandCenterCategories: BrowserProfileUxConfig['commandCenterCategories'];
};

export function profileUiCustomizationFromConfig(config: BrowserProfileUxConfig): ProfileUiCustomizationSettings {
  return {
    profileKind: config.profileKind,
    defaultMode: config.defaultMode,
    toolbarLayout: config.toolbarLayout,
    newTabLayout: config.newTabLayout,
    missionControlEnabled: config.missionControlEnabled,
    evidenceEnabled: config.evidenceEnabled,
    runbookEnabled: config.runbookEnabled,
    adminProfilesEnabled: config.adminProfilesEnabled,
    devOpsToolsEnabled: config.devOpsToolsEnabled,
    itToolsEnabled: config.itToolsEnabled,
    downloadsShelfEnabled: config.downloadsShelfEnabled,
    supportBundleEnabled: config.supportBundleEnabled,
    visibleSurfaces: config.visibleSurfaces,
    enabledToolGroups: config.enabledToolGroups,
    commandCenterCategories: config.commandCenterCategories,
  };
}

export function configureToolbarSurfaceVisibilitySummary(config: BrowserProfileUxConfig): string {
  const btns = computeToolbarButtonStates(config);
  const visible = btns.filter(b => b.visible).map(b => b.id);
  const hidden = btns.filter(b => !b.visible).map(b => b.id);
  return `${PASS319_CONFIGURABLE_TOOLBAR_PASS} ${CONFIGURABLE_TOOLBAR_CONTRACT_ID}: kind=${config.profileKind}; visibleButtons=${visible.length}; hiddenButtons=${hidden.length}; hiddenSurfaces=${hidden.join(',')}`;
}
