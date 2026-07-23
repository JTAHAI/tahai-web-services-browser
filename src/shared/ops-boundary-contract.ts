/**
 * PASS322 — Ops Mode Boundary + Daily Driver Cleanliness
 *
 * Hard-separates Daily Driver from Ops Mode.
 * Defines the boundary contract that prevents mission overlays, drag zones,
 * and pane controls from existing over normal browsing when disabled.
 */

import type { BrowserProfileUxConfig } from './browser-profile-ux-model';
import { isSurfaceVisible } from './browser-profile-ux-model';

export const PASS322_OPS_BOUNDARY_PASS = 'PASS322';
export const OPS_BOUNDARY_CONTRACT_ID = 'ops-boundary-daily-driver-cleanliness-v1';

// ─── Ops Boundary State ───────────────────────────────────────────────────────

export type OpsBoundaryState = {
  opsModeAvailable: boolean;
  opsModeButtonVisible: boolean;
  missionOverlaysPermitted: boolean;
  missionDragZonesPermitted: boolean;
  missionPaneControlsPermitted: boolean;
  runbookRailPermitted: boolean;
  evidenceRailPermitted: boolean;
  missionTimelinePermitted: boolean;
  /** CSS classes that must be applied to the app shell to enforce boundary. */
  requiredCssClasses: string[];
  /** DOM attributes to set on the app shell. */
  requiredDomAttribs: Record<string, string>;
  /** Reason why Ops Mode is disabled in this profile. */
  opsDisabledReason: string;
};

export function computeOpsBoundaryState(config: BrowserProfileUxConfig): OpsBoundaryState {
  const opsModeAvailable = config.missionControlEnabled && isSurfaceVisible(config, 'ops-mode');
  const opsModeButtonVisible = isSurfaceVisible(config, 'ops-mode');
  const missionOverlaysPermitted = config.missionControlEnabled;
  const missionDragZonesPermitted = config.missionControlEnabled;
  const missionPaneControlsPermitted = config.missionControlEnabled;
  const runbookRailPermitted = config.runbookEnabled;
  const evidenceRailPermitted = config.evidenceEnabled;
  const missionTimelinePermitted = config.missionControlEnabled;

  const requiredCssClasses: string[] = [];
  if (!opsModeAvailable) {
    requiredCssClasses.push('ops-mode-suppressed');
    requiredCssClasses.push('mission-overlays-suppressed');
  }
  if (!missionDragZonesPermitted) requiredCssClasses.push('mission-drag-zones-suppressed');
  if (!runbookRailPermitted) requiredCssClasses.push('runbook-rail-suppressed');
  if (!evidenceRailPermitted) requiredCssClasses.push('evidence-rail-suppressed');
  if (!missionTimelinePermitted) requiredCssClasses.push('mission-timeline-suppressed');
  if (config.defaultMode === 'daily-driver') requiredCssClasses.push('daily-driver-active');

  const requiredDomAttribs: Record<string, string> = {
    'data-profile-kind': config.profileKind,
    'data-default-mode': config.defaultMode,
    'data-ops-available': opsModeAvailable ? '1' : '0',
    'data-mission-permitted': missionOverlaysPermitted ? '1' : '0',
  };

  const opsDisabledReason = !opsModeAvailable
    ? config.profileKind === 'personal' || config.profileKind === 'minimal-privacy'
      ? 'Ops Mode is hidden in this profile. Switch to IT Admin, DevOps, or MSP profile to enable it.'
      : 'Ops Mode is disabled by profile settings.'
    : '';

  return {
    opsModeAvailable,
    opsModeButtonVisible,
    missionOverlaysPermitted,
    missionDragZonesPermitted,
    missionPaneControlsPermitted,
    runbookRailPermitted,
    evidenceRailPermitted,
    missionTimelinePermitted,
    requiredCssClasses,
    requiredDomAttribs,
    opsDisabledReason,
  };
}

/**
 * Check for stale ops-mode state in the DOM after a profile switch.
 * Returns a list of CSS classes that should NOT be present.
 */
export function detectStaleOpsClasses(domClassList: string[], config: BrowserProfileUxConfig): string[] {
  const boundary = computeOpsBoundaryState(config);
  const stale: string[] = [];

  if (!boundary.opsModeAvailable) {
    // These classes must not appear when ops mode is suppressed
    const forbidden = ['mission-active', 'ops-mode-open', 'mission-overlay-visible', 'runbook-open', 'evidence-open'];
    for (const cls of forbidden) {
      if (domClassList.includes(cls)) stale.push(cls);
    }
  }
  return stale;
}

export function opsBoundarySummary(config: BrowserProfileUxConfig): string {
  const state = computeOpsBoundaryState(config);
  return `${PASS322_OPS_BOUNDARY_PASS} ${OPS_BOUNDARY_CONTRACT_ID}: kind=${config.profileKind}; opsAvailable=${state.opsModeAvailable}; missionPermitted=${state.missionOverlaysPermitted}; runbook=${state.runbookRailPermitted}; evidence=${state.evidenceRailPermitted}`;
}
