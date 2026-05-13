export const PASS190_OVERLAY_STATE_MACHINE_VERSION = 'PASS190' as const;

export type Pass190OverlayOwner =
  | 'more-tools'
  | 'command-toolbar'
  | 'ops-hub'
  | 'site-view'
  | 'mission-control'
  | 'settings'
  | 'command-palette'
  | 'profile-dialog'
  | 'shortcut-dialog';

export type Pass190OverlayTransitionState = 'opening' | 'open' | 'closing' | 'closed';

export type Pass190OverlayTransition = {
  owner: Pass190OverlayOwner;
  state: Pass190OverlayTransitionState;
  reason: string;
  restoreFocus: boolean;
};

export const PASS190_OVERLAY_OWNERS: readonly Pass190OverlayOwner[] = [
  'more-tools',
  'command-toolbar',
  'ops-hub',
  'site-view',
  'mission-control',
  'settings',
  'command-palette',
  'profile-dialog',
  'shortcut-dialog'
];

export const PASS190_OVERLAY_STATE_MACHINE_RULES = [
  'exactly-one-active-owner',
  'owned-open-closes-rival-overlays',
  'owned-close-clears-only-active-owner',
  'escape-closes-active-owner',
  'restore-focus-target-is-validated',
  'hidden-overlays-cannot-intercept-pointer-events',
  'overlay-viewport-audit-runs-after-owner-change'
] as const;

export function pass190OverlayStateMachineSummary(): string {
  return [
    `${PASS190_OVERLAY_STATE_MACHINE_VERSION}: overlay owner machine covers ${PASS190_OVERLAY_OWNERS.length} shell surfaces`,
    `rules=${PASS190_OVERLAY_STATE_MACHINE_RULES.join(',')}`
  ].join(' | ');
}
