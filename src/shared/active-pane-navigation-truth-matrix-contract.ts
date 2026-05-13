export const PASS187_ACTIVE_PANE_NAVIGATION_TRUTH_MATRIX_VERSION = 'pass187-active-pane-navigation-truth-matrix-v1';

export type Pass187NavigationInputSource =
  | 'toolbar-back'
  | 'toolbar-forward'
  | 'toolbar-reload'
  | 'address-submit'
  | 'mouse-button-4'
  | 'mouse-button-5'
  | 'alt-left'
  | 'alt-right'
  | 'menu-back'
  | 'menu-forward'
  | 'command-center'
  | 'launchpad'
  | 'guide'
  | 'home'
  | 'devtools'
  | 'print'
  | 'scheduled-diagnostic';

export type Pass187ResolvedNavigationTarget =
  | 'active-tab'
  | 'mission-active-pane'
  | 'safe-noop';

export type Pass187NavigationTruthReason =
  | 'normal-active-tab'
  | 'active-pane-visible-tab'
  | 'active-pane-empty-fallback-detected'
  | 'hidden-pane-repaired'
  | 'history-available'
  | 'history-unavailable'
  | 'no-target-available'
  | 'address-targeted'
  | 'reload-targeted'
  | 'print-targeted'
  | 'devtools-targeted'
  | 'command-targeted'
  | 'safe-noop';

export type Pass187NavigationTruthField =
  | 'eventId'
  | 'source'
  | 'intent'
  | 'targetKind'
  | 'targetPaneId'
  | 'targetTabId'
  | 'targetTitle'
  | 'targetUrl'
  | 'canGoBack'
  | 'canGoForward'
  | 'reason'
  | 'noOpReason'
  | 'createdAt';

export type Pass187NavigationTruthCase = {
  readonly id: string;
  readonly source: Pass187NavigationInputSource;
  readonly expectedTarget: Pass187ResolvedNavigationTarget;
  readonly requiredFields: readonly Pass187NavigationTruthField[];
  readonly enterpriseReason: string;
};

export const PASS187_REQUIRED_NAVIGATION_TRUTH_FIELDS: readonly Pass187NavigationTruthField[] = [
  'eventId',
  'source',
  'intent',
  'targetKind',
  'targetPaneId',
  'targetTabId',
  'targetTitle',
  'targetUrl',
  'canGoBack',
  'canGoForward',
  'reason',
  'noOpReason',
  'createdAt'
] as const;

export const PASS187_NAVIGATION_TRUTH_MATRIX: readonly Pass187NavigationTruthCase[] = [
  {
    id: 'pass187-toolbar-back-target-truth',
    source: 'toolbar-back',
    expectedTarget: 'mission-active-pane',
    requiredFields: PASS187_REQUIRED_NAVIGATION_TRUTH_FIELDS,
    enterpriseReason: 'Toolbar Back must prove the active Mission pane or active tab target before invoking history.'
  },
  {
    id: 'pass187-toolbar-forward-target-truth',
    source: 'toolbar-forward',
    expectedTarget: 'mission-active-pane',
    requiredFields: PASS187_REQUIRED_NAVIGATION_TRUTH_FIELDS,
    enterpriseReason: 'Toolbar Forward must prove the same resolved target model as Mouse Button 5 and Alt+Right.'
  },
  {
    id: 'pass187-toolbar-reload-target-truth',
    source: 'toolbar-reload',
    expectedTarget: 'mission-active-pane',
    requiredFields: PASS187_REQUIRED_NAVIGATION_TRUTH_FIELDS,
    enterpriseReason: 'Reload must never refresh a background tab when Mission Control has a visible active pane.'
  },
  {
    id: 'pass187-address-submit-target-truth',
    source: 'address-submit',
    expectedTarget: 'mission-active-pane',
    requiredFields: PASS187_REQUIRED_NAVIGATION_TRUTH_FIELDS,
    enterpriseReason: 'Address entry must leave a source-of-truth record showing which tab or pane received the URL.'
  },
  {
    id: 'pass187-mouse-button-4-target-truth',
    source: 'mouse-button-4',
    expectedTarget: 'mission-active-pane',
    requiredFields: PASS187_REQUIRED_NAVIGATION_TRUTH_FIELDS,
    enterpriseReason: 'Mouse Button 4 must be auditable against toolbar/menu/keyboard back routing.'
  },
  {
    id: 'pass187-mouse-button-5-target-truth',
    source: 'mouse-button-5',
    expectedTarget: 'mission-active-pane',
    requiredFields: PASS187_REQUIRED_NAVIGATION_TRUTH_FIELDS,
    enterpriseReason: 'Mouse Button 5 must be auditable against toolbar/menu/keyboard forward routing.'
  },
  {
    id: 'pass187-menu-back-target-truth',
    source: 'menu-back',
    expectedTarget: 'mission-active-pane',
    requiredFields: PASS187_REQUIRED_NAVIGATION_TRUTH_FIELDS,
    enterpriseReason: 'Application menu navigation must resolve through the same target truth contract as toolbar navigation.'
  },
  {
    id: 'pass187-alt-left-target-truth',
    source: 'alt-left',
    expectedTarget: 'mission-active-pane',
    requiredFields: PASS187_REQUIRED_NAVIGATION_TRUTH_FIELDS,
    enterpriseReason: 'Alt+Left must be traceable to one active pane or tab so keyboard muscle memory cannot hit the wrong surface.'
  },
  {
    id: 'pass187-safe-noop-target-truth',
    source: 'scheduled-diagnostic',
    expectedTarget: 'safe-noop',
    requiredFields: PASS187_REQUIRED_NAVIGATION_TRUTH_FIELDS,
    enterpriseReason: 'No-target and history-unavailable conditions must produce explicit safe-noop evidence, not silent ambiguity.'
  }
] as const;

export const PASS187_NAVIGATION_TRUTH_HISTORY_LIMIT = 40;

export function pass187NavigationTruthCaseIds(): string[] {
  return PASS187_NAVIGATION_TRUTH_MATRIX.map((testCase) => testCase.id);
}

export function pass187RequiredNavigationTruthFieldNames(): string[] {
  return [...PASS187_REQUIRED_NAVIGATION_TRUTH_FIELDS];
}
