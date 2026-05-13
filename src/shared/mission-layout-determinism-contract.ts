export const PASS197_MISSION_LAYOUT_DETERMINISM_PASS = 'PASS197';
export const PASS197_MISSION_LAYOUT_DETERMINISM_VERSION = 'pass197-mission-layout-determinism-v1';
export const PASS197_MISSION_LAYOUT_DETERMINISM_CONTRACT_ID = 'mission-layout-determinism-v1';

export type Pass197MissionLayoutCaseId =
  | 'pass197-single-layout-determinism'
  | 'pass197-split-horizontal-layout-determinism'
  | 'pass197-split-vertical-layout-determinism'
  | 'pass197-triple-layout-determinism'
  | 'pass197-triple-top-layout-determinism'
  | 'pass197-triple-bottom-layout-determinism'
  | 'pass197-triple-left-layout-determinism'
  | 'pass197-triple-right-layout-determinism'
  | 'pass197-quad-layout-determinism'
  | 'pass197-focus-pane-restore-determinism';

export type Pass197MissionLayoutSnapshotField =
  | 'layoutType'
  | 'activePaneId'
  | 'visiblePaneIds'
  | 'restoreLayoutType'
  | 'paneId'
  | 'paneRole'
  | 'paneUrl'
  | 'paneTitle'
  | 'runtimeTabId'
  | 'isActivePane'
  | 'canGoBack'
  | 'canGoForward';

export type Pass197MissionLayoutCase = {
  readonly id: Pass197MissionLayoutCaseId;
  readonly layoutType: string;
  readonly expectedPaneCount: number;
  readonly requiredFields: readonly Pass197MissionLayoutSnapshotField[];
  readonly enterpriseReason: string;
};

export const PASS197_REQUIRED_MISSION_LAYOUT_FIELDS: readonly Pass197MissionLayoutSnapshotField[] = [
  'layoutType',
  'activePaneId',
  'visiblePaneIds',
  'restoreLayoutType',
  'paneId',
  'paneRole',
  'paneUrl',
  'paneTitle',
  'runtimeTabId',
  'isActivePane',
  'canGoBack',
  'canGoForward'
] as const;

export const PASS197_MISSION_LAYOUT_DETERMINISM_MATRIX: readonly Pass197MissionLayoutCase[] = [
  {
    id: 'pass197-single-layout-determinism',
    layoutType: 'single',
    expectedPaneCount: 1,
    requiredFields: PASS197_REQUIRED_MISSION_LAYOUT_FIELDS,
    enterpriseReason: '1-Up must restore webviews to normal browser behavior without losing the Mission pane assignment model.'
  },
  {
    id: 'pass197-split-horizontal-layout-determinism',
    layoutType: 'split-horizontal',
    expectedPaneCount: 2,
    requiredFields: PASS197_REQUIRED_MISSION_LAYOUT_FIELDS,
    enterpriseReason: '2-Up Split must keep pane-1 and pane-2 roles, URLs, titles, runtime tab IDs, focus, and history truth stable.'
  },
  {
    id: 'pass197-split-vertical-layout-determinism',
    layoutType: 'split-vertical',
    expectedPaneCount: 2,
    requiredFields: PASS197_REQUIRED_MISSION_LAYOUT_FIELDS,
    enterpriseReason: '2-Up Stack must use the same deterministic pane assignments as side-by-side split.'
  },
  {
    id: 'pass197-triple-layout-determinism',
    layoutType: 'triple',
    expectedPaneCount: 3,
    requiredFields: PASS197_REQUIRED_MISSION_LAYOUT_FIELDS,
    enterpriseReason: 'Legacy 3-Up must normalize to a deterministic three-pane runtime surface.'
  },
  {
    id: 'pass197-triple-top-layout-determinism',
    layoutType: 'triple-top',
    expectedPaneCount: 3,
    requiredFields: PASS197_REQUIRED_MISSION_LAYOUT_FIELDS,
    enterpriseReason: '3-Up Top Wide must preserve each pane assignment while only changing geometry.'
  },
  {
    id: 'pass197-triple-bottom-layout-determinism',
    layoutType: 'triple-bottom',
    expectedPaneCount: 3,
    requiredFields: PASS197_REQUIRED_MISSION_LAYOUT_FIELDS,
    enterpriseReason: '3-Up Bottom Wide must preserve each pane assignment while only changing geometry.'
  },
  {
    id: 'pass197-triple-left-layout-determinism',
    layoutType: 'triple-left',
    expectedPaneCount: 3,
    requiredFields: PASS197_REQUIRED_MISSION_LAYOUT_FIELDS,
    enterpriseReason: '3-Up Left Tall must preserve each pane assignment while only changing geometry.'
  },
  {
    id: 'pass197-triple-right-layout-determinism',
    layoutType: 'triple-right',
    expectedPaneCount: 3,
    requiredFields: PASS197_REQUIRED_MISSION_LAYOUT_FIELDS,
    enterpriseReason: '3-Up Right Tall must preserve each pane assignment while only changing geometry.'
  },
  {
    id: 'pass197-quad-layout-determinism',
    layoutType: 'quad',
    expectedPaneCount: 4,
    requiredFields: PASS197_REQUIRED_MISSION_LAYOUT_FIELDS,
    enterpriseReason: '4-Up Quad Ops must preserve all four pane assignments and make the active pane explicit.'
  },
  {
    id: 'pass197-focus-pane-restore-determinism',
    layoutType: 'focus',
    expectedPaneCount: 1,
    requiredFields: PASS197_REQUIRED_MISSION_LAYOUT_FIELDS,
    enterpriseReason: 'Focus Pane must maximize exactly one active pane and restore the prior non-focus layout on the next toggle.'
  }
] as const;

export const PASS197_MISSION_LAYOUT_RESTORE_RULES = [
  'Focus Pane stores the prior non-focus layout before entering focus.',
  'Leaving Focus Pane restores the prior layout unless it is single, command, or focus; those fall back to Quad Ops.',
  'Every layout render records visiblePaneIds, activePaneId, role, URL, title, runtimeTabId, and history availability.',
  'Layout changes may alter geometry, but must not rewrite pane roles, URLs, titles, or runtime tab mapping.'
] as const;

export function pass197MissionLayoutDeterminismCaseIds(): string[] {
  return PASS197_MISSION_LAYOUT_DETERMINISM_MATRIX.map((testCase) => testCase.id);
}

export function pass197MissionLayoutDeterminismFieldNames(): string[] {
  return [...PASS197_REQUIRED_MISSION_LAYOUT_FIELDS];
}

export function pass197MissionLayoutDeterminismSummary(): string {
  return `${PASS197_MISSION_LAYOUT_DETERMINISM_PASS} ${PASS197_MISSION_LAYOUT_DETERMINISM_CONTRACT_ID}: ${PASS197_MISSION_LAYOUT_DETERMINISM_MATRIX.length} layout cases require deterministic active pane, visible pane, tab, title, URL, role, history, and Focus Pane restore truth.`;
}
