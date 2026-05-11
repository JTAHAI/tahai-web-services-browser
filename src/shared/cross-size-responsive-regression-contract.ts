import { TAHAI_PRODUCT_NAME, TAHAI_RELEASE_VERSION } from './release-truth';

export const CROSS_SIZE_RESPONSIVE_REGRESSION_PASS = 'PASS148' as const;
export const CROSS_SIZE_RESPONSIVE_REGRESSION_VERSION = TAHAI_RELEASE_VERSION;
export const CROSS_SIZE_RESPONSIVE_REGRESSION_PRODUCT = TAHAI_PRODUCT_NAME;
export const CROSS_SIZE_RESPONSIVE_REGRESSION_OUTPUT_DIR = 'artifacts/cross-size-responsive-regression' as const;

export type ResponsivePlatform = 'windows' | 'linux' | 'unknown';

export type ResponsiveViewportId =
  | 'compact-960x640'
  | 'small-1024x768'
  | 'laptop-1366x768'
  | 'desktop-1920x1080'
  | 'wide-2560x1440';

export type ResponsiveRegressionChecklistId =
  | 'normal-browser-first-paint'
  | 'titlebar-tabs-chrome-stack'
  | 'guide-kb-discoverable'
  | 'more-tools-overflow-reachable'
  | 'mission-control-opens-at-size'
  | 'mission-control-overlay-no-collision'
  | 'two-up-entry-recovery'
  | 'triview-entry-recovery'
  | 'quad-entry-recovery'
  | 'focus-pane-restore'
  | 'pane-move-and-drop-targets'
  | 'active-pane-visible-and-routed'
  | 'address-bar-reload-back-forward-target-active-pane'
  | 'command-center-available'
  | 'runbook-rail-usable'
  | 'evidence-export-redaction-accessible'
  | 'devtools-still-available'
  | 'no-critical-scroll-trap-or-cutoff'
  | 'no-unhandled-renderer-errors';

export type ResponsiveViewport = {
  id: ResponsiveViewportId;
  width: number;
  height: number;
  label: string;
  reason: string;
};

export type ResponsiveRegressionChecklistItem = {
  id: ResponsiveRegressionChecklistId;
  label: string;
  evidenceRequired: string;
  passCondition: string;
  appliesTo: readonly ResponsiveViewportId[] | 'all';
};

export const CROSS_SIZE_RESPONSIVE_VIEWPORTS: readonly ResponsiveViewport[] = [
  {
    id: 'compact-960x640',
    width: 960,
    height: 640,
    label: 'Compact constrained window',
    reason: 'Catches Guide/More Tools overflow, Mission Control entry, overlay collision, and cut-off command surfaces.',
  },
  {
    id: 'small-1024x768',
    width: 1024,
    height: 768,
    label: 'Small enterprise laptop / VM window',
    reason: 'Catches the historical failure where Mission Control would not open or would overlap at smaller windows.',
  },
  {
    id: 'laptop-1366x768',
    width: 1366,
    height: 768,
    label: 'Common laptop baseline',
    reason: 'Confirms clean normal browsing, titlebar tabs, Guide/KB, More Tools, and Mission entry without needing a large monitor.',
  },
  {
    id: 'desktop-1920x1080',
    width: 1920,
    height: 1080,
    label: 'Standard desktop monitor',
    reason: 'Confirms the primary enterprise desktop target for 2-Up, Tri-view, Quad, active pane routing, and Runbook Rail.',
  },
  {
    id: 'wide-2560x1440',
    width: 2560,
    height: 1440,
    label: 'Large monitor / builder workstation',
    reason: 'Confirms TAHAI command-browser differentiation on large DevOps/IT displays without stretching or losing pane focus.',
  },
] as const;

export const CROSS_SIZE_RESPONSIVE_CHECKLIST: readonly ResponsiveRegressionChecklistItem[] = [
  {
    id: 'normal-browser-first-paint',
    label: 'Normal browser first paint remains clean',
    evidenceRequired: 'Capture screenshot or note showing first paint at each viewport without hidden mandatory controls or broken chrome.',
    passCondition: 'Normal mode loads with usable address bar, tabs, command surfaces, and no visible broken layout.',
    appliesTo: 'all',
  },
  {
    id: 'titlebar-tabs-chrome-stack',
    label: 'Titlebar tabs/chrome stack remains compact',
    evidenceRequired: 'Record whether tabs remain in the effective titlebar/chrome area and whether vertical chrome stack is excessive.',
    passCondition: 'No extra toolbar tier consumes critical viewport height or hides browser controls.',
    appliesTo: 'all',
  },
  {
    id: 'guide-kb-discoverable',
    label: 'Guide/KB remains discoverable at every size',
    evidenceRequired: 'Record the visible entry path: primary nav, More Tools, keyboard/command center, or onboarding link.',
    passCondition: 'Guide/KB can be opened without resizing the window or guessing hidden controls.',
    appliesTo: 'all',
  },
  {
    id: 'more-tools-overflow-reachable',
    label: 'More Tools overflow remains reachable when Guide moves',
    evidenceRequired: 'At constrained sizes, record that More Tools opens and Guide/KB remains listed with usable focus/escape behavior.',
    passCondition: 'Guide moving into More Tools does not make it disappear or trap focus.',
    appliesTo: ['compact-960x640', 'small-1024x768', 'laptop-1366x768'],
  },
  {
    id: 'mission-control-opens-at-size',
    label: 'Mission Control opens at constrained and desktop sizes',
    evidenceRequired: 'Record entry method and screenshot/note for Mission Control launch at each viewport.',
    passCondition: 'Mission Control opens cleanly at 960x640 and larger, even if layout options are adaptively simplified.',
    appliesTo: 'all',
  },
  {
    id: 'mission-control-overlay-no-collision',
    label: 'Mission overlays avoid collision with top chrome and panes',
    evidenceRequired: 'Record Mission overlay bounds, visible close/back controls, and whether panes are obscured.',
    passCondition: 'No critical Mission or pane control is hidden behind titlebar, tabs, toolbars, or viewport edges.',
    appliesTo: 'all',
  },
  {
    id: 'two-up-entry-recovery',
    label: '2-Up entry and recovery are deterministic',
    evidenceRequired: 'Record entry path, active pane, recovery path back to 1-Up, and whether content survives the transition.',
    passCondition: '2-Up opens and exits without blank panes, layout overlap, or lost active context.',
    appliesTo: ['small-1024x768', 'laptop-1366x768', 'desktop-1920x1080', 'wide-2560x1440'],
  },
  {
    id: 'triview-entry-recovery',
    label: 'Tri-view entry/recovery is usable and not hidden',
    evidenceRequired: 'Record all available Tri-view entry methods and recovery path at supported viewport sizes.',
    passCondition: 'Tri-view opens with visible panes and a clear recovery path; constrained windows may adapt but must not corrupt layout.',
    appliesTo: ['laptop-1366x768', 'desktop-1920x1080', 'wide-2560x1440'],
  },
  {
    id: 'quad-entry-recovery',
    label: 'Quad entry/recovery is usable and not hidden',
    evidenceRequired: 'Record Quad entry method, pane labels/focus marker, and recovery path at desktop/large monitor sizes.',
    passCondition: 'Quad opens with four visible pane shells at supported sizes and can return to a sane layout.',
    appliesTo: ['desktop-1920x1080', 'wide-2560x1440'],
  },
  {
    id: 'focus-pane-restore',
    label: 'Focus Pane restores the prior layout',
    evidenceRequired: 'Record focused pane id, restored layout type, and whether previous pane content remains assigned.',
    passCondition: 'Focus toggles restore the exact prior layout without swapping panes or losing content.',
    appliesTo: ['laptop-1366x768', 'desktop-1920x1080', 'wide-2560x1440'],
  },
  {
    id: 'pane-move-and-drop-targets',
    label: 'Pane move/drag/drop targets remain visible and reversible',
    evidenceRequired: 'Record drag/drop or move command result, target pane, and recovery outcome.',
    passCondition: 'Pane move does not unexpectedly fall back to split view or hide destination panes.',
    appliesTo: ['desktop-1920x1080', 'wide-2560x1440'],
  },
  {
    id: 'active-pane-visible-and-routed',
    label: 'Active pane marker is visible and routing target is obvious',
    evidenceRequired: 'Record visible focus marker and active pane id before using navigation controls.',
    passCondition: 'Operator can identify the active pane before address-bar, reload, back, forward, command, or capture actions.',
    appliesTo: 'all',
  },
  {
    id: 'address-bar-reload-back-forward-target-active-pane',
    label: 'Address bar/reload/back/forward target the active pane',
    evidenceRequired: 'Record navigation action, active pane before action, and result pane after action.',
    passCondition: 'Navigation controls target the active pane/tab only and safely no-op when history is unavailable.',
    appliesTo: ['small-1024x768', 'laptop-1366x768', 'desktop-1920x1080', 'wide-2560x1440'],
  },
  {
    id: 'command-center-available',
    label: 'Command Center remains reachable',
    evidenceRequired: 'Record Ctrl+K/menu entry, focus result, and whether commands show disabled reasons where needed.',
    passCondition: 'Command Center opens without overlay collision and does not obscure mandatory recovery controls.',
    appliesTo: 'all',
  },
  {
    id: 'runbook-rail-usable',
    label: 'Runbook Rail remains usable without trapping scroll',
    evidenceRequired: 'Record rail open/close, checklist/notes visibility, and scroll behavior at constrained and desktop sizes.',
    passCondition: 'Runbook Rail does not trap scroll, hide close controls, or make panes unreachable.',
    appliesTo: ['small-1024x768', 'laptop-1366x768', 'desktop-1920x1080', 'wide-2560x1440'],
  },
  {
    id: 'evidence-export-redaction-accessible',
    label: 'Evidence export redaction remains accessible',
    evidenceRequired: 'Record export/redaction entry path and confirm sanitized handoff path is visible.',
    passCondition: 'Operator can reach redaction/export controls from Mission workflow without exposing secrets.',
    appliesTo: ['laptop-1366x768', 'desktop-1920x1080', 'wide-2560x1440'],
  },
  {
    id: 'devtools-still-available',
    label: 'Chromium DevTools remains available',
    evidenceRequired: 'Record F12/menu result while normal and Mission views are in use.',
    passCondition: 'Builder/operator diagnostics remain available and do not break Mission layout recovery.',
    appliesTo: ['laptop-1366x768', 'desktop-1920x1080', 'wide-2560x1440'],
  },
  {
    id: 'no-critical-scroll-trap-or-cutoff',
    label: 'No critical scroll trap or cut-off controls',
    evidenceRequired: 'Record any vertical/horizontal scrollbars, clipped controls, and escape/back behavior.',
    passCondition: 'No critical workflow requires unreachable controls, hidden panes, or impossible scrolling.',
    appliesTo: 'all',
  },
  {
    id: 'no-unhandled-renderer-errors',
    label: 'No obvious renderer crash loops or unhandled errors',
    evidenceRequired: 'Record console/log observation without secrets or customer data.',
    passCondition: 'No repeated unhandled promise rejection, renderer crash, missing critical resource loop, or layout exception is observed.',
    appliesTo: 'all',
  },
] as const;

export const CROSS_SIZE_RESPONSIVE_REQUIRED_DOC_TOKENS = [
  'PASS148',
  'Cross-size/responsive/manual regression checklist',
  'responsive regression evidence runner',
  '960x640',
  '1024x768',
  '1366x768',
  '1920x1080',
  '2560x1440',
  'Guide/KB',
  'More Tools',
  'Mission Control',
  '2-Up',
  'Tri-view',
  'Quad',
  'Focus Pane',
  'active-pane routing',
  'Runbook Rail',
  'Evidence export redaction',
  'DevTools',
  'Do not include secrets',
  'No claim of manual responsive success',
] as const;
