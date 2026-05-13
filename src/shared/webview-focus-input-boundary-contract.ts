export const PASS188_WEBVIEW_FOCUS_INPUT_BOUNDARY_VERSION = 'pass188-webview-focus-input-boundary-v1' as const;

export type Pass188FocusSurface =
  | 'browser-shell'
  | 'address-bar'
  | 'toolbar'
  | 'webview-guest'
  | 'mission-pane'
  | 'mission-pane-head'
  | 'app-overlay'
  | 'command-palette'
  | 'tool-menu'
  | 'dialog'
  | 'unknown';

export type Pass188InputBoundaryCommand =
  | 'focus-address'
  | 'command-palette'
  | 'escape'
  | 'history-back'
  | 'history-forward'
  | 'mission-pane-1'
  | 'mission-pane-2'
  | 'mission-pane-3'
  | 'mission-pane-4';

export type Pass188InputBoundarySource = 'browser-window' | 'webview-guest' | 'shell-renderer' | 'unknown';

export type Pass188BeforeInputLike = {
  readonly type?: string;
  readonly key?: string;
  readonly code?: string;
  readonly control?: boolean;
  readonly meta?: boolean;
  readonly alt?: boolean;
  readonly shift?: boolean;
};

export type Pass188InputBoundaryPayload = {
  readonly version: typeof PASS188_WEBVIEW_FOCUS_INPUT_BOUNDARY_VERSION;
  readonly command: Pass188InputBoundaryCommand;
  readonly source: Pass188InputBoundarySource;
  readonly fromGuest: boolean;
  readonly key: string;
  readonly code: string;
  readonly createdAt: string;
};

export type Pass188FocusInputBoundaryCase = {
  readonly id: string;
  readonly surface: Pass188FocusSurface;
  readonly input: string;
  readonly expectedRecovery: string;
  readonly enterpriseReason: string;
};

export const PASS188_FOCUS_INPUT_BOUNDARY_COMMANDS: readonly Pass188InputBoundaryCommand[] = [
  'focus-address',
  'command-palette',
  'escape',
  'history-back',
  'history-forward',
  'mission-pane-1',
  'mission-pane-2',
  'mission-pane-3',
  'mission-pane-4'
] as const;

export const PASS188_FOCUS_INPUT_BOUNDARY_SURFACES: readonly Pass188FocusSurface[] = [
  'browser-shell',
  'address-bar',
  'toolbar',
  'webview-guest',
  'mission-pane',
  'mission-pane-head',
  'app-overlay',
  'command-palette',
  'tool-menu',
  'dialog',
  'unknown'
] as const;

export const PASS188_FOCUS_INPUT_BOUNDARY_MATRIX: readonly Pass188FocusInputBoundaryCase[] = [
  {
    id: 'pass188-webview-ctrl-l-address-recovery',
    surface: 'webview-guest',
    input: 'Ctrl/Cmd+L',
    expectedRecovery: 'focus-address',
    enterpriseReason: 'Remote page focus must not trap the operator away from the address bar.'
  },
  {
    id: 'pass188-webview-ctrl-k-command-recovery',
    surface: 'webview-guest',
    input: 'Ctrl/Cmd+K',
    expectedRecovery: 'command-palette',
    enterpriseReason: 'Command Center must remain reachable even when the active guest page owns focus.'
  },
  {
    id: 'pass188-webview-alt-left-history-recovery',
    surface: 'webview-guest',
    input: 'Alt+Left',
    expectedRecovery: 'history-back',
    enterpriseReason: 'Keyboard history navigation must route through the same active pane truth model as toolbar and mouse history.'
  },
  {
    id: 'pass188-webview-alt-right-history-recovery',
    surface: 'webview-guest',
    input: 'Alt+Right',
    expectedRecovery: 'history-forward',
    enterpriseReason: 'Forward navigation must not disappear inside a remote webview.'
  },
  {
    id: 'pass188-webview-ctrl-alt-pane-recovery',
    surface: 'webview-guest',
    input: 'Ctrl/Cmd+Alt+1..4',
    expectedRecovery: 'mission-pane-1..4',
    enterpriseReason: 'Mission pane focus shortcuts must continue to work when a pane webview has keyboard focus.'
  },
  {
    id: 'pass188-overlay-escape-recovery',
    surface: 'app-overlay',
    input: 'Escape',
    expectedRecovery: 'escape',
    enterpriseReason: 'Overlays need one deterministic Escape path and focus return path.'
  },
  {
    id: 'pass188-command-palette-focus-return',
    surface: 'command-palette',
    input: 'Close/escape',
    expectedRecovery: 'browser-shell',
    enterpriseReason: 'Command Center should return focus to a known shell surface instead of leaving focus in a stale dialog.'
  },
  {
    id: 'pass188-mission-pane-click-activation',
    surface: 'mission-pane',
    input: 'Pointer/focusin',
    expectedRecovery: 'active-pane-marker',
    enterpriseReason: 'Clicking a pane must make it the active target for later navigation commands.'
  },
  {
    id: 'pass188-tool-menu-focus-containment',
    surface: 'tool-menu',
    input: 'Arrow/Escape',
    expectedRecovery: 'tool-menu-or-opener',
    enterpriseReason: 'Tool menu input must stay contained and return to its opener on dismissal.'
  }
] as const;

export function pass188NormalizeBeforeInputCommand(input: Pass188BeforeInputLike): Pass188InputBoundaryCommand | undefined {
  if (input.type && input.type !== 'keyDown') return undefined;
  const key = String(input.key || '').toLowerCase();
  const code = String(input.code || '');
  const hasPrimary = Boolean(input.control || input.meta);
  if (hasPrimary && !input.alt && key === 'l') return 'focus-address';
  if (hasPrimary && !input.alt && key === 'k') return 'command-palette';
  if (key === 'escape') return 'escape';
  if (input.alt && !hasPrimary && key === 'arrowleft') return 'history-back';
  if (input.alt && !hasPrimary && key === 'arrowright') return 'history-forward';
  if (hasPrimary && input.alt && !input.shift) {
    const paneNumber = key.match(/^[1-4]$/) ? key : code.match(/^(?:Digit|Numpad)([1-4])$/)?.[1];
    if (paneNumber === '1' || paneNumber === '2' || paneNumber === '3' || paneNumber === '4') {
      return `mission-pane-${paneNumber}` as Pass188InputBoundaryCommand;
    }
  }
  return undefined;
}

export function pass188FocusInputBoundaryCaseIds(): string[] {
  return PASS188_FOCUS_INPUT_BOUNDARY_MATRIX.map((testCase) => testCase.id);
}

export function pass188FocusInputBoundarySummary(): string[] {
  return [
    `version=${PASS188_WEBVIEW_FOCUS_INPUT_BOUNDARY_VERSION}`,
    `commands=${PASS188_FOCUS_INPUT_BOUNDARY_COMMANDS.join(',')}`,
    `surfaces=${PASS188_FOCUS_INPUT_BOUNDARY_SURFACES.join(',')}`,
    `cases=${PASS188_FOCUS_INPUT_BOUNDARY_MATRIX.length}`
  ];
}
